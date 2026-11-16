// Shapes returned by the main process over IPC. Dates are UTC ISO 8601 strings.
import type {
  ApplicationStatus,
  AttachmentKind,
  AuditAction,
  ContactRole,
  Direction,
  EventType,
  ListKey,
  NoteKind,
  Outcome,
  StageCategory
} from './enums'

export interface StageDto {
  id: string
  name: string
  category: StageCategory
  sortHint: number
  color: string | null
  active: boolean
  isDefaultApplied: boolean
  usageCount: number
}

export interface ListItemDto {
  id: string
  listKey: ListKey
  value: string
  label: string
  sortOrder: number
  active: boolean
}

export interface CompanyDto {
  id: string
  name: string
  website: string | null
  industry: string | null
  size: string | null
  country: string | null
  notes: string | null
  archivedAt: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CompanyListItem extends CompanyDto {
  applicationCount: number
  activeApplicationCount: number
  respondedCount: number
  lastActivityAt: string | null
}

export interface ContactDto {
  id: string
  name: string
  companyId: string | null
  companyName: string | null
  roleTitle: string | null
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  keepInTouch: boolean
  notes: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ContactListItem extends ContactDto {
  lastInteractionAt: string | null
  applicationCount: number
}

export interface ApplicationListItem {
  id: string
  companyId: string
  companyName: string
  title: string
  platform: string
  seniority: string | null
  area: string | null
  workMode: string | null
  priority: string
  fitScore: number | null
  appliedAt: string
  status: ApplicationStatus
  outcome: Outcome | null
  currentStageId: string | null
  stageName: string | null
  stageCategory: StageCategory | null
  lastActivityAt: string | null
  lastInboundAt: string | null
  archivedAt: string | null
}

export interface ApplicationContactDto {
  contactId: string
  name: string
  role: ContactRole
  email: string | null
  linkedinUrl: string | null
}

export interface ApplicationDetail {
  id: string
  companyId: string
  companyName: string
  title: string
  seniority: string | null
  area: string | null
  jobUrl: string | null
  platform: string
  channel: string | null
  workMode: string | null
  city: string | null
  country: string | null
  employmentType: string | null
  postedSalaryMin: number | null
  postedSalaryMax: number | null
  postedCurrency: string | null
  postedPeriod: string | null
  expectedSalary: number | null
  expectedCurrency: string | null
  expectedPeriod: string | null
  jobDescription: string | null
  requirementsRequired: string | null
  requirementsDesired: string | null
  fitScore: number | null
  priority: string
  appliedAt: string
  externalRef: string | null
  processLanguage: string | null
  needsVisa: boolean | null
  relocationOffered: boolean | null
  coverLetterText: string | null
  responseDeadline: string | null
  previousApplicationId: string | null
  duplicatedFromId: string | null
  status: ApplicationStatus
  outcome: Outcome | null
  closeReason: string | null
  currentStageId: string | null
  stageName: string | null
  stageCategory: StageCategory | null
  firstInboundAt: string | null
  lastInboundAt: string | null
  lastActivityAt: string | null
  archivedAt: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  skills: string[]
  contacts: ApplicationContactDto[]
  /** Share of the fields that feed metrics which are filled in (0 to 1). */
  completeness: number
  missingFields: string[]
  otherApplicationsAtCompany: Array<{ id: string; title: string; appliedAt: string; status: ApplicationStatus }>
}

export interface TimelineEventDto {
  id: string
  applicationId: string
  type: EventType
  occurredAt: string
  recordedAt: string
  stageId: string | null
  stageName: string | null
  outcome: Outcome | null
  closeReason: string | null
  direction: Direction | null
  medium: string | null
  contactId: string | null
  contactName: string | null
  summary: string | null
  payload: Record<string, unknown> | null
  voidedAt: string | null
  voidReason: string | null
  updatedAt: string
}

export interface AuditEntryDto {
  id: string
  entityType: string
  entityId: string
  action: AuditAction
  changes: Record<string, [unknown, unknown]> | null
  at: string
}

export interface NoteDto {
  id: string
  kind: NoteKind
  title: string
  bodyMd: string
  applicationId: string | null
  companyId: string | null
  contactId: string | null
  interviewId: string | null
  ownerLabel: string | null
  pinned: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface NoteRevisionDto {
  id: string
  noteId: string
  title: string
  bodyMd: string
  savedAt: string
}

export interface NoteTemplateDto {
  id: string
  kind: NoteKind
  name: string
  bodyMd: string
}

export interface AttachmentDto {
  id: string
  fileId: string
  kind: AttachmentKind
  caption: string | null
  applicationId: string | null
  originalName: string
  mime: string
  sizeBytes: number
  sha256: string
  createdAt: string
  deletedAt: string | null
}

export interface IntegrityReport {
  checkedFiles: number
  missing: Array<{ fileId: string; sha256: string; originalName: string }>
  corrupted: Array<{ fileId: string; sha256: string; originalName: string }>
  orphanFilesOnDisk: string[]
}

export interface SearchResult {
  entityType: 'application' | 'company' | 'contact' | 'note' | 'attachment'
  entityId: string
  title: string
  snippet: string
  /** Application the result belongs to, used for navigation (e.g. a note or attachment). */
  applicationId: string | null
}

export interface TrashItem {
  entityType: 'application' | 'company' | 'contact' | 'note' | 'attachment'
  id: string
  title: string
  subtitle: string | null
  deletedAt: string
  daysLeft: number
}

export interface BackupManifest {
  format: 'cam-backup'
  formatVersion: 1
  appVersion: string
  schemaVersion: string
  createdAt: string
  kind: 'manual' | 'auto' | 'pre-restore' | 'pre-migration'
  counts: Record<string, number>
  files: Array<{ path: string; sha256: string; size: number }>
}

export interface BackupInfo {
  path: string
  fileName: string
  kind: BackupManifest['kind']
  createdAt: string
  sizeBytes: number
}

export interface BackupVerification {
  ok: boolean
  manifest: BackupManifest | null
  problems: string[]
  integrityCheck: string | null
  foreignKeyViolations: number
  counts: Record<string, number>
  migrationsApplied: string[]
}

export interface AppInfo {
  version: string
  dataDir: string
  schemaVersion: string
  platform: string
}

export type CountsByTable = Record<string, number>
