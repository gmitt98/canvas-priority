// Main dashboard page logic

import { StorageManager } from '../lib/storage.js';
import { CanvasAPI, CanvasAPIError } from '../lib/canvas-api.js';
import { PriorityCalculator } from '../lib/priority-calculator.js';
import { getWeekStart } from '../lib/utils.js';
import { renderAssignmentList } from '../components/assignment-list.js';
import { renderCalendarView } from '../components/calendar-view.js';
import { renderSyncIndicator } from '../components/sync-indicator.js';

const storage = new StorageManager();
const calculator = new PriorityCalculator();

// ── Page state ───────────────────────────────────────────────────────────────
let state = {
  assignments: [],
  courses: [],
  courseMap: {},
  uiState: {
    active_view: 'list',
    list_sort: 'priority',
    show_completed: false,
  },
  sortDir: 'desc',
  filterText: '',
  hideOverdue: false,
  calendarWeekStart: getWeekStart(new Date()),
  selectedDate: null,
  isSyncing: false,
  syncError: null,
  overrideAssignmentId: null,
};

// ── DOM refs ─────────────────────────────────────────────────────────────────
const listViewSection = document.getElementById('list-view');
const calendarViewSection = document.getElementById('calendar-view');
const assignmentListContainer = document.getElementById('assignment-list-container');
const calendarContainer = document.getElementById('calendar-container');
const syncIndicatorContainer = document.getElementById('sync-indicator-container');
const alertContainer = document.getElementById('alert-container');
const listViewBtn = document.getElementById('list-view-btn');
const calendarViewBtn = document.getElementById('calendar-view-btn');
const overrideModal = document.getElementById('override-modal');
const overrideValue = document.getElementById('override-value');
const overrideSaveBtn = document.getElementById('override-save-btn');
const overrideCancelBtn = document.getElementById('override-cancel-btn');
const overrideClearBtn = document.getElementById('override-clear-btn');

const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsUpdateBtn = document.getElementById('settings-update-btn');
const settingsDisconnectBtn = document.getElementById('settings-disconnect-btn');
const settingsDomain = document.getElementById('settings-domain');
const settingsToken = document.getElementById('settings-token');

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  await storage.initialize();

  const config = await storage.getConfig();
  if (!config.canvas_token) {
    window.location.href = chrome.runtime.getURL('src/pages/onboarding.html');
    return;
  }

  state.uiState = await storage.getUIState();
  state.assignments = await storage.getAssignments();
  state.courses = await storage.getCourses();
  state.courseMap = Object.fromEntries(state.courses.map(c => [c.id, c]));

  applyActiveView(state.uiState.active_view);
  renderAll();
}

// ── View switching ────────────────────────────────────────────────────────────
listViewBtn.addEventListener('click', () => setActiveView('list'));
calendarViewBtn.addEventListener('click', () => setActiveView('calendar'));

function setActiveView(view) {
  state.uiState.active_view = view;
  storage.updateUIState({ active_view: view });
  applyActiveView(view);
  renderAll();
}

function applyActiveView(view) {
  const isCalendar = view === 'calendar';
  listViewSection.classList.toggle('active', !isCalendar);
  listViewSection.hidden = isCalendar;
  calendarViewSection.classList.toggle('active', isCalendar);
  calendarViewSection.hidden = !isCalendar;

  listViewBtn.classList.toggle('active', !isCalendar);
  listViewBtn.setAttribute('aria-pressed', (!isCalendar).toString());
  calendarViewBtn.classList.toggle('active', isCalendar);
  calendarViewBtn.setAttribute('aria-pressed', isCalendar.toString());
}

// ── Sync ─────────────────────────────────────────────────────────────────────
async function performSync() {
  if (state.isSyncing) return;
  state.isSyncing = true;
  state.syncError = null;
  clearAlert();
  renderSyncBar();

  try {
    const config = await storage.getConfig();
    if (!config.canvas_token) {
      window.location.href = chrome.runtime.getURL('src/pages/onboarding.html');
      return;
    }

    const api = new CanvasAPI(config.canvas_domain, config.canvas_token);
    const data = await api.syncAllData();

    const coursesMap = Object.fromEntries(data.courses.map(c => [c.id, c]));
    const withPriorities = calculator.calculateBatchPriorities(data.assignments, coursesMap);

    await storage.syncAllData(data.courses, withPriorities);
    await storage.setLastSyncTime(new Date().toISOString());

    state.assignments = await storage.getAssignments();
    state.courses = data.courses;
    state.courseMap = coursesMap;

    showAlert(`Synced: ${data.assignments.length} assignments from ${data.courses.length} courses`, 'success');

  } catch (error) {
    state.syncError = error instanceof CanvasAPIError ? error.message : 'Sync failed. Please try again.';
    showAlert(state.syncError, 'error');
    console.error('[Canvas Priority] Sync error:', error);

    if (error instanceof CanvasAPIError && error.code === 'INVALID_TOKEN') {
      setTimeout(() => {
        window.location.href = chrome.runtime.getURL('src/pages/onboarding.html');
      }, 2000);
    }
  } finally {
    state.isSyncing = false;
    renderAll();
  }
}

// ── Event handlers ────────────────────────────────────────────────────────────
async function handleComplete(assignmentId, checked) {
  await storage.markComplete(assignmentId, checked);
  const idx = state.assignments.findIndex(a => a.id === assignmentId);
  if (idx !== -1) {
    state.assignments[idx] = { ...state.assignments[idx], completed_local: checked };
  }
}

async function handleOverride(assignmentId) {
  state.overrideAssignmentId = assignmentId;
  const assignment = state.assignments.find(a => a.id === assignmentId);
  overrideValue.value = assignment?.override_priority ?? assignment?.priority_score ?? '';
  overrideModal.hidden = false;
  overrideValue.focus();
}

overrideSaveBtn.addEventListener('click', async () => {
  const val = parseFloat(overrideValue.value);
  if (isNaN(val) || val < 0 || val > 1) {
    showAlert('Please enter a number between 0.00 and 1.00', 'error');
    return;
  }
  await storage.setManualPriority(state.overrideAssignmentId, val);
  state.assignments = await storage.getAssignments();
  closeOverrideModal();
  renderAll();
});

overrideClearBtn.addEventListener('click', async () => {
  await storage.clearManualPriority(state.overrideAssignmentId);
  state.assignments = await storage.getAssignments();
  closeOverrideModal();
  renderAll();
});

overrideCancelBtn.addEventListener('click', closeOverrideModal);

overrideModal.addEventListener('click', (e) => {
  if (e.target === overrideModal) closeOverrideModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!overrideModal.hidden) closeOverrideModal();
    if (!settingsModal.hidden) closeSettingsModal();
  }
});

function closeOverrideModal() {
  overrideModal.hidden = true;
  state.overrideAssignmentId = null;
}

// ── Settings modal ────────────────────────────────────────────────────────────
settingsBtn.addEventListener('click', openSettingsModal);
settingsCloseBtn.addEventListener('click', closeSettingsModal);
settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) closeSettingsModal(); });

settingsUpdateBtn.addEventListener('click', () => {
  window.location.href = chrome.runtime.getURL('src/pages/onboarding.html');
});

settingsDisconnectBtn.addEventListener('click', async () => {
  if (!confirm('This will delete your Canvas token and all synced assignment data from this browser. Continue?')) return;
  await storage.clear();
  window.location.href = chrome.runtime.getURL('src/pages/onboarding.html');
});

async function openSettingsModal() {
  const config = await storage.getConfig();
  settingsDomain.textContent = config.canvas_domain || '—';
  const token = config.canvas_token || '';
  settingsToken.textContent = token
    ? '••••••••' + token.slice(-4)
    : '—';
  settingsModal.hidden = false;
}

function closeSettingsModal() {
  settingsModal.hidden = true;
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderAll() {
  renderSyncBar();

  if (state.uiState.active_view === 'list') {
    renderAssignmentList(assignmentListContainer, {
      assignments: state.assignments,
      courseMap: state.courseMap,
      sortBy: state.uiState.list_sort,
      sortDir: state.sortDir,
      showCompleted: state.uiState.show_completed,
      hideOverdue: state.hideOverdue,
      filterText: state.filterText,
      handlers: {
        onComplete: handleComplete,
        onOverride: handleOverride,
        onSortChange: (sort, dir) => {
          state.uiState.list_sort = sort;
          state.sortDir = dir;
          storage.updateUIState({ list_sort: sort });
          renderAll();
        },
        onShowCompletedChange: (show) => {
          state.uiState.show_completed = show;
          storage.updateUIState({ show_completed: show });
          renderAll();
        },
        onHideOverdueChange: (hide) => {
          state.hideOverdue = hide;
          renderAll();
        },
        onSearchChange: (text) => {
          state.filterText = text;
          renderAll();
        },
      },
    });
  } else {
    renderCalendarView(calendarContainer, {
      assignments: state.assignments,
      courseMap: state.courseMap,
      weekStart: state.calendarWeekStart,
      selectedDate: state.selectedDate,
      showCompleted: state.uiState.show_completed,
      hideOverdue: state.hideOverdue,
      handlers: {
        onDateSelect: (dateStr) => {
          state.selectedDate = state.selectedDate === dateStr ? null : dateStr;
          renderAll();
        },
        onWeekChange: (newWeekStart) => {
          state.calendarWeekStart = newWeekStart;
          state.selectedDate = null;
          renderAll();
        },
        onShowCompletedChange: (show) => {
          state.uiState.show_completed = show;
          storage.updateUIState({ show_completed: show });
          renderAll();
        },
        onHideOverdueChange: (hide) => {
          state.hideOverdue = hide;
          renderAll();
        },
        onAssignmentClick: (assignment) => {
          if (assignment.html_url) window.open(assignment.html_url, '_blank', 'noopener');
        },
      },
    });
  }
}

async function renderSyncBar() {
  const lastSync = await storage.getLastSyncTime();
  renderSyncIndicator(syncIndicatorContainer, {
    lastSyncTime: lastSync,
    isSyncing: state.isSyncing,
    errorMessage: state.syncError,
    onRefresh: performSync,
  });
}

function showAlert(message, type = 'error') {
  alertContainer.innerHTML = `<div class="alert alert-${type}" role="alert">${message}</div>`;
  if (type === 'success') setTimeout(clearAlert, 4000);
}

function clearAlert() {
  alertContainer.innerHTML = '';
}

// ── Start ─────────────────────────────────────────────────────────────────────
init();
