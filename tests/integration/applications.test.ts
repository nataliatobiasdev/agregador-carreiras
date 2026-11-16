import { describe, expect, it } from 'vitest'
import {
  addApplicationContact,
  applicationHistory,
  createApplication,
  deleteApplication,
  duplicateApplication,
  getApplication,
  knownTitles,
  lastPlatform,
  listApplications,
  restoreApplication,
  setArchived,
  undoCreateApplication,
  updateApplication
} from '../../src/main/services/applications'
import { listCompanies } from '../../src/main/services/companies'
import { listEvents, recordEvent } from '../../src/main/services/events'
import { listNotes } from '../../src/main/services/notes'
import { DAY, makeContext, MINUTE } from '../helpers/context'

const base = {
  company: { name: 'Nubank' },
  title: 'Engenheira de Software Sênior',
  appliedAt: '2026-11-16T11:00:00.000Z',
  platform: 'linkedin'
}

describe('applications', () => {
  it('registers with the 4 required fields, creating the company and the applied event', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, base)
    const app = getApplication(ctx, id)
    expect(app).toMatchObject({
      companyName: 'Nubank',
      title: base.title,
      status: 'active',
      stageName: 'Candidatura enviada',
      stageCategory: 'applied',
      priority: 'medium',
      lastActivityAt: base.appliedAt
    })
    expect(app.completeness).toBe(0)
    expect(app.missingFields).toContain('seniority')
    const events = listEvents(ctx, id)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'applied', occurredAt: base.appliedAt, direction: 'out' })
    expect(lastPlatform(ctx)).toBe('linkedin')
    expect(knownTitles(ctx)).toEqual([base.title])
  })

  it('reuses an existing company ignoring accents and case', () => {
    const ctx = makeContext()
    createApplication(ctx, { ...base, company: { name: 'Itaú Unibanco' } })
    createApplication(ctx, { ...base, company: { name: 'itau  unibanco' }, title: 'Outra' })
    expect(listCompanies(ctx)).toHaveLength(1)
    expect(listCompanies(ctx)[0]).toMatchObject({ name: 'Itaú Unibanco', applicationCount: 2 })
  })

  it('stores optional data, skills, recruiter and initial note', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, {
      ...base,
      seniority: 'senior',
      workMode: 'remote',
      postedSalaryMin: 1_500_000,
      postedSalaryMax: 2_000_000,
      postedCurrency: 'BRL',
      postedPeriod: 'month',
      skills: ['TypeScript', 'typescript', 'SQL'],
      recruiter: { name: 'Ana Recrutadora' },
      initialNote: 'Vaga indicada pela Ana'
    })
    const app = getApplication(ctx, id)
    expect(app.skills).toEqual(['SQL', 'TypeScript'])
    expect(app.contacts).toEqual([expect.objectContaining({ name: 'Ana Recrutadora', role: 'recruiter' })])
    expect(listNotes(ctx, { applicationId: id })).toHaveLength(1)
  })

  it('rejects inconsistent salary ranges and missing currency (service and CHECK constraints)', () => {
    const ctx = makeContext()
    expect(() =>
      createApplication(ctx, { ...base, postedSalaryMin: 10, postedSalaryMax: 5, postedCurrency: 'BRL' })
    ).toThrow(/mínima/)
    expect(() => createApplication(ctx, { ...base, expectedSalary: 10 })).toThrow(/moeda/)
    // Direct SQL bypassing the service still hits the database constraints.
    const { id } = createApplication(ctx, base)
    expect(() => ctx.sqlite.prepare('UPDATE applications SET fit_score = 9 WHERE id = ?').run(id)).toThrow(/CHECK/)
    expect(() => ctx.sqlite.prepare(`UPDATE applications SET status = 'closed' WHERE id = ?`).run(id)).toThrow(/CHECK/)
    expect(() => ctx.sqlite.prepare(`UPDATE applications SET company_id = 'nope' WHERE id = ?`).run(id)).toThrow(/FOREIGN KEY/)
  })

  it('rejects a future application date', () => {
    const ctx = makeContext()
    expect(() => createApplication(ctx, { ...base, appliedAt: '2026-12-01T00:00:00.000Z' })).toThrow(/futuro/)
  })

  it('records every edit in the history with before and after values', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, base)
    ctx.clock.advance(MINUTE)
    updateApplication(ctx, { id, patch: { title: 'Staff Engineer', seniority: 'staff', skills: ['Go'] } })
    const history = applicationHistory(ctx, id)
    const update = history.find((h) => h.action === 'update' && h.entityType === 'application')
    expect(update?.changes).toMatchObject({
      title: [base.title, 'Staff Engineer'],
      seniority: [null, 'staff'],
      skills: [[], ['Go']]
    })
    expect(history.some((h) => h.action === 'create' && h.entityType === 'application')).toBe(true)
    // No-op edits do not create entries
    const before = applicationHistory(ctx, id).length
    updateApplication(ctx, { id, patch: { title: 'Staff Engineer' } })
    expect(applicationHistory(ctx, id)).toHaveLength(before)
  })

  it('moving the application date moves the applied event and refuses to leave events before it', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, { ...base, appliedAt: '2026-11-01T10:00:00.000Z' })
    updateApplication(ctx, { id, patch: { appliedAt: '2026-11-02T10:00:00.000Z' } })
    expect(listEvents(ctx, id)[0]?.occurredAt).toBe('2026-11-02T10:00:00.000Z')
    recordEvent(ctx, { applicationId: id, type: 'interaction', direction: 'in', occurredAt: '2026-11-05T10:00:00.000Z' })
    expect(() => updateApplication(ctx, { id, patch: { appliedAt: '2026-11-06T10:00:00.000Z' } })).toThrow(/antes/)
  })

  it('duplicates the opportunity fields without timeline, and links the source', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, { ...base, seniority: 'senior', skills: ['Go'] })
    recordEvent(ctx, { applicationId: id, type: 'interaction', direction: 'in', occurredAt: '2026-11-16T11:30:00.000Z' })
    const copy = duplicateApplication(ctx, id)
    const app = getApplication(ctx, copy.id)
    expect(app).toMatchObject({ duplicatedFromId: id, seniority: 'senior', status: 'active', lastInboundAt: null, skills: ['Go'] })
    expect(listEvents(ctx, copy.id)).toHaveLength(1)
    expect(app.otherApplicationsAtCompany.map((o) => o.id)).toEqual([id])
  })

  it('archive hides from the default list; delete moves to trash and restore brings everything back', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, base)
    recordEvent(ctx, { applicationId: id, type: 'interaction', direction: 'in', occurredAt: '2026-11-16T11:30:00.000Z' })
    setArchived(ctx, id, true)
    expect(listApplications(ctx)).toHaveLength(0)
    expect(listApplications(ctx, { includeArchived: true })).toHaveLength(1)
    setArchived(ctx, id, false)
    const before = getApplication(ctx, id)
    deleteApplication(ctx, id)
    expect(listApplications(ctx, { includeArchived: true })).toHaveLength(0)
    restoreApplication(ctx, id)
    const after = getApplication(ctx, id)
    expect({ ...after, updatedAt: '' }).toEqual({ ...before, updatedAt: '' })
    expect(listEvents(ctx, id)).toHaveLength(2)
  })

  it('undo right after creation removes the application for good', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, base)
    undoCreateApplication(ctx, id)
    expect(() => getApplication(ctx, id)).toThrow(/não encontrada/)
  })

  it('filters by status, company, period and text', () => {
    const ctx = makeContext()
    const a = createApplication(ctx, { ...base, appliedAt: '2026-11-01T10:00:00.000Z' })
    createApplication(ctx, { ...base, company: { name: 'Stone' }, title: 'Tech Lead', appliedAt: '2026-11-10T10:00:00.000Z' })
    recordEvent(ctx, { applicationId: a.id, type: 'closed', outcome: 'rejected', occurredAt: '2026-11-12T10:00:00.000Z' })
    expect(listApplications(ctx, { statuses: ['closed'] }).map((r) => r.id)).toEqual([a.id])
    expect(listApplications(ctx, { text: 'stone' })).toHaveLength(1)
    expect(listApplications(ctx, { appliedFrom: '2026-11-05T00:00:00.000Z' })).toHaveLength(1)
    const stone = listCompanies(ctx).find((c) => c.name === 'Stone')!
    expect(listApplications(ctx, { companyId: stone.id })).toHaveLength(1)
  })

  it('links contacts with roles', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, base)
    addApplicationContact(ctx, id, { name: 'Bruno Gestor' }, 'hiring_manager')
    addApplicationContact(ctx, id, { name: 'bruno gestor' }, 'interviewer')
    const app = getApplication(ctx, id)
    expect(app.contacts.map((c) => c.role)).toEqual(['hiring_manager', 'interviewer'])
    expect(new Set(app.contacts.map((c) => c.contactId)).size).toBe(1)
  })

  it('registers in well under the 15 second budget (service side)', () => {
    const ctx = makeContext()
    const start = performance.now()
    for (let i = 0; i < 50; i++) createApplication(ctx, { ...base, title: `Vaga ${i}` })
    expect((performance.now() - start) / 50).toBeLessThan(50)
    ctx.clock.advance(DAY)
  })
})
