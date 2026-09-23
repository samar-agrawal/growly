'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function HomePage() {
  const [dashboard, setDashboard] = useState(null);
  const [categories, setCategories] = useState([]);
  const [topics, setTopics] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [dashboardRes, categoriesRes, topicsRes, sessionsRes] = await Promise.all([
          fetch(`${API_URL}/api/dashboard`),
          fetch(`${API_URL}/api/categories`),
          fetch(`${API_URL}/api/topics`),
          fetch(`${API_URL}/api/sessions`),
        ]);

        if (!dashboardRes.ok || !categoriesRes.ok || !topicsRes.ok || !sessionsRes.ok) {
          throw new Error('One or more API requests failed.');
        }

        setDashboard(await dashboardRes.json());
        setCategories(await categoriesRes.json());
        setTopics(await topicsRes.json());
        setSessions(await sessionsRes.json());
      } catch (err) {
        setError(err.message || 'Unable to load the dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 text-slate-700">
        <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
          Loading dashboard...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 text-slate-700">
        <div className="mx-auto max-w-6xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-soft">
          <h1 className="mb-2 text-2xl font-bold">Unable to load dashboard</h1>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  const bufferUsed = Math.max(0, dashboard.timeLoggedMinutes - dashboard.weeklyCommitmentMinutes);

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-700">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-500">Weekly planning</p>
            <h1 className="text-3xl font-bold text-slate-900">Growly learning dashboard</h1>
          </div>
          <button className="rounded-xl bg-brand-500 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-600">
            Log session
          </button>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <StatCard label="Commitment" value={`${Math.round(dashboard.timeLoggedMinutes / 60)}h`} detail={`${Math.round(dashboard.commitmentProgress)}% of target`} />
          <StatCard label="Buffer" value={`${Math.max(0, Math.round(bufferUsed / 60))}h`} detail="Optional flex time" />
          <StatCard label="Categories" value={String(dashboard.categories)} detail="Learning groups" />
          <StatCard label="Topics" value={String(dashboard.topics)} detail="Tracked items" />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">This week</p>
              <h2 className="text-xl font-bold text-slate-900">Weekly commitment and buffer</h2>
            </div>
            <span className="text-sm font-medium text-slate-600">
              {Math.round(dashboard.timeLoggedMinutes / 60)} / {Math.round(dashboard.weeklyCommitmentMinutes / 60)} h
            </span>
          </div>

          <div className="flex h-5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${Math.min(dashboard.commitmentProgress, 100)}%` }}
            />
            <div
              className="h-full bg-amber-400"
              style={{ width: `${Math.min(dashboard.bufferProgress, 100)}%` }}
            />
          </div>

          <div className="mt-4 flex gap-5 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Commitment</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Optional buffer</span>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Categories</h3>
              <button className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-600">+ Add category</button>
            </div>
            <div className="space-y-3">
              {categories.map((category) => (
                <article key={category.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h4 className="font-semibold text-slate-900">{category.name}</h4>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${category.curriculumEnabled ? 'bg-brand-100 text-brand-600' : 'bg-amber-100 text-amber-700'}`}>
                      {category.curriculumEnabled ? 'Curriculum' : 'General'}
                    </span>
                  </div>
                  <p className="mb-2 text-sm text-slate-600">{category.description}</p>
                  <small className="text-xs text-slate-500">{category.topicCount} topics</small>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Recent activity</h3>
              <button className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">View all</button>
            </div>
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <p className="font-semibold text-slate-800">{session.topicName || 'Unstructured study'}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{session.sessionType}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>{session.durationMinutes} min</p>
                    <p>{session.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Topics</h3>
            <button className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-600">+ Add topic</button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {topics.map((topic) => (
              <article key={topic.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-slate-900">{topic.name}</h4>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    topic.status === 'Completed'
                      ? 'bg-emerald-100 text-emerald-700'
                      : topic.status === 'In Progress'
                        ? 'bg-brand-100 text-brand-600'
                        : 'bg-slate-200 text-slate-600'
                  }`}>
                    {topic.status}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{topic.notes}</p>
                <div className="mt-4 text-xs text-slate-500">Completed: {topic.completedAt || '—'}</div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value, detail }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
  );
}
