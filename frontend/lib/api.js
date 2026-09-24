const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function requestJson(path, options = {}) {
  const { method = 'GET', body } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

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

export async function saveSettings(settings) {
  return requestJson('/api/settings', { method: 'PUT', body: settings });
}

export async function createFocusArea(focusArea) {
  return requestJson('/api/focus_areas', { method: 'POST', body: focusArea });
}

export async function createSubtopic(subtopic) {
  return requestJson('/api/subtopics', { method: 'POST', body: subtopic });
}

export async function createSession(session) {
  return requestJson('/api/sessions', { method: 'POST', body: session });
}

const resources = { area: 'focus_areas', subtopic: 'subtopics', session: 'sessions' };

export function updateRecord(kind, id, body) {
  return requestJson(`/api/${resources[kind]}/${encodeURIComponent(id)}`, { method: 'PUT', body });
}

export function deleteRecord(kind, id) {
  return requestJson(`/api/${resources[kind]}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
