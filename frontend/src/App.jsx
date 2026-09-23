import { useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function App() {
  const [dashboard, setDashboard] = useState(null);
  const [categories, setCategories] = useState([]);
  const [topics, setTopics] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [dashboardRes, categoriesRes, topicsRes, sessionsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/dashboard`),
          fetch(`${API_BASE_URL}/api/categories`),
          fetch(`${API_BASE_URL}/api/topics`),
          fetch(`${API_BASE_URL}/api/sessions`),
        ]);

        if (!dashboardRes.ok || !categoriesRes.ok || !topicsRes.ok || !sessionsRes.ok) {
          throw new Error('One or more API requests failed.');
        }

        const dashboardData = await dashboardRes.json();
        const categoryData = await categoriesRes.json();
        const topicData = await topicsRes.json();
        const sessionData = await sessionsRes.json();

        setDashboard(dashboardData);
        setCategories(categoryData);
        setTopics(topicData);
        setSessions(sessionData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return <main className="shell"><div className="panel">Loading dashboard...</div></main>;
  }

  if (error) {
    return (
      <main className="shell">
        <div className="panel danger">
          <h1>Unable to load dashboard</h1>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="hero panel">
        <div>
          <p className="eyebrow">Weekly planning</p>
          <h1>Growly learning dashboard</h1>
        </div>
        <button className="primary-button">Log session</button>
      </header>

      <section className="summary-grid">
        <div className="panel stat-card">
          <span>Commitment</span>
          <strong>{Math.round(dashboard.timeLoggedMinutes / 60)}h</strong>
          <small>{Math.round(dashboard.commitmentProgress)}% of weekly target</small>
        </div>
        <div className="panel stat-card">
          <span>Buffer</span>
          <strong>{Math.max(0, Math.round((dashboard.timeLoggedMinutes - dashboard.weeklyCommitmentMinutes) / 60))}h</strong>
          <small>Optional flex time</small>
        </div>
        <div className="panel stat-card">
          <span>Categories</span>
          <strong>{dashboard.categories}</strong>
          <small>Active learning groups</small>
        </div>
        <div className="panel stat-card">
          <span>Topics</span>
          <strong>{dashboard.topics}</strong>
          <small>Tracked study items</small>
        </div>
      </section>

      <section className="panel progress-panel">
        <div className="progress-header">
          <div>
            <p className="eyebrow">This week</p>
            <h2>Weekly commitment and buffer</h2>
          </div>
          <span>{Math.round(dashboard.timeLoggedMinutes / 60)} / {Math.round(dashboard.weeklyCommitmentMinutes / 60)} h</span>
        </div>

        <div className="progress-track" aria-label="Weekly progress">
          <div className="commitment" style={{ width: `${Math.min(dashboard.commitmentProgress, 100)}%` }} />
          <div className="buffer" style={{ width: `${Math.max(0, Math.min(dashboard.bufferProgress, 100))}%` }} />
        </div>

        <div className="legend">
          <span><i className="dot commitment-dot" /> Commitment</span>
          <span><i className="dot buffer-dot" /> Optional buffer</span>
        </div>
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="section-header">
            <h3>Categories</h3>
            <button className="ghost-button">+ Add category</button>
          </div>
          <div className="stack-list">
            {categories.map((category) => (
              <article className="card" key={category.id}>
                <div className="card-topline">
                  <h4>{category.name}</h4>
                  <span className={`badge ${category.curriculumEnabled ? 'active' : 'passive'}`}>
                    {category.curriculumEnabled ? 'Curriculum' : 'General'}
                  </span>
                </div>
                <p>{category.description}</p>
                <small>{category.topicCount} topics</small>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="section-header">
            <h3>Recent activity</h3>
            <button className="ghost-button">View all</button>
          </div>
          <div className="stack-list">
            {sessions.map((session) => (
              <article className="activity-item" key={session.id}>
                <div>
                  <strong>{session.topicName || 'Unstructured study'}</strong>
                  <small>{session.sessionType}</small>
                </div>
                <div className="activity-meta">
                  <span>{session.durationMinutes} min</span>
                  <span>{session.date}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-header">
          <h3>Topics</h3>
          <button className="ghost-button">+ Add topic</button>
        </div>
        <div className="topic-grid">
          {topics.map((topic) => (
            <article className="topic-card" key={topic.id}>
              <div className="topic-header">
                <h4>{topic.name}</h4>
                <span className={`status ${topic.status.toLowerCase().replace(/\s+/g, '-')}`}>
                  {topic.status}
                </span>
              </div>
              <p>{topic.notes}</p>
              <div className="topic-footer">
                <span>Completed: {topic.completedAt || '—'}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
