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
  archived_at TEXT,
  updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subtopics (
  id_subtopic TEXT PRIMARY KEY,
  id_focus_area TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS subtopics_focus_area ON subtopics(id_focus_area);
CREATE INDEX IF NOT EXISTS sessions_focus_area ON sessions(id_focus_area);
CREATE INDEX IF NOT EXISTS sessions_subtopic ON sessions(id_subtopic);

-- Preserve session history when organizing or removing learning items.
CREATE TRIGGER IF NOT EXISTS focus_area_delete_history
BEFORE DELETE ON focus_areas
BEGIN
  UPDATE sessions SET id_focus_area = NULL, id_subtopic = NULL, subtopic_name = NULL
    WHERE id_focus_area = OLD.id_focus_area OR id_subtopic IN (SELECT id_subtopic FROM subtopics WHERE id_focus_area = OLD.id_focus_area);
  DELETE FROM subtopics WHERE id_focus_area = OLD.id_focus_area;
END;

CREATE TRIGGER IF NOT EXISTS subtopic_delete_history
BEFORE DELETE ON subtopics
BEGIN
  UPDATE sessions SET id_subtopic = NULL, subtopic_name = NULL WHERE id_subtopic = OLD.id_subtopic;
END;

CREATE TRIGGER IF NOT EXISTS subtopic_update_history
AFTER UPDATE OF name, id_focus_area ON subtopics
BEGIN
  UPDATE sessions SET subtopic_name = NEW.name, id_focus_area = NEW.id_focus_area WHERE id_subtopic = NEW.id_subtopic;
END;
