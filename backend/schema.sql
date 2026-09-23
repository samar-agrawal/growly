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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  completed_at TEXT,
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
