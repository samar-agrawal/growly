const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getWeek } = require('../week');

test('week boundaries and remaining days include today', () => {
  const monday = { weekStartDay: 'Monday' };
  const start = getWeek(monday, new Date('2026-09-21T12:00:00Z'));
  assert.equal(start.weekStart, '2026-09-21');
  assert.equal(start.weekEnd, '2026-09-28');
  assert.equal(start.daysRemaining, 7);
  assert.equal(getWeek(monday, new Date('2026-09-27T23:59:00Z')).daysRemaining, 1);
  const sunday = getWeek({ ...monday, weekStartDay: 'Sunday' }, new Date('2026-09-27T12:00:00Z'));
  assert.equal(sunday.weekStart, '2026-09-27');
  assert.equal(sunday.daysRemaining, 7);
});

test('UTC boundaries are stable across midnight and DST dates', () => {
  const settings = { weekStartDay: 'Monday' };
  assert.equal(getWeek(settings, new Date('2026-09-27T23:59:59Z')).daysRemaining, 1);
  assert.equal(getWeek(settings, new Date('2026-09-28T00:00:00Z')).daysRemaining, 7);
  assert.equal(getWeek(settings, new Date('2026-03-29T12:00:00Z')).daysRemaining, 1);
  assert.equal(getWeek(settings, new Date('2026-10-25T12:00:00Z')).daysRemaining, 1);
  assert.equal('timezone' in getWeek(settings), false);
});
