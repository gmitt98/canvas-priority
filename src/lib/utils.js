// Helper functions: date formatting, validation, etc.

import { PRIORITY_LEVELS } from './constants.js';

/**
 * Format a date string for display.
 * @param {string|null} isoString - ISO 8601 date string
 * @returns {string} Human-readable date string
 */
export function formatDueDate(isoString) {
  if (!isoString) return 'No due date';

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = date - now;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return overdueDays === 1 ? 'Overdue (1 day)' : `Overdue (${overdueDays} days)`;
  }
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays < 7) return `Due in ${diffDays} days`;

  return `Due ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/**
 * Format a timestamp as "X minutes/hours/days ago".
 * @param {string|null} isoString
 * @returns {string}
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return 'Never';

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes === 1) return '1 minute ago';
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

/**
 * Calculate number of days from now until a due date.
 * @param {string|null} isoString
 * @returns {number} Positive = future, negative = past, Infinity if no due date
 */
export function getDaysUntilDue(isoString) {
  if (!isoString) return Infinity;
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = date - now;
  return diffMs / (1000 * 60 * 60 * 24);
}

/**
 * Get priority level label based on score.
 * @param {number} score
 * @returns {'high'|'medium'|'low'}
 */
export function getPriorityLevel(score) {
  if (score >= PRIORITY_LEVELS.HIGH.min) return 'high';
  if (score >= PRIORITY_LEVELS.MEDIUM.min) return 'medium';
  return 'low';
}

/**
 * Format a priority score as a percentage string.
 * @param {number} score
 * @returns {string}
 */
export function formatPriorityScore(score) {
  return (score * 100).toFixed(0) + '%';
}

/**
 * Validate a Canvas domain string.
 * Accepts "school.instructure.com" or "https://school.instructure.com".
 * @param {string} domain
 * @returns {string|null} Normalized domain or null if invalid
 */
export function normalizeDomain(domain) {
  if (!domain || typeof domain !== 'string') return null;
  let d = domain.trim();
  // Strip protocol if present
  d = d.replace(/^https?:\/\//, '');
  // Strip trailing slash
  d = d.replace(/\/$/, '');
  if (!d.includes('.')) return null;
  return d;
}

/**
 * Build the full base URL for a Canvas domain.
 * @param {string} domain - Already normalized domain
 * @returns {string}
 */
export function buildBaseUrl(domain) {
  return `https://${domain}`;
}

/**
 * Truncate a string to a maximum length.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
export function truncate(str, maxLen = 60) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}

/**
 * Safely parse a number, returning 0 for null/undefined/NaN.
 * @param {any} value
 * @returns {number}
 */
export function safeNumber(value) {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

/**
 * Escape HTML to prevent XSS in dynamically built markup.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Debounce a function.
 * @param {Function} fn
 * @param {number} delayMs
 * @returns {Function}
 */
export function debounce(fn, delayMs = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delayMs);
  };
}

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get the ISO date string (YYYY-MM-DD) for a Date object.
 * @param {Date} date
 * @returns {string}
 */
export function toDateString(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Get the start of the week (Monday) for a given date.
 * @param {Date} date
 * @returns {Date}
 */
export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sunday
  const diff = day === 0 ? -6 : 1 - day; // Monday-based
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
