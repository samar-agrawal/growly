'use client';

import { useEffect, useRef, useState } from 'react';
import { requestJson } from '../lib/api';

const empty = () => ({
  title: '',
  motivation: '',
  priority: 'Medium',
  status: 'Active',
  target_date: '',
  success_criteria: '',
  focusAreaIds: [],
  subtopicIds: [],
  sessionIds: [],
});

export default function GrowthObjectives({ data }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const dialog = useRef(null);
  const trigger = useRef(null);
  async function refresh() {
    setState(await requestJson('/api/objectives'));
  }
  useEffect(() => {
    let active = true;
    const load = () =>
      requestJson('/api/objectives')
        .then((result) => {
          if (active) setState(result);
        })
        .catch((err) => {
          if (active) setError(err.message);
        });
    load();
    const interval = setInterval(load, 60000);
    window.addEventListener('focus', load);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', load);
    };
  }, [data]);
  useEffect(() => {
    if (draft) dialog.current?.showModal();
  }, [draft]);
  function open(record, remove = false) {
    trigger.current = document.activeElement;
    setError('');
    setNotice('');
    setDeleting(remove);
    setDraft(record ? { ...record, target_date: record.target_date || '' } : empty());
  }
  function close() {
    dialog.current?.close();
    setDraft(null);
    if (trigger.current?.isConnected) trigger.current.focus();
  }
  async function mutate(operation, message) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await operation();
      close();
      setNotice(message);
      await refresh().catch(() =>
        setError('Saved, but the view could not refresh. Reload to see the latest data.'),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const patch = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const collections = [
    ['focusAreaIds', 'Focus Areas', data.focus_areas.map((r) => [r.id_focus_area, r.name])],
    [
      'subtopicIds',
      'Subtopics',
      data.subtopics.map((r) => [
        r.id_subtopic,
        `${data.focus_areas.find((a) => a.id_focus_area === r.id_focus_area)?.name || ''} · ${r.name}`,
      ]),
    ],
    [
      'sessionIds',
      'Learning sessions',
      data.sessions.map((r) => [
        r.id_session,
        `${r.date} · ${r.subtopicName || data.focus_areas.find((a) => a.id_focus_area === r.id_focus_area)?.name || 'Independent study'} · ${r.durationMinutes / 60}h${r.outcome ? ` · ${r.outcome}` : ''}`,
      ]),
    ],
  ];
  const unfinished = state?.objectives.filter((o) => o.status !== 'Achieved').length || 0;
  return (
    <section aria-label="Growth Objectives dashboard">
      {!draft && error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert success" role="status">
          {notice}
        </p>
      )}
      {!state ? (
        <button
          className="secondary"
          onClick={() => refresh().catch((err) => setError(err.message))}
        >
          Retry loading objectives
        </button>
      ) : (
        <>
          <div className="section-heading">
            <div>
              <h2>Growth Objectives</h2>
              <p className="muted">Connect your learning to outcomes that matter to you.</p>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={state.enabled}
                disabled={busy}
                onChange={(e) =>
                  mutate(
                    () =>
                      requestJson('/api/objectives/preferences', {
                        method: 'PUT',
                        body: { enabled: e.target.checked },
                      }),
                    'Growth Objectives preference saved.',
                  )
                }
              />
              Enable Growth Objectives
            </label>
          </div>
          {!state.enabled ? (
            <p className="empty-card">
              Growth Objectives is disabled. Your objectives are preserved, and you can keep using
              the learning tracker.
            </p>
          ) : (
            <>
              <div className="section-heading">
                <p className="muted">
                  {unfinished}/3 unfinished objectives. Achieve or delete one to make room; archived
                  objectives still count.
                </p>
                <button
                  className="primary"
                  disabled={busy || unfinished >= 3}
                  onClick={() => open()}
                >
                  Add objective
                </button>
              </div>
              <p className="small muted">
                Linked areas and subtopics include their past and future sessions. Each session
                counts once per objective, and once in your weekly budget.
              </p>
              {['Active', 'Archived', 'Achieved'].map((status) => (
                <section
                  className="objectives-group"
                  key={status}
                  aria-label={`${status} objectives`}
                >
                  <h3>{status} objectives</h3>
                  <div className="area-grid">
                    {state.objectives
                      .filter((o) => o.status === status)
                      .map((objective) => (
                        <article className="area-card objective-card" key={objective.id_objective}>
                          <h3>{objective.title}</h3>
                          <p className="small muted">
                            {objective.priority} priority · Target:{' '}
                            {objective.target_date || 'No date set'}
                          </p>
                          <p className="objective-copy">
                            {objective.motivation || 'No motivation added yet.'}
                          </p>
                          <h4>Success criteria</h4>
                          <p className="objective-copy">
                            {objective.success_criteria ||
                              'Define what achievement looks like when you are ready.'}
                          </p>
                          <p>
                            <strong>{objective.totalMinutes / 60}h learning</strong> · Last
                            activity: {objective.lastActivity || 'No activity yet'}
                          </p>
                          {objective.achieved_at && (
                            <p className="small muted">
                              Achieved {objective.achieved_at.slice(0, 10)}
                            </p>
                          )}
                          <p className="small muted">
                            {objective.focusAreaIds.length} areas · {objective.subtopicIds.length}{' '}
                            subtopics · {objective.sessionIds.length} directly linked sessions
                          </p>
                          <div className="objective-actions">
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() => open(objective)}
                            >
                              Edit<span className="sr-only"> {objective.title}</span>
                            </button>
                            {status !== 'Achieved' && (
                              <button
                                className="secondary"
                                disabled={busy}
                                onClick={() =>
                                  mutate(
                                    () =>
                                      requestJson(`/api/objectives/${objective.id_objective}`, {
                                        method: 'PUT',
                                        body: { status: 'Achieved' },
                                      }),
                                    'Objective achieved. Well done!',
                                  )
                                }
                              >
                                Mark achieved
                              </button>
                            )}
                            {status === 'Active' && (
                              <button
                                className="text-button"
                                disabled={busy}
                                onClick={() =>
                                  mutate(
                                    () =>
                                      requestJson(`/api/objectives/${objective.id_objective}`, {
                                        method: 'PUT',
                                        body: { status: 'Archived' },
                                      }),
                                    'Objective archived.',
                                  )
                                }
                              >
                                Archive
                              </button>
                            )}
                            <button
                              className="text-button danger-text"
                              disabled={busy}
                              onClick={() => open(objective, true)}
                            >
                              Delete<span className="sr-only"> {objective.title}</span>
                            </button>
                          </div>
                        </article>
                      ))}
                  </div>
                  {!state.objectives.some((o) => o.status === status) && (
                    <p className="empty-inline">
                      {status === 'Active'
                        ? 'What would you like to develop? Add an objective whenever you are ready.'
                        : `No ${status.toLowerCase()} objectives.`}
                    </p>
                  )}
                </section>
              ))}
            </>
          )}
        </>
      )}
      {draft && (
        <dialog
          ref={dialog}
          aria-label={
            deleting ? 'Delete objective' : draft.id_objective ? 'Edit objective' : 'Add objective'
          }
          onCancel={(e) => {
            e.preventDefault();
            if (!busy) close();
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutate(
                () =>
                  requestJson(
                    `/api/objectives${draft.id_objective ? `/${draft.id_objective}` : ''}`,
                    {
                      method: deleting ? 'DELETE' : draft.id_objective ? 'PUT' : 'POST',
                      body: deleting ? undefined : draft,
                    },
                  ),
                deleting ? 'Objective deleted.' : 'Objective saved.',
              );
            }}
          >
            <h2>
              {deleting
                ? 'Delete objective'
                : draft.id_objective
                  ? 'Edit objective'
                  : 'Add objective'}
            </h2>
            {error && (
              <p className="alert error" role="alert">
                {error}
              </p>
            )}
            {deleting ? (
              <p>
                Delete “{draft.title}”? Its links will be removed. Your learning sessions are kept.
                This cannot be undone.
              </p>
            ) : (
              <div className="form-stack">
                <label className="field">
                  Title
                  <input
                    autoFocus
                    required
                    maxLength={200}
                    value={draft.title}
                    onChange={(e) => patch('title', e.target.value)}
                  />
                </label>
                <label className="field">
                  Motivation
                  <textarea
                    rows={3}
                    maxLength={10000}
                    value={draft.motivation}
                    onChange={(e) => patch('motivation', e.target.value)}
                  />
                </label>
                <div className="form-grid">
                  <label className="field">
                    Priority
                    <select
                      value={draft.priority}
                      onChange={(e) => patch('priority', e.target.value)}
                    >
                      {['Low', 'Medium', 'High'].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Status
                    <select value={draft.status} onChange={(e) => patch('status', e.target.value)}>
                      {['Active', 'Archived', 'Achieved'].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field">
                  Target date (optional)
                  <input
                    type="date"
                    value={draft.target_date}
                    onChange={(e) => patch('target_date', e.target.value)}
                  />
                </label>
                <label className="field">
                  Success criteria
                  <textarea
                    rows={3}
                    maxLength={10000}
                    value={draft.success_criteria}
                    onChange={(e) => patch('success_criteria', e.target.value)}
                  />
                </label>
                <p className="small muted">
                  Achievement is your decision, independent of curriculum completion. All links are
                  optional.
                </p>
                {collections.map(([key, label, records]) => (
                  <fieldset className="objective-links" key={key}>
                    <legend>{label}</legend>
                    {records.length ? (
                      records.map(([id, name]) => (
                        <label className="checkbox" key={id}>
                          <input
                            type="checkbox"
                            checked={draft[key].includes(id)}
                            onChange={(e) =>
                              patch(
                                key,
                                e.target.checked
                                  ? [...draft[key], id]
                                  : draft[key].filter((item) => item !== id),
                              )
                            }
                          />
                          {name}
                        </label>
                      ))
                    ) : (
                      <p className="small muted">None available yet.</p>
                    )}
                  </fieldset>
                ))}
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
              <button className={deleting ? 'primary danger-button' : 'primary'} disabled={busy}>
                {busy ? 'Saving…' : deleting ? 'Delete objective' : 'Save objective'}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  );
}
