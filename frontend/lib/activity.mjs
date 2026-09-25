export function activityState(subtopic, today = new Date().toISOString().slice(0, 10)) {
  if (!subtopic.lastCovered) return { key: 'never', label: 'Not studied yet', days: null };
  const days = Math.max(
    0,
    Math.floor((Date.parse(today) - Date.parse(subtopic.lastCovered)) / 86400000),
  );
  return {
    key: days <= 7 ? 'recent' : days <= 14 ? 'quiet' : 'stale',
    label: days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`,
    days,
  };
}
