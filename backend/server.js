const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = Number(process.env.PORT || 4000);
const dbDir = path.join(__dirname, 'data');
const dbPath = path.join(dbDir, 'growly.db');

fs.mkdirSync(dbDir, { recursive: true });

const db = new sqlite3.Database(dbPath);

const defaultSettings = {
  timezone: 'UTC',
  weeklyCommitmentMinutes: 7 * 60,
  weeklyBufferMinutes: 2 * 60,
  revisionSlots: 2,
  weekStartDay: 'Sunday',
  notificationPreferences: {
    studyReminders: true,
    browserNotifications: false,
  },
};

const defaultCategories = [
  {
    id: 'cat-1',
    name: 'Data Engineering',
    description: 'Systems, pipelines, and data platform fundamentals.',
    curriculumEnabled: true,
    archivedAt: null,
  },
  {
    id: 'cat-2',
    name: 'Product Thinking',
    description: 'Research, strategy, and communication patterns.',
    curriculumEnabled: false,
    archivedAt: null,
  },
];

const defaultTopics = [
  {
    id: 'topic-1',
    categoryId: 'cat-1',
    name: 'Data modeling basics',
    status: 'Completed',
    completedAt: '2026-09-20',
    notes: 'Normalized schemas and table design review.',
  },
  {
    id: 'topic-2',
    categoryId: 'cat-1',
    name: 'ETL orchestration',
    status: 'In Progress',
    completedAt: null,
    notes: 'Focus on Airflow-style scheduling and retries.',
  },
  {
    id: 'topic-3',
    categoryId: 'cat-1',
    name: 'Warehouse performance tuning',
    status: 'Not started',
    completedAt: null,
    notes: 'Comparing sort keys, partitioning, and clustering.',
  },
  {
    id: 'topic-4',
    categoryId: 'cat-1',
    name: 'Data quality checks',
    status: 'Not started',
    completedAt: null,
    notes: 'Validation patterns and anomaly detection.',
  },
  {
    id: 'topic-5',
    categoryId: 'cat-2',
    name: 'Customer interviews',
    status: 'Completed',
    completedAt: '2026-09-18',
    notes: 'Summaries and insight extraction.',
  },
  {
    id: 'topic-6',
    categoryId: 'cat-2',
    name: 'Messaging frameworks',
    status: 'In Progress',
    completedAt: null,
    notes: 'Positioning and story clarity exercises.',
  },
];

const defaultSessions = [
  {
    id: 'session-1',
    categoryId: 'cat-1',
    topicId: 'topic-1',
    topicName: 'Data modeling basics',
    date: '2026-09-20',
    durationMinutes: 90,
    sessionType: 'learning',
    outcome: 'Improved indexing and schema review',
    notes: 'Read design notes and mapped table relationships.',
  },
  {
    id: 'session-2',
    categoryId: 'cat-1',
    topicId: 'topic-2',
    topicName: 'ETL orchestration',
    date: '2026-09-22',
    durationMinutes: 60,
    sessionType: 'learning',
    outcome: 'Reviewed retry logic',
    notes: 'Looked at dependency patterns and scheduler edge cases.',
  },
  {
    id: 'session-3',
    categoryId: 'cat-2',
    topicId: 'topic-5',
    topicName: 'Customer interviews',
    date: '2026-09-19',
    durationMinutes: 45,
    sessionType: 'revision',
    outcome: 'Strengthened interview synthesis',
    notes: 'Revisited the top themes from previous conversations.',
  },
  {
    id: 'session-4',
    categoryId: 'cat-1',
    topicId: null,
    topicName: null,
    date: '2026-09-23',
    durationMinutes: 30,
    sessionType: 'learning',
    outcome: 'Unstructured study block',
    notes: 'Explored pipeline monitoring and alerting concepts.',
  },
];

function execSql(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function runSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function allSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

function normalizeSettings(row) {
  const source = row || defaultSettings;
  const rawNotificationPreferences = source.notificationPreferences ?? source.notification_preferences ?? defaultSettings.notificationPreferences;
  const parsedNotificationPreferences = typeof rawNotificationPreferences === 'string'
    ? JSON.parse(rawNotificationPreferences)
    : rawNotificationPreferences;

  return {
    timezone: source.timezone,
    weeklyCommitmentMinutes: source.weeklyCommitmentMinutes ?? source.weekly_commitment_minutes ?? defaultSettings.weeklyCommitmentMinutes,
    weeklyBufferMinutes: source.weeklyBufferMinutes ?? source.weekly_buffer_minutes ?? defaultSettings.weeklyBufferMinutes,
    revisionSlots: source.revisionSlots ?? source.revision_slots ?? defaultSettings.revisionSlots,
    weekStartDay: source.weekStartDay ?? source.week_start_day ?? defaultSettings.weekStartDay,
    notificationPreferences: parsedNotificationPreferences || defaultSettings.notificationPreferences,
  };
}

function normalizeCategory(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    curriculumEnabled: Boolean(row.curriculum_enabled),
    archivedAt: row.archived_at,
    topicCount: Number(row.topic_count || 0),
  };
}

function normalizeTopic(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    status: row.status,
    completedAt: row.completed_at,
    notes: row.notes,
  };
}

function normalizeSession(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    topicId: row.topic_id,
    topicName: row.topic_name,
    date: row.date,
    durationMinutes: row.duration_minutes,
    sessionType: row.session_type,
    outcome: row.outcome,
    notes: row.notes,
  };
}

async function ensureDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await execSql(schema);

  const existingSettings = await getSql('SELECT * FROM settings WHERE id = ?', ['primary']);
  if (!existingSettings) {
    await runSql(
      `INSERT INTO settings (id, timezone, weekly_commitment_minutes, weekly_buffer_minutes, revision_slots, week_start_day, notification_preferences)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'primary',
        defaultSettings.timezone,
        defaultSettings.weeklyCommitmentMinutes,
        defaultSettings.weeklyBufferMinutes,
        defaultSettings.revisionSlots,
        defaultSettings.weekStartDay,
        JSON.stringify(defaultSettings.notificationPreferences),
      ],
    );
  }

  const categoryCount = await getSql('SELECT COUNT(*) AS count FROM categories');
  if ((categoryCount?.count || 0) === 0) {
    for (const category of defaultCategories) {
      await runSql(
        `INSERT INTO categories (id, name, description, curriculum_enabled, archived_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          category.id,
          category.name,
          category.description,
          category.curriculumEnabled ? 1 : 0,
          category.archivedAt,
        ],
      );
    }
  }

  const topicCount = await getSql('SELECT COUNT(*) AS count FROM topics');
  if ((topicCount?.count || 0) === 0) {
    for (const topic of defaultTopics) {
      await runSql(
        `INSERT INTO topics (id, category_id, name, status, completed_at, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          topic.id,
          topic.categoryId,
          topic.name,
          topic.status,
          topic.completedAt,
          topic.notes,
        ],
      );
    }
  }

  const sessionCount = await getSql('SELECT COUNT(*) AS count FROM sessions');
  if ((sessionCount?.count || 0) === 0) {
    for (const session of defaultSessions) {
      await runSql(
        `INSERT INTO sessions (id, category_id, topic_id, topic_name, date, duration_minutes, session_type, outcome, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session.id,
          session.categoryId,
          session.topicId,
          session.topicName,
          session.date,
          session.durationMinutes,
          session.sessionType,
          session.outcome,
          session.notes,
        ],
      );
    }
  }
}

async function fetchSettings() {
  const row = await getSql('SELECT * FROM settings WHERE id = ?', ['primary']);
  return normalizeSettings(row || defaultSettings);
}

async function fetchCategories() {
  const rows = await allSql(`
    SELECT c.id, c.name, c.description, c.curriculum_enabled, c.archived_at,
      COUNT(t.id) AS topic_count
    FROM categories c
    LEFT JOIN topics t ON t.category_id = c.id
    GROUP BY c.id, c.name, c.description, c.curriculum_enabled, c.archived_at
    ORDER BY c.name ASC
  `);

  return rows.map(normalizeCategory);
}

async function fetchTopics() {
  const rows = await allSql('SELECT * FROM topics ORDER BY name ASC');
  return rows.map(normalizeTopic);
}

async function fetchSessions() {
  const rows = await allSql('SELECT * FROM sessions ORDER BY date DESC, created_at DESC');
  return rows.map(normalizeSession);
}

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'growly-backend', timestamp: new Date().toISOString() });
});

app.get('/api/settings', async (req, res) => {
  const settings = await fetchSettings();
  res.json(settings);
});

app.get('/api/dashboard', async (req, res) => {
  const settings = await fetchSettings();
  const [categories, topics, sessions] = await Promise.all([
    fetchCategories(),
    fetchTopics(),
    fetchSessions(),
  ]);

  const totalMinutes = sessions.reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0);
  const commitmentMinutes = Number(settings.weeklyCommitmentMinutes || 0);
  const bufferMinutes = Number(settings.weeklyBufferMinutes || 0);
  const commitmentProgress = Math.min((totalMinutes / commitmentMinutes) * 100, 100);
  const overflowMinutes = Math.max(totalMinutes - commitmentMinutes, 0);
  const bufferProgress = Math.min((overflowMinutes / bufferMinutes) * 100, 100);

  res.json({
    weekStartDay: settings.weekStartDay,
    weeklyCommitmentMinutes: commitmentMinutes,
    weeklyBufferMinutes: bufferMinutes,
    timeLoggedMinutes: totalMinutes,
    commitmentProgress,
    bufferProgress,
    categories: categories.length,
    topics: topics.length,
    sessions: sessions.length,
  });
});

app.get('/api/categories', async (req, res) => {
  const categories = await fetchCategories();
  res.json(categories);
});

app.get('/api/topics', async (req, res) => {
  const topics = await fetchTopics();
  res.json(topics);
});

app.get('/api/sessions', async (req, res) => {
  const sessions = await fetchSessions();
  res.json(sessions);
});

ensureDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Growly backend listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize SQLite database:', error);
    process.exit(1);
  });
