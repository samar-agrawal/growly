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
    const legacySchema = (await readFile(path.join(__dirname, 'fixtures/legacy-schema.sql'), 'utf8')).replaceAll('  updated_at TEXT,\n', '');
    const legacyDb = new sqlite3.Database(path.join(directory, 'growly.db'));
    await new Promise((resolve, reject) => legacyDb.exec(legacySchema + `
      INSERT INTO categories (id, name, created_at) VALUES ('legacy-area', 'Existing area', '2025-01-01 12:00:00');
      INSERT INTO topics (id, category_id, name, status, created_at) VALUES ('legacy-topic', 'legacy-area', 'Existing topic', 'Not started', '2025-01-02 12:00:00');
    `, error => error ? reject(error) : resolve()));
    await new Promise((resolve, reject) => legacyDb.close(error => error ? reject(error) : resolve()));
    await start();
    assert.equal((await request('focus_areas'))[0].updatedAt, '2025-01-01T12:00:00.000Z');
    assert.equal((await request('subtopics'))[0].updatedAt, '2025-01-02T12:00:00.000Z');
    await request('focus_areas/legacy-area', undefined, 'DELETE');
    assert.equal((await request('settings')).weeklyCommitmentMinutes, null);
    assert.deepEqual(await request('focus_areas'), []);
    assert.deepEqual(await request('subtopics'), []);
    assert.deepEqual(await request('sessions'), []);
    assert.equal((await request('dashboard')).timeLoggedMinutes, 0);
    await request('settings', { weeklyCommitmentMinutes: 450, weeklyBufferMinutes: 90, weekStartDay: 'Monday' }, 'PUT');
    const area = await request('focus_areas', { name: 'System design', curriculumEnabled: true });
    const subtopic = await request('subtopics', { name: 'Caching', id_focus_area: area.id_focus_area, status: 'Completed' });
    assert.ok(subtopic.completedAt);
    await request('sessions', { date: '2000-01-01', slots: 3, id_focus_area: area.id_focus_area, id_subtopic: subtopic.id_subtopic });
    await request('sessions', { date: new Date().toISOString().slice(0, 10), slots: 2, id_focus_area: area.id_focus_area, id_subtopic: subtopic.id_subtopic });
    const dashboard = await request('dashboard');
    assert.equal(dashboard.timeLoggedMinutes, 60);
    assert.equal(dashboard.sessions, 1);
    await stop();
    await start();
    const settings = await request('settings');
    assert.equal('timezone' in settings, false);
    assert.equal('timezone' in (await request('dashboard')), false);
    assert.equal(settings.weeklyCommitmentMinutes, 450);
    assert.equal(settings.weeklyBufferMinutes, 90);
    assert.equal((await request('focus_areas'))[0].id_focus_area, area.id_focus_area);
    assert.equal((await request('subtopics'))[0].id_subtopic, subtopic.id_subtopic);
    await request('settings', { weeklyCommitmentMinutes: 0 }, 'PUT');
    assert.equal('revisionSlots' in (await request('settings')), false);
    for (const value of [-1, 'invalid', 10081]) {
      const response = await fetch(`${base}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weeklyCommitmentMinutes: value }) });
      assert.equal(response.status, 400);
    }
    const invalidTopic = await fetch(`${base}/api/subtopics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Orphan', id_focus_area: 'missing' }) });
    assert.equal(invalidTopic.status, 400);

    const secondArea = await request('focus_areas', { name: 'Databases' });
    const renamed = await request(`focus_areas/${area.id_focus_area}`, { name: 'Architecture', description: 'Updated description' }, 'PUT');
    assert.equal(renamed.name, 'Architecture');
    await request(`subtopics/${subtopic.id_subtopic}`, { name: 'Cache design', id_focus_area: secondArea.id_focus_area, status: 'In Progress', notes: 'Updated notes' }, 'PUT');
    assert.equal((await request('subtopics'))[0].completedAt, null);
    let records = await request('sessions');
    assert.ok(records.every(item => item.id_focus_area === secondArea.id_focus_area && item.subtopicName === 'Cache design'));
    const recent = records.find(item => item.date !== '2000-01-01');
    const changed = await request(`sessions/${recent.id_session}`, { ...recent, slots: 5, notes: 'Updated session' }, 'PUT');
    assert.equal(changed.durationMinutes, 150);
    assert.equal((await request('dashboard')).timeLoggedMinutes, 150);
    await request(`sessions/${recent.id_session}`, { ...changed, date: '2000-02-01' }, 'PUT');
    assert.equal((await request('dashboard')).timeLoggedMinutes, 0);
    await request(`sessions/${recent.id_session}`, { ...changed }, 'PUT');
    for (const patch of [{ slots: 0 }, { slots: -1 }, { slots: 1.5 }, { date: '2026-02-30' }, { id_focus_area: area.id_focus_area }]) {
      const response = await fetch(`${base}/api/sessions/${recent.id_session}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...changed, ...patch }) });
      assert.equal(response.status, 400, JSON.stringify(patch));
    }
    await request(`subtopics/${subtopic.id_subtopic}`, undefined, 'DELETE');
    records = await request('sessions');
    assert.ok(records.every(item => item.id_subtopic === null && item.subtopicName === null && item.id_focus_area === secondArea.id_focus_area));
    const child = await request('subtopics', { name: 'Indexes', id_focus_area: secondArea.id_focus_area, status: 'Not started' });
    await request('sessions', { date: new Date().toISOString().slice(0, 10), slots: 1, id_focus_area: secondArea.id_focus_area, id_subtopic: child.id_subtopic });
    const totalBefore = (await request('dashboard')).timeLoggedMinutes;
    await request(`focus_areas/${secondArea.id_focus_area}`, undefined, 'DELETE');
    assert.deepEqual(await request('subtopics'), []);
    assert.ok((await request('sessions')).every(item => item.id_focus_area === null && item.id_subtopic === null));
    assert.equal((await request('dashboard')).timeLoggedMinutes, totalBefore);
    await request(`sessions/${recent.id_session}`, undefined, 'DELETE');
    assert.equal((await request('dashboard')).timeLoggedMinutes, totalBefore - 150);
    assert.equal((await fetch(`${base}/api/sessions/${recent.id_session}`, { method: 'DELETE' })).status, 404);
    await stop();
    await start();
    assert.equal((await request('focus_areas'))[0].name, 'Architecture');
    assert.equal((await request('sessions')).length, 2);
    assert.deepEqual(await request('subtopics'), []);

    // Free-text names create reusable areas, and matching names do not duplicate them.
    const sessionPayload = { date: new Date().toISOString().slice(0, 10), slots: 1 };
    const freeText = await request('sessions', { ...sessionPayload, focusAreaName: '  Language practice  ' });
    const createdArea = (await request('focus_areas')).find(item => item.id_focus_area === freeText.id_focus_area);
    assert.equal(createdArea.name, 'Language practice');
    const reused = await request('sessions', { ...sessionPayload, focusAreaName: 'LANGUAGE PRACTICE' });
    assert.equal(reused.id_focus_area, freeText.id_focus_area);
    assert.equal((await request('focus_areas')).filter(item => item.name === 'Language practice').length, 1);
    const renamedSession = await request(`sessions/${freeText.id_session}`, { ...sessionPayload, focusAreaName: 'Writing' }, 'PUT');
    assert.notEqual(renamedSession.id_focus_area, freeText.id_focus_area);
    const countBefore = (await request('focus_areas')).length;
    for (const patch of [{ focusAreaName: '   ' }, { focusAreaName: 'Should not exist', slots: 0 }, { focusAreaName: 'Conflicting', id_focus_area: area.id_focus_area }]) {
      const response = await fetch(`${base}/api/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...sessionPayload, ...patch }) });
      assert.equal(response.status, 400);
    }
    assert.equal((await request('focus_areas')).length, countBefore);
    // Concurrent saves with the same new name reuse one area.
    const concurrent = await Promise.all([request('sessions', { ...sessionPayload, focusAreaName: 'Concurrent' }), request('sessions', { ...sessionPayload, focusAreaName: 'Concurrent' })]);
    assert.equal(concurrent[0].id_focus_area, concurrent[1].id_focus_area);

    // Recency survives updates, related activity, and restarts; full lists remain available.
    const areas = [];
    for (let i = 0; i < 6; i++) areas.push(await request('focus_areas', { name: `Area ${i}` }));
    assert.equal((await request('focus_areas'))[0].id_focus_area, areas[5].id_focus_area);
    await request(`focus_areas/${areas[0].id_focus_area}`, { name: 'Updated oldest area' }, 'PUT');
    assert.equal((await request('focus_areas'))[0].id_focus_area, areas[0].id_focus_area);
    const children = [];
    for (let i = 0; i < 6; i++) children.push(await request('subtopics', { id_focus_area: areas[0].id_focus_area, name: `Child ${i}`, status: 'Not started' }));
    await request(`subtopics/${children[0].id_subtopic}`, { ...children[0], name: 'Updated oldest child' }, 'PUT');
    assert.equal((await request('subtopics'))[0].id_subtopic, children[0].id_subtopic);
    await request('sessions', { ...sessionPayload, id_focus_area: areas[0].id_focus_area, id_subtopic: children[1].id_subtopic });
    assert.equal((await request('subtopics'))[0].id_subtopic, children[1].id_subtopic);
    assert.equal((await request('focus_areas'))[0].id_focus_area, areas[0].id_focus_area);
    assert.ok((await request('subtopics'))[0].updatedAt);
    await stop();
    await start();
    assert.equal((await request('subtopics'))[0].id_subtopic, children[1].id_subtopic);
    assert.equal((await request('subtopics')).filter(item => item.id_focus_area === areas[0].id_focus_area).length, 6);
    assert.ok((await request('focus_areas')).length > 5);

    // Revision is a normal Focus Area with its own optional hours budget.
    await request('settings', { weeklyCommitmentMinutes: 450, weeklyBufferMinutes: 60, weeklyRevisionMinutes: 90 }, 'PUT');
    const beforeRevision = await request('dashboard');
    const revision = await request('sessions', { ...sessionPayload, focusAreaName: 'Revision', slots: 2 });
    assert.equal('sessionType' in revision, false);
    const afterRevision = await request('dashboard');
    assert.equal(afterRevision.revisionLoggedMinutes, 60);
    assert.equal(afterRevision.weeklyRevisionMinutes, 90);
    assert.equal(afterRevision.commitmentLoggedMinutes, beforeRevision.commitmentLoggedMinutes);
    assert.equal(afterRevision.timeLoggedMinutes, beforeRevision.timeLoggedMinutes + 60);
    await request(`sessions/${revision.id_session}`, { ...revision, slots: 3 }, 'PUT');
    assert.equal((await request('dashboard')).revisionLoggedMinutes, 90);
    await stop();
    await start();
    assert.equal((await request('settings')).weeklyRevisionMinutes, 90);
    assert.equal((await request('dashboard')).revisionLoggedMinutes, 90);
    await request(`sessions/${revision.id_session}`, undefined, 'DELETE');
    assert.equal((await request('dashboard')).revisionLoggedMinutes, 0);
    for (const value of [-1, 0.5, 10000]) {
      const response = await fetch(`${base}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weeklyRevisionMinutes: value }) });
      assert.equal(response.status, 400);
    }

    // Phase 2: opt-in curricula can be edited without changing accomplishments.
    const curriculumArea = await request('focus_areas', { name: 'Curriculum', curriculumEnabled: true });
    assert.equal(curriculumArea.curriculumEnabled, true);
    const completedChild = await request('subtopics', { name: 'Finished work', id_focus_area: curriculumArea.id_focus_area, status: 'Completed' });
    const completionDate = completedChild.completedAt;
    await request('subtopics', { name: 'Next step', id_focus_area: curriculumArea.id_focus_area, status: 'Not started' });
    await request(`subtopics/${completedChild.id_subtopic}`, { ...completedChild, notes: 'More notes' }, 'PUT');
    assert.equal((await request('subtopics')).find(item => item.id_subtopic === completedChild.id_subtopic).completedAt, completionDate);
    await request(`focus_areas/${curriculumArea.id_focus_area}`, { name: 'Curriculum', curriculumEnabled: false }, 'PUT');
    assert.equal((await request('focus_areas')).find(item => item.id_focus_area === curriculumArea.id_focus_area).curriculumEnabled, false);
    await request(`focus_areas/${curriculumArea.id_focus_area}`, { name: 'Curriculum', curriculumEnabled: true }, 'PUT');
    const savedPreferences = { studyReminders: true, browserNotifications: false, reminderIntervalMinutes: 45 };
    await request('settings', { notificationPreferences: savedPreferences }, 'PUT');
    await stop();
    await start();
    assert.deepEqual((await request('settings')).notificationPreferences, savedPreferences);
    assert.equal((await request('focus_areas')).find(item => item.id_focus_area === curriculumArea.id_focus_area).curriculumEnabled, true);
    assert.equal((await request('subtopics')).find(item => item.id_subtopic === completedChild.id_subtopic).completedAt, completionDate);
    for (const notificationPreferences of [[], 'yes', { studyReminders: 'true' }, { studyReminders: true, reminderIntervalMinutes: 0 }, { studyReminders: true, reminderIntervalMinutes: 1441 }]) {
      const response = await fetch(`${base}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notificationPreferences }) });
      assert.equal(response.status, 400);
    }
    // Phase 4: retries of a confirmed timed session count only once, including Revision.
    const timerId = '81d34e20-4525-4d80-80aa-755950b2c378';
    const beforeTimed = await request('dashboard');
    const timedPayload = { ...sessionPayload, focusAreaName: 'Revision', timerId };
    const timed = await Promise.all([request('sessions', timedPayload), request('sessions', timedPayload)]);
    assert.equal(timed[0].id_session, timed[1].id_session);
    assert.equal((await request('dashboard')).revisionLoggedMinutes, beforeTimed.revisionLoggedMinutes + 30);
    assert.equal((await request('dashboard')).timeLoggedMinutes, beforeTimed.timeLoggedMinutes + 30);
    await stop();
    await start();
    assert.equal((await request('sessions', timedPayload)).id_session, timed[0].id_session);
    assert.equal((await request('dashboard')).timeLoggedMinutes, beforeTimed.timeLoggedMinutes + 30);
  } finally { await stop(); await rm(directory, { recursive: true, force: true }); }
});
