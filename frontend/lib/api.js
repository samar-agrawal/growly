const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function fetchJson(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed for ${path}: ${response.status}`);
  }

  return response.json();
}

export async function fetchDashboardData() {
  const [dashboard, categories, topics, sessions] = await Promise.all([
    fetchJson('/api/dashboard'),
    fetchJson('/api/categories'),
    fetchJson('/api/topics'),
    fetchJson('/api/sessions'),
  ]);

  return { dashboard, categories, topics, sessions };
}
