'use client';

import { useState } from 'react';
import { activityState } from '../lib/activity.mjs';

export default function ActivityOverview({ subtopics, focusAreas, onReview }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const rows = subtopics.map((topic) => ({
    ...topic,
    activity: activityState(topic),
    area: focusAreas.find((area) => area.id_focus_area === topic.id_focus_area)?.name || '',
  }));
  const visible = rows
    .filter(
      (topic) =>
        (filter === 'all' || topic.activity.key === filter) &&
        `${topic.name} ${topic.area}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (a.lastCovered || '').localeCompare(b.lastCovered || '') || a.name.localeCompare(b.name),
    );
  return (
    <section className="activity-overview" aria-label="Subtopic activity overview">
      <div className="section-heading">
        <div>
          <h2>Keep the cobwebs off.</h2>
          <p className="muted small">Study and revision history, including completed subtopics.</p>
        </div>
      </div>
      <div className="activity-summary">
        {[
          ['recent', 'Active · last 7 days'],
          ['quiet', 'Getting quiet · 8–14 days'],
          ['stale', 'Ready for review · 15+ days'],
          ['never', 'Not studied yet'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`secondary ${filter === key ? 'filter-selected' : ''}`}
            aria-pressed={filter === key}
            onClick={() => setFilter(filter === key ? 'all' : key)}
          >
            {label} <strong>{rows.filter((row) => row.activity.key === key).length}</strong>
          </button>
        ))}
      </div>
      <label className="field activity-search">
        <span>Search activity</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a subtopic or Focus Area"
        />
      </label>
      <p className="small muted">
        Showing {visible.length} of {rows.length}. Oldest activity first.{' '}
        {filter !== 'all' && (
          <button className="text-button" onClick={() => setFilter('all')}>
            Show all
          </button>
        )}
      </p>
      {visible.length ? (
        <div className="activity-list">
          {visible.map((topic) => (
            <article className="activity activity-detail" key={topic.id_subtopic}>
              <div>
                <strong>{topic.name}</strong>
                <span className="small muted">
                  {topic.area} · {topic.sessionCount} sessions ·{' '}
                  {new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
                    topic.totalMinutes / 60,
                  )}
                  h
                </span>
                <span className="small muted">
                  Last covered: {topic.lastCovered || 'Never'}
                  {topic.lastReviewed ? ` · Last reviewed: ${topic.lastReviewed}` : ''}
                </span>
              </div>
              <span className={`recency ${topic.activity.key}`}>{topic.activity.label}</span>
              <button className="secondary" onClick={() => onReview(topic)}>
                Review<span className="sr-only"> {topic.name}</span>
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-card">
          <h3>
            {rows.length
              ? 'No matches in this corner.'
              : 'Your activity story starts with a subtopic.'}
          </h3>
          <p>
            {rows.length
              ? 'Try another filter or search.'
              : 'Add a subtopic in Focus Areas, then log a session against it.'}
          </p>
        </div>
      )}
    </section>
  );
}
