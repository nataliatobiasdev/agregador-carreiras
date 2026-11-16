import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import type { ApplicationDetail, ApplicationListItem, AuditEntryDto } from '../../shared/dto'
import type { ContactRole } from '../../shared/enums'
import type { ApplicationFilter, CreateApplicationInput, UpdateApplicationInput } from '../../shared/contracts'
import { AppError } from '../../shared/errors'
import { type AppContext, nowIso } from '../context'
import { applicationContacts, applications, events, notes, tags, taggings } from '../db/schema'
import { diffFields } from '../domain/audit'
import { newId } from '../domain/ids'
import { blankToNull, isHttpUrl, nameKey } from '../domain/normalize'
import { APPLICATION_LIST_COLUMNS, APPLICATION_LIST_FROM } from './applications-queries'
import { auditFor, writeAudit } from './audit'
import { findOrCreateCompany } from './companies'
import { findOrCreateContact } from './contacts'
import { defaultAppliedStageId, insertEvent, recomputeDerived } from './events'
import { collectGarbageFiles } from './files'
import { createNote } from './notes'
import { reindexApplication, removeFromIndex } from './search'
import { tx } from './tx'

type ApplicationRow = typeof applications.$inferSelect
type Fields = UpdateApplicationInput['patch']

/** Optional fields that feed the metrics; shown in the "Falta preencher" panel. */
export const COMPLETENESS_FIELDS = [
  'seniority',
  'area',
  'workMode',
  'employmentType',
  'country',
  'fitScore',
  'jobUrl',
  'jobDescription'
] as const satisfies ReadonlyArray<keyof ApplicationRow>

const SIMPLE_FIELDS = [
  'title',
  'platform',
  'channel',
  'jobUrl',
  'seniority',
  'area',
  'workMode',
  'city',
  'country',
  'employmentType',
  'priority',
  'fitScore',
  'postedSalaryMin',
  'postedSalaryMax',
  'postedCurrency',
  'postedPeriod',
  'expectedSalary',
  'expectedCurrency',
  'expectedPeriod',
  'jobDescription',
  'requirementsRequired',
  'requirementsDesired',
  'externalRef',
  'processLanguage',
  'needsVisa',
  'relocationOffered',
  'coverLetterText',
  'responseDeadline'
] as const satisfies ReadonlyArray<keyof Fields & keyof ApplicationRow>

function normalizeFields(input: Fields): Partial<ApplicationRow> {
  const out: Record<string, unknown> = {}
  for (const key of SIMPLE_FIELDS) {
    const value = input[key]
    if (value === undefined) continue
    out[key] = typeof value === 'string' ? blankToNull(value) : value
  }
  if (input.appliedAt !== undefined) out.appliedAt = new Date(input.appliedAt).toISOString()
  if (typeof out.responseDeadline === 'string') out.responseDeadline = new Date(out.responseDeadline).toISOString()
  if (typeof out.jobUrl === 'string' && !isHttpUrl(out.jobUrl))
    throw new AppError('VALIDATION', 'URL da vaga deve começar com http:// ou https://')
  return out as Partial<ApplicationRow>
}

/** Cross-field rules that the database also enforces with CHECK constraints. */
function validateMerged(row: Partial<ApplicationRow>): void {
  if (!row.title) throw new AppError('VALIDATION', 'Informe o cargo')
  if (!row.platform) throw new AppError('VALIDATION', 'Informe a plataforma')
  if (row.postedSalaryMin != null && row.postedSalaryMax != null && row.postedSalaryMin > row.postedSalaryMax)
    throw new AppError('VALIDATION', 'A faixa salarial mínima não pode ser maior que a máxima')
  if ((row.postedSalaryMin != null || row.postedSalaryMax != null) && !row.postedCurrency)
    throw new AppError('VALIDATION', 'Informe a moeda da faixa salarial divulgada')
  if (row.expectedSalary != null && !row.expectedCurrency)
    throw new AppError('VALIDATION', 'Informe a moeda da pretensão salarial')
}

function setSkills(ctx: AppContext, applicationId: string, skills: string[]): void {
  const byKey = new Map<string, string>()
  for (const s of skills) if (!byKey.has(nameKey(s))) byKey.set(nameKey(s), s.trim())
  const wanted = [...byKey.values()]
  ctx.sqlite
    .prepare(
      `DELETE FROM taggings WHERE entity_type = 'application' AND entity_id = ?
         AND tag_id IN (SELECT id FROM tags WHERE kind = 'skill')`
    )
    .run(applicationId)
  for (const name of wanted) {
    const existing = ctx.sqlite
      .prepare(`SELECT id, name FROM tags WHERE kind = 'skill'`)
      .all()
      .find((t) => nameKey((t as { name: string }).name) === nameKey(name)) as { id: string } | undefined
    const tagId = existing?.id ?? newId()
    if (!existing) ctx.orm.insert(tags).values({ id: tagId, name, kind: 'skill', createdAt: nowIso(ctx) }).run()
    ctx.orm.insert(taggings).values({ tagId, entityType: 'application', entityId: applicationId }).onConflictDoNothing().run()
  }
  // Orphan tags are removed by the service, as the spec requires.
  ctx.sqlite.exec(`DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM taggings)`)
}

function skillsOf(ctx: AppContext, applicationId: string): string[] {
  return (
    ctx.sqlite
      .prepare(
        `SELECT t.name FROM taggings tg JOIN tags t ON t.id = tg.tag_id
          WHERE tg.entity_type = 'application' AND tg.entity_id = ? AND t.kind = 'skill' ORDER BY t.name`
      )
      .all(applicationId) as { name: string }[]
  ).map((r) => r.name)
}

function getRow(ctx: AppContext, id: string): ApplicationRow {
  const row = ctx.orm.select().from(applications).where(eq(applications.id, id)).get()
  if (!row) throw new AppError('NOT_FOUND', 'Candidatura não encontrada')
  return row
}

function getLiveRow(ctx: AppContext, id: string): ApplicationRow {
  const row = getRow(ctx, id)
  if (row.deletedAt) throw new AppError('NOT_FOUND', 'Candidatura está na Lixeira')
  return row
}

export function createApplication(ctx: AppContext, input: CreateApplicationInput): { id: string } {
  return tx(ctx, () => {
    const companyId = findOrCreateCompany(ctx, input.company)
    if (input.previousApplicationId) getRow(ctx, input.previousApplicationId)
    const fields = normalizeFields(input)
    const at = nowIso(ctx)
    const appliedAt = new Date(input.appliedAt).toISOString()
    if (Date.parse(appliedAt) > ctx.now().getTime() + 5 * 60_000)
      throw new AppError('VALIDATION', 'A data da candidatura não pode estar no futuro.')
    const row = {
      ...fields,
      id: newId(),
      companyId,
      title: input.title.trim(),
      platform: input.platform.trim(),
      priority: input.priority ?? 'medium',
      appliedAt,
      previousApplicationId: input.previousApplicationId ?? null,
      status: 'active' as const,
      currentStageId: defaultAppliedStageId(ctx),
      createdAt: at,
      updatedAt: at
    }
    validateMerged(row)
    ctx.orm.insert(applications).values(row).run()
    insertEvent(ctx, { applicationId: row.id, type: 'applied', occurredAt: appliedAt })
    if (input.skills) setSkills(ctx, row.id, input.skills)
    if (input.recruiter) {
      const contactId = findOrCreateContact(ctx, input.recruiter, companyId)
      ctx.orm
        .insert(applicationContacts)
        .values({ applicationId: row.id, contactId, role: 'recruiter', createdAt: at })
        .onConflictDoNothing()
        .run()
    }
    if (input.initialNote && input.initialNote.trim()) {
      createNote(ctx, {
        kind: 'free',
        title: 'Nota inicial',
        bodyMd: input.initialNote,
        owner: { applicationId: row.id }
      })
    }
    writeAudit(ctx, 'application', row.id, 'create')
    reindexApplication(ctx, row.id)
    return { id: row.id }
  })
}

export function updateApplication(ctx: AppContext, input: UpdateApplicationInput): ApplicationDetail {
  tx(ctx, () => {
    const before = getLiveRow(ctx, input.id)
    const next = normalizeFields(input.patch)
    if (input.patch.company) next.companyId = findOrCreateCompany(ctx, input.patch.company)
    if (next.title !== undefined && !next.title) throw new AppError('VALIDATION', 'Informe o cargo')
    if (next.platform !== undefined && !next.platform) throw new AppError('VALIDATION', 'Informe a plataforma')
    validateMerged({ ...before, ...next })

    const changes = diffFields(before, next)
    if (input.patch.skills) {
      const prev = skillsOf(ctx, input.id)
      setSkills(ctx, input.id, input.patch.skills)
      const now = skillsOf(ctx, input.id)
      if (prev.join('|') !== now.join('|')) changes.skills = [prev, now]
    }
    if (Object.keys(changes).length === 0) return

    if (changes.appliedAt && next.appliedAt) {
      const earlier = ctx.sqlite
        .prepare(
          `SELECT count(*) AS n FROM events WHERE application_id = ? AND type <> 'applied'
             AND voided_at IS NULL AND occurred_at < ?`
        )
        .get(input.id, next.appliedAt) as { n: number }
      if (earlier.n > 0)
        throw new AppError('VALIDATION', 'Há eventos registrados antes da nova data da candidatura. Corrija-os primeiro.')
      if (Date.parse(next.appliedAt) > ctx.now().getTime() + 5 * 60_000)
        throw new AppError('VALIDATION', 'A data da candidatura não pode estar no futuro.')
      ctx.orm
        .update(events)
        .set({ occurredAt: next.appliedAt, updatedAt: nowIso(ctx) })
        .where(and(eq(events.applicationId, input.id), eq(events.type, 'applied')))
        .run()
    }
    const { ...dbChanges } = next
    ctx.orm
      .update(applications)
      .set({ ...dbChanges, updatedAt: nowIso(ctx) })
      .where(eq(applications.id, input.id))
      .run()
    if (changes.appliedAt) recomputeDerived(ctx, input.id)
    writeAudit(ctx, 'application', input.id, 'update', changes)
    reindexApplication(ctx, input.id)
  })
  return getApplication(ctx, input.id)
}

export function getApplication(ctx: AppContext, id: string): ApplicationDetail {
  const row = ctx.sqlite
    .prepare(
      `SELECT a.*, c.name AS company_name, s.name AS stage_name, s.category AS stage_category
         FROM applications a JOIN companies c ON c.id = a.company_id LEFT JOIN stages s ON s.id = a.current_stage_id
        WHERE a.id = ?`
    )
    .get(id) as Record<string, unknown> | undefined
  if (!row) throw new AppError('NOT_FOUND', 'Candidatura não encontrada')
  const base = getRow(ctx, id)
  const contacts = ctx.sqlite
    .prepare(
      `SELECT ac.contact_id AS contactId, ct.name, ac.role, ct.email, ct.linkedin_url AS linkedinUrl
         FROM application_contacts ac JOIN contacts ct ON ct.id = ac.contact_id
        WHERE ac.application_id = ? AND ct.deleted_at IS NULL ORDER BY ac.created_at`
    )
    .all(id) as ApplicationDetail['contacts']
  const others = ctx.sqlite
    .prepare(
      `SELECT id, title, applied_at AS appliedAt, status FROM applications
        WHERE company_id = ? AND id <> ? AND deleted_at IS NULL ORDER BY applied_at DESC LIMIT 20`
    )
    .all(base.companyId, id) as ApplicationDetail['otherApplicationsAtCompany']
  const missingFields = COMPLETENESS_FIELDS.filter((f) => base[f] === null || base[f] === undefined || base[f] === '')
  const {
    resumeVersionId: _r,
    coverLetterVersionId: _c,
    ...rest
  } = base
  return {
    ...rest,
    status: base.status as ApplicationDetail['status'],
    outcome: base.outcome as ApplicationDetail['outcome'],
    companyName: row.company_name as string,
    stageName: (row.stage_name as string | null) ?? null,
    stageCategory: (row.stage_category as ApplicationDetail['stageCategory']) ?? null,
    skills: skillsOf(ctx, id),
    contacts,
    completeness: 1 - missingFields.length / COMPLETENESS_FIELDS.length,
    missingFields,
    otherApplicationsAtCompany: others
  }
}

export function listApplications(ctx: AppContext, filter: ApplicationFilter = {}): ApplicationListItem[] {
  const where = ['a.deleted_at IS NULL']
  const params: Record<string, unknown> = {}
  if (!filter.includeArchived) where.push('a.archived_at IS NULL')
  if (filter.statuses && filter.statuses.length > 0) {
    where.push(`a.status IN (${filter.statuses.map((_, i) => `@st${i}`).join(', ')})`)
    filter.statuses.forEach((s, i) => (params[`st${i}`] = s))
  }
  if (filter.companyId) {
    where.push('a.company_id = @companyId')
    params.companyId = filter.companyId
  }
  if (filter.appliedFrom) {
    where.push('a.applied_at >= @from')
    params.from = new Date(filter.appliedFrom).toISOString()
  }
  if (filter.appliedTo) {
    where.push('a.applied_at <= @to')
    params.to = new Date(filter.appliedTo).toISOString()
  }
  const rows = ctx.sqlite
    .prepare(
      `SELECT ${APPLICATION_LIST_COLUMNS} ${APPLICATION_LIST_FROM}
        WHERE ${where.join(' AND ')}
        ORDER BY a.applied_at DESC, a.id DESC`
    )
    .all(params) as ApplicationListItem[]
  if (!filter.text) return rows
  const key = nameKey(filter.text)
  return rows.filter((r) => nameKey(`${r.title} ${r.companyName}`).includes(key))
}

export function duplicateApplication(ctx: AppContext, id: string): { id: string } {
  return tx(ctx, () => {
    const src = getLiveRow(ctx, id)
    const at = nowIso(ctx)
    const copy: typeof applications.$inferInsert = {
      ...src,
      id: newId(),
      appliedAt: at,
      duplicatedFromId: src.id,
      previousApplicationId: null,
      externalRef: null,
      responseDeadline: null,
      status: 'active',
      outcome: null,
      closeReason: null,
      currentStageId: defaultAppliedStageId(ctx),
      firstInboundAt: null,
      lastInboundAt: null,
      lastActivityAt: null,
      archivedAt: null,
      deletedAt: null,
      createdAt: at,
      updatedAt: at
    }
    ctx.orm.insert(applications).values(copy).run()
    insertEvent(ctx, { applicationId: copy.id!, type: 'applied', occurredAt: at })
    setSkills(ctx, copy.id!, skillsOf(ctx, src.id))
    writeAudit(ctx, 'application', copy.id!, 'create', { duplicatedFromId: [null, src.id] })
    reindexApplication(ctx, copy.id!)
    return { id: copy.id! }
  })
}

export function setArchived(ctx: AppContext, id: string, archived: boolean): void {
  tx(ctx, () => {
    const row = getLiveRow(ctx, id)
    if (Boolean(row.archivedAt) === archived) return
    const at = nowIso(ctx)
    ctx.orm
      .update(applications)
      .set({ archivedAt: archived ? at : null, updatedAt: at })
      .where(eq(applications.id, id))
      .run()
    writeAudit(ctx, 'application', id, archived ? 'archive' : 'unarchive')
  })
}

export function deleteApplication(ctx: AppContext, id: string): void {
  tx(ctx, () => {
    getLiveRow(ctx, id)
    const at = nowIso(ctx)
    ctx.orm.update(applications).set({ deletedAt: at, updatedAt: at }).where(eq(applications.id, id)).run()
    writeAudit(ctx, 'application', id, 'delete')
    removeFromIndex(ctx, 'application', id)
  })
}

export function restoreApplication(ctx: AppContext, id: string): void {
  tx(ctx, () => {
    const row = getRow(ctx, id)
    if (!row.deletedAt) throw new AppError('NOT_FOUND', 'Candidatura não está na Lixeira')
    const company = ctx.sqlite.prepare('SELECT deleted_at FROM companies WHERE id = ?').get(row.companyId) as {
      deleted_at: string | null
    }
    if (company.deleted_at) throw new AppError('CONFLICT', 'Restaure a empresa desta candidatura primeiro (Lixeira).')
    ctx.orm.update(applications).set({ deletedAt: null, updatedAt: nowIso(ctx) }).where(eq(applications.id, id)).run()
    writeAudit(ctx, 'application', id, 'restore')
    reindexApplication(ctx, id)
  })
}

/**
 * Permanently removes an application and everything that belongs only to it.
 * Only reachable from the Trash. The audit log keeps its entries.
 */
export function purgeApplication(ctx: AppContext, id: string): void {
  tx(ctx, () => {
    const row = getRow(ctx, id)
    if (!row.deletedAt) throw new AppError('CONFLICT', 'Só é possível excluir em definitivo itens da Lixeira')
    const s = ctx.sqlite
    const noteIds = (
      s
        .prepare(
          `SELECT id FROM notes WHERE application_id = @id
              OR interview_id IN (SELECT id FROM interviews WHERE application_id = @id)`
        )
        .all({ id }) as { id: string }[]
    ).map((r) => r.id)
    if (noteIds.length) ctx.orm.delete(notes).where(inArray(notes.id, noteIds)).run()
    for (const n of noteIds) removeFromIndex(ctx, 'note', n)
    const attachmentIds = (
      s
        .prepare(
          `SELECT id FROM attachments WHERE application_id = @id
              OR interview_id IN (SELECT id FROM interviews WHERE application_id = @id)
              OR assessment_id IN (SELECT id FROM assessments WHERE application_id = @id)
              OR offer_id IN (SELECT id FROM offers WHERE application_id = @id)`
        )
        .all({ id }) as { id: string }[]
    ).map((r) => r.id)
    for (const a of attachmentIds) {
      s.prepare('DELETE FROM attachments WHERE id = ?').run(a)
      removeFromIndex(ctx, 'attachment', a)
    }
    s.prepare('DELETE FROM tasks WHERE application_id = ?').run(id)
    s.prepare('DELETE FROM events WHERE application_id = ?').run(id)
    s.prepare('UPDATE offers SET previous_offer_id = NULL WHERE application_id = ?').run(id)
    s.prepare('DELETE FROM offers WHERE application_id = ?').run(id)
    s.prepare('DELETE FROM assessments WHERE application_id = ?').run(id)
    s.prepare('DELETE FROM interviews WHERE application_id = ?').run(id)
    s.prepare(`DELETE FROM taggings WHERE entity_type = 'application' AND entity_id = ?`).run(id)
    s.exec(`DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM taggings)`)
    s.prepare('DELETE FROM applications WHERE id = ?').run(id)
    removeFromIndex(ctx, 'application', id)
    writeAudit(ctx, 'application', id, 'delete', { purged: [false, true] })
  })
  collectGarbageFiles(ctx)
}

/**
 * "Desfazer" right after a quick registration: removes the application for good
 * if nothing else was recorded on it yet; otherwise moves it to the Trash.
 */
export function undoCreateApplication(ctx: AppContext, id: string): void {
  const row = getRow(ctx, id)
  const others = ctx.sqlite
    .prepare(`SELECT count(*) AS n FROM events WHERE application_id = ? AND type <> 'applied'`)
    .get(id) as { n: number }
  if (!row.deletedAt) deleteApplication(ctx, id)
  if (others.n === 0) purgeApplication(ctx, id)
}

export function applicationHistory(ctx: AppContext, id: string): AuditEntryDto[] {
  getRow(ctx, id)
  const eventIds = ctx.orm
    .select({ id: events.id })
    .from(events)
    .where(eq(events.applicationId, id))
    .all()
    .map((r) => r.id)
  const noteIds = ctx.orm
    .select({ id: notes.id })
    .from(notes)
    .where(eq(notes.applicationId, id))
    .all()
    .map((r) => r.id)
  const attachmentIds = (
    ctx.sqlite.prepare('SELECT id FROM attachments WHERE application_id = ?').all(id) as { id: string }[]
  ).map((r) => r.id)
  return auditFor(ctx, [
    { entityType: 'application', ids: [id] },
    { entityType: 'event', ids: eventIds },
    { entityType: 'note', ids: noteIds },
    { entityType: 'attachment', ids: attachmentIds }
  ])
}

export function knownTitles(ctx: AppContext): string[] {
  return (
    ctx.sqlite
      .prepare(
        `SELECT title FROM applications WHERE deleted_at IS NULL GROUP BY title ORDER BY max(applied_at) DESC LIMIT 200`
      )
      .all() as { title: string }[]
  ).map((r) => r.title)
}

export function lastPlatform(ctx: AppContext): string | null {
  const row = ctx.orm
    .select({ platform: applications.platform })
    .from(applications)
    .where(isNotNull(applications.platform))
    .orderBy(desc(applications.createdAt))
    .get()
  return row?.platform ?? null
}

export function addApplicationContact(
  ctx: AppContext,
  applicationId: string,
  contact: { id: string } | { name: string },
  role: ContactRole
): void {
  tx(ctx, () => {
    const app = getLiveRow(ctx, applicationId)
    const contactId = findOrCreateContact(ctx, contact, app.companyId)
    ctx.orm
      .insert(applicationContacts)
      .values({ applicationId, contactId, role, createdAt: nowIso(ctx) })
      .onConflictDoNothing()
      .run()
    writeAudit(ctx, 'application', applicationId, 'update', { contacts: [null, { contactId, role }] })
  })
}

export function removeApplicationContact(ctx: AppContext, applicationId: string, contactId: string, role: ContactRole): void {
  tx(ctx, () => {
    const res = ctx.orm
      .delete(applicationContacts)
      .where(
        and(
          eq(applicationContacts.applicationId, applicationId),
          eq(applicationContacts.contactId, contactId),
          eq(applicationContacts.role, role)
        )
      )
      .run()
    if (res.changes > 0)
      writeAudit(ctx, 'application', applicationId, 'update', { contacts: [{ contactId, role }, null] })
  })
}
