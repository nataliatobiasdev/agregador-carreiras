import type { AppContext } from '../context'

/** Runs fn inside one SQLite transaction (nested calls become savepoints). */
export function tx<T>(ctx: AppContext, fn: () => T): T {
  return ctx.sqlite.transaction(fn)()
}
