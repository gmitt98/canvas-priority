# Canvas Priority

Chrome extension to prioritize Canvas LMS assignments with smart scoring.

## What It Does

Canvas Priority imports your assignments from Canvas and ranks them using a three-factor priority score:

- **Base score** — how much the assignment is worth relative to the course total
- **Time decay** — urgency based on days until due (full weight at 1 day, zero weight at 30+ days)
- **Grade risk bonus** — +0.5 if missing the assignment would drop your letter grade

## Installation

1. Download or clone this repository
2. Open Chrome → `chrome://extensions`
3. Enable **Developer Mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `canvas-priority` folder
6. Under `details`, toggle `pin to toolbar`
7. Click the extension icon in the toolbar to start

## Setup

1. **Generate a Canvas access token:**
   - Log into Canvas
   - Account → Settings → Approved Integrations
   - Click **+ New Access Token**
   - Enter a purpose (e.g., "Canvas Priority Extension")
   - Copy the generated token

2. Enter your school's Canvas domain and token in the setup page
3. Click **Connect** — assignments sync automatically

## Usage

- **List view:** Assignments sorted by priority score (highest first)
- **Calendar view:** Weekly grid showing assignments by due date, color-coded by priority
- Click an assignment to open it in Canvas
- Check the box to mark it complete (persists locally)
- Click **Override** to set a custom priority score
- Click **↻** to refresh from Canvas

## Privacy

All data is stored locally in Chrome's browser storage. No data is sent to any external server.

## File Structure

```
canvas-priority/
├── manifest.json            Chrome extension manifest (V3)
├── src/
│   ├── lib/                 Core business logic
│   ├── components/          Reusable UI components
│   ├── pages/               Onboarding and main dashboard
│   ├── popup/               Quick-view popup
│   └── background/          Service worker and alarms
└── tests/                   Unit and integration tests
```

## Development

Load unpacked in Chrome (`chrome://extensions` → Developer Mode → Load unpacked).

Run tests:
```bash
npm install
npm test
```

## Priority Algorithm

```
PRIORITY_SCORE = (BASE_SCORE × TIME_DECAY) + GRADE_RISK_BONUS

BASE_SCORE = points_possible / total_course_points
TIME_DECAY = max(0, (30 - days_until_due) / 30)
GRADE_RISK_BONUS = 0.5 if missing would drop grade letter, else 0
```

**Color coding:**
- 🔴 High (≥ 0.4): Red
- 🟡 Medium (0.1–0.39): Yellow/orange
- 🟢 Low (< 0.1): Green
