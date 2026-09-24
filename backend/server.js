const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { getWeek } = require('./week');

const app = express();
const port = Number(process.env.PORT || 4000);
const dbDir = process.env.GROWLY_DATA_DIR || path.join(__dirname, 'data');
const dbPath = path.join(dbDir, 'growly.db');

fs.mkdirSync(dbDir, { recursive: true });
const db = new sqlite3.Database(dbPath);

async function clearDatabaseTables() {
  await runSql('DELETE FROM sessions');
  await runSql('DELETE FROM topics');
  await runSql('DELETE FROM categories');
  await runSql('DELETE FROM settings');
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

// Serialize multi-record writes so free-text Focus Area creation and session saves
// commit together, without another request entering the same SQLite transaction.
let pendingWrite = Promise.resolve();
function mutate(operation) {
  const next = pendingWrite.then(async () => {
    await runSql('BEGIN IMMEDIATE');
    try {
      const result = await operation();
      await runSql('COMMIT');
      return result;
    } catch (error) {
      await runSql('ROLLBACK');
      throw error;
    }
  });
  pendingWrite = next.catch(() => {});
  return next;
}

let lastUpdate = 0;
async function touch(categoryIds = [], topicIds = []) {
  lastUpdate = Math.max(Date.now(), lastUpdate + 1);
  const timestamp = new Date(lastUpdate).toISOString();
  for (const id of new Set(categoryIds.filter(Boolean))) await runSql('UPDATE categories SET updated_at = ? WHERE id = ?', [timestamp, id]);
  for (const id of new Set(topicIds.filter(Boolean))) await runSql('UPDATE topics SET updated_at = ? WHERE id = ?', [timestamp, id]);
}

function normalizeSettings(row) {
  if (!row) return { timezone: null, weeklyCommitmentMinutes: null, weeklyBufferMinutes: null, weekStartDay: null };
  return {
    timezone: row.timezone,
    weeklyCommitmentMinutes: row.weekly_commitment_minutes,
    weeklyBufferMinutes: row.weekly_buffer_minutes,
    revisionSlots: row.revision_slots,
    weekStartDay: row.week_start_day,
    notificationPreferences: JSON.parse(row.notification_preferences),
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
    updatedAt: row.updated_at,
  };
}

function normalizeTopic(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    status: row.status,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
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
    slots: Number(row.duration_minutes) / 30,
    sessionType: row.session_type,
    outcome: row.outcome,
    notes: row.notes,
  };
}

async function ensureDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await execSql(schema);

  for (const table of ['categories', 'topics']) {
    const columns = await allSql(`PRAGMA table_info(${table})`);
    if (!columns.some(column => column.name === 'updated_at')) await runSql(`ALTER TABLE ${table} ADD COLUMN updated_at TEXT`);
    await runSql(`UPDATE ${table} SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at) WHERE updated_at IS NULL`);
  }

  if (process.env.GROWLY_RESET_DB === 'true') await clearDatabaseTables();
}

async function fetchSettings() {
  const row = await getSql('SELECT * FROM settings WHERE id = ?', ['primary']);
  return normalizeSettings(row);
}

async function saveSettings(payload) {
  const current = await fetchSettings();
  payload = { ...current, ...payload };
  for (const key of ['weeklyCommitmentMinutes', 'weeklyBufferMinutes']) {
    if (payload[key] == null || payload[key] === '' || !Number.isInteger(Number(payload[key])) || Number(payload[key]) < 0) {
      throw new Error('Enter non-negative weekly commitment and buffer hours.');
    }
  }
  if (Number(payload.weeklyCommitmentMinutes) + Number(payload.weeklyBufferMinutes) > 10080) throw new Error('Weekly commitment and buffer cannot exceed 168 hours.');
  if (!['Monday', 'Sunday'].includes(payload.weekStartDay)) throw new Error('Choose Monday or Sunday as the week start.');
  if (!payload.timezone || typeof payload.timezone !== 'string') throw new Error('Choose a timezone.');
  try { new Intl.DateTimeFormat('en', { timeZone: payload.timezone }).format(); } catch { throw new Error('Enter a valid timezone, such as Europe/Berlin or UTC.'); }
  const nextSettings = {
    ...payload,
    weeklyCommitmentMinutes: Number(payload.weeklyCommitmentMinutes),
    weeklyBufferMinutes: Number(payload.weeklyBufferMinutes),
    revisionSlots: payload.revisionSlots ?? 0,
    notificationPreferences: payload.notificationPreferences ?? {},
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
    SELECT c.id, c.name, c.description, c.curriculum_enabled, c.archived_at, c.updated_at,
      COUNT(t.id) AS topic_count
    FROM categories c
    LEFT JOIN topics t ON t.category_id = c.id
    GROUP BY c.id, c.name, c.description, c.curriculum_enabled, c.archived_at, c.updated_at
    ORDER BY c.updated_at DESC, c.rowid DESC
  `);

  return rows.map(normalizeCategory);
}

async function fetchTopics() {
  const rows = await allSql('SELECT * FROM topics ORDER BY updated_at DESC, rowid DESC');
  return rows.map(normalizeTopic);
}

async function fetchSessions() {
  const rows = await allSql('SELECT * FROM sessions ORDER BY date DESC, created_at DESC');
  return rows.map(normalizeSession);
}

function requiredName(value, label) {
  const name = String(value || '').trim();
  if (!name) throw new Error(`${label} name is required.`);
  return name;
}

async function requireRecord(table, id) {
  const row = await getSql(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  if (!row) throw Object.assign(new Error('This record no longer exists.'), { status: 404 });
  return row;
}

async function saveCategory(payload, id) {
  if (id) await requireRecord('categories', id);
  const name = requiredName(payload.name, 'Focus Area');
  if (id) {
    await runSql('UPDATE categories SET name = ?, description = ? WHERE id = ?', [name, payload.description || null, id]);
  } else {
    id = crypto.randomUUID();
    await runSql('INSERT INTO categories (id, name, description, curriculum_enabled) VALUES (?, ?, ?, ?)', [id, name, payload.description || null, payload.curriculumEnabled ? 1 : 0]);
  }
  await touch([id]);
  return normalizeCategory(await requireRecord('categories', id));
}

async function saveTopic(payload, id) {
  const previous = id ? await requireRecord('topics', id) : null;
  const name = requiredName(payload.name, 'Subtopic');
  if (!payload.categoryId || !await getSql('SELECT id FROM categories WHERE id = ?', [payload.categoryId])) throw new Error('Choose an existing Focus Area.');
  if (!['Not started', 'In Progress', 'Completed'].includes(payload.status)) throw new Error('Choose a subtopic status.');
  const completedAt = payload.status === 'Completed' ? previous?.completed_at || new Date().toISOString().slice(0, 10) : null;
  const values = [payload.categoryId, name, payload.status, completedAt, payload.notes || null];
  if (id) {
    await runSql('UPDATE topics SET category_id = ?, name = ?, status = ?, completed_at = ?, notes = ? WHERE id = ?', [...values, id]);
  } else {
    id = crypto.randomUUID();
    await runSql('INSERT INTO topics (category_id, name, status, completed_at, notes, id) VALUES (?, ?, ?, ?, ?, ?)', [...values, id]);
  }
  await touch([previous?.category_id, payload.categoryId], [id]);
  return normalizeTopic(await requireRecord('topics', id));
}

async function saveSession(payload, id) {
  const previous = id ? await requireRecord('sessions', id) : null;
  const slots = Number(payload.slots);
  // Keep legacy durations exactly when only the other session fields are edited.
  const unchangedLegacy = previous && slots === previous.duration_minutes / 30;
  if ((!Number.isInteger(slots) && !unchangedLegacy) || slots <= 0 || !Number.isFinite(slots)) throw new Error('Enter a positive whole number of 30-minute slots.');
  const date = payload.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Choose a valid session date.');
  if (!['learning', 'revision'].includes(payload.sessionType)) throw new Error('Choose a session type.');
  let categoryId = payload.categoryId || null;
  const hasFreeText = payload.focusAreaName !== undefined;
  const focusAreaName = hasFreeText ? requiredName(payload.focusAreaName, 'Focus Area') : null;
  if (hasFreeText && (categoryId || payload.topicId)) throw new Error('Choose an existing Focus Area or enter a new name, not both.');
  const topicId = payload.topicId || null;
  if (categoryId && !await getSql('SELECT id FROM categories WHERE id = ?', [categoryId])) throw new Error('Choose an existing Focus Area.');
  const topic = topicId ? await getSql('SELECT * FROM topics WHERE id = ?', [topicId]) : null;
  if (topicId && (!topic || topic.category_id !== categoryId)) throw new Error('Choose a subtopic belonging to the selected Focus Area.');
  if (hasFreeText) {
    const existing = (await fetchCategories()).find(area => area.name.trim().toLocaleLowerCase() === focusAreaName.toLocaleLowerCase());
    categoryId = existing?.id || (await saveCategory({ name: focusAreaName })).id;
  }
  const values = [categoryId, topicId, topic?.name || null, date, slots * 30, payload.sessionType, payload.outcome || null, payload.notes || null];
  if (id) {
    await runSql('UPDATE sessions SET category_id = ?, topic_id = ?, topic_name = ?, date = ?, duration_minutes = ?, session_type = ?, outcome = ?, notes = ? WHERE id = ?', [...values, id]);
  } else {
    id = crypto.randomUUID();
    await runSql('INSERT INTO sessions (category_id, topic_id, topic_name, date, duration_minutes, session_type, outcome, notes, id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [...values, id]);
  }
  await touch([previous?.category_id, categoryId], [previous?.topic_id, topicId]);
  return normalizeSession(await requireRecord('sessions', id));
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
    const updatedSettings = await mutate(() => saveSettings(req.body || {}));
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

  const week = getWeek(settings);
  const weeklySessions = sessions.filter(session => session.date >= week.weekStart && session.date < week.weekEnd);
  const totalMinutes = weeklySessions.reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0);
  const commitmentMinutes = Number(settings.weeklyCommitmentMinutes || 0);
  const bufferMinutes = Number(settings.weeklyBufferMinutes || 0);
  const commitmentProgress = commitmentMinutes > 0 ? Math.min((totalMinutes / commitmentMinutes) * 100, 100) : 0;
  const overflowMinutes = Math.max(totalMinutes - commitmentMinutes, 0);
  const bufferProgress = bufferMinutes > 0 ? Math.min((overflowMinutes / bufferMinutes) * 100, 100) : 0;

  res.json({
    ...week,
    weeklyCommitmentMinutes: commitmentMinutes,
    weeklyBufferMinutes: bufferMinutes,
    timeLoggedMinutes: totalMinutes,
    commitmentProgress,
    bufferProgress,
    categories: categories.length,
    topics: topics.length,
    sessions: weeklySessions.length,
  });
});

for (const [resource, table, list, save] of [
  ['categories', 'categories', fetchCategories, saveCategory],
  ['topics', 'topics', fetchTopics, saveTopic],
  ['sessions', 'sessions', fetchSessions, saveSession],
]) {
  app.get(`/api/${resource}`, async (req, res) => {
    try { res.json(await list()); } catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.post(`/api/${resource}`, async (req, res) => {
    try { res.status(201).json(await mutate(() => save(req.body || {}))); } catch (error) { res.status(error.status || 400).json({ error: error.message }); }
  });
  app.put(`/api/${resource}/:id`, async (req, res) => {
    try { res.json(await mutate(() => save(req.body || {}, req.params.id))); } catch (error) { res.status(error.status || 400).json({ error: error.message }); }
  });
  app.delete(`/api/${resource}/:id`, async (req, res) => {
    try {
      await mutate(async () => {
        const record = await requireRecord(table, req.params.id);
        await touch([record.category_id], [record.topic_id]);
        // SQLite triggers unlink history and remove children atomically.
        await runSql(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
      });
      res.json({ deleted: true });
    } catch (error) { res.status(error.status || 400).json({ error: error.message }); }
  });
}

ensureDatabase()
  .then(() => {
    const server = app.listen(port, () => {
      console.log(`Growly backend listening on http://localhost:${server.address().port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize SQLite database:', error);
    process.exit(1);
  });
