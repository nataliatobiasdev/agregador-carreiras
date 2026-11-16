const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

export const formatDate = (iso: string | null | undefined): string =>
  iso ? dateFmt.format(new Date(iso)) : '—'
export const formatDateTime = (iso: string | null | undefined): string =>
  iso ? dateTimeFmt.format(new Date(iso)) : '—'

const DAY = 86_400_000

export function daysSince(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null
  return Math.floor((now - Date.parse(iso)) / DAY)
}

export function relativeDays(iso: string | null | undefined): string {
  const d = daysSince(iso)
  if (d === null) return '—'
  if (d <= 0) return 'hoje'
  if (d === 1) return 'ontem'
  return `há ${d} dias`
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(iso: string | Date = new Date()): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Local datetime-local value → UTC ISO string. */
export function fromLocalInput(value: string): string {
  return new Date(value).toISOString()
}

export function toLocalDateInput(iso: string | null | undefined): string {
  return iso ? toLocalInput(iso).slice(0, 10) : ''
}

export function fromLocalDateInput(value: string): string | null {
  return value ? new Date(`${value}T12:00:00`).toISOString() : null
}

/** Money is stored as integer cents; shown with its currency (never summed across currencies). */
export function formatMoney(cents: number | null | undefined, currency: string | null | undefined): string {
  if (cents === null || cents === undefined) return '—'
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(
      cents / 100
    )
  } catch {
    return `${(cents / 100).toLocaleString('pt-BR')} ${currency ?? ''}`
  }
}

/** Parses "12.500,50", "12500.5" or "12500" into cents. Returns null for blank, NaN for invalid. */
export function parseMoneyToCents(text: string): number | null {
  const t = text.trim().replace(/\s/g, '')
  if (!t) return null
  let normalized = t
  if (t.includes(',')) normalized = t.replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  if (!Number.isFinite(n) || n < 0) return Number.NaN
  return Math.round(n * 100)
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1).replace('.', ',')} KB`
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}
