// Popup logic — shows top 5 priority assignments

import { StorageManager } from '../lib/storage.js';
import { CanvasAPI, CanvasAPIError } from '../lib/canvas-api.js';
import { PriorityCalculator } from '../lib/priority-calculator.js';
import { formatDueDate, formatRelativeTime, getPriorityLevel, formatPriorityScore, escapeHtml, truncate } from '../lib/utils.js';

const storage = new StorageManager();
const calculator = new PriorityCalculator();

const popupStatus = document.getElementById('popup-status');
const alertContainer = document.getElementById('alert-container');
const popupLoading = document.getElementById('popup-loading');
const topAssignmentsList = document.getElementById('top-assignments');
const popupEmpty = document.getElementById('popup-empty');
const notConfigured = document.getElementById('not-configured');
const refreshBtn = document.getElementById('refresh-btn');
const viewAllBtn = document.getElementById('view-all-btn');
const setupBtn = document.getElementById('setup-btn');

async function init() {
  try {
    await storage.initialize();

    const config = await storage.getConfig();
    if (!config.canvas_token) {
      notConfigured.hidden = false;
      return;
    }

    const lastSync = await storage.getLastSyncTime();
    popupStatus.textContent = lastSync
      ? `Last synced: ${formatRelativeTime(lastSync)}`
      : 'Not yet synced';

    const assignments = await storage.getAssignments();
    const courses = await storage.getCourses();
    const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));

    renderTopAssignments(assignments, courseMap);
  } catch (err) {
    console.error('[Canvas Priority] Popup init error:', err);
    alertContainer.innerHTML = `<div class="alert alert-error" role="alert">Failed to load assignments.</div>`;
  } finally {
    popupLoading.hidden = true;
  }
}

function renderTopAssignments(assignments, courseMap) {
  popupLoading.hidden = true;

  // Filter out completed, sort by priority, take top 5
  const top = assignments
    .filter(a => !a.completed_local)
    .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
    .slice(0, 5);

  if (top.length === 0) {
    popupEmpty.hidden = false;
    return;
  }

  topAssignmentsList.hidden = false;
  topAssignmentsList.innerHTML = '';

  top.forEach((a, i) => {
    const course = courseMap[a.course_id] || {};
    const level = getPriorityLevel(a.priority_score || 0);
    const dueDisplay = formatDueDate(a.due_at);
    const isOverdue = a.due_at && new Date(a.due_at) < new Date();

    const li = document.createElement('li');
    li.className = 'top-assignment-item';
    li.dataset.priority = level;
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    li.setAttribute('aria-label', `${a.name}, ${dueDisplay}`);
    li.innerHTML = `
      <span class="ta-rank">${i + 1}</span>
      <div class="ta-body">
        <div class="ta-name" title="${escapeHtml(a.name)}">${escapeHtml(truncate(a.name, 50))}</div>
        <div class="ta-meta">
          <span class="ta-course">${escapeHtml(course.course_code || course.name || 'Unknown')}</span>
          <span class="ta-due${isOverdue ? ' overdue' : ''}">${escapeHtml(dueDisplay)}</span>
          ${a.priority_components?.wouldDropGrade ? '<span title="Would drop grade">⚠️</span>' : ''}
        </div>
      </div>
      <span class="ta-score">${formatPriorityScore(a.priority_score || 0)}</span>
    `;

    li.addEventListener('click', () => {
      if (a.html_url) chrome.tabs.create({ url: a.html_url });
    });
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') li.click();
    });

    topAssignmentsList.appendChild(li);
  });
}

// ── Refresh ──────────────────────────────────────────────────────────────────
refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  refreshBtn.textContent = '…';
  alertContainer.innerHTML = '';

  try {
    const config = await storage.getConfig();
    if (!config.canvas_token) return;

    const api = new CanvasAPI(config.canvas_domain, config.canvas_token);
    const data = await api.syncAllData();
    const coursesMap = Object.fromEntries(data.courses.map(c => [c.id, c]));
    const withPriorities = calculator.calculateBatchPriorities(data.assignments, coursesMap);

    await storage.syncAllData(data.courses, withPriorities);
    await storage.setLastSyncTime(new Date().toISOString());

    const freshAssignments = await storage.getAssignments();
    popupStatus.textContent = `Last synced: just now`;
    topAssignmentsList.hidden = true;
    popupEmpty.hidden = true;
    renderTopAssignments(freshAssignments, coursesMap);

  } catch (error) {
    const msg = error instanceof CanvasAPIError ? error.message : 'Sync failed.';
    alertContainer.innerHTML = `<div class="alert alert-error" role="alert">${msg}</div>`;
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = '↻';
  }
});

// ── Navigation ────────────────────────────────────────────────────────────────
viewAllBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/main.html') });
});

setupBtn?.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/onboarding.html') });
});

document.getElementById('settings-link-btn')?.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/main.html') });
});

init();
