/**
 * Verifiable backups (planning doc, section 7.2).
 *
 * A backup is a zip with:
 *   cam.db          consistent snapshot made with VACUUM INTO
 *   files/ab/<sha>  every stored attachment referenced by the snapshot
 *   manifest.json   app and schema versions, row counts and the SHA-256 of every entry
 *
 * Restoring validates the manifest and hashes, extracts to a staging folder,
 * runs PRAGMA integrity_check and foreign_key_check, applies migrations when
 * the backup is older than the app, takes a backup of the current state and
 * only then swaps the data in. "Testar backup" runs everything except the swap.
 */
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync
} from 'node:fs'
import { basename, join } from 'node:path'
import yauzl from 'yauzl'
import yazl from 'yazl'
import type { BackupInfo, BackupManifest, BackupVerification } from '../../shared/dto'
import { AppError } from '../../shared/errors'
import type { AppContext } from '../context'
import { openSqlite, type Sqlite } from '../db/connection'
import { currentSchemaVersion, MIGRATIONS, runMigrations } from '../db/migrate'
import { newId } from '../domain/ids'
import { sha256OfFile } from './files'
import { getSetting, setSetting } from './settings'

export const COUNTED_TABLES = [
  'companies',
  'contacts',
  'applications',
  'application_contacts',
  'stages',
  'events',
  'interviews',
  'assessments',
  'offers',
  'tasks',
  'reminders',
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
  'list_items',
  'audit_log'
] as const

const ENTRY_PATTERN = /^(cam\.db|manifest\.json|files\/[0-9a-f]{2}\/[0-9a-f]{64})$/
const DAILY_RETENTION = 14
const WEEKLY_RETENTION = 8
const SAFETY_RETENTION = 5
const DAY_MS = 86_400_000

export const BACKUP_SETTINGS = {
  extraDir: 'backup.extraDir',
  lastAutoAt: 'backup.lastAutoAt'
} as const

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
}

export function countRows(db: Sqlite): Record<string, number> {
  const counts: Record<string, number> = {}
  const existing = new Set(
    (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]).map((r) => r.name)
  )
  for (const t of COUNTED_TABLES) {
    if (!existing.has(t)) continue
    counts[t] = (db.prepare(`SELECT count(*) AS n FROM "${t}"`).get() as { n: number }).n
  }
  return counts
}

function writeZip(entries: Array<{ name: string; file?: string; buffer?: Buffer }>, target: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile()
    for (const e of entries) {
      if (e.file) zip.addFile(e.file, e.name, { compress: true })
      else if (e.buffer) zip.addBuffer(e.buffer, e.name, { compress: true })
    }
    const out = createWriteStream(target)
    out.on('close', () => resolve())
    out.on('error', reject)
    zip.outputStream.on('error', reject).pipe(out)
    zip.end()
  })
}

function extractZip(zipPath: string, targetDir: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (err, zip) => {
      if (err || !zip) return reject(new AppError('VALIDATION', 'O arquivo não é um backup válido (zip ilegível).'))
      const names: string[] = []
      zip.on('error', reject)
      zip.on('end', () => resolve(names))
      zip.on('entry', (entry: yauzl.Entry) => {
        if (entry.fileName.endsWith('/')) return zip.readEntry()
        // Guards against path traversal: only the exact layout we write is accepted.
        if (!ENTRY_PATTERN.test(entry.fileName)) {
          zip.close()
          return reject(new AppError('VALIDATION', `Entrada inesperada no backup: ${entry.fileName}`))
        }
        zip.openReadStream(entry, (e2, stream) => {
          if (e2 || !stream) return reject(e2 ?? new Error('stream'))
          const dest = join(targetDir, ...entry.fileName.split('/'))
          mkdirSync(join(dest, '..'), { recursive: true })
          const out = createWriteStream(dest)
          stream.on('error', reject)
          out.on('error', reject)
          out.on('close', () => {
            names.push(entry.fileName)
            zip.readEntry()
          })
          stream.pipe(out)
        })
      })
      zip.readEntry()
    })
  })
}

/** Creates a backup zip in the backups folder and returns its info. */
export async function createBackup(ctx: AppContext, kind: BackupManifest['kind'] = 'manual'): Promise<BackupInfo> {
  const now = ctx.now()
  const staging = join(ctx.paths.tmp, `backup-${newId()}`)
  mkdirSync(staging, { recursive: true })
  try {
    const snapshot = join(staging, 'cam.db')
    ctx.sqlite.prepare('VACUUM INTO ?').run(snapshot)

    const snap = openSqlite(snapshot)
    let counts: Record<string, number>
    let shas: string[]
    let schemaVersion: string
    try {
      snap.pragma('journal_mode = DELETE')
      counts = countRows(snap)
      shas = (snap.prepare('SELECT sha256 FROM files').all() as { sha256: string }[]).map((r) => r.sha256)
      schemaVersion = currentSchemaVersion(snap)
    } finally {
      snap.close()
    }

    const entries: Array<{ name: string; file: string }> = [{ name: 'cam.db', file: snapshot }]
    const manifestFiles: BackupManifest['files'] = [
      { path: 'cam.db', sha256: sha256OfFile(snapshot), size: statSync(snapshot).size }
    ]
    const missing: string[] = []
    for (const sha of shas) {
      const src = join(ctx.paths.files, sha.slice(0, 2), sha)
      if (!existsSync(src)) {
        missing.push(sha)
        continue
      }
      const name = `files/${sha.slice(0, 2)}/${sha}`
      entries.push({ name, file: src })
      manifestFiles.push({ path: name, sha256: sha, size: statSync(src).size })
    }
    if (missing.length > 0)
      throw new AppError(
        'FILE_MISSING',
        `${missing.length} anexo(s) não foram encontrados no disco. Rode a verificação de integridade antes do backup.`,
        { missing }
      )

    const manifest: BackupManifest = {
      format: 'cam-backup',
      formatVersion: 1,
      appVersion: ctx.appVersion,
      schemaVersion,
      createdAt: now.toISOString(),
      kind,
      counts,
      files: manifestFiles
    }
    const fileName = `${kind}-${stamp(now)}-${newId().slice(-6)}.zip`
    const tmpZip = join(staging, fileName)
    await writeZip(
      [...entries, { name: 'manifest.json', buffer: Buffer.from(JSON.stringify(manifest, null, 2)) }],
      tmpZip
    )
    const target = join(ctx.paths.backups, fileName)
    renameSync(tmpZip, target)

    const extraDir = getSetting<string | null>(ctx, BACKUP_SETTINGS.extraDir, null)
    if (extraDir && (kind === 'auto' || kind === 'manual')) {
      try {
        mkdirSync(extraDir, { recursive: true })
        copyFileSync(target, join(extraDir, fileName))
      } catch {
        // The local backup succeeded; the copy to the extra folder is best effort.
      }
    }
    if (kind === 'auto') setSetting(ctx, BACKUP_SETTINGS.lastAutoAt, now.toISOString())
    applyRetention(ctx)
    return { path: target, fileName, kind, createdAt: manifest.createdAt, sizeBytes: statSync(target).size }
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

function parseBackupName(name: string): { kind: BackupManifest['kind']; createdAt: string } | null {
  const m = /^(manual|auto|pre-restore|pre-migration)-(\d{8})-(\d{6})/.exec(name)
  if (!m) return null
  const [, kind, d, t] = m as unknown as [string, BackupManifest['kind'], string, string]
  const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}.000Z`
  return { kind, createdAt: iso }
}

export function listBackups(ctx: AppContext): BackupInfo[] {
  if (!existsSync(ctx.paths.backups)) return []
  return readdirSync(ctx.paths.backups)
    .map((fileName) => {
      const parsed = parseBackupName(fileName)
      if (!parsed || !(fileName.endsWith('.zip') || fileName.endsWith('.db'))) return null
      const path = join(ctx.paths.backups, fileName)
      return { path, fileName, ...parsed, sizeBytes: statSync(path).size }
    })
    .filter((b): b is BackupInfo => b !== null)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

function isoWeekKey(iso: string): string {
  const d = new Date(iso)
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / DAY_MS - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return `${d.getUTCFullYear()}-W${week}`
}

/** Keeps 14 daily automatic backups plus one per week for 8 more weeks; manual backups are never pruned. */
export function applyRetention(ctx: AppContext): string[] {
  const removed: string[] = []
  const all = listBackups(ctx)
  const auto = all.filter((b) => b.kind === 'auto')
  const keep = new Set(auto.slice(0, DAILY_RETENTION).map((b) => b.path))
  const weeks = new Set<string>()
  for (const b of auto.slice(DAILY_RETENTION)) {
    const wk = isoWeekKey(b.createdAt)
    if (!weeks.has(wk) && weeks.size < WEEKLY_RETENTION) {
      weeks.add(wk)
      keep.add(b.path)
    }
  }
  for (const kind of ['pre-restore', 'pre-migration'] as const) {
    for (const b of all.filter((x) => x.kind === kind).slice(0, SAFETY_RETENTION)) keep.add(b.path)
  }
  for (const b of all) {
    if (b.kind === 'manual' || keep.has(b.path)) continue
    rmSync(b.path, { force: true })
    removed.push(b.fileName)
  }
  return removed
}

/** Creates the daily automatic backup when the last one is older than 24 hours. */
export async function runScheduledBackup(ctx: AppContext): Promise<BackupInfo | null> {
  const last = getSetting<string | null>(ctx, BACKUP_SETTINGS.lastAutoAt, null)
  if (last && ctx.now().getTime() - Date.parse(last) < DAY_MS) return null
  return createBackup(ctx, 'auto')
}

interface StagedVerification extends BackupVerification {
  stagingDir: string
}

async function verifyIntoStaging(ctx: AppContext, zipPath: string): Promise<StagedVerification> {
  const stagingDir = join(ctx.paths.tmp, `restore-${newId()}`)
  mkdirSync(stagingDir, { recursive: true })
  const result: StagedVerification = {
    ok: false,
    manifest: null,
    problems: [],
    integrityCheck: null,
    foreignKeyViolations: 0,
    counts: {},
    migrationsApplied: [],
    stagingDir
  }
  if (!existsSync(zipPath)) {
    result.problems.push('Arquivo de backup não encontrado.')
    return result
  }
  let names: string[]
  try {
    names = await extractZip(zipPath, stagingDir)
  } catch (e) {
    result.problems.push(e instanceof Error ? e.message : 'Falha ao ler o backup.')
    return result
  }
  if (!names.includes('manifest.json') || !names.includes('cam.db')) {
    result.problems.push('Backup incompleto: faltam manifest.json ou cam.db.')
    return result
  }
  let manifest: BackupManifest
  try {
    manifest = JSON.parse(readFileSync(join(stagingDir, 'manifest.json'), 'utf8')) as BackupManifest
  } catch {
    result.problems.push('manifest.json ilegível.')
    return result
  }
  result.manifest = manifest
  if (manifest.format !== 'cam-backup') result.problems.push('Este arquivo não é um backup do Career Application Manager.')
  if (!MIGRATIONS.some((m) => m.name === manifest.schemaVersion))
    result.problems.push(`Backup feito por uma versão mais nova do app (esquema ${manifest.schemaVersion}). Atualize o app antes de restaurar.`)

  const listed = new Set(manifest.files.map((f) => f.path))
  for (const n of names) if (n !== 'manifest.json' && !listed.has(n)) result.problems.push(`Arquivo fora do manifesto: ${n}`)
  for (const f of manifest.files) {
    const p = join(stagingDir, ...f.path.split('/'))
    if (!existsSync(p)) result.problems.push(`Arquivo ausente: ${f.path}`)
    else if (sha256OfFile(p) !== f.sha256) result.problems.push(`Hash não confere: ${f.path}`)
  }
  if (result.problems.length > 0) return result

  let db: Sqlite | null = null
  try {
    db = openSqlite(join(stagingDir, 'cam.db'))
    result.integrityCheck = String(db.pragma('integrity_check', { simple: true }))
    if (result.integrityCheck !== 'ok') result.problems.push(`integrity_check: ${result.integrityCheck}`)
    result.foreignKeyViolations = (db.pragma('foreign_key_check') as unknown[]).length
    if (result.foreignKeyViolations > 0) result.problems.push(`${result.foreignKeyViolations} violações de chave estrangeira`)
    const before = countRows(db)
    for (const [table, n] of Object.entries(manifest.counts)) {
      if (before[table] !== n) result.problems.push(`Contagem diferente em ${table}: manifesto ${n}, banco ${before[table] ?? 0}`)
    }
    if (result.problems.length === 0) {
      result.migrationsApplied = runMigrations(db, ctx.now)
      result.counts = countRows(db)
    }
    db.pragma('wal_checkpoint(TRUNCATE)')
    db.pragma('journal_mode = DELETE')
  } catch (e) {
    result.problems.push(`Banco do backup não abriu: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    db?.close()
  }
  result.ok = result.problems.length === 0
  return result
}

/** "Testar backup": every restore step except swapping the data. */
export async function verifyBackup(ctx: AppContext, zipPath: string): Promise<BackupVerification> {
  const { stagingDir, ...report } = await verifyIntoStaging(ctx, zipPath)
  rmSync(stagingDir, { recursive: true, force: true })
  return report
}

/**
 * Restores a backup. The current data is backed up first (kind "pre-restore")
 * and the database is closed during the swap, then reopened.
 */
export async function restoreBackup(ctx: AppContext, zipPath: string): Promise<BackupVerification> {
  const staged = await verifyIntoStaging(ctx, zipPath)
  const { stagingDir, ...report } = staged
  try {
    if (!report.ok) throw new AppError('INTEGRITY', 'O backup não passou na verificação. Nada foi alterado.', report.problems)
    await createBackup(ctx, 'pre-restore')

    const old = join(ctx.paths.tmp, `replaced-${newId()}`)
    mkdirSync(old, { recursive: true })
    ctx.close()
    try {
      for (const suffix of ['', '-wal', '-shm']) {
        const p = ctx.paths.database + suffix
        if (existsSync(p)) renameSync(p, join(old, basename(p)))
      }
      if (existsSync(ctx.paths.files)) renameSync(ctx.paths.files, join(old, 'files'))
      renameSync(join(stagingDir, 'cam.db'), ctx.paths.database)
      const stagedFiles = join(stagingDir, 'files')
      if (existsSync(stagedFiles)) renameSync(stagedFiles, ctx.paths.files)
      mkdirSync(ctx.paths.filesTmp, { recursive: true })
    } catch (e) {
      // Put the previous data back if the swap failed half-way.
      rmSync(ctx.paths.database, { force: true })
      for (const name of readdirSync(old)) {
        const target = name === 'files' ? ctx.paths.files : join(ctx.paths.root, name)
        rmSync(target, { recursive: true, force: true })
        renameSync(join(old, name), target)
      }
      ctx.reopen()
      throw e
    }
    ctx.reopen()
    rmSync(old, { recursive: true, force: true })
    return report
  } finally {
    rmSync(stagingDir, { recursive: true, force: true })
  }
}

/** Backup taken right before migrations run on an existing database. */
export function preMigrationBackup(sqlite: Sqlite, backupsDir: string, now = new Date()): string {
  mkdirSync(backupsDir, { recursive: true })
  const target = join(backupsDir, `pre-migration-${stamp(now)}-${newId().slice(-6)}.db`)
  sqlite.prepare('VACUUM INTO ?').run(target)
  return target
}
