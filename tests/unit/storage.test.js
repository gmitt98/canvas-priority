// Unit tests for StorageManager (mock Chrome Storage API)

const DEFAULT_CONFIG = {
  canvas_token: null,
  canvas_domain: null,
  grade_thresholds: { A: 90, B: 80, C: 70, D: 60, F: 0 },
  auto_sync_enabled: true,
  sync_interval_hours: 8,
  last_sync_timestamp: null,
};

// Inline StorageManager for test context
class StorageManager {
  constructor(store) {
    this._store = store || global.chrome.storage.local;
  }

  async initialize() {
    const existing = await this._get(['config', 'ui_state']);
    const updates = {};
    if (!existing.config) updates.config = { ...DEFAULT_CONFIG };
    if (!existing.ui_state) updates.ui_state = { active_view: 'list', list_sort: 'priority', show_completed: false };
    if (Object.keys(updates).length > 0) await this._set(updates);
  }

  async getConfig() {
    const data = await this._get('config');
    return data.config || { ...DEFAULT_CONFIG };
  }

  async setConfig(updates) {
    const current = await this.getConfig();
    await this._set({ config: { ...current, ...updates } });
  }

  async setToken(token, domain) {
    await this.setConfig({ canvas_token: token, canvas_domain: domain });
  }

  async getAssignments() {
    const data = await this._get('assignments');
    return data.assignments || [];
  }

  async setAssignments(assignments) {
    await this._set({ assignments });
  }

  async markComplete(assignmentId, completed) {
    const assignments = await this.getAssignments();
    const idx = assignments.findIndex(a => a.id === assignmentId);
    if (idx === -1) return;
    assignments[idx] = { ...assignments[idx], completed_local: completed };
    await this.setAssignments(assignments);
  }

  async setManualPriority(assignmentId, value) {
    const assignments = await this.getAssignments();
    const idx = assignments.findIndex(a => a.id === assignmentId);
    if (idx === -1) return;
    assignments[idx] = { ...assignments[idx], manual_override: true, override_priority: value, priority_score: value };
    await this.setAssignments(assignments);
  }

  async syncAllData(courses, assignments) {
    const existing = await this.getAssignments();
    const localMap = {};
    for (const a of existing) {
      localMap[a.id] = { completed_local: a.completed_local || false, manual_override: a.manual_override || false, override_priority: a.override_priority || null };
    }
    const merged = assignments.map(a => ({
      ...a,
      ...(localMap[a.id] || {}),
      priority_score: localMap[a.id]?.manual_override ? localMap[a.id].override_priority : a.priority_score,
    }));
    await this._set({ courses, assignments: merged });
  }

  async getLastSyncTime() {
    const config = await this.getConfig();
    return config.last_sync_timestamp || null;
  }

  async setLastSyncTime(timestamp) {
    await this.setConfig({ last_sync_timestamp: timestamp });
  }

  _get(keys) {
    return new Promise((resolve, reject) => {
      this._store.get(keys, (data) => {
        if (global.chrome.runtime.lastError) reject(global.chrome.runtime.lastError);
        else resolve(data);
      });
    });
  }

  _set(data) {
    return new Promise((resolve, reject) => {
      this._store.set(data, () => {
        if (global.chrome.runtime.lastError) reject(global.chrome.runtime.lastError);
        else resolve();
      });
    });
  }
}

// ── Test setup ────────────────────────────────────────────────────────────────

function createMockStore(initialData = {}) {
  let data = { ...initialData };
  return {
    get: jest.fn((keys, cb) => {
      if (typeof keys === 'string') {
        cb({ [keys]: data[keys] });
      } else if (Array.isArray(keys)) {
        const result = {};
        keys.forEach(k => { result[k] = data[k]; });
        cb(result);
      } else {
        cb({ ...data });
      }
    }),
    set: jest.fn((updates, cb) => {
      Object.assign(data, updates);
      cb();
    }),
    clear: jest.fn((cb) => { data = {}; if (cb) cb(); }),
    _getData: () => data,
  };
}

beforeEach(() => {
  global.chrome = {
    storage: { local: createMockStore() },
    runtime: { lastError: null },
  };
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StorageManager', () => {
  test('initialize sets default config when not present', async () => {
    const store = createMockStore({});
    global.chrome.storage.local = store;
    const sm = new StorageManager(store);
    await sm.initialize();

    expect(store.set).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          grade_thresholds: { A: 90, B: 80, C: 70, D: 60, F: 0 },
        }),
      }),
      expect.any(Function)
    );
  });

  test('initialize does not overwrite existing config', async () => {
    const existingConfig = { ...DEFAULT_CONFIG, canvas_token: 'my-token' };
    const store = createMockStore({ config: existingConfig, ui_state: {} });
    global.chrome.storage.local = store;
    const sm = new StorageManager(store);
    await sm.initialize();

    // set should not be called (nothing to update)
    expect(store.set).not.toHaveBeenCalled();
  });

  test('setToken saves token and domain', async () => {
    const store = createMockStore({ config: { ...DEFAULT_CONFIG } });
    global.chrome.storage.local = store;
    const sm = new StorageManager(store);
    await sm.setToken('abc123', 'school.instructure.com');

    const config = store._getData().config;
    expect(config.canvas_token).toBe('abc123');
    expect(config.canvas_domain).toBe('school.instructure.com');
  });

  test('getAssignments returns empty array when none stored', async () => {
    const store = createMockStore({});
    global.chrome.storage.local = store;
    const sm = new StorageManager(store);
    const result = await sm.getAssignments();
    expect(result).toEqual([]);
  });

  test('setAssignments stores and retrieves correctly', async () => {
    const store = createMockStore({});
    global.chrome.storage.local = store;
    const sm = new StorageManager(store);
    const assignments = [{ id: 1, name: 'Homework' }, { id: 2, name: 'Quiz' }];
    await sm.setAssignments(assignments);
    const result = await sm.getAssignments();
    expect(result).toEqual(assignments);
  });

  test('markComplete updates completed_local flag', async () => {
    const store = createMockStore({
      assignments: [{ id: 1, name: 'Homework', completed_local: false }],
    });
    global.chrome.storage.local = store;
    const sm = new StorageManager(store);

    await sm.markComplete(1, true);

    const stored = store._getData().assignments;
    expect(stored[0].completed_local).toBe(true);
  });

  test('setManualPriority sets override fields', async () => {
    const store = createMockStore({
      assignments: [{ id: 1, name: 'Quiz', priority_score: 0.3, manual_override: false }],
    });
    global.chrome.storage.local = store;
    const sm = new StorageManager(store);

    await sm.setManualPriority(1, 0.9);

    const stored = store._getData().assignments;
    expect(stored[0].manual_override).toBe(true);
    expect(stored[0].override_priority).toBe(0.9);
    expect(stored[0].priority_score).toBe(0.9);
  });

  test('syncAllData preserves local completion state', async () => {
    const store = createMockStore({
      assignments: [{ id: 1, name: 'Old name', completed_local: true, manual_override: false }],
    });
    global.chrome.storage.local = store;
    const sm = new StorageManager(store);

    const freshAssignments = [{ id: 1, name: 'Updated name', priority_score: 0.5 }];
    await sm.syncAllData([], freshAssignments);

    const stored = store._getData().assignments;
    expect(stored[0].name).toBe('Updated name'); // fresh data
    expect(stored[0].completed_local).toBe(true); // preserved local state
  });

  test('syncAllData preserves manual override priority', async () => {
    const store = createMockStore({
      assignments: [{ id: 1, manual_override: true, override_priority: 0.95, priority_score: 0.95 }],
    });
    global.chrome.storage.local = store;
    const sm = new StorageManager(store);

    const freshAssignments = [{ id: 1, name: 'Assignment', priority_score: 0.2 }];
    await sm.syncAllData([], freshAssignments);

    const stored = store._getData().assignments;
    expect(stored[0].priority_score).toBe(0.95); // Override preserved
  });

  test('setLastSyncTime and getLastSyncTime round-trip', async () => {
    const store = createMockStore({ config: { ...DEFAULT_CONFIG } });
    global.chrome.storage.local = store;
    const sm = new StorageManager(store);

    const ts = '2026-03-21T12:00:00.000Z';
    await sm.setLastSyncTime(ts);
    const result = await sm.getLastSyncTime();
    expect(result).toBe(ts);
  });
});
