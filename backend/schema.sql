-- PostgreSQL/Supabase schema. No seeded records or foreign-key constraints.
CREATE TABLE IF NOT EXISTS settings (
  id_setting TEXT PRIMARY KEY,
  weekly_commitment_minutes INTEGER NOT NULL,
  weekly_buffer_minutes INTEGER NOT NULL,
  weekly_revision_minutes INTEGER NOT NULL DEFAULT 0,
  week_start_day TEXT NOT NULL,
  notification_preferences TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS focus_areas (
  id_focus_area TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  curriculum_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
);

CREATE TABLE IF NOT EXISTS subtopics (
  id_subtopic TEXT PRIMARY KEY,
  id_focus_area TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
);

CREATE TABLE IF NOT EXISTS sessions (
  id_session TEXT PRIMARY KEY,
  id_focus_area TEXT,
  id_subtopic TEXT,
  subtopic_name TEXT,
  date TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  outcome TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
);

CREATE INDEX IF NOT EXISTS subtopics_focus_area ON subtopics(id_focus_area);
CREATE INDEX IF NOT EXISTS sessions_focus_area ON sessions(id_focus_area);
CREATE INDEX IF NOT EXISTS sessions_subtopic ON sessions(id_subtopic);


ALTER TABLE focus_areas DROP COLUMN IF EXISTS archived_at;

CREATE TABLE IF NOT EXISTS objective_preferences (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled BOOLEAN NOT NULL
);
CREATE TABLE IF NOT EXISTS objectives (
  id_objective TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  motivation TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')),
  status TEXT NOT NULL CHECK (status IN ('Active', 'Archived', 'Achieved')),
  target_date TEXT,
  success_criteria TEXT NOT NULL DEFAULT '',
  achieved_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS objective_focus_areas (
  id_objective TEXT NOT NULL REFERENCES objectives(id_objective) ON DELETE CASCADE,
  id_focus_area TEXT NOT NULL REFERENCES focus_areas(id_focus_area) ON DELETE CASCADE,
  PRIMARY KEY (id_objective, id_focus_area)
);

CREATE TABLE IF NOT EXISTS objective_subtopics (
  id_objective TEXT NOT NULL REFERENCES objectives(id_objective) ON DELETE CASCADE,
  id_subtopic TEXT NOT NULL REFERENCES subtopics(id_subtopic) ON DELETE CASCADE,
  PRIMARY KEY (id_objective, id_subtopic)
);

CREATE TABLE IF NOT EXISTS objective_sessions (
  id_objective TEXT NOT NULL REFERENCES objectives(id_objective) ON DELETE CASCADE,
  id_session TEXT NOT NULL REFERENCES sessions(id_session) ON DELETE CASCADE,
  PRIMARY KEY (id_objective, id_session)
);
