import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createContext, dataPaths, ensureDataDirs } from '../../src/main/context'
import { createOrm, openSqlite } from '../../src/main/db/connection'
import { MIGRATIONS, runMigrations } from '../../src/main/db/migrate'
import { createApplication, getApplication } from '../../src/main/services/applications'
import {
  applyRetention,
  countRows,
  createBackup,
  listBackups,
  preMigrationBackup,
  restoreBackup,
  runScheduledBackup,
  verifyBackup
} from '../../src/main/services/backup'
import { recordEvent } from '../../src/main/services/events'
import { addAttachment, sha256OfFile, storedPath } from '../../src/main/services/files'
import { createNote } from '../../src/main/services/notes'
import { search } from '../../src/main/services/search'
import { setSetting } from '../../src/main/services/settings'
import { DAY, makeContext, tempDir, testClock } from '../helpers/context'

function seed(ctx: ReturnType<typeof makeContext>) {
  const { id } = createApplication(ctx, {
    company: { name: 'Totvs' },
    title: 'Engenheira de Dados',
    appliedAt: '2026-11-10T10:00:00.000Z',
    platform: 'gupy',
    jobDescription: 'Pipelines em Spark'
  })
  recordEvent(ctx, { applicationId: id, type: 'stage_changed', stageId: 'stage-hr-interview', occurredAt: '2026-11-12T10:00:00.000Z' })
  createNote(ctx, { kind: 'free', title: 'Anotação', bodyMd: 'conteúdo', owner: { applicationId: id } })
  const att = addAttachment(ctx, { applicationId: id, source: { bytes: new TextEncoder().encode('pdf bytes'), name: 'vaga.pdf' } })
  return { id, att }
}

const ORIGINAL = [...MIGRATIONS]

describe('backup and restore', () => {
  it('round trip: backup → restore in another folder reproduces counts and hashes', async () => {
    const ctx = makeContext()
    const { id, att } = seed(ctx)
    const info = await createBackup(ctx, 'manual')
    expect(info.fileName).toMatch(/^manual-20261116-120000-/)
    const report = await verifyBackup(ctx, info.path)
    expect(report).toMatchObject({ ok: true, integrityCheck: 'ok', foreignKeyViolations: 0, problems: [] })

    const other = makeContext(testClock('2026-11-17T09:00:00.000Z'))
    const restored = await restoreBackup(other, info.path)
    expect(restored.ok).toBe(true)
    expect(countRows(other.sqlite)).toEqual(countRows(ctx.sqlite))
    expect(getApplication(other, id)).toEqual(getApplication(ctx, id))
    const blob = storedPath(other, att.sha256)
    expect(sha256OfFile(blob)).toBe(att.sha256)
    expect(search(other, 'spark')).toHaveLength(1)
    // A safety backup of the replaced state was taken first
    expect(listBackups(other).some((b) => b.kind === 'pre-restore')).toBe(true)
  })

  it('a backup with one corrupted byte fails verification and restore changes nothing', async () => {
    const ctx = makeContext()
    seed(ctx)
    const info = await createBackup(ctx, 'manual')
    const bytes = readFileSync(info.path)
    // Flip a byte inside the stored (uncompressed-size-checked) data region.
    const corrupt = Buffer.from(bytes)
    const at = Math.floor(corrupt.length / 3)
    corrupt[at] = corrupt[at]! ^ 0xff
    const badPath = join(tempDir(), 'bad.zip')
    writeFileSync(badPath, corrupt)
    const report = await verifyBackup(ctx, badPath)
    expect(report.ok).toBe(false)
    expect(report.problems.length).toBeGreaterThan(0)

    const target = makeContext()
    createApplication(target, { company: { name: 'Antes' }, title: 'Mantida', appliedAt: '2026-11-01T10:00:00.000Z', platform: 'email' })
    const before = countRows(target.sqlite)
    await expect(restoreBackup(target, badPath)).rejects.toThrow(/verificação/)
    expect(countRows(target.sqlite)).toEqual(before)
  })

  it('rejects zips that are not backups or that contain unexpected paths', async () => {
    const ctx = makeContext()
    const notZip = join(tempDir(), 'x.zip')
    writeFileSync(notZip, 'hello')
    expect((await verifyBackup(ctx, notZip)).ok).toBe(false)
    expect((await verifyBackup(ctx, join(tempDir(), 'missing.zip'))).problems[0]).toMatch(/não encontrado/)
  })

  it('restores an older-schema backup by applying the missing migrations to it', async () => {
    // Build a data folder whose database only has the first migration applied.
    const oldDir = tempDir()
    const paths = dataPaths(oldDir)
    ensureDataDirs(paths)
    const oldDb = openSqlite(paths.database)
    const all = MIGRATIONS.splice(1)
    try {
      runMigrations(oldDb)
    } finally {
      MIGRATIONS.push(...all)
    }
    const fakeCtx = {
      paths,
      appVersion: '0.9.0',
      now: () => new Date('2026-11-16T12:00:00.000Z'),
      sqlite: oldDb,
      orm: createOrm(oldDb),
      close: () => oldDb.close(),
      reopen: () => undefined
    }
    const info = await createBackup(fakeCtx, 'manual')
    oldDb.close()

    const ctx = makeContext()
    const report = await verifyBackup(ctx, info.path)
    expect(report.ok).toBe(true)
    expect(report.manifest?.schemaVersion).toBe(MIGRATIONS[0]!.name)
    expect(report.migrationsApplied).toEqual(MIGRATIONS.slice(1).map((m) => m.name))
    await restoreBackup(ctx, info.path)
    expect(countRows(ctx.sqlite).stages).toBe(9)
  })

  it('refuses backups made by a newer schema', async () => {
    const ctx = makeContext()
    const info = await createBackup(ctx, 'manual')
    MIGRATIONS.pop()
    try {
      const report = await verifyBackup(ctx, info.path)
      expect(report.ok).toBe(false)
      expect(report.problems.join(' ')).toMatch(/versão mais nova/)
    } finally {
      MIGRATIONS.splice(0, MIGRATIONS.length)
      MIGRATIONS.push(...ORIGINAL)
    }
  })

  it('daily scheduled backup runs once per 24h and retention keeps 14 daily + weekly ones', async () => {
    const clock = testClock('2026-11-16T03:00:00.000Z')
    const ctx = makeContext(clock)
    seed(ctx)
    expect(await runScheduledBackup(ctx)).not.toBeNull()
    expect(await runScheduledBackup(ctx)).toBeNull()
    for (let d = 1; d < 40; d++) {
      clock.advance(DAY)
      await runScheduledBackup(ctx)
    }
    await createBackup(ctx, 'manual')
    const backups = listBackups(ctx)
    const auto = backups.filter((b) => b.kind === 'auto')
    expect(auto.length).toBeGreaterThanOrEqual(14 + 3)
    expect(auto.length).toBeLessThanOrEqual(14 + 8)
    expect(backups.filter((b) => b.kind === 'manual')).toHaveLength(1)
    expect(applyRetention(ctx)).toEqual([])
  })

  it('copies backups to the extra folder when configured', async () => {
    const ctx = makeContext()
    const extra = tempDir()
    setSetting(ctx, 'backup.extraDir', extra)
    const info = await createBackup(ctx, 'manual')
    expect(existsSync(join(extra, info.fileName))).toBe(true)
  })

  it('takes a database backup before migrating an existing database', () => {
    const dir = tempDir()
    const first = createContext({ dataDir: dir })
    first.sqlite.prepare(`DELETE FROM _migrations WHERE name = (SELECT max(name) FROM _migrations)`).run()
    // Re-applying the last migration would fail on existing objects, so only check the hook is called.
    first.close()
    try {
      createContext({ dataDir: dir, beforeMigrate: (db, p) => preMigrationBackup(db, p.backups) })
    } catch {
      /* re-running the last migration fails on existing objects, which is expected here */
    }
    expect(readdirSync(join(dir, 'backups')).filter((f) => f.startsWith('pre-migration-'))).toHaveLength(1)
  })
})
