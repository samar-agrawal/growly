'use client';

import { useEffect, useRef, useState } from 'react';
import { createCategory, createSession, createTopic, fetchDashboardData, saveSettings } from '../lib/api';

const hours = (minutes = 0) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(minutes / 60);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const titles = { overview: 'Your room to grow.', library: 'Make space for curiosity.', settings: 'Find your own rhythm.' };

function Icon({ name, ...props }) {
  const paths = { leaf: 'M20 4C9 2 3 7 5 14s13 7 15-10ZM5 20l9-10', grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', book: 'M12 5v16M3 3c4 0 7 0 9 2 2-2 5-2 9-2v16c-4 0-7 0-9 2-2-2-5-2-9-2z', settings: 'M4 7h16M4 17h16M8 4v6M16 14v6', plus: 'M12 5v14M5 12h14', clock: 'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0', arrow: 'M5 12h14m-5-5 5 5-5 5', check: 'm5 12 4 4L19 6', close: 'm6 6 12 12M6 18 18 6' };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.leaf} /></svg>;
}

export default function HomePage() {
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState({});
  const dialog = useRef(null);
  const trigger = useRef(null);

  async function refresh() {
    const result = await fetchDashboardData();
    setData(result);
    setSettings({ ...result.settings, weeklyCommitmentHours: result.settings.weeklyCommitmentMinutes / 60, weeklyBufferHours: result.settings.weeklyBufferMinutes / 60 });
  }
  useEffect(() => { refresh().catch(err => setError(err.message)); }, []);
  useEffect(() => { if (modal) { dialog.current?.showModal(); } }, [modal]);
  function open(kind, categoryId = '') {
    trigger.current = document.activeElement;
    setError(''); setNotice('');
    setDraft({ name: '', description: '', curriculumEnabled: false, categoryId, status: 'Not started', notes: '', date: today(), durationMinutes: 30, topicId: '', sessionType: 'learning', outcome: '' });
    setModal(kind);
  }
  function close() { if (busy) return; dialog.current?.close(); setModal(null); trigger.current?.focus(); }
  function update(key, value) { setDraft(current => ({ ...current, [key]: value })); }
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (modal === 'area') await createCategory({ name: draft.name.trim(), description: draft.description, curriculumEnabled: draft.curriculumEnabled });
      if (modal === 'subtopic') await createTopic({ name: draft.name.trim(), categoryId: draft.categoryId, status: draft.status, notes: draft.notes });
      if (modal === 'session') await createSession({ ...draft, durationMinutes: Number(draft.durationMinutes), categoryId: draft.categoryId || null, topicId: draft.topicId || null });
      await refresh();
      setNotice(modal === 'area' ? 'Focus Area added.' : modal === 'subtopic' ? 'Subtopic added.' : 'Session logged. A little progress goes a long way.');
      dialog.current?.close(); setModal(null); trigger.current?.focus();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function submitSettings(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await saveSettings({ ...data.settings, timezone: settings.timezone, weekStartDay: settings.weekStartDay, weeklyCommitmentMinutes: Math.round(Number(settings.weeklyCommitmentHours) * 60), weeklyBufferMinutes: Math.round(Number(settings.weeklyBufferHours) * 60) });
      await refresh(); setNotice('Weekly commitment saved. You’re all set.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  if (!data) return <main className="loading"><div className="brand"><Icon name="leaf" /> Growly</div><h1>{error ? 'Let’s reconnect.' : 'Making room for growth…'}</h1><p>{error || 'Loading your learning space.'}</p>{error && <button className="primary" onClick={() => { setError(''); refresh().catch(err => setError(err.message)); }}>Try again</button>}</main>;

  const { dashboard, categories, topics, sessions } = data;
  const logged = dashboard.timeLoggedMinutes;
  const target = dashboard.weeklyCommitmentMinutes;
  const buffer = dashboard.weeklyBufferMinutes;
  const total = target + buffer;
  const achieved = target > 0 && logged >= target;
  const full = total > 0 && logged >= total;
  const curriculum = topics.filter(t => categories.some(c => c.id === t.categoryId && c.curriculumEnabled));
  const completed = curriculum.filter(t => t.status === 'Completed').length;
  const percentage = curriculum.length ? Math.round(completed / curriculum.length * 100) : 0;

  const areaCards = <div className="area-grid">{categories.map((area, index) => {
    const children = topics.filter(t => t.categoryId === area.id);
    const done = children.filter(t => t.status === 'Completed').length;
    return <article className="area-card" key={area.id}>
      <div className="area-heading"><span className={`area-icon tone-${index % 3}`}><Icon name="book" /></span><div><h3>{area.name}</h3><span className="muted small">{area.curriculumEnabled ? 'Curriculum' : 'Independent learning'} · {children.length} subtopics</span></div></div>
      {area.description && <p className="area-description">{area.description}</p>}
      {area.curriculumEnabled && <div className="area-progress"><div className="small muted spread"><span>{done} of {children.length} completed</span><span>{children.length ? Math.round(done / children.length * 100) : 0}%</span></div><progress value={done} max={children.length || 1} aria-label={`${area.name} curriculum completion`} /></div>}
      <div className="subtopic-list">{children.length ? children.map(topic => {
        const activity = sessions.filter(s => s.topicId === topic.id);
        return <div className="subtopic" key={topic.id}><span className={`status-dot ${topic.status.toLowerCase().replaceAll(' ', '-')}`}>{topic.status === 'Completed' ? '✓' : ''}</span><div><strong>{topic.name}</strong><span className="small muted">{topic.status}{activity.length ? ` · ${activity.length} sessions · ${hours(activity.reduce((sum, s) => sum + s.durationMinutes, 0))}h` : ''}</span>{topic.notes && <p className="small muted topic-note">{topic.notes}</p>}</div></div>;
      }) : <p className="empty-inline">A fresh start. Add your first subtopic.</p>}</div>
      <button className="add-subtopic" onClick={() => open('subtopic', area.id)}><Icon name="plus" /> Add subtopic<span className="sr-only"> to {area.name}</span></button>
    </article>;
  })}</div>;

  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="/" aria-label="Growly home"><span className="brand-mark"><Icon name="leaf" /></span>growly<span className="brand-period">.</span></a><p className="nav-label">YOUR LEARNING SPACE</p><nav aria-label="Main navigation">{[['overview', 'grid', 'Overview'], ['library', 'book', 'Focus Areas'], ['settings', 'settings', 'Settings']].map(([id, icon, label]) => <button key={id} className={`nav-item ${tab === id ? 'selected' : ''}`} aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); setNotice(''); setError(''); }}><Icon name={icon} />{label}{id === 'library' && <span className="nav-count">{categories.length}</span>}</button>)}</nav><div className="sidebar-note"><Icon name="leaf" /><strong>Small steps.<br />Lasting growth.</strong><p>Make time for what matters, at a pace that works for you.</p></div><div className="sidebar-footer"><span className="avatar">Y</span><div><strong>Your learning journey</strong><span>One week at a time</span></div></div></aside>
    <main className="main-content"><header className="topbar"><span>My workspace <span className="breadcrumb">/ {tab === 'library' ? 'Focus Areas' : tab === 'settings' ? 'Settings' : 'Overview'}</span></span><span className="date-label">{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span></header>
      <div className="page-content"><div className="page-heading"><div><p className="eyebrow">{tab === 'overview' ? 'A LITTLE EVERY WEEK' : tab === 'library' ? 'FOLLOW YOUR CURIOSITY' : 'ON YOUR TERMS'}</p><h1>{titles[tab]}</h1><p className="muted">{tab === 'overview' ? 'A little intention. A little practice. Meaningful progress.' : tab === 'library' ? 'Organize what you’re learning, one subtopic at a time.' : 'Build a sustainable weekly learning habit.'}</p></div><button className="primary" onClick={() => open('session')}><Icon name="plus" /> Log session</button></div>
      {!modal && error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="alert success" role="status"><Icon name="check" />{notice}</div>}
      {tab === 'overview' && <>
        <section className="commitment-card"><div className="spread"><span className="eyebrow">YOUR WEEKLY COMMITMENT</span><button className="text-button" onClick={() => setTab('settings')}>Edit goal <Icon name="arrow" /></button></div><div className="commitment-main"><div><h2>{hours(logged)}<span> / {hours(target)} hours</span></h2><p>{full ? 'Your full weekly budget is reached. Enjoy a well-earned break.' : achieved ? 'Commitment complete. Any extra time is entirely up to you.' : target ? `${hours(Math.max(target - logged, 0))} more hours toward your weekly commitment. You’ve got this.` : 'Set a weekly commitment to give your learning a little direction.'}</p></div><span className={`pill ${achieved ? 'complete' : ''}`}><span className="tiny-dot" />{full ? 'Week complete' : achieved ? 'Goal achieved' : target ? 'Room to grow' : 'Your fresh start'}</span></div>
        <div className="budget-track" aria-label={`${hours(logged)} hours logged, ${hours(target)} hours committed, ${hours(buffer)} optional buffer`}><div className="budget-commitment" style={{ flex: target || (total ? 0 : 1) }}><span style={{ width: `${target ? Math.min(logged / target * 100, 100) : 0}%` }} /></div>{buffer > 0 && <div className="budget-buffer" style={{ flex: buffer }}><span style={{ width: `${Math.min(Math.max(logged - target, 0) / buffer * 100, 100)}%` }} /></div>}</div><div className="budget-labels"><span><i className="legend-dot green" />{hours(Math.min(logged, target))}h of {hours(target)}h committed</span><span><i className="legend-dot amber" />{hours(Math.max(buffer - Math.max(logged - target, 0), 0))}h optional buffer available</span></div><div className="commitment-foot"><Icon name="leaf" />Consistency over intensity. Your buffer is an invitation, never an obligation.</div></section>
        <div className="stats-grid"><Stat label="Focus Areas" value={categories.length} detail="Things you’re curious about" icon="book" /><Stat label="Learning sessions" value={dashboard.sessions} detail="Intentional moments this week" icon="clock" /><Stat label="Current curriculum" value={`${percentage}%`} detail={`${completed} of ${curriculum.length} subtopics completed`} icon="check" /></div>
      </>}
      {(tab === 'overview' || tab === 'library') && <div className={tab === 'overview' ? 'content-columns' : ''}><section><div className="section-heading"><div><h2>Focus Areas <span className="count">{categories.length}</span></h2><p className="muted small">A home for everything you want to learn.</p></div><button className="secondary" onClick={() => open('area')}><Icon name="plus" /> Add Focus Area</button></div>{categories.length ? areaCards : <div className="empty-card"><span className="empty-icon"><Icon name="book" /></span><h3>What would you like to explore?</h3><p>Create a Focus Area, then break it into small, achievable subtopics.</p><button className="primary" onClick={() => open('area')}><Icon name="plus" /> Create your first Focus Area</button></div>}</section>{tab === 'overview' && <section className="activity-panel"><div className="section-heading"><div><h2>Recent activity</h2><p className="muted small">Every session is a step forward.</p></div></div>{sessions.length ? <div className="activity-list">{sessions.slice(0, 6).map(session => <article className="activity" key={session.id}><span className="activity-icon"><Icon name="clock" /></span><div><strong>{session.topicName || categories.find(c => c.id === session.categoryId)?.name || 'Independent study'}</strong><span className="small muted">{session.sessionType} · {new Date(`${session.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div><span className="duration">{session.durationMinutes}m</span></article>)}</div> : <div className="activity-empty"><Icon name="clock" /><h3>Your progress starts here</h3><p>Log a learning session and watch your small steps add up.</p><button className="text-button" onClick={() => open('session')}>Log your first session <Icon name="arrow" /></button></div>}</section>}</div>}
      {tab === 'settings' && <form className="settings-card" onSubmit={submitSettings}><div className="section-heading"><div><h2>Your weekly rhythm</h2><p className="muted">Choose a commitment you can comfortably keep.</p></div><span className="area-icon tone-0"><Icon name="settings" /></span></div><div className="form-grid"><Field label="Weekly commitment (hours)" hint="Your core learning goal for the week."><input type="number" min="0" max="168" step="0.25" required value={settings.weeklyCommitmentHours} onChange={e => setSettings({ ...settings, weeklyCommitmentHours: e.target.value })} /></Field><Field label="Optional buffer (hours)" hint="Extra space, only if you feel like it."><input type="number" min="0" max="168" step="0.25" required value={settings.weeklyBufferHours} onChange={e => setSettings({ ...settings, weeklyBufferHours: e.target.value })} /></Field><Field label="Week starts on"><select value={settings.weekStartDay} onChange={e => setSettings({ ...settings, weekStartDay: e.target.value })}><option>Monday</option><option>Sunday</option></select></Field><Field label="Timezone" hint="For example, Europe/Berlin or UTC."><input required value={settings.timezone} onChange={e => setSettings({ ...settings, timezone: e.target.value })} /></Field></div><div className="form-footer"><span className="small muted">A sustainable pace is a powerful thing.</span><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save weekly commitment'}</button></div></form>}
      <footer className="page-footer"><Icon name="leaf" /> Grow at your own pace.</footer></div></main>
      {modal && <dialog aria-label={modal === 'area' ? 'Add Focus Area' : modal === 'subtopic' ? 'Add subtopic' : 'Log a session'} ref={dialog} onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === dialog.current) close(); }}><form onSubmit={submit}><div className="section-heading"><div><p className="eyebrow">MAKE ROOM TO GROW</p><h2>{modal === 'area' ? 'Add Focus Area' : modal === 'subtopic' ? 'Add subtopic' : 'Log a session'}</h2></div><button type="button" className="icon-button" onClick={close} disabled={busy} aria-label="Close dialog"><Icon name="close" /></button></div>{error && <div className="alert error" role="alert">{error}</div>}<div className="form-stack">
        {modal !== 'session' && <Field label={modal === 'area' ? 'Focus Area name' : 'Subtopic name'}><input autoFocus required maxLength="200" value={draft.name} onChange={e => update('name', e.target.value)} placeholder={modal === 'area' ? 'e.g. System design' : 'e.g. Caching strategies'} /></Field>}
        {modal !== 'area' && <Field label="Focus Area"><select autoFocus={modal === 'session'} required={modal === 'subtopic'} value={draft.categoryId} onChange={e => setDraft({ ...draft, categoryId: e.target.value, topicId: '' })}><option value="">{modal === 'session' ? 'Independent study' : 'Select a Focus Area'}</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
        {modal === 'area' && <><Field label="Description (optional)"><textarea rows="3" value={draft.description} onChange={e => update('description', e.target.value)} placeholder="What would you like to learn?" /></Field><label className="checkbox"><input type="checkbox" checked={draft.curriculumEnabled} onChange={e => update('curriculumEnabled', e.target.checked)} /><span>Track curriculum completion</span></label></>}
        {modal === 'subtopic' && <Field label="Status"><select value={draft.status} onChange={e => update('status', e.target.value)}><option>Not started</option><option>In Progress</option><option>Completed</option></select></Field>}
        {modal === 'session' && <><Field label="Subtopic (optional)"><select value={draft.topicId} onChange={e => update('topicId', e.target.value)}><option value="">General learning</option>{topics.filter(t => t.categoryId === draft.categoryId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field><div className="form-grid"><Field label="Date"><input type="date" required value={draft.date} onChange={e => update('date', e.target.value)} /></Field><Field label="Duration (minutes)"><input type="number" required min="1" step="1" value={draft.durationMinutes} onChange={e => update('durationMinutes', e.target.value)} /></Field></div><Field label="Session type"><select value={draft.sessionType} onChange={e => update('sessionType', e.target.value)}><option value="learning">Learning</option><option value="revision">Revision</option></select></Field><Field label="Outcome (optional)"><input value={draft.outcome} onChange={e => update('outcome', e.target.value)} placeholder="What did you take away?" /></Field></>}
        {modal !== 'area' && <Field label="Notes (optional)"><textarea rows="2" value={draft.notes} onChange={e => update('notes', e.target.value)} /></Field>}
      </div><div className="modal-footer"><button type="button" className="secondary" disabled={busy} onClick={close}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : modal === 'area' ? 'Create Focus Area' : modal === 'subtopic' ? 'Save subtopic' : 'Save session'}</button></div></form></dialog>}
  </div>;
}
function Field({ label, hint, children }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
function Stat({ label, value, detail, icon }) { return <section className="stat-card"><div><p className="muted small">{label}</p><strong className="stat-value">{value}</strong><p className="small muted">{detail}</p></div><span className="stat-icon"><Icon name={icon} /></span></section>; }
