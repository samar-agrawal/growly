import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTimer, remainingMilliseconds, pauseTimer, resumeTimer, restoreTimer } from '../lib/study-timer.mjs';

const id = '81d34e20-4525-4d80-80aa-755950b2c378';
const payload = { slots: 1, date: '2026-09-24', focusAreaName: 'Revision' };

test('timer measures elapsed wall time even when ticks are delayed', () => {
  const timer = createTimer(payload, 'Revision', id, 1000);
  assert.equal(remainingMilliseconds(timer, 61000), 29 * 60000);
  assert.equal(remainingMilliseconds(timer, 3601000), 0);
  assert.equal(timer.payload.timerId, id);
  assert.equal(timer.payload.focusAreaName, 'Revision');
});

test('pause excludes paused time; resume preserves remaining duration', () => {
  const timer = createTimer(payload, 'Revision', id, 1000);
  const paused = pauseTimer(timer, 61000);
  assert.equal(paused.status, 'paused');
  assert.equal(remainingMilliseconds(paused, 9999999), 29 * 60000);
  const resumed = resumeTimer(paused, 10000000);
  assert.equal(remainingMilliseconds(resumed, 10060000), 28 * 60000);
  assert.equal(pauseTimer(resumed, 99999999).status, 'complete');
});

test('reload restores a paused block or an expired block awaiting confirmation', () => {
  const timer = createTimer(payload, 'Revision', id, 1000);
  const paused = pauseTimer(timer, 61000);
  assert.deepEqual(restoreTimer(JSON.stringify(paused), 9999999), paused);
  const complete = restoreTimer(JSON.stringify(timer), 9999999);
  assert.equal(complete.status, 'complete');
  assert.equal(complete.payload.slots, 1);
  assert.equal(complete.payload.timerId, id);
});

test('invalid timer drafts and corrupted persisted state are rejected', () => {
  for (const slots of [0, -1, 1.5, 49, 'invalid']) assert.throws(() => createTimer({ ...payload, slots }, 'Revision', id));
  for (const raw of ['bad json', 'null', '{}', JSON.stringify({ id, status: 'running', endsAt: null })]) assert.equal(restoreTimer(raw), null);
});
