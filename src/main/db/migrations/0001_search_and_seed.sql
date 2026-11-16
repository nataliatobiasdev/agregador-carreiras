-- Full-text search index, maintained by the services in the same transaction as each write.
CREATE VIRTUAL TABLE `search_index` USING fts5(
	entity_type UNINDEXED,
	entity_id UNINDEXED,
	title,
	body,
	tokenize = 'unicode61 remove_diacritics 2'
);
--> statement-breakpoint
-- Audit log is append-only.
CREATE TRIGGER `audit_log_no_update` BEFORE UPDATE ON `audit_log`
BEGIN
	SELECT RAISE(ABORT, 'audit_log is append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `audit_log_no_delete` BEFORE DELETE ON `audit_log`
BEGIN
	SELECT RAISE(ABORT, 'audit_log is append-only');
END;
--> statement-breakpoint
-- A document version referenced by an application keeps its file forever.
CREATE TRIGGER `document_versions_immutable_when_used` BEFORE UPDATE OF `file_id` ON `document_versions`
WHEN EXISTS (
	SELECT 1 FROM `applications`
	WHERE `resume_version_id` = OLD.`id` OR `cover_letter_version_id` = OLD.`id`
)
BEGIN
	SELECT RAISE(ABORT, 'document version in use is immutable');
END;
--> statement-breakpoint
-- Default stages (planning doc, section 3.1)
INSERT INTO `stages` (`id`, `name`, `category`, `sort_hint`, `color`, `active`, `is_default_applied`, `created_at`, `updated_at`) VALUES
	('stage-applied', 'Candidatura enviada', 'applied', 10, '#64748b', 1, 1, '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('stage-hr-contact', 'Contato do RH', 'screening', 20, '#0ea5e9', 1, 0, '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('stage-hr-interview', 'Entrevista RH', 'screening', 30, '#0284c7', 1, 0, '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('stage-assessment', 'Teste técnico', 'assessment', 40, '#a855f7', 1, 0, '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('stage-tech-interview', 'Entrevista técnica', 'interview', 50, '#6366f1', 1, 0, '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('stage-system-design', 'System design', 'interview', 60, '#4f46e5', 1, 0, '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('stage-manager', 'Entrevista com gestor', 'interview', 70, '#4338ca', 1, 0, '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('stage-final', 'Entrevista final', 'final', 80, '#f59e0b', 1, 0, '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('stage-offer', 'Proposta', 'offer', 90, '#16a34a', 1, 0, '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z');
--> statement-breakpoint
-- Editable lists (section 2.1 and 3.1)
INSERT INTO `list_items` (`id`, `list_key`, `value`, `label`, `sort_order`, `active`, `created_at`) VALUES
	('li-platform-linkedin', 'platform', 'linkedin', 'LinkedIn', 10, 1, '2026-11-16T00:00:00.000Z'),
	('li-platform-linkedin-easy', 'platform', 'linkedin_easy_apply', 'LinkedIn Easy Apply', 20, 1, '2026-11-16T00:00:00.000Z'),
	('li-platform-company-site', 'platform', 'company_site', 'Site da empresa', 30, 1, '2026-11-16T00:00:00.000Z'),
	('li-platform-gupy', 'platform', 'gupy', 'Gupy', 40, 1, '2026-11-16T00:00:00.000Z'),
	('li-platform-greenhouse', 'platform', 'greenhouse', 'Greenhouse', 50, 1, '2026-11-16T00:00:00.000Z'),
	('li-platform-lever', 'platform', 'lever', 'Lever', 60, 1, '2026-11-16T00:00:00.000Z'),
	('li-platform-workday', 'platform', 'workday', 'Workday', 70, 1, '2026-11-16T00:00:00.000Z'),
	('li-platform-email', 'platform', 'email', 'E-mail', 80, 1, '2026-11-16T00:00:00.000Z'),
	('li-platform-referral', 'platform', 'referral', 'Indicação', 90, 1, '2026-11-16T00:00:00.000Z'),
	('li-platform-other', 'platform', 'other', 'Outro', 100, 1, '2026-11-16T00:00:00.000Z'),
	('li-area-backend', 'area', 'backend', 'Backend', 10, 1, '2026-11-16T00:00:00.000Z'),
	('li-area-frontend', 'area', 'frontend', 'Frontend', 20, 1, '2026-11-16T00:00:00.000Z'),
	('li-area-fullstack', 'area', 'full_stack', 'Full stack', 30, 1, '2026-11-16T00:00:00.000Z'),
	('li-area-data', 'area', 'data', 'Dados', 40, 1, '2026-11-16T00:00:00.000Z'),
	('li-area-architecture', 'area', 'architecture', 'Arquitetura', 50, 1, '2026-11-16T00:00:00.000Z'),
	('li-area-tech-lead', 'area', 'tech_leadership', 'Liderança técnica', 60, 1, '2026-11-16T00:00:00.000Z'),
	('li-reason-salary', 'close_reason', 'salary', 'Salário', 10, 1, '2026-11-16T00:00:00.000Z'),
	('li-reason-seniority', 'close_reason', 'seniority', 'Senioridade', 20, 1, '2026-11-16T00:00:00.000Z'),
	('li-reason-stack', 'close_reason', 'stack', 'Stack', 30, 1, '2026-11-16T00:00:00.000Z'),
	('li-reason-work-mode', 'close_reason', 'work_mode', 'Modalidade', 40, 1, '2026-11-16T00:00:00.000Z'),
	('li-reason-other-process', 'close_reason', 'other_process', 'Outro processo avançou', 50, 1, '2026-11-16T00:00:00.000Z'),
	('li-reason-culture', 'close_reason', 'culture_fit', 'Fit cultural', 60, 1, '2026-11-16T00:00:00.000Z'),
	('li-reason-no-feedback', 'close_reason', 'no_feedback', 'Sem feedback', 70, 1, '2026-11-16T00:00:00.000Z'),
	('li-reason-other', 'close_reason', 'other', 'Outro', 80, 1, '2026-11-16T00:00:00.000Z');
--> statement-breakpoint
-- Note templates (section 4.3, plus the company research checklist from section 15)
INSERT INTO `note_templates` (`id`, `kind`, `name`, `body_md`, `created_at`, `updated_at`) VALUES
	('nt-free', 'free', 'Livre', '', '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('nt-interview-prep', 'interview_prep', 'Preparação para entrevista', '## Sobre a empresa, produto e stack

## Perguntas que espero

## Minhas histórias para usar

## Perguntas para fazer
- [ ] ', '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('nt-interview-debrief', 'interview_debrief', 'Debrief de entrevista', '## Entrevistadores

## Perguntas feitas

## O que respondi

## O que foi bem

## O que faltou

## Sinais de interesse
', '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('nt-company-insights', 'company_insights', 'Percepções sobre a empresa', '## Cultura

## Time

## Sinais positivos

## Sinais de alerta
', '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('nt-company-research', 'company_research', 'Pesquisa da empresa', '- [ ] Produto e clientes
- [ ] Stack conhecida
- [ ] Tamanho do time
- [ ] Estágio e investimento
- [ ] Notícias recentes
- [ ] Avaliações (Glassdoor, etc.)
', '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('nt-feedback', 'feedback', 'Feedback recebido', '## Fonte

## Conteúdo literal

## Ação a tomar
', '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('nt-recruiter-info', 'recruiter_info', 'Informações do recrutador', '## Faixa salarial

## Processo e etapas

## Prazos

## Benefícios

## Próximos passos
', '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('nt-study', 'study', 'Pontos para estudar', '- [ ] Tópico — link para material
', '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('nt-negotiation', 'negotiation', 'Negociação e expectativas', '## Mínimo aceitável

## Alvo

## Argumentos

## Histórico de valores
', '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z');
--> statement-breakpoint
-- Automation rules (section 5.2). Used from V1.1; seeded now so the schema is complete.
INSERT INTO `automation_rules` (`id`, `key`, `trigger`, `offset_days`, `business_days`, `title_template`, `enabled`, `created_at`, `updated_at`) VALUES
	('rule-follow-up', 'follow_up_application', 'no_inbound_since_applied_or_follow_up', 7, 0, 'Follow-up com {empresa}', 1, '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('rule-thank-you', 'thank_you_after_interview', 'interview_done', 1, 1, 'Enviar agradecimento a {entrevistador}', 1, '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('rule-chase', 'chase_after_interview', 'interview_done_no_inbound', 5, 1, 'Pedir retorno a {empresa}', 1, '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('rule-prepare', 'prepare_interview', 'interview_scheduled', -2, 0, 'Preparar entrevista {tipo} na {empresa}', 1, '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('rule-assessment', 'assessment_deadline', 'assessment_received_with_due', -1, 0, 'Entregar teste da {empresa}', 1, '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('rule-offer', 'offer_deadline', 'offer_received_with_deadline', -2, 0, 'Responder proposta da {empresa}', 1, '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('rule-response-deadline', 'response_deadline', 'response_deadline', 0, 0, '{empresa} disse que responderia hoje', 1, '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('rule-close', 'suggest_close', 'no_inbound', 30, 0, 'Encerrar {empresa} como sem resposta?', 1, '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z'),
	('rule-reconnect', 'reconnect_contact', 'keep_in_touch_no_interaction', 60, 0, 'Retomar contato com {nome}', 1, '2026-11-16T00:00:00.000Z', '2026-11-16T00:00:00.000Z');
