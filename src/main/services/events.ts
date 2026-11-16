/**
 * Timeline events. Every write recomputes the application's derived cache in
 * the same transaction (see domain/derive.ts), so status, stage and "last
 * interaction" can never drift from the history.
 */
import { asc, eq } from 'drizzle-orm'
import type { TimelineEventDto } from '../../shared/dto'
import type { EventType } from '../../shared/enums'
import { AppError } from '../../shared/errors'
import { type AppContext, nowIso } from '../context'
import { applications, events, stages } from '../db/schema'
import { checkOccurredAt, defaultDirection, deriveApplicationState, type TimelineEvent } from '../domain/derive'
import { newId } from '../domain/ids'
import { blankToNull } from '../domain/normalize'
import { writeAudit } from './audit'
import { tx } from './tx'

export function defaultAppliedStageId(ctx: AppContext): string | null {
  const row =
    ctx.orm.select({ id: stages.id }).from(stages).where(eq(stages.isDefaultApplied, true)).get() ??
    ctx.orm.select({ id: stages.id }).from(stages).where(eq(stages.category, 'applied')).orderBy(asc(stages.sortHint)).get()
  return row?.id ?? null
}

function loadTimeline(ctx: AppContext, applicationId: string): TimelineEvent[] {
  return ctx.orm
    .select({
      id: events.id,
      type: events.type,
      occurredAt: events.occurredAt,
      recordedAt: events.recordedAt,
      stageId: events.stageId,
      outcome: events.outcome,
      closeReason: events.closeReason,
      direction: events.direction,
      voidedAt: events.voidedAt
    })
    .from(events)
    .where(eq(events.applicationId, applicationId))
    .all() as TimelineEvent[]
}

/**
 * Recomputes and stores the derived cache of one application. Throws when the
 * timeline contains an event that does not fit (e.g. "resumed" without a pause)
 * so the surrounding transaction is rolled back.
 */
export function recomputeDerived(ctx: AppContext, applicationId: string, options: { strict?: boolean } = {}): void {
  const { state, invalidEventIds } = deriveApplicationState(loadTimeline(ctx, applicationId), defaultAppliedStageId(ctx))
  if ((options.strict ?? true) && invalidEventIds.length > 0) {
    throw new AppError(
      'VALIDATION',
      'Este registro não combina com a linha do tempo (por exemplo: retomar sem estar pausada, encerrar já encerrada ou reabrir sem estar encerrada).',
      { invalidEventIds }
    )
  }
  ctx.orm.update(applications).set(state).where(eq(applications.id, applicationId)).run()
}

export function rebuildAllDerived(ctx: AppContext): number {
  return tx(ctx, () => {
    const ids = ctx.orm.select({ id: applications.id }).from(applications).all()
    for (const { id } of ids) recomputeDerived(ctx, id, { strict: false })
    return ids.length
  })
}

export interface InsertEventInput {
  applicationId: string
  type: EventType
  occurredAt: string
  stageId?: string | null
  direction?: 'in' | 'out' | null
  medium?: string | null
  contactId?: string | null
  summary?: string | null
  outcome?: TimelineEvent['outcome']
  closeReason?: string | null
  payload?: Record<string, unknown> | null
  allowBeforeApplied?: boolean
}

function getApplicationForEvent(ctx: AppContext, applicationId: string) {
  const app = ctx.orm
    .select({ id: applications.id, appliedAt: applications.appliedAt, deletedAt: applications.deletedAt })
    .from(applications)
    .where(eq(applications.id, applicationId))
    .get()
  if (!app || app.deletedAt) throw new AppError('NOT_FOUND', 'Candidatura não encontrada')
  return app
}

function validateTiming(ctx: AppContext, occurredAt: string, appliedAt: string, type: EventType, allowBefore?: boolean) {
  if (type === 'applied') return
  const problem = checkOccurredAt(occurredAt, appliedAt, ctx.now())
  if (problem === 'future') throw new AppError('VALIDATION', 'A data do evento não pode estar no futuro.')
  if (problem === 'before_applied' && !allowBefore)
    throw new AppError('VALIDATION', 'A data do evento é anterior à data da candidatura. Confirme para registrar mesmo assim.', {
      needsConfirmation: 'allowBeforeApplied'
    })
}

function assertStage(ctx: AppContext, stageId: string | null | undefined): void {
  if (!stageId) return
  const s = ctx.orm.select({ id: stages.id }).from(stages).where(eq(stages.id, stageId)).get()
  if (!s) throw new AppError('NOT_FOUND', 'Etapa não encontrada')
}

/** Inserts an event and recomputes the cache. Must run inside a transaction. */
export function insertEvent(ctx: AppContext, input: InsertEventInput): string {
  const app = getApplicationForEvent(ctx, input.applicationId)
  const occurredAt = new Date(input.occurredAt).toISOString()
  validateTiming(ctx, occurredAt, app.appliedAt, input.type, input.allowBeforeApplied)
  assertStage(ctx, input.stageId)
  const outcome = input.outcome ?? null
  const id = newId()
  const at = nowIso(ctx)
  ctx.orm
    .insert(events)
    .values({
      id,
      applicationId: input.applicationId,
      type: input.type,
      occurredAt,
      recordedAt: at,
      stageId: input.stageId ?? null,
      direction: input.direction ?? defaultDirection(input.type, outcome),
      medium: input.medium ?? null,
      contactId: input.contactId ?? null,
      summary: blankToNull(input.summary),
      outcome,
      closeReason: blankToNull(input.closeReason),
      payload: input.payload ?? null,
      updatedAt: at
    })
    .run()
  recomputeDerived(ctx, input.applicationId)
  ctx.orm.update(applications).set({ updatedAt: at }).where(eq(applications.id, input.applicationId)).run()
  return id
}

export function recordEvent(ctx: AppContext, input: InsertEventInput & { sentiment?: string | null; expectedResumeAt?: string | null }): string {
  return tx(ctx, () => {
    const payload: Record<string, unknown> = {}
    if (input.sentiment) payload.sentiment = input.sentiment
    if (input.expectedResumeAt) payload.expectedResumeAt = input.expectedResumeAt
    const id = insertEvent(ctx, { ...input, payload: Object.keys(payload).length ? payload : null })
    writeAudit(ctx, 'event', id, 'create')
    return id
  })
}

export function correctEvent(
  ctx: AppContext,
  input: { id: string; occurredAt?: string; summary?: string | null; allowBeforeApplied?: boolean }
): void {
  tx(ctx, () => {
    const before = ctx.orm.select().from(events).where(eq(events.id, input.id)).get()
    if (!before) throw new AppError('NOT_FOUND', 'Evento não encontrado')
    if (before.voidedAt) throw new AppError('CONFLICT', 'Evento anulado não pode ser corrigido')
    const app = getApplicationForEvent(ctx, before.applicationId)
    const next: Partial<typeof events.$inferInsert> = {}
    if (input.occurredAt !== undefined) {
      const occurredAt = new Date(input.occurredAt).toISOString()
      if (before.type === 'applied')
        throw new AppError('VALIDATION', 'Altere a data da candidatura no formulário de dados da vaga.')
      validateTiming(ctx, occurredAt, app.appliedAt, before.type as EventType, input.allowBeforeApplied)
      next.occurredAt = occurredAt
    }
    if (input.summary !== undefined) next.summary = blankToNull(input.summary)
    const changes: Record<string, [unknown, unknown]> = {}
    for (const [k, v] of Object.entries(next)) {
      const prev = (before as Record<string, unknown>)[k] ?? null
      if (prev !== v) changes[k] = [prev, v]
    }
    if (Object.keys(changes).length === 0) return
    ctx.orm
      .update(events)
      .set({ ...next, updatedAt: nowIso(ctx) })
      .where(eq(events.id, input.id))
      .run()
    recomputeDerived(ctx, before.applicationId)
    writeAudit(ctx, 'event', input.id, 'update', changes)
  })
}

export function voidEvent(ctx: AppContext, id: string, reason: string): void {
  tx(ctx, () => {
    const row = ctx.orm.select().from(events).where(eq(events.id, id)).get()
    if (!row) throw new AppError('NOT_FOUND', 'Evento não encontrado')
    if (row.voidedAt) return
    if (row.type === 'applied') throw new AppError('VALIDATION', 'O registro da candidatura não pode ser anulado; exclua a candidatura.')
    const at = nowIso(ctx)
    ctx.orm.update(events).set({ voidedAt: at, voidReason: reason, updatedAt: at }).where(eq(events.id, id)).run()
    recomputeDerived(ctx, row.applicationId)
    writeAudit(ctx, 'event', id, 'void', { voidReason: [null, reason] })
  })
}

export function listEventsWhere(ctx: AppContext, where: string, params: unknown[]): TimelineEventDto[] {
  const rows = ctx.sqlite
    .prepare(
      `SELECT e.id, e.application_id AS applicationId, e.type, e.occurred_at AS occurredAt, e.recorded_at AS recordedAt,
              e.stage_id AS stageId, s.name AS stageName, e.outcome, e.close_reason AS closeReason, e.direction, e.medium,
              e.contact_id AS contactId, ct.name AS contactName, e.summary, e.payload, e.voided_at AS voidedAt,
              e.void_reason AS voidReason, e.updated_at AS updatedAt
         FROM events e
         LEFT JOIN stages s ON s.id = e.stage_id
         LEFT JOIN contacts ct ON ct.id = e.contact_id
        WHERE ${where}
        ORDER BY e.occurred_at DESC, e.recorded_at DESC, e.id DESC`
    )
    .all(...params) as Array<TimelineEventDto & { payload: string | null }>
  return rows.map((r) => ({ ...r, payload: r.payload ? (JSON.parse(r.payload) as Record<string, unknown>) : null }))
}

export function listEvents(ctx: AppContext, applicationId: string): TimelineEventDto[] {
  return listEventsWhere(ctx, 'e.application_id = ?', [applicationId])
}
