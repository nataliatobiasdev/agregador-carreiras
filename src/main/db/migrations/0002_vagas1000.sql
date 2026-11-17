CREATE TABLE vagas1000_inbox (
  job_key TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  added_at TEXT NOT NULL,
  application_id TEXT REFERENCES applications(id) ON DELETE SET NULL
);
