import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createOrm, openSqlite, type Orm, type Sqlite } from './db/connection'
import { appliedMigrations, pendingMigrations, runMigrations } from './db/migrate'

export interface DataPaths {
  root: string
  database: string
  files: string
  filesTmp: string
  backups: string
  logs: string
  tmp: string
}

export function dataPaths(root: string): DataPaths {
  return {
    root,
    database: join(root, 'cam.db'),
    files: join(root, 'files'),
    filesTmp: join(root, 'files', 'tmp'),
    backups: join(root, 'backups'),
    logs: join(root, 'logs'),
    tmp: join(root, 'tmp')
  }
}

export function ensureDataDirs(paths: DataPaths): void {
  for (const dir of [paths.root, paths.files, paths.filesTmp, paths.backups, paths.logs, paths.tmp]) {
    mkdirSync(dir, { recursive: true })
  }
}

/**
 * Everything a service needs: the open database, the data folders and a clock.
 * Services never import Electron, so they run unchanged in tests.
 */
export interface AppContext {
  readonly paths: DataPaths
  readonly appVersion: string
  readonly now: () => Date
  readonly sqlite: Sqlite
  readonly orm: Orm
  /** Closes the database (used before swapping files during a restore). */
  close(): void
  /** Re-opens the database after close(), applying pending migrations. */
  reopen(): void
}

export interface CreateContextOptions {
  dataDir: string
  appVersion?: string
  now?: () => Date
  /** Called with the open database before pending migrations run on an existing database. */
  beforeMigrate?: (sqlite: Sqlite, paths: DataPaths) => void
}

export function createContext(options: CreateContextOptions): AppContext {
  const paths = dataPaths(options.dataDir)
  ensureDataDirs(paths)
  const now = options.now ?? (() => new Date())

  let sqlite: Sqlite | null = null
  let orm: Orm | null = null

  const open = (): void => {
    const existed = existsSync(paths.database)
    const db = openSqlite(paths.database)
    if (existed && appliedMigrations(db).length > 0 && pendingMigrations(db).length > 0) {
      options.beforeMigrate?.(db, paths)
    }
    runMigrations(db, now)
    sqlite = db
    orm = createOrm(db)
  }
  open()

  return {
    paths,
    appVersion: options.appVersion ?? '0.0.0-dev',
    now,
    get sqlite() {
      if (!sqlite) throw new Error('Database is closed')
      return sqlite
    },
    get orm() {
      if (!orm) throw new Error('Database is closed')
      return orm
    },
    close() {
      if (sqlite) {
        sqlite.pragma('wal_checkpoint(TRUNCATE)')
        sqlite.close()
      }
      sqlite = null
      orm = null
    },
    reopen() {
      if (sqlite) return
      open()
    }
  }
}

export const nowIso = (ctx: Pick<AppContext, 'now'>): string => ctx.now().toISOString()
