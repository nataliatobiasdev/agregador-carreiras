import { eq } from 'drizzle-orm'
import { type AppContext, nowIso } from '../context'
import { settings } from '../db/schema'

export function getSetting<T>(ctx: AppContext, key: string, fallback: T): T {
  const row = ctx.orm.select().from(settings).where(eq(settings.key, key)).get()
  return row === undefined || row.value === null || row.value === undefined ? fallback : (row.value as T)
}

export function setSetting(ctx: AppContext, key: string, value: unknown): void {
  ctx.orm
    .insert(settings)
    .values({ key, value, updatedAt: nowIso(ctx) })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: nowIso(ctx) } })
    .run()
}

/** Settings the renderer may read and write directly. Everything else goes through a service. */
export const UI_SETTING_KEYS = ['ui.theme', 'ui.applicationsView', 'ui.sidebarCollapsed'] as const
