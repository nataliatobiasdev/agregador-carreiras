import {
  CHANNEL_NAMES,
  type CamApi,
  type ChannelInput,
  type ChannelName,
  type ChannelOutput
} from '@shared/contracts'
import type { ErrorPayload, Result } from '@shared/errors'

export class ApiError extends Error {
  constructor(public readonly payload: ErrorPayload) {
    super(payload.message)
    this.name = 'ApiError'
  }
  get code() {
    return this.payload.code
  }
}

function buildApi(): CamApi {
  const api: Record<string, Record<string, (input?: unknown) => Promise<unknown>>> = {}
  for (const channel of CHANNEL_NAMES) {
    const [domain, action] = channel.split('.') as [string, string]
    api[domain] ??= {}
    api[domain][action] = (input?: unknown) => window.camBridge.invoke(channel, input)
  }
  return api as unknown as CamApi
}

/** Typed API: cam.<domain>.<action>(input) → Promise<Result>. */
export const cam = buildApi()

/** Calls a channel and throws ApiError on failure (convenient with TanStack Query). */
export async function call<C extends ChannelName>(
  channel: C,
  ...args: undefined extends ChannelInput<C> ? [ChannelInput<C>?] : [ChannelInput<C>]
): Promise<ChannelOutput<C>> {
  const res = (await window.camBridge.invoke(channel, args[0])) as Result<ChannelOutput<C>>
  if (!res.ok) throw new ApiError(res.error)
  return res.data
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return String(e)
}
