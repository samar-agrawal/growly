import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityState } from '../lib/activity.mjs';

test('activity buckets use UTC dates and distinguish never studied', () => {
  assert.equal(activityState({}, '2026-09-24').key, 'never');
  for (const [date, key] of [
    ['2026-09-24', 'recent'],
    ['2026-09-17', 'recent'],
    ['2026-09-16', 'quiet'],
    ['2026-09-10', 'quiet'],
    ['2026-09-09', 'stale'],
  ])
    assert.equal(activityState({ lastCovered: date }, '2026-09-24').key, key);
  assert.equal(activityState({ lastCovered: '2026-09-23' }, '2026-09-24').label, 'Yesterday');
});
