# Canvas Priority — Developer Handoff

## Project Context

Read the parent directory's documentation first:
- `CONTEXT.md` — Why we built this and key decisions
- `PRODUCT_REQUIREMENTS.md` — Full product spec
- `TECHNICAL_SPECIFICATION.md` — Architecture details
- `CANVAS_API_REFERENCE.md` — API endpoint reference

## Getting Started

### Load the Extension

1. Open Chrome → `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load Unpacked** → select this `canvas-priority/` directory
4. Click the extension icon to open the popup

### Run Tests

```bash
npm install
npm test
npm run test:coverage   # with coverage report
```

## Code Organization

```
src/
├── lib/          Core business logic (no DOM dependency)
├── components/   Reusable UI components (DOM, no storage/API)
├── pages/        Full-page views (orchestrate components + storage)
├── popup/        Quick-view popup
├── background/   Service worker + alarms
└── assets/       Styles and icons
```

## Key Files

### 1. Priority Algorithm — `src/lib/priority-calculator.js`
The core value proposition. Well-tested, isolated from DOM.
- Modify `TIME_DECAY_DAYS` and `GRADE_RISK_BONUS` in `constants.js` to tune scoring
- `calculateBatchPriorities()` is the main entry point for mass calculation

### 2. Canvas API Client — `src/lib/canvas-api.js`
All HTTP calls go through here.
- `syncAllData()` is the full sync: courses → assignments → enrollment, all in parallel
- Handles 401/403/429/5xx errors and exponential backoff retries
- Update if Canvas changes endpoints

### 3. Storage Manager — `src/lib/storage.js`
Single source of truth for app data.
- `syncAllData()` merges fresh Canvas data while preserving local state
- Local state = `completed_local`, `manual_override`, `override_priority`

## Common Modifications

### Tune the Priority Algorithm
```javascript
// src/lib/constants.js
export const PRIORITY_CONFIG = {
  TIME_DECAY_DAYS: 30,     // Increase for longer urgency window
  GRADE_RISK_BONUS: 0.5,   // Increase if grade risk should matter more
};
```

### Add a New Canvas Endpoint
1. Add endpoint constant to `CANVAS_API.ENDPOINTS` in `constants.js`
2. Add method to `CanvasAPI` in `canvas-api.js`
3. Call it in `syncAllData()` if it should be included in every sync
4. Update storage schema in `storage.js` if new data needs to persist
5. Update UI components to display the new data

### Change UI Layout / Styles
- Global CSS variables: `src/assets/styles/global.css`
- Component-specific styles are co-located in `src/pages/main.css` and `src/popup/popup.css`

## Known Issues / Tech Debt

1. **No OAuth** — Uses personal access tokens. V2: implement OAuth 2.0
2. **Simple point totals** — Ignores weighted grade categories. V2: use `assignment_groups`
3. **No cross-device sync** — Chrome Storage local only. V2: add backend + Chrome sync storage
4. **Single school hardcoded** — Domain entered at setup. V2: multi-school support

## Future Roadmap

See `PRODUCT_REQUIREMENTS.md` Section 12:
- Phase 2: Multi-school support
- Phase 3: Personal tasks, goal setting, habit tracking
- Phase 4: Mobile PWA + backend sync
- Phase 5: Assignment submission, grade prediction

## Deployment

**Local testing:**
Load unpacked in `chrome://extensions`.

**Chrome Web Store:**
1. Bump `manifest.json` version
2. Zip the directory: `zip -r canvas-priority-v1.0.0.zip canvas-priority -x "*.git*" -x "*node_modules*" -x "*.DS_Store"`
3. Upload zip to Chrome Web Store Developer Dashboard
4. Submit for review

## External Resources

- Canvas API Docs: https://canvas.instructure.com/doc/api/
- Chrome Extension Manifest V3: https://developer.chrome.com/docs/extensions/mv3/
- Chrome Storage API: https://developer.chrome.com/docs/extensions/reference/storage/
