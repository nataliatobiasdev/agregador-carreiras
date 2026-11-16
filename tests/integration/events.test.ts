import { describe, expect, it } from 'vitest'
import { createApplication, getApplication } from '../../src/main/services/applications'
import {
  correctEvent,
  listEvents,
  rebuildAllDerived,
  recordEvent,
  voidEvent
} from '../../src/main/services/events'
import { createStage, listStages, setStageActive, updateStage } from '../../src/main/services/catalog'
import { DAY, makeContext } from '../helpers/context'

const base = {
  company: { name: 'Stone' },
  title: 'Backend Sênior',
  appliedAt: '2026-11-01T10:00:00.000Z',
  platform: 'gupy'
}

describe('events and derived state', () => {
  it('a stage change updates current stage and first response', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, base)
    recordEvent(ctx, {
      applicationId: id,
      type: 'stage_changed',
      stageId: 'stage-hr-interview',
      occurredAt: '2026-11-05T10:00:00.000Z'
    })
    const app = getApplication(ctx, id)
    expect(app).toMatchObject({
      stageName: 'Entrevista RH',
      stageCategory: 'screening',
      firstInboundAt: '2026-11-05T10:00:00.000Z'
    })
  })

  it('a retroactive event recalculates status and stage', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, base)
    recordEvent(ctx, {
      applicationId: id,
      type: 'stage_changed',
      stageId: 'stage-tech-interview',
      occurredAt: '2026-11-10T10:00:00.000Z'
    })
    // Registered later, but happened before the technical interview
    recordEvent(ctx, {
      applicationId: id,
      type: 'stage_changed',
      stageId: 'stage-hr-interview',
      occurredAt: '2026-11-04T10:00:00.000Z'
    })
    expect(getApplication(ctx, id).stageName).toBe('Entrevista técnica')
    // A closing registered retroactively before a later interaction still closes it
    recordEvent(ctx, {
      applicationId: id,
      type: 'closed',
      outcome: 'rejected',
      closeReason: 'stack',
      occurredAt: '2026-11-12T10:00:00.000Z'
    })
    expect(getApplication(ctx, id)).toMatchObject({
      status: 'closed',
      outcome: 'rejected',
      closeReason: 'stack'
    })
  })

  it('refuses events that do not fit the timeline and rolls back', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, base)
    expect(() =>
      recordEvent(ctx, { applicationId: id, type: 'resumed', occurredAt: '2026-11-02T10:00:00.000Z' })
    ).toThrow(/não combina/)
    expect(() =>
      recordEvent(ctx, { applicationId: id, type: 'reopened', occurredAt: '2026-11-02T10:00:00.000Z' })
    ).toThrow(/não combina/)
    expect(listEvents(ctx, id)).toHaveLength(1)
  })

  it('validates dates: not in the future, not before the application unless confirmed', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, base)
    expect(() =>
      recordEvent(ctx, { applicationId: id, type: 'note', occurredAt: '2026-12-01T10:00:00.000Z' })
    ).toThrow(/futuro/)
    expect(() =>
      recordEvent(ctx, { applicationId: id, type: 'note', occurredAt: '2026-10-01T10:00:00.000Z' })
    ).toThrow(/anterior/)
    recordEvent(ctx, {
      applicationId: id,
      type: 'note',
      occurredAt: '2026-10-01T10:00:00.000Z',
      allowBeforeApplied: true
    })
    expect(listEvents(ctx, id)).toHaveLength(2)
  })

  it('pause, resume, close and reopen', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, base)
    recordEvent(ctx, {
      applicationId: id,
      type: 'paused',
      occurredAt: '2026-11-03T10:00:00.000Z',
      expectedResumeAt: '2026-12-01T10:00:00.000Z'
    })
    expect(getApplication(ctx, id).status).toBe('paused')
    recordEvent(ctx, { applicationId: id, type: 'resumed', occurredAt: '2026-11-04T10:00:00.000Z' })
    expect(getApplication(ctx, id).status).toBe('active')
    recordEvent(ctx, {
      applicationId: id,
      type: 'closed',
      outcome: 'no_response',
      occurredAt: '2026-11-05T10:00:00.000Z'
    })
    const closed = getApplication(ctx, id)
    expect(closed).toMatchObject({ status: 'closed', outcome: 'no_response' })
    // Silence never counts as a response
    expect(closed.firstInboundAt).toBeNull()
    recordEvent(ctx, { applicationId: id, type: 'reopened', occurredAt: '2026-11-06T10:00:00.000Z' })
    expect(getApplication(ctx, id)).toMatchObject({ status: 'active', outcome: null })
  })

  it('correcting and voiding events is audited and recalculates the cache', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, base)
    const closeId = recordEvent(ctx, {
      applicationId: id,
      type: 'closed',
      outcome: 'withdrew',
      occurredAt: '2026-11-05T10:00:00.000Z'
    })
    voidEvent(ctx, closeId, 'Registrado por engano')
    expect(getApplication(ctx, id).status).toBe('active')
    const ev = listEvents(ctx, id).find((e) => e.id === closeId)!
    expect(ev.voidedAt).not.toBeNull()
    expect(ev.voidReason).toBe('Registrado por engano')

    const interaction = recordEvent(ctx, {
      applicationId: id,
      type: 'interaction',
      direction: 'in',
      occurredAt: '2026-11-07T10:00:00.000Z',
      summary: 'RH ligou'
    })
    correctEvent(ctx, {
      id: interaction,
      occurredAt: '2026-11-06T10:00:00.000Z',
      summary: 'RH ligou e marcou conversa'
    })
    const corrected = listEvents(ctx, id).find((e) => e.id === interaction)!
    expect(corrected.occurredAt).toBe('2026-11-06T10:00:00.000Z')
    expect(corrected.recordedAt).toBe(ctx.now().toISOString())
    expect(getApplication(ctx, id).lastInboundAt).toBe('2026-11-06T10:00:00.000Z')
    const audit = ctx.sqlite
      .prepare(`SELECT action FROM audit_log WHERE entity_type = 'event' ORDER BY at, id`)
      .all()
    expect(audit.map((a) => (a as { action: string }).action)).toEqual(['create', 'void', 'create', 'update'])
  })

  it('the applied event cannot be voided', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, base)
    const applied = listEvents(ctx, id)[0]!
    expect(() => voidEvent(ctx, applied.id, 'x')).toThrow()
  })

  it('rebuilding derived data gives exactly the incremental result (random timelines)', () => {
    const ctx = makeContext()
    let seed = 42
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31
      return seed / 2 ** 31
    }
    const stageIds = listStages(ctx).map((s) => s.id)
    for (let n = 0; n < 40; n++) {
      const appliedAt = new Date(
        Date.parse('2026-06-01T00:00:00.000Z') + Math.floor(rnd() * 100) * DAY
      ).toISOString()
      const { id } = createApplication(ctx, { ...base, title: `Vaga ${n}`, appliedAt })
      const steps = Math.floor(rnd() * 8)
      for (let i = 0; i < steps; i++) {
        const occurredAt = new Date(Date.parse(appliedAt) + Math.floor(rnd() * 60) * DAY).toISOString()
        const kinds = [
          'stage_changed',
          'interaction',
          'follow_up_sent',
          'paused',
          'resumed',
          'closed',
          'reopened',
          'feedback_received'
        ] as const
        const type = kinds[Math.floor(rnd() * kinds.length)]!
        try {
          const evId = recordEvent(ctx, {
            applicationId: id,
            type,
            occurredAt,
            stageId: type === 'stage_changed' ? stageIds[Math.floor(rnd() * stageIds.length)] : null,
            outcome: type === 'closed' ? 'rejected' : null,
            direction: type === 'interaction' ? (rnd() > 0.5 ? 'in' : 'out') : null
          })
          if (rnd() < 0.1) voidEvent(ctx, evId, 'teste')
        } catch {
          // invalid sequences are rejected, as in real use
        }
      }
    }
    const snapshot = () =>
      ctx.sqlite
        .prepare(
          'SELECT id, status, outcome, close_reason, current_stage_id, first_inbound_at, last_inbound_at, last_activity_at FROM applications ORDER BY id'
        )
        .all()
    const incremental = snapshot()
    ctx.sqlite.exec(
      `UPDATE applications SET current_stage_id = NULL, last_activity_at = NULL, first_inbound_at = NULL, last_inbound_at = NULL`
    )
    expect(rebuildAllDerived(ctx)).toBe(40)
    expect(snapshot()).toEqual(incremental)
  })
})

describe('stage catalog', () => {
  it('creates, renames and deactivates stages; used stages keep their category', () => {
    const ctx = makeContext()
    const s = createStage(ctx, { name: 'Case de negócio', category: 'assessment' })
    expect(() => createStage(ctx, { name: 'case de negocio', category: 'assessment' })).toThrow(/Já existe/)
    const { id } = createApplication(ctx, base)
    recordEvent(ctx, {
      applicationId: id,
      type: 'stage_changed',
      stageId: s.id,
      occurredAt: '2026-11-02T10:00:00.000Z'
    })
    expect(() => updateStage(ctx, s.id, { category: 'interview' })).toThrow(/categoria/)
    expect(updateStage(ctx, s.id, { name: 'Case' }).name).toBe('Case')
    setStageActive(ctx, s.id, false)
    expect(listStages(ctx).some((x) => x.id === s.id)).toBe(false)
    expect(listStages(ctx, true).find((x) => x.id === s.id)?.usageCount).toBe(2)
    expect(() => ctx.sqlite.prepare('DELETE FROM stages WHERE id = ?').run(s.id)).toThrow(/FOREIGN KEY/)
    expect(() => setStageActive(ctx, 'stage-applied', false)).toThrow()
  })
})
