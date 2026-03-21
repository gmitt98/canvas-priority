# Getting Canvas Priority Running in Chrome

Follow these steps exactly. Takes about 5 minutes.

---

## Step 1 — Download the extension

On the GitHub repo page, click the green **Code** button → **Download ZIP**.

Unzip the folder somewhere you'll remember (like your Desktop or Documents).

Inside the unzipped folder you'll find a folder called `canvas-priority`. That's the extension.

---

## Step 2 — Load it into Chrome

1. Open Chrome and go to: `chrome://extensions`
2. Turn on **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `canvas-priority` folder (the one that contains `manifest.json`)

The extension should appear in your list. If you see an error, make sure you selected the right folder.

---

## Step 3 — Get your Canvas access token

1. Log in to Canvas at your school's URL (e.g. `yourschool.instructure.com`)
2. Click your profile picture (top-left) → **Account** → **Settings**
3. Scroll down to **Approved Integrations**
4. Click **+ New Access Token**
5. Fill in any purpose (e.g. "Canvas Priority") and click **Generate Token**
6. **Copy the token now** — Canvas won't show it again

---

## Step 4 — Set up the extension

1. Click the Canvas Priority icon in your Chrome toolbar (puzzle piece icon → pin it if needed)
2. You'll be taken to a setup page
3. Enter your **Canvas domain** — just the base URL, like `yourschool.instructure.com` (no `https://`)
4. Paste your **access token**
5. Click **Save & Sync**

The extension will pull your assignments from Canvas. This takes 5–15 seconds.

---

## Step 5 — You're done

Click the extension icon any time to see your top assignments ranked by priority. The main dashboard opens in a full tab and shows:

- **List view** — all assignments sorted by how urgently they need attention
- **Calendar view** — your week at a glance

The extension syncs automatically every 8 hours. You can also hit the **↻ Refresh** button to sync manually.

---

## Troubleshooting

**"Invalid token" error** — Go back to Canvas Settings and generate a new token. Make sure you copied the whole thing.

**No assignments showing** — Hit ↻ Refresh. If still empty, check that your courses have assignments with due dates set.

**Extension not appearing** — Make sure Developer mode is on and you selected the `canvas-priority` folder (not the outer unzipped folder).

**Canvas domain format** — Use `school.instructure.com` not `https://school.instructure.com/`. No slashes, no `https`.
