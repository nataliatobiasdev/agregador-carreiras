/**
 * IPC contract between renderer and main process. Each channel declares a Zod
 * schema for its input (validated in the main process before reaching a
 * service) and the TypeScript type of its output. The preload script exposes
 * every channel as window.cam.<domain>.<action>(input).
 */
import { z } from 'zod'
import type * as D from './dto'
import type { Result } from './errors'
import {
  APPLICATION_STATUSES,
  ATTACHMENT_KINDS,
  CONTACT_ROLES,
  DIRECTIONS,
  EMPLOYMENT_TYPES,
  FEEDBACK_SENTIMENTS,
  LIST_KEYS,
  MANUAL_EVENT_TYPES,
  MEDIUMS,
  NOTE_KINDS,
  OUTCOMES,
  PAY_PERIODS,
  PRIORITIES,
  PROCESS_LANGUAGES,
  SENIORITIES,
  STAGE_CATEGORIES,
  WORK_MODES
} from './enums'

const id = z.string().min(1).max(64)
const isoDate = z.string().datetime({ offset: true })
const optionalText = (max = 2000) => z.string().max(max).nullish()
const longText = z.string().max(200_000).nullish()
const currency = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Moeda deve ter 3 letras (ISO 4217)')
  .nullish()
const cents = z.number().int().nonnegative().max(1e13).nullish()
const httpUrl = z
  .string()
  .max(2000)
  .refine((v) => /^https?:\/\//i.test(v), 'URL deve começar com http:// ou https://')

export const companyRefSchema = z.union([
  z.object({ id }),
  z.object({ name: z.string().trim().min(1, 'Informe a empresa').max(200) })
])

export const applicationFieldsSchema = z.object({
  title: z.string().trim().min(1, 'Informe o cargo').max(300),
  appliedAt: isoDate,
  platform: z.string().trim().min(1, 'Informe a plataforma').max(100),
  channel: optionalText(100),
  jobUrl: httpUrl.nullish(),
  seniority: z.enum(SENIORITIES).nullish(),
  area: optionalText(100),
  workMode: z.enum(WORK_MODES).nullish(),
  city: optionalText(200),
  country: optionalText(100),
  employmentType: z.enum(EMPLOYMENT_TYPES).nullish(),
  priority: z.enum(PRIORITIES).optional(),
  fitScore: z.number().int().min(1).max(5).nullish(),
  postedSalaryMin: cents,
  postedSalaryMax: cents,
  postedCurrency: currency,
  postedPeriod: z.enum(PAY_PERIODS).nullish(),
  expectedSalary: cents,
  expectedCurrency: currency,
  expectedPeriod: z.enum(PAY_PERIODS).nullish(),
  jobDescription: longText,
  requirementsRequired: longText,
  requirementsDesired: longText,
  externalRef: optionalText(200),
  processLanguage: z.enum(PROCESS_LANGUAGES).nullish(),
  needsVisa: z.boolean().nullish(),
  relocationOffered: z.boolean().nullish(),
  coverLetterText: longText,
  responseDeadline: isoDate.nullish(),
  skills: z.array(z.string().trim().min(1).max(80)).max(100).optional()
})

export const createApplicationSchema = applicationFieldsSchema.extend({
  company: companyRefSchema,
  initialNote: z.string().max(200_000).nullish(),
  recruiter: z.union([z.object({ id }), z.object({ name: z.string().trim().min(1).max(200) })]).nullish(),
  previousApplicationId: id.nullish()
})
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>

export const updateApplicationSchema = z.object({
  id,
  patch: applicationFieldsSchema.partial().extend({ company: companyRefSchema.optional() })
})
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>

export const applicationFilterSchema = z
  .object({
    statuses: z.array(z.enum(APPLICATION_STATUSES)).optional(),
    companyId: id.optional(),
    appliedFrom: isoDate.optional(),
    appliedTo: isoDate.optional(),
    includeArchived: z.boolean().optional(),
    text: z.string().max(200).optional()
  })
  .default({})
export type ApplicationFilter = z.infer<typeof applicationFilterSchema>

export const recordEventSchema = z
  .object({
    applicationId: id,
    type: z.enum(MANUAL_EVENT_TYPES),
    occurredAt: isoDate,
    stageId: id.nullish(),
    direction: z.enum(DIRECTIONS).nullish(),
    medium: z.enum(MEDIUMS).nullish(),
    contactId: id.nullish(),
    summary: z.string().max(20_000).nullish(),
    outcome: z.enum(OUTCOMES).nullish(),
    closeReason: optionalText(200),
    sentiment: z.enum(FEEDBACK_SENTIMENTS).nullish(),
    expectedResumeAt: isoDate.nullish(),
    allowBeforeApplied: z.boolean().optional()
  })
  .superRefine((v, ctx) => {
    if (v.type === 'stage_changed' && !v.stageId)
      ctx.addIssue({ code: 'custom', path: ['stageId'], message: 'Escolha a etapa' })
    if (v.type === 'closed' && !v.outcome)
      ctx.addIssue({ code: 'custom', path: ['outcome'], message: 'Escolha o desfecho' })
    if (v.type === 'interaction' && !v.direction)
      ctx.addIssue({ code: 'custom', path: ['direction'], message: 'Informe se foi recebida ou enviada' })
  })
export type RecordEventInput = z.infer<typeof recordEventSchema>

export const correctEventSchema = z.object({
  id,
  occurredAt: isoDate.optional(),
  summary: z.string().max(20_000).nullish(),
  allowBeforeApplied: z.boolean().optional()
})

export const companyInputSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome').max(200),
  website: httpUrl.nullish(),
  industry: optionalText(200),
  size: optionalText(100),
  country: optionalText(100),
  notes: longText
})

export const contactInputSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome').max(200),
  companyId: id.nullish(),
  roleTitle: optionalText(200),
  email: z.string().trim().email('E-mail inválido').max(320).nullish().or(z.literal('')),
  phone: optionalText(100),
  linkedinUrl: httpUrl.nullish().or(z.literal('')),
  keepInTouch: z.boolean().optional(),
  notes: longText
})

const noteOwnerSchema = z
  .object({
    applicationId: id.nullish(),
    companyId: id.nullish(),
    contactId: id.nullish()
  })
  .refine(
    (o) => [o.applicationId, o.companyId, o.contactId].filter(Boolean).length <= 1,
    'Uma nota pertence a no máximo um registro'
  )

export const createNoteSchema = z.object({
  kind: z.enum(NOTE_KINDS),
  title: z.string().trim().min(1, 'Informe o título').max(300),
  bodyMd: z.string().max(500_000).optional(),
  owner: noteOwnerSchema.optional(),
  fromTemplateId: id.optional()
})

export const updateNoteSchema = z.object({
  id,
  title: z.string().trim().min(1).max(300).optional(),
  bodyMd: z.string().max(500_000).optional(),
  kind: z.enum(NOTE_KINDS).optional(),
  pinned: z.boolean().optional()
})

export const noteFilterSchema = z
  .object({
    applicationId: id.optional(),
    companyId: id.optional(),
    contactId: id.optional(),
    kind: z.enum(NOTE_KINDS).optional()
  })
  .default({})

export const addAttachmentFromPathSchema = z.object({
  applicationId: id,
  path: z.string().min(1).max(4096),
  kind: z.enum(ATTACHMENT_KINDS).optional(),
  caption: optionalText(500)
})

export const addAttachmentFromBytesSchema = z.object({
  applicationId: id,
  name: z.string().min(1).max(255),
  mime: z.string().min(1).max(200),
  bytes: z.instanceof(Uint8Array),
  kind: z.enum(ATTACHMENT_KINDS).optional(),
  caption: optionalText(500)
})

export const trashRefSchema = z.object({
  entityType: z.enum(['application', 'company', 'contact', 'note', 'attachment']),
  id
})

export const stageInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.enum(STAGE_CATEGORIES),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullish()
})

// ---------------------------------------------------------------------------

type Channel<I extends z.ZodTypeAny, O> = { input: I; output: O }
const ch =
  <O>() =>
  <I extends z.ZodTypeAny>(input: I): Channel<I, O> => ({ input, output: undefined as O })

const none = z.undefined()
const byId = z.object({ id })

export const contracts = {
  'vagas1000.list': ch<Array<{ key: string; title: string; company: string; url: string; addedAt: string; details: string }>>()(none),
  'vagas1000.markApplied': ch<{ id: string }>()(z.object({ key: z.string().min(1).max(2000) })),
  'app.info': ch<D.AppInfo>()(none),
  'app.openDataFolder': ch<void>()(none),
  'app.openExternal': ch<void>()(z.object({ url: httpUrl })),
  'app.rebuildDerived': ch<{ applications: number; searchEntries: number }>()(none),

  'applications.list': ch<D.ApplicationListItem[]>()(applicationFilterSchema),
  'applications.get': ch<D.ApplicationDetail>()(byId),
  'applications.create': ch<{ id: string }>()(createApplicationSchema),
  'applications.update': ch<D.ApplicationDetail>()(updateApplicationSchema),
  'applications.duplicate': ch<{ id: string }>()(byId),
  'applications.reapply': ch<{ id: string }>()(byId),
  'applications.archive': ch<void>()(byId),
  'applications.unarchive': ch<void>()(byId),
  'applications.delete': ch<void>()(byId),
  'applications.restore': ch<void>()(byId),
  'applications.undoCreate': ch<void>()(byId),
  'applications.history': ch<D.AuditEntryDto[]>()(byId),
  'applications.titles': ch<string[]>()(none),
  'applications.lastPlatform': ch<string | null>()(none),
  'applications.suggestPlatform': ch<string | null>()(z.object({ url: z.string().max(2000) })),
  'applications.addContact': ch<void>()(
    z.object({
      applicationId: id,
      contact: z.union([z.object({ id }), z.object({ name: z.string().trim().min(1).max(200) })]),
      role: z.enum(CONTACT_ROLES)
    })
  ),
  'applications.removeContact': ch<void>()(
    z.object({ applicationId: id, contactId: id, role: z.enum(CONTACT_ROLES) })
  ),

  'events.list': ch<D.TimelineEventDto[]>()(z.object({ applicationId: id })),
  'events.record': ch<{ id: string }>()(recordEventSchema),
  'events.correct': ch<void>()(correctEventSchema),
  'events.void': ch<void>()(z.object({ id, reason: z.string().trim().min(1, 'Informe o motivo').max(500) })),

  'stages.list': ch<D.StageDto[]>()(z.object({ includeInactive: z.boolean().optional() }).default({})),
  'stages.create': ch<D.StageDto>()(stageInputSchema),
  'stages.update': ch<D.StageDto>()(z.object({ id, patch: stageInputSchema.partial() })),
  'stages.setActive': ch<void>()(z.object({ id, active: z.boolean() })),

  'lists.items': ch<D.ListItemDto[]>()(
    z.object({ listKey: z.enum(LIST_KEYS), includeInactive: z.boolean().optional() })
  ),
  'lists.add': ch<D.ListItemDto>()(
    z.object({ listKey: z.enum(LIST_KEYS), label: z.string().trim().min(1).max(100) })
  ),
  'lists.update': ch<void>()(
    z.object({ id, label: z.string().trim().min(1).max(100).optional(), active: z.boolean().optional() })
  ),

  'companies.list': ch<D.CompanyListItem[]>()(z.object({ text: z.string().max(200).optional() }).default({})),
  'companies.get': ch<D.CompanyDto>()(byId),
  'companies.create': ch<D.CompanyDto>()(companyInputSchema),
  'companies.update': ch<D.CompanyDto>()(z.object({ id, patch: companyInputSchema.partial() })),
  'companies.delete': ch<void>()(byId),
  'companies.restore': ch<void>()(byId),
  'companies.suggest': ch<Array<{ id: string; name: string }>>()(z.object({ text: z.string().max(200) })),

  'contacts.list': ch<D.ContactListItem[]>()(
    z.object({ text: z.string().max(200).optional(), companyId: id.optional() }).default({})
  ),
  'contacts.get': ch<D.ContactDto>()(byId),
  'contacts.create': ch<D.ContactDto>()(contactInputSchema),
  'contacts.update': ch<D.ContactDto>()(z.object({ id, patch: contactInputSchema.partial() })),
  'contacts.delete': ch<void>()(byId),
  'contacts.restore': ch<void>()(byId),
  'contacts.timeline': ch<D.TimelineEventDto[]>()(byId),
  'contacts.applications': ch<Array<D.ApplicationListItem & { role: string }>>()(byId),

  'notes.list': ch<D.NoteDto[]>()(noteFilterSchema),
  'notes.get': ch<D.NoteDto>()(byId),
  'notes.create': ch<D.NoteDto>()(createNoteSchema),
  'notes.update': ch<D.NoteDto>()(updateNoteSchema),
  'notes.delete': ch<void>()(byId),
  'notes.restore': ch<void>()(byId),
  'notes.revisions': ch<D.NoteRevisionDto[]>()(byId),
  'notes.restoreRevision': ch<D.NoteDto>()(z.object({ revisionId: id })),
  'notes.templates': ch<D.NoteTemplateDto[]>()(none),
  'notes.updateTemplate': ch<void>()(z.object({ id, bodyMd: z.string().max(100_000) })),

  'attachments.list': ch<D.AttachmentDto[]>()(z.object({ applicationId: id })),
  'attachments.addFromPath': ch<D.AttachmentDto>()(addAttachmentFromPathSchema),
  'attachments.addFromBytes': ch<D.AttachmentDto>()(addAttachmentFromBytesSchema),
  'attachments.update': ch<void>()(
    z.object({ id, kind: z.enum(ATTACHMENT_KINDS).optional(), caption: optionalText(500) })
  ),
  'attachments.delete': ch<void>()(byId),
  'attachments.restore': ch<void>()(byId),
  'attachments.open': ch<void>()(byId),
  'attachments.verifyIntegrity': ch<D.IntegrityReport>()(none),

  'search.query': ch<D.SearchResult[]>()(
    z.object({ text: z.string().max(200), limit: z.number().int().max(100).optional() })
  ),

  'trash.list': ch<D.TrashItem[]>()(none),
  'trash.restore': ch<void>()(trashRefSchema),
  'trash.purge': ch<void>()(trashRefSchema),

  'backup.list': ch<D.BackupInfo[]>()(none),
  'backup.create': ch<D.BackupInfo>()(none),
  'backup.verify': ch<D.BackupVerification>()(z.object({ path: z.string().min(1).max(4096) })),
  'backup.restore': ch<D.BackupVerification>()(z.object({ path: z.string().min(1).max(4096) })),
  'backup.chooseFile': ch<string | null>()(none),
  'backup.chooseExtraFolder': ch<string | null>()(none),
  'backup.getSettings': ch<{ extraDir: string | null; lastAutoBackupAt: string | null }>()(none),
  'backup.setExtraDir': ch<void>()(z.object({ extraDir: z.string().max(4096).nullable() })),

  'settings.get': ch<unknown>()(z.object({ key: z.string().min(1).max(100) })),
  'settings.set': ch<void>()(z.object({ key: z.string().min(1).max(100), value: z.unknown() }))
} as const

export type Contracts = typeof contracts
export type ChannelName = keyof Contracts
export type ChannelInput<C extends ChannelName> = z.input<Contracts[C]['input']>
export type ChannelParsedInput<C extends ChannelName> = z.output<Contracts[C]['input']>
export type ChannelOutput<C extends ChannelName> = Contracts[C]['output']

export const CHANNEL_NAMES = Object.keys(contracts) as ChannelName[]

type Split<S extends string> = S extends `${infer D}.${infer A}` ? [D, A] : never
type Domains = Split<ChannelName>[0]

/** Typed API assembled in the renderer: cam.<domain>.<action>(input). */
export type CamApi = {
  [Dm in Domains]: {
    [C in ChannelName as Split<C>[0] extends Dm ? Split<C>[1] : never]: undefined extends ChannelInput<C>
      ? (input?: ChannelInput<C>) => Promise<Result<ChannelOutput<C>>>
      : (input: ChannelInput<C>) => Promise<Result<ChannelOutput<C>>>
  }
}
