// Canvas REST API client with retry logic and comprehensive error handling

import { CANVAS_API, SYNC_CONFIG, ERROR_MESSAGES } from './constants.js';
import { buildBaseUrl, sleep, safeNumber } from './utils.js';

export class CanvasAPIError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'CanvasAPIError';
    this.status = status;
    this.code = code;
  }
}

export class CanvasAPI {
  constructor(domain, accessToken) {
    this.baseUrl = buildBaseUrl(domain);
    this.token = accessToken;
    this.headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Validate token by fetching current user info.
   * @returns {Promise<Object>} User object
   */
  async validateToken() {
    return this._makeRequest(CANVAS_API.ENDPOINTS.SELF);
  }

  /**
   * Get all active courses for the current user.
   * @returns {Promise<Array>}
   */
  async getCourses() {
    const params = new URLSearchParams({
      enrollment_state: 'active',
    });
    params.append('include[]', 'total_scores');
    params.append('include[]', 'term');

    const url = `${CANVAS_API.ENDPOINTS.COURSES}?${params}`;
    const courses = await this._fetchAllPages(url);
    return courses.filter(c => c.workflow_state === 'available');
  }

  /**
   * Get assignments for a specific course.
   * @param {number} courseId
   * @returns {Promise<Array>}
   */
  async getAssignments(courseId) {
    const params = new URLSearchParams();
    params.append('include[]', 'submission');

    const url = `${CANVAS_API.ENDPOINTS.ASSIGNMENTS(courseId)}?${params}`;
    const assignments = await this._fetchAllPages(url);
    return assignments.filter(a => a.workflow_state === 'published');
  }

  /**
   * Get current enrollment/grade info for a course.
   * @param {number} courseId
   * @returns {Promise<Object|null>} First enrollment or null
   */
  async getEnrollment(courseId) {
    const params = new URLSearchParams({
      user_id: 'self',
    });
    params.append('type[]', 'StudentEnrollment');

    const url = `${CANVAS_API.ENDPOINTS.ENROLLMENTS(courseId)}?${params}`;
    const enrollments = await this._makeRequest(url);
    return enrollments && enrollments.length > 0 ? enrollments[0] : null;
  }

  /**
   * Get assignment groups (weighted categories) for a course.
   * @param {number} courseId
   * @returns {Promise<Array>}
   */
  async getAssignmentGroups(courseId) {
    return this._makeRequest(CANVAS_API.ENDPOINTS.ASSIGNMENT_GROUPS(courseId));
  }

  /**
   * Full sync: fetch all courses, assignments, and grades in parallel.
   * @returns {Promise<{courses: Array, assignments: Array}>}
   */
  async syncAllData() {
    const rawCourses = await this.getCourses();

    // For each course, fetch assignments and enrollment in parallel
    const courseDataPromises = rawCourses.map(async (course) => {
      const [assignments, enrollment] = await Promise.all([
        this.getAssignments(course.id).catch(() => []),
        this.getEnrollment(course.id).catch(() => null),
      ]);

      // Extract current grade from enrollment or from course enrollments array
      let currentGrade = null;
      if (enrollment && enrollment.computed_current_score != null) {
        currentGrade = enrollment.computed_current_score;
      } else if (course.enrollments && course.enrollments.length > 0) {
        currentGrade = course.enrollments[0].computed_current_score ?? null;
      }

      // Calculate total points for this course
      const totalPoints = assignments
        .filter(a => a.workflow_state === 'published')
        .reduce((sum, a) => sum + safeNumber(a.points_possible), 0);

      const normalizedCourse = {
        id: course.id,
        name: course.name,
        course_code: course.course_code,
        enrollment_term_id: course.enrollment_term_id,
        current_grade: currentGrade,
        total_points: totalPoints,
        workflow_state: course.workflow_state,
      };

      const normalizedAssignments = assignments.map(a => ({
        id: a.id,
        course_id: course.id,
        name: a.name,
        description: a.description || '',
        due_at: a.due_at || null,
        points_possible: safeNumber(a.points_possible),
        submission: a.submission || null,
        html_url: a.html_url || null,
        // Local state defaults
        completed_local: false,
        manual_override: false,
        override_priority: null,
        // Calculated fields (filled by priority calculator)
        priority_score: 0,
        priority_components: null,
      }));

      return { course: normalizedCourse, assignments: normalizedAssignments };
    });

    const allCourseData = await Promise.all(courseDataPromises);

    const courses = allCourseData.map(d => d.course);
    const assignments = allCourseData.flatMap(d => d.assignments);

    return { courses, assignments };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Make a single API request.
   * @param {string} endpoint - Path starting with /api/v1/... or full URL
   * @param {Object} options - Fetch options
   * @returns {Promise<any>}
   */
  async _makeRequest(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    return this._retryWithBackoff(async () => {
      let response;
      try {
        response = await fetch(url, {
          ...options,
          headers: { ...this.headers, ...(options.headers || {}) },
        });
      } catch (networkErr) {
        throw new CanvasAPIError(ERROR_MESSAGES.NETWORK_ERROR, 0, 'NETWORK_ERROR');
      }

      if (response.status === 401) {
        throw new CanvasAPIError(ERROR_MESSAGES.INVALID_TOKEN, 401, 'INVALID_TOKEN');
      }
      if (response.status === 403) {
        throw new CanvasAPIError(ERROR_MESSAGES.API_FORBIDDEN, 403, 'FORBIDDEN');
      }
      if (response.status === 429) {
        const retryAfter = safeNumber(response.headers.get('Retry-After')) || 60;
        await sleep(retryAfter * 1000);
        throw new CanvasAPIError(ERROR_MESSAGES.RATE_LIMIT, 429, 'RATE_LIMIT');
      }
      if (response.status >= 500) {
        throw new CanvasAPIError(ERROR_MESSAGES.CANVAS_DOWN, response.status, 'SERVER_ERROR');
      }
      if (!response.ok) {
        throw new CanvasAPIError(`HTTP ${response.status}`, response.status, 'HTTP_ERROR');
      }

      try {
        return await response.json();
      } catch {
        throw new CanvasAPIError(ERROR_MESSAGES.PARSE_ERROR, response.status, 'PARSE_ERROR');
      }
    });
  }

  /**
   * Fetch all pages of a paginated Canvas API endpoint.
   * @param {string} endpoint
   * @returns {Promise<Array>}
   */
  async _fetchAllPages(endpoint) {
    const results = [];
    let url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    while (url) {
      let response;
      try {
        response = await fetch(url, { headers: this.headers });
      } catch {
        throw new CanvasAPIError(ERROR_MESSAGES.NETWORK_ERROR, 0, 'NETWORK_ERROR');
      }

      if (!response.ok) {
        // Delegate to _makeRequest for proper error handling on the first page
        if (url === (endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`)) {
          return this._makeRequest(endpoint);
        }
        break;
      }

      const data = await response.json();
      results.push(...(Array.isArray(data) ? data : [data]));

      // Check Link header for next page
      const linkHeader = response.headers.get('Link') || '';
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      url = nextMatch ? nextMatch[1] : null;
    }

    return results;
  }

  /**
   * Retry a request function with exponential backoff.
   * @param {Function} requestFn
   * @param {number} maxRetries
   * @returns {Promise<any>}
   */
  async _retryWithBackoff(requestFn, maxRetries = SYNC_CONFIG.MAX_RETRIES) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        // Don't retry on auth errors
        if (error.code === 'INVALID_TOKEN' || error.code === 'FORBIDDEN') {
          throw error;
        }
        if (attempt < maxRetries - 1) {
          const delayMs = SYNC_CONFIG.RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt);
          await sleep(delayMs);
        }
      }
    }
    throw lastError;
  }
}
