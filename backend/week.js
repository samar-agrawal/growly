// Weekly boundaries use UTC calendar days, independent of the server locale.
function getWeek(settings, now = new Date()) {
  const weekStartDay = settings.weekStartDay || 'Monday';
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(today);
  const startDay = weekStartDay === 'Sunday' ? 0 : 1;
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() - startDay + 7) % 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return {
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
    weekStartDay,
    daysRemaining: Math.round((end - today) / 86400000),
  };
}
module.exports = { getWeek };
