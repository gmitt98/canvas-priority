// Unit tests for PriorityCalculator

// Note: Since the extension uses ES modules, these tests use a CommonJS-compatible
// inline version of the calculator logic for Jest. In a production setup,
// configure Jest with babel or use --experimental-vm-modules.

const GRADE_THRESHOLDS = { A: 90, B: 80, C: 70, D: 60, F: 0 };

class PriorityCalculator {
  constructor(gradeThresholds = GRADE_THRESHOLDS) {
    this.thresholds = gradeThresholds;
    this.TIME_DECAY_DAYS = 30;
    this.GRADE_RISK_BONUS = 0.5;
  }

  calculatePriority(assignment, courseData) {
    if (assignment.manual_override) {
      return assignment.override_priority;
    }
    const baseScore = this.calculateBaseScore(assignment, courseData);
    const daysUntilDue = this._getDaysUntilDue(assignment.due_at);
    const timeDecay = this.calculateTimeDecay(daysUntilDue);
    const gradeRisk = this.calculateGradeRiskBonus(assignment, courseData);
    const score = (baseScore * timeDecay) + gradeRisk;
    return { score, baseScore, timeDecay, gradeRisk, components: { wouldDropGrade: gradeRisk > 0 } };
  }

  calculateBaseScore(assignment, courseData) {
    const points = Number(assignment.points_possible) || 0;
    const total = Number(courseData.total_points) || 0;
    if (total === 0) return 0;
    return points / total;
  }

  calculateTimeDecay(daysUntilDue) {
    if (!isFinite(daysUntilDue)) return 0;
    if (daysUntilDue < 0) return 0; // Past due — no urgency bonus
    return Math.max(0, (this.TIME_DECAY_DAYS - daysUntilDue) / this.TIME_DECAY_DAYS);
  }

  calculateGradeRiskBonus(assignment, courseData) {
    const currentGrade = Number(courseData.current_grade) || 0;
    const totalPoints = Number(courseData.total_points) || 0;
    if (!courseData.current_grade || totalPoints === 0) return 0;
    const pointsPossible = Number(assignment.points_possible) || 0;
    if (pointsPossible === 0) return 0;
    const gradeImpact = (pointsPossible / totalPoints) * 100;
    const gradeAfterMiss = currentGrade - gradeImpact;
    return this.wouldDropGradeLevel(currentGrade, gradeAfterMiss) ? this.GRADE_RISK_BONUS : 0;
  }

  getGradeLevel(pct) {
    if (pct >= this.thresholds.A) return 'A';
    if (pct >= this.thresholds.B) return 'B';
    if (pct >= this.thresholds.C) return 'C';
    if (pct >= this.thresholds.D) return 'D';
    return 'F';
  }

  wouldDropGradeLevel(current, after) {
    return this.getGradeLevel(current) !== this.getGradeLevel(after);
  }

  _getDaysUntilDue(due_at) {
    if (!due_at) return Infinity;
    const date = new Date(due_at);
    const now = new Date();
    return (date - now) / (1000 * 60 * 60 * 24);
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PriorityCalculator', () => {
  let calculator;

  beforeEach(() => {
    calculator = new PriorityCalculator();
  });

  // ── Base score ───────────────────────────────────────────────────────────────
  test('calculates base score correctly', () => {
    const score = calculator.calculateBaseScore({ points_possible: 50 }, { total_points: 500 });
    expect(score).toBeCloseTo(0.10, 5);
  });

  test('returns 0 base score when total_points is 0', () => {
    const score = calculator.calculateBaseScore({ points_possible: 50 }, { total_points: 0 });
    expect(score).toBe(0);
  });

  test('returns 0 base score for zero-point assignment', () => {
    const score = calculator.calculateBaseScore({ points_possible: 0 }, { total_points: 500 });
    expect(score).toBe(0);
  });

  // ── Time decay ───────────────────────────────────────────────────────────────
  test('calculates time decay for assignment due tomorrow (~1 day)', () => {
    const decay = calculator.calculateTimeDecay(1);
    expect(decay).toBeCloseTo(29 / 30, 4); // (30-1)/30
  });

  test('calculates time decay for assignment due in 15 days', () => {
    const decay = calculator.calculateTimeDecay(15);
    expect(decay).toBeCloseTo(0.5, 4);
  });

  test('time decay is 0 for assignment due in 30+ days', () => {
    expect(calculator.calculateTimeDecay(30)).toBe(0);
    expect(calculator.calculateTimeDecay(35)).toBe(0);
    expect(calculator.calculateTimeDecay(100)).toBe(0);
  });

  test('time decay is 0 for past-due assignments (negative days)', () => {
    expect(calculator.calculateTimeDecay(-1)).toBe(0);
    expect(calculator.calculateTimeDecay(-10)).toBe(0);
  });

  test('time decay is 0 for assignments with no due date (Infinity)', () => {
    expect(calculator.calculateTimeDecay(Infinity)).toBe(0);
  });

  // ── Grade risk ───────────────────────────────────────────────────────────────
  test('calculates grade risk bonus when grade would cross B→C threshold', () => {
    // current: 81% (B), missing 50pts of 500 = -10% → 71% (C)
    const bonus = calculator.calculateGradeRiskBonus(
      { points_possible: 50 },
      { total_points: 500, current_grade: 81 }
    );
    expect(bonus).toBe(0.5);
  });

  test('calculates no grade risk bonus when grade stays same letter', () => {
    // current: 92% (A), missing 10pts of 500 = -2% → 90% (still A)
    const bonus = calculator.calculateGradeRiskBonus(
      { points_possible: 10 },
      { total_points: 500, current_grade: 92 }
    );
    expect(bonus).toBe(0);
  });

  test('calculates no grade risk bonus for zero-point assignment', () => {
    const bonus = calculator.calculateGradeRiskBonus(
      { points_possible: 0 },
      { total_points: 500, current_grade: 81 }
    );
    expect(bonus).toBe(0);
  });

  test('calculates no grade risk when current_grade not provided', () => {
    const bonus = calculator.calculateGradeRiskBonus(
      { points_possible: 50 },
      { total_points: 500, current_grade: null }
    );
    expect(bonus).toBe(0);
  });

  // ── Full calculation ──────────────────────────────────────────────────────────
  test('full priority calculation for high-priority assignment (2 days, B→C risk)', () => {
    const assignment = {
      points_possible: 50,
      due_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const course = { total_points: 500, current_grade: 81 };

    const result = calculator.calculatePriority(assignment, course);
    // BASE: 50/500 = 0.10, TIME: (30-2)/30 ≈ 0.933, RISK: 0.5
    // SCORE ≈ (0.10 * 0.933) + 0.5 = 0.593
    expect(result.score).toBeCloseTo(0.593, 1);
    expect(result.components.wouldDropGrade).toBe(true);
  });

  test('full priority for low-priority assignment', () => {
    const assignment = {
      points_possible: 10,
      due_at: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const course = { total_points: 500, current_grade: 92 };

    const result = calculator.calculatePriority(assignment, course);
    // BASE: 0.02, TIME: 5/30 ≈ 0.167, RISK: 0
    expect(result.score).toBeCloseTo(0.02 * (5 / 30), 3);
    expect(result.components.wouldDropGrade).toBe(false);
  });

  test('handles zero-point assignment', () => {
    const assignment = {
      points_possible: 0,
      due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    const course = { total_points: 500, current_grade: 85 };

    const result = calculator.calculatePriority(assignment, course);
    expect(result.score).toBe(0);
  });

  test('handles past-due assignments (time decay = 0)', () => {
    const assignment = {
      points_possible: 20,
      due_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    };
    const course = { total_points: 500, current_grade: 85 };

    const result = calculator.calculatePriority(assignment, course);
    expect(result.timeDecay).toBe(0);
  });

  test('respects manual override — returns override value directly', () => {
    const assignment = {
      points_possible: 20,
      due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      manual_override: true,
      override_priority: 0.95,
    };
    const course = { total_points: 500, current_grade: 85 };

    const result = calculator.calculatePriority(assignment, course);
    expect(result).toBe(0.95);
  });

  // ── Grade level helpers ───────────────────────────────────────────────────────
  test('getGradeLevel returns correct letters', () => {
    expect(calculator.getGradeLevel(95)).toBe('A');
    expect(calculator.getGradeLevel(90)).toBe('A');
    expect(calculator.getGradeLevel(89.9)).toBe('B');
    expect(calculator.getGradeLevel(80)).toBe('B');
    expect(calculator.getGradeLevel(79.9)).toBe('C');
    expect(calculator.getGradeLevel(70)).toBe('C');
    expect(calculator.getGradeLevel(69.9)).toBe('D');
    expect(calculator.getGradeLevel(60)).toBe('D');
    expect(calculator.getGradeLevel(59.9)).toBe('F');
    expect(calculator.getGradeLevel(0)).toBe('F');
  });

  test('wouldDropGradeLevel detects B→C crossing', () => {
    expect(calculator.wouldDropGradeLevel(81, 71)).toBe(true);  // B → C
    expect(calculator.wouldDropGradeLevel(92, 88)).toBe(true);  // A → B
    expect(calculator.wouldDropGradeLevel(85, 83)).toBe(false); // B → B (same letter)
  });
});
