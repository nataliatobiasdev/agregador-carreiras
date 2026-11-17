import { expect, it } from 'vitest'
import { makeContext } from '../helpers/context'
import { listPending, markApplied } from '../../src/main/services/vagas1000'
import { listApplications } from '../../src/main/services/applications'
import { listEvents } from '../../src/main/services/events'
import { listNotes } from '../../src/main/services/notes'

it('keeps an imported vacancy pending until the user records an application', () => {
  const ctx = makeContext()
  const payload = JSON.stringify({ vaga: { key: 'job-1', title: 'Engenheira', company: 'Empresa', url: 'https://example.com/job' }, registro: { description: 'Detalhes' }, bruto: { original: 'valor' } })
  ctx.sqlite.prepare('INSERT INTO vagas1000_inbox (job_key, payload, added_at) VALUES (?, ?, ?)').run('job-1', payload, ctx.now().toISOString())
  expect(listPending(ctx)).toHaveLength(1)
  expect(listApplications(ctx, {})).toHaveLength(0)
  const result = markApplied(ctx, 'job-1')
  expect(listPending(ctx)).toHaveLength(0)
  expect(listEvents(ctx, result.id)[0]?.type).toBe('applied')
  expect(listNotes(ctx, { applicationId: result.id })[0]?.bodyMd).toContain('valor')
  expect(markApplied(ctx, 'job-1')).toEqual(result)
  expect(listApplications(ctx, {})).toHaveLength(1)
})
