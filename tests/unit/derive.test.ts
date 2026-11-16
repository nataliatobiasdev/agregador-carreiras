import { describe, expect, it } from 'vitest'
import {
  checkOccurredAt,
  defaultDirection,
  deriveApplicationState,
  type TimelineEvent
} from '../../src/main/domain/derive'

let seq = 0
function ev(
  type: TimelineEvent['type'],
  occurredAt: string,
  extra: Partial<TimelineEvent> = {}
): TimelineEvent {
  seq++
  return {
    id: `e${String(seq).padStart(4, '0')}`,
    type,
    occurredAt,
    recordedAt: occurredAt,
    stageId: null,
    outcome: null,
    closeReason: null,
    direction: null,
    voidedAt: null,
    ...extra
  }
}

describe('deriveApplicationState', () => {
  it('starts active at the default applied stage', () => {
    const { state, invalidEventIds } = deriveApplicationState(
      [ev('applied', '2026-01-01T10:00:00.000Z', { direction: 'out' })],
      'stage-applied'
    )
    expect(state).toMatchObject({
      status: 'active',
      currentStageId: 'stage-applied',
      outcome: null,
      lastInboundAt: null
    })
    expect(state.lastActivityAt).toBe('2026-01-01T10:00:00.000Z')
    expect(invalidEventIds).toEqual([])
  })

  it('applies events in occurredAt order regardless of insertion order (retroactive events)', () => {
    const events = [
      ev('applied', '2026-01-01T10:00:00.000Z'),
      ev('stage_changed', '2026-01-10T10:00:00.000Z', { stageId: 'tech' }),
      // recorded later, but happened earlier
      ev('stage_changed', '2026-01-05T10:00:00.000Z', {
        stageId: 'hr',
        recordedAt: '2026-01-11T00:00:00.000Z'
      })
    ]
    expect(deriveApplicationState(events, 'applied').state.currentStageId).toBe('tech')
  })

  it('tracks first and last inbound interactions and ignores notes for activity', () => {
    const events = [
      ev('applied', '2026-01-01T10:00:00.000Z'),
      ev('interaction', '2026-01-03T10:00:00.000Z', { direction: 'in' }),
      ev('follow_up_sent', '2026-01-04T10:00:00.000Z', { direction: 'out' }),
      ev('interaction', '2026-01-06T10:00:00.000Z', { direction: 'in' }),
      ev('note', '2026-01-08T10:00:00.000Z')
    ]
    const { state } = deriveApplicationState(events, 'applied')
    expect(state.firstInboundAt).toBe('2026-01-03T10:00:00.000Z')
    expect(state.lastInboundAt).toBe('2026-01-06T10:00:00.000Z')
    expect(state.lastActivityAt).toBe('2026-01-06T10:00:00.000Z')
  })

  it('pauses and resumes back to the previous status, including offer', () => {
    const events = [
      ev('applied', '2026-01-01T10:00:00.000Z'),
      ev('offer_received', '2026-01-02T10:00:00.000Z'),
      ev('paused', '2026-01-03T10:00:00.000Z')
    ]
    expect(deriveApplicationState(events, 'a').state.status).toBe('paused')
    events.push(ev('resumed', '2026-01-04T10:00:00.000Z'))
    expect(deriveApplicationState(events, 'a').state.status).toBe('offer')
  })

  it('an offer received while paused is remembered for resume', () => {
    const events = [
      ev('applied', '2026-01-01T10:00:00.000Z'),
      ev('paused', '2026-01-02T10:00:00.000Z'),
      ev('offer_received', '2026-01-03T10:00:00.000Z'),
      ev('resumed', '2026-01-04T10:00:00.000Z')
    ]
    expect(deriveApplicationState(events, 'a').state.status).toBe('offer')
  })

  it('closes with outcome and reason; reopening clears them', () => {
    const events = [
      ev('applied', '2026-01-01T10:00:00.000Z'),
      ev('closed', '2026-01-05T10:00:00.000Z', { outcome: 'rejected', closeReason: 'stack', direction: 'in' })
    ]
    let r = deriveApplicationState(events, 'a')
    expect(r.state).toMatchObject({ status: 'closed', outcome: 'rejected', closeReason: 'stack' })
    events.push(ev('reopened', '2026-01-06T10:00:00.000Z'))
    r = deriveApplicationState(events, 'a')
    expect(r.state).toMatchObject({ status: 'active', outcome: null, closeReason: null })
  })

  it('flags events that do not fit the timeline', () => {
    const resumed = ev('resumed', '2026-01-02T10:00:00.000Z')
    const reopened = ev('reopened', '2026-01-03T10:00:00.000Z')
    const closedTwice = [
      ev('closed', '2026-01-04T10:00:00.000Z', { outcome: 'withdrew' }),
      ev('closed', '2026-01-05T10:00:00.000Z', { outcome: 'withdrew' })
    ]
    const pausedWhileClosed = ev('paused', '2026-01-06T10:00:00.000Z')
    const stageWithout = ev('stage_changed', '2026-01-07T10:00:00.000Z')
    const closedNoOutcome = ev('closed', '2026-01-01T11:00:00.000Z')
    const { invalidEventIds } = deriveApplicationState(
      [
        ev('applied', '2026-01-01T10:00:00.000Z'),
        resumed,
        reopened,
        ...closedTwice,
        pausedWhileClosed,
        stageWithout,
        closedNoOutcome
      ],
      'a'
    )
    expect(invalidEventIds.sort()).toEqual(
      [
        resumed.id,
        reopened.id,
        closedTwice[1]!.id,
        pausedWhileClosed.id,
        stageWithout.id,
        closedNoOutcome.id
      ].sort()
    )
  })

  it('ignores voided events', () => {
    const events = [
      ev('applied', '2026-01-01T10:00:00.000Z'),
      ev('closed', '2026-01-05T10:00:00.000Z', { outcome: 'rejected', voidedAt: '2026-01-06T00:00:00.000Z' })
    ]
    expect(deriveApplicationState(events, 'a').state.status).toBe('active')
  })

  it('does not let a closed application become an offer', () => {
    const events = [
      ev('applied', '2026-01-01T10:00:00.000Z'),
      ev('closed', '2026-01-02T10:00:00.000Z', { outcome: 'withdrew' }),
      ev('offer_received', '2026-01-03T10:00:00.000Z')
    ]
    expect(deriveApplicationState(events, 'a').state.status).toBe('closed')
  })

  it('uses the stage of the applied event when present', () => {
    expect(
      deriveApplicationState([ev('applied', '2026-01-01T10:00:00.000Z', { stageId: 'x' })], 'a').state
        .currentStageId
    ).toBe('x')
  })
})

describe('defaultDirection', () => {
  it('maps event types to the direction used by response metrics', () => {
    expect(defaultDirection('applied', null)).toBe('out')
    expect(defaultDirection('follow_up_sent', null)).toBe('out')
    expect(defaultDirection('feedback_received', null)).toBe('in')
    expect(defaultDirection('stage_changed', null)).toBe('in')
    expect(defaultDirection('closed', 'rejected')).toBe('in')
    expect(defaultDirection('closed', 'no_response')).toBeNull()
    expect(defaultDirection('closed', 'withdrew')).toBeNull()
    expect(defaultDirection('note', null)).toBeNull()
    expect(defaultDirection('offer_received', null)).toBe('in')
    expect(defaultDirection('assessment_submitted', null)).toBe('out')
  })
})

describe('checkOccurredAt', () => {
  const now = new Date('2026-11-16T12:00:00.000Z')
  it('rejects future dates beyond a small tolerance', () => {
    expect(checkOccurredAt('2026-11-16T12:04:00.000Z', '2026-11-01T00:00:00.000Z', now)).toBeNull()
    expect(checkOccurredAt('2026-11-16T12:30:00.000Z', '2026-11-01T00:00:00.000Z', now)).toBe('future')
  })
  it('flags dates before the application', () => {
    expect(checkOccurredAt('2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z', now)).toBe(
      'before_applied'
    )
  })
})
