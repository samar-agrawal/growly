const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

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
    const response = await fetch(`${base}/api/${route}`, body ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    const json = await response.json();
    assert.ok(response.ok, JSON.stringify(json));
    return json;
  }
  try {
    await start();
    await request('settings', { weeklyCommitmentMinutes: 450, weeklyBufferMinutes: 90, timezone: 'UTC', weekStartDay: 'Monday', revisionSlots: 2 }, 'PUT');
    const area = await request('categories', { name: 'System design', curriculumEnabled: true });
    const subtopic = await request('topics', { name: 'Caching', categoryId: area.id, status: 'Completed' });
    assert.ok(subtopic.completedAt);
    await request('sessions', { date: '2000-01-01', durationMinutes: 999, categoryId: area.id, topicId: subtopic.id });
    await request('sessions', { date: new Date().toISOString().slice(0, 10), durationMinutes: 60, categoryId: area.id, topicId: subtopic.id });
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
  } finally { await stop(); await rm(directory, { recursive: true, force: true }); }
});
