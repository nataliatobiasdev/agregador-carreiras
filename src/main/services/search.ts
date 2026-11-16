/**
 * Global full-text search over an FTS5 table (accent-insensitive). Services
 * keep the index in sync inside the same transaction as each write; rebuild()
 * recreates it from scratch.
 */
import type { SearchResult } from '../../shared/dto'
import type { AppContext } from '../context'

type IndexedType = SearchResult['entityType']

export function indexEntity(ctx: AppContext, entityType: IndexedType, entityId: string, title: string, body: string): void {
  removeFromIndex(ctx, entityType, entityId)
  ctx.sqlite
    .prepare('INSERT INTO search_index (entity_type, entity_id, title, body) VALUES (?, ?, ?, ?)')
    .run(entityType, entityId, title, body)
}

export function removeFromIndex(ctx: AppContext, entityType: IndexedType, entityId: string): void {
  ctx.sqlite.prepare('DELETE FROM search_index WHERE entity_type = ? AND entity_id = ?').run(entityType, entityId)
}

const join = (...parts: Array<string | null | undefined>): string => parts.filter(Boolean).join('\n')

export function reindexApplication(ctx: AppContext, applicationId: string): void {
  const row = ctx.sqlite
    .prepare(
      `SELECT a.id, a.title, a.job_description, a.requirements_required, a.requirements_desired, a.external_ref,
              a.city, a.country, a.deleted_at, c.name AS company,
              (SELECT group_concat(t.name, ' ') FROM taggings tg JOIN tags t ON t.id = tg.tag_id
                WHERE tg.entity_type = 'application' AND tg.entity_id = a.id) AS skills
         FROM applications a JOIN companies c ON c.id = a.company_id WHERE a.id = ?`
    )
    .get(applicationId) as Record<string, string | null> | undefined
  if (!row || row.deleted_at) return removeFromIndex(ctx, 'application', applicationId)
  indexEntity(
    ctx,
    'application',
    applicationId,
    `${row.title} — ${row.company}`,
    join(row.job_description, row.requirements_required, row.requirements_desired, row.external_ref, row.city, row.country, row.skills)
  )
}

export function reindexCompany(ctx: AppContext, companyId: string): void {
  const row = ctx.sqlite
    .prepare('SELECT name, industry, country, website, notes, deleted_at FROM companies WHERE id = ?')
    .get(companyId) as Record<string, string | null> | undefined
  if (!row || row.deleted_at) return removeFromIndex(ctx, 'company', companyId)
  indexEntity(ctx, 'company', companyId, row.name ?? '', join(row.industry, row.country, row.website, row.notes))
}

export function reindexContact(ctx: AppContext, contactId: string): void {
  const row = ctx.sqlite
    .prepare(
      `SELECT ct.name, ct.role_title, ct.email, ct.notes, ct.deleted_at, c.name AS company
         FROM contacts ct LEFT JOIN companies c ON c.id = ct.company_id WHERE ct.id = ?`
    )
    .get(contactId) as Record<string, string | null> | undefined
  if (!row || row.deleted_at) return removeFromIndex(ctx, 'contact', contactId)
  indexEntity(ctx, 'contact', contactId, row.name ?? '', join(row.role_title, row.company, row.email, row.notes))
}

export function reindexNote(ctx: AppContext, noteId: string): void {
  const row = ctx.sqlite.prepare('SELECT title, body_md, deleted_at FROM notes WHERE id = ?').get(noteId) as
    | Record<string, string | null>
    | undefined
  if (!row || row.deleted_at) return removeFromIndex(ctx, 'note', noteId)
  indexEntity(ctx, 'note', noteId, row.title ?? '', row.body_md ?? '')
}

export function reindexAttachment(ctx: AppContext, attachmentId: string): void {
  const row = ctx.sqlite
    .prepare(
      `SELECT f.original_name, a.caption, a.deleted_at FROM attachments a JOIN files f ON f.id = a.file_id WHERE a.id = ?`
    )
    .get(attachmentId) as Record<string, string | null> | undefined
  if (!row || row.deleted_at) return removeFromIndex(ctx, 'attachment', attachmentId)
  indexEntity(ctx, 'attachment', attachmentId, row.original_name ?? '', row.caption ?? '')
}

export function rebuildSearchIndex(ctx: AppContext): number {
  const run = ctx.sqlite.transaction(() => {
    ctx.sqlite.exec('DELETE FROM search_index')
    const ids = (sql: string) => (ctx.sqlite.prepare(sql).all() as { id: string }[]).map((r) => r.id)
    for (const i of ids('SELECT id FROM applications WHERE deleted_at IS NULL')) reindexApplication(ctx, i)
    for (const i of ids('SELECT id FROM companies WHERE deleted_at IS NULL')) reindexCompany(ctx, i)
    for (const i of ids('SELECT id FROM contacts WHERE deleted_at IS NULL')) reindexContact(ctx, i)
    for (const i of ids('SELECT id FROM notes WHERE deleted_at IS NULL')) reindexNote(ctx, i)
    for (const i of ids('SELECT id FROM attachments WHERE deleted_at IS NULL')) reindexAttachment(ctx, i)
    return (ctx.sqlite.prepare('SELECT count(*) AS n FROM search_index').get() as { n: number }).n
  })
  return run()
}

/** Turns free text into a safe FTS5 query: every word becomes a quoted prefix term. */
export function toFtsQuery(text: string): string | null {
  const words = text
    .normalize('NFC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0)
    .slice(0, 12)
  if (words.length === 0) return null
  return words.map((w) => `"${w.replace(/"/g, '""')}"*`).join(' ')
}

export function search(ctx: AppContext, text: string, limit = 30): SearchResult[] {
  const query = toFtsQuery(text)
  if (!query) return []
  const rows = ctx.sqlite
    .prepare(
      `SELECT s.entity_type AS entityType, s.entity_id AS entityId, s.title AS title,
              snippet(search_index, 3, '«', '»', '…', 12) AS snippet,
              CASE s.entity_type
                WHEN 'application' THEN s.entity_id
                WHEN 'note' THEN (SELECT application_id FROM notes WHERE id = s.entity_id)
                WHEN 'attachment' THEN (SELECT application_id FROM attachments WHERE id = s.entity_id)
                ELSE NULL END AS applicationId
         FROM search_index s
        WHERE search_index MATCH ?
        ORDER BY bm25(search_index, 0, 0, 5.0, 1.0)
        LIMIT ?`
    )
    .all(query, limit) as SearchResult[]
  return rows
}
