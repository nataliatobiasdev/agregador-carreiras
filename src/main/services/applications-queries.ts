export const APPLICATION_LIST_COLUMNS = `a.id, a.company_id AS companyId, c.name AS companyName, a.title, a.platform, a.seniority, a.area,
       a.work_mode AS workMode, a.priority, a.fit_score AS fitScore, a.applied_at AS appliedAt, a.status, a.outcome,
       a.current_stage_id AS currentStageId, s.name AS stageName, s.category AS stageCategory,
       a.last_activity_at AS lastActivityAt, a.last_inbound_at AS lastInboundAt, a.archived_at AS archivedAt`

export const APPLICATION_LIST_FROM = `FROM applications a
  JOIN companies c ON c.id = a.company_id
  LEFT JOIN stages s ON s.id = a.current_stage_id`
