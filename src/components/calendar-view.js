// Calendar view component — 4-week grid of assignments

import { getWeekStart, toDateString, getPriorityLevel, escapeHtml, truncate } from '../lib/utils.js';

const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES_LONG  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const DAYS_SHOWN = 28; // 4 weeks

export function renderCalendarView(container, options = {}) {
  const {
    assignments = [],
    courseMap = {},
    weekStart = getWeekStart(new Date()),
    selectedDate = null,
    showCompleted = false,
    handlers = {},
  } = options;

  container.innerHTML = '';

  const periodEnd = new Date(weekStart);
  periodEnd.setDate(periodEnd.getDate() + DAYS_SHOWN - 1);
  const todayStr = toDateString(new Date());

  // ── Nav header ────────────────────────────────────────────────────────────────
  const nav = document.createElement('div');
  nav.className = 'cal-nav';
  nav.innerHTML = `
    <button class="cal-nav-btn prev-week-btn" aria-label="Previous 4 weeks">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="cal-nav-center">
      <h2 class="week-label">${_formatPeriodLabel(weekStart, periodEnd)}</h2>
      ${_isCurrentPeriod(weekStart, todayStr) ? '' : `<button class="today-btn">Today</button>`}
    </div>
    <div class="cal-nav-right">
      <label class="filter-chip ${showCompleted ? 'active' : ''}">
        <input type="checkbox" class="show-completed-checkbox" ${showCompleted ? 'checked' : ''} />
        Show completed
      </label>
    </div>
    <button class="cal-nav-btn next-week-btn" aria-label="Next 4 weeks">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  `;
  container.appendChild(nav);

  nav.querySelector('.prev-week-btn').addEventListener('click', () => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - DAYS_SHOWN);
    if (handlers.onWeekChange) handlers.onWeekChange(prev);
  });
  nav.querySelector('.next-week-btn').addEventListener('click', () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + DAYS_SHOWN);
    if (handlers.onWeekChange) handlers.onWeekChange(next);
  });
  nav.querySelector('.today-btn')?.addEventListener('click', () => {
    if (handlers.onWeekChange) handlers.onWeekChange(getWeekStart(new Date()));
  });

  const showCompletedCheckbox = nav.querySelector('.show-completed-checkbox');
  const filterChip = nav.querySelector('.filter-chip');
  showCompletedCheckbox?.addEventListener('change', (e) => {
    filterChip.classList.toggle('active', e.target.checked);
    if (handlers.onShowCompletedChange) handlers.onShowCompletedChange(e.target.checked);
  });

  // ── Build date → assignments map ──────────────────────────────────────────────
  const byDate = {};
  for (const a of assignments) {
    if (!a.due_at) continue;
    if (a.completed_local && !showCompleted) continue;
    const d = toDateString(new Date(a.due_at));
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(a);
  }
  for (const d of Object.keys(byDate)) {
    byDate[d].sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));
  }

  // ── Day-name header row ───────────────────────────────────────────────────────
  const dayNames = document.createElement('div');
  dayNames.className = 'cal-day-names';
  for (const name of DAY_NAMES_SHORT) {
    const label = document.createElement('div');
    label.className = 'cal-day-name-label';
    label.textContent = name;
    dayNames.appendChild(label);
  }
  container.appendChild(dayNames);

  // ── Grid (4 rows × 7 columns = 28 days) ──────────────────────────────────────
  const grid = document.createElement('div');
  grid.className = 'cal-grid';
  container.appendChild(grid);

  for (let i = 0; i < DAYS_SHOWN; i++) {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    const dateStr    = toDateString(day);
    const isToday    = dateStr === todayStr;
    const isSelected = dateStr === selectedDate;
    const isWeekend  = i % 7 >= 5;
    const isWeekRow2Plus = i >= 7; // rows 2–4 get a top border separator
    const dayItems   = byDate[dateStr] || [];
    const dow        = i % 7; // 0=Mon … 6=Sun

    const col = document.createElement('div');
    col.className = [
      'cal-day',
      isToday         ? 'cal-day--today'     : '',
      isSelected      ? 'cal-day--selected'  : '',
      isWeekend       ? 'cal-day--weekend'   : '',
      isWeekRow2Plus  ? 'cal-day--new-week'  : '',
    ].filter(Boolean).join(' ');
    col.dataset.date = dateStr;
    col.setAttribute('role', 'button');
    col.setAttribute('tabindex', '0');
    col.setAttribute('aria-label', `${DAY_NAMES_LONG[dow]} ${day.toLocaleDateString()}, ${dayItems.length} assignment(s)`);

    // Date number (no day name — shared header row above handles that)
    const dayHeader = document.createElement('div');
    dayHeader.className = 'cal-day-header';
    dayHeader.innerHTML = `
      <span class="cal-day-number${isToday ? ' cal-day-number--today' : ''}">${day.getDate()}</span>
      ${day.getDate() === 1 ? `<span class="cal-day-month">${MONTH_NAMES[day.getMonth()]}</span>` : ''}
      ${dayItems.length > 0 ? `<span class="cal-day-count">${dayItems.length}</span>` : ''}
    `;
    col.appendChild(dayHeader);

    // Assignment chips — max 2 per cell (cells are shorter in 4-week layout)
    const chipsWrap = document.createElement('div');
    chipsWrap.className = 'cal-chips';

    if (dayItems.length === 0) {
      // no empty label — keep cells clean in 4-week view
    } else {
      const visible  = dayItems.slice(0, 2);
      const overflow = dayItems.length - visible.length;

      for (const a of visible) {
        const level = getPriorityLevel(a.priority_score || 0);
        const course = courseMap[a.course_id] || {};
        const chip  = document.createElement('div');
        chip.className = `cal-chip cal-chip--${level}`;
        chip.title = `${a.name} · ${course.name || ''}`;
        chip.setAttribute('role', 'button');
        chip.setAttribute('tabindex', '0');
        chip.innerHTML = `
          <span class="cal-chip-dot"></span>
          <span class="cal-chip-name">${escapeHtml(truncate(a.name, 22))}</span>
        `;
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          if (handlers.onAssignmentClick) handlers.onAssignmentClick(a);
          else if (a.html_url) window.open(a.html_url, '_blank', 'noopener');
        });
        chip.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chip.click(); }
        });
        chipsWrap.appendChild(chip);
      }

      if (overflow > 0) {
        const more = document.createElement('span');
        more.className = 'cal-overflow';
        more.textContent = `+${overflow}`;
        chipsWrap.appendChild(more);
      }
    }

    col.appendChild(chipsWrap);

    col.addEventListener('click', () => {
      if (handlers.onDateSelect) handlers.onDateSelect(dateStr);
    });
    col.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); col.click(); }
    });

    grid.appendChild(col);
  }

  // ── Detail panel ──────────────────────────────────────────────────────────────
  if (selectedDate) {
    const items = byDate[selectedDate] || [];
    const dateObj = new Date(selectedDate + 'T00:00:00');
    const dayIdx = (dateObj.getDay() + 6) % 7; // Monday=0

    const panel = document.createElement('div');
    panel.className = 'cal-detail';

    const heading = document.createElement('div');
    heading.className = 'cal-detail-heading';
    heading.innerHTML = `
      <span class="cal-detail-date">
        <strong>${DAY_NAMES_LONG[dayIdx]}</strong>,
        ${MONTH_NAMES[dateObj.getMonth()]} ${dateObj.getDate()}
      </span>
      <span class="cal-detail-count">${items.length} assignment${items.length !== 1 ? 's' : ''}</span>
    `;
    panel.appendChild(heading);

    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'cal-detail-empty';
      empty.textContent = 'Nothing due — enjoy the day!';
      panel.appendChild(empty);
    } else {
      const list = document.createElement('ul');
      list.className = 'cal-detail-list';

      for (const a of items) {
        const course = courseMap[a.course_id] || {};
        const level  = getPriorityLevel(a.priority_score || 0);
        const score  = Math.round((a.priority_score || 0) * 100);
        const li = document.createElement('li');
        li.className = `cal-detail-item cal-detail-item--${level}${a.completed_local ? ' cal-detail-item--completed' : ''}`;
        li.innerHTML = `
          <span class="priority-pill ${level}">${level.toUpperCase()}</span>
          <span class="cal-detail-score">${score}</span>
          <span class="cal-detail-name">${escapeHtml(a.name)}</span>
          <span class="cal-detail-course">${escapeHtml(course.course_code || course.name || '')}</span>
          <span class="cal-detail-pts">${a.points_possible > 0 ? a.points_possible + ' pts' : '—'}</span>
          ${a.html_url
            ? `<a href="${escapeHtml(a.html_url)}" target="_blank" rel="noopener" class="cal-detail-link">Open ↗</a>`
            : ''}
        `;
        list.appendChild(li);
      }
      panel.appendChild(list);
    }

    container.appendChild(panel);
  }
}

function _formatPeriodLabel(start, end) {
  const sMonth = MONTH_NAMES[start.getMonth()];
  const eMonth = MONTH_NAMES[end.getMonth()];
  const year   = end.getFullYear();
  if (sMonth === eMonth) {
    return `${sMonth} ${start.getDate()}–${end.getDate()}, ${year}`;
  }
  if (start.getFullYear() !== end.getFullYear()) {
    return `${sMonth} ${start.getDate()}, ${start.getFullYear()} – ${eMonth} ${end.getDate()}, ${year}`;
  }
  return `${sMonth} ${start.getDate()} – ${eMonth} ${end.getDate()}, ${year}`;
}

function _isCurrentPeriod(weekStart, todayStr) {
  const periodEnd = new Date(weekStart);
  periodEnd.setDate(periodEnd.getDate() + DAYS_SHOWN - 1);
  const today = new Date(todayStr);
  return today >= weekStart && today <= periodEnd;
}
