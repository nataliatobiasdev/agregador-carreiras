import { describe, expect, it } from 'vitest'
import { openSqlite } from '../../src/main/db/connection'
import { MIGRATIONS, pendingMigrations, runMigrations } from '../../src/main/db/migrate'
import { join } from 'node:path'
import { tempDir } from '../helpers/context'

describe('migrations', () => {
  it('builds the full schema from an empty database', () => {
    const db = openSqlite(join(tempDir(), 'a.db'))
    const applied = runMigrations(db)
    expect(applied).toEqual(MIGRATIONS.map((m) => m.name))
    const tables = (
      db.prepare(`SELECT name FROM sqlite_master WHERE type IN ('table')`).all() as { name: string }[]
    ).map((r) => r.name)
    for (const t of [
      'companies',
      'contacts',
      'applications',
      'application_contacts',
      'stages',
      'events',
      'interviews',
      'interview_contacts',
      'assessments',
      'offers',
      'tasks',
      'reminders',
      'automation_rules',
      'notes',
      'note_revisions',
      'note_templates',
      'files',
      'documents',
      'document_versions',
      'attachments',
      'tags',
      'taggings',
      'goals',
      'templates',
      'settings',
      'audit_log',
      'list_items',
      'search_index'
    ]) {
      expect(tables).toContain(t)
    }
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal')
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
    expect((db.pragma('foreign_key_check') as unknown[]).length).toBe(0)
    db.close()
  })

  it('is idempotent and seeds default catalogs once', () => {
    const db = openSqlite(join(tempDir(), 'b.db'))
    runMigrations(db)
    expect(runMigrations(db)).toEqual([])
    expect(pendingMigrations(db)).toEqual([])
    const stages = db.prepare('SELECT count(*) AS n FROM stages').get() as { n: number }
    expect(stages.n).toBe(9)
    const defaults = db.prepare('SELECT count(*) AS n FROM stages WHERE is_default_applied = 1').get() as {
      n: number
    }
    expect(defaults.n).toBe(1)
    const rules = db.prepare('SELECT count(*) AS n FROM automation_rules').get() as { n: number }
    expect(rules.n).toBe(9)
    db.close()
  })

  it('rolls back a failing migration and leaves earlier ones applied', () => {
    const db = openSqlite(join(tempDir(), 'c.db'))
    runMigrations(db)
    MIGRATIONS.push({ name: '9999_broken', statements: ['CREATE TABLE x (id TEXT)', 'THIS IS NOT SQL'] })
    try {
      expect(() => runMigrations(db)).toThrow()
      const x = db.prepare(`SELECT count(*) AS n FROM sqlite_master WHERE name = 'x'`).get() as { n: number }
      expect(x.n).toBe(0)
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
    } finally {
      MIGRATIONS.pop()
      db.close()
    }
  })
})
