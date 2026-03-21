// Sync indicator component — displays last sync time and sync status

import { formatRelativeTime } from '../lib/utils.js';

/**
 * Render or update a sync indicator element.
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {string|null} options.lastSyncTime - ISO timestamp
 * @param {boolean} options.isSyncing
 * @param {string|null} options.errorMessage
 * @param {Function} options.onRefresh
 */
export function renderSyncIndicator(container, options = {}) {
  const { lastSyncTime, isSyncing = false, errorMessage = null, onRefresh } = options;

  const relativeTime = formatRelativeTime(lastSyncTime);
  const statusText = isSyncing
    ? 'Syncing…'
    : errorMessage
      ? `Sync failed: ${errorMessage}`
      : lastSyncTime
        ? `Last synced: ${relativeTime}`
        : 'Never synced';

  const statusClass = isSyncing ? 'syncing' : errorMessage ? 'error' : 'ok';

  container.innerHTML = `
    <div class="sync-indicator sync-${statusClass}" role="status" aria-live="polite">
      ${isSyncing ? '<span class="spinner"></span>' : ''}
      <span class="sync-status-text">${statusText}</span>
      <button class="btn btn-ghost refresh-btn" ${isSyncing ? 'disabled' : ''} aria-label="Refresh data from Canvas" title="Refresh">
        ↻
      </button>
    </div>
  `;

  const refreshBtn = container.querySelector('.refresh-btn');
  if (refreshBtn && onRefresh) {
    refreshBtn.addEventListener('click', onRefresh);
  }
}
