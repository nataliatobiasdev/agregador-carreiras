/** Trash (30 days): lists soft-deleted records, restores them and purges them for good. */
import type { TrashItem } from '../../shared/dto'
import { AppError } from '../../shared/errors'
import type { AppContext } from '../context'
import { purgeApplication, restoreApplication } from './applications'
import { restoreCompany } from './companies'
import { restoreContact } from './contacts'
import { purgeAttachment, setAttachmentDeleted } from './files'
import { purgeNote, setNoteDeleted } from './notes'
import { removeFromIndex } from './search'
import { writeAudit } from './audit'
import { tx } from './tx'

export const TRASH_RETENTION_DAYS = 30
const DAY_MS = 86_400_000

type TrashType = TrashItem['entityType']

export function listTrash(ctx: AppContext): TrashItem[] {
  const rows = ctx.sqlite
    .prepare(
      `SELECT 'application' AS entityType, a.id, a.title AS title, c.name AS subtitle, a.deleted_at AS deletedAt
         FROM applications a JOIN companies c ON c.id = a.company_id WHERE a.deleted_at IS NOT NULL
       UNION ALL
       SELECT 'company', id, name, NULL, deleted_at FROM companies WHERE deleted_at IS NOT NULL
       UNION ALL
       SELECT 'contact', id, name, NULL, deleted_at FROM contacts WHERE deleted_at IS NOT NULL
       UNION ALL
       SELECT 'note', id, title, NULL, deleted_at FROM notes WHERE deleted_at IS NOT NULL
       UNION ALL
       SELECT 'attachment', at.id, f.original_name, NULL, at.deleted_at
         FROM attachments at JOIN files f ON f.id = at.file_id WHERE at.deleted_at IS NOT NULL
       ORDER BY deletedAt DESC`
    )
    .all() as Array<Omit<TrashItem, 'daysLeft'>>
  const now = ctx.now().getTime()
  return rows.map((r) => ({
    ...r,
    daysLeft: Math.max(0, TRASH_RETENTION_DAYS - Math.floor((now - Date.parse(r.deletedAt)) / DAY_MS))
  }))
}

export function restoreFromTrash(ctx: AppContext, entityType: TrashType, id: string): void {
  switch (entityType) {
    case 'application':
      return restoreApplication(ctx, id)
    case 'company':
      return restoreCompany(ctx, id)
    case 'contact':
      return restoreContact(ctx, id)
    case 'note':
      return setNoteDeleted(ctx, id, false)
    case 'attachment':
      return setAttachmentDeleted(ctx, id, false)
  }
}

function purgeCompany(ctx: AppContext, id: string): void {
  tx(ctx, () => {
    const row = ctx.sqlite.prepare('SELECT deleted_at FROM companies WHERE id = ?').get(id) as { deleted_at: string | null } | undefined
    if (!row?.deleted_at) throw new AppError('CONFLICT', 'Só é possível excluir em definitivo itens da Lixeira')
    const apps = ctx.sqlite.prepare('SELECT count(*) AS n FROM applications WHERE company_id = ?').get(id) as { n: number }
    if (apps.n > 0) throw new AppError('CONFLICT', 'Ainda há candidaturas desta empresa (inclusive na Lixeira). Exclua-as em definitivo primeiro.')
    const liveNotes = ctx.sqlite.prepare('SELECT count(*) AS n FROM notes WHERE company_id = ? AND deleted_at IS NULL').get(id) as { n: number }
    if (liveNotes.n > 0) throw new AppError('CONFLICT', 'A empresa ainda tem notas. Exclua-as primeiro.')
    ctx.sqlite.prepare('DELETE FROM notes WHERE company_id = ?').run(id)
    ctx.sqlite.prepare('DELETE FROM companies WHERE id = ?').run(id)
    removeFromIndex(ctx, 'company', id)
    writeAudit(ctx, 'company', id, 'delete', { purged: [false, true] })
  })
}

function purgeContact(ctx: AppContext, id: string): void {
  tx(ctx, () => {
    const row = ctx.sqlite.prepare('SELECT deleted_at FROM contacts WHERE id = ?').get(id) as { deleted_at: string | null } | undefined
    if (!row?.deleted_at) throw new AppError('CONFLICT', 'Só é possível excluir em definitivo itens da Lixeira')
    const liveNotes = ctx.sqlite.prepare('SELECT count(*) AS n FROM notes WHERE contact_id = ? AND deleted_at IS NULL').get(id) as { n: number }
    if (liveNotes.n > 0) throw new AppError('CONFLICT', 'O contato ainda tem notas. Exclua-as primeiro.')
    ctx.sqlite.prepare('DELETE FROM notes WHERE contact_id = ?').run(id)
    ctx.sqlite.prepare('DELETE FROM contacts WHERE id = ?').run(id)
    removeFromIndex(ctx, 'contact', id)
    writeAudit(ctx, 'contact', id, 'delete', { purged: [false, true] })
  })
}

export function purgeFromTrash(ctx: AppContext, entityType: TrashType, id: string): void {
  switch (entityType) {
    case 'application':
      return purgeApplication(ctx, id)
    case 'company':
      return purgeCompany(ctx, id)
    case 'contact':
      return purgeContact(ctx, id)
    case 'note':
      return purgeNote(ctx, id)
    case 'attachment':
      return purgeAttachment(ctx, id)
  }
}

/** Purges items older than the retention period. Items that still have dependents are kept. */
export function purgeExpired(ctx: AppContext): { purged: number; kept: number } {
  let purged = 0
  let kept = 0
  // Attachments and notes first, then applications, then companies and contacts.
  const order: TrashType[] = ['attachment', 'note', 'application', 'contact', 'company']
  const expired = listTrash(ctx).filter((i) => i.daysLeft === 0)
  for (const type of order) {
    for (const item of expired.filter((i) => i.entityType === type)) {
      try {
        purgeFromTrash(ctx, item.entityType, item.id)
        purged++
      } catch {
        kept++
      }
    }
  }
  return { purged, kept }
}
