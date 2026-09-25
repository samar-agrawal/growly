const base = process.env.SMOKE_URL || 'http://127.0.0.1:3000';
for (const route of [
  '/health',
  '/api/settings',
  '/api/dashboard',
  '/api/focus_areas',
  '/api/subtopics',
  '/api/sessions',
]) {
  const response = await fetch(`${base}${route}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${route}: HTTP ${response.status}`);
  const data = await response.json();
  if (route === '/health' && data.ok !== true) throw new Error('Frontend health failed');
  if (route === '/api/dashboard' && typeof data.timeLoggedMinutes !== 'number')
    throw new Error('Dashboard contract failed');
  console.log(`OK ${route}`);
}
