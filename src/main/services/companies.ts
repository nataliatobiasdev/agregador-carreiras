import { and, eq, isNull } from 'drizzle-orm'
import type { CompanyDto, CompanyListItem } from '../../shared/dto'
import { AppError } from '../../shared/errors'
import { type AppContext, nowIso } from '../context'
import { companies } from '../db/schema'
import { diffFields } from '../domain/audit'
import { newId } from '../domain/ids'
import { blankToNull, nameKey } from '../domain/normalize'
import { writeAudit } from './audit'
import { reindexApplication, reindexCompany } from './search'
import { tx } from './tx'

export interface CompanyInput {
  name: string
  website?: string | null
  industry?: string | null
  size?: string | null
  country?: string | null
  notes?: string | null
}

function toDto(row: typeof companies.$inferSelect): CompanyDto {
  const { nameKey: _k, ...rest } = row
  return rest
}

function findLiveByName(ctx: AppContext, name: string): typeof companies.$inferSelect | undefined {
  return ctx.orm
    .select()
    .from(companies)
    .where(and(eq(companies.nameKey, nameKey(name)), isNull(companies.deletedAt)))
    .get()
}

export function getCompany(ctx: AppContext, id: string): CompanyDto {
  const row = ctx.orm.select().from(companies).where(eq(companies.id, id)).get()
  if (!row) throw new AppError('NOT_FOUND', 'Empresa não encontrada')
  return toDto(row)
}

export function createCompany(ctx: AppContext, input: CompanyInput): CompanyDto {
  return tx(ctx, () => {
    const name = input.name.trim()
    if (findLiveByName(ctx, name)) throw new AppError('CONFLICT', `Já existe uma empresa chamada "${name}"`)
    const at = nowIso(ctx)
    const row = {
      id: newId(),
      name,
      nameKey: nameKey(name),
      website: blankToNull(input.website),
      industry: blankToNull(input.industry),
      size: blankToNull(input.size),
      country: blankToNull(input.country),
      notes: blankToNull(input.notes),
      createdAt: at,
      updatedAt: at
    }
    ctx.orm.insert(companies).values(row).run()
    writeAudit(ctx, 'company', row.id, 'create')
    reindexCompany(ctx, row.id)
    return getCompany(ctx, row.id)
  })
}

/** Returns the live company with this name (ignoring accents and case) or creates it. */
export function findOrCreateCompany(ctx: AppContext, ref: { id: string } | { name: string }): string {
  if ('id' in ref) {
    const row = ctx.orm.select().from(companies).where(eq(companies.id, ref.id)).get()
    if (!row || row.deletedAt) throw new AppError('NOT_FOUND', 'Empresa não encontrada')
    return row.id
  }
  const existing = findLiveByName(ctx, ref.name)
  if (existing) return existing.id
  return createCompany(ctx, { name: ref.name }).id
}

export function updateCompany(ctx: AppContext, id: string, patch: Partial<CompanyInput>): CompanyDto {
  return tx(ctx, () => {
    const before = ctx.orm.select().from(companies).where(eq(companies.id, id)).get()
    if (!before) throw new AppError('NOT_FOUND', 'Empresa não encontrada')
    const next: Partial<typeof companies.$inferInsert> = {}
    if (patch.name !== undefined) {
      const name = patch.name.trim()
      const clash = findLiveByName(ctx, name)
      if (clash && clash.id !== id) throw new AppError('CONFLICT', `Já existe uma empresa chamada "${name}"`)
      next.name = name
      next.nameKey = nameKey(name)
    }
    for (const key of ['website', 'industry', 'size', 'country', 'notes'] as const) {
      if (patch[key] !== undefined) next[key] = blankToNull(patch[key])
    }
    const changes = diffFields(before, next, ['updatedAt', 'nameKey'])
    if (Object.keys(changes).length === 0) return toDto(before)
    ctx.orm
      .update(companies)
      .set({ ...next, updatedAt: nowIso(ctx) })
      .where(eq(companies.id, id))
      .run()
    writeAudit(ctx, 'company', id, 'update', changes)
    reindexCompany(ctx, id)
    // Application titles in the index include the company name.
    const apps = ctx.sqlite.prepare('SELECT id FROM applications WHERE company_id = ?').all(id) as {
      id: string
    }[]
    if (changes.name) for (const a of apps) reindexApplication(ctx, a.id)
    return getCompany(ctx, id)
  })
}

export function deleteCompany(ctx: AppContext, id: string): void {
  tx(ctx, () => {
    const row = ctx.orm.select().from(companies).where(eq(companies.id, id)).get()
    if (!row || row.deletedAt) throw new AppError('NOT_FOUND', 'Empresa não encontrada')
    const live = ctx.sqlite
      .prepare('SELECT count(*) AS n FROM applications WHERE company_id = ? AND deleted_at IS NULL')
      .get(id) as { n: number }
    if (live.n > 0)
      throw new AppError(
        'CONFLICT',
        `A empresa tem ${live.n} candidatura(s). Exclua ou mova as candidaturas antes de excluir a empresa.`
      )
    ctx.orm
      .update(companies)
      .set({ deletedAt: nowIso(ctx), updatedAt: nowIso(ctx) })
      .where(eq(companies.id, id))
      .run()
    writeAudit(ctx, 'company', id, 'delete')
    reindexCompany(ctx, id)
  })
}

export function restoreCompany(ctx: AppContext, id: string): void {
  tx(ctx, () => {
    const row = ctx.orm.select().from(companies).where(eq(companies.id, id)).get()
    if (!row || !row.deletedAt) throw new AppError('NOT_FOUND', 'Empresa não está na Lixeira')
    const clash = findLiveByName(ctx, row.name)
    if (clash)
      throw new AppError(
        'CONFLICT',
        `Já existe outra empresa chamada "${row.name}". Renomeie-a antes de restaurar.`
      )
    ctx.orm
      .update(companies)
      .set({ deletedAt: null, updatedAt: nowIso(ctx) })
      .where(eq(companies.id, id))
      .run()
    writeAudit(ctx, 'company', id, 'restore')
    reindexCompany(ctx, id)
  })
}

export function listCompanies(ctx: AppContext, filter: { text?: string } = {}): CompanyListItem[] {
  const rows = ctx.sqlite
    .prepare(
      `SELECT c.id, c.name, c.website, c.industry, c.size, c.country, c.notes,
              c.archived_at AS archivedAt, c.deleted_at AS deletedAt, c.created_at AS createdAt, c.updated_at AS updatedAt,
              count(a.id) AS applicationCount,
              sum(CASE WHEN a.status <> 'closed' THEN 1 ELSE 0 END) AS activeApplicationCount,
              sum(CASE WHEN a.first_inbound_at IS NOT NULL THEN 1 ELSE 0 END) AS respondedCount,
              max(a.last_activity_at) AS lastActivityAt
         FROM companies c
         LEFT JOIN applications a ON a.company_id = c.id AND a.deleted_at IS NULL
        WHERE c.deleted_at IS NULL
        GROUP BY c.id
        ORDER BY c.name_key`
    )
    .all() as CompanyListItem[]
  const key = filter.text ? nameKey(filter.text) : ''
  return rows
    .map((r) => ({
      ...r,
      activeApplicationCount: r.activeApplicationCount ?? 0,
      respondedCount: r.respondedCount ?? 0
    }))
    .filter((r) => !key || nameKey(r.name).includes(key))
}

export function suggestCompanies(ctx: AppContext, text: string): Array<{ id: string; name: string }> {
  const key = nameKey(text)
  const rows = ctx.orm
    .select({ id: companies.id, name: companies.name, nameKey: companies.nameKey })
    .from(companies)
    .where(isNull(companies.deletedAt))
    .all()
  return rows
    .filter((r) => r.nameKey.includes(key))
    .sort(
      (a, b) =>
        Number(!a.nameKey.startsWith(key)) - Number(!b.nameKey.startsWith(key)) ||
        a.nameKey.localeCompare(b.nameKey)
    )
    .slice(0, 10)
    .map(({ id, name }) => ({ id, name }))
}
