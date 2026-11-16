import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createApplication, deleteApplication, restoreApplication } from '../../src/main/services/applications'
import { createCompany, deleteCompany, updateCompany } from '../../src/main/services/companies'
import { createContact } from '../../src/main/services/contacts'
import {
  addAttachment,
  listAttachments,
  prepareAttachmentForOpening,
  setAttachmentDeleted,
  storedPath,
  verifyFileIntegrity
} from '../../src/main/services/files'
import { createNote, listNotes, noteRevisionsOf, restoreNoteRevision, setNoteDeleted, updateNote } from '../../src/main/services/notes'
import { rebuildSearchIndex, search } from '../../src/main/services/search'
import { listTrash, purgeExpired, purgeFromTrash, restoreFromTrash } from '../../src/main/services/trash'
import { DAY, makeContext, tempDir } from '../helpers/context'

const base = { company: { name: 'Mercado Livre' }, title: 'Arquiteta de Soluções', appliedAt: '2026-11-15T10:00:00.000Z', platform: 'linkedin' }

describe('notes', () => {
  it('creates from the kind template and keeps at most one revision per minute', () => {
    const ctx = makeContext()
    const { id: appId } = createApplication(ctx, base)
    const note = createNote(ctx, { kind: 'interview_prep', title: 'Preparação', owner: { applicationId: appId } })
    expect(note.bodyMd).toContain('Perguntas para fazer')
    expect(note.ownerLabel).toBe('Arquiteta de Soluções — Mercado Livre')
    updateNote(ctx, { id: note.id, bodyMd: 'v2' })
    ctx.clock.advance(10_000)
    updateNote(ctx, { id: note.id, bodyMd: 'v3' })
    expect(noteRevisionsOf(ctx, note.id)).toHaveLength(1)
    ctx.clock.advance(61_000)
    updateNote(ctx, { id: note.id, bodyMd: 'v4' })
    const revs = noteRevisionsOf(ctx, note.id)
    expect(revs.map((r) => r.bodyMd)).toEqual(['v4', 'v3'])
    ctx.clock.advance(61_000)
    expect(restoreNoteRevision(ctx, revs[1]!.id).bodyMd).toBe('v3')
  })

  it('a note has at most one owner (service and CHECK)', () => {
    const ctx = makeContext()
    const { id: appId } = createApplication(ctx, base)
    const company = createCompany(ctx, { name: 'Outra' })
    expect(() => createNote(ctx, { kind: 'free', title: 'x', owner: { applicationId: appId, companyId: company.id } })).toThrow()
    const n = createNote(ctx, { kind: 'free', title: 'Geral' })
    expect(() => ctx.sqlite.prepare('UPDATE notes SET application_id = ?, company_id = ? WHERE id = ?').run(appId, company.id, n.id)).toThrow(/CHECK/)
  })

  it('soft delete and restore', () => {
    const ctx = makeContext()
    const n = createNote(ctx, { kind: 'free', title: 'Geral', bodyMd: 'texto' })
    setNoteDeleted(ctx, n.id, true)
    expect(listNotes(ctx)).toHaveLength(0)
    restoreFromTrash(ctx, 'note', n.id)
    expect(listNotes(ctx)).toHaveLength(1)
  })
})

describe('attachments', () => {
  it('stores the same content once and opens a copy with the original name', () => {
    const ctx = makeContext()
    const { id: a1 } = createApplication(ctx, base)
    const { id: a2 } = createApplication(ctx, { ...base, title: 'Outra vaga' })
    const src = join(tempDir(), 'Descrição da vaga.pdf')
    writeFileSync(src, '%PDF-1.4 conteúdo de teste')
    const att1 = addAttachment(ctx, { applicationId: a1, source: { path: src }, kind: 'job_description' })
    const att2 = addAttachment(ctx, { applicationId: a2, source: { path: src } })
    addAttachment(ctx, { applicationId: a1, source: { bytes: new TextEncoder().encode('%PDF-1.4 conteúdo de teste'), name: 'copia.pdf' } })
    expect(att1.fileId).toBe(att2.fileId)
    expect(att1.mime).toBe('application/pdf')
    expect((ctx.sqlite.prepare('SELECT count(*) AS n FROM files').get() as { n: number }).n).toBe(1)
    const dirs = readdirSync(ctx.paths.files).filter((d) => d !== 'tmp')
    expect(dirs.flatMap((d) => readdirSync(join(ctx.paths.files, d)))).toHaveLength(1)
    expect(readdirSync(ctx.paths.filesTmp)).toHaveLength(0)
    const opened = prepareAttachmentForOpening(ctx, att1.id)
    expect(opened.endsWith('Descrição da vaga.pdf')).toBe(true)
    expect(listAttachments(ctx, a1)).toHaveLength(2)
  })

  it('keeps the blob while any record references it and removes it after the last purge', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, base)
    const att = addAttachment(ctx, { applicationId: id, source: { bytes: new Uint8Array([1, 2, 3]), name: 'print.png', mime: 'image/png' }, kind: 'application_proof' })
    const blob = storedPath(ctx, att.sha256)
    setAttachmentDeleted(ctx, att.id, true)
    expect(existsSync(blob)).toBe(true)
    purgeFromTrash(ctx, 'attachment', att.id)
    expect(existsSync(blob)).toBe(false)
    expect((ctx.sqlite.prepare('SELECT count(*) AS n FROM files').get() as { n: number }).n).toBe(0)
  })

  it('a database failure leaves no file in the temporary folder', () => {
    const ctx = makeContext()
    expect(() => addAttachment(ctx, { applicationId: 'missing', source: { bytes: new Uint8Array([9]), name: 'x.txt' } })).toThrow()
    expect(readdirSync(ctx.paths.filesTmp)).toHaveLength(0)
  })

  it('integrity check reports missing, corrupted and orphan files', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, base)
    const a = addAttachment(ctx, { applicationId: id, source: { bytes: new Uint8Array([1]), name: 'a.txt' } })
    const b = addAttachment(ctx, { applicationId: id, source: { bytes: new Uint8Array([2]), name: 'b.txt' } })
    rmSync(storedPath(ctx, a.sha256))
    writeFileSync(storedPath(ctx, b.sha256), 'tampered')
    writeFileSync(join(ctx.paths.files, b.sha256.slice(0, 2), 'f'.repeat(64)), 'orphan')
    const report = verifyFileIntegrity(ctx)
    expect(report.missing.map((m) => m.fileId)).toEqual([a.fileId])
    expect(report.corrupted.map((m) => m.fileId)).toEqual([b.fileId])
    expect(report.orphanFilesOnDisk).toHaveLength(1)
  })
})

describe('search', () => {
  it('finds applications, companies, contacts, notes and attachments ignoring accents', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, { ...base, jobDescription: 'Experiência com mensageria e Kafka' })
    createContact(ctx, { name: 'Joana Recrutadora', email: 'joana@exemplo.com' })
    createNote(ctx, { kind: 'free', title: 'Pesquisa', bodyMd: 'Cultura de inovação', owner: { applicationId: id } })
    addAttachment(ctx, { applicationId: id, source: { bytes: new Uint8Array([1]), name: 'Currículo Backend.pdf' } })
    expect(search(ctx, 'arquiteta')[0]).toMatchObject({ entityType: 'application', applicationId: id })
    expect(search(ctx, 'mensageria').map((r) => r.entityType)).toContain('application')
    expect(search(ctx, 'mercado').map((r) => r.entityType).sort()).toEqual(['application', 'company'])
    expect(search(ctx, 'joana')[0]?.entityType).toBe('contact')
    expect(search(ctx, 'inovacao')[0]).toMatchObject({ entityType: 'note', applicationId: id })
    expect(search(ctx, 'curriculo')[0]).toMatchObject({ entityType: 'attachment', applicationId: id })
    expect(search(ctx, 'arq solu')).toHaveLength(1)
    expect(search(ctx, '"; DROP TABLE x; --')).toEqual([])
  })

  it('follows renames, deletes and restores, and rebuilds from scratch', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, base)
    const company = ctx.sqlite.prepare('SELECT company_id AS c FROM applications WHERE id = ?').get(id) as { c: string }
    updateCompany(ctx, company.c, { name: 'Meli' })
    expect(search(ctx, 'meli').length).toBe(2)
    deleteApplication(ctx, id)
    expect(search(ctx, 'arquiteta')).toHaveLength(0)
    restoreApplication(ctx, id)
    expect(search(ctx, 'arquiteta')).toHaveLength(1)
    const before = search(ctx, 'meli')
    expect(rebuildSearchIndex(ctx)).toBeGreaterThan(0)
    expect(search(ctx, 'meli')).toEqual(before)
  })
})

describe('trash', () => {
  it('lists deleted items with days left and purges expired ones on schedule', () => {
    const ctx = makeContext()
    const { id } = createApplication(ctx, base)
    const att = addAttachment(ctx, { applicationId: id, source: { bytes: new Uint8Array([7]), name: 'x.txt' } })
    createNote(ctx, { kind: 'free', title: 'Nota', owner: { applicationId: id } })
    deleteApplication(ctx, id)
    ctx.clock.advance(5 * DAY)
    expect(listTrash(ctx)).toEqual([expect.objectContaining({ entityType: 'application', id, daysLeft: 25 })])
    expect(purgeExpired(ctx)).toEqual({ purged: 0, kept: 0 })
    ctx.clock.advance(26 * DAY)
    expect(purgeExpired(ctx).purged).toBe(1)
    expect(listTrash(ctx)).toHaveLength(0)
    expect(existsSync(storedPath(ctx, att.sha256))).toBe(false)
    expect((ctx.sqlite.prepare('SELECT count(*) AS n FROM notes').get() as { n: number }).n).toBe(0)
    // History survives a permanent delete
    expect((ctx.sqlite.prepare(`SELECT count(*) AS n FROM audit_log WHERE entity_id = ?`).get(id) as { n: number }).n).toBeGreaterThan(0)
    expect(() => ctx.sqlite.prepare('DELETE FROM audit_log').run()).toThrow(/append-only/)
  })

  it('a company with applications cannot be deleted', () => {
    const ctx = makeContext()
    createApplication(ctx, base)
    const company = ctx.sqlite.prepare('SELECT id FROM companies').get() as { id: string }
    expect(() => deleteCompany(ctx, company.id)).toThrow(/candidatura/)
  })
})
