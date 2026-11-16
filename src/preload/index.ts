/**
 * The only bridge between the UI and the main process. It exposes a single
 * generic invoke() plus two helpers; the typed window.cam.<domain>.<action>()
 * API is assembled in the renderer from the shared contracts. The renderer
 * never touches Node, the disk or the database directly.
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron'

const bridge = {
  invoke: (channel: string, input: unknown): Promise<unknown> => {
    if (!/^[a-zA-Z]+\.[a-zA-Z]+$/.test(channel)) return Promise.reject(new Error('invalid channel'))
    return ipcRenderer.invoke(`cam:${channel}`, input)
  },
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  onDataChanged: (listener: () => void): (() => void) => {
    const wrapped = (): void => listener()
    ipcRenderer.on('cam:data-changed', wrapped)
    return () => ipcRenderer.removeListener('cam:data-changed', wrapped)
  }
}

export type CamBridge = typeof bridge

contextBridge.exposeInMainWorld('camBridge', bridge)
