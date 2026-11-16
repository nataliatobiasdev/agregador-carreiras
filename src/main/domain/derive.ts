/**
 * Derivation of an application's cached state from its event timeline.
 *
 * The timeline is the single source of truth: status, current stage and the
 * "last interaction" fields stored on `applications` are a cache produced by
 * this pure function. Services call it after every event write (inside the
 * same transaction) and the "rebuild derived data" command calls it for all
 * applications, so incremental and full rebuilds are identical by design.
 */
import type { ApplicationStatus, Direction, EventType, Outcome } from '../../shared/enums'

export interface TimelineEvent {
  id: string
  type: EventType
  occurredAt: string
  recordedAt: string
  stageId: string | null
  outcome: Outcome | null
  closeReason: string | null
  direction: Direction | null
  voidedAt: string | null
}

export interface DerivedState {
  status: ApplicationStatus
  outcome: Outcome | null
  closeReason: string | null
  currentStageId: string | null
  firstInboundAt: string | null
  lastInboundAt: string | null
  lastActivityAt: string | null
}

export interface DerivationResult {
  state: DerivedState
  /** Events that do not make sense at their position (e.g. "resumed" while not paused). */
  invalidEventIds: string[]
}

export function compareEvents(a: TimelineEvent, b: TimelineEvent): number {
  if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? -1 : 1
  if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function deriveApplicationState(
  events: readonly TimelineEvent[],
  defaultAppliedStageId: string | null
): DerivationResult {
  const ordered = events.filter((e) => e.voidedAt === null).sort(compareEvents)
  const invalid: string[] = []

  let status: ApplicationStatus = 'active'
  let statusBeforePause: ApplicationStatus = 'active'
  let outcome: Outcome | null = null
  let closeReason: string | null = null
  let currentStageId: string | null = defaultAppliedStageId
  let firstInboundAt: string | null = null
  let lastInboundAt: string | null = null
  let lastActivityAt: string | null = null

  for (const e of ordered) {
    switch (e.type) {
      case 'applied':
        currentStageId = e.stageId ?? defaultAppliedStageId
        break
      case 'stage_changed':
        if (e.stageId) currentStageId = e.stageId
        else invalid.push(e.id)
        break
      case 'offer_received':
      case 'offer_updated':
        if (status === 'closed') break
        if (status === 'paused') statusBeforePause = 'offer'
        else status = 'offer'
        break
      case 'paused':
        if (status === 'active' || status === 'offer') {
          statusBeforePause = status
          status = 'paused'
        } else invalid.push(e.id)
        break
      case 'resumed':
        if (status === 'paused') status = statusBeforePause
        else invalid.push(e.id)
        break
      case 'closed':
        if (status === 'closed' || e.outcome === null) {
          invalid.push(e.id)
          break
        }
        status = 'closed'
        outcome = e.outcome
        closeReason = e.closeReason
        break
      case 'reopened':
        if (status !== 'closed') {
          invalid.push(e.id)
          break
        }
        status = 'active'
        outcome = null
        closeReason = null
        break
      default:
        break
    }

    if (e.direction === 'in') {
      if (firstInboundAt === null) firstInboundAt = e.occurredAt
      lastInboundAt = e.occurredAt
    }
    if (e.type !== 'note' && (lastActivityAt === null || e.occurredAt > lastActivityAt)) {
      lastActivityAt = e.occurredAt
    }
  }

  return {
    state: { status, outcome, closeReason, currentStageId, firstInboundAt, lastInboundAt, lastActivityAt },
    invalidEventIds: invalid
  }
}

/** Direction used when the user does not choose one explicitly. */
export function defaultDirection(type: EventType, outcome: Outcome | null): Direction | null {
  switch (type) {
    case 'applied':
    case 'follow_up_sent':
    case 'assessment_submitted':
      return 'out'
    case 'feedback_received':
    case 'offer_received':
    case 'offer_updated':
    case 'assessment_received':
      return 'in'
    case 'stage_changed':
      return 'in'
    case 'closed':
      return outcome === 'rejected' || outcome === 'position_cancelled' ? 'in' : null
    default:
      return null
  }
}

/** Tolerance for clock differences when checking that an event is not in the future. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000

export type OccurredAtProblem = 'future' | 'before_applied' | null

export function checkOccurredAt(occurredAt: string, appliedAt: string, now: Date): OccurredAtProblem {
  if (Date.parse(occurredAt) > now.getTime() + FUTURE_TOLERANCE_MS) return 'future'
  if (occurredAt < appliedAt) return 'before_applied'
  return null
}
