import type { AppContext } from '../context'
import { AppError } from '../../shared/errors'
import { createApplication } from './applications'
import { tx } from './tx'

type Row = { job_key: string; payload: string; added_at: string; application_id: string | null }
export type PendingJob = { key: string; title: string; company: string; url: string; addedAt: string; details: string }

export function listPending(ctx: AppContext): PendingJob[] {
  const rows = ctx.sqlite.prepare('SELECT * FROM vagas1000_inbox WHERE application_id IS NULL ORDER BY added_at DESC').all() as Row[]
  return rows.map((row) => {
    const data = JSON.parse(row.payload) as { vaga: Record<string, unknown>; registro?: Record<string, unknown> }
    const job = data.vaga
    return { key: row.job_key, title: String(job.title || ''), company: String(job.company || ''),
      url: String(job.url || ''), addedAt: row.added_at, details: JSON.stringify(data, null, 2) }
  })
}

export function markApplied(ctx: AppContext, key: string): { id: string } {
  return tx(ctx, () => {
    const row = ctx.sqlite.prepare('SELECT * FROM vagas1000_inbox WHERE job_key = ?').get(key) as Row | undefined
    if (!row) throw new AppError('NOT_FOUND', 'Vaga não encontrada')
    if (row.application_id) return { id: row.application_id }
    const data = JSON.parse(row.payload) as { vaga: Record<string, unknown>; registro?: Record<string, unknown> }
    const job = data.vaga, record = data.registro ?? {}
    const title = String(job.title || '').trim(), company = String(job.company || '').trim()
    if (!title || !company) throw new AppError('VALIDATION', 'A vaga precisa ter cargo e empresa')
    const url = String(job.url || '')
    const result = createApplication(ctx, {
      title, company: { name: company }, platform: 'vagas1000', appliedAt: ctx.now().toISOString(),
      jobUrl: /^https?:\/\//i.test(url) ? url : null,
      jobDescription: String(record.description || record.description_html || job.description || '') || null,
      initialNote: 'Dados originais recebidos do vagas1000:\n\n```json\n' + row.payload + '\n```'
    })
    ctx.sqlite.prepare('UPDATE vagas1000_inbox SET application_id = ? WHERE job_key = ?').run(result.id, key)
    return result
  })
}
