const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
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
  weeklyCommitmentMinutes: 0,
  weeklyBufferMinutes: 0,
  revisionSlots: 0,
  weekStartDay: 'Sunday',
  notificationPreferences: {
    studyReminders: false,
    browserNotifications: false,
  },
};

async function clearDatabaseTables() {
  await runSql('DELETE FROM sessions');
  await runSql('DELETE FROM topics');
  await runSql('DELETE FROM categories');
  await runSql('DELETE FROM settings');
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
    timezone: source.timezone ?? defaultSettings.timezone,
    weeklyCommitmentMinutes: Number(source.weeklyCommitmentMinutes ?? source.weekly_commitment_minutes ?? defaultSettings.weeklyCommitmentMinutes),
    weeklyBufferMinutes: Number(source.weeklyBufferMinutes ?? source.weekly_buffer_minutes ?? defaultSettings.weeklyBufferMinutes),
    revisionSlots: Number(source.revisionSlots ?? source.revision_slots ?? defaultSettings.revisionSlots),
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
    durationMinutes: Number(row.duration_minutes),
    sessionType: row.session_type,
    outcome: row.outcome,
    notes: row.notes,
  };
}

async function ensureDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await execSql(schema);

  const existingSettings = await getSql('SELECT * FROM settings WHERE id = ?', ['primary']);
  const shouldReset = process.env.GROWLY_RESET_DB !== 'false';

  if (shouldReset || !existingSettings) {
    await clearDatabaseTables();
  }
}

async function fetchSettings() {
  const row = await getSql('SELECT * FROM settings WHERE id = ?', ['primary']);
  return normalizeSettings(row || defaultSettings);
}

async function saveSettings(payload) {
  const nextSettings = {
    timezone: payload.timezone || defaultSettings.timezone,
    weeklyCommitmentMinutes: Number(payload.weeklyCommitmentMinutes || defaultSettings.weeklyCommitmentMinutes),
    weeklyBufferMinutes: Number(payload.weeklyBufferMinutes || defaultSettings.weeklyBufferMinutes),
    revisionSlots: Number(payload.revisionSlots || defaultSettings.revisionSlots),
    weekStartDay: payload.weekStartDay || defaultSettings.weekStartDay,
    notificationPreferences: payload.notificationPreferences || defaultSettings.notificationPreferences,
  };

  const existingSettings = await getSql('SELECT * FROM settings WHERE id = ?', ['primary']);
  const values = [
    nextSettings.timezone,
    nextSettings.weeklyCommitmentMinutes,
    nextSettings.weeklyBufferMinutes,
    nextSettings.revisionSlots,
    nextSettings.weekStartDay,
    JSON.stringify(nextSettings.notificationPreferences),
    'primary',
  ];

  if (existingSettings) {
    await runSql(
      `UPDATE settings
       SET timezone = ?,
           weekly_commitment_minutes = ?,
           weekly_buffer_minutes = ?,
           revision_slots = ?,
           week_start_day = ?,
           notification_preferences = ?
       WHERE id = ?`,
      values,
    );
  } else {
    await runSql(
      `INSERT INTO settings (id, timezone, weekly_commitment_minutes, weekly_buffer_minutes, revision_slots, week_start_day, notification_preferences)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['primary', ...values.slice(0, 6)],
    );
  }

  return fetchSettings();
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

async function createCategory(payload) {
  const name = String(payload.name || '').trim();
  if (!name) {
    throw new Error('Category name is required.');
  }

  const id = crypto.randomUUID();
  await runSql(
    `INSERT INTO categories (id, name, description, curriculum_enabled, archived_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, name, payload.description || null, payload.curriculumEnabled ? 1 : 0, null],
  );

  const row = await getSql('SELECT * FROM categories WHERE id = ?', [id]);
  return normalizeCategory(row);
}

async function createTopic(payload) {
  const name = String(payload.name || '').trim();
  if (!name) {
    throw new Error('Topic name is required.');
  }

  const categoryId = payload.categoryId || null;
  if (!categoryId) {
    throw new Error('A category is required to create a topic.');
  }

  const id = crypto.randomUUID();
  await runSql(
    `INSERT INTO topics (id, category_id, name, status, completed_at, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, categoryId, name, payload.status || 'Not started', payload.completedAt || null, payload.notes || null],
  );

  const row = await getSql('SELECT * FROM topics WHERE id = ?', [id]);
  return normalizeTopic(row);
}

async function createSession(payload) {
  const durationMinutes = Number(payload.durationMinutes || 0);
  if (!durationMinutes) {
    throw new Error('Session duration must be greater than zero.');
  }

  const date = payload.date || new Date().toISOString().slice(0, 10);
  const sessionType = payload.sessionType || 'learning';
  const id = crypto.randomUUID();
  const categoryId = payload.categoryId || null;
  const topicId = payload.topicId || null;

  let topicName = payload.topicName || null;
  if (topicId) {
    const topic = await getSql('SELECT name FROM topics WHERE id = ?', [topicId]);
    topicName = topic ? topic.name : null;
  }

  await runSql(
    `INSERT INTO sessions (id, category_id, topic_id, topic_name, date, duration_minutes, session_type, outcome, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      categoryId,
      topicId,
      topicName,
      date,
      durationMinutes,
      sessionType,
      payload.outcome || null,
      payload.notes || null,
    ],
  );

  const row = await getSql('SELECT * FROM sessions WHERE id = ?', [id]);
  return normalizeSession(row);
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

app.put('/api/settings', async (req, res) => {
  try {
    const updatedSettings = await saveSettings(req.body || {});
    res.json(updatedSettings);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
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
  const commitmentProgress = commitmentMinutes > 0 ? Math.min((totalMinutes / commitmentMinutes) * 100, 100) : 0;
  const overflowMinutes = Math.max(totalMinutes - commitmentMinutes, 0);
  const bufferProgress = bufferMinutes > 0 ? Math.min((overflowMinutes / bufferMinutes) * 100, 100) : 0;

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

app.post('/api/categories', async (req, res) => {
  try {
    const category = await createCategory(req.body || {});
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/topics', async (req, res) => {
  const topics = await fetchTopics();
  res.json(topics);
});

app.post('/api/topics', async (req, res) => {
  try {
    const topic = await createTopic(req.body || {});
    res.status(201).json(topic);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/sessions', async (req, res) => {
  const sessions = await fetchSessions();
  res.json(sessions);
});

app.post('/api/sessions', async (req, res) => {
  try {
    const session = await createSession(req.body || {});
    res.status(201).json(session);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
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
