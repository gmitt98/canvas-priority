// App-wide configuration constants

export const GRADE_THRESHOLDS = {
  A: 90,
  B: 80,
  C: 70,
  D: 60,
  F: 0
};

export const PRIORITY_CONFIG = {
  TIME_DECAY_DAYS: 30,       // Window for time decay (days)
  GRADE_RISK_BONUS: 0.5,     // Bonus added when grade would drop a letter
};

export const SYNC_CONFIG = {
  INTERVAL_HOURS: 8,         // Auto-sync interval
  INTERVAL_MINUTES: 480,     // Same in minutes (for Chrome alarms)
  MAX_RETRIES: 3,
  RETRY_BACKOFF_BASE_MS: 2000,
};

export const STORAGE_KEYS = {
  CONFIG: 'config',
  COURSES: 'courses',
  ASSIGNMENTS: 'assignments',
  UI_STATE: 'ui_state',
};

export const DEFAULT_CONFIG = {
  canvas_token: null,
  canvas_domain: null,
  grade_thresholds: GRADE_THRESHOLDS,
  auto_sync_enabled: true,
  sync_interval_hours: SYNC_CONFIG.INTERVAL_HOURS,
  last_sync_timestamp: null,
};

export const DEFAULT_UI_STATE = {
  active_view: 'list',
  list_sort: 'priority',
  show_completed: false,
  calendar_view_type: 'week',
};

export const PRIORITY_LEVELS = {
  HIGH: { min: 0.4, label: 'high', color: '#dc2626' },
  MEDIUM: { min: 0.1, label: 'medium', color: '#d97706' },
  LOW: { min: 0, label: 'low', color: '#16a34a' },
};

export const CANVAS_API = {
  VERSION: 'v1',
  ENDPOINTS: {
    SELF: '/api/v1/users/self',
    COURSES: '/api/v1/courses',
    ASSIGNMENTS: (courseId) => `/api/v1/courses/${courseId}/assignments`,
    ENROLLMENTS: (courseId) => `/api/v1/courses/${courseId}/enrollments`,
    ASSIGNMENT_GROUPS: (courseId) => `/api/v1/courses/${courseId}/assignment_groups`,
  },
};

export const ERROR_MESSAGES = {
  INVALID_TOKEN: 'Your access token is invalid. Please reconnect.',
  API_FORBIDDEN: 'Canvas API access is not available. Contact your school.',
  NETWORK_ERROR: 'Connection lost. Showing cached data.',
  RATE_LIMIT: 'Too many requests. Retrying...',
  CANVAS_DOWN: 'Canvas is temporarily unavailable.',
  PARSE_ERROR: 'Received invalid data from Canvas.',
  NOT_CONFIGURED: 'Extension not configured. Please complete setup.',
};
