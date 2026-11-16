import { join } from 'node:path'
import { app, BrowserWindow, dialog, Menu, session, shell, type IpcMainInvokeEvent } from 'electron'
import iconIco from '../../build/icon.ico?asset'
import iconPng from '../../build/icon.png?asset'
import { type AppContext, createContext } from './context'
import { isHttpUrl } from './domain/normalize'
import type { ElectronBridge } from './ipc/handlers'
import { registerIpc } from './ipc/register'
import { configureLogging, log } from './logger'
import { preMigrationBackup, runScheduledBackup } from './services/backup'
import { purgeExpired } from './services/trash'

/** Must match electron-builder's appId (Windows needs it for native notifications). */
const APP_ID = 'com.nataliatobias.cam'
const HOURLY = 60 * 60 * 1000

const isDev = !app.isPackaged
// The packaged .exe already carries the icon; setting it here covers dev runs and Linux.
const WINDOW_ICON = process.platform === 'win32' ? iconIco : iconPng

// Dates, numbers and native inputs (date pickers) in Brazilian Portuguese regardless of the OS language.
app.commandLine.appendSwitch('lang', 'pt-BR')
// Offline by design: no Chromium component updates or hyperlink auditing pings.
app.commandLine.appendSwitch('disable-component-update')
app.commandLine.appendSwitch('no-pings')
const devServerUrl = process.env.ELECTRON_RENDERER_URL

function resolveDataDir(): string {
  return process.env.CAM_DATA_DIR ?? join(app.getPath('appData'), 'CAM')
}

let mainWindow: BrowserWindow | null = null
let ctx: AppContext | null = null

function rendererUrlAllowed(url: string): boolean {
  if (devServerUrl && url.startsWith(devServerUrl)) return true
  return url.startsWith('file://')
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Career Application Manager',
    icon: WINDOW_ICON,
    backgroundColor: '#0b0d12',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      // Windows uses its built-in spell checker; elsewhere Electron would download dictionaries, so it stays off.
      spellcheck: process.platform === 'win32'
    }
  })

  win.once('ready-to-show', () => win.show())

  // No navigation away from the app and no new windows; external http(s) links open in the browser.
  win.webContents.on('will-navigate', (event, url) => {
    if (!rendererUrlAllowed(url)) {
      event.preventDefault()
      if (isHttpUrl(url)) void shell.openExternal(url)
    }
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('render-process-gone', (_e, details) => log.error('[renderer] gone', details.reason))

  if (devServerUrl) void win.loadURL(devServerUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
  return win
}

function hardenSession(): void {
  const ses = session.defaultSession
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  ses.setPermissionCheckHandler(() => false)
  // The app works offline: block every request that is not the bundled UI (or the dev server).
  ses.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url
    const allowed =
      url.startsWith('file://') ||
      url.startsWith('devtools://') ||
      url.startsWith('data:') ||
      url.startsWith('blob:') ||
      (devServerUrl !== undefined &&
        (url.startsWith(devServerUrl) || url.startsWith(devServerUrl.replace('http', 'ws'))))
    callback({ cancel: !allowed })
  })
}

function bridge(): ElectronBridge {
  return {
    platform: process.platform,
    async openPath(path) {
      const err = await shell.openPath(path)
      if (err) throw new Error(err)
    },
    async openExternal(url) {
      if (!isHttpUrl(url)) throw new Error('Only http(s) links can be opened')
      await shell.openExternal(url)
    },
    async chooseBackupFile() {
      const res = await dialog.showOpenDialog(mainWindow!, {
        title: 'Escolher backup',
        properties: ['openFile'],
        filters: [{ name: 'Backup do CAM', extensions: ['zip'] }]
      })
      return res.canceled ? null : (res.filePaths[0] ?? null)
    },
    async chooseFolder() {
      const res = await dialog.showOpenDialog(mainWindow!, {
        title: 'Pasta extra para backups (ex.: OneDrive)',
        properties: ['openDirectory', 'createDirectory']
      })
      return res.canceled ? null : (res.filePaths[0] ?? null)
    },
    notifyDataChanged() {
      mainWindow?.webContents.send('cam:data-changed')
    }
  }
}

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  return event.senderFrame !== null && rendererUrlAllowed(event.senderFrame.url)
}

function startBackgroundJobs(context: AppContext): void {
  const run = async (): Promise<void> => {
    try {
      const b = await runScheduledBackup(context)
      if (b) log.info('[backup] automatic backup created', b.fileName)
    } catch (e) {
      log.error('[backup] automatic backup failed', e)
    }
    try {
      const r = purgeExpired(context)
      if (r.purged > 0) log.info('[trash] purged expired items', r)
    } catch (e) {
      log.error('[trash] purge failed', e)
    }
  }
  setTimeout(() => void run(), 15_000)
  setInterval(() => void run(), HOURLY)
}

process.on('uncaughtException', (e) => log.error('[main] uncaughtException', e))
process.on('unhandledRejection', (e) => log.error('[main] unhandledRejection', e))

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  void app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID)
    const dataDir = resolveDataDir()
    configureLogging(join(dataDir, 'logs'))
    log.info('[main] starting', { version: app.getVersion(), dataDir })

    try {
      ctx = createContext({
        dataDir,
        appVersion: app.getVersion(),
        beforeMigrate: (sqlite, paths) => {
          const file = preMigrationBackup(sqlite, paths.backups)
          log.info('[db] backup before migration', file)
        }
      })
    } catch (e) {
      log.error('[db] failed to open database', e)
      dialog.showErrorBox(
        'Não foi possível abrir os dados',
        `O banco de dados não abriu. Seus dados não foram alterados.\n\nPasta: ${dataDir}\n\n${e instanceof Error ? e.message : String(e)}`
      )
      app.exit(1)
      return
    }

    hardenSession()
    Menu.setApplicationMenu(isDev ? Menu.getApplicationMenu() : null)
    registerIpc(ctx, bridge(), isTrustedSender)
    mainWindow = createWindow()
    startBackgroundJobs(ctx)
  })

  app.on('window-all-closed', () => {
    // V1.0 has no tray yet (V1.1): closing the window quits the app.
    app.quit()
  })

  app.on('will-quit', () => {
    try {
      ctx?.close()
    } catch (e) {
      log.error('[db] close failed', e)
    }
  })
}
