// Integration test: full sync flow (mock API → calculator → storage)

const DEFAULT_CONFIG = { canvas_token: null, canvas_domain: null, grade_thresholds: { A: 90, B: 80, C: 70, D: 60, F: 0 }, auto_sync_enabled: true, sync_interval_hours: 8, last_sync_timestamp: null };

// ── Inline PriorityCalculator ─────────────────────────────────────────────────
class PriorityCalculator {
  constructor() {
    this.TIME_DECAY_DAYS = 30;
    this.GRADE_RISK_BONUS = 0.5;
    this.thresholds = { A: 90, B: 80, C: 70, D: 60, F: 0 };
  }
  calculatePriority(a, course) {
    if (a.manual_override) return a.override_priority;
    const base = course.total_points > 0 ? a.points_possible / course.total_points : 0;
    const days = a.due_at ? (new Date(a.due_at) - new Date()) / 86400000 : Infinity;
    const decay = isFinite(days) ? Math.max(0, (30 - days) / 30) : 0;
    const gradeImpact = course.total_points > 0 ? (a.points_possible / course.total_points) * 100 : 0;
    const after = (course.current_grade || 0) - gradeImpact;
    const risk = course.current_grade && this._level(course.current_grade) !== this._level(after) ? 0.5 : 0;
    return { score: (base * decay) + risk, components: { wouldDropGrade: risk > 0 } };
  }
  _level(g) {
    if (g >= 90) return 'A'; if (g >= 80) return 'B'; if (g >= 70) return 'C'; if (g >= 60) return 'D'; return 'F';
  }
  calculateBatchPriorities(assignments, coursesMap) {
    return assignments.map(a => {
      const course = coursesMap[a.course_id];
      if (!course) return { ...a, priority_score: 0, priority_components: null };
      const r = this.calculatePriority(a, course);
      if (typeof r === 'number') return { ...a, priority_score: r, priority_components: null };
      return { ...a, priority_score: r.score, priority_components: r.components };
    });
  }
}

// ── Inline StorageManager ─────────────────────────────────────────────────────
class StorageManager {
  constructor(store) { this._store = store; }
  async initialize() {
    const existing = await this._get(['config', 'ui_state']);
    const updates = {};
    if (!existing.config) updates.config = { ...DEFAULT_CONFIG };
    if (!existing.ui_state) updates.ui_state = {};
    if (Object.keys(updates).length > 0) await this._set(updates);
  }
  async getConfig() { const d = await this._get('config'); return d.config || { ...DEFAULT_CONFIG }; }
  async setConfig(u) { const c = await this.getConfig(); await this._set({ config: { ...c, ...u } }); }
  async setLastSyncTime(ts) { await this.setConfig({ last_sync_timestamp: ts }); }
  async getAssignments() { const d = await this._get('assignments'); return d.assignments || []; }
  async syncAllData(courses, assignments) {
    const existing = await this.getAssignments();
    const map = {};
    existing.forEach(a => { map[a.id] = { completed_local: a.completed_local || false, manual_override: a.manual_override || false, override_priority: a.override_priority || null }; });
    const merged = assignments.map(a => ({ ...a, ...(map[a.id] || {}), priority_score: map[a.id]?.manual_override ? map[a.id].override_priority : a.priority_score }));
    await this._set({ courses, assignments: merged });
  }
  _get(keys) { return new Promise((res, rej) => this._store.get(keys, d => global.chrome.runtime.lastError ? rej(global.chrome.runtime.lastError) : res(d))); }
  _set(data) { return new Promise((res, rej) => this._store.set(data, () => global.chrome.runtime.lastError ? rej(global.chrome.runtime.lastError) : res())); }
}

// ── Mock store factory ────────────────────────────────────────────────────────
function createMockStore(initial = {}) {
  let data = { ...initial };
  return {
    get: jest.fn((keys, cb) => {
      if (typeof keys === 'string') cb({ [keys]: data[keys] });
      else if (Array.isArray(keys)) { const r = {}; keys.forEach(k => { r[k] = data[k]; }); cb(r); }
      else cb({ ...data });
    }),
    set: jest.fn((u, cb) => { Object.assign(data, u); cb(); }),
    _getData: () => data,
  };
}

beforeEach(() => {
  global.chrome = { storage: { local: createMockStore() }, runtime: { lastError: null } };
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Full Sync Integration', () => {
  const mockCourses = [
    { id: 101, name: 'AP Calculus', course_code: 'MATH401', workflow_state: 'available', current_grade: 87.5, total_points: 500 },
  ];

  const mockAssignments = [
    { id: 5001, course_id: 101, name: 'Homework', due_at: new Date(Date.now() + 86400000 * 2).toISOString(), points_possible: 50, priority_score: 0, priority_components: null },
    { id: 5002, course_id: 101, name: 'Quiz', due_at: new Date(Date.now() + 86400000 * 5).toISOString(), points_possible: 20, priority_score: 0, priority_components: null },
  ];

  test('calculates priorities and stores data', async () => {
    const store = createMockStore({});
    global.chrome.storage.local = store;
    const sm = new StorageManager(store);
    const calculator = new PriorityCalculator();

    const coursesMap = Object.fromEntries(mockCourses.map(c => [c.id, c]));
    const withPriorities = calculator.calculateBatchPriorities(mockAssignments, coursesMap);

    await sm.syncAllData(mockCourses, withPriorities);
    await sm.setLastSyncTime('2026-03-21T10:00:00.000Z');

    const stored = await sm.getAssignments();
    expect(stored).toHaveLength(2);
    expect(stored[0].priority_score).toBeGreaterThan(0);
    expect(stored[1].priority_score).toBeGreaterThan(0);
    // Higher-point assignment should have higher base score
    expect(stored[0].priority_score).toBeGreaterThan(stored[1].priority_score); // 50pts > 20pts, closer due
  });

  test('preserves completion state across syncs', async () => {
    const store = createMockStore({
      assignments: [{ id: 5001, name: 'Old', completed_local: true, manual_override: false }],
    });
    global.chrome.storage.local = store;
    const sm = new StorageManager(store);

    const fresh = [{ id: 5001, name: 'Homework', priority_score: 0.3, priority_components: null }];
    await sm.syncAllData(mockCourses, fresh);

    const stored = await sm.getAssignments();
    expect(stored[0].completed_local).toBe(true);
    expect(stored[0].name).toBe('Homework');
  });

  test('priority scores sorted highest-first after batch calculation', () => {
    const calculator = new PriorityCalculator();
    const courses = [{ id: 101, name: 'Math', current_grade: 81, total_points: 500 }];
    const assignments = [
      { id: 1, course_id: 101, name: 'Low', points_possible: 5, due_at: new Date(Date.now() + 86400000 * 20).toISOString() },
      { id: 2, course_id: 101, name: 'High', points_possible: 50, due_at: new Date(Date.now() + 86400000 * 2).toISOString() },
    ];
    const coursesMap = Object.fromEntries(courses.map(c => [c.id, c]));
    const result = calculator.calculateBatchPriorities(assignments, coursesMap);
    const sorted = [...result].sort((a, b) => b.priority_score - a.priority_score);
    expect(sorted[0].name).toBe('High');
    expect(sorted[1].name).toBe('Low');
  });

  test('handles course with no matching assignments gracefully', () => {
    const calculator = new PriorityCalculator();
    const coursesMap = { 999: { id: 999, name: 'Other', current_grade: 85, total_points: 400 } };
    const assignments = [{ id: 1, course_id: 101, name: 'Orphan', points_possible: 50, due_at: null }];
    const result = calculator.calculateBatchPriorities(assignments, coursesMap);
    expect(result[0].priority_score).toBe(0);
  });
});
