/** Key used to compare names ignoring accents, case and repeated spaces. */
export function nameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Trims a string and turns blank values into null. */
export function blankToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

const PLATFORM_DOMAINS: ReadonlyArray<[RegExp, string]> = [
  [/(^|\.)linkedin\.com$/, 'linkedin'],
  [/(^|\.)gupy\.io$/, 'gupy'],
  [/(^|\.)greenhouse\.io$/, 'greenhouse'],
  [/(^|\.)lever\.co$/, 'lever'],
  [/(^|\.)myworkdayjobs\.com$/, 'workday'],
  [/(^|\.)workday\.com$/, 'workday']
]

/**
 * Suggests a platform from the job URL's domain. Purely local string analysis:
 * the page is never fetched (the app makes no network calls).
 */
export function suggestPlatformFromUrl(url: string): string | null {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
  for (const [pattern, platform] of PLATFORM_DOMAINS) {
    if (pattern.test(host)) return platform
  }
  return null
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
