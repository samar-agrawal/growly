const categories = [
  { name: 'System Design', value: '40%', foot: '2 of 5 topics complete', tag: 'Curriculum', tone: 'green' },
  { name: 'Algorithms', value: '62%', foot: '8 of 13 topics complete', tag: 'Curriculum', tone: 'green' },
  { name: 'Reading', value: '3.5h', foot: 'Unstructured learning', tag: 'General', tone: 'gray' },
  { name: 'Revision', value: '2.0h', foot: 'Review buffer', tag: 'General', tone: 'gray' }
];

const topics = [
  { name: 'Caching', status: 'complete', meta: 'Last covered today · 3 sessions' },
  { name: 'Load balancing', status: 'inprogress', meta: 'Last covered 2 days ago · 2 sessions' },
  { name: 'Database partitioning', status: 'inprogress', meta: 'Last covered 4 days ago · 4 sessions' },
  { name: 'Message queues', status: 'pending', meta: 'Not started yet' }
];

const categoryList = document.getElementById('category-list');
const topicList = document.getElementById('topic-list');

function renderCategories() {
  if (!categoryList) return;

  categoryList.innerHTML = categories
    .map(
      (category) => `
        <article class="category-card">
          <div class="category-head">
            <span class="category-title">${category.name}</span>
            <span class="tag ${category.tone}">${category.tag}</span>
          </div>
          <div class="value">${category.value}</div>
          <div class="foot">${category.foot}</div>
        </article>
      `
    )
    .join('');
}

function toggleTopicComplete(event) {
  const checkbox = event.currentTarget;
  const item = checkbox.closest('.topic-item');
  const statusEl = item.querySelector('.topic-status');

  if (checkbox.checked) {
    item.classList.add('is-complete');
    statusEl.className = 'topic-status complete';
    statusEl.textContent = 'Completed';
  } else {
    item.classList.remove('is-complete');
    statusEl.className = 'topic-status pending';
    statusEl.textContent = 'Not started';
  }
}

function renderTopics() {
  if (!topicList) return;

  topicList.innerHTML = topics
    .map((topic) => {
      const statusClass =
        topic.status === 'complete'
          ? 'complete'
          : topic.status === 'inprogress'
            ? 'inprogress'
            : 'pending';

      const label =
        topic.status === 'complete'
          ? 'Completed'
          : topic.status === 'inprogress'
            ? 'In progress'
            : 'Not started';

      const checked = topic.status === 'complete' ? 'checked' : '';

      return `
        <div class="topic-item">
          <div class="topic-row">
            <label class="checkbox-label ${checked}">
              <input type="checkbox" ${checked} />✓
            </label>
            <div class="topic-top" style="flex: 1;">
              <span class="topic-name">${topic.name}</span>
              <span class="topic-status ${statusClass}">${label}</span>
            </div>
          </div>
          <div class="topic-meta">
            <span>${topic.meta}</span>
            <span>3 sessions</span>
          </div>
        </div>
      `;
    })
    .join('');

  document.querySelectorAll('.checkbox-label input').forEach((checkbox) => {
    checkbox.addEventListener('change', toggleTopicComplete);
  });
}

const topicForm = document.getElementById('topic-form');
if (topicForm) {
  topicForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = topicForm.querySelector('input[type="text"]');
    if (!input || !input.value.trim()) return;

    topics.unshift({
      name: input.value.trim(),
      status: 'pending',
      meta: 'Not started yet'
    });

    renderTopics();
    input.value = '';
  });
}

renderCategories();
renderTopics();
