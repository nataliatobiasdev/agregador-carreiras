import { eq } from 'drizzle-orm'
import type { ApplicationListItem, ContactDto, ContactListItem, TimelineEventDto } from '../../shared/dto'
import { AppError } from '../../shared/errors'
import { type AppContext, nowIso } from '../context'
import { contacts } from '../db/schema'
import { diffFields } from '../domain/audit'
import { newId } from '../domain/ids'
import { blankToNull, nameKey } from '../domain/normalize'
import { APPLICATION_LIST_COLUMNS, APPLICATION_LIST_FROM } from './applications-queries'
import { writeAudit } from './audit'
import { listEventsWhere } from './events'
import { reindexContact } from './search'
import { tx } from './tx'

export interface ContactInput {
  name: string
  companyId?: string | null
  roleTitle?: string | null
  email?: string | null
  phone?: string | null
  linkedinUrl?: string | null
  keepInTouch?: boolean
  notes?: string | null
}

const CONTACT_SELECT = `SELECT ct.id, ct.name, ct.company_id AS companyId, c.name AS companyName, ct.role_title AS roleTitle,
       ct.email, ct.phone, ct.linkedin_url AS linkedinUrl, ct.keep_in_touch AS keepInTouch, ct.notes,
       ct.deleted_at AS deletedAt, ct.created_at AS createdAt, ct.updated_at AS updatedAt
  FROM contacts ct LEFT JOIN companies c ON c.id = ct.company_id`

const fix = <T extends { keepInTouch: unknown }>(r: T): T => ({ ...r, keepInTouch: Boolean(r.keepInTouch) })

export function getContact(ctx: AppContext, id: string): ContactDto {
  const row = ctx.sqlite.prepare(`${CONTACT_SELECT} WHERE ct.id = ?`).get(id) as ContactDto | undefined
  if (!row) throw new AppError('NOT_FOUND', 'Contato não encontrado')
  return fix(row)
}

function assertCompany(ctx: AppContext, companyId: string | null | undefined): void {
  if (!companyId) return
  const c = ctx.sqlite.prepare('SELECT deleted_at FROM companies WHERE id = ?').get(companyId) as
    | { deleted_at: string | null }
    | undefined
  if (!c || c.deleted_at) throw new AppError('NOT_FOUND', 'Empresa não encontrada')
}

export function createContact(ctx: AppContext, input: ContactInput): ContactDto {
  return tx(ctx, () => {
    assertCompany(ctx, input.companyId)
    const at = nowIso(ctx)
    const row = {
      id: newId(),
      name: input.name.trim(),
      companyId: input.companyId ?? null,
      roleTitle: blankToNull(input.roleTitle),
      email: blankToNull(input.email),
      phone: blankToNull(input.phone),
      linkedinUrl: blankToNull(input.linkedinUrl),
      keepInTouch: input.keepInTouch ?? false,
      notes: blankToNull(input.notes),
      createdAt: at,
      updatedAt: at
    }
    ctx.orm.insert(contacts).values(row).run()
    writeAudit(ctx, 'contact', row.id, 'create')
    reindexContact(ctx, row.id)
    return getContact(ctx, row.id)
  })
}

/** Finds a live contact by exact name (ignoring accents/case) within the company, or creates one. */
export function findOrCreateContact(
  ctx: AppContext,
  ref: { id: string } | { name: string },
  companyId: string | null
): string {
  if ('id' in ref) {
    const row = ctx.orm.select().from(contacts).where(eq(contacts.id, ref.id)).get()
    if (!row || row.deletedAt) throw new AppError('NOT_FOUND', 'Contato não encontrado')
    return row.id
  }
  const key = nameKey(ref.name)
  const candidates = ctx.sqlite
    .prepare('SELECT id, name, company_id AS companyId FROM contacts WHERE deleted_at IS NULL')
    .all() as Array<{ id: string; name: string; companyId: string | null }>
  const match = candidates.find((c) => nameKey(c.name) === key && (c.companyId === companyId || c.companyId === null))
  if (match) return match.id
  return createContact(ctx, { name: ref.name, companyId }).id
}

export function updateContact(ctx: AppContext, id: string, patch: Partial<ContactInput>): ContactDto {
  return tx(ctx, () => {
    const before = ctx.orm.select().from(contacts).where(eq(contacts.id, id)).get()
    if (!before) throw new AppError('NOT_FOUND', 'Contato não encontrado')
    if (patch.companyId !== undefined) assertCompany(ctx, patch.companyId)
    const next: Partial<typeof contacts.$inferInsert> = {}
    if (patch.name !== undefined) next.name = patch.name.trim()
    if (patch.companyId !== undefined) next.companyId = patch.companyId ?? null
    if (patch.keepInTouch !== undefined) next.keepInTouch = patch.keepInTouch
    for (const key of ['roleTitle', 'email', 'phone', 'linkedinUrl', 'notes'] as const) {
      if (patch[key] !== undefined) next[key] = blankToNull(patch[key])
    }
    const changes = diffFields(before, next)
    if (Object.keys(changes).length > 0) {
      ctx.orm
        .update(contacts)
        .set({ ...next, updatedAt: nowIso(ctx) })
        .where(eq(contacts.id, id))
        .run()
      writeAudit(ctx, 'contact', id, 'update', changes)
      reindexContact(ctx, id)
    }
    return getContact(ctx, id)
  })
}

export function deleteContact(ctx: AppContext, id: string): void {
  tx(ctx, () => {
    const row = ctx.orm.select().from(contacts).where(eq(contacts.id, id)).get()
    if (!row || row.deletedAt) throw new AppError('NOT_FOUND', 'Contato não encontrado')
    ctx.orm.update(contacts).set({ deletedAt: nowIso(ctx), updatedAt: nowIso(ctx) }).where(eq(contacts.id, id)).run()
    writeAudit(ctx, 'contact', id, 'delete')
    reindexContact(ctx, id)
  })
}

export function restoreContact(ctx: AppContext, id: string): void {
  tx(ctx, () => {
    const row = ctx.orm.select().from(contacts).where(eq(contacts.id, id)).get()
    if (!row || !row.deletedAt) throw new AppError('NOT_FOUND', 'Contato não está na Lixeira')
    ctx.orm.update(contacts).set({ deletedAt: null, updatedAt: nowIso(ctx) }).where(eq(contacts.id, id)).run()
    writeAudit(ctx, 'contact', id, 'restore')
    reindexContact(ctx, id)
  })
}

export function listContacts(ctx: AppContext, filter: { text?: string; companyId?: string } = {}): ContactListItem[] {
  const rows = ctx.sqlite
    .prepare(
      `SELECT x.*,
              (SELECT max(e.occurred_at) FROM events e WHERE e.contact_id = x.id AND e.voided_at IS NULL) AS lastInteractionAt,
              (SELECT count(DISTINCT ac.application_id) FROM application_contacts ac
                 JOIN applications a ON a.id = ac.application_id AND a.deleted_at IS NULL
                WHERE ac.contact_id = x.id) AS applicationCount
         FROM (${CONTACT_SELECT} WHERE ct.deleted_at IS NULL) x
        ${filter.companyId ? 'WHERE x.companyId = @companyId' : ''}
        ORDER BY x.name COLLATE NOCASE`
    )
    .all(filter.companyId ? { companyId: filter.companyId } : {}) as ContactListItem[]
  const key = filter.text ? nameKey(filter.text) : ''
  return rows.map(fix).filter((r) => !key || nameKey(`${r.name} ${r.companyName ?? ''} ${r.email ?? ''}`).includes(key))
}

export function contactTimeline(ctx: AppContext, id: string): TimelineEventDto[] {
  return listEventsWhere(ctx, 'e.contact_id = ?', [id])
}

export function contactApplications(ctx: AppContext, id: string): Array<ApplicationListItem & { role: string }> {
  return ctx.sqlite
    .prepare(
      `SELECT ${APPLICATION_LIST_COLUMNS}, ac.role AS role
         ${APPLICATION_LIST_FROM}
         JOIN application_contacts ac ON ac.application_id = a.id
        WHERE ac.contact_id = ? AND a.deleted_at IS NULL
        ORDER BY a.applied_at DESC`
    )
    .all(id) as Array<ApplicationListItem & { role: string }>
}
