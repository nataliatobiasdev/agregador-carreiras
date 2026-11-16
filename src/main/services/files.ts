/**
 * Content-addressed file store: each file is saved once under
 * files/<first 2 hex chars>/<sha256> and linked to any number of records.
 * Writes go to files/tmp first and are moved into place only after hashing,
 * so a crash never leaves a half-written file under its final name.
 */
import { createHash } from 'node:crypto'
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { basename, extname, join } from 'node:path'
import { eq } from 'drizzle-orm'
import type { AttachmentDto, IntegrityReport } from '../../shared/dto'
import type { AttachmentKind } from '../../shared/enums'
import { AppError } from '../../shared/errors'
import { type AppContext, nowIso } from '../context'
import { attachments, files } from '../db/schema'
import { newId } from '../domain/ids'
import { blankToNull } from '../domain/normalize'
import { writeAudit } from './audit'
import { reindexAttachment } from './search'
import { tx } from './tx'

export const MAX_FILE_BYTES = 200 * 1024 * 1024

const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.zip': 'application/zip',
  '.eml': 'message/rfc822',
  '.msg': 'application/vnd.ms-outlook'
}

export function mimeFromName(name: string): string {
  return MIME_BY_EXT[extname(name).toLowerCase()] ?? 'application/octet-stream'
}

export function sha256OfFile(path: string): string {
  const hash = createHash('sha256')
  const fd = openSync(path, 'r')
  try {
    const buf = Buffer.allocUnsafe(1024 * 1024)
    let n: number
    while ((n = readSync(fd, buf, 0, buf.length, null)) > 0) hash.update(buf.subarray(0, n))
  } finally {
    closeSync(fd)
  }
  return hash.digest('hex')
}

export function storedPath(ctx: AppContext, sha256: string): string {
  return join(ctx.paths.files, sha256.slice(0, 2), sha256)
}

export type FileSource = { path: string } | { bytes: Uint8Array; name: string; mime?: string }

/**
 * Copies the source into the store and returns the files row id. Must be
 * called inside a transaction; on failure the caller's rollback leaves at
 * most an unreferenced file, which the integrity check reports.
 */
export function storeFile(ctx: AppContext, source: FileSource): string {
  const tmp = join(ctx.paths.filesTmp, newId())
  let originalName: string
  let mime: string
  if ('path' in source) {
    if (!existsSync(source.path)) throw new AppError('FILE_MISSING', 'Arquivo não encontrado')
    const st = statSync(source.path)
    if (!st.isFile()) throw new AppError('VALIDATION', 'Só é possível anexar arquivos (não pastas)')
    if (st.size > MAX_FILE_BYTES) throw new AppError('VALIDATION', 'Arquivo maior que 200 MB')
    copyFileSync(source.path, tmp)
    originalName = basename(source.path)
    mime = mimeFromName(originalName)
  } else {
    if (source.bytes.byteLength > MAX_FILE_BYTES) throw new AppError('VALIDATION', 'Arquivo maior que 200 MB')
    writeFileSync(tmp, source.bytes)
    originalName = basename(source.name)
    mime = source.mime || mimeFromName(originalName)
  }
  try {
    const sha256 = sha256OfFile(tmp)
    const size = statSync(tmp).size
    const existing = ctx.orm.select().from(files).where(eq(files.sha256, sha256)).get()
    const finalPath = storedPath(ctx, sha256)
    if (!existsSync(finalPath)) {
      mkdirSync(join(ctx.paths.files, sha256.slice(0, 2)), { recursive: true })
      renameSync(tmp, finalPath)
    }
    if (existing) return existing.id
    const id = newId()
    ctx.orm
      .insert(files)
      .values({ id, sha256, sizeBytes: size, mime, originalName, createdAt: nowIso(ctx) })
      .run()
    return id
  } finally {
    if (existsSync(tmp)) rmSync(tmp, { force: true })
  }
}

const ATTACHMENT_SELECT = `SELECT a.id, a.file_id AS fileId, a.kind, a.caption, a.application_id AS applicationId,
       f.original_name AS originalName, f.mime, f.size_bytes AS sizeBytes, f.sha256, a.created_at AS createdAt,
       a.deleted_at AS deletedAt
  FROM attachments a JOIN files f ON f.id = a.file_id`

export function getAttachment(ctx: AppContext, id: string): AttachmentDto {
  const row = ctx.sqlite.prepare(`${ATTACHMENT_SELECT} WHERE a.id = ?`).get(id) as AttachmentDto | undefined
  if (!row) throw new AppError('NOT_FOUND', 'Anexo não encontrado')
  return row
}

export function addAttachment(
  ctx: AppContext,
  input: { applicationId: string; source: FileSource; kind?: AttachmentKind; caption?: string | null }
): AttachmentDto {
  return tx(ctx, () => {
    const app = ctx.sqlite.prepare('SELECT deleted_at FROM applications WHERE id = ?').get(input.applicationId) as
      | { deleted_at: string | null }
      | undefined
    if (!app || app.deleted_at) throw new AppError('NOT_FOUND', 'Candidatura não encontrada')
    const fileId = storeFile(ctx, input.source)
    const id = newId()
    ctx.orm
      .insert(attachments)
      .values({
        id,
        fileId,
        kind: input.kind ?? 'other',
        caption: blankToNull(input.caption),
        applicationId: input.applicationId,
        createdAt: nowIso(ctx)
      })
      .run()
    writeAudit(ctx, 'attachment', id, 'create')
    reindexAttachment(ctx, id)
    return getAttachment(ctx, id)
  })
}

export function listAttachments(ctx: AppContext, applicationId: string): AttachmentDto[] {
  return ctx.sqlite
    .prepare(`${ATTACHMENT_SELECT} WHERE a.application_id = ? AND a.deleted_at IS NULL ORDER BY a.created_at DESC`)
    .all(applicationId) as AttachmentDto[]
}

export function updateAttachment(ctx: AppContext, id: string, patch: { kind?: AttachmentKind; caption?: string | null }): void {
  tx(ctx, () => {
    const before = getAttachment(ctx, id)
    const next: Partial<typeof attachments.$inferInsert> = {}
    const changes: Record<string, [unknown, unknown]> = {}
    if (patch.kind !== undefined && patch.kind !== before.kind) {
      next.kind = patch.kind
      changes.kind = [before.kind, patch.kind]
    }
    if (patch.caption !== undefined && blankToNull(patch.caption) !== before.caption) {
      next.caption = blankToNull(patch.caption)
      changes.caption = [before.caption, next.caption]
    }
    if (Object.keys(next).length === 0) return
    ctx.orm.update(attachments).set(next).where(eq(attachments.id, id)).run()
    writeAudit(ctx, 'attachment', id, 'update', changes)
    reindexAttachment(ctx, id)
  })
}

export function setAttachmentDeleted(ctx: AppContext, id: string, deleted: boolean): void {
  tx(ctx, () => {
    const row = getAttachment(ctx, id)
    if (Boolean(row.deletedAt) === deleted) return
    ctx.orm
      .update(attachments)
      .set({ deletedAt: deleted ? nowIso(ctx) : null })
      .where(eq(attachments.id, id))
      .run()
    writeAudit(ctx, 'attachment', id, deleted ? 'delete' : 'restore')
    reindexAttachment(ctx, id)
  })
}

export function purgeAttachment(ctx: AppContext, id: string): void {
  tx(ctx, () => {
    const row = getAttachment(ctx, id)
    if (!row.deletedAt) throw new AppError('CONFLICT', 'Só é possível excluir em definitivo itens da Lixeira')
    ctx.orm.delete(attachments).where(eq(attachments.id, id)).run()
    reindexAttachment(ctx, id)
    writeAudit(ctx, 'attachment', id, 'delete', { purged: [false, true] })
  })
  collectGarbageFiles(ctx)
}

/**
 * Copies the stored file to a temporary folder under its original name so the
 * default Windows program can open it (the store itself has no extensions).
 * The app never executes attachments itself.
 */
export function prepareAttachmentForOpening(ctx: AppContext, id: string): string {
  const row = getAttachment(ctx, id)
  const src = storedPath(ctx, row.sha256)
  if (!existsSync(src)) throw new AppError('FILE_MISSING', 'O arquivo deste anexo não foi encontrado no disco. Restaure um backup.')
  const dir = join(ctx.paths.tmp, 'open', id)
  mkdirSync(dir, { recursive: true })
  const safeName = row.originalName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
  const target = join(dir, safeName)
  copyFileSync(src, target)
  return target
}

/** Removes file rows and blobs that no attachment or document version references. */
export function collectGarbageFiles(ctx: AppContext): number {
  const orphans = ctx.sqlite
    .prepare(
      `SELECT id, sha256 FROM files f
        WHERE NOT EXISTS (SELECT 1 FROM attachments a WHERE a.file_id = f.id)
          AND NOT EXISTS (SELECT 1 FROM document_versions d WHERE d.file_id = f.id)`
    )
    .all() as Array<{ id: string; sha256: string }>
  for (const o of orphans) {
    ctx.sqlite.prepare('DELETE FROM files WHERE id = ?').run(o.id)
    rmSync(storedPath(ctx, o.sha256), { force: true })
  }
  return orphans.length
}

export function verifyFileIntegrity(ctx: AppContext): IntegrityReport {
  const rows = ctx.orm.select().from(files).all()
  const report: IntegrityReport = { checkedFiles: rows.length, missing: [], corrupted: [], orphanFilesOnDisk: [] }
  const known = new Set<string>()
  for (const f of rows) {
    known.add(f.sha256)
    const p = storedPath(ctx, f.sha256)
    const ref = { fileId: f.id, sha256: f.sha256, originalName: f.originalName }
    if (!existsSync(p)) report.missing.push(ref)
    else if (sha256OfFile(p) !== f.sha256) report.corrupted.push(ref)
  }
  for (const dir of readdirSync(ctx.paths.files)) {
    if (dir === 'tmp' || !/^[0-9a-f]{2}$/.test(dir)) continue
    for (const name of readdirSync(join(ctx.paths.files, dir))) {
      if (!known.has(name)) report.orphanFilesOnDisk.push(join(dir, name))
    }
  }
  return report
}
