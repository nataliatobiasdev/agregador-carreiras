/**
 * Thin IPC handlers: the input was already validated against the Zod schema
 * of its channel; each handler only calls a service. Handlers that need
 * Electron (dialogs, shell) receive it through `ElectronBridge` so the table
 * can be exercised in tests without Electron.
 */
import type { ChannelName, ChannelOutput, ChannelParsedInput } from '../../shared/contracts'
import { AppError } from '../../shared/errors'
import type { AppContext } from '../context'
import { currentSchemaVersion } from '../db/migrate'
import * as apps from '../services/applications'
import * as backup from '../services/backup'
import * as catalog from '../services/catalog'
import * as companies from '../services/companies'
import * as contacts from '../services/contacts'
import * as events from '../services/events'
import * as files from '../services/files'
import * as notes from '../services/notes'
import * as search from '../services/search'
import { getSetting, setSetting, UI_SETTING_KEYS } from '../services/settings'
import * as trash from '../services/trash'
import * as vagas1000 from '../services/vagas1000'
import { suggestPlatformFromUrl } from '../domain/normalize'

export interface ElectronBridge {
  openPath(path: string): Promise<void>
  openExternal(url: string): Promise<void>
  chooseBackupFile(): Promise<string | null>
  chooseFolder(): Promise<string | null>
  notifyDataChanged(): void
  platform: string
}

type Handler<C extends ChannelName> = (
  ctx: AppContext,
  input: ChannelParsedInput<C>,
  bridge: ElectronBridge
) => ChannelOutput<C> | Promise<ChannelOutput<C>>

export type HandlerTable = { [C in ChannelName]: Handler<C> }

const uiKey = (key: string): string => {
  if (!(UI_SETTING_KEYS as readonly string[]).includes(key))
    throw new AppError('VALIDATION', 'Configuração desconhecida')
  return key
}

export const handlers: HandlerTable = {
  'vagas1000.list': (ctx) => vagas1000.listPending(ctx),
  'vagas1000.markApplied': (ctx, i) => vagas1000.markApplied(ctx, i.key),
  'app.info': (ctx, _i, b) => ({
    version: ctx.appVersion,
    dataDir: ctx.paths.root,
    schemaVersion: currentSchemaVersion(ctx.sqlite),
    platform: b.platform
  }),
  'app.openDataFolder': (ctx, _i, b) => b.openPath(ctx.paths.root),
  'app.openExternal': (_ctx, i, b) => b.openExternal(i.url),
  'app.rebuildDerived': (ctx) => ({
    applications: events.rebuildAllDerived(ctx),
    searchEntries: search.rebuildSearchIndex(ctx)
  }),

  'applications.list': (ctx, i) => apps.listApplications(ctx, i),
  'applications.get': (ctx, i) => apps.getApplication(ctx, i.id),
  'applications.create': (ctx, i) => apps.createApplication(ctx, i),
  'applications.update': (ctx, i) => apps.updateApplication(ctx, i),
  'applications.duplicate': (ctx, i) => apps.duplicateApplication(ctx, i.id),
  'applications.reapply': (ctx, i) => apps.duplicateApplication(ctx, i.id, { reapply: true }),
  'applications.archive': (ctx, i) => apps.setArchived(ctx, i.id, true),
  'applications.unarchive': (ctx, i) => apps.setArchived(ctx, i.id, false),
  'applications.delete': (ctx, i) => apps.deleteApplication(ctx, i.id),
  'applications.restore': (ctx, i) => apps.restoreApplication(ctx, i.id),
  'applications.undoCreate': (ctx, i) => apps.undoCreateApplication(ctx, i.id),
  'applications.history': (ctx, i) => apps.applicationHistory(ctx, i.id),
  'applications.titles': (ctx) => apps.knownTitles(ctx),
  'applications.lastPlatform': (ctx) => apps.lastPlatform(ctx),
  'applications.suggestPlatform': (_ctx, i) => suggestPlatformFromUrl(i.url),
  'applications.addContact': (ctx, i) => apps.addApplicationContact(ctx, i.applicationId, i.contact, i.role),
  'applications.removeContact': (ctx, i) =>
    apps.removeApplicationContact(ctx, i.applicationId, i.contactId, i.role),

  'events.list': (ctx, i) => events.listEvents(ctx, i.applicationId),
  'events.record': (ctx, i) => ({ id: events.recordEvent(ctx, i) }),
  'events.correct': (ctx, i) => events.correctEvent(ctx, i),
  'events.void': (ctx, i) => events.voidEvent(ctx, i.id, i.reason),

  'stages.list': (ctx, i) => catalog.listStages(ctx, i.includeInactive),
  'stages.create': (ctx, i) => catalog.createStage(ctx, i),
  'stages.update': (ctx, i) => catalog.updateStage(ctx, i.id, i.patch),
  'stages.setActive': (ctx, i) => catalog.setStageActive(ctx, i.id, i.active),

  'lists.items': (ctx, i) => catalog.listItemsOf(ctx, i.listKey, i.includeInactive),
  'lists.add': (ctx, i) => catalog.addListItem(ctx, i.listKey, i.label),
  'lists.update': (ctx, i) => catalog.updateListItem(ctx, i.id, i),

  'companies.list': (ctx, i) => companies.listCompanies(ctx, i),
  'companies.get': (ctx, i) => companies.getCompany(ctx, i.id),
  'companies.create': (ctx, i) => companies.createCompany(ctx, i),
  'companies.update': (ctx, i) => companies.updateCompany(ctx, i.id, i.patch),
  'companies.delete': (ctx, i) => companies.deleteCompany(ctx, i.id),
  'companies.restore': (ctx, i) => companies.restoreCompany(ctx, i.id),
  'companies.suggest': (ctx, i) => companies.suggestCompanies(ctx, i.text),

  'contacts.list': (ctx, i) => contacts.listContacts(ctx, i),
  'contacts.get': (ctx, i) => contacts.getContact(ctx, i.id),
  'contacts.create': (ctx, i) => contacts.createContact(ctx, i),
  'contacts.update': (ctx, i) => contacts.updateContact(ctx, i.id, i.patch),
  'contacts.delete': (ctx, i) => contacts.deleteContact(ctx, i.id),
  'contacts.restore': (ctx, i) => contacts.restoreContact(ctx, i.id),
  'contacts.timeline': (ctx, i) => contacts.contactTimeline(ctx, i.id),
  'contacts.applications': (ctx, i) => contacts.contactApplications(ctx, i.id),

  'notes.list': (ctx, i) => notes.listNotes(ctx, i),
  'notes.get': (ctx, i) => notes.getNote(ctx, i.id),
  'notes.create': (ctx, i) => notes.createNote(ctx, i),
  'notes.update': (ctx, i) => notes.updateNote(ctx, i),
  'notes.delete': (ctx, i) => notes.setNoteDeleted(ctx, i.id, true),
  'notes.restore': (ctx, i) => notes.setNoteDeleted(ctx, i.id, false),
  'notes.revisions': (ctx, i) => notes.noteRevisionsOf(ctx, i.id),
  'notes.restoreRevision': (ctx, i) => notes.restoreNoteRevision(ctx, i.revisionId),
  'notes.templates': (ctx) => notes.listNoteTemplates(ctx),
  'notes.updateTemplate': (ctx, i) => notes.updateNoteTemplate(ctx, i.id, i.bodyMd),

  'attachments.list': (ctx, i) => files.listAttachments(ctx, i.applicationId),
  'attachments.addFromPath': (ctx, i) =>
    files.addAttachment(ctx, {
      applicationId: i.applicationId,
      source: { path: i.path },
      kind: i.kind,
      caption: i.caption
    }),
  'attachments.addFromBytes': (ctx, i) =>
    files.addAttachment(ctx, {
      applicationId: i.applicationId,
      source: { bytes: i.bytes, name: i.name, mime: i.mime },
      kind: i.kind,
      caption: i.caption
    }),
  'attachments.update': (ctx, i) => files.updateAttachment(ctx, i.id, i),
  'attachments.delete': (ctx, i) => files.setAttachmentDeleted(ctx, i.id, true),
  'attachments.restore': (ctx, i) => files.setAttachmentDeleted(ctx, i.id, false),
  'attachments.open': (ctx, i, b) => b.openPath(files.prepareAttachmentForOpening(ctx, i.id)),
  'attachments.verifyIntegrity': (ctx) => files.verifyFileIntegrity(ctx),

  'search.query': (ctx, i) => search.search(ctx, i.text, i.limit),

  'trash.list': (ctx) => trash.listTrash(ctx),
  'trash.restore': (ctx, i) => trash.restoreFromTrash(ctx, i.entityType, i.id),
  'trash.purge': (ctx, i) => trash.purgeFromTrash(ctx, i.entityType, i.id),

  'backup.list': (ctx) => backup.listBackups(ctx),
  'backup.create': (ctx) => backup.createBackup(ctx, 'manual'),
  'backup.verify': (ctx, i) => backup.verifyBackup(ctx, i.path),
  'backup.restore': async (ctx, i, b) => {
    const report = await backup.restoreBackup(ctx, i.path)
    b.notifyDataChanged()
    return report
  },
  'backup.chooseFile': (_ctx, _i, b) => b.chooseBackupFile(),
  'backup.chooseExtraFolder': (_ctx, _i, b) => b.chooseFolder(),
  'backup.getSettings': (ctx) => ({
    extraDir: getSetting<string | null>(ctx, backup.BACKUP_SETTINGS.extraDir, null),
    lastAutoBackupAt: getSetting<string | null>(ctx, backup.BACKUP_SETTINGS.lastAutoAt, null)
  }),
  'backup.setExtraDir': (ctx, i) => setSetting(ctx, backup.BACKUP_SETTINGS.extraDir, i.extraDir),

  'settings.get': (ctx, i) => getSetting<unknown>(ctx, uiKey(i.key), null),
  'settings.set': (ctx, i) => setSetting(ctx, uiKey(i.key), i.value)
}
