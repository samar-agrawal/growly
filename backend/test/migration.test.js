const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const sqlite3 = require('sqlite3');
const { migrateFile } = require('../migrate');

async function database(file, operation) {
  const db = new sqlite3.Database(file);
  const exec = sql => new Promise((resolve, reject) => db.exec(sql, error => error ? reject(error) : resolve()));
  const all = sql => new Promise((resolve, reject) => db.all(sql, (error, rows) => error ? reject(error) : resolve(rows)));
  try { return await operation({ exec, all }); }
  finally { await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve())); }
}

test('migration preserves records and links, removes obsolete fields and foreign keys, and creates a restorable backup', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'growly-schema-'));
  const file = path.join(directory, 'growly.db');
  try {
    await database(file, async ({ exec }) => {
      await exec(await fs.readFile(path.join(__dirname, 'fixtures/legacy-schema.sql'), 'utf8'));
      await exec(`
        INSERT INTO settings VALUES ('primary', 'Europe/Berlin', 450, 60, 3, 'Monday', '{"studyReminders":true}');
        INSERT INTO categories (id, name, updated_at) VALUES ('area-1', 'Revision', '2026-09-24T12:00:00.000Z');
        INSERT INTO topics (id, category_id, name, status, notes) VALUES ('topic-1', 'area-1', 'Review', 'Completed', 'Keep these notes');
        INSERT INTO sessions (id, category_id, topic_id, topic_name, date, duration_minutes, session_type, outcome, notes)
          VALUES ('session-1', 'area-1', 'topic-1', 'Review', '2026-09-24', 45, 'revision', 'Remembered', 'Keep session notes');
      `);
    });
    await migrateFile(file);
    await database(file, async ({ all }) => {
      for (const table of ['settings', 'focus_areas', 'subtopics', 'sessions']) assert.deepEqual(await all(`PRAGMA foreign_key_list(${table})`), []);
      const tables = (await all("SELECT name FROM sqlite_master WHERE type='table'")).map(row => row.name).sort();
      assert.deepEqual(tables, ['focus_areas', 'sessions', 'settings', 'subtopics']);
      const sessionColumns = (await all('PRAGMA table_info(sessions)')).map(row => row.name);
      assert.ok(sessionColumns.includes('id_session'));
      assert.ok(!sessionColumns.includes('id'));
      assert.ok(!sessionColumns.includes('session_type'));
      assert.ok(!(await all('PRAGMA table_info(settings)')).some(row => row.name === 'revision_slots'));
      const [session] = await all('SELECT * FROM sessions');
      assert.equal(session.id_session, 'session-1');
      assert.equal(session.id_focus_area, 'area-1');
      assert.equal(session.id_subtopic, 'topic-1');
      assert.equal(session.duration_minutes, 45);
      assert.equal(session.notes, 'Keep session notes');
      const [area] = await all('SELECT * FROM focus_areas');
      assert.equal(area.updated_at, '2026-09-24T12:00:00.000Z');
      const [settings] = await all('SELECT * FROM settings');
      assert.equal(settings.id_setting, 'primary');
      assert.equal(settings.weekly_commitment_minutes, 450);
      assert.equal(settings.weekly_revision_minutes, 0);
      assert.deepEqual(JSON.parse(settings.notification_preferences), { studyReminders: true });
    });
    const backups = (await fs.readdir(directory)).filter(name => name.endsWith('.bak'));
    assert.equal(backups.length, 1);
    await database(path.join(directory, backups[0]), async ({ all }) => {
      assert.equal((await all('SELECT * FROM sessions'))[0].session_type, 'revision');
      assert.equal((await all('SELECT * FROM settings'))[0].revision_slots, 3);
    });
    await migrateFile(file);
    assert.equal((await fs.readdir(directory)).filter(name => name.endsWith('.bak')).length, 1);
    await database(file, async ({ all }) => assert.equal((await all('SELECT * FROM sessions')).length, 1));
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('fresh databases use the new schema without seeded records', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'growly-fresh-'));
  try {
    const file = path.join(directory, 'growly.db');
    await migrateFile(file);
    await database(file, async ({ all }) => {
      for (const table of ['settings', 'focus_areas', 'subtopics', 'sessions']) assert.deepEqual(await all(`SELECT * FROM ${table}`), []);
    });
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('removing timezone preserves all other settings and session records', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'growly-timezone-'));
  const file = path.join(directory, 'growly.db');
  try {
    const schema = (await fs.readFile(path.join(__dirname, '../schema.sql'), 'utf8')).replace('id_setting TEXT PRIMARY KEY,', 'id_setting TEXT PRIMARY KEY, timezone TEXT NOT NULL,');
    await database(file, async ({ exec }) => {
      await exec(schema);
      await exec(`
        INSERT INTO settings VALUES ('primary', 'Europe/Berlin', 450, 60, 90, 'Sunday', '{"studyReminders":true}');
        INSERT INTO sessions (id_session, date, duration_minutes, notes) VALUES ('kept', '2026-09-24', 45, 'Keep notes');
      `);
    });
    await migrateFile(file);
    await database(file, async ({ all }) => {
      assert.ok(!(await all('PRAGMA table_info(settings)')).some(row => row.name === 'timezone'));
      assert.deepEqual(await all('SELECT * FROM settings'), [{ id_setting: 'primary', weekly_commitment_minutes: 450, weekly_buffer_minutes: 60, weekly_revision_minutes: 90, week_start_day: 'Sunday', notification_preferences: '{"studyReminders":true}' }]);
      const [session] = await all('SELECT * FROM sessions');
      assert.equal(session.id_session, 'kept');
      assert.equal(session.duration_minutes, 45);
      assert.equal(session.notes, 'Keep notes');
    });
    const backups = (await fs.readdir(directory)).filter(name => name.endsWith('.bak'));
    assert.equal(backups.length, 1);
    await database(path.join(directory, backups[0]), async ({ all }) => assert.equal((await all('SELECT * FROM settings'))[0].timezone, 'Europe/Berlin'));
    await migrateFile(file);
    assert.equal((await fs.readdir(directory)).filter(name => name.endsWith('.bak')).length, 1);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
