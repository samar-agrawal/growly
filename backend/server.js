const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { getWeek } = require('./week');
const { migrateDatabase } = require('./migrate');

const app = express();
const port = Number(process.env.PORT || 4000);
const dbDir = process.env.GROWLY_DATA_DIR || path.join(__dirname, 'data');
const dbPath = path.join(dbDir, 'growly.db');

fs.mkdirSync(dbDir, { recursive: true });
const db = new sqlite3.Database(dbPath);

async function clearDatabaseTables() {
  await runSql('DELETE FROM sessions');
  await runSql('DELETE FROM subtopics');
  await runSql('DELETE FROM focus_areas');
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
async function touch(focusAreaIds = [], subtopicIds = []) {
  lastUpdate = Math.max(Date.now(), lastUpdate + 1);
  const timestamp = new Date(lastUpdate).toISOString();
  for (const id of new Set(focusAreaIds.filter(Boolean))) await runSql('UPDATE focus_areas SET updated_at = ? WHERE id_focus_area = ?', [timestamp, id]);
  for (const id of new Set(subtopicIds.filter(Boolean))) await runSql('UPDATE subtopics SET updated_at = ? WHERE id_subtopic = ?', [timestamp, id]);
}

function normalizeSettings(row) {
  if (!row) return { weeklyCommitmentMinutes: null, weeklyBufferMinutes: null, weeklyRevisionMinutes: null, weekStartDay: null };
  return {
    weeklyCommitmentMinutes: row.weekly_commitment_minutes,
    weeklyBufferMinutes: row.weekly_buffer_minutes,
    weeklyRevisionMinutes: row.weekly_revision_minutes,
    weekStartDay: row.week_start_day,
    notificationPreferences: JSON.parse(row.notification_preferences),
  };
}

function normalizeFocusArea(row) {
  return {
    id_focus_area: row.id_focus_area,
    name: row.name,
    description: row.description,
    curriculumEnabled: Boolean(row.curriculum_enabled),
    archivedAt: row.archived_at,
    subtopicCount: Number(row.subtopic_count || 0),
    updatedAt: row.updated_at,
  };
}

function normalizeSubtopic(row) {
  return {
    id_subtopic: row.id_subtopic,
    id_focus_area: row.id_focus_area,
    name: row.name,
    status: row.status,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
    notes: row.notes,
  };
}

function normalizeSession(row) {
  return {
    id_session: row.id_session,
    id_focus_area: row.id_focus_area,
    id_subtopic: row.id_subtopic,
    subtopicName: row.subtopic_name,
    date: row.date,
    durationMinutes: Number(row.duration_minutes),
    slots: Number(row.duration_minutes) / 30,
    outcome: row.outcome,
    notes: row.notes,
  };
}

async function ensureDatabase() {
  await migrateDatabase({ execSql, runSql, allSql, dbPath });
  if (process.env.GROWLY_RESET_DB === 'true') await clearDatabaseTables();
}

async function fetchSettings() {
  const row = await getSql('SELECT * FROM settings WHERE id_setting = ?', ['primary']);
  return normalizeSettings(row);
}

async function saveSettings(payload) {
  const current = await fetchSettings();
  payload = { ...current, ...payload };
  payload.weeklyRevisionMinutes = payload.weeklyRevisionMinutes ?? 0;
  for (const key of ['weeklyCommitmentMinutes', 'weeklyBufferMinutes', 'weeklyRevisionMinutes']) {
    if (payload[key] == null || payload[key] === '' || !Number.isInteger(Number(payload[key])) || Number(payload[key]) < 0) {
      throw new Error('Enter non-negative commitment, buffer, and revision hours.');
    }
  }
  if (Number(payload.weeklyCommitmentMinutes) + Number(payload.weeklyBufferMinutes) + Number(payload.weeklyRevisionMinutes) > 10080) throw new Error('Commitment, buffer, and revision together cannot exceed 168 hours.');
  if (!['Monday', 'Sunday'].includes(payload.weekStartDay)) throw new Error('Choose Monday or Sunday as the week start.');
  const nextSettings = {
    ...payload,
    weeklyCommitmentMinutes: Number(payload.weeklyCommitmentMinutes),
    weeklyBufferMinutes: Number(payload.weeklyBufferMinutes),
    weeklyRevisionMinutes: Number(payload.weeklyRevisionMinutes),
    notificationPreferences: payload.notificationPreferences ?? {},
  };

  const existingSettings = await getSql('SELECT * FROM settings WHERE id_setting = ?', ['primary']);
  const values = [
    nextSettings.weeklyCommitmentMinutes,
    nextSettings.weeklyBufferMinutes,
    nextSettings.weeklyRevisionMinutes,
    nextSettings.weekStartDay,
    JSON.stringify(nextSettings.notificationPreferences),
    'primary',
  ];

  if (existingSettings) {
    await runSql(
      `UPDATE settings
       SET weekly_commitment_minutes = ?,
           weekly_buffer_minutes = ?,
           weekly_revision_minutes = ?,
           week_start_day = ?,
           notification_preferences = ?
       WHERE id_setting = ?`,
      values,
    );
  } else {
    await runSql(
      `INSERT INTO settings (id_setting, weekly_commitment_minutes, weekly_buffer_minutes, weekly_revision_minutes, week_start_day, notification_preferences)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['primary', ...values.slice(0, 5)],
    );
  }

  return fetchSettings();
}

async function fetchFocusAreas() {
  const rows = await allSql(`
    SELECT c.id_focus_area, c.name, c.description, c.curriculum_enabled, c.archived_at, c.updated_at,
      COUNT(t.id_subtopic) AS subtopic_count
    FROM focus_areas c
    LEFT JOIN subtopics t ON t.id_focus_area = c.id_focus_area
    GROUP BY c.id_focus_area, c.name, c.description, c.curriculum_enabled, c.archived_at, c.updated_at
    ORDER BY c.updated_at DESC, c.rowid DESC
  `);

  return rows.map(normalizeFocusArea);
}

async function fetchSubtopics() {
  const rows = await allSql('SELECT * FROM subtopics ORDER BY updated_at DESC, rowid DESC');
  return rows.map(normalizeSubtopic);
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

const primaryKeys = { focus_areas: 'id_focus_area', subtopics: 'id_subtopic', sessions: 'id_session' };

async function requireRecord(table, id) {
  const row = await getSql(`SELECT * FROM ${table} WHERE ${primaryKeys[table]} = ?`, [id]);
  if (!row) throw Object.assign(new Error('This record no longer exists.'), { status: 404 });
  return row;
}

async function saveFocusArea(payload, id) {
  if (id) await requireRecord('focus_areas', id);
  const name = requiredName(payload.name, 'Focus Area');
  if (id) {
    await runSql('UPDATE focus_areas SET name = ?, description = ? WHERE id_focus_area = ?', [name, payload.description || null, id]);
  } else {
    id = crypto.randomUUID();
    await runSql('INSERT INTO focus_areas (id_focus_area, name, description, curriculum_enabled) VALUES (?, ?, ?, ?)', [id, name, payload.description || null, payload.curriculumEnabled ? 1 : 0]);
  }
  await touch([id]);
  return normalizeFocusArea(await requireRecord('focus_areas', id));
}

async function saveSubtopic(payload, id) {
  const previous = id ? await requireRecord('subtopics', id) : null;
  const name = requiredName(payload.name, 'Subtopic');
  if (!payload.id_focus_area || !await getSql('SELECT id_focus_area FROM focus_areas WHERE id_focus_area = ?', [payload.id_focus_area])) throw new Error('Choose an existing Focus Area.');
  if (!['Not started', 'In Progress', 'Completed'].includes(payload.status)) throw new Error('Choose a subtopic status.');
  const completedAt = payload.status === 'Completed' ? previous?.completed_at || new Date().toISOString().slice(0, 10) : null;
  const values = [payload.id_focus_area, name, payload.status, completedAt, payload.notes || null];
  if (id) {
    await runSql('UPDATE subtopics SET id_focus_area = ?, name = ?, status = ?, completed_at = ?, notes = ? WHERE id_subtopic = ?', [...values, id]);
  } else {
    id = crypto.randomUUID();
    await runSql('INSERT INTO subtopics (id_focus_area, name, status, completed_at, notes, id_subtopic) VALUES (?, ?, ?, ?, ?, ?)', [...values, id]);
  }
  await touch([previous?.id_focus_area, payload.id_focus_area], [id]);
  return normalizeSubtopic(await requireRecord('subtopics', id));
}

async function saveSession(payload, id) {
  const previous = id ? await requireRecord('sessions', id) : null;
  const slots = Number(payload.slots);
  // Keep legacy durations exactly when only the other session fields are edited.
  const unchangedLegacy = previous && slots === previous.duration_minutes / 30;
  if ((!Number.isInteger(slots) && !unchangedLegacy) || slots <= 0 || !Number.isFinite(slots)) throw new Error('Enter a positive whole number of 30-minute slots.');
  const date = payload.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Choose a valid session date.');
  let id_focus_area = payload.id_focus_area || null;
  const hasFreeText = payload.focusAreaName !== undefined;
  const focusAreaName = hasFreeText ? requiredName(payload.focusAreaName, 'Focus Area') : null;
  if (hasFreeText && (id_focus_area || payload.id_subtopic)) throw new Error('Choose an existing Focus Area or enter a new name, not both.');
  const id_subtopic = payload.id_subtopic || null;
  if (id_focus_area && !await getSql('SELECT id_focus_area FROM focus_areas WHERE id_focus_area = ?', [id_focus_area])) throw new Error('Choose an existing Focus Area.');
  const topic = id_subtopic ? await getSql('SELECT * FROM subtopics WHERE id_subtopic = ?', [id_subtopic]) : null;
  if (id_subtopic && (!topic || topic.id_focus_area !== id_focus_area)) throw new Error('Choose a subtopic belonging to the selected Focus Area.');
  if (hasFreeText) {
    const existing = (await fetchFocusAreas()).find(area => area.name.trim().toLocaleLowerCase() === focusAreaName.toLocaleLowerCase());
    id_focus_area = existing?.id_focus_area || (await saveFocusArea({ name: focusAreaName })).id_focus_area;
  }
  const values = [id_focus_area, id_subtopic, topic?.name || null, date, slots * 30, payload.outcome || null, payload.notes || null];
  if (id) {
    await runSql('UPDATE sessions SET id_focus_area = ?, id_subtopic = ?, subtopic_name = ?, date = ?, duration_minutes = ?, outcome = ?, notes = ? WHERE id_session = ?', [...values, id]);
  } else {
    id = crypto.randomUUID();
    await runSql('INSERT INTO sessions (id_focus_area, id_subtopic, subtopic_name, date, duration_minutes, outcome, notes, id_session) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [...values, id]);
  }
  await touch([previous?.id_focus_area, id_focus_area], [previous?.id_subtopic, id_subtopic]);
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
  const [focus_areas, subtopics, sessions] = await Promise.all([
    fetchFocusAreas(),
    fetchSubtopics(),
    fetchSessions(),
  ]);

  const week = getWeek(settings);
  const weeklySessions = sessions.filter(session => session.date >= week.weekStart && session.date < week.weekEnd);
  const totalMinutes = weeklySessions.reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0);
  const revisionIds = new Set(focus_areas.filter(area => area.name.trim().toLowerCase() === 'revision').map(area => area.id_focus_area));
  const revisionLoggedMinutes = weeklySessions.filter(session => revisionIds.has(session.id_focus_area)).reduce((sum, session) => sum + session.durationMinutes, 0);
  const commitmentLoggedMinutes = totalMinutes - revisionLoggedMinutes;
  const commitmentMinutes = Number(settings.weeklyCommitmentMinutes || 0);
  const bufferMinutes = Number(settings.weeklyBufferMinutes || 0);
  const commitmentProgress = commitmentMinutes > 0 ? Math.min((commitmentLoggedMinutes / commitmentMinutes) * 100, 100) : 0;
  const overflowMinutes = Math.max(commitmentLoggedMinutes - commitmentMinutes, 0);
  const bufferProgress = bufferMinutes > 0 ? Math.min((overflowMinutes / bufferMinutes) * 100, 100) : 0;

  res.json({
    ...week,
    weeklyCommitmentMinutes: commitmentMinutes,
    weeklyBufferMinutes: bufferMinutes,
    timeLoggedMinutes: totalMinutes,
    commitmentLoggedMinutes,
    revisionLoggedMinutes,
    weeklyRevisionMinutes: Number(settings.weeklyRevisionMinutes || 0),
    commitmentProgress,
    bufferProgress,
    focus_areas: focus_areas.length,
    subtopics: subtopics.length,
    sessions: weeklySessions.length,
  });
});

for (const [resource, table, list, save] of [
  ['focus_areas', 'focus_areas', fetchFocusAreas, saveFocusArea],
  ['subtopics', 'subtopics', fetchSubtopics, saveSubtopic],
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
        await touch([record.id_focus_area], [record.id_subtopic]);
        // SQLite triggers unlink history and remove children atomically.
        await runSql(`DELETE FROM ${table} WHERE ${primaryKeys[table]} = ?`, [req.params.id]);
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
