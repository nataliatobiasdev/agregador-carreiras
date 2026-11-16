import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'
import { type AppContext, createContext } from '../../src/main/context'

export interface TestClock {
  now: () => Date
  set(iso: string): void
  advance(ms: number): void
}

export function testClock(start = '2026-11-16T12:00:00.000Z'): TestClock {
  let t = Date.parse(start)
  return {
    now: () => new Date(t),
    set: (iso) => {
      t = Date.parse(iso)
    },
    advance: (ms) => {
      t += ms
    }
  }
}

const cleanups: Array<() => void> = []
afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
})

export function tempDir(prefix = 'cam-test-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

export function makeContext(
  clock: TestClock = testClock(),
  dataDir = tempDir()
): AppContext & { clock: TestClock } {
  const ctx = createContext({ dataDir, now: clock.now, appVersion: '1.0.0-test' })
  // Cleanups run last-in first-out, so the database closes before its folder is removed (Windows refuses to delete open files).
  cleanups.push(() => {
    try {
      ctx.close()
    } catch {
      /* already closed */
    }
  })
  return Object.assign(ctx, { clock })
}

export const MINUTE = 60_000
export const DAY = 86_400_000
