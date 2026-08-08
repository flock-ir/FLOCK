PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  codename TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  phase TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT 'Unassigned',
  source TEXT NOT NULL DEFAULT 'Manual',
  created_at TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incident_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id TEXT NOT NULL,
  label TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  from_phase TEXT,
  to_phase TEXT,
  reason TEXT,
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size INTEGER NOT NULL DEFAULT 0,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uploaded_by TEXT NOT NULL DEFAULT 'Current responder',
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_incidents_phase ON incidents(phase);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_incident ON incident_tasks(incident_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_audit_incident ON audit_events(incident_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_incident ON evidence(incident_id, uploaded_at DESC);
