/**
 * Full data model (planning doc, section 8). Tables only used from V1.1 onward
 * (tasks, reminders, interviews, offers...) are created now so that the event
 * history recorded in V1.0 never needs a destructive migration later.
 *
 * Conventions: id = UUID v7 (TEXT); timestamps = UTC ISO 8601 TEXT;
 * money = integer cents + ISO 4217 currency + period; enums = TEXT with CHECK.
 */
import { sql, type SQL } from 'drizzle-orm'
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'
import {
  APPLICATION_STATUSES,
  ASSESSMENT_KINDS,
  ASSESSMENT_STATUSES,
  ATTACHMENT_KINDS,
  AUDIT_ACTIONS,
  CONTACT_ROLES,
  DIRECTIONS,
  DOCUMENT_KINDS,
  EMPLOYMENT_TYPES,
  EVENT_TYPES,
  GOAL_METRICS,
  GOAL_PERIODS,
  INTERVIEW_KINDS,
  INTERVIEW_RESULTS,
  INTERVIEW_STATUSES,
  NOTE_KINDS,
  OFFER_STATUSES,
  OUTCOMES,
  PAY_PERIODS,
  PRIORITIES,
  PROCESS_LANGUAGES,
  SENIORITIES,
  STAGE_CATEGORIES,
  TAG_KINDS,
  TASK_KINDS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  WORK_MODES
} from '../../shared/enums'

function oneOf(column: AnySQLiteColumn, values: readonly string[], nullable = true): SQL {
  const list = sql.raw(values.map((v) => `'${v}'`).join(', '))
  return nullable ? sql`${column} IS NULL OR ${column} IN (${list})` : sql`${column} IN (${list})`
}

const id = () => text('id').primaryKey()
const createdAt = () => text('created_at').notNull()
const updatedAt = () => text('updated_at').notNull()

export const companies = sqliteTable(
  'companies',
  {
    id: id(),
    name: text('name').notNull(),
    nameKey: text('name_key').notNull(),
    website: text('website'),
    industry: text('industry'),
    size: text('size'),
    country: text('country'),
    notes: text('notes'),
    archivedAt: text('archived_at'),
    deletedAt: text('deleted_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (t) => [
    uniqueIndex('companies_name_key_live_uq').on(t.nameKey).where(sql`deleted_at IS NULL`),
    check('companies_name_not_blank', sql`length(trim(${t.name})) > 0`)
  ]
)

export const contacts = sqliteTable(
  'contacts',
  {
    id: id(),
    name: text('name').notNull(),
    companyId: text('company_id').references(() => companies.id, { onDelete: 'set null' }),
    roleTitle: text('role_title'),
    email: text('email'),
    phone: text('phone'),
    linkedinUrl: text('linkedin_url'),
    keepInTouch: integer('keep_in_touch', { mode: 'boolean' }).notNull().default(false),
    notes: text('notes'),
    deletedAt: text('deleted_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (t) => [
    index('contacts_company_idx').on(t.companyId),
    check('contacts_name_not_blank', sql`length(trim(${t.name})) > 0`)
  ]
)

export const stages = sqliteTable(
  'stages',
  {
    id: id(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    sortHint: integer('sort_hint').notNull().default(0),
    color: text('color'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    isDefaultApplied: integer('is_default_applied', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (t) => [check('stages_category_chk', oneOf(t.category, STAGE_CATEGORIES, false))]
)

export const files = sqliteTable(
  'files',
  {
    id: id(),
    sha256: text('sha256').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    mime: text('mime').notNull(),
    originalName: text('original_name').notNull(),
    extractedText: text('extracted_text'),
    createdAt: createdAt()
  },
  (t) => [
    uniqueIndex('files_sha256_uq').on(t.sha256),
    check('files_sha256_len', sql`length(${t.sha256}) = 64`),
    check('files_size_chk', sql`${t.sizeBytes} >= 0`)
  ]
)

export const documents = sqliteTable(
  'documents',
  {
    id: id(),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    language: text('language'),
    archivedAt: text('archived_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (t) => [check('documents_kind_chk', oneOf(t.kind, DOCUMENT_KINDS, false))]
)

export const documentVersions = sqliteTable(
  'document_versions',
  {
    id: id(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'restrict' }),
    label: text('label').notNull(),
    fileId: text('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'restrict' }),
    changeNote: text('change_note'),
    archivedAt: text('archived_at'),
    createdAt: createdAt()
  },
  (t) => [uniqueIndex('document_versions_label_uq').on(t.documentId, t.label)]
)

export const applications = sqliteTable(
  'applications',
  {
    id: id(),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    seniority: text('seniority'),
    area: text('area'),
    jobUrl: text('job_url'),
    platform: text('platform').notNull(),
    channel: text('channel'),
    workMode: text('work_mode'),
    city: text('city'),
    country: text('country'),
    employmentType: text('employment_type'),
    postedSalaryMin: integer('posted_salary_min'),
    postedSalaryMax: integer('posted_salary_max'),
    postedCurrency: text('posted_currency'),
    postedPeriod: text('posted_period'),
    expectedSalary: integer('expected_salary'),
    expectedCurrency: text('expected_currency'),
    expectedPeriod: text('expected_period'),
    jobDescription: text('job_description'),
    requirementsRequired: text('requirements_required'),
    requirementsDesired: text('requirements_desired'),
    fitScore: integer('fit_score'),
    priority: text('priority').notNull().default('medium'),
    appliedAt: text('applied_at').notNull(),
    externalRef: text('external_ref'),
    processLanguage: text('process_language'),
    needsVisa: integer('needs_visa', { mode: 'boolean' }),
    relocationOffered: integer('relocation_offered', { mode: 'boolean' }),
    resumeVersionId: text('resume_version_id').references(() => documentVersions.id, {
      onDelete: 'restrict'
    }),
    coverLetterVersionId: text('cover_letter_version_id').references(() => documentVersions.id, {
      onDelete: 'restrict'
    }),
    coverLetterText: text('cover_letter_text'),
    responseDeadline: text('response_deadline'),
    previousApplicationId: text('previous_application_id').references((): AnySQLiteColumn => applications.id, {
      onDelete: 'set null'
    }),
    duplicatedFromId: text('duplicated_from_id').references((): AnySQLiteColumn => applications.id, {
      onDelete: 'set null'
    }),
    // Derived cache, always recomputed from events inside the same transaction.
    status: text('status').notNull().default('active'),
    outcome: text('outcome'),
    closeReason: text('close_reason'),
    currentStageId: text('current_stage_id').references(() => stages.id, { onDelete: 'restrict' }),
    lastInboundAt: text('last_inbound_at'),
    firstInboundAt: text('first_inbound_at'),
    lastActivityAt: text('last_activity_at'),
    archivedAt: text('archived_at'),
    deletedAt: text('deleted_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (t) => [
    index('applications_company_idx').on(t.companyId),
    index('applications_applied_at_idx').on(t.appliedAt),
    index('applications_status_idx').on(t.status),
    check('applications_title_not_blank', sql`length(trim(${t.title})) > 0`),
    check('applications_status_chk', oneOf(t.status, APPLICATION_STATUSES, false)),
    check('applications_outcome_chk', oneOf(t.outcome, OUTCOMES)),
    check(
      'applications_outcome_only_when_closed',
      sql`(${t.status} = 'closed') = (${t.outcome} IS NOT NULL)`
    ),
    check('applications_seniority_chk', oneOf(t.seniority, SENIORITIES)),
    check('applications_work_mode_chk', oneOf(t.workMode, WORK_MODES)),
    check('applications_employment_chk', oneOf(t.employmentType, EMPLOYMENT_TYPES)),
    check('applications_priority_chk', oneOf(t.priority, PRIORITIES, false)),
    check('applications_language_chk', oneOf(t.processLanguage, PROCESS_LANGUAGES)),
    check('applications_posted_period_chk', oneOf(t.postedPeriod, PAY_PERIODS)),
    check('applications_expected_period_chk', oneOf(t.expectedPeriod, PAY_PERIODS)),
    check('applications_fit_chk', sql`${t.fitScore} IS NULL OR ${t.fitScore} BETWEEN 1 AND 5`),
    check(
      'applications_posted_range_chk',
      sql`${t.postedSalaryMin} IS NULL OR ${t.postedSalaryMax} IS NULL OR ${t.postedSalaryMin} <= ${t.postedSalaryMax}`
    ),
    check(
      'applications_posted_currency_chk',
      sql`(${t.postedSalaryMin} IS NULL AND ${t.postedSalaryMax} IS NULL) OR length(${t.postedCurrency}) = 3`
    ),
    check(
      'applications_expected_currency_chk',
      sql`${t.expectedSalary} IS NULL OR length(${t.expectedCurrency}) = 3`
    )
  ]
)

export const applicationContacts = sqliteTable(
  'application_contacts',
  {
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: createdAt()
  },
  (t) => [
    primaryKey({ columns: [t.applicationId, t.contactId, t.role] }),
    index('application_contacts_contact_idx').on(t.contactId),
    check('application_contacts_role_chk', oneOf(t.role, CONTACT_ROLES, false))
  ]
)

export const interviews = sqliteTable(
  'interviews',
  {
    id: id(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'restrict' }),
    kind: text('kind').notNull(),
    round: integer('round').notNull().default(1),
    startsAt: text('starts_at').notNull(),
    endsAt: text('ends_at'),
    timezone: text('timezone'),
    locationOrLink: text('location_or_link'),
    status: text('status').notNull().default('scheduled'),
    result: text('result'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (t) => [
    index('interviews_application_idx').on(t.applicationId),
    check('interviews_kind_chk', oneOf(t.kind, INTERVIEW_KINDS, false)),
    check('interviews_status_chk', oneOf(t.status, INTERVIEW_STATUSES, false)),
    check('interviews_result_chk', oneOf(t.result, INTERVIEW_RESULTS))
  ]
)

export const interviewContacts = sqliteTable(
  'interview_contacts',
  {
    interviewId: text('interview_id')
      .notNull()
      .references(() => interviews.id, { onDelete: 'cascade' }),
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' })
  },
  (t) => [primaryKey({ columns: [t.interviewId, t.contactId] })]
)

export const assessments = sqliteTable(
  'assessments',
  {
    id: id(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'restrict' }),
    kind: text('kind').notNull(),
    receivedAt: text('received_at').notNull(),
    dueAt: text('due_at'),
    submittedAt: text('submitted_at'),
    link: text('link'),
    status: text('status').notNull().default('received'),
    result: text('result'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (t) => [
    index('assessments_application_idx').on(t.applicationId),
    check('assessments_kind_chk', oneOf(t.kind, ASSESSMENT_KINDS, false)),
    check('assessments_status_chk', oneOf(t.status, ASSESSMENT_STATUSES, false))
  ]
)

export const offers = sqliteTable(
  'offers',
  {
    id: id(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'restrict' }),
    version: integer('version').notNull().default(1),
    previousOfferId: text('previous_offer_id').references((): AnySQLiteColumn => offers.id, {
      onDelete: 'restrict'
    }),
    receivedAt: text('received_at').notNull(),
    employmentType: text('employment_type'),
    baseAmount: integer('base_amount'),
    currency: text('currency'),
    period: text('period'),
    bonus: text('bonus'),
    equity: text('equity'),
    benefits: text('benefits'),
    startDate: text('start_date'),
    deadline: text('deadline'),
    status: text('status').notNull().default('received'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (t) => [
    uniqueIndex('offers_version_uq').on(t.applicationId, t.version),
    check('offers_status_chk', oneOf(t.status, OFFER_STATUSES, false)),
    check('offers_period_chk', oneOf(t.period, PAY_PERIODS)),
    check('offers_employment_chk', oneOf(t.employmentType, EMPLOYMENT_TYPES)),
    check('offers_currency_chk', sql`${t.baseAmount} IS NULL OR length(${t.currency}) = 3`)
  ]
)

export const events = sqliteTable(
  'events',
  {
    id: id(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'restrict' }),
    type: text('type').notNull(),
    occurredAt: text('occurred_at').notNull(),
    recordedAt: text('recorded_at').notNull(),
    stageId: text('stage_id').references(() => stages.id, { onDelete: 'restrict' }),
    statusFrom: text('status_from'),
    statusTo: text('status_to'),
    outcome: text('outcome'),
    closeReason: text('close_reason'),
    direction: text('direction'),
    medium: text('medium'),
    contactId: text('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    summary: text('summary'),
    payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>(),
    interviewId: text('interview_id').references(() => interviews.id, { onDelete: 'restrict' }),
    assessmentId: text('assessment_id').references(() => assessments.id, { onDelete: 'restrict' }),
    offerId: text('offer_id').references(() => offers.id, { onDelete: 'restrict' }),
    voidedAt: text('voided_at'),
    voidReason: text('void_reason'),
    updatedAt: updatedAt()
  },
  (t) => [
    index('events_application_idx').on(t.applicationId, t.occurredAt),
    index('events_type_idx').on(t.type),
    check('events_type_chk', oneOf(t.type, EVENT_TYPES, false)),
    check('events_direction_chk', oneOf(t.direction, DIRECTIONS)),
    check('events_outcome_chk', oneOf(t.outcome, OUTCOMES)),
    check('events_stage_required', sql`${t.type} <> 'stage_changed' OR ${t.stageId} IS NOT NULL`),
    check('events_outcome_required', sql`${t.type} <> 'closed' OR ${t.outcome} IS NOT NULL`)
  ]
)

export const automationRules = sqliteTable('automation_rules', {
  id: id(),
  key: text('key').notNull().unique(),
  trigger: text('trigger').notNull(),
  offsetDays: integer('offset_days').notNull(),
  businessDays: integer('business_days', { mode: 'boolean' }).notNull().default(false),
  titleTemplate: text('title_template').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt()
})

export const tasks = sqliteTable(
  'tasks',
  {
    id: id(),
    title: text('title').notNull(),
    kind: text('kind').notNull().default('custom'),
    applicationId: text('application_id').references(() => applications.id, { onDelete: 'restrict' }),
    contactId: text('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    dueAt: text('due_at'),
    priority: text('priority').notNull().default('medium'),
    status: text('status').notNull().default('open'),
    completedAt: text('completed_at'),
    snoozedUntil: text('snoozed_until'),
    snoozeCount: integer('snooze_count').notNull().default(0),
    recurrence: text('recurrence', { mode: 'json' }).$type<Record<string, unknown>>(),
    ruleId: text('rule_id').references(() => automationRules.id, { onDelete: 'set null' }),
    triggerEventId: text('trigger_event_id').references(() => events.id, { onDelete: 'set null' }),
    dismissedAt: text('dismissed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (t) => [
    uniqueIndex('tasks_rule_trigger_uq').on(t.ruleId, t.triggerEventId),
    index('tasks_due_idx').on(t.status, t.dueAt),
    check('tasks_kind_chk', oneOf(t.kind, TASK_KINDS, false)),
    check('tasks_status_chk', oneOf(t.status, TASK_STATUSES, false)),
    check('tasks_priority_chk', oneOf(t.priority, TASK_PRIORITIES, false))
  ]
)

export const reminders = sqliteTable(
  'reminders',
  {
    id: id(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    remindAt: text('remind_at').notNull(),
    firedAt: text('fired_at'),
    acknowledgedAt: text('acknowledged_at'),
    createdAt: createdAt()
  },
  (t) => [index('reminders_due_idx').on(t.firedAt, t.remindAt)]
)

export const notes = sqliteTable(
  'notes',
  {
    id: id(),
    kind: text('kind').notNull().default('free'),
    title: text('title').notNull(),
    bodyMd: text('body_md').notNull().default(''),
    applicationId: text('application_id').references(() => applications.id, { onDelete: 'restrict' }),
    interviewId: text('interview_id').references(() => interviews.id, { onDelete: 'restrict' }),
    companyId: text('company_id').references(() => companies.id, { onDelete: 'restrict' }),
    contactId: text('contact_id').references(() => contacts.id, { onDelete: 'restrict' }),
    pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
    deletedAt: text('deleted_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (t) => [
    index('notes_application_idx').on(t.applicationId),
    index('notes_company_idx').on(t.companyId),
    index('notes_contact_idx').on(t.contactId),
    check('notes_kind_chk', oneOf(t.kind, NOTE_KINDS, false)),
    check(
      'notes_single_owner',
      sql`(${t.applicationId} IS NOT NULL) + (${t.interviewId} IS NOT NULL) + (${t.companyId} IS NOT NULL) + (${t.contactId} IS NOT NULL) <= 1`
    )
  ]
)

export const noteRevisions = sqliteTable(
  'note_revisions',
  {
    id: id(),
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    bodyMd: text('body_md').notNull(),
    savedAt: text('saved_at').notNull()
  },
  (t) => [index('note_revisions_note_idx').on(t.noteId, t.savedAt)]
)

export const noteTemplates = sqliteTable(
  'note_templates',
  {
    id: id(),
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    bodyMd: text('body_md').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (t) => [check('note_templates_kind_chk', oneOf(t.kind, NOTE_KINDS, false))]
)

export const attachments = sqliteTable(
  'attachments',
  {
    id: id(),
    fileId: text('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'restrict' }),
    kind: text('kind').notNull().default('other'),
    caption: text('caption'),
    applicationId: text('application_id').references(() => applications.id, { onDelete: 'restrict' }),
    interviewId: text('interview_id').references(() => interviews.id, { onDelete: 'restrict' }),
    assessmentId: text('assessment_id').references(() => assessments.id, { onDelete: 'restrict' }),
    offerId: text('offer_id').references(() => offers.id, { onDelete: 'restrict' }),
    deletedAt: text('deleted_at'),
    createdAt: createdAt()
  },
  (t) => [
    index('attachments_application_idx').on(t.applicationId),
    index('attachments_file_idx').on(t.fileId),
    check('attachments_kind_chk', oneOf(t.kind, ATTACHMENT_KINDS, false)),
    check(
      'attachments_exactly_one_owner',
      sql`(${t.applicationId} IS NOT NULL) + (${t.interviewId} IS NOT NULL) + (${t.assessmentId} IS NOT NULL) + (${t.offerId} IS NOT NULL) = 1`
    )
  ]
)

export const tags = sqliteTable(
  'tags',
  {
    id: id(),
    name: text('name').notNull(),
    kind: text('kind').notNull().default('general'),
    createdAt: createdAt()
  },
  (t) => [
    uniqueIndex('tags_name_kind_uq').on(t.name, t.kind),
    check('tags_kind_chk', oneOf(t.kind, TAG_KINDS, false))
  ]
)

export const taggings = sqliteTable(
  'taggings',
  {
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull()
  },
  (t) => [
    primaryKey({ columns: [t.tagId, t.entityType, t.entityId] }),
    index('taggings_entity_idx').on(t.entityType, t.entityId)
  ]
)

export const goals = sqliteTable(
  'goals',
  {
    id: id(),
    metric: text('metric').notNull(),
    period: text('period').notNull(),
    target: integer('target').notNull(),
    validFrom: text('valid_from').notNull(),
    validTo: text('valid_to'),
    createdAt: createdAt()
  },
  (t) => [
    check('goals_metric_chk', oneOf(t.metric, GOAL_METRICS, false)),
    check('goals_period_chk', oneOf(t.period, GOAL_PERIODS, false)),
    check('goals_target_chk', sql`${t.target} > 0`)
  ]
)

export const templates = sqliteTable('templates', {
  id: id(),
  name: text('name').notNull().unique(),
  defaults: text('defaults', { mode: 'json' }).notNull().$type<Record<string, unknown>>(),
  createdAt: createdAt(),
  updatedAt: updatedAt()
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<unknown>(),
  updatedAt: updatedAt()
})

export const listItems = sqliteTable(
  'list_items',
  {
    id: id(),
    listKey: text('list_key').notNull(),
    value: text('value').notNull(),
    label: text('label').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: createdAt()
  },
  (t) => [
    uniqueIndex('list_items_key_value_uq').on(t.listKey, t.value),
    check('list_items_key_chk', oneOf(t.listKey, ['platform', 'area', 'close_reason'], false))
  ]
)

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: id(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    changes: text('changes', { mode: 'json' }).$type<Record<string, [unknown, unknown]>>(),
    at: text('at').notNull()
  },
  (t) => [
    index('audit_log_entity_idx').on(t.entityType, t.entityId, t.at),
    check('audit_log_action_chk', oneOf(t.action, AUDIT_ACTIONS, false))
  ]
)
