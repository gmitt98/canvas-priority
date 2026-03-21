// Assignment list component — sortable, filterable list of assignment cards

import { createAssignmentCard } from './assignment-card.js';
import { debounce } from '../lib/utils.js';

/**
 * Render the assignment list into a container element.
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {Array} options.assignments
 * @param {Object} options.courseMap - courseId → course
 * @param {string} options.sortBy - 'priority' | 'due_date' | 'course'
 * @param {boolean} options.showCompleted
 * @param {string} options.filterText - Search filter
 * @param {Object} options.handlers - { onComplete, onOverride, onSortChange, onSearchChange, onShowCompletedChange }
 */
export function renderAssignmentList(container, options = {}) {
  const {
    assignments = [],
    courseMap = {},
    sortBy = 'priority',
    showCompleted = false,
    filterText = '',
    handlers = {},
  } = options;

  container.innerHTML = '';

  // ── Controls bar ─────────────────────────────────────────────────────────────
  const controls = document.createElement('div');
  controls.className = 'list-controls';
  controls.innerHTML = `
    <div class="list-controls-left">
      <input type="search" class="form-input search-input" placeholder="Search assignments…" value="${filterText}" aria-label="Search assignments" />
    </div>
    <div class="list-controls-right">
      <label class="sort-label">
        Sort:
        <select class="form-input sort-select" aria-label="Sort assignments">
          <option value="priority" ${sortBy === 'priority' ? 'selected' : ''}>Priority</option>
          <option value="due_date" ${sortBy === 'due_date' ? 'selected' : ''}>Due Date</option>
          <option value="course" ${sortBy === 'course' ? 'selected' : ''}>Course</option>
        </select>
      </label>
      <label class="show-completed-label">
        <input type="checkbox" class="show-completed-checkbox" ${showCompleted ? 'checked' : ''} />
        Show done
      </label>
    </div>
  `;
  container.appendChild(controls);

  // Wire controls
  const searchInput = controls.querySelector('.search-input');
  searchInput.addEventListener('input', debounce((e) => {
    if (handlers.onSearchChange) handlers.onSearchChange(e.target.value);
  }, 300));

  const sortSelect = controls.querySelector('.sort-select');
  sortSelect.addEventListener('change', (e) => {
    if (handlers.onSortChange) handlers.onSortChange(e.target.value);
  });

  const showCompletedCheckbox = controls.querySelector('.show-completed-checkbox');
  showCompletedCheckbox.addEventListener('change', (e) => {
    if (handlers.onShowCompletedChange) handlers.onShowCompletedChange(e.target.checked);
  });

  // ── Filter ───────────────────────────────────────────────────────────────────
  let filtered = assignments;

  if (!showCompleted) {
    filtered = filtered.filter(a => !a.completed_local);
  }

  if (filterText.trim()) {
    const query = filterText.toLowerCase();
    filtered = filtered.filter(a => {
      const course = courseMap[a.course_id] || {};
      return (
        a.name.toLowerCase().includes(query) ||
        (course.name || '').toLowerCase().includes(query) ||
        (course.course_code || '').toLowerCase().includes(query)
      );
    });
  }

  // ── Sort ─────────────────────────────────────────────────────────────────────
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'priority') {
      return (b.priority_score || 0) - (a.priority_score || 0);
    }
    if (sortBy === 'due_date') {
      const dateA = a.due_at ? new Date(a.due_at).getTime() : Infinity;
      const dateB = b.due_at ? new Date(b.due_at).getTime() : Infinity;
      return dateA - dateB;
    }
    if (sortBy === 'course') {
      const courseA = (courseMap[a.course_id]?.name || '').toLowerCase();
      const courseB = (courseMap[b.course_id]?.name || '').toLowerCase();
      if (courseA < courseB) return -1;
      if (courseA > courseB) return 1;
      return (b.priority_score || 0) - (a.priority_score || 0);
    }
    return 0;
  });

  // ── Render cards ─────────────────────────────────────────────────────────────
  const list = document.createElement('div');
  list.className = 'assignment-list';
  list.setAttribute('role', 'list');

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    if (assignments.length === 0) {
      empty.innerHTML = '<p>No assignments loaded yet. Click Refresh to sync from Canvas.</p>';
    } else if (filterText) {
      empty.innerHTML = `<p>No assignments matching "<strong>${filterText}</strong>".</p>`;
    } else {
      empty.innerHTML = '<p>All caught up! No assignments due soon. 🎉</p>';
    }
    list.appendChild(empty);
  } else {
    for (const assignment of filtered) {
      const cardEl = createAssignmentCard(assignment, courseMap, {
        onComplete: handlers.onComplete,
        onOverride: handlers.onOverride,
      });
      cardEl.setAttribute('role', 'listitem');
      list.appendChild(cardEl);
    }
  }

  container.appendChild(list);
}
