// Calendar-day arithmetic avoids DST changing the remaining-day count.
function getWeek(settings, now = new Date()) {
  const timezone = settings.timezone || 'UTC';
  const weekStartDay = settings.weekStartDay || 'Monday';
  const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = type => parts.find(item => item.type === type).value;
  const today = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`);
  const start = new Date(today);
  const startDay = weekStartDay === 'Sunday' ? 0 : 1;
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() - startDay + 7) % 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return {
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
    weekStartDay,
    timezone,
    daysRemaining: Math.round((end - today) / 86400000),
  };
}
module.exports = { getWeek };
