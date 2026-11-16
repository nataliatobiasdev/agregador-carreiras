import { and, desc, eq, inArray, or } from 'drizzle-orm'
import type { AuditEntryDto } from '../../shared/dto'
import type { AuditAction, EntityType } from '../../shared/enums'
import { type AppContext, nowIso } from '../context'
import { auditLog } from '../db/schema'
import { newId } from '../domain/ids'

export function writeAudit(
  ctx: AppContext,
  entityType: EntityType,
  entityId: string,
  action: AuditAction,
  changes: Record<string, [unknown, unknown]> | null = null
): void {
  if (action === 'update' && changes && Object.keys(changes).length === 0) return
  ctx.orm
    .insert(auditLog)
    .values({ id: newId(), entityType, entityId, action, changes, at: nowIso(ctx) })
    .run()
}

export function auditFor(
  ctx: AppContext,
  refs: Array<{ entityType: EntityType; ids: string[] }>
): AuditEntryDto[] {
  const conds = refs
    .filter((r) => r.ids.length > 0)
    .map((r) => and(eq(auditLog.entityType, r.entityType), inArray(auditLog.entityId, r.ids)))
  if (conds.length === 0) return []
  return ctx.orm
    .select()
    .from(auditLog)
    .where(or(...conds))
    .orderBy(desc(auditLog.at), desc(auditLog.id))
    .all() as AuditEntryDto[]
}
