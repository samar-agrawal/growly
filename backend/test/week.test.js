const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getWeek } = require('../week');

test('week boundaries and remaining days include today', () => {
  const monday = { timezone: 'UTC', weekStartDay: 'Monday' };
  const start = getWeek(monday, new Date('2026-09-21T12:00:00Z'));
  assert.equal(start.weekStart, '2026-09-21');
  assert.equal(start.weekEnd, '2026-09-28');
  assert.equal(start.daysRemaining, 7);
  assert.equal(getWeek(monday, new Date('2026-09-27T23:59:00Z')).daysRemaining, 1);
  const sunday = getWeek({ ...monday, weekStartDay: 'Sunday' }, new Date('2026-09-27T12:00:00Z'));
  assert.equal(sunday.weekStart, '2026-09-27');
  assert.equal(sunday.daysRemaining, 7);
});

test('timezone and DST affect the local date, not calendar-day lengths', () => {
  const instant = new Date('2026-09-27T23:30:00Z');
  assert.equal(getWeek({ timezone: 'Europe/Berlin', weekStartDay: 'Monday' }, instant).daysRemaining, 7);
  assert.equal(getWeek({ timezone: 'America/Los_Angeles', weekStartDay: 'Monday' }, instant).daysRemaining, 1);
  const dst = getWeek({ timezone: 'Europe/Berlin', weekStartDay: 'Monday' }, new Date('2026-03-29T12:00:00Z'));
  assert.equal(dst.daysRemaining, 1);
  assert.equal(dst.weekStart, '2026-03-23');
  assert.equal(getWeek({}, instant).weekStartDay, 'Monday');
});
