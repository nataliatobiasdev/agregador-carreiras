/** Editable catalogs: process stages and the lists (platforms, areas, close reasons). */
import { and, asc, eq } from 'drizzle-orm'
import type { ListItemDto, StageDto } from '../../shared/dto'
import type { ListKey, StageCategory } from '../../shared/enums'
import { AppError } from '../../shared/errors'
import { type AppContext, nowIso } from '../context'
import { listItems, stages } from '../db/schema'
import { diffFields } from '../domain/audit'
import { newId } from '../domain/ids'
import { nameKey } from '../domain/normalize'
import { writeAudit } from './audit'
import { tx } from './tx'

export function listStages(ctx: AppContext, includeInactive = false): StageDto[] {
  const rows = ctx.sqlite
    .prepare(
      `SELECT s.id, s.name, s.category, s.sort_hint AS sortHint, s.color, s.active, s.is_default_applied AS isDefaultApplied,
              (SELECT count(*) FROM events e WHERE e.stage_id = s.id) + (SELECT count(*) FROM applications a WHERE a.current_stage_id = s.id) AS usageCount
         FROM stages s ${includeInactive ? '' : 'WHERE s.active = 1'}
        ORDER BY s.sort_hint, s.name`
    )
    .all() as StageDto[]
  return rows.map((r) => ({ ...r, active: Boolean(r.active), isDefaultApplied: Boolean(r.isDefaultApplied) }))
}

function getStage(ctx: AppContext, id: string): StageDto {
  const s = listStages(ctx, true).find((x) => x.id === id)
  if (!s) throw new AppError('NOT_FOUND', 'Etapa não encontrada')
  return s
}

export function createStage(ctx: AppContext, input: { name: string; category: StageCategory; color?: string | null }): StageDto {
  return tx(ctx, () => {
    if (listStages(ctx, true).some((s) => nameKey(s.name) === nameKey(input.name)))
      throw new AppError('CONFLICT', 'Já existe uma etapa com esse nome')
    const max = ctx.sqlite.prepare('SELECT coalesce(max(sort_hint), 0) AS m FROM stages').get() as { m: number }
    const id = newId()
    const at = nowIso(ctx)
    ctx.orm
      .insert(stages)
      .values({ id, name: input.name.trim(), category: input.category, color: input.color ?? null, sortHint: max.m + 10, createdAt: at, updatedAt: at })
      .run()
    writeAudit(ctx, 'stage', id, 'create')
    return getStage(ctx, id)
  })
}

export function updateStage(
  ctx: AppContext,
  id: string,
  patch: { name?: string; category?: StageCategory; color?: string | null }
): StageDto {
  return tx(ctx, () => {
    const before = getStage(ctx, id)
    if (patch.category && patch.category !== before.category && before.usageCount > 0)
      throw new AppError('CONFLICT', 'A categoria de uma etapa já usada não pode mudar, porque alteraria as métricas do histórico.')
    if (before.isDefaultApplied && patch.category && patch.category !== 'applied')
      throw new AppError('CONFLICT', 'A etapa inicial precisa continuar na categoria "aplicada".')
    const next: Partial<typeof stages.$inferInsert> = {}
    if (patch.name !== undefined) next.name = patch.name.trim()
    if (patch.category !== undefined) next.category = patch.category
    if (patch.color !== undefined) next.color = patch.color
    const changes = diffFields(before as unknown as Record<string, unknown>, next as Record<string, unknown>)
    if (Object.keys(changes).length === 0) return before
    ctx.orm.update(stages).set({ ...next, updatedAt: nowIso(ctx) }).where(eq(stages.id, id)).run()
    writeAudit(ctx, 'stage', id, 'update', changes)
    return getStage(ctx, id)
  })
}

/** Stages used by events are never deleted, only deactivated (hidden from pickers). */
export function setStageActive(ctx: AppContext, id: string, active: boolean): void {
  tx(ctx, () => {
    const s = getStage(ctx, id)
    if (s.isDefaultApplied && !active) throw new AppError('CONFLICT', 'A etapa inicial não pode ser desativada.')
    ctx.orm.update(stages).set({ active, updatedAt: nowIso(ctx) }).where(eq(stages.id, id)).run()
    writeAudit(ctx, 'stage', id, 'update', { active: [s.active, active] })
  })
}

export function listItemsOf(ctx: AppContext, listKey: ListKey, includeInactive = false): ListItemDto[] {
  const where = includeInactive
    ? eq(listItems.listKey, listKey)
    : and(eq(listItems.listKey, listKey), eq(listItems.active, true))
  return ctx.orm
    .select({
      id: listItems.id,
      listKey: listItems.listKey,
      value: listItems.value,
      label: listItems.label,
      sortOrder: listItems.sortOrder,
      active: listItems.active
    })
    .from(listItems)
    .where(where)
    .orderBy(asc(listItems.sortOrder), asc(listItems.label))
    .all() as ListItemDto[]
}

export function addListItem(ctx: AppContext, listKey: ListKey, label: string): ListItemDto {
  return tx(ctx, () => {
    const value = nameKey(label).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || newId()
    const existing = listItemsOf(ctx, listKey, true).find((i) => i.value === value || nameKey(i.label) === nameKey(label))
    if (existing) {
      if (!existing.active) ctx.orm.update(listItems).set({ active: true }).where(eq(listItems.id, existing.id)).run()
      return { ...existing, active: true }
    }
    const max = ctx.sqlite.prepare('SELECT coalesce(max(sort_order), 0) AS m FROM list_items WHERE list_key = ?').get(listKey) as {
      m: number
    }
    const id = newId()
    ctx.orm
      .insert(listItems)
      .values({ id, listKey, value, label: label.trim(), sortOrder: max.m + 10, createdAt: nowIso(ctx) })
      .run()
    return listItemsOf(ctx, listKey, true).find((i) => i.id === id)!
  })
}

export function updateListItem(ctx: AppContext, id: string, patch: { label?: string; active?: boolean }): void {
  const next: Partial<typeof listItems.$inferInsert> = {}
  if (patch.label !== undefined) next.label = patch.label.trim()
  if (patch.active !== undefined) next.active = patch.active
  const res = ctx.orm.update(listItems).set(next).where(eq(listItems.id, id)).run()
  if (res.changes === 0) throw new AppError('NOT_FOUND', 'Item não encontrado')
}
