// Chrome Storage API wrapper with clean interface

import { STORAGE_KEYS, DEFAULT_CONFIG, DEFAULT_UI_STATE } from './constants.js';

export class StorageManager {
  constructor() {
    this._store = chrome.storage.local;
  }

  // ─── Initialization ─────────────────────────────────────────────────────────

  /**
   * Initialize storage with default values (only if not already set).
   */
  async initialize() {
    const existing = await this._get([STORAGE_KEYS.CONFIG, STORAGE_KEYS.UI_STATE]);
    const updates = {};

    if (!existing[STORAGE_KEYS.CONFIG]) {
      updates[STORAGE_KEYS.CONFIG] = { ...DEFAULT_CONFIG };
    }
    if (!existing[STORAGE_KEYS.UI_STATE]) {
      updates[STORAGE_KEYS.UI_STATE] = { ...DEFAULT_UI_STATE };
    }
    if (Object.keys(updates).length > 0) {
      await this._set(updates);
    }
  }

  // ─── Config ─────────────────────────────────────────────────────────────────

  async getConfig() {
    const data = await this._get(STORAGE_KEYS.CONFIG);
    return data[STORAGE_KEYS.CONFIG] || { ...DEFAULT_CONFIG };
  }

  async setConfig(configUpdates) {
    const current = await this.getConfig();
    await this._set({ [STORAGE_KEYS.CONFIG]: { ...current, ...configUpdates } });
  }

  async setToken(token, domain) {
    await this.setConfig({ canvas_token: token, canvas_domain: domain });
  }

  async clearToken() {
    await this.setConfig({ canvas_token: null, canvas_domain: null });
  }

  async getLastSyncTime() {
    const config = await this.getConfig();
    return config.last_sync_timestamp || null;
  }

  async setLastSyncTime(timestamp) {
    await this.setConfig({ last_sync_timestamp: timestamp });
  }

  // ─── Courses ────────────────────────────────────────────────────────────────

  async getCourses() {
    const data = await this._get(STORAGE_KEYS.COURSES);
    return data[STORAGE_KEYS.COURSES] || [];
  }

  async setCourses(courses) {
    await this._set({ [STORAGE_KEYS.COURSES]: courses });
  }

  async getCourse(courseId) {
    const courses = await this.getCourses();
    return courses.find(c => c.id === courseId) || null;
  }

  // ─── Assignments ────────────────────────────────────────────────────────────

  async getAssignments() {
    const data = await this._get(STORAGE_KEYS.ASSIGNMENTS);
    return data[STORAGE_KEYS.ASSIGNMENTS] || [];
  }

  async setAssignments(assignments) {
    await this._set({ [STORAGE_KEYS.ASSIGNMENTS]: assignments });
  }

  async updateAssignment(assignmentId, updates) {
    const assignments = await this.getAssignments();
    const idx = assignments.findIndex(a => a.id === assignmentId);
    if (idx === -1) return;
    assignments[idx] = { ...assignments[idx], ...updates };
    await this.setAssignments(assignments);
  }

  async markComplete(assignmentId, completed) {
    await this.updateAssignment(assignmentId, { completed_local: completed });
  }

  async setManualPriority(assignmentId, priorityValue) {
    await this.updateAssignment(assignmentId, {
      manual_override: true,
      override_priority: priorityValue,
      priority_score: priorityValue,
    });
  }

  async clearManualPriority(assignmentId) {
    await this.updateAssignment(assignmentId, {
      manual_override: false,
      override_priority: null,
    });
  }

  // ─── Batch sync ─────────────────────────────────────────────────────────────

  /**
   * Merge fresh Canvas data into storage while preserving local state
   * (completed_local, manual_override, override_priority).
   * @param {Array} courses
   * @param {Array} assignments - Already has priority_score calculated
   */
  async syncAllData(courses, assignments) {
    const existingAssignments = await this.getAssignments();
    const localStateMap = {};
    for (const a of existingAssignments) {
      localStateMap[a.id] = {
        completed_local: a.completed_local || false,
        manual_override: a.manual_override || false,
        override_priority: a.override_priority || null,
      };
    }

    const mergedAssignments = assignments.map(a => ({
      ...a,
      ...(localStateMap[a.id] || {}),
      // Re-apply manual override to priority_score if set
      priority_score: localStateMap[a.id]?.manual_override
        ? localStateMap[a.id].override_priority
        : a.priority_score,
    }));

    await this._set({
      [STORAGE_KEYS.COURSES]: courses,
      [STORAGE_KEYS.ASSIGNMENTS]: mergedAssignments,
    });
  }

  // ─── UI State ────────────────────────────────────────────────────────────────

  async getUIState() {
    const data = await this._get(STORAGE_KEYS.UI_STATE);
    return data[STORAGE_KEYS.UI_STATE] || { ...DEFAULT_UI_STATE };
  }

  async updateUIState(stateUpdates) {
    const current = await this.getUIState();
    await this._set({ [STORAGE_KEYS.UI_STATE]: { ...current, ...stateUpdates } });
  }

  // ─── Utility ─────────────────────────────────────────────────────────────────

  async clear() {
    await this._store.clear();
  }

  async exportData() {
    return new Promise((resolve, reject) => {
      this._store.get(null, (data) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(data);
      });
    });
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  _get(keys) {
    return new Promise((resolve, reject) => {
      this._store.get(keys, (data) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(data);
      });
    });
  }

  _set(data) {
    return new Promise((resolve, reject) => {
      this._store.set(data, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
  }
}

export const storage = new StorageManager();
