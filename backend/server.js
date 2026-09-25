const express = require('express');
const crypto = require('crypto');
const { createDatabase } = require('./database');
const { getWeek } = require('./week');

const app = express();
const port = Number(process.env.PORT || 4000);
const database = createDatabase();
const { runSql, getSql, allSql } = database;

const mutate = database.transaction;

let lastUpdate = 0;
async function touch(focusAreaIds = [], subtopicIds = []) {
  lastUpdate = Math.max(Date.now(), lastUpdate + 1);
  const timestamp = new Date(lastUpdate).toISOString();
  for (const id of new Set(focusAreaIds.filter(Boolean)))
    await runSql('UPDATE focus_areas SET updated_at = $1 WHERE id_focus_area = $2', [
      timestamp,
      id,
    ]);
  for (const id of new Set(subtopicIds.filter(Boolean)))
    await runSql('UPDATE subtopics SET updated_at = $1 WHERE id_subtopic = $2', [timestamp, id]);
}

function normalizeSettings(row) {
  if (!row)
    return {
      weeklyCommitmentMinutes: null,
      weeklyBufferMinutes: null,
      weeklyRevisionMinutes: null,
      weekStartDay: null,
    };
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
    sessionCount: Number(row.session_count || 0),
    totalMinutes: Number(row.total_minutes || 0),
    lastCovered: row.last_covered || null,
    lastReviewed: row.last_reviewed || null,
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

async function fetchSettings() {
  const row = await getSql('SELECT * FROM settings WHERE id_setting = $1', ['primary']);
  return normalizeSettings(row);
}

async function saveSettings(payload) {
  const current = await fetchSettings();
  payload = { ...current, ...payload };
  payload.weeklyRevisionMinutes = payload.weeklyRevisionMinutes ?? 0;
  for (const key of ['weeklyCommitmentMinutes', 'weeklyBufferMinutes', 'weeklyRevisionMinutes']) {
    if (
      payload[key] == null ||
      payload[key] === '' ||
      !Number.isInteger(Number(payload[key])) ||
      Number(payload[key]) < 0
    ) {
      throw new Error('Enter non-negative commitment, buffer, and revision hours.');
    }
  }
  if (
    Number(payload.weeklyCommitmentMinutes) +
      Number(payload.weeklyBufferMinutes) +
      Number(payload.weeklyRevisionMinutes) >
    10080
  )
    throw new Error('Commitment, buffer, and revision together cannot exceed 168 hours.');
  if (!['Monday', 'Sunday'].includes(payload.weekStartDay))
    throw new Error('Choose Monday or Sunday as the week start.');
  const preferences = payload.notificationPreferences ?? {};
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences))
    throw new Error('Notification preferences must be an object.');
  for (const key of ['studyReminders', 'browserNotifications']) {
    if (preferences[key] !== undefined && typeof preferences[key] !== 'boolean')
      throw new Error('Notification preferences must use true or false.');
  }
  if (
    preferences.studyReminders &&
    (!Number.isInteger(preferences.reminderIntervalMinutes) ||
      preferences.reminderIntervalMinutes < 15 ||
      preferences.reminderIntervalMinutes > 1440)
  )
    throw new Error('Choose a reminder interval between 15 and 1440 minutes.');
  const nextSettings = {
    ...payload,
    weeklyCommitmentMinutes: Number(payload.weeklyCommitmentMinutes),
    weeklyBufferMinutes: Number(payload.weeklyBufferMinutes),
    weeklyRevisionMinutes: Number(payload.weeklyRevisionMinutes),
    notificationPreferences: payload.notificationPreferences ?? {},
  };

  const existingSettings = await getSql('SELECT * FROM settings WHERE id_setting = $1', [
    'primary',
  ]);
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
       SET weekly_commitment_minutes = $1,
           weekly_buffer_minutes = $2,
           weekly_revision_minutes = $3,
           week_start_day = $4,
           notification_preferences = $5
       WHERE id_setting = $6`,
      values,
    );
  } else {
    await runSql(
      `INSERT INTO settings (id_setting, weekly_commitment_minutes, weekly_buffer_minutes, weekly_revision_minutes, week_start_day, notification_preferences)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['primary', ...values.slice(0, 5)],
    );
  }

  return fetchSettings();
}

async function fetchFocusAreas() {
  const rows = await allSql(`
    SELECT c.id_focus_area, c.name, c.description, c.curriculum_enabled, c.updated_at,
      COUNT(t.id_subtopic) AS subtopic_count
    FROM focus_areas c
    LEFT JOIN subtopics t ON t.id_focus_area = c.id_focus_area
    GROUP BY c.id_focus_area, c.name, c.description, c.curriculum_enabled, c.updated_at
    ORDER BY c.updated_at DESC, c.id_focus_area DESC
  `);

  return rows.map(normalizeFocusArea);
}

async function fetchSubtopics() {
  const rows = await allSql(
    `
    SELECT t.*, a.session_count, a.total_minutes, a.last_covered, a.last_reviewed
    FROM subtopics t LEFT JOIN (
      SELECT s.id_subtopic, COUNT(*) AS session_count, SUM(s.duration_minutes) AS total_minutes,
        MAX(s.date) AS last_covered,
        MAX(CASE WHEN LOWER(TRIM(f.name)) = 'revision' THEN s.date END) AS last_reviewed
      FROM sessions s LEFT JOIN focus_areas f ON f.id_focus_area = s.id_focus_area
      WHERE s.date <= $1 GROUP BY s.id_subtopic
    ) a ON a.id_subtopic = t.id_subtopic
    ORDER BY t.updated_at DESC, t.id_subtopic DESC
  `,
    [new Date().toISOString().slice(0, 10)],
  );
  return rows.map(normalizeSubtopic);
}

async function fetchSessions() {
  const rows = await allSql('SELECT * FROM sessions ORDER BY date DESC, created_at DESC');
  return rows.map(normalizeSession);
}

function requiredName(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} name must be text.`);
  const name = value.trim();
  if (name.length > 200) throw new Error(`${label} name must be 200 characters or fewer.`);
  if (!name) throw new Error(`${label} name is required.`);
  return name;
}

const primaryKeys = {
  focus_areas: 'id_focus_area',
  subtopics: 'id_subtopic',
  sessions: 'id_session',
};

async function requireRecord(table, id) {
  const row = await getSql(`SELECT * FROM ${table} WHERE ${primaryKeys[table]} = $1`, [id]);
  if (!row) throw Object.assign(new Error('This record no longer exists.'), { status: 404 });
  return row;
}

async function saveFocusArea(payload, id) {
  const previous = id ? await requireRecord('focus_areas', id) : null;
  if (payload.curriculumEnabled !== undefined && typeof payload.curriculumEnabled !== 'boolean')
    throw new Error('Curriculum tracking must be true or false.');
  const curriculumEnabled = payload.curriculumEnabled ?? Boolean(previous?.curriculum_enabled);
  const name = requiredName(payload.name, 'Focus Area');
  if (id) {
    await runSql(
      'UPDATE focus_areas SET name = $1, description = $2, curriculum_enabled = $3 WHERE id_focus_area = $4',
      [name, payload.description || null, curriculumEnabled ? 1 : 0, id],
    );
  } else {
    id = crypto.randomUUID();
    await runSql(
      'INSERT INTO focus_areas (id_focus_area, name, description, curriculum_enabled) VALUES ($1, $2, $3, $4)',
      [id, name, payload.description || null, curriculumEnabled ? 1 : 0],
    );
  }
  await touch([id]);
  return normalizeFocusArea(await requireRecord('focus_areas', id));
}

async function saveSubtopic(payload, id) {
  const previous = id ? await requireRecord('subtopics', id) : null;
  const name = requiredName(payload.name, 'Subtopic');
  if (
    !payload.id_focus_area ||
    !(await getSql('SELECT id_focus_area FROM focus_areas WHERE id_focus_area = $1', [
      payload.id_focus_area,
    ]))
  )
    throw new Error('Choose an existing Focus Area.');
  if (!['Not started', 'In Progress', 'Completed'].includes(payload.status))
    throw new Error('Choose a subtopic status.');
  const completedAt =
    payload.status === 'Completed'
      ? previous?.completed_at || new Date().toISOString().slice(0, 10)
      : null;
  const values = [payload.id_focus_area, name, payload.status, completedAt, payload.notes || null];
  if (id) {
    await runSql(
      'UPDATE subtopics SET id_focus_area = $1, name = $2, status = $3, completed_at = $4, notes = $5 WHERE id_subtopic = $6',
      [...values, id],
    );
  } else {
    id = crypto.randomUUID();
    await runSql(
      'INSERT INTO subtopics (id_focus_area, name, status, completed_at, notes, id_subtopic) VALUES ($1, $2, $3, $4, $5, $6)',
      [...values, id],
    );
  }
  // Renaming/moving a subtopic also updates session labels, preserving Revision links.
  await runSql(
    `UPDATE sessions SET subtopic_name = $1, id_focus_area = CASE
    WHEN id_focus_area IN (SELECT id_focus_area FROM focus_areas WHERE LOWER(TRIM(name)) = 'revision') THEN id_focus_area ELSE $2 END
    WHERE id_subtopic = $3`,
    [name, payload.id_focus_area, id],
  );
  await touch([previous?.id_focus_area, payload.id_focus_area], [id]);
  return normalizeSubtopic(await requireRecord('subtopics', id));
}

async function saveSession(payload, id) {
  let timerSessionId;
  if (!id && payload.timerId !== undefined) {
    if (
      typeof payload.timerId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.timerId)
    )
      throw new Error('Invalid timer reference.');
    timerSessionId = `timer-${payload.timerId}`;
    const saved = await getSql('SELECT * FROM sessions WHERE id_session = $1', [timerSessionId]);
    if (saved) return normalizeSession(saved);
  }
  const previous = id ? await requireRecord('sessions', id) : null;
  const slots = Number(payload.slots);
  if (!Number.isInteger(slots) || slots <= 0 || !Number.isFinite(slots))
    throw new Error('Enter a positive whole number of 30-minute slots.');
  if (slots > 48) throw new Error('A session cannot exceed 48 slots (24 hours).');
  const date = payload.date;
  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new Error('Choose a valid session date.');
  if (date > new Date().toISOString().slice(0, 10))
    throw new Error('Session dates cannot be in the future.');
  let id_focus_area = payload.id_focus_area || null;
  const hasFreeText = payload.focusAreaName !== undefined;
  const focusAreaName = hasFreeText ? requiredName(payload.focusAreaName, 'Focus Area') : null;
  if (hasFreeText && (id_focus_area || payload.id_subtopic))
    throw new Error('Choose an existing Focus Area or enter a new name, not both.');
  const id_subtopic = payload.id_subtopic || null;
  const selectedArea = id_focus_area
    ? await getSql('SELECT * FROM focus_areas WHERE id_focus_area = $1', [id_focus_area])
    : null;
  if (id_focus_area && !selectedArea) throw new Error('Choose an existing Focus Area.');
  const topic = id_subtopic
    ? await getSql('SELECT * FROM subtopics WHERE id_subtopic = $1', [id_subtopic])
    : null;
  const revision = selectedArea?.name.trim().toLowerCase() === 'revision';
  if (id_subtopic && (!topic || (!revision && topic.id_focus_area !== id_focus_area)))
    throw new Error(
      'Choose a subtopic belonging to the selected Focus Area, or use Revision to review another area.',
    );
  if (hasFreeText) {
    const existing = (await fetchFocusAreas()).find(
      (area) => area.name.trim().toLocaleLowerCase() === focusAreaName.toLocaleLowerCase(),
    );
    id_focus_area =
      existing?.id_focus_area || (await saveFocusArea({ name: focusAreaName })).id_focus_area;
  }
  const values = [
    id_focus_area,
    id_subtopic,
    topic?.name || null,
    date,
    slots * 30,
    payload.outcome || null,
    payload.notes || null,
  ];
  if (id) {
    await runSql(
      'UPDATE sessions SET id_focus_area = $1, id_subtopic = $2, subtopic_name = $3, date = $4, duration_minutes = $5, outcome = $6, notes = $7 WHERE id_session = $8',
      [...values, id],
    );
  } else {
    id = timerSessionId || crypto.randomUUID();
    await runSql(
      'INSERT INTO sessions (id_focus_area, id_subtopic, subtopic_name, date, duration_minutes, outcome, notes, id_session) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [...values, id],
    );
  }
  await touch(
    [previous?.id_focus_area, id_focus_area, topic?.id_focus_area],
    [previous?.id_subtopic, id_subtopic],
  );
  return normalizeSession(await requireRecord('sessions', id));
}

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (
    ['POST', 'PUT'].includes(req.method) &&
    (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
  )
    return res.status(400).json({ error: 'Send a JSON object.' });
  for (const key of ['description', 'notes', 'outcome']) {
    if (
      req.body?.[key] != null &&
      (typeof req.body[key] !== 'string' || req.body[key].length > 10000)
    )
      return res.status(400).json({ error: `${key} must be text of 10,000 characters or fewer.` });
  }
  next();
});
app.get('/health', async (req, res) => {
  await getSql('SELECT 1 AS ready');
  res.json({
    ok: true,
    service: 'growly-backend',
    database: 'postgresql',
    timestamp: new Date().toISOString(),
  });
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
  const weeklySessions = sessions.filter(
    (session) => session.date >= week.weekStart && session.date < week.weekEnd,
  );
  const totalMinutes = weeklySessions.reduce(
    (sum, session) => sum + Number(session.durationMinutes || 0),
    0,
  );
  const revisionIds = new Set(
    focus_areas
      .filter((area) => area.name.trim().toLowerCase() === 'revision')
      .map((area) => area.id_focus_area),
  );
  const revisionLoggedMinutes = weeklySessions
    .filter((session) => revisionIds.has(session.id_focus_area))
    .reduce((sum, session) => sum + session.durationMinutes, 0);
  const commitmentLoggedMinutes = totalMinutes - revisionLoggedMinutes;
  const commitmentMinutes = Number(settings.weeklyCommitmentMinutes || 0);
  const bufferMinutes = Number(settings.weeklyBufferMinutes || 0);
  const commitmentProgress =
    commitmentMinutes > 0 ? Math.min((commitmentLoggedMinutes / commitmentMinutes) * 100, 100) : 0;
  const overflowMinutes = Math.max(commitmentLoggedMinutes - commitmentMinutes, 0);
  const bufferProgress =
    bufferMinutes > 0 ? Math.min((overflowMinutes / bufferMinutes) * 100, 100) : 0;

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
    try {
      res.json(await list());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post(`/api/${resource}`, async (req, res) => {
    try {
      res.status(201).json(await mutate(() => save(req.body || {})));
    } catch (error) {
      res.status(error.status || 400).json({ error: error.message });
    }
  });
  app.put(`/api/${resource}/:id`, async (req, res) => {
    try {
      res.json(await mutate(() => save(req.body || {}, req.params.id)));
    } catch (error) {
      res.status(error.status || 400).json({ error: error.message });
    }
  });
  app.delete(`/api/${resource}/:id`, async (req, res) => {
    try {
      await mutate(async () => {
        const record = await requireRecord(table, req.params.id);
        await touch([record.id_focus_area], [record.id_subtopic]);
        if (table === 'focus_areas') {
          await runSql(
            'UPDATE sessions SET id_focus_area = NULL, id_subtopic = NULL, subtopic_name = NULL WHERE id_focus_area = $1',
            [req.params.id],
          );
          await runSql(
            'UPDATE sessions SET id_subtopic = NULL, subtopic_name = NULL WHERE id_subtopic IN (SELECT id_subtopic FROM subtopics WHERE id_focus_area = $1)',
            [req.params.id],
          );
          await runSql('DELETE FROM subtopics WHERE id_focus_area = $1', [req.params.id]);
        } else if (table === 'subtopics') {
          await runSql(
            'UPDATE sessions SET id_subtopic = NULL, subtopic_name = NULL WHERE id_subtopic = $1',
            [req.params.id],
          );
        }
        await runSql(`DELETE FROM ${table} WHERE ${primaryKeys[table]} = $1`, [req.params.id]);
      });
      res.json({ deleted: true });
    } catch (error) {
      res.status(error.status || 400).json({ error: error.message });
    }
  });
}

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 500;
  res.status(status).json({
    error:
      status === 413
        ? 'Request is too large.'
        : status === 400
          ? 'Invalid JSON request.'
          : 'Unable to complete the request. Please try again.',
  });
});

database
  .initialize()
  .then(() => {
    const server = app.listen(port, () => {
      console.log(`Growly backend listening on http://localhost:${server.address().port}`);
    });
    const shutdown = () => server.close(() => database.close().then(() => process.exit(0)));
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
