// Calendar view component — weekly grid of assignments

import { getWeekStart, toDateString, formatDueDate, getPriorityLevel, escapeHtml, truncate } from '../lib/utils.js';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Render the weekly calendar view.
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {Array} options.assignments
 * @param {Object} options.courseMap - courseId → course
 * @param {Date} options.weekStart - Monday of the displayed week (defaults to current week)
 * @param {string|null} options.selectedDate - YYYY-MM-DD or null
 * @param {Object} options.handlers - { onDateSelect, onWeekChange, onAssignmentClick }
 */
export function renderCalendarView(container, options = {}) {
  const {
    assignments = [],
    courseMap = {},
    weekStart = getWeekStart(new Date()),
    selectedDate = null,
    handlers = {},
  } = options;

  container.innerHTML = '';

  // ── Header with navigation ────────────────────────────────────────────────────
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const header = document.createElement('div');
  header.className = 'calendar-header';
  header.innerHTML = `
    <button class="btn btn-ghost prev-week-btn" aria-label="Previous week">← Prev</button>
    <h2 class="week-label">${_formatWeekLabel(weekStart, weekEnd)}</h2>
    <button class="btn btn-ghost next-week-btn" aria-label="Next week">Next →</button>
  `;
  container.appendChild(header);

  header.querySelector('.prev-week-btn').addEventListener('click', () => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    if (handlers.onWeekChange) handlers.onWeekChange(prev);
  });
  header.querySelector('.next-week-btn').addEventListener('click', () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    if (handlers.onWeekChange) handlers.onWeekChange(next);
  });

  // ── Build date → assignments map ──────────────────────────────────────────────
  const assignmentsByDate = {};
  for (const a of assignments) {
    if (!a.due_at) continue;
    const dateStr = toDateString(new Date(a.due_at));
    if (!assignmentsByDate[dateStr]) assignmentsByDate[dateStr] = [];
    assignmentsByDate[dateStr].push(a);
  }

  // ── Grid ─────────────────────────────────────────────────────────────────────
  const grid = document.createElement('div');
  grid.className = 'calendar-grid';
  container.appendChild(grid);

  const todayStr = toDateString(new Date());

  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    const dateStr = toDateString(day);
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDate;
    const dayAssignments = assignmentsByDate[dateStr] || [];

    // Sort by priority descending
    dayAssignments.sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));

    const col = document.createElement('div');
    col.className = `day-column${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`;
    col.dataset.date = dateStr;
    col.setAttribute('role', 'button');
    col.setAttribute('tabindex', '0');
    col.setAttribute('aria-label', `${DAY_NAMES[i]} ${day.toLocaleDateString()}, ${dayAssignments.length} assignment(s)`);

    col.innerHTML = `
      <div class="day-header">
        <span class="day-name">${DAY_NAMES[i]}</span>
        <span class="day-number">${day.getDate()}</span>
      </div>
      <div class="day-assignments"></div>
    `;

    const dayAssignmentsEl = col.querySelector('.day-assignments');
    for (const a of dayAssignments) {
      const level = getPriorityLevel(a.priority_score || 0);
      const course = courseMap[a.course_id] || {};
      const chip = document.createElement('div');
      chip.className = `calendar-assignment priority-${level}`;
      chip.title = `${a.name} — ${course.name || ''} (${formatDueDate(a.due_at)})`;
      chip.setAttribute('role', 'button');
      chip.setAttribute('tabindex', '0');
      chip.innerHTML = `
        <span class="cal-assignment-name">${escapeHtml(truncate(a.name, 30))}</span>
        <span class="cal-course">${escapeHtml(truncate(course.course_code || course.name || '', 12))}</span>
      `;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        if (handlers.onAssignmentClick) handlers.onAssignmentClick(a);
        else if (a.html_url) window.open(a.html_url, '_blank', 'noopener');
      });
      chip.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') chip.click();
      });
      dayAssignmentsEl.appendChild(chip);
    }

    if (dayAssignments.length === 0) {
      dayAssignmentsEl.innerHTML = '<span class="no-assignments">—</span>';
    }

    col.addEventListener('click', () => {
      if (handlers.onDateSelect) handlers.onDateSelect(dateStr);
    });
    col.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') col.click();
    });

    grid.appendChild(col);
  }

  // ── Selected date detail ──────────────────────────────────────────────────────
  if (selectedDate && assignmentsByDate[selectedDate]) {
    const detail = document.createElement('div');
    detail.className = 'calendar-day-detail';
    const dateObj = new Date(selectedDate + 'T00:00:00');
    detail.innerHTML = `
      <h3>Assignments on ${dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
    `;
    const ul = document.createElement('ul');
    ul.className = 'calendar-detail-list';
    for (const a of assignmentsByDate[selectedDate]) {
      const course = courseMap[a.course_id] || {};
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="priority-dot priority-${getPriorityLevel(a.priority_score || 0)}"></span>
        <span class="cal-detail-name">${escapeHtml(a.name)}</span>
        <span class="cal-detail-course">${escapeHtml(course.name || '')}</span>
        ${a.html_url ? `<a href="${escapeHtml(a.html_url)}" target="_blank" rel="noopener" class="cal-detail-link">Open ↗</a>` : ''}
      `;
      ul.appendChild(li);
    }
    detail.appendChild(ul);
    container.appendChild(detail);
  }
}

function _formatWeekLabel(start, end) {
  const opts = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', opts);
  const endStr = end.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  return `${startStr} – ${endStr}`;
}
