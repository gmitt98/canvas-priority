// Assignment card component — renders a single assignment

import { formatDueDate, getPriorityLevel, formatPriorityScore, escapeHtml, truncate } from '../lib/utils.js';

/**
 * Render an assignment card element.
 * @param {Object} assignment
 * @param {Object} courseMap - courseId → course
 * @param {Object} handlers - { onComplete, onOverride, onCardClick }
 * @returns {HTMLElement}
 */
export function createAssignmentCard(assignment, courseMap, handlers = {}) {
  const { onComplete, onOverride, onCardClick } = handlers;
  const course = courseMap[assignment.course_id] || {};
  const priorityLevel = getPriorityLevel(assignment.priority_score || 0);
  const scoreDisplay = formatPriorityScore(assignment.priority_score || 0);
  const barWidth = Math.min(100, Math.round((assignment.priority_score || 0) * 100));
  const dueDateDisplay = formatDueDate(assignment.due_at);
  const isOverdue = assignment.due_at && new Date(assignment.due_at) < new Date();
  const wouldDropGrade = assignment.priority_components?.wouldDropGrade;

  const card = document.createElement('div');
  card.className = `assignment-card${assignment.completed_local ? ' completed' : ''}`;
  card.dataset.priority = priorityLevel;
  card.dataset.assignmentId = assignment.id;

  card.innerHTML = `
    <div class="assignment-header">
      <h3 class="assignment-name" title="${escapeHtml(assignment.name)}">
        ${escapeHtml(truncate(assignment.name, 70))}
      </h3>
      <span class="course-badge" title="${escapeHtml(course.name || '')}">
        ${escapeHtml(truncate(course.course_code || course.name || 'Unknown', 20))}
      </span>
    </div>

    <div class="assignment-meta">
      <span class="due-date${isOverdue ? ' overdue' : ''}" aria-label="Due date: ${escapeHtml(dueDateDisplay)}">
        ${isOverdue ? '⚠ ' : ''}${escapeHtml(dueDateDisplay)}
      </span>
      <span class="points">${assignment.points_possible} pts</span>
      ${assignment.manual_override ? '<span class="override-badge" title="Priority manually overridden">✎ Override</span>' : ''}
    </div>

    <div class="priority-indicator" aria-label="Priority score: ${scoreDisplay}">
      <div class="priority-bar-track">
        <div class="priority-bar" style="width: ${barWidth}%" data-level="${priorityLevel}"></div>
      </div>
      <span class="priority-score">${scoreDisplay}</span>
      ${wouldDropGrade ? '<span class="grade-risk-icon" title="Missing this assignment would drop your grade">⚠️</span>' : ''}
    </div>

    <div class="assignment-actions">
      <label class="complete-label" aria-label="Mark as complete">
        <input type="checkbox" class="complete-checkbox" ${assignment.completed_local ? 'checked' : ''} />
        <span>Done</span>
      </label>
      <button class="override-btn btn btn-ghost" aria-label="Override priority for this assignment">
        ${assignment.manual_override ? 'Edit override' : 'Override'}
      </button>
      ${assignment.html_url
        ? `<a class="open-canvas-link btn btn-ghost" href="${escapeHtml(assignment.html_url)}" target="_blank" rel="noopener noreferrer" aria-label="Open in Canvas">Open ↗</a>`
        : ''}
    </div>
  `;

  // ── Event listeners ──────────────────────────────────────────────────────────
  const checkbox = card.querySelector('.complete-checkbox');
  checkbox.addEventListener('change', (e) => {
    e.stopPropagation();
    card.classList.toggle('completed', e.target.checked);
    if (onComplete) onComplete(assignment.id, e.target.checked);
  });

  const overrideBtn = card.querySelector('.override-btn');
  overrideBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onOverride) onOverride(assignment.id);
  });

  // Click card body (not actions) → open in Canvas
  const header = card.querySelector('.assignment-header');
  header.addEventListener('click', () => {
    if (onCardClick) {
      onCardClick(assignment);
    } else if (assignment.html_url) {
      window.open(assignment.html_url, '_blank', 'noopener');
    }
  });
  header.style.cursor = assignment.html_url ? 'pointer' : 'default';

  return card;
}
