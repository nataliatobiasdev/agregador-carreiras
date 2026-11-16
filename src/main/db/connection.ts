import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

export type Orm = BetterSQLite3Database<typeof schema>
export type Sqlite = Database.Database

/** Opens the SQLite file with the pragmas required by the spec (section 7.2). */
export function openSqlite(file: string, options: { readonly?: boolean } = {}): Sqlite {
  const db = new Database(file, {
    readonly: options.readonly ?? false,
    fileMustExist: options.readonly ?? false
  })
  if (!options.readonly) {
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = FULL')
  }
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  return db
}

export function createOrm(db: Sqlite): Orm {
  return drizzle(db, { schema })
}
