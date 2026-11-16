import { describe, expect, it } from 'vitest'
import { CHANNEL_NAMES } from '../../src/shared/contracts'
import { dispatch } from '../../src/main/ipc/dispatch'
import { handlers, type ElectronBridge } from '../../src/main/ipc/handlers'
import { makeContext } from '../helpers/context'

const opened: string[] = []
const bridge: ElectronBridge = {
  platform: 'test',
  openPath: async (p) => void opened.push(p),
  openExternal: async (u) => void opened.push(u),
  chooseBackupFile: async () => null,
  chooseFolder: async () => null,
  notifyDataChanged: () => undefined
}
const quiet = { warn: () => undefined, error: () => undefined }

describe('IPC dispatch', () => {
  it('has one handler per contract channel', () => {
    expect(Object.keys(handlers).sort()).toEqual([...CHANNEL_NAMES].sort())
  })

  it('validates input with the channel schema and returns { ok, data }', async () => {
    const ctx = makeContext()
    const bad = await dispatch(ctx, bridge, 'applications.create', { title: '' }, quiet)
    expect(bad).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })

    const good = await dispatch(
      ctx,
      bridge,
      'applications.create',
      {
        company: { name: 'Globo' },
        title: 'Dev',
        appliedAt: '2026-11-16T08:00:00-03:00',
        platform: 'linkedin'
      },
      quiet
    )
    expect(good.ok).toBe(true)
    const id = (good as { ok: true; data: { id: string } }).data.id
    const detail = await dispatch(ctx, bridge, 'applications.get', { id }, quiet)
    expect(detail).toMatchObject({ ok: true, data: { appliedAt: '2026-11-16T11:00:00.000Z' } })
  })

  it('maps domain errors to their codes', async () => {
    const ctx = makeContext()
    expect(await dispatch(ctx, bridge, 'applications.get', { id: 'nope' }, quiet)).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' }
    })
    const r = await dispatch(
      ctx,
      bridge,
      'events.record',
      { applicationId: 'x', type: 'closed', occurredAt: '2026-11-16T10:00:00Z' },
      quiet
    )
    expect(r).toMatchObject({ ok: false, error: { code: 'VALIDATION' } })
  })

  it('rejects URLs that are not http(s) before they reach the shell', async () => {
    const ctx = makeContext()
    const r = await dispatch(
      ctx,
      bridge,
      'app.openExternal',
      { url: 'file:///C:/Windows/system32/calc.exe' },
      quiet
    )
    expect(r.ok).toBe(false)
    expect(opened).toEqual([])
  })

  it('restricts settings to known UI keys', async () => {
    const ctx = makeContext()
    expect((await dispatch(ctx, bridge, 'settings.set', { key: 'ui.theme', value: 'dark' }, quiet)).ok).toBe(
      true
    )
    expect(await dispatch(ctx, bridge, 'settings.get', { key: 'ui.theme' }, quiet)).toEqual({
      ok: true,
      data: 'dark'
    })
    expect(
      (await dispatch(ctx, bridge, 'settings.set', { key: 'backup.extraDir', value: 'C:/x' }, quiet)).ok
    ).toBe(false)
  })
})
