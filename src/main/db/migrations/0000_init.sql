CREATE TABLE `application_contacts` (
	`application_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`application_id`, `contact_id`, `role`),
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "application_contacts_role_chk" CHECK("application_contacts"."role" IN ('recruiter', 'hiring_manager', 'interviewer', 'referral', 'reference'))
);
--> statement-breakpoint
CREATE INDEX `application_contacts_contact_idx` ON `application_contacts` (`contact_id`);--> statement-breakpoint
CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`title` text NOT NULL,
	`seniority` text,
	`area` text,
	`job_url` text,
	`platform` text NOT NULL,
	`channel` text,
	`work_mode` text,
	`city` text,
	`country` text,
	`employment_type` text,
	`posted_salary_min` integer,
	`posted_salary_max` integer,
	`posted_currency` text,
	`posted_period` text,
	`expected_salary` integer,
	`expected_currency` text,
	`expected_period` text,
	`job_description` text,
	`requirements_required` text,
	`requirements_desired` text,
	`fit_score` integer,
	`priority` text DEFAULT 'medium' NOT NULL,
	`applied_at` text NOT NULL,
	`external_ref` text,
	`process_language` text,
	`needs_visa` integer,
	`relocation_offered` integer,
	`resume_version_id` text,
	`cover_letter_version_id` text,
	`cover_letter_text` text,
	`response_deadline` text,
	`previous_application_id` text,
	`duplicated_from_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`outcome` text,
	`close_reason` text,
	`current_stage_id` text,
	`last_inbound_at` text,
	`first_inbound_at` text,
	`last_activity_at` text,
	`archived_at` text,
	`deleted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`resume_version_id`) REFERENCES `document_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`cover_letter_version_id`) REFERENCES `document_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`previous_application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`duplicated_from_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`current_stage_id`) REFERENCES `stages`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "applications_title_not_blank" CHECK(length(trim("applications"."title")) > 0),
	CONSTRAINT "applications_status_chk" CHECK("applications"."status" IN ('active', 'paused', 'offer', 'closed')),
	CONSTRAINT "applications_outcome_chk" CHECK("applications"."outcome" IS NULL OR "applications"."outcome" IN ('rejected', 'no_response', 'withdrew', 'position_cancelled', 'offer_declined', 'offer_accepted')),
	CONSTRAINT "applications_outcome_only_when_closed" CHECK(("applications"."status" = 'closed') = ("applications"."outcome" IS NOT NULL)),
	CONSTRAINT "applications_seniority_chk" CHECK("applications"."seniority" IS NULL OR "applications"."seniority" IN ('intern', 'junior', 'mid', 'senior', 'specialist', 'staff', 'principal', 'tech_lead', 'manager')),
	CONSTRAINT "applications_work_mode_chk" CHECK("applications"."work_mode" IS NULL OR "applications"."work_mode" IN ('remote', 'hybrid', 'onsite')),
	CONSTRAINT "applications_employment_chk" CHECK("applications"."employment_type" IS NULL OR "applications"."employment_type" IN ('clt', 'pj', 'contractor', 'internship', 'temporary', 'other')),
	CONSTRAINT "applications_priority_chk" CHECK("applications"."priority" IN ('low', 'medium', 'high')),
	CONSTRAINT "applications_language_chk" CHECK("applications"."process_language" IS NULL OR "applications"."process_language" IN ('pt', 'en', 'other')),
	CONSTRAINT "applications_posted_period_chk" CHECK("applications"."posted_period" IS NULL OR "applications"."posted_period" IN ('hour', 'month', 'year')),
	CONSTRAINT "applications_expected_period_chk" CHECK("applications"."expected_period" IS NULL OR "applications"."expected_period" IN ('hour', 'month', 'year')),
	CONSTRAINT "applications_fit_chk" CHECK("applications"."fit_score" IS NULL OR "applications"."fit_score" BETWEEN 1 AND 5),
	CONSTRAINT "applications_posted_range_chk" CHECK("applications"."posted_salary_min" IS NULL OR "applications"."posted_salary_max" IS NULL OR "applications"."posted_salary_min" <= "applications"."posted_salary_max"),
	CONSTRAINT "applications_posted_currency_chk" CHECK(("applications"."posted_salary_min" IS NULL AND "applications"."posted_salary_max" IS NULL) OR length("applications"."posted_currency") = 3),
	CONSTRAINT "applications_expected_currency_chk" CHECK("applications"."expected_salary" IS NULL OR length("applications"."expected_currency") = 3)
);
--> statement-breakpoint
CREATE INDEX `applications_company_idx` ON `applications` (`company_id`);--> statement-breakpoint
CREATE INDEX `applications_applied_at_idx` ON `applications` (`applied_at`);--> statement-breakpoint
CREATE INDEX `applications_status_idx` ON `applications` (`status`);--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`kind` text NOT NULL,
	`received_at` text NOT NULL,
	`due_at` text,
	`submitted_at` text,
	`link` text,
	`status` text DEFAULT 'received' NOT NULL,
	`result` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "assessments_kind_chk" CHECK("assessments"."kind" IN ('take_home', 'platform', 'live')),
	CONSTRAINT "assessments_status_chk" CHECK("assessments"."status" IN ('received', 'in_progress', 'submitted', 'expired', 'declined'))
);
--> statement-breakpoint
CREATE INDEX `assessments_application_idx` ON `assessments` (`application_id`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`kind` text DEFAULT 'other' NOT NULL,
	`caption` text,
	`application_id` text,
	`interview_id` text,
	`assessment_id` text,
	`offer_id` text,
	`deleted_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "attachments_kind_chk" CHECK("attachments"."kind" IN ('job_description', 'application_proof', 'recruiter_document', 'prep_material', 'assessment_brief', 'deliverable', 'offer', 'other')),
	CONSTRAINT "attachments_exactly_one_owner" CHECK(("attachments"."application_id" IS NOT NULL) + ("attachments"."interview_id" IS NOT NULL) + ("attachments"."assessment_id" IS NOT NULL) + ("attachments"."offer_id" IS NOT NULL) = 1)
);
--> statement-breakpoint
CREATE INDEX `attachments_application_idx` ON `attachments` (`application_id`);--> statement-breakpoint
CREATE INDEX `attachments_file_idx` ON `attachments` (`file_id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`changes` text,
	`at` text NOT NULL,
	CONSTRAINT "audit_log_action_chk" CHECK("audit_log"."action" IN ('create', 'update', 'delete', 'restore', 'void', 'archive', 'unarchive'))
);
--> statement-breakpoint
CREATE INDEX `audit_log_entity_idx` ON `audit_log` (`entity_type`,`entity_id`,`at`);--> statement-breakpoint
CREATE TABLE `automation_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`trigger` text NOT NULL,
	`offset_days` integer NOT NULL,
	`business_days` integer DEFAULT false NOT NULL,
	`title_template` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `automation_rules_key_unique` ON `automation_rules` (`key`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`website` text,
	`industry` text,
	`size` text,
	`country` text,
	`notes` text,
	`archived_at` text,
	`deleted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "companies_name_not_blank" CHECK(length(trim("companies"."name")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_name_key_live_uq` ON `companies` (`name_key`) WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`company_id` text,
	`role_title` text,
	`email` text,
	`phone` text,
	`linkedin_url` text,
	`keep_in_touch` integer DEFAULT false NOT NULL,
	`notes` text,
	`deleted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "contacts_name_not_blank" CHECK(length(trim("contacts"."name")) > 0)
);
--> statement-breakpoint
CREATE INDEX `contacts_company_idx` ON `contacts` (`company_id`);--> statement-breakpoint
CREATE TABLE `document_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`label` text NOT NULL,
	`file_id` text NOT NULL,
	`change_note` text,
	`archived_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_versions_label_uq` ON `document_versions` (`document_id`,`label`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`language` text,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "documents_kind_chk" CHECK("documents"."kind" IN ('resume', 'cover_letter', 'portfolio', 'other'))
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`type` text NOT NULL,
	`occurred_at` text NOT NULL,
	`recorded_at` text NOT NULL,
	`stage_id` text,
	`status_from` text,
	`status_to` text,
	`outcome` text,
	`close_reason` text,
	`direction` text,
	`medium` text,
	`contact_id` text,
	`summary` text,
	`payload` text,
	`interview_id` text,
	`assessment_id` text,
	`offer_id` text,
	`voided_at` text,
	`void_reason` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`stage_id`) REFERENCES `stages`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "events_type_chk" CHECK("events"."type" IN ('applied', 'stage_changed', 'interaction', 'follow_up_sent', 'interview_scheduled', 'interview_done', 'interview_cancelled', 'assessment_received', 'assessment_submitted', 'feedback_received', 'offer_received', 'offer_updated', 'paused', 'resumed', 'closed', 'reopened', 'note')),
	CONSTRAINT "events_direction_chk" CHECK("events"."direction" IS NULL OR "events"."direction" IN ('in', 'out')),
	CONSTRAINT "events_outcome_chk" CHECK("events"."outcome" IS NULL OR "events"."outcome" IN ('rejected', 'no_response', 'withdrew', 'position_cancelled', 'offer_declined', 'offer_accepted')),
	CONSTRAINT "events_stage_required" CHECK("events"."type" <> 'stage_changed' OR "events"."stage_id" IS NOT NULL),
	CONSTRAINT "events_outcome_required" CHECK("events"."type" <> 'closed' OR "events"."outcome" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `events_application_idx` ON `events` (`application_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `events_type_idx` ON `events` (`type`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`sha256` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`mime` text NOT NULL,
	`original_name` text NOT NULL,
	`extracted_text` text,
	`created_at` text NOT NULL,
	CONSTRAINT "files_sha256_len" CHECK(length("files"."sha256") = 64),
	CONSTRAINT "files_size_chk" CHECK("files"."size_bytes" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_sha256_uq` ON `files` (`sha256`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`metric` text NOT NULL,
	`period` text NOT NULL,
	`target` integer NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	`created_at` text NOT NULL,
	CONSTRAINT "goals_metric_chk" CHECK("goals"."metric" IN ('applications', 'follow_ups', 'interviews')),
	CONSTRAINT "goals_period_chk" CHECK("goals"."period" IN ('week', 'month')),
	CONSTRAINT "goals_target_chk" CHECK("goals"."target" > 0)
);
--> statement-breakpoint
CREATE TABLE `interview_contacts` (
	`interview_id` text NOT NULL,
	`contact_id` text NOT NULL,
	PRIMARY KEY(`interview_id`, `contact_id`),
	FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `interviews` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`kind` text NOT NULL,
	`round` integer DEFAULT 1 NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`timezone` text,
	`location_or_link` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`result` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "interviews_kind_chk" CHECK("interviews"."kind" IN ('hr', 'technical', 'live_coding', 'system_design', 'behavioral', 'manager', 'panel', 'culture', 'final', 'other')),
	CONSTRAINT "interviews_status_chk" CHECK("interviews"."status" IN ('scheduled', 'done', 'cancelled', 'rescheduled', 'no_show')),
	CONSTRAINT "interviews_result_chk" CHECK("interviews"."result" IS NULL OR "interviews"."result" IN ('advanced', 'rejected', 'pending'))
);
--> statement-breakpoint
CREATE INDEX `interviews_application_idx` ON `interviews` (`application_id`);--> statement-breakpoint
CREATE TABLE `list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`list_key` text NOT NULL,
	`value` text NOT NULL,
	`label` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "list_items_key_chk" CHECK("list_items"."list_key" IN ('platform', 'area', 'close_reason'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `list_items_key_value_uq` ON `list_items` (`list_key`,`value`);--> statement-breakpoint
CREATE TABLE `note_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`title` text NOT NULL,
	`body_md` text NOT NULL,
	`saved_at` text NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_revisions_note_idx` ON `note_revisions` (`note_id`,`saved_at`);--> statement-breakpoint
CREATE TABLE `note_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`body_md` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "note_templates_kind_chk" CHECK("note_templates"."kind" IN ('free', 'interview_prep', 'interview_debrief', 'company_insights', 'company_research', 'feedback', 'recruiter_info', 'study', 'negotiation'))
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text DEFAULT 'free' NOT NULL,
	`title` text NOT NULL,
	`body_md` text DEFAULT '' NOT NULL,
	`application_id` text,
	`interview_id` text,
	`company_id` text,
	`contact_id` text,
	`pinned` integer DEFAULT false NOT NULL,
	`deleted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`interview_id`) REFERENCES `interviews`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "notes_kind_chk" CHECK("notes"."kind" IN ('free', 'interview_prep', 'interview_debrief', 'company_insights', 'company_research', 'feedback', 'recruiter_info', 'study', 'negotiation')),
	CONSTRAINT "notes_single_owner" CHECK(("notes"."application_id" IS NOT NULL) + ("notes"."interview_id" IS NOT NULL) + ("notes"."company_id" IS NOT NULL) + ("notes"."contact_id" IS NOT NULL) <= 1)
);
--> statement-breakpoint
CREATE INDEX `notes_application_idx` ON `notes` (`application_id`);--> statement-breakpoint
CREATE INDEX `notes_company_idx` ON `notes` (`company_id`);--> statement-breakpoint
CREATE INDEX `notes_contact_idx` ON `notes` (`contact_id`);--> statement-breakpoint
CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`previous_offer_id` text,
	`received_at` text NOT NULL,
	`employment_type` text,
	`base_amount` integer,
	`currency` text,
	`period` text,
	`bonus` text,
	`equity` text,
	`benefits` text,
	`start_date` text,
	`deadline` text,
	`status` text DEFAULT 'received' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`previous_offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "offers_status_chk" CHECK("offers"."status" IN ('received', 'negotiating', 'accepted', 'declined', 'expired', 'withdrawn')),
	CONSTRAINT "offers_period_chk" CHECK("offers"."period" IS NULL OR "offers"."period" IN ('hour', 'month', 'year')),
	CONSTRAINT "offers_employment_chk" CHECK("offers"."employment_type" IS NULL OR "offers"."employment_type" IN ('clt', 'pj', 'contractor', 'internship', 'temporary', 'other')),
	CONSTRAINT "offers_currency_chk" CHECK("offers"."base_amount" IS NULL OR length("offers"."currency") = 3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offers_version_uq` ON `offers` (`application_id`,`version`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`remind_at` text NOT NULL,
	`fired_at` text,
	`acknowledged_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reminders_due_idx` ON `reminders` (`fired_at`,`remind_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`sort_hint` integer DEFAULT 0 NOT NULL,
	`color` text,
	`active` integer DEFAULT true NOT NULL,
	`is_default_applied` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "stages_category_chk" CHECK("stages"."category" IN ('applied', 'screening', 'interview', 'assessment', 'final', 'offer'))
);
--> statement-breakpoint
CREATE TABLE `taggings` (
	`tag_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	PRIMARY KEY(`tag_id`, `entity_type`, `entity_id`),
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `taggings_entity_idx` ON `taggings` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'general' NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "tags_kind_chk" CHECK("tags"."kind" IN ('skill', 'general'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_kind_uq` ON `tags` (`name`,`kind`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`kind` text DEFAULT 'custom' NOT NULL,
	`application_id` text,
	`contact_id` text,
	`due_at` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`completed_at` text,
	`snoozed_until` text,
	`snooze_count` integer DEFAULT 0 NOT NULL,
	`recurrence` text,
	`rule_id` text,
	`trigger_event_id` text,
	`dismissed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`rule_id`) REFERENCES `automation_rules`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`trigger_event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "tasks_kind_chk" CHECK("tasks"."kind" IN ('follow_up_application', 'follow_up_interview', 'interview_prep', 'assessment_deadline', 'document_delivery', 'reply_company', 'reconnect', 'custom')),
	CONSTRAINT "tasks_status_chk" CHECK("tasks"."status" IN ('suggested', 'open', 'done', 'cancelled')),
	CONSTRAINT "tasks_priority_chk" CHECK("tasks"."priority" IN ('low', 'medium', 'high', 'urgent'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_rule_trigger_uq` ON `tasks` (`rule_id`,`trigger_event_id`);--> statement-breakpoint
CREATE INDEX `tasks_due_idx` ON `tasks` (`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`defaults` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `templates_name_unique` ON `templates` (`name`);