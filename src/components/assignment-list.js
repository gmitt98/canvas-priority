// Assignment list — rendered as a sortable, searchable table

import { formatDueDate, getPriorityLevel, escapeHtml, truncate, debounce } from '../lib/utils.js';

/**
 * Render the assignment list as a table into container.
 * The toolbar is created once and preserved across re-renders to keep focus
 * and debounce state intact. Only the table section is rebuilt each time.
 * @param {HTMLElement} container
 * @param {Object} options
 */
export function renderAssignmentList(container, options = {}) {
  const {
    assignments = [],
    courseMap = {},
    sortBy = 'priority',
    sortDir = 'desc',
    showCompleted = false,
    hideOverdue = false,
    filterText = '',
    handlers = {},
  } = options;

  // ── Toolbar (create once, update state on re-renders) ─────────────────────────
  let toolbar = container.querySelector('.list-toolbar');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.className = 'list-toolbar';
    toolbar.innerHTML = `
      <div class="toolbar-search">
        <span class="search-icon">🔍</span>
        <input
          type="search"
          class="search-input"
          placeholder="Search assignments, courses, or points…"
          value="${escapeHtml(filterText)}"
          aria-label="Search assignments"
        />
      </div>
      <div class="toolbar-filters">
        <label class="filter-chip ${showCompleted ? 'active' : ''}" data-chip="show-completed">
          <input type="checkbox" class="show-completed-checkbox" ${showCompleted ? 'checked' : ''} />
          Show completed
        </label>
        <label class="filter-chip ${hideOverdue ? 'active' : ''}" data-chip="hide-overdue">
          <input type="checkbox" class="hide-overdue-checkbox" ${hideOverdue ? 'checked' : ''} />
          Hide overdue
        </label>
      </div>
    `;
    container.appendChild(toolbar);

    const searchInput = toolbar.querySelector('.search-input');
    searchInput.addEventListener('input', debounce((e) => {
      if (handlers.onSearchChange) handlers.onSearchChange(e.target.value);
    }, 150));

    const showCompletedCheckbox = toolbar.querySelector('.show-completed-checkbox');
    const showCompletedChip = toolbar.querySelector('[data-chip="show-completed"]');
    showCompletedCheckbox.addEventListener('change', (e) => {
      showCompletedChip.classList.toggle('active', e.target.checked);
      if (handlers.onShowCompletedChange) handlers.onShowCompletedChange(e.target.checked);
    });

    const hideOverdueCheckbox = toolbar.querySelector('.hide-overdue-checkbox');
    const hideOverdueChip = toolbar.querySelector('[data-chip="hide-overdue"]');
    hideOverdueCheckbox.addEventListener('change', (e) => {
      hideOverdueChip.classList.toggle('active', e.target.checked);
      if (handlers.onHideOverdueChange) handlers.onHideOverdueChange(e.target.checked);
    });
  } else {
    // Sync chip states without touching the search input (user may be typing)
    const showCompletedCheckbox = toolbar.querySelector('.show-completed-checkbox');
    const showCompletedChip = toolbar.querySelector('[data-chip="show-completed"]');
    showCompletedCheckbox.checked = showCompleted;
    showCompletedChip.classList.toggle('active', showCompleted);

    const hideOverdueCheckbox = toolbar.querySelector('.hide-overdue-checkbox');
    const hideOverdueChip = toolbar.querySelector('[data-chip="hide-overdue"]');
    hideOverdueCheckbox.checked = hideOverdue;
    hideOverdueChip.classList.toggle('active', hideOverdue);
  }

  // Remove previous table section before rebuilding
  container.querySelectorAll('.table-wrap, .empty-state, .table-footer').forEach(el => el.remove());

  // ── Filter & sort data ────────────────────────────────────────────────────────
  const now = new Date();
  let rows = assignments;
  if (!showCompleted) rows = rows.filter(a => !a.completed_local);
  if (hideOverdue) rows = rows.filter(a => !a.due_at || new Date(a.due_at) >= now);

  if (filterText.trim()) {
    const q = filterText.toLowerCase();
    rows = rows.filter(a => {
      const c = courseMap[a.course_id] || {};
      return (
        a.name.toLowerCase().includes(q) ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.course_code || '').toLowerCase().includes(q) ||
        String(a.points_possible ?? '').includes(q)
      );
    });
  }

  rows = [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'priority') {
      cmp = (a.priority_score || 0) - (b.priority_score || 0); // ascending base
    } else if (sortBy === 'due_date') {
      const da = a.due_at ? new Date(a.due_at).getTime() : Infinity;
      const db = b.due_at ? new Date(b.due_at).getTime() : Infinity;
      cmp = da - db; // ascending base (soonest first)
    } else if (sortBy === 'course') {
      const ca = (courseMap[a.course_id]?.name || '').toLowerCase();
      const cb = (courseMap[b.course_id]?.name || '').toLowerCase();
      cmp = ca < cb ? -1 : ca > cb ? 1 : 0;
    } else if (sortBy === 'name') {
      cmp = a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
    } else if (sortBy === 'points') {
      cmp = (a.points_possible || 0) - (b.points_possible || 0);
    }
    // Apply sort direction uniformly across all columns
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // ── Table ────────────────────────────────────────────────────────────────────
  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrap';

  if (rows.length === 0) {
    tableWrap.className = 'empty-state';
    tableWrap.innerHTML = `
      <div>
        ${assignments.length === 0
          ? '<p>No assignments yet — click <strong>↻ Refresh</strong> to sync from Canvas.</p>'
          : filterText
            ? `<p>No assignments match "<strong>${escapeHtml(filterText)}</strong>"</p>`
            : '<p>All caught up! No pending assignments. 🎉</p>'}
      </div>`;
    container.appendChild(tableWrap);
    return;
  }

  // Helper to build a sortable <th>
  function th(label, key, extraClass = '') {
    const isActive = sortBy === key;
    const arrow = isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
    return `<th class="col-${key} ${extraClass} ${isActive ? 'sort-active' : ''}" data-sort="${key}" role="columnheader" aria-sort="${isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}" tabindex="0">${label}${arrow}</th>`;
  }

  const table = document.createElement('table');
  table.className = 'assignment-table';
  table.setAttribute('role', 'table');
  table.innerHTML = `
    <thead>
      <tr>
        ${th('Priority', 'priority')}
        ${th('Assignment', 'name')}
        ${th('Course', 'course')}
        ${th('Due', 'due_date')}
        ${th('Points', 'points')}
        <th class="col-actions">Actions</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  // Sort header clicks
  table.querySelectorAll('th[data-sort]').forEach(header => {
    const onClick = () => {
      const key = header.dataset.sort;
      if (handlers.onSortChange) {
        // Toggle if already sorted by this column, else use sensible default per column
        const defaultDir = key === 'due_date' ? 'asc' : 'desc';
        const newDir = sortBy === key ? (sortDir === 'asc' ? 'desc' : 'asc') : defaultDir;
        handlers.onSortChange(key, newDir);
      }
    };
    header.addEventListener('click', onClick);
    header.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') onClick(); });
  });

  const tbody = table.querySelector('tbody');

  rows.forEach((a, i) => {
    const course = courseMap[a.course_id] || {};
    const level = getPriorityLevel(a.priority_score || 0);
    const dueDisplay = formatDueDate(a.due_at);
    const isOverdue = a.due_at && new Date(a.due_at) < new Date();
    const wouldDrop = a.priority_components?.wouldDropGrade;
    const score = ((a.priority_score || 0) * 100).toFixed(0);

    const tr = document.createElement('tr');
    tr.className = `assignment-row priority-row-${level}${a.completed_local ? ' row-completed' : ''}`;
    tr.dataset.id = a.id;

    tr.innerHTML = `
      <td class="col-priority">
        <span class="priority-pill ${level}">${level.toUpperCase()}</span>
        <span class="priority-score-num">${score}</span>
        ${wouldDrop ? '<span class="grade-risk" title="Missing this would drop your letter grade">⚠</span>' : ''}
      </td>
      <td class="col-name">
        ${a.html_url
          ? `<a class="assignment-link" href="${escapeHtml(a.html_url)}" target="_blank" rel="noopener" title="${escapeHtml(a.name)}">${escapeHtml(truncate(a.name, 65))}</a>`
          : `<span title="${escapeHtml(a.name)}">${escapeHtml(truncate(a.name, 65))}</span>`}
        ${a.manual_override ? '<span class="override-tag">override</span>' : ''}
      </td>
      <td class="col-course">
        <span class="course-chip">${escapeHtml(truncate(course.course_code || course.name || '—', 18))}</span>
      </td>
      <td class="col-due ${isOverdue ? 'overdue' : ''}">
        ${escapeHtml(dueDisplay)}
      </td>
      <td class="col-points">${a.points_possible > 0 ? a.points_possible + ' pts' : '—'}</td>
      <td class="col-actions">
        <label class="done-toggle" title="${a.completed_local ? 'Mark incomplete' : 'Mark complete'}">
          <input type="checkbox" class="done-checkbox" ${a.completed_local ? 'checked' : ''} aria-label="Mark as done" />
          <span class="done-label">${a.completed_local ? 'Done' : 'Done'}</span>
        </label>
        <button class="action-btn override-btn" title="Override priority">✎</button>
      </td>
    `;

    const checkbox = tr.querySelector('.done-checkbox');
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      tr.classList.toggle('row-completed', e.target.checked);
      if (handlers.onComplete) handlers.onComplete(a.id, e.target.checked);
    });

    const overrideBtn = tr.querySelector('.override-btn');
    overrideBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (handlers.onOverride) handlers.onOverride(a.id);
    });

    tbody.appendChild(tr);
  });

  tableWrap.appendChild(table);
  container.appendChild(tableWrap);

  // Row count footer
  const footer = document.createElement('div');
  footer.className = 'table-footer';
  footer.textContent = `${rows.length} assignment${rows.length !== 1 ? 's' : ''}`;
  container.appendChild(footer);
}
