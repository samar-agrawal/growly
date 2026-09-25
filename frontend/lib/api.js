export async function requestJson(path, options = {}) {
  const { method = 'GET', body } = options;
  const response = await fetch(path, {
    method,
    signal: AbortSignal.timeout(20000),
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error('The server returned an unexpected response. Please try again.');
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed for ${path}: ${response.status}`);
  }

  return data;
}

export async function fetchDashboardData() {
  const [settings, dashboard, focus_areas, subtopics, sessions] = await Promise.all([
    requestJson('/api/settings'),
    requestJson('/api/dashboard'),
    requestJson('/api/focus_areas'),
    requestJson('/api/subtopics'),
    requestJson('/api/sessions'),
  ]);

  return { settings, dashboard, focus_areas, subtopics, sessions };
}

export function saveSettings(settings) {
  return requestJson('/api/settings', { method: 'PUT', body: settings });
}

export function createFocusArea(focusArea) {
  return requestJson('/api/focus_areas', { method: 'POST', body: focusArea });
}

export function createSubtopic(subtopic) {
  return requestJson('/api/subtopics', { method: 'POST', body: subtopic });
}

export function createSession(session) {
  return requestJson('/api/sessions', { method: 'POST', body: session });
}

const resources = { area: 'focus_areas', subtopic: 'subtopics', session: 'sessions' };

export function updateRecord(kind, id, body) {
  return requestJson(`/api/${resources[kind]}/${encodeURIComponent(id)}`, { method: 'PUT', body });
}

export function deleteRecord(kind, id) {
  return requestJson(`/api/${resources[kind]}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
