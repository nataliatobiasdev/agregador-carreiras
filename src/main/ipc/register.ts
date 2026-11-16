import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { CHANNEL_NAMES } from '../../shared/contracts'
import type { Result } from '../../shared/errors'
import type { AppContext } from '../context'
import { log } from '../logger'
import { dispatch } from './dispatch'
import type { ElectronBridge } from './handlers'

export function registerIpc(
  ctx: AppContext,
  bridge: ElectronBridge,
  isTrustedSender: (e: IpcMainInvokeEvent) => boolean
): void {
  for (const channel of CHANNEL_NAMES) {
    ipcMain.handle(`cam:${channel}`, (event, raw) => {
      if (!isTrustedSender(event)) {
        return {
          ok: false,
          error: { code: 'UNEXPECTED', message: 'Origem não autorizada' }
        } satisfies Result<never>
      }
      return dispatch(ctx, bridge, channel, raw, log)
    })
  }
}
