'use client';

import { useEffect, useState } from 'react';
import { createCategory, createSession, createTopic, fetchDashboardData, saveSettings } from '../lib/api';

const defaultSettingsForm = {
  timezone: 'CET',
  weeklyCommitmentHours: 0,
  weeklyBufferHours: 0,
  weekStartDay: 'Sunday',
};

export default function HomePage() {
  const [settings, setSettings] = useState(defaultSettingsForm);
  const [dashboard, setDashboard] = useState(null);
  const [categories, setCategories] = useState([]);
  const [topics, setTopics] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [categoryDraft, setCategoryDraft] = useState({ name: '', description: '', curriculumEnabled: false });
  const [topicDraft, setTopicDraft] = useState({ name: '', categoryId: '', status: 'Not started', notes: '' });
  const [sessionDraft, setSessionDraft] = useState({
    date: new Date().toISOString().slice(0, 10),
    durationMinutes: 30,
    categoryId: '',
    topicId: '',
    sessionType: 'learning',
    outcome: '',
    notes: '',
  });

  const refreshData = async () => {
    const result = await fetchDashboardData();
    const nextSettings = {
      timezone: result.settings.timezone,
      weeklyCommitmentHours: Math.round((result.settings.weeklyCommitmentMinutes || 0) / 60),
      weeklyBufferHours: Math.round((result.settings.weeklyBufferMinutes || 0) / 60),
      weekStartDay: result.settings.weekStartDay,
    };

    setSettings(nextSettings);
    setDashboard(result.dashboard);
    setCategories(result.categories);
    setTopics(result.topics);
    setSessions(result.sessions);

    if (!result.categories.length) {
      setTopicDraft((current) => ({ ...current, categoryId: '' }));
    } else if (!topicDraft.categoryId) {
      setTopicDraft((current) => ({ ...current, categoryId: result.categories[0].id }));
    }

    if (!result.categories.length) {
      setSessionDraft((current) => ({ ...current, categoryId: '' }));
    } else if (!sessionDraft.categoryId) {
      setSessionDraft((current) => ({ ...current, categoryId: result.categories[0].id }));
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await refreshData();
      } catch (err) {
        setError(err.message || 'Unable to load the dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSettingsSave = async (event) => {
    event.preventDefault();
    try {
      setError('');
      const payload = {
        timezone: settings.timezone,
        weeklyCommitmentMinutes: Number(settings.weeklyCommitmentHours) * 60,
        weeklyBufferMinutes: Number(settings.weeklyBufferHours) * 60,
        revisionSlots: 0,
        weekStartDay: settings.weekStartDay,
        notificationPreferences: {
          studyReminders: false,
          browserNotifications: false,
        },
      };

      await saveSettings(payload);
      await refreshData();
    } catch (err) {
      setError(err.message || 'Unable to save settings.');
    }
  };

  const handleCategorySubmit = async (event) => {
    event.preventDefault();
    try {
      setError('');
      await createCategory({
        name: categoryDraft.name,
        description: categoryDraft.description,
        curriculumEnabled: categoryDraft.curriculumEnabled,
      });
      setCategoryDraft({ name: '', description: '', curriculumEnabled: false });
      await refreshData();
    } catch (err) {
      setError(err.message || 'Unable to add category.');
    }
  };

  const handleTopicSubmit = async (event) => {
    event.preventDefault();
    try {
      setError('');
      await createTopic({
        name: topicDraft.name,
        categoryId: topicDraft.categoryId,
        status: topicDraft.status,
        notes: topicDraft.notes,
      });
      setTopicDraft({ name: '', categoryId: categories[0]?.id || '', status: 'Not started', notes: '' });
      await refreshData();
    } catch (err) {
      setError(err.message || 'Unable to add topic.');
    }
  };

  const handleSessionSubmit = async (event) => {
    event.preventDefault();
    try {
      setError('');
      await createSession({
        date: sessionDraft.date,
        durationMinutes: Number(sessionDraft.durationMinutes),
        categoryId: sessionDraft.categoryId || null,
        topicId: sessionDraft.topicId || null,
        sessionType: sessionDraft.sessionType,
        outcome: sessionDraft.outcome,
        notes: sessionDraft.notes,
      });
      setSessionDraft({
        date: new Date().toISOString().slice(0, 10),
        durationMinutes: 30,
        categoryId: categories[0]?.id || '',
        topicId: '',
        sessionType: 'learning',
        outcome: '',
        notes: '',
      });
      await refreshData();
    } catch (err) {
      setError(err.message || 'Unable to save session.');
    }
  };

  if (loading) {
    return <main className="min-h-screen bg-slate-100 p-6"><div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-8 text-slate-700 shadow-soft">Loading weekly tracker...</div></main>;
  }

  if (error && !dashboard) {
    return <main className="min-h-screen bg-slate-100 p-6"><div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 p-8 text-rose-700 shadow-soft"><h1 className="mb-2 text-2xl font-bold">Unable to load dashboard</h1><p>{error}</p></div></main>;
  }

  const bufferUsed = Math.max(0, (dashboard?.timeLoggedMinutes || 0) - (dashboard?.weeklyCommitmentMinutes || 0));

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-700">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-500">Weekly focus</p>
              <h1 className="text-3xl font-bold text-slate-900">Growly</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              {['overview', 'settings'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    activeTab === tab ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tab === 'overview' ? 'Overview' : 'Settings'}
                </button>
              ))}
            </div>
          </div>
        </header>

        {activeTab === 'overview' && (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <StatCard label="Commitment" value={`${Math.round((dashboard?.timeLoggedMinutes || 0) / 60)}h`} detail={`${Math.round(dashboard?.commitmentProgress || 0)}% of target`} />
              <StatCard label="Buffer" value={`${Math.max(0, Math.round(bufferUsed / 60))}h`} detail="Optional flex time" />
              <StatCard label="Topics" value={String(dashboard?.categories || 0)} detail="Main topics" />
              <StatCard label="Subtopics" value={String(dashboard?.topics || 0)} detail="Tracked items" />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">This week</p>
                  <h2 className="text-xl font-bold text-slate-900">Weekly commitment and buffer</h2>
                </div>
                <span className="text-sm font-medium text-slate-600">
                  {Math.round((dashboard?.timeLoggedMinutes || 0) / 60)} / {Math.round((dashboard?.weeklyCommitmentMinutes || 0) / 60)} h
                </span>
              </div>

              <div className="flex h-5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-emerald-500" style={{ width: `${Math.min(dashboard?.commitmentProgress || 0, 100)}%` }} />
                <div className="h-full bg-amber-400" style={{ width: `${Math.min(dashboard?.bufferProgress || 0, 100)}%` }} />
              </div>

              <div className="mt-4 flex gap-5 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Commitment</span>
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Optional buffer</span>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
                <h3 className="mb-4 text-xl font-bold text-slate-900">Main topics</h3>
                {categories.length === 0 ? (
                  <p className="text-sm text-slate-500">No topics added yet. Use the Library tab to create your first topic.</p>
                ) : (
                  <div className="space-y-3">
                    {categories.map((category) => (
                      <article key={category.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h4 className="font-semibold text-slate-900">{category.name}</h4>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${category.curriculumEnabled ? 'bg-brand-100 text-brand-600' : 'bg-amber-100 text-amber-700'}`}>
                            {category.curriculumEnabled ? 'Curriculum' : 'General'}
                          </span>
                        </div>
                        <p className="mb-2 text-sm text-slate-600">{category.description || 'No description yet.'}</p>
                        <small className="text-xs text-slate-500">{category.topicCount} subtopics</small>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
                <h3 className="mb-4 text-xl font-bold text-slate-900">Recent activity</h3>
                {sessions.length === 0 ? (
                  <p className="text-sm text-slate-500">No sessions logged yet. Add time from the app to populate this list.</p>
                ) : (
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
                )}
              </div>
            </section>
          </>
        )}

        {activeTab === 'settings' && (
          <section className="space-y-6">
            <form onSubmit={handleSettingsSave} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Settings</h3>
                <button type="submit" className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white">Save settings</button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Weekly commitment (hours)
                  <input
                    type="number"
                    min="0"
                    value={settings.weeklyCommitmentHours}
                    onChange={(event) => setSettings((current) => ({ ...current, weeklyCommitmentHours: Number(event.target.value) || 0 }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none ring-0 focus:border-brand-500"
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Optional buffer (hours)
                  <input
                    type="number"
                    min="0"
                    value={settings.weeklyBufferHours}
                    onChange={(event) => setSettings((current) => ({ ...current, weeklyBufferHours: Number(event.target.value) || 0 }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none ring-0 focus:border-brand-500"
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Week start day
                  <select
                    value={settings.weekStartDay}
                    onChange={(event) => setSettings((current) => ({ ...current, weekStartDay: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-brand-500"
                  >
                    <option>Sunday</option>
                    <option>Monday</option>
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Timezone
                  <input
                    type="text"
                    value={settings.timezone}
                    onChange={(event) => setSettings((current) => ({ ...current, timezone: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-brand-500"
                  />
                </label>
              </div>
            </form>

            <form onSubmit={handleCategorySubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Add main topic</h3>
                <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Save main topic</button>
              </div>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Main topic name"
                  value={categoryDraft.name}
                  onChange={(event) => setCategoryDraft((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-brand-500"
                  required
                />
                <textarea
                  rows="3"
                  placeholder="Optional description"
                  value={categoryDraft.description}
                  onChange={(event) => setCategoryDraft((current) => ({ ...current, description: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-brand-500"
                />
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={categoryDraft.curriculumEnabled}
                    onChange={(event) => setCategoryDraft((current) => ({ ...current, curriculumEnabled: event.target.checked }))}
                  />
                  Enable curriculum tracking
                </label>
              </div>
            </form>

            <form onSubmit={handleTopicSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Add subtopic</h3>
                <button type="submit" className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white">Save subtopic</button>
              </div>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Subtopic name"
                  value={topicDraft.name}
                  onChange={(event) => setTopicDraft((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-brand-500"
                  required
                />

                <select
                  value={topicDraft.categoryId}
                  onChange={(event) => setTopicDraft((current) => ({ ...current, categoryId: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-brand-500"
                  required
                >
                  <option value="">Select main topic</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>

                <select
                  value={topicDraft.status}
                  onChange={(event) => setTopicDraft((current) => ({ ...current, status: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-brand-500"
                >
                  <option>Not started</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                </select>

                <textarea
                  rows="3"
                  placeholder="Notes"
                  value={topicDraft.notes}
                  onChange={(event) => setTopicDraft((current) => ({ ...current, notes: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none focus:border-brand-500"
                />
              </div>
            </form>
          </section>
        )}

        {error ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div> : null}
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
