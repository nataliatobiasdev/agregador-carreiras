// Stable enum values stored in the database. Labels shown to the user live in
// the renderer translation file (src/renderer/src/i18n/pt-BR.ts).

export const STAGE_CATEGORIES = ['applied', 'screening', 'interview', 'assessment', 'final', 'offer'] as const
export type StageCategory = (typeof STAGE_CATEGORIES)[number]

export const APPLICATION_STATUSES = ['active', 'paused', 'offer', 'closed'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const OUTCOMES = [
  'rejected',
  'no_response',
  'withdrew',
  'position_cancelled',
  'offer_declined',
  'offer_accepted'
] as const
export type Outcome = (typeof OUTCOMES)[number]

export const EVENT_TYPES = [
  'applied',
  'stage_changed',
  'interaction',
  'follow_up_sent',
  'interview_scheduled',
  'interview_done',
  'interview_cancelled',
  'assessment_received',
  'assessment_submitted',
  'feedback_received',
  'offer_received',
  'offer_updated',
  'paused',
  'resumed',
  'closed',
  'reopened',
  'note'
] as const
export type EventType = (typeof EVENT_TYPES)[number]

/** Event types the user can record directly from the application detail in V1.0. */
export const MANUAL_EVENT_TYPES = [
  'stage_changed',
  'interaction',
  'follow_up_sent',
  'feedback_received',
  'paused',
  'resumed',
  'closed',
  'reopened',
  'note'
] as const satisfies readonly EventType[]
export type ManualEventType = (typeof MANUAL_EVENT_TYPES)[number]

export const DIRECTIONS = ['in', 'out'] as const
export type Direction = (typeof DIRECTIONS)[number]

export const MEDIUMS = ['email', 'linkedin', 'phone', 'whatsapp', 'video_call', 'in_person', 'other'] as const
export type Medium = (typeof MEDIUMS)[number]

export const FEEDBACK_SENTIMENTS = ['positive', 'neutral', 'negative'] as const

export const SENIORITIES = [
  'intern',
  'junior',
  'mid',
  'senior',
  'specialist',
  'staff',
  'principal',
  'tech_lead',
  'manager'
] as const
export type Seniority = (typeof SENIORITIES)[number]

export const WORK_MODES = ['remote', 'hybrid', 'onsite'] as const
export const EMPLOYMENT_TYPES = ['clt', 'pj', 'contractor', 'internship', 'temporary', 'other'] as const
export const PRIORITIES = ['low', 'medium', 'high'] as const
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export const PAY_PERIODS = ['hour', 'month', 'year'] as const
export const PROCESS_LANGUAGES = ['pt', 'en', 'other'] as const

export const CONTACT_ROLES = ['recruiter', 'hiring_manager', 'interviewer', 'referral', 'reference'] as const
export type ContactRole = (typeof CONTACT_ROLES)[number]

export const NOTE_KINDS = [
  'free',
  'interview_prep',
  'interview_debrief',
  'company_insights',
  'company_research',
  'feedback',
  'recruiter_info',
  'study',
  'negotiation'
] as const
export type NoteKind = (typeof NOTE_KINDS)[number]

export const ATTACHMENT_KINDS = [
  'job_description',
  'application_proof',
  'recruiter_document',
  'prep_material',
  'assessment_brief',
  'deliverable',
  'offer',
  'other'
] as const
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number]

export const INTERVIEW_KINDS = [
  'hr',
  'technical',
  'live_coding',
  'system_design',
  'behavioral',
  'manager',
  'panel',
  'culture',
  'final',
  'other'
] as const
export const INTERVIEW_STATUSES = ['scheduled', 'done', 'cancelled', 'rescheduled', 'no_show'] as const
export const INTERVIEW_RESULTS = ['advanced', 'rejected', 'pending'] as const
export const ASSESSMENT_KINDS = ['take_home', 'platform', 'live'] as const
export const ASSESSMENT_STATUSES = ['received', 'in_progress', 'submitted', 'expired', 'declined'] as const
export const OFFER_STATUSES = [
  'received',
  'negotiating',
  'accepted',
  'declined',
  'expired',
  'withdrawn'
] as const
export const TASK_KINDS = [
  'follow_up_application',
  'follow_up_interview',
  'interview_prep',
  'assessment_deadline',
  'document_delivery',
  'reply_company',
  'reconnect',
  'custom'
] as const
export const TASK_STATUSES = ['suggested', 'open', 'done', 'cancelled'] as const
export const DOCUMENT_KINDS = ['resume', 'cover_letter', 'portfolio', 'other'] as const
export const TAG_KINDS = ['skill', 'general'] as const
export const GOAL_METRICS = ['applications', 'follow_ups', 'interviews'] as const
export const GOAL_PERIODS = ['week', 'month'] as const
export const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'restore',
  'void',
  'archive',
  'unarchive'
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const ENTITY_TYPES = [
  'application',
  'company',
  'contact',
  'note',
  'attachment',
  'event',
  'stage'
] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

/** Editable lists (platforms, areas, close reasons) live in the list_items table. */
export const LIST_KEYS = ['platform', 'area', 'close_reason'] as const
export type ListKey = (typeof LIST_KEYS)[number]
