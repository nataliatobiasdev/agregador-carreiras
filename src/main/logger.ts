import log from 'electron-log/main'
import { join } from 'node:path'

export function configureLogging(logsDir: string): void {
  log.transports.file.resolvePathFn = () => join(logsDir, 'main.log')
  log.transports.file.maxSize = 5 * 1024 * 1024
  log.transports.file.level = 'info'
  log.transports.console.level = process.env.NODE_ENV === 'production' ? false : 'info'
  log.initialize()
}

export { log }
