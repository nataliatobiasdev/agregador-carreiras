import { desc, eq } from 'drizzle-orm'
import type { NoteDto, NoteRevisionDto, NoteTemplateDto } from '../../shared/dto'
import type { NoteKind } from '../../shared/enums'
import { AppError } from '../../shared/errors'
import { type AppContext, nowIso } from '../context'
import { noteRevisions, noteTemplates, notes } from '../db/schema'
import { diffFields } from '../domain/audit'
import { newId } from '../domain/ids'
import { writeAudit } from './audit'
import { reindexNote } from './search'
import { tx } from './tx'

/** At most one stored revision per minute: saves within the window replace the latest one. */
export const REVISION_WINDOW_MS = 60_000

export interface NoteOwner {
  applicationId?: string | null
  companyId?: string | null
  contactId?: string | null
}

const NOTE_SELECT = `SELECT n.id, n.kind, n.title, n.body_md AS bodyMd, n.application_id AS applicationId,
       n.company_id AS companyId, n.contact_id AS contactId, n.interview_id AS interviewId, n.pinned,
       n.deleted_at AS deletedAt, n.created_at AS createdAt, n.updated_at AS updatedAt,
       CASE
         WHEN n.application_id IS NOT NULL THEN (SELECT a.title || ' — ' || c.name FROM applications a JOIN companies c ON c.id = a.company_id WHERE a.id = n.application_id)
         WHEN n.company_id IS NOT NULL THEN (SELECT name FROM companies WHERE id = n.company_id)
         WHEN n.contact_id IS NOT NULL THEN (SELECT name FROM contacts WHERE id = n.contact_id)
         ELSE NULL END AS ownerLabel
  FROM notes n`

const fix = (r: NoteDto): NoteDto => ({ ...r, pinned: Boolean(r.pinned) })

export function getNote(ctx: AppContext, id: string): NoteDto {
  const row = ctx.sqlite.prepare(`${NOTE_SELECT} WHERE n.id = ?`).get(id) as NoteDto | undefined
  if (!row) throw new AppError('NOT_FOUND', 'Nota não encontrada')
  return fix(row)
}

function assertOwner(ctx: AppContext, owner: NoteOwner): void {
  const checks: Array<[string | null | undefined, string, string]> = [
    [owner.applicationId, 'applications', 'Candidatura'],
    [owner.companyId, 'companies', 'Empresa'],
    [owner.contactId, 'contacts', 'Contato']
  ]
  const set = checks.filter(([v]) => v)
  if (set.length > 1) throw new AppError('VALIDATION', 'Uma nota pertence a no máximo um registro')
  for (const [value, table, label] of set) {
    const row = ctx.sqlite.prepare(`SELECT deleted_at FROM ${table} WHERE id = ?`).get(value) as
      | { deleted_at: string | null }
      | undefined
    if (!row || row.deleted_at) throw new AppError('NOT_FOUND', `${label} não encontrada`)
  }
}

function saveRevision(ctx: AppContext, noteId: string, title: string, bodyMd: string): void {
  const at = nowIso(ctx)
  const last = ctx.orm
    .select()
    .from(noteRevisions)
    .where(eq(noteRevisions.noteId, noteId))
    .orderBy(desc(noteRevisions.savedAt), desc(noteRevisions.id))
    .get()
  if (last && last.title === title && last.bodyMd === bodyMd) return
  if (last && Date.parse(at) - Date.parse(last.savedAt) < REVISION_WINDOW_MS) {
    ctx.orm.update(noteRevisions).set({ title, bodyMd, savedAt: at }).where(eq(noteRevisions.id, last.id)).run()
    return
  }
  ctx.orm.insert(noteRevisions).values({ id: newId(), noteId, title, bodyMd, savedAt: at }).run()
}

export function createNote(
  ctx: AppContext,
  input: { kind: NoteKind; title: string; bodyMd?: string; owner?: NoteOwner; fromTemplateId?: string }
): NoteDto {
  return tx(ctx, () => {
    const owner = input.owner ?? {}
    assertOwner(ctx, owner)
    let body = input.bodyMd
    if (body === undefined) {
      const template = input.fromTemplateId
        ? ctx.orm.select().from(noteTemplates).where(eq(noteTemplates.id, input.fromTemplateId)).get()
        : ctx.orm.select().from(noteTemplates).where(eq(noteTemplates.kind, input.kind)).get()
      body = template?.bodyMd ?? ''
    }
    const at = nowIso(ctx)
    const id = newId()
    ctx.orm
      .insert(notes)
      .values({
        id,
        kind: input.kind,
        title: input.title.trim(),
        bodyMd: body,
        applicationId: owner.applicationId ?? null,
        companyId: owner.companyId ?? null,
        contactId: owner.contactId ?? null,
        createdAt: at,
        updatedAt: at
      })
      .run()
    saveRevision(ctx, id, input.title.trim(), body)
    writeAudit(ctx, 'note', id, 'create')
    reindexNote(ctx, id)
    return getNote(ctx, id)
  })
}

export function updateNote(
  ctx: AppContext,
  input: { id: string; title?: string; bodyMd?: string; kind?: NoteKind; pinned?: boolean }
): NoteDto {
  return tx(ctx, () => {
    const before = ctx.orm.select().from(notes).where(eq(notes.id, input.id)).get()
    if (!before || before.deletedAt) throw new AppError('NOT_FOUND', 'Nota não encontrada')
    const next: Partial<typeof notes.$inferInsert> = {}
    if (input.title !== undefined) next.title = input.title.trim()
    if (input.bodyMd !== undefined) next.bodyMd = input.bodyMd
    if (input.kind !== undefined) next.kind = input.kind
    if (input.pinned !== undefined) next.pinned = input.pinned
    const changes = diffFields(before, next)
    if (Object.keys(changes).length === 0) return getNote(ctx, input.id)
    ctx.orm
      .update(notes)
      .set({ ...next, updatedAt: nowIso(ctx) })
      .where(eq(notes.id, input.id))
      .run()
    if (changes.title || changes.bodyMd) saveRevision(ctx, input.id, next.title ?? before.title, next.bodyMd ?? before.bodyMd)
    // The body itself is kept in note_revisions; the audit log only records that it changed.
    const auditChanges = { ...changes }
    if (auditChanges.bodyMd) auditChanges.bodyMd = ['…', '…']
    writeAudit(ctx, 'note', input.id, 'update', auditChanges)
    reindexNote(ctx, input.id)
    return getNote(ctx, input.id)
  })
}

export function listNotes(
  ctx: AppContext,
  filter: { applicationId?: string; companyId?: string; contactId?: string; kind?: NoteKind } = {}
): NoteDto[] {
  const where = ['n.deleted_at IS NULL']
  const params: Record<string, unknown> = {}
  for (const [key, col] of [
    ['applicationId', 'application_id'],
    ['companyId', 'company_id'],
    ['contactId', 'contact_id'],
    ['kind', 'kind']
  ] as const) {
    if (filter[key]) {
      where.push(`n.${col} = @${key}`)
      params[key] = filter[key]
    }
  }
  if (!filter.applicationId) where.push('(n.application_id IS NULL OR EXISTS (SELECT 1 FROM applications a WHERE a.id = n.application_id AND a.deleted_at IS NULL))')
  return (
    ctx.sqlite
      .prepare(`${NOTE_SELECT} WHERE ${where.join(' AND ')} ORDER BY n.pinned DESC, n.updated_at DESC`)
      .all(params) as NoteDto[]
  ).map(fix)
}

export function setNoteDeleted(ctx: AppContext, id: string, deleted: boolean): void {
  tx(ctx, () => {
    const row = ctx.orm.select().from(notes).where(eq(notes.id, id)).get()
    if (!row || Boolean(row.deletedAt) === deleted) throw new AppError('NOT_FOUND', 'Nota não encontrada')
    ctx.orm
      .update(notes)
      .set({ deletedAt: deleted ? nowIso(ctx) : null, updatedAt: nowIso(ctx) })
      .where(eq(notes.id, id))
      .run()
    writeAudit(ctx, 'note', id, deleted ? 'delete' : 'restore')
    reindexNote(ctx, id)
  })
}

export function purgeNote(ctx: AppContext, id: string): void {
  tx(ctx, () => {
    const row = ctx.orm.select().from(notes).where(eq(notes.id, id)).get()
    if (!row?.deletedAt) throw new AppError('CONFLICT', 'Só é possível excluir em definitivo itens da Lixeira')
    ctx.orm.delete(notes).where(eq(notes.id, id)).run()
    reindexNote(ctx, id)
    writeAudit(ctx, 'note', id, 'delete', { purged: [false, true] })
  })
}

export function noteRevisionsOf(ctx: AppContext, noteId: string): NoteRevisionDto[] {
  return ctx.orm
    .select()
    .from(noteRevisions)
    .where(eq(noteRevisions.noteId, noteId))
    .orderBy(desc(noteRevisions.savedAt), desc(noteRevisions.id))
    .all()
}

export function restoreNoteRevision(ctx: AppContext, revisionId: string): NoteDto {
  const rev = ctx.orm.select().from(noteRevisions).where(eq(noteRevisions.id, revisionId)).get()
  if (!rev) throw new AppError('NOT_FOUND', 'Versão não encontrada')
  return updateNote(ctx, { id: rev.noteId, title: rev.title, bodyMd: rev.bodyMd })
}

export function listNoteTemplates(ctx: AppContext): NoteTemplateDto[] {
  return ctx.orm
    .select({ id: noteTemplates.id, kind: noteTemplates.kind, name: noteTemplates.name, bodyMd: noteTemplates.bodyMd })
    .from(noteTemplates)
    .all() as NoteTemplateDto[]
}

export function updateNoteTemplate(ctx: AppContext, id: string, bodyMd: string): void {
  const res = ctx.orm.update(noteTemplates).set({ bodyMd, updatedAt: nowIso(ctx) }).where(eq(noteTemplates.id, id)).run()
  if (res.changes === 0) throw new AppError('NOT_FOUND', 'Template não encontrado')
}
