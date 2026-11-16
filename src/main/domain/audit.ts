/** Field-level diff used by the audit log: { field: [before, after] }. */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  ignore: readonly string[] = ['updatedAt', 'createdAt']
): Record<string, [unknown, unknown]> {
  const changes: Record<string, [unknown, unknown]> = {}
  for (const key of Object.keys(after)) {
    if (ignore.includes(key)) continue
    const a = before[key] ?? null
    const b = after[key] ?? null
    if (!sameValue(a, b)) changes[key] = [a, b]
  }
  return changes
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b)
  return false
}
