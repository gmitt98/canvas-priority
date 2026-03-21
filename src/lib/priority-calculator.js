// Priority scoring algorithm: three-factor calculation
// PRIORITY_SCORE = (BASE_SCORE × TIME_DECAY) + GRADE_RISK_BONUS

import { GRADE_THRESHOLDS, PRIORITY_CONFIG } from './constants.js';
import { getDaysUntilDue, safeNumber } from './utils.js';

export class PriorityCalculator {
  constructor(gradeThresholds = GRADE_THRESHOLDS) {
    this.thresholds = gradeThresholds;
    this.TIME_DECAY_DAYS = PRIORITY_CONFIG.TIME_DECAY_DAYS;
    this.GRADE_RISK_BONUS = PRIORITY_CONFIG.GRADE_RISK_BONUS;
  }

  /**
   * Main priority calculation for a single assignment.
   * Returns override_priority directly if manual_override is set.
   * @param {Object} assignment
   * @param {Object} courseData
   * @returns {Object|number} Priority result object, or number if manual override
   */
  calculatePriority(assignment, courseData) {
    if (assignment.manual_override) {
      return assignment.override_priority;
    }

    const baseScore = this.calculateBaseScore(assignment, courseData);
    const daysUntilDue = getDaysUntilDue(assignment.due_at);
    const timeDecay = this.calculateTimeDecay(daysUntilDue);
    const gradeRisk = this.calculateGradeRiskBonus(assignment, courseData);

    const score = (baseScore * timeDecay) + gradeRisk;

    return {
      score,
      baseScore,
      timeDecay,
      gradeRisk,
      components: {
        points: safeNumber(assignment.points_possible),
        totalPoints: safeNumber(courseData.total_points),
        daysUntilDue: isFinite(daysUntilDue) ? daysUntilDue : null,
        currentGrade: courseData.current_grade,
        wouldDropGrade: gradeRisk > 0,
      },
    };
  }

  /**
   * BASE_SCORE = points_possible / total_points
   * @param {Object} assignment
   * @param {Object} courseData
   * @returns {number}
   */
  calculateBaseScore(assignment, courseData) {
    const points = safeNumber(assignment.points_possible);
    const total = safeNumber(courseData.total_points);
    if (total === 0) return 0;
    return points / total;
  }

  /**
   * TIME_DECAY = max(0, (TIME_DECAY_DAYS - daysUntilDue) / TIME_DECAY_DAYS)
   * @param {number} daysUntilDue - May be negative (past due) or Infinity (no due date)
   * @returns {number} 0 to 1
   */
  calculateTimeDecay(daysUntilDue) {
    if (!isFinite(daysUntilDue)) return 0;
    if (daysUntilDue < 0) return 0; // Past due — no urgency bonus
    return Math.max(0, (this.TIME_DECAY_DAYS - daysUntilDue) / this.TIME_DECAY_DAYS);
  }

  /**
   * GRADE_RISK_BONUS = 0.5 if missing this assignment would drop a grade letter.
   * @param {Object} assignment
   * @param {Object} courseData
   * @returns {number} 0 or GRADE_RISK_BONUS
   */
  calculateGradeRiskBonus(assignment, courseData) {
    const currentGrade = safeNumber(courseData.current_grade);
    const totalPoints = safeNumber(courseData.total_points);

    if (!courseData.current_grade || totalPoints === 0) return 0;

    const pointsPossible = safeNumber(assignment.points_possible);
    if (pointsPossible === 0) return 0;

    const gradeImpact = this.calculateGradeImpact(assignment, courseData);
    if (gradeImpact === null) return 0;

    const gradeAfterMiss = currentGrade - gradeImpact;
    return this.wouldDropGradeLevel(currentGrade, gradeAfterMiss) ? this.GRADE_RISK_BONUS : 0;
  }

  /**
   * Calculate how many percentage points the grade would drop if assignment is missed.
   * points_lost_if_missed = (points_possible / total_points) * 100
   * @param {Object} assignment
   * @param {Object} courseData
   * @returns {number|null}
   */
  calculateGradeImpact(assignment, courseData) {
    const totalPoints = safeNumber(courseData.total_points);
    if (totalPoints === 0) return null;
    const pointsPossible = safeNumber(assignment.points_possible);
    return (pointsPossible / totalPoints) * 100;
  }

  /**
   * Determine which grade letter a percentage corresponds to.
   * @param {number} percentageGrade
   * @returns {string} 'A', 'B', 'C', 'D', or 'F'
   */
  getGradeLevel(percentageGrade) {
    if (percentageGrade >= this.thresholds.A) return 'A';
    if (percentageGrade >= this.thresholds.B) return 'B';
    if (percentageGrade >= this.thresholds.C) return 'C';
    if (percentageGrade >= this.thresholds.D) return 'D';
    return 'F';
  }

  /**
   * Check if a grade drop crosses a letter grade boundary.
   * @param {number} currentGrade
   * @param {number} gradeAfterMiss
   * @returns {boolean}
   */
  wouldDropGradeLevel(currentGrade, gradeAfterMiss) {
    return this.getGradeLevel(currentGrade) !== this.getGradeLevel(gradeAfterMiss);
  }

  /**
   * Batch calculate priorities for an array of assignments.
   * @param {Array} assignments
   * @param {Object} coursesMap - Map of courseId → courseData
   * @returns {Array} Assignments with priority_score and priority_components added
   */
  calculateBatchPriorities(assignments, coursesMap) {
    return assignments.map((assignment) => {
      const courseData = coursesMap[assignment.course_id];
      if (!courseData) {
        return { ...assignment, priority_score: 0, priority_components: null };
      }

      const result = this.calculatePriority(assignment, courseData);

      if (typeof result === 'number') {
        // Manual override
        return {
          ...assignment,
          priority_score: result,
          priority_components: null,
        };
      }

      return {
        ...assignment,
        priority_score: result.score,
        priority_components: result.components,
      };
    });
  }
}

export const priorityCalculator = new PriorityCalculator();
