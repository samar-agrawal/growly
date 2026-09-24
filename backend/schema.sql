CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  timezone TEXT NOT NULL,
  weekly_commitment_minutes INTEGER NOT NULL,
  weekly_buffer_minutes INTEGER NOT NULL,
  revision_slots INTEGER NOT NULL,
  week_start_day TEXT NOT NULL,
  notification_preferences TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  curriculum_enabled INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  category_id TEXT,
  topic_id TEXT,
  topic_name TEXT,
  date TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  session_type TEXT NOT NULL,
  outcome TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (topic_id) REFERENCES topics(id)
);

-- Keep session history when organizing or removing learning items.
CREATE TRIGGER IF NOT EXISTS category_delete_history
BEFORE DELETE ON categories
BEGIN
  UPDATE sessions SET category_id = NULL, topic_id = NULL, topic_name = NULL
    WHERE category_id = OLD.id OR topic_id IN (SELECT id FROM topics WHERE category_id = OLD.id);
  DELETE FROM topics WHERE category_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS topic_delete_history
BEFORE DELETE ON topics
BEGIN
  UPDATE sessions SET topic_id = NULL, topic_name = NULL WHERE topic_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS topic_update_history
AFTER UPDATE OF name, category_id ON topics
BEGIN
  UPDATE sessions SET topic_name = NEW.name, category_id = NEW.category_id WHERE topic_id = NEW.id;
END;
