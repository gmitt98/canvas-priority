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

## Security & Your Canvas Token

### What your token can do

Canvas API tokens grant **full read and write access** to your Canvas account. With a valid token, an application could submit assignments, send messages, change grades, and access all your course content — not just read it.

**Canvas Priority only reads data.** It fetches your courses, assignments, and grades. It never submits anything, never sends messages, and never modifies your Canvas account in any way. You can verify this in the source code: all API calls are `GET` requests.

That said, you should treat your Canvas token like a password:

- Do not share it with anyone
- Do not paste it into other tools or websites without understanding what they do with it
- Revoke it when you no longer use Canvas Priority

### How to disconnect

**From within the extension:**
1. Open Canvas Priority
2. Click the **⚙** icon in the top-right corner
3. Click **Disconnect & delete data**

This removes your token and all synced assignment data from your browser immediately.

**Revoke the token from Canvas** (recommended after disconnecting):
1. Log into Canvas
2. Account → Settings → Approved Integrations
3. Find the Canvas Priority token → click **Revoke**

Revoking the token from Canvas ensures it cannot be used by anything, even if it were somehow still present on a device.

### What data is stored

Everything is stored locally using Chrome's `chrome.storage.local` API — the sandboxed storage built into Chrome for extensions. Nothing is stored on external servers.

Stored locally:
- Your Canvas API token
- Your Canvas domain (e.g. `school.instructure.com`)
- Your synced courses and assignments
- Your local preferences (sort order, completed/hidden items, priority overrides)

To verify: open Chrome DevTools on any extension page → Application → Storage → Extension Storage.

## Privacy

All data is stored locally in Chrome's browser storage. No data is sent to any external server. See the [full privacy policy](https://gmitt98.github.io/canvas-priority/privacy).

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
