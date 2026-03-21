// Onboarding page logic

import { StorageManager } from '../lib/storage.js';
import { CanvasAPI, CanvasAPIError } from '../lib/canvas-api.js';
import { PriorityCalculator } from '../lib/priority-calculator.js';
import { normalizeDomain } from '../lib/utils.js';

const storage = new StorageManager();
const calculator = new PriorityCalculator();

const form = document.getElementById('onboarding-form');
const domainInput = document.getElementById('canvas-domain');
const tokenInput = document.getElementById('canvas-token');
const connectBtn = document.getElementById('connect-btn');
const connectSpinner = document.getElementById('connect-spinner');
const btnText = connectBtn.querySelector('.btn-text');
const alertContainer = document.getElementById('alert-container');
const tokenHelpLink = document.getElementById('token-help-link');
const tokenInstructions = document.getElementById('token-instructions');

// Toggle token instructions
tokenHelpLink.addEventListener('click', (e) => {
  e.preventDefault();
  const hidden = tokenInstructions.hidden;
  tokenInstructions.hidden = !hidden;
  tokenHelpLink.textContent = hidden ? 'Hide instructions ↑' : 'How to generate one →';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAlert();

  const domain = normalizeDomain(domainInput.value);
  const token = tokenInput.value.trim();

  if (!domain) {
    showAlert('Please enter a valid Canvas domain (e.g., school.instructure.com).', 'error');
    domainInput.focus();
    return;
  }

  if (!token) {
    showAlert('Please enter your Canvas access token.', 'error');
    tokenInput.focus();
    return;
  }

  setLoading(true);

  try {
    const api = new CanvasAPI(domain, token);

    // Step 1: Validate token
    await api.validateToken();

    // Step 2: Fetch all data
    showStatus('Importing assignments…');
    const data = await api.syncAllData();

    // Step 3: Calculate priorities
    const coursesMap = Object.fromEntries(data.courses.map(c => [c.id, c]));
    const withPriorities = calculator.calculateBatchPriorities(data.assignments, coursesMap);

    // Step 4: Save to storage
    await storage.initialize();
    await storage.setToken(token, domain);
    await storage.syncAllData(data.courses, withPriorities);
    await storage.setLastSyncTime(new Date().toISOString());

    // Step 5: Redirect to main dashboard
    showStatus(`✓ ${data.assignments.length} assignments imported from ${data.courses.length} courses`);
    setTimeout(() => {
      window.location.href = chrome.runtime.getURL('src/pages/main.html');
    }, 800);

  } catch (error) {
    setLoading(false);
    if (error instanceof CanvasAPIError) {
      showAlert(error.message, 'error');
    } else {
      showAlert('An unexpected error occurred. Please try again.', 'error');
      console.error('[Canvas Priority] Onboarding error:', error);
    }
  }
});

function setLoading(loading) {
  connectBtn.disabled = loading;
  connectSpinner.hidden = !loading;
  btnText.textContent = loading ? 'Connecting…' : 'Connect';
}

function showStatus(text) {
  btnText.textContent = text;
}

function showAlert(message, type = 'error') {
  alertContainer.innerHTML = `<div class="alert alert-${type}" role="alert">${message}</div>`;
}

function clearAlert() {
  alertContainer.innerHTML = '';
}
