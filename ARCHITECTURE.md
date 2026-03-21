# Canvas Priority — Architecture

## System Overview

Chrome extension (Manifest V3) with client-side data processing. No backend required.

## Components

### Core Libraries (`src/lib/`)

| File | Purpose |
|------|---------|
| `constants.js` | App-wide configuration constants (grade thresholds, API endpoints, etc.) |
| `utils.js` | Helper functions (date formatting, debounce, HTML escaping, etc.) |
| `canvas-api.js` | REST API client for Canvas LMS — handles auth, retries, pagination |
| `priority-calculator.js` | Three-factor priority algorithm |
| `storage.js` | Chrome Storage API wrapper with merge/sync logic |

### UI Components (`src/components/`)

| File | Purpose |
|------|---------|
| `assignment-card.js` | Renders a single assignment card |
| `assignment-list.js` | Sortable, filterable list of cards |
| `calendar-view.js` | Weekly calendar grid |
| `sync-indicator.js` | Sync status + refresh button |

### Pages (`src/pages/`)

| File | Purpose |
|------|---------|
| `onboarding.html/js/css` | First-time setup (token + domain input) |
| `main.html/js/css` | Main dashboard with list/calendar toggle |

### Popup (`src/popup/`)

| File | Purpose |
|------|---------|
| `popup.html/js/css` | Quick-view: top 5 assignments + refresh |

### Background (`src/background/`)

| File | Purpose |
|------|---------|
| `service-worker.js` | Install handler, alarm listener, background sync |
| `alarms.js` | Chrome alarms setup/teardown |

## Data Flow

```
User Action (Refresh / Alarm)
        ↓
service-worker.js  OR  main.js
        ↓
canvas-api.js  →  GET *.instructure.com/api/v1/*
        ↓
priority-calculator.js  (calculateBatchPriorities)
        ↓
storage.js  →  chrome.storage.local
        ↓
assignment-list.js / calendar-view.js  →  DOM
```

## Priority Algorithm

```
PRIORITY_SCORE = (BASE_SCORE × TIME_DECAY) + GRADE_RISK_BONUS

BASE_SCORE = points_possible / total_course_points
TIME_DECAY = max(0, (30 - days_until_due) / 30)
GRADE_RISK_BONUS = 0.5 if missing assignment would drop grade letter
```

## Storage Schema

```
chrome.storage.local = {
  config: {
    canvas_token: string,
    canvas_domain: string,
    grade_thresholds: { A: 90, B: 80, C: 70, D: 60, F: 0 },
    auto_sync_enabled: boolean,
    sync_interval_hours: number,
    last_sync_timestamp: string
  },
  courses: [ { id, name, course_code, current_grade, total_points, ... } ],
  assignments: [
    {
      id, course_id, name, due_at, points_possible, submission,
      // Local state (preserved across syncs):
      completed_local, manual_override, override_priority,
      // Calculated:
      priority_score, priority_components
    }
  ],
  ui_state: { active_view, list_sort, show_completed }
}
```

## Key Design Decisions

- **No build tooling** — Vanilla JS (ES modules), no Webpack/Vite needed for MVP
- **Chrome Storage API** — Sufficient for 10MB quota; sync storage available for cross-device sync in V2
- **Local-first** — All data on device; no backend reduces cost and privacy concerns
- **Merge strategy** — Syncs preserve `completed_local` and `manual_override` — remote wins on everything else
