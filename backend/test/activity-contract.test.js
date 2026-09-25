const { Client } = require('pg');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');
const { createTestDatabase } = require('../testing/database');

test('PostgreSQL: review recency, relationship edits, validation and health', async () => {
  const database = await createTestDatabase();
  let server;
  try {
    server = spawn(process.execPath, ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: '0',
        DATABASE_URL: database.url,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const base = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('API startup timed out')), 15000);
      server.stdout.on('data', (chunk) => {
        const match = String(chunk).match(/http:\/\/localhost:\d+/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[0]);
        }
      });
      server.once('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`API exited ${code}`));
      });
      server.stderr.on('data', (chunk) => process.stderr.write(chunk));
    });
    async function request(route, body, method = body ? 'POST' : 'GET', status = 200) {
      const response = await fetch(`${base}${route}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const value = await response.json();
      assert.equal(response.status, status, JSON.stringify(value));
      return value;
    }
    assert.equal((await request('/health')).database, 'postgresql');
    const area = await request('/api/focus_areas', { name: 'Systems' }, 'POST', 201);
    assert.equal('archivedAt' in area, false);
    const revision = await request('/api/focus_areas', { name: 'Revision' }, 'POST', 201);
    const topic = await request(
      '/api/subtopics',
      { name: 'Caching', status: 'Completed', id_focus_area: area.id_focus_area },
      'POST',
      201,
    );
    const session = await request(
      '/api/sessions',
      {
        date: '2020-01-01',
        slots: 2,
        id_focus_area: area.id_focus_area,
        id_subtopic: topic.id_subtopic,
      },
      'POST',
      201,
    );
    const review = await request(
      '/api/sessions',
      {
        date: '2020-01-03',
        slots: 1,
        id_focus_area: revision.id_focus_area,
        id_subtopic: topic.id_subtopic,
      },
      'POST',
      201,
    );
    let activity = (await request('/api/subtopics'))[0];
    assert.equal(activity.sessionCount, 2);
    assert.equal(activity.totalMinutes, 90);
    assert.equal(activity.lastCovered, '2020-01-03');
    assert.equal(activity.lastReviewed, '2020-01-03');
    assert.equal(activity.status, 'Completed');
    await request(`/api/sessions/${review.id_session}`, { ...review, date: '2019-12-31' }, 'PUT');
    assert.equal((await request('/api/subtopics'))[0].lastCovered, '2020-01-01');
    await request(
      `/api/subtopics/${topic.id_subtopic}`,
      { ...topic, name: 'Cache patterns' },
      'PUT',
    );
    assert.equal(
      (await request('/api/sessions')).find((row) => row.id_session === review.id_session)
        .id_focus_area,
      revision.id_focus_area,
    );
    await request(`/api/sessions/${session.id_session}`, undefined, 'DELETE');
    assert.equal((await request('/api/subtopics'))[0].totalMinutes, 30);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await request('/api/sessions', { slots: 1, date: tomorrow }, 'POST', 400);
    await request('/api/focus_areas', { name: 'x'.repeat(201) }, 'POST', 400);
    const malformed = await fetch(`${base}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid',
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error, 'Invalid JSON request.');
    await request(`/api/focus_areas/${area.id_focus_area}`, undefined, 'DELETE');
    const keptReview = (await request('/api/sessions'))[0];
    assert.equal(keptReview.id_focus_area, revision.id_focus_area);
    assert.equal(keptReview.id_subtopic, null);
    assert.deepEqual(await request('/api/subtopics'), []);
    // A database failure must reach central error handling as 500, not validation 400.
    const client = new Client({ connectionString: database.url });
    await client.connect();
    try {
      await client.query('DROP TABLE settings');
      for (const method of ['GET', 'PUT']) {
        const result = await request(
          '/api/settings',
          method === 'PUT' ? {} : undefined,
          method,
          500,
        );
        assert.equal(result.error, 'Unable to complete the request. Please try again.');
      }
    } finally {
      await client.end();
    }
  } finally {
    if (server && server.exitCode === null) {
      const exited = once(server, 'exit');
      server.kill();
      await exited;
    }
    await database.close();
  }
});
