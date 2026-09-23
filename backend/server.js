const express = require('express');
const cors = require('cors');

const app = express();
const port = Number(process.env.PORT || 4000);

const settings = {
  timezone: 'UTC',
  weeklyCommitmentMinutes: 7 * 60,
  weeklyBufferMinutes: 2 * 60,
  revisionSlots: 2,
  weekStartDay: 'Sunday',
  notificationPreferences: {
    studyReminders: true,
    browserNotifications: false,
  },
};

const categories = [
  {
    id: 'cat-1',
    name: 'Data Engineering',
    description: 'Systems, pipelines, and data platform fundamentals.',
    curriculumEnabled: true,
    archivedAt: null,
    topicCount: 4,
  },
  {
    id: 'cat-2',
    name: 'Product Thinking',
    description: 'Research, strategy, and communication patterns.',
    curriculumEnabled: false,
    archivedAt: null,
    topicCount: 3,
  },
];

const topics = [
  {
    id: 'topic-1',
    categoryId: 'cat-1',
    name: 'Data modeling basics',
    status: 'Completed',
    completedAt: '2026-09-20',
    notes: 'Normalized schemas and table design review.',
  },
  {
    id: 'topic-2',
    categoryId: 'cat-1',
    name: 'ETL orchestration',
    status: 'In Progress',
    completedAt: null,
    notes: 'Focus on Airflow-style scheduling and retries.',
  },
  {
    id: 'topic-3',
    categoryId: 'cat-1',
    name: 'Warehouse performance tuning',
    status: 'Not started',
    completedAt: null,
    notes: 'Comparing sort keys, partitioning, and clustering.',
  },
  {
    id: 'topic-4',
    categoryId: 'cat-1',
    name: 'Data quality checks',
    status: 'Not started',
    completedAt: null,
    notes: 'Validation patterns and anomaly detection.',
  },
  {
    id: 'topic-5',
    categoryId: 'cat-2',
    name: 'Customer interviews',
    status: 'Completed',
    completedAt: '2026-09-18',
    notes: 'Summaries and insight extraction.',
  },
  {
    id: 'topic-6',
    categoryId: 'cat-2',
    name: 'Messaging frameworks',
    status: 'In Progress',
    completedAt: null,
    notes: 'Positioning and story clarity exercises.',
  },
];

const sessions = [
  {
    id: 'session-1',
    categoryId: 'cat-1',
    topicId: 'topic-1',
    topicName: 'Data modeling basics',
    date: '2026-09-20',
    durationMinutes: 90,
    sessionType: 'learning',
    outcome: 'Improved indexing and schema review',
    notes: 'Read design notes and mapped table relationships.',
  },
  {
    id: 'session-2',
    categoryId: 'cat-1',
    topicId: 'topic-2',
    topicName: 'ETL orchestration',
    date: '2026-09-22',
    durationMinutes: 60,
    sessionType: 'learning',
    outcome: 'Reviewed retry logic',
    notes: 'Looked at dependency patterns and scheduler edge cases.',
  },
  {
    id: 'session-3',
    categoryId: 'cat-2',
    topicId: 'topic-5',
    topicName: 'Customer interviews',
    date: '2026-09-19',
    durationMinutes: 45,
    sessionType: 'revision',
    outcome: 'Strengthened interview synthesis',
    notes: 'Revisited the top themes from previous conversations.',
  },
  {
    id: 'session-4',
    categoryId: 'cat-1',
    topicId: null,
    topicName: null,
    date: '2026-09-23',
    durationMinutes: 30,
    sessionType: 'learning',
    outcome: 'Unstructured study block',
    notes: 'Explored pipeline monitoring and alerting concepts.',
  },
];

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'growly-backend', timestamp: new Date().toISOString() });
});

app.get('/api/settings', (req, res) => {
  res.json(settings);
});

app.get('/api/dashboard', (req, res) => {
  const totalMinutes = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const commitmentMinutes = settings.weeklyCommitmentMinutes;
  const bufferMinutes = settings.weeklyBufferMinutes;
  const commitmentProgress = Math.min((totalMinutes / commitmentMinutes) * 100, 100);
  const overflowMinutes = Math.max(totalMinutes - commitmentMinutes, 0);
  const bufferProgress = Math.min((overflowMinutes / bufferMinutes) * 100, 100);

  res.json({
    weekStartDay: settings.weekStartDay,
    weeklyCommitmentMinutes: commitmentMinutes,
    weeklyBufferMinutes: bufferMinutes,
    timeLoggedMinutes: totalMinutes,
    commitmentProgress,
    bufferProgress,
    categories: categories.length,
    topics: topics.length,
    sessions: sessions.length,
  });
});

app.get('/api/categories', (req, res) => {
  res.json(categories);
});

app.get('/api/topics', (req, res) => {
  res.json(topics);
});

app.get('/api/sessions', (req, res) => {
  res.json(sessions);
});

app.listen(port, () => {
  console.log(`Growly backend listening on http://localhost:${port}`);
});
