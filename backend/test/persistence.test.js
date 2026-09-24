const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, rm, readFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const sqlite3 = require('sqlite3');

test('weekly settings, Focus Areas, and subtopics persist across restarts', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'growly-test-'));
  let server;
  let base;
  async function start() {
    server = spawn(process.execPath, ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: '0', GROWLY_DATA_DIR: directory, GROWLY_RESET_DB: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
      server.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
      server.stdout.on('data', data => {
        const match = data.toString().match(/http:\/\/localhost:(\d+)/);
        if (match) { base = match[0]; clearTimeout(timer); resolve(); }
      });
      server.stderr.on('data', data => process.stderr.write(data));
    });
  }
  async function stop() { if (server && server.exitCode === null) { const exited = once(server, 'exit'); server.kill(); await exited; } }
  async function request(route, body, method = 'POST') {
    const response = await fetch(`${base}/api/${route}`, body || method === 'DELETE' ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    const json = await response.json();
    assert.ok(response.ok, JSON.stringify(json));
    return json;
  }
  try {
    // Start from the previous schema with existing records to exercise migration.
    const legacySchema = (await readFile(path.join(__dirname, '../schema.sql'), 'utf8')).replaceAll('  updated_at TEXT,\n', '');
    const legacyDb = new sqlite3.Database(path.join(directory, 'growly.db'));
    await new Promise((resolve, reject) => legacyDb.exec(legacySchema + `
      INSERT INTO categories (id, name, created_at) VALUES ('legacy-area', 'Existing area', '2025-01-01 12:00:00');
      INSERT INTO topics (id, category_id, name, status, created_at) VALUES ('legacy-topic', 'legacy-area', 'Existing topic', 'Not started', '2025-01-02 12:00:00');
    `, error => error ? reject(error) : resolve()));
    await new Promise((resolve, reject) => legacyDb.close(error => error ? reject(error) : resolve()));
    await start();
    assert.equal((await request('categories'))[0].updatedAt, '2025-01-01T12:00:00.000Z');
    assert.equal((await request('topics'))[0].updatedAt, '2025-01-02T12:00:00.000Z');
    await request('categories/legacy-area', undefined, 'DELETE');
    assert.equal((await request('settings')).weeklyCommitmentMinutes, null);
    assert.deepEqual(await request('categories'), []);
    assert.deepEqual(await request('topics'), []);
    assert.deepEqual(await request('sessions'), []);
    assert.equal((await request('dashboard')).timeLoggedMinutes, 0);
    await request('settings', { weeklyCommitmentMinutes: 450, weeklyBufferMinutes: 90, timezone: 'UTC', weekStartDay: 'Monday', revisionSlots: 2 }, 'PUT');
    const area = await request('categories', { name: 'System design', curriculumEnabled: true });
    const subtopic = await request('topics', { name: 'Caching', categoryId: area.id, status: 'Completed' });
    assert.ok(subtopic.completedAt);
    await request('sessions', { date: '2000-01-01', slots: 3, sessionType: 'learning', categoryId: area.id, topicId: subtopic.id });
    await request('sessions', { date: new Date().toISOString().slice(0, 10), slots: 2, sessionType: 'learning', categoryId: area.id, topicId: subtopic.id });
    const dashboard = await request('dashboard');
    assert.equal(dashboard.timeLoggedMinutes, 60);
    assert.equal(dashboard.sessions, 1);
    await stop();
    await start();
    const settings = await request('settings');
    assert.equal(settings.weeklyCommitmentMinutes, 450);
    assert.equal(settings.weeklyBufferMinutes, 90);
    assert.equal((await request('categories'))[0].id, area.id);
    assert.equal((await request('topics'))[0].id, subtopic.id);
    await request('settings', { weeklyCommitmentMinutes: 0 }, 'PUT');
    assert.equal((await request('settings')).revisionSlots, 2);
    for (const value of [-1, 'invalid', 10081]) {
      const response = await fetch(`${base}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weeklyCommitmentMinutes: value }) });
      assert.equal(response.status, 400);
    }
    const invalidTopic = await fetch(`${base}/api/topics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Orphan', categoryId: 'missing' }) });
    assert.equal(invalidTopic.status, 400);

    const secondArea = await request('categories', { name: 'Databases' });
    const renamed = await request(`categories/${area.id}`, { name: 'Architecture', description: 'Updated description' }, 'PUT');
    assert.equal(renamed.name, 'Architecture');
    await request(`topics/${subtopic.id}`, { name: 'Cache design', categoryId: secondArea.id, status: 'In Progress', notes: 'Updated notes' }, 'PUT');
    assert.equal((await request('topics'))[0].completedAt, null);
    let records = await request('sessions');
    assert.ok(records.every(item => item.categoryId === secondArea.id && item.topicName === 'Cache design'));
    const recent = records.find(item => item.date !== '2000-01-01');
    const changed = await request(`sessions/${recent.id}`, { ...recent, slots: 5, notes: 'Updated session' }, 'PUT');
    assert.equal(changed.durationMinutes, 150);
    assert.equal((await request('dashboard')).timeLoggedMinutes, 150);
    await request(`sessions/${recent.id}`, { ...changed, date: '2000-02-01' }, 'PUT');
    assert.equal((await request('dashboard')).timeLoggedMinutes, 0);
    await request(`sessions/${recent.id}`, { ...changed }, 'PUT');
    for (const patch of [{ slots: 0 }, { slots: -1 }, { slots: 1.5 }, { date: '2026-02-30' }, { sessionType: '' }, { categoryId: area.id }]) {
      const response = await fetch(`${base}/api/sessions/${recent.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...changed, ...patch }) });
      assert.equal(response.status, 400, JSON.stringify(patch));
    }
    await request(`topics/${subtopic.id}`, undefined, 'DELETE');
    records = await request('sessions');
    assert.ok(records.every(item => item.topicId === null && item.topicName === null && item.categoryId === secondArea.id));
    const child = await request('topics', { name: 'Indexes', categoryId: secondArea.id, status: 'Not started' });
    await request('sessions', { date: new Date().toISOString().slice(0, 10), slots: 1, sessionType: 'revision', categoryId: secondArea.id, topicId: child.id });
    const totalBefore = (await request('dashboard')).timeLoggedMinutes;
    await request(`categories/${secondArea.id}`, undefined, 'DELETE');
    assert.deepEqual(await request('topics'), []);
    assert.ok((await request('sessions')).every(item => item.categoryId === null && item.topicId === null));
    assert.equal((await request('dashboard')).timeLoggedMinutes, totalBefore);
    await request(`sessions/${recent.id}`, undefined, 'DELETE');
    assert.equal((await request('dashboard')).timeLoggedMinutes, totalBefore - 150);
    assert.equal((await fetch(`${base}/api/sessions/${recent.id}`, { method: 'DELETE' })).status, 404);
    await stop();
    await start();
    assert.equal((await request('categories'))[0].name, 'Architecture');
    assert.equal((await request('sessions')).length, 2);
    assert.deepEqual(await request('topics'), []);

    // Free-text names create reusable areas, and matching names do not duplicate them.
    const sessionPayload = { date: new Date().toISOString().slice(0, 10), slots: 1, sessionType: 'learning' };
    const freeText = await request('sessions', { ...sessionPayload, focusAreaName: '  Language practice  ' });
    const createdArea = (await request('categories')).find(item => item.id === freeText.categoryId);
    assert.equal(createdArea.name, 'Language practice');
    const reused = await request('sessions', { ...sessionPayload, focusAreaName: 'LANGUAGE PRACTICE' });
    assert.equal(reused.categoryId, freeText.categoryId);
    assert.equal((await request('categories')).filter(item => item.name === 'Language practice').length, 1);
    const renamedSession = await request(`sessions/${freeText.id}`, { ...sessionPayload, focusAreaName: 'Writing' }, 'PUT');
    assert.notEqual(renamedSession.categoryId, freeText.categoryId);
    const countBefore = (await request('categories')).length;
    for (const patch of [{ focusAreaName: '   ' }, { focusAreaName: 'Should not exist', slots: 0 }, { focusAreaName: 'Conflicting', categoryId: area.id }]) {
      const response = await fetch(`${base}/api/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...sessionPayload, ...patch }) });
      assert.equal(response.status, 400);
    }
    assert.equal((await request('categories')).length, countBefore);
    // Concurrent saves with the same new name reuse one area.
    const concurrent = await Promise.all([request('sessions', { ...sessionPayload, focusAreaName: 'Concurrent' }), request('sessions', { ...sessionPayload, focusAreaName: 'Concurrent' })]);
    assert.equal(concurrent[0].categoryId, concurrent[1].categoryId);

    // Recency survives updates, related activity, and restarts; full lists remain available.
    const areas = [];
    for (let i = 0; i < 6; i++) areas.push(await request('categories', { name: `Area ${i}` }));
    assert.equal((await request('categories'))[0].id, areas[5].id);
    await request(`categories/${areas[0].id}`, { name: 'Updated oldest area' }, 'PUT');
    assert.equal((await request('categories'))[0].id, areas[0].id);
    const children = [];
    for (let i = 0; i < 6; i++) children.push(await request('topics', { categoryId: areas[0].id, name: `Child ${i}`, status: 'Not started' }));
    await request(`topics/${children[0].id}`, { ...children[0], name: 'Updated oldest child' }, 'PUT');
    assert.equal((await request('topics'))[0].id, children[0].id);
    await request('sessions', { ...sessionPayload, categoryId: areas[0].id, topicId: children[1].id });
    assert.equal((await request('topics'))[0].id, children[1].id);
    assert.equal((await request('categories'))[0].id, areas[0].id);
    assert.ok((await request('topics'))[0].updatedAt);
    await stop();
    await start();
    assert.equal((await request('topics'))[0].id, children[1].id);
    assert.equal((await request('topics')).filter(item => item.categoryId === areas[0].id).length, 6);
    assert.ok((await request('categories')).length > 5);
  } finally { await stop(); await rm(directory, { recursive: true, force: true }); }
});
