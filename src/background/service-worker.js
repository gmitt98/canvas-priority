// Background service worker — handles lifecycle events, alarms, and background sync

import { StorageManager } from '../lib/storage.js';
import { CanvasAPI, CanvasAPIError } from '../lib/canvas-api.js';
import { PriorityCalculator } from '../lib/priority-calculator.js';
import { setupSyncAlarm, SYNC_ALARM_NAME } from './alarms.js';

const storage = new StorageManager();
const calculator = new PriorityCalculator();

// ── Extension lifecycle ───────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Canvas Priority] Extension installed/updated:', details.reason);

  // Initialize storage with defaults
  await storage.initialize();

  if (details.reason === 'install') {
    // First install — open onboarding in a new tab
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/onboarding.html') });
  }

  // Set up the periodic sync alarm
  await setupSyncAlarm();
});

// ── Alarm handler ─────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) {
    console.log('[Canvas Priority] Scheduled sync triggered');
    await performBackgroundSync();
  }
});

// ── Message handler (from UI pages) ──────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'TRIGGER_SYNC') {
    performBackgroundSync()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }
});

// ── Background sync ───────────────────────────────────────────────────────────

async function performBackgroundSync() {
  const config = await storage.getConfig();
  if (!config.canvas_token || !config.canvas_domain) {
    console.log('[Canvas Priority] Sync skipped — not configured');
    return;
  }

  const api = new CanvasAPI(config.canvas_domain, config.canvas_token);

  try {
    const data = await api.syncAllData();

    const coursesMap = Object.fromEntries(data.courses.map(c => [c.id, c]));
    const withPriorities = calculator.calculateBatchPriorities(data.assignments, coursesMap);

    // Get previous assignment count to detect new items
    const previousAssignments = await storage.getAssignments();
    const previousIds = new Set(previousAssignments.map(a => a.id));

    await storage.syncAllData(data.courses, withPriorities);
    await storage.setLastSyncTime(new Date().toISOString());

    // Update badge with count of new assignments found
    const newCount = withPriorities.filter(a => !previousIds.has(a.id)).length;
    if (newCount > 0) {
      chrome.action.setBadgeText({ text: newCount.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
      // Clear badge after 30 minutes
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 30 * 60 * 1000);
    }

    console.log(`[Canvas Priority] Background sync complete — ${data.assignments.length} assignments, ${newCount} new`);

  } catch (error) {
    if (error instanceof CanvasAPIError && error.code === 'INVALID_TOKEN') {
      // Token invalid — clear badge and let user know via badge color
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#d97706' });
    }
    console.error('[Canvas Priority] Background sync failed:', error.message);
  }
}
