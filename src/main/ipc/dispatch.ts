import { ZodError } from 'zod'
import { contracts, type ChannelName } from '../../shared/contracts'
import { AppError, type ErrorPayload, type Result } from '../../shared/errors'
import type { AppContext } from '../context'
import { type ElectronBridge, handlers } from './handlers'

export interface MinimalLogger {
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
}

export function toErrorPayload(e: unknown): ErrorPayload {
  if (e instanceof AppError) return { code: e.code, message: e.message, details: e.details }
  if (e instanceof ZodError)
    return {
      code: 'VALIDATION',
      message: e.issues.map((i) => i.message).join('; '),
      details: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
    }
  const message = e instanceof Error ? e.message : String(e)
  if (/SQLITE_BUSY|database is locked/i.test(message))
    return { code: 'DB_BUSY', message: 'O banco está ocupado. Tente de novo.' }
  if (/constraint failed/i.test(message))
    return {
      code: 'CONFLICT',
      message: 'A operação viola uma regra de integridade dos dados.',
      details: message
    }
  return { code: 'UNEXPECTED', message: 'Algo deu errado. Veja o log para detalhes.', details: message }
}

/** Validates the input of a channel, calls its handler and wraps the outcome as a Result. */
export async function dispatch(
  ctx: AppContext,
  bridge: ElectronBridge,
  channel: ChannelName,
  raw: unknown,
  logger: MinimalLogger
): Promise<Result<unknown>> {
  try {
    if (!(channel in contracts)) throw new AppError('VALIDATION', 'Canal desconhecido')
    const input = contracts[channel].input.parse(raw)
    const handler = handlers[channel] as (c: AppContext, i: unknown, b: ElectronBridge) => unknown
    const data = await handler(ctx, input, bridge)
    return { ok: true, data: data ?? null }
  } catch (e) {
    const error = toErrorPayload(e)
    // Logs carry operation names and codes only, never note text or salaries.
    if (error.code === 'UNEXPECTED' || error.code === 'CONFLICT')
      logger.error(`[ipc] ${channel} failed`, error.code, error.details)
    else logger.warn(`[ipc] ${channel} -> ${error.code}`)
    return { ok: false, error }
  }
}
