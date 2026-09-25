const { randomUUID } = require('node:crypto');

function installObjectives(app, database) {
  const { allSql, getSql, runSql } = database;
  const fail = (message, status = 400) => {
    throw Object.assign(new Error(message), { status });
  };
  const links = [
    ['focusAreaIds', 'focus_areas', 'id_focus_area'],
    ['subtopicIds', 'subtopics', 'id_subtopic'],
    ['sessionIds', 'sessions', 'id_session'],
  ];
  async function enabled() {
    return (
      (await getSql('SELECT enabled FROM objective_preferences WHERE id = 1'))?.enabled ?? true
    );
  }
  async function list() {
    return allSql(
      `SELECT o.*,
      ARRAY(SELECT id_focus_area FROM objective_focus_areas WHERE id_objective = o.id_objective) AS "focusAreaIds",
      ARRAY(SELECT id_subtopic FROM objective_subtopics WHERE id_objective = o.id_objective) AS "subtopicIds",
      ARRAY(SELECT id_session FROM objective_sessions WHERE id_objective = o.id_objective) AS "sessionIds",
      COALESCE(a.minutes, 0)::integer AS "totalMinutes", a.last_activity AS "lastActivity"
      FROM objectives o LEFT JOIN LATERAL (
        SELECT SUM(s.duration_minutes) AS minutes, MAX(s.date) AS last_activity FROM sessions s
        WHERE s.date <= $1 AND (
          EXISTS (SELECT 1 FROM objective_sessions l WHERE l.id_objective = o.id_objective AND l.id_session = s.id_session)
          OR EXISTS (SELECT 1 FROM objective_focus_areas l WHERE l.id_objective = o.id_objective AND l.id_focus_area = s.id_focus_area)
          OR EXISTS (SELECT 1 FROM objective_subtopics l WHERE l.id_objective = o.id_objective AND l.id_subtopic = s.id_subtopic)
        )
      ) a ON TRUE ORDER BY o.created_at DESC, o.id_objective`,
      [new Date().toISOString().slice(0, 10)],
    );
  }
  app.get('/api/objectives', async (req, res) => {
    const isEnabled = await enabled();
    res.json({ enabled: isEnabled, objectives: isEnabled ? await list() : [] });
  });
  app.put('/api/objectives/preferences', async (req, res) => {
    if (typeof req.body.enabled !== 'boolean') fail('Enabled must be true or false.');
    await database.transaction(() =>
      runSql(
        `INSERT INTO objective_preferences (id, enabled) VALUES (1, $1)
      ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled`,
        [req.body.enabled],
      ),
    );
    res.json({ enabled: req.body.enabled });
  });
  async function save(payload, id) {
    if (!(await enabled())) fail('Enable Growth Objectives before making changes.');
    const previous = id
      ? await getSql('SELECT * FROM objectives WHERE id_objective = $1', [id])
      : null;
    if (id && !previous) fail('This objective no longer exists.', 404);
    const value = {
      priority: 'Medium',
      status: 'Active',
      motivation: '',
      success_criteria: '',
      target_date: null,
      ...previous,
      ...payload,
    };
    if (typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > 200)
      fail('Enter an objective title of 1 to 200 characters.');
    for (const key of ['motivation', 'success_criteria'])
      if (typeof value[key] !== 'string' || value[key].length > 10000)
        fail(`${key} must be text of 10,000 characters or fewer.`);
    if (!['Low', 'Medium', 'High'].includes(value.priority)) fail('Choose a valid priority.');
    if (!['Active', 'Archived', 'Achieved'].includes(value.status))
      fail('Choose a valid objective status.');
    const date = value.target_date || null;
    if (
      date !== null &&
      (typeof date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date)
    )
      fail('Choose a valid target date.');
    if (value.status !== 'Achieved' && (!previous || previous.status === 'Achieved')) {
      const count = await getSql(
        "SELECT COUNT(*)::integer AS count FROM objectives WHERE status <> 'Achieved'",
      );
      if (count.count >= 3)
        fail(
          'You can keep up to three unfinished objectives. Achieve or delete one first; archived objectives still count.',
        );
    }
    for (const [field, table, key] of links) {
      if (payload[field] === undefined) continue;
      if (
        !Array.isArray(payload[field]) ||
        payload[field].length > 1000 ||
        payload[field].some((item) => typeof item !== 'string')
      )
        fail(`Choose valid ${field}.`);
      const found = await allSql(`SELECT ${key} FROM ${table} WHERE ${key} = ANY($1::text[])`, [
        payload[field],
      ]);
      if (found.length !== new Set(payload[field]).size)
        fail(`One of the selected ${field} no longer exists.`);
    }
    id ||= randomUUID();
    await runSql(
      `INSERT INTO objectives (id_objective, title, motivation, priority, status, target_date, success_criteria, achieved_at, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id_objective) DO UPDATE SET title = EXCLUDED.title, motivation = EXCLUDED.motivation,
      priority = EXCLUDED.priority, status = EXCLUDED.status, target_date = EXCLUDED.target_date,
      success_criteria = EXCLUDED.success_criteria, achieved_at = EXCLUDED.achieved_at`,
      [
        id,
        value.title.trim(),
        value.motivation,
        value.priority,
        value.status,
        date,
        value.success_criteria,
        value.status === 'Achieved' ? previous?.achieved_at || new Date().toISOString() : null,
        previous?.created_at || new Date().toISOString(),
      ],
    );
    for (const [field, table, key] of links) {
      if (payload[field] === undefined) continue;
      await runSql(`DELETE FROM objective_${table} WHERE id_objective = $1`, [id]);
      for (const linkedId of new Set(payload[field]))
        await runSql(`INSERT INTO objective_${table} (id_objective, ${key}) VALUES ($1,$2)`, [
          id,
          linkedId,
        ]);
    }
    return (await list()).find((item) => item.id_objective === id);
  }
  app.post('/api/objectives', async (req, res) =>
    res.status(201).json(await database.transaction(() => save(req.body))),
  );
  app.put('/api/objectives/:id', async (req, res) =>
    res.json(await database.transaction(() => save(req.body, req.params.id))),
  );
  app.delete('/api/objectives/:id', async (req, res) => {
    await database.transaction(async () => {
      if (!(await enabled())) fail('Enable Growth Objectives before making changes.');
      const result = await runSql('DELETE FROM objectives WHERE id_objective = $1', [
        req.params.id,
      ]);
      if (!result.rowCount) fail('This objective no longer exists.', 404);
    });
    res.json({ deleted: true });
  });
}
module.exports = { installObjectives };
