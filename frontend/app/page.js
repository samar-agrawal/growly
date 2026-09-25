'use client';

import { cloneElement, useEffect, useId, useRef, useState } from 'react';
import GrowthObjectives from '../components/GrowthObjectives';
import ActivityOverview from '../components/ActivityOverview';
import StudyTimer, { useStudyTimer } from '../components/StudyTimer';
import StudyNotifications, {
  showStudyNotification,
  useStudyReminders,
} from '../components/StudyNotifications';
import {
  createFocusArea,
  createSession,
  createSubtopic,
  fetchDashboardData,
  saveSettings,
  updateRecord,
  deleteRecord,
} from '../lib/api';

const hours = (minutes = 0) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(minutes / 60);
const titles = {
  objectives: 'Learning with a purpose.',
  overview: 'Your brain called. It’s curious.',
  library: 'Curiosity, with folders.',
  sessions: 'Your brain has receipts.',
  settings: 'Ambition, meet calendar.',
  activity: 'A little refresher never hurt.',
};
const recordId = (kind, record) =>
  record?.[{ area: 'id_focus_area', subtopic: 'id_subtopic', session: 'id_session' }[kind]];
const labels = { area: 'Focus Area', subtopic: 'subtopic', session: 'session' };

function Icon({ name, ...props }) {
  const paths = {
    leaf: 'M20 4C9 2 3 7 5 14s13 7 15-10ZM5 20l9-10',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    book: 'M12 5v16M3 3c4 0 7 0 9 2 2-2 5-2 9-2v16c-4 0-7 0-9 2-2-2-5-2-9-2z',
    settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
    plus: 'M12 5v14M5 12h14',
    clock: 'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    arrow: 'M5 12h14m-5-5 5 5-5 5',
    check: 'm5 12 4 4L19 6',
    close: 'm6 6 12 12M6 18 18 6',
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.leaf} />
    </svg>
  );
}

export default function HomePage() {
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState({});
  const [deleting, setDeleting] = useState(false);
  const [reminder, setReminder] = useState('');
  const announce = (message) => {
    setReminder(message);
    showStudyNotification(message, data?.settings.notificationPreferences?.browserNotifications);
  };
  const studyTimer = useStudyTimer(() =>
    announce('Time is up! Take a break — stretch, rest your eyes, and get some water.'),
  );
  useStudyReminders(data?.settings.notificationPreferences, Boolean(studyTimer.timer), announce);
  const dialog = useRef(null);
  const trigger = useRef(null);
  const heading = useRef(null);
  const previousTab = useRef('overview');

  async function refresh() {
    const result = await fetchDashboardData();
    setData(result);
    setSettings({
      notificationPreferences: result.settings.notificationPreferences || {},
      weeklyCommitmentHours:
        result.settings.weeklyCommitmentMinutes == null
          ? ''
          : result.settings.weeklyCommitmentMinutes / 60,
      weeklyBufferHours:
        result.settings.weeklyBufferMinutes == null ? '' : result.settings.weeklyBufferMinutes / 60,
      weeklyRevisionHours:
        result.settings.weeklyRevisionMinutes == null
          ? ''
          : result.settings.weeklyRevisionMinutes / 60,
      weekStartDay: result.settings.weekStartDay || '',
    });
  }
  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, []);
  useEffect(() => {
    if (previousTab.current !== tab) {
      heading.current?.focus();
      previousTab.current = tab;
    }
  }, [tab]);
  useEffect(() => {
    if (modal) {
      dialog.current?.showModal();
    }
  }, [modal]);
  function open(kind, id_focus_area = '', record = null, remove = false) {
    trigger.current = document.activeElement;
    setError('');
    setNotice('');
    setDeleting(remove);
    const defaults = {
      area: { name: '', description: '', curriculumEnabled: false },
      subtopic: { name: '', id_focus_area, status: '', notes: '' },
      session: {
        id_focus_area,
        id_subtopic: '',
        focusAreaMode: 'existing',
        focusAreaName: '',
        date: '',
        slots: '',
        outcome: '',
        notes: '',
      },
    }[kind];
    setDraft({
      ...Object.fromEntries(
        Object.entries(defaults).map(([key, value]) => [key, record?.[key] ?? value]),
      ),
      id: recordId(kind, record),
    });
    setModal(kind);
  }
  function dismissDialog() {
    dialog.current?.close();
    setModal(null);
    if (trigger.current?.isConnected) trigger.current.focus();
    else heading.current?.focus();
  }
  function close() {
    if (!busy) dismissDialog();
  }
  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (deleting) {
        await deleteRecord(modal, draft.id);
      } else {
        const payload =
          modal === 'area'
            ? {
                name: draft.name.trim(),
                description: draft.description,
                curriculumEnabled: draft.curriculumEnabled,
              }
            : modal === 'subtopic'
              ? {
                  name: draft.name.trim(),
                  id_focus_area: draft.id_focus_area,
                  status: draft.status,
                  notes: draft.notes,
                }
              : {
                  date: draft.date,
                  slots: Number(draft.slots),
                  ...(draft.focusAreaMode === 'new'
                    ? { focusAreaName: draft.focusAreaName.trim() }
                    : {
                        id_focus_area: draft.id_focus_area || null,
                        id_subtopic: draft.id_subtopic || null,
                      }),
                  outcome: draft.outcome,
                  notes: draft.notes,
                  ...(draft.timerId ? { timerId: draft.timerId } : {}),
                };
        if (event.nativeEvent.submitter?.value === 'start-timer') {
          const areaName =
            draft.focusAreaMode === 'new'
              ? draft.focusAreaName.trim()
              : data.focus_areas.find((area) => area.id_focus_area === draft.id_focus_area)?.name;
          if (draft.focusAreaMode === 'new' && !areaName)
            throw new Error('Enter a Focus Area name.');
          const subtopicName = data.subtopics.find(
            (topic) => topic.id_subtopic === draft.id_subtopic,
          )?.name;
          studyTimer.start(
            payload,
            [areaName || 'Independent study', subtopicName].filter(Boolean).join(' · '),
          );
          dismissDialog();
          setNotice('Timer started. You’ll review the session before it is logged.');
          return;
        }
        if (draft.id) await updateRecord(modal, draft.id, payload);
        else
          await { area: createFocusArea, subtopic: createSubtopic, session: createSession }[modal](
            payload,
          );
        if (draft.timerId && studyTimer.timer?.id === draft.timerId) studyTimer.clear();
      }
      await refresh().catch(() =>
        setError(
          'Your change was saved, but the view could not refresh. Reload to see the latest data.',
        ),
      );
      dismissDialog();
      setNotice(`${labels[modal]} ${deleting ? 'deleted' : draft.id ? 'updated' : 'saved'}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function submitSettings(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await saveSettings({
        notificationPreferences: settings.notificationPreferences || {},
        weekStartDay: settings.weekStartDay,
        weeklyCommitmentMinutes: Math.round(Number(settings.weeklyCommitmentHours) * 60),
        weeklyBufferMinutes: Math.round(Number(settings.weeklyBufferHours) * 60),
        weeklyRevisionMinutes: Math.round(Number(settings.weeklyRevisionHours) * 60),
      });
      await refresh();
      setNotice('Weekly commitment saved. You’re all set.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  function reviewTimer(timer) {
    open('session');
    setDraft((current) => ({
      ...current,
      ...timer.payload,
      focusAreaMode: timer.payload.focusAreaName ? 'new' : 'existing',
      id_focus_area: timer.payload.id_focus_area || '',
      id_subtopic: timer.payload.id_subtopic || '',
    }));
    setReminder('');
  }
  if (!data)
    return (
      <main className="loading">
        <div className="brand">
          <Icon name="leaf" /> Growly
        </div>
        <h1>{error ? 'Let’s reconnect.' : 'Making room for growth…'}</h1>
        <p>{error || 'Loading your learning space.'}</p>
        {error && (
          <button
            className="primary"
            onClick={() => {
              setError('');
              refresh().catch((err) => setError(err.message));
            }}
          >
            Try again
          </button>
        )}
      </main>
    );

  const { dashboard, focus_areas, subtopics, sessions } = data;
  const logged = dashboard.commitmentLoggedMinutes;
  const target = dashboard.weeklyCommitmentMinutes;
  const buffer = dashboard.weeklyBufferMinutes;
  const total = target + buffer;
  const achieved = target > 0 && logged >= target;
  const full = total > 0 && logged >= total;
  const modalTitle = draft.timerId
    ? 'Confirm timed session'
    : `${deleting ? 'Delete' : draft.id ? 'Edit' : modal === 'session' ? 'Log' : 'Add'} ${labels[modal] || ''}`;
  const actions = (kind, record) => (
    <div className="record-actions">
      <button
        type="button"
        className="text-button"
        aria-label={`Edit ${record.name || 'session on ' + record.date}`}
        onClick={() => open(kind, record.id_focus_area || '', record)}
      >
        Edit
      </button>
      <button
        type="button"
        className="text-button danger-text"
        aria-label={`Delete ${record.name || 'session on ' + record.date}`}
        onClick={() => open(kind, record.id_focus_area || '', record, true)}
      >
        Delete
      </button>
    </div>
  );

  const visibleAreas =
    tab === 'overview'
      ? focus_areas.slice(0, 5)
      : focus_areas.filter(
          (area) =>
            `${area.name} ${area.description || ''}`.toLowerCase().includes(search.toLowerCase()) ||
            subtopics.some(
              (topic) =>
                topic.id_focus_area === area.id_focus_area &&
                topic.name.toLowerCase().includes(search.toLowerCase()),
            ),
        );
  const areaCards = (
    <div className="area-grid">
      {visibleAreas.map((area, index) => {
        const allChildren = subtopics.filter((t) => t.id_focus_area === area.id_focus_area);
        const completed = allChildren.filter((topic) => topic.status === 'Completed').length;
        const completion = allChildren.length
          ? Math.round((completed / allChildren.length) * 100)
          : 0;
        const children = tab === 'overview' ? allChildren.slice(0, 5) : allChildren;
        return (
          <article className="area-card" key={area.id_focus_area}>
            <div className="area-heading">
              <span className={`area-icon tone-${index % 3}`}>
                <Icon name="book" />
              </span>
              <div>
                <h3>{area.name}</h3>
                <span className="muted small">{allChildren.length} subtopics</span>
              </div>
              {actions('area', area)}
            </div>
            {area.description && <p className="area-description">{area.description}</p>}

            {area.curriculumEnabled && allChildren.length > 0 && (
              <div className="area-progress">
                <div className="spread small">
                  <strong>{completion}% complete</strong>
                  <span>
                    {completed} of {allChildren.length} subtopics completed
                  </span>
                </div>
                <progress
                  value={completed}
                  max={allChildren.length || 1}
                  aria-label={`${area.name} curriculum completion`}
                />
                <p className="small muted">
                  {completed} completed so far. Adding subtopics keeps your accomplishments.
                </p>
              </div>
            )}
            <div className="subtopic-list">
              {children.length ? (
                children.map((topic) => {
                  return (
                    <div className="subtopic" key={topic.id_subtopic}>
                      <span
                        className={`status-dot ${topic.status.toLowerCase().replaceAll(' ', '-')}`}
                      >
                        {topic.status === 'Completed' ? '✓' : ''}
                      </span>
                      <div>
                        <strong>{topic.name}</strong>
                        <span className="small muted">
                          {topic.status} · {topic.sessionCount} sessions ·{' '}
                          {hours(topic.totalMinutes)}h
                        </span>
                        <span className="small muted">
                          Last covered: {topic.lastCovered || 'Never'}
                          {topic.lastReviewed ? ` · Reviewed: ${topic.lastReviewed}` : ''}
                        </span>
                        {topic.completedAt && (
                          <span className="small muted">Completed {topic.completedAt}</span>
                        )}
                        {topic.notes && <p className="small muted topic-note">{topic.notes}</p>}
                      </div>
                      {actions('subtopic', topic)}
                    </div>
                  );
                })
              ) : (
                <p className="empty-inline">A fresh start. Add your first subtopic.</p>
              )}
            </div>
            {tab === 'overview' && allChildren.length > 5 && (
              <button className="text-button view-more" onClick={() => setTab('library')}>
                View all {allChildren.length} subtopics in Focus Areas <Icon name="arrow" />
              </button>
            )}
            <button className="add-subtopic" onClick={() => open('subtopic', area.id_focus_area)}>
              <Icon name="plus" /> Add subtopic<span className="sr-only"> to {area.name}</span>
            </button>
          </article>
        );
      })}
    </div>
  );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Growly home">
          <span className="brand-mark">
            <Icon name="leaf" />
          </span>
          growly<span className="brand-period">.</span>
        </a>
        <p className="nav-label">YOUR LEARNING SPACE</p>
        <nav aria-label="Main navigation">
          {[
            ['overview', 'grid', 'Overview'],
            ['library', 'book', 'Focus Areas'],
            ['sessions', 'clock', 'Sessions'],
            ['activity', 'book', 'Activity'],
            ['objectives', 'leaf', 'Growth Objectives'],
            ['settings', 'settings', 'Settings'],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              className={`nav-item ${tab === id ? 'selected' : ''}`}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => {
                setTab(id);
                setNotice('');
                setError('');
              }}
            >
              <Icon name={icon} />
              {label}
              {id === 'library' && <span className="nav-count">{focus_areas.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Icon name="leaf" />
          <strong>
            Small steps.
            <br />
            Lasting growth.
          </strong>
          <p>Make time for what matters, at a pace that works for you.</p>
        </div>
        <div className="sidebar-footer">
          <span className="avatar">Y</span>
          <div>
            <strong>Your learning journey</strong>
            <span>One week at a time</span>
          </div>
        </div>
      </aside>
      <main id="main-content" className="main-content">
        <header className="topbar">
          <span>
            My workspace{' '}
            <span className="breadcrumb">
              /{' '}
              {tab === 'library'
                ? 'Focus Areas'
                : tab === 'settings'
                  ? 'Settings'
                  : tab === 'sessions'
                    ? 'Sessions'
                    : tab === 'activity'
                      ? 'Activity'
                      : tab === 'objectives'
                        ? 'Growth Objectives'
                        : 'Overview'}
            </span>
          </span>
          <span className="date-label">
            {new Date().toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {tab === 'overview'
                  ? 'A LITTLE EVERY WEEK'
                  : tab === 'library'
                    ? 'FOLLOW YOUR CURIOSITY'
                    : 'ON YOUR TERMS'}
              </p>
              <h1 ref={heading} tabIndex="-1">
                {titles[tab]}
              </h1>
              <p className="muted">
                {tab === 'overview'
                  ? 'Small steps count. Dramatic training montages are optional.'
                  : tab === 'library'
                    ? 'Organize what you’re learning, one subtopic at a time.'
                    : tab === 'sessions'
                      ? 'Review, edit, and organize your complete learning history.'
                      : tab === 'activity'
                        ? 'See what is fresh, what is fading, and what deserves another look.'
                        : tab === 'objectives'
                          ? 'Choose the capabilities you want to develop and define success.'
                          : 'Build a sustainable weekly learning habit.'}
              </p>
            </div>
            <button className="primary" onClick={() => open('session')}>
              <Icon name="plus" /> Log session
            </button>
          </div>
          {!modal && error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              <Icon name="check" />
              {notice}
            </div>
          )}
          {reminder && (
            <div className="alert success" role="status">
              <span>{reminder}</span>
              <button className="text-button" onClick={() => setReminder('')}>
                Dismiss
              </button>
            </div>
          )}
          {!studyTimer.timer && tab === 'overview' && (
            <section className="study-timer" aria-label="Quick focus timer">
              <div className="spread">
                <div>
                  <p className="eyebrow">TIME TO FOCUS</p>
                  <h2>Focus timer</h2>
                  <div className="timer-clock" aria-label="30 minutes">
                    30:00
                  </div>
                </div>
                <button
                  className="primary"
                  disabled={!studyTimer.ready}
                  onClick={() => {
                    const now = new Date();
                    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    setReminder('');
                    studyTimer.start(
                      {
                        slots: 1,
                        date,
                        id_focus_area: null,
                        id_subtopic: null,
                        notes: '',
                        outcome: '',
                      },
                      'Focus time',
                    );
                  }}
                >
                  Start 30-minute timer
                </button>
              </div>
              <p className="small muted">
                Keep open for break alerts. Notifications:{' '}
                <button className="text-button" onClick={() => setTab('settings')}>
                  Settings
                </button>
                .
              </p>
            </section>
          )}
          <StudyTimer
            controller={studyTimer}
            onReview={reviewTimer}
            reviewOpen={Boolean(modal && draft.timerId)}
          />
          {tab === 'overview' && (
            <>
              <section className="commitment-card">
                <div className="spread">
                  <span className="eyebrow">YOUR WEEKLY COMMITMENT</span>
                  <button className="text-button" onClick={() => setTab('settings')}>
                    Edit goal <Icon name="arrow" />
                  </button>
                </div>
                <div className="week-summary">
                  <span>
                    Week starts {dashboard.weekStartDay} ·{' '}
                    {new Date(`${dashboard.weekStart}T12:00:00Z`).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </span>
                  <span>
                    {dashboard.daysRemaining} {dashboard.daysRemaining === 1 ? 'day' : 'days'}{' '}
                    remaining <small>(including today)</small>
                  </span>
                  {!settings.weekStartDay && (
                    <span className="small muted">Set your week preferences in Settings</span>
                  )}
                </div>
                <div className="commitment-main">
                  <div>
                    <h2>
                      {hours(logged)}
                      <span> / {hours(target)} hours</span>
                    </h2>
                    <p>
                      {full
                        ? 'Commitment and buffer complete. Your brain has earned a snack.'
                        : achieved
                          ? 'Commitment complete. You may now close a few tabs. Extra time is optional.'
                          : target
                            ? `${hours(Math.max(target - logged, 0))} more hours toward your weekly commitment. You’ve got this.`
                            : 'Set a weekly commitment to give your learning a little direction.'}
                    </p>
                  </div>
                  <span className={`pill ${achieved ? 'complete' : ''}`}>
                    <span className="tiny-dot" />
                    {full
                      ? 'Week complete'
                      : achieved
                        ? 'Goal achieved'
                        : target
                          ? 'Room to grow'
                          : 'Your fresh start'}
                  </span>
                </div>
                <div
                  className="budget-track"
                  aria-label={`${hours(logged)} hours logged, ${hours(target)} hours committed, ${hours(buffer)} optional buffer`}
                >
                  <div className="budget-commitment" style={{ flex: target || (total ? 0 : 1) }}>
                    <span
                      style={{ width: `${target ? Math.min((logged / target) * 100, 100) : 0}%` }}
                    />
                  </div>
                  {buffer > 0 && (
                    <div className="budget-buffer" style={{ flex: buffer }}>
                      <span
                        style={{
                          width: `${Math.min((Math.max(logged - target, 0) / buffer) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className="budget-labels">
                  <span>
                    <i className="legend-dot green" />
                    {hours(Math.min(logged, target))}h of {hours(target)}h committed
                  </span>
                  <span>
                    <i className="legend-dot amber" />
                    {hours(Math.max(buffer - Math.max(logged - target, 0), 0))}h optional buffer
                    available
                  </span>
                </div>
                <div className="commitment-foot">
                  <Icon name="leaf" />
                  Your buffer is optional. Even your ambition gets a day off.
                </div>
              </section>
              <section className="revision-card">
                <div className="spread">
                  <div>
                    <h2>Optional revision</h2>
                    <p className="muted small">
                      Sessions in the “Revision” Focus Area · separate from commitment and buffer
                    </p>
                  </div>
                  <button className="text-button" onClick={() => setTab('settings')}>
                    Edit budget
                  </button>
                </div>
                <p className="revision-total">
                  {hours(dashboard.revisionLoggedMinutes)}h logged
                  {dashboard.weeklyRevisionMinutes > 0
                    ? ` / ${hours(dashboard.weeklyRevisionMinutes)}h optional`
                    : ' · no budget set'}
                </p>
                {dashboard.weeklyRevisionMinutes > 0 && (
                  <progress
                    value={Math.min(
                      dashboard.revisionLoggedMinutes,
                      dashboard.weeklyRevisionMinutes,
                    )}
                    max={dashboard.weeklyRevisionMinutes}
                    aria-label="Optional revision progress"
                  />
                )}
                <button
                  className="text-button"
                  onClick={() => {
                    const revision = focus_areas.find(
                      (area) => area.name.trim().toLowerCase() === 'revision',
                    );
                    open('session', revision?.id_focus_area || '');
                    if (!revision)
                      setDraft((current) => ({
                        ...current,
                        focusAreaMode: 'new',
                        focusAreaName: 'Revision',
                      }));
                  }}
                >
                  Log revision <Icon name="arrow" />
                </button>
              </section>
              <div className="stats-grid two-stats">
                <Stat
                  label="Focus Areas"
                  value={focus_areas.length}
                  detail="Things you’re curious about"
                  icon="book"
                />
                <Stat
                  label="Learning sessions"
                  value={dashboard.sessions}
                  detail="Intentional moments this week"
                  icon="clock"
                />
              </div>
              <WeeklyChart
                focus_areas={focus_areas}
                sessions={sessions}
                weekStart={dashboard.weekStart}
                configured={Boolean(settings.weekStartDay)}
              />
            </>
          )}
          {(tab === 'overview' || tab === 'library') && (
            <div className={tab === 'overview' ? 'content-columns' : ''}>
              <section>
                <div className="section-heading">
                  <div>
                    <h2>
                      Focus Areas <span className="count">{focus_areas.length}</span>
                    </h2>
                    <p className="muted small">
                      {tab === 'overview'
                        ? 'Recently updated · up to 5 Focus Areas and 5 subtopics each'
                        : 'All your Focus Areas and subtopics.'}
                    </p>
                  </div>
                  <button className="secondary" onClick={() => open('area')}>
                    <Icon name="plus" /> Add Focus Area
                  </button>
                </div>
                {tab === 'overview' && focus_areas.length > 5 && (
                  <button className="text-button view-more" onClick={() => setTab('library')}>
                    View all {focus_areas.length} Focus Areas <Icon name="arrow" />
                  </button>
                )}
                {tab === 'library' && (
                  <label className="field library-search">
                    <span>Search Focus Areas and subtopics</span>
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                )}
                {focus_areas.length ? (
                  visibleAreas.length ? (
                    areaCards
                  ) : (
                    <p className="empty-card">No matches. Try a different search.</p>
                  )
                ) : (
                  <div className="empty-card">
                    <span className="empty-icon">
                      <Icon name="book" />
                    </span>
                    <h3>Pick a rabbit hole. Add a Focus Area.</h3>
                    <p>Create a Focus Area, then break it into small, achievable subtopics.</p>
                    <button className="primary" onClick={() => open('area')}>
                      <Icon name="plus" /> Create your first Focus Area
                    </button>
                  </div>
                )}
              </section>
              {tab === 'overview' && (
                <section className="activity-panel">
                  <div className="section-heading">
                    <div>
                      <h2>Recent activity</h2>
                      <p className="muted small">Every session is a step forward.</p>
                    </div>
                    <button className="text-button" onClick={() => setTab('sessions')}>
                      View all
                    </button>
                  </div>
                  {sessions.length ? (
                    <div className="activity-list">
                      {sessions.slice(0, 6).map((session) => (
                        <article className="activity" key={session.id_session}>
                          <span className="activity-icon">
                            <Icon name="clock" />
                          </span>
                          <div>
                            <strong>
                              {session.subtopicName ||
                                focus_areas.find((c) => c.id_focus_area === session.id_focus_area)
                                  ?.name ||
                                'Independent study'}
                            </strong>
                            <span className="small muted">
                              {new Date(`${session.date}T12:00:00`).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                          <span className="duration">{session.slots} slots</span>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="activity-empty">
                      <Icon name="clock" />
                      <h3>Your progress starts here</h3>
                      <p>Log a learning session and watch your small steps add up.</p>
                      <button className="text-button" onClick={() => open('session')}>
                        Log your first session <Icon name="arrow" />
                      </button>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
          {tab === 'activity' && (
            <ActivityOverview
              subtopics={subtopics}
              focusAreas={focus_areas}
              onReview={async (topic) => {
                try {
                  let revision = focus_areas.find(
                    (area) => area.name.trim().toLowerCase() === 'revision',
                  );
                  if (!revision) {
                    revision = await createFocusArea({ name: 'Revision' });
                    await refresh();
                  }
                  open('session', revision.id_focus_area);
                  setDraft((current) => ({ ...current, id_subtopic: topic.id_subtopic }));
                } catch (err) {
                  setError(err.message);
                }
              }}
            />
          )}
          {tab === 'sessions' && (
            <section className="sessions-panel">
              <div className="section-heading">
                <div>
                  <h2>
                    All sessions <span className="count">{sessions.length}</span>
                  </h2>
                  <p className="muted small">One slot = 30 minutes. All dates are shown.</p>
                </div>
                <span className="muted small">
                  {hours(sessions.reduce((sum, item) => sum + item.durationMinutes, 0))} hours total
                </span>
              </div>
              {sessions.length ? (
                <div className="session-table-wrap">
                  <table className="session-table">
                    <caption className="sr-only">All logged learning sessions</caption>
                    <thead>
                      <tr>
                        <th scope="col">Focus Area / subtopic</th>
                        <th scope="col">Date</th>
                        <th scope="col">Slots</th>
                        <th scope="col">Notes / outcome</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((session) => (
                        <tr key={session.id_session}>
                          <td>
                            <strong>
                              {focus_areas.find(
                                (area) => area.id_focus_area === session.id_focus_area,
                              )?.name || 'Unassigned'}
                            </strong>
                            {session.subtopicName && (
                              <span className="small muted">{session.subtopicName}</span>
                            )}
                          </td>
                          <td>{session.date}</td>
                          <td>
                            {session.slots}
                            <span className="small muted">{hours(session.durationMinutes)}h</span>
                          </td>
                          <td>
                            <p>{session.outcome}</p>
                            <p className="muted">{session.notes}</p>
                          </td>
                          <td>{actions('session', session)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-card">
                  <h3>No sessions yet</h3>
                  <p>Your logged sessions will appear here. Every origin story starts somewhere.</p>
                  <button className="primary" onClick={() => open('session')}>
                    Log a session
                  </button>
                </div>
              )}
            </section>
          )}
          {tab === 'settings' && (
            <form className="settings-card" onSubmit={submitSettings}>
              <div className="section-heading">
                <div>
                  <h2>Your weekly rhythm</h2>
                  <p className="muted">
                    Choose a pace for actual you, not imaginary Monday-morning you.
                  </p>
                </div>
                <span className="area-icon tone-0">
                  <Icon name="settings" />
                </span>
              </div>
              <div className="form-grid">
                <Field
                  label="Weekly commitment (hours)"
                  hint="Your core learning goal for the week."
                >
                  <input
                    type="number"
                    min="0"
                    max="168"
                    step="0.25"
                    required
                    value={settings.weeklyCommitmentHours}
                    onChange={(e) =>
                      setSettings({ ...settings, weeklyCommitmentHours: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Optional buffer (hours)"
                  hint="Extra space, only if you feel like it."
                >
                  <input
                    type="number"
                    min="0"
                    max="168"
                    step="0.25"
                    required
                    value={settings.weeklyBufferHours}
                    onChange={(e) =>
                      setSettings({ ...settings, weeklyBufferHours: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Optional revision (hours)"
                  hint="Time for the Revision Focus Area, separate from commitment and buffer. Leave blank to skip."
                >
                  <input
                    type="number"
                    min="0"
                    max="168"
                    step="0.25"
                    value={settings.weeklyRevisionHours}
                    onChange={(e) =>
                      setSettings({ ...settings, weeklyRevisionHours: e.target.value })
                    }
                  />
                </Field>
                <Field label="Week starts on">
                  <select
                    required
                    value={settings.weekStartDay}
                    onChange={(e) => setSettings({ ...settings, weekStartDay: e.target.value })}
                  >
                    <option value="">Choose a day</option>
                    <option>Monday</option>
                    <option>Sunday</option>
                  </select>
                </Field>
              </div>
              <StudyNotifications
                value={settings.notificationPreferences || {}}
                onChange={(notificationPreferences) =>
                  setSettings((current) => ({ ...current, notificationPreferences }))
                }
              />
              <div className="form-footer">
                <span className="small muted">A sustainable pace is a powerful thing.</span>
                <button className="primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Save weekly commitment'}
                </button>
              </div>
            </form>
          )}
          {tab === 'objectives' && <GrowthObjectives data={data} />}
          <footer className="page-footer">
            <Icon name="leaf" /> Grow at your own pace. Plants rarely sprint.
          </footer>
        </div>
      </main>
      {modal && (
        <dialog
          aria-label={modalTitle}
          ref={dialog}
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
          onClick={(e) => {
            if (e.target === dialog.current) close();
          }}
        >
          <form onSubmit={submit}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">MAKE ROOM TO GROW</p>
                <h2>{modalTitle}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={close}
                disabled={busy}
                aria-label="Close dialog"
              >
                <Icon name="close" />
              </button>
            </div>
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            {deleting ? (
              <div className="delete-confirmation">
                <p>
                  Delete {modal === 'session' ? `the session on ${draft.date}` : `“${draft.name}”`}?
                </p>
                <p className="muted">
                  {modal === 'area'
                    ? 'This also removes every subtopic in this Focus Area. Its sessions become unassigned; reviews logged under another Focus Area keep that area.'
                    : modal === 'subtopic'
                      ? 'Past sessions will stay in their Focus Area without a subtopic.'
                      : 'This session and its logged time will be permanently removed from your history and weekly totals.'}
                </p>
                <p className="small muted">This cannot be undone.</p>
              </div>
            ) : (
              <div className="form-stack">
                {draft.timerId && (
                  <p className="timer-confirmation">
                    Your timer is complete. Check the details below, then confirm to add this
                    session to your weekly totals. Cancel keeps the completed timer ready for
                    review.
                  </p>
                )}
                {modal !== 'session' && (
                  <Field label={modal === 'area' ? 'Focus Area name' : 'Subtopic name'}>
                    <input
                      autoFocus
                      required
                      maxLength="200"
                      value={draft.name}
                      onChange={(e) => update('name', e.target.value)}
                    />
                  </Field>
                )}
                {modal === 'session' && (
                  <fieldset className="focus-mode">
                    <legend>Focus Area</legend>
                    <label>
                      <input
                        type="radio"
                        name="focus-mode"
                        checked={draft.focusAreaMode === 'existing'}
                        onChange={() =>
                          setDraft({ ...draft, focusAreaMode: 'existing', focusAreaName: '' })
                        }
                      />{' '}
                      Choose existing
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="focus-mode"
                        checked={draft.focusAreaMode === 'new'}
                        onChange={() =>
                          setDraft({
                            ...draft,
                            focusAreaMode: 'new',
                            id_focus_area: '',
                            id_subtopic: '',
                          })
                        }
                      />{' '}
                      Enter a name
                    </label>
                  </fieldset>
                )}
                {modal === 'session' && draft.focusAreaMode === 'new' && (
                  <Field
                    label="Focus Area name"
                    hint="Saved to your Focus Areas when you save this session. An existing name will be reused."
                  >
                    <input
                      required
                      maxLength="200"
                      value={draft.focusAreaName}
                      onChange={(e) => update('focusAreaName', e.target.value)}
                    />
                  </Field>
                )}
                {(modal === 'subtopic' ||
                  (modal === 'session' && draft.focusAreaMode === 'existing')) && (
                  <Field label="Focus Area">
                    <select
                      autoFocus={modal === 'session'}
                      required={modal === 'subtopic'}
                      value={draft.id_focus_area}
                      onChange={(e) =>
                        setDraft({ ...draft, id_focus_area: e.target.value, id_subtopic: '' })
                      }
                    >
                      <option value="">
                        {modal === 'session' ? 'Unassigned' : 'Select a Focus Area'}
                      </option>
                      {focus_areas.map((c) => (
                        <option key={c.id_focus_area} value={c.id_focus_area}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {modal === 'area' && (
                  <>
                    <Field label="Description (optional)">
                      <textarea
                        maxLength="10000"
                        rows="3"
                        value={draft.description}
                        onChange={(e) => update('description', e.target.value)}
                        placeholder="What would you like to learn?"
                      />
                    </Field>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(draft.curriculumEnabled)}
                        onChange={(e) => update('curriculumEnabled', e.target.checked)}
                      />
                      Track curriculum completion for this Focus Area
                    </label>
                  </>
                )}
                {modal === 'subtopic' && (
                  <Field label="Status">
                    <select
                      required
                      value={draft.status}
                      onChange={(e) => update('status', e.target.value)}
                    >
                      <option value="">Choose a status</option>
                      <option>Not started</option>
                      <option>In Progress</option>
                      <option>Completed</option>
                    </select>
                  </Field>
                )}
                {modal === 'session' && (
                  <>
                    {draft.focusAreaMode === 'existing' && (
                      <Field label="Subtopic (optional)">
                        <select
                          value={draft.id_subtopic}
                          onChange={(e) => update('id_subtopic', e.target.value)}
                        >
                          <option value="">General learning</option>
                          {subtopics
                            .filter(
                              (t) =>
                                t.id_focus_area === draft.id_focus_area ||
                                focus_areas
                                  .find((area) => area.id_focus_area === draft.id_focus_area)
                                  ?.name.trim()
                                  .toLowerCase() === 'revision',
                            )
                            .map((t) => (
                              <option key={t.id_subtopic} value={t.id_subtopic}>
                                {focus_areas
                                  .find((area) => area.id_focus_area === draft.id_focus_area)
                                  ?.name.trim()
                                  .toLowerCase() === 'revision'
                                  ? `${focus_areas.find((area) => area.id_focus_area === t.id_focus_area)?.name} · ${t.name}`
                                  : t.name}
                              </option>
                            ))}
                        </select>
                      </Field>
                    )}
                    <div className="form-grid">
                      <Field label="Date">
                        <input
                          type="date"
                          required
                          max={new Date().toISOString().slice(0, 10)}
                          value={draft.date}
                          onChange={(e) => update('date', e.target.value)}
                        />
                      </Field>
                      <Field
                        label="Slots"
                        hint={`1 slot = 30 minutes${draft.slots ? ` · ${hours(Number(draft.slots) * 30)} hours` : ''}`}
                      >
                        <input
                          type="number"
                          required
                          max={48}
                          min={1}
                          step={1}
                          value={draft.slots}
                          onChange={(e) => update('slots', e.target.value)}
                        />
                      </Field>
                    </div>
                    <Field label="Outcome (optional)">
                      <input
                        value={draft.outcome}
                        onChange={(e) => update('outcome', e.target.value)}
                        maxLength="10000"
                        placeholder="What did you take away?"
                      />
                    </Field>
                  </>
                )}
                {modal !== 'area' && (
                  <Field label="Notes (optional)">
                    <textarea
                      maxLength="10000"
                      rows="2"
                      value={draft.notes}
                      onChange={(e) => update('notes', e.target.value)}
                    />
                  </Field>
                )}
              </div>
            )}
            <div className="modal-footer">
              <button
                autoFocus={deleting}
                type="button"
                className="secondary"
                disabled={busy}
                onClick={close}
              >
                Cancel
              </button>
              {modal === 'session' && !draft.id && !draft.timerId && !deleting && (
                <button
                  type="submit"
                  value="start-timer"
                  className="secondary"
                  disabled={busy || !studyTimer.ready || Boolean(studyTimer.timer)}
                >
                  Start timer
                </button>
              )}
              <button className={deleting ? 'primary danger-button' : 'primary'} disabled={busy}>
                {busy
                  ? 'Saving…'
                  : draft.timerId
                    ? 'Confirm and save session'
                    : deleting
                      ? `Delete ${labels[modal]}`
                      : draft.id
                        ? 'Save changes'
                        : modal === 'area'
                          ? 'Create Focus Area'
                          : modal === 'subtopic'
                            ? 'Save subtopic'
                            : 'Save session'}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}
function Field({ label, hint, children }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id, 'aria-describedby': hint ? `${id}-hint` : undefined })}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
function Stat({ label, value, detail, icon }) {
  return (
    <section className="stat-card">
      <div>
        <p className="muted small">{label}</p>
        <strong className="stat-value">{value}</strong>
        <p className="small muted">{detail}</p>
      </div>
      <span className="stat-icon">
        <Icon name={icon} />
      </span>
    </section>
  );
}

function WeeklyChart({ focus_areas, sessions, weekStart, configured }) {
  const [offset, setOffset] = useState(0);
  const start = new Date(`${weekStart}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + offset * 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  const last = new Date(end);
  last.setUTCDate(last.getUTCDate() - 1);
  const from = start.toISOString().slice(0, 10);
  const until = end.toISOString().slice(0, 10);
  const weekly = sessions.filter((session) => session.date >= from && session.date < until);
  const rows = focus_areas.map((area) => ({
    id: area.id_focus_area,
    name: area.name,
    minutes: weekly
      .filter((session) => session.id_focus_area === area.id_focus_area)
      .reduce((sum, session) => sum + session.durationMinutes, 0),
  }));
  const unassigned = weekly
    .filter((session) => !focus_areas.some((area) => area.id_focus_area === session.id_focus_area))
    .reduce((sum, session) => sum + session.durationMinutes, 0);
  if (unassigned) rows.push({ id: 'unassigned', name: 'Unassigned', minutes: unassigned });
  const max = Math.max(...rows.map((row) => row.minutes), 30);
  const dateLabel = (date) =>
    date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  return (
    <section className="weekly-chart" aria-label="Weekly hours by Focus Area">
      <div className="section-heading">
        <div>
          <h2>Hours by Focus Area</h2>
          <p className="muted small" aria-live="polite">
            {dateLabel(start)} – {dateLabel(last)}
          </p>
        </div>
        <div className="week-controls">
          <button
            className="secondary"
            aria-label="Previous week"
            onClick={() => setOffset(offset - 1)}
          >
            ←
          </button>
          <button className="secondary" disabled={offset === 0} onClick={() => setOffset(0)}>
            This week
          </button>
          <button
            className="secondary"
            aria-label="Next week"
            onClick={() => setOffset(offset + 1)}
          >
            →
          </button>
        </div>
      </div>
      {!configured && (
        <p className="small muted chart-help">
          Weeks use Monday–Sunday (UTC) until you choose a week start in Settings.
        </p>
      )}
      {weekly.length ? (
        <ul className="chart-bars">
          {rows.map((row) => (
            <li key={row.id}>
              <div className="spread">
                <span>{row.name}</span>
                <strong>{hours(row.minutes)}h</strong>
              </div>
              <div className="chart-track" aria-hidden="true">
                <div style={{ width: `${(row.minutes / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-inline">
          No sessions logged for this week. Your recorded hours will appear here.
        </p>
      )}
    </section>
  );
}
