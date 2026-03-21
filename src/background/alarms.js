// Alarm management for periodic Canvas syncs

import { SYNC_CONFIG } from '../lib/constants.js';

export const SYNC_ALARM_NAME = 'sync-canvas';

/**
 * Create (or recreate) the periodic sync alarm.
 */
export async function setupSyncAlarm() {
  // Clear any existing alarm first
  await chrome.alarms.clear(SYNC_ALARM_NAME);

  chrome.alarms.create(SYNC_ALARM_NAME, {
    delayInMinutes: SYNC_CONFIG.INTERVAL_MINUTES,
    periodInMinutes: SYNC_CONFIG.INTERVAL_MINUTES,
  });

  console.log(`[Canvas Priority] Sync alarm set for every ${SYNC_CONFIG.INTERVAL_HOURS} hours`);
}

/**
 * Cancel the sync alarm (e.g., when auto-sync is disabled).
 */
export async function cancelSyncAlarm() {
  await chrome.alarms.clear(SYNC_ALARM_NAME);
}
