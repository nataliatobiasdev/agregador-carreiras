export const ERROR_CODES = [
  'VALIDATION',
  'NOT_FOUND',
  'CONFLICT',
  'FILE_MISSING',
  'DB_BUSY',
  'INTEGRITY',
  'UNEXPECTED'
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

export interface ErrorPayload {
  code: ErrorCode
  message: string
  details?: unknown
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ErrorPayload }

/** Domain error with a stable code; messages are in Portuguese because they reach the UI. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError
