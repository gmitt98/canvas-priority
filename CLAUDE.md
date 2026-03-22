# Canvas Priority — Claude Code Instructions

## Git workflow (strictly enforced)

**Never commit directly to main.** Main is protected on GitHub and will reject direct pushes.

Every change, no matter how small, follows this flow:

```bash
# 1. Create a branch
git checkout -b feat/short-description   # new feature
git checkout -b fix/short-description    # bug fix
git checkout -b style/short-description  # UI/CSS only
git checkout -b docs/short-description   # documentation

# 2. Do the work, commit normally
git add <files>
git commit -m "description"

# 3. Push the branch
git push origin feat/short-description

# 4. Open a PR to main
gh pr create --base main --title "..." --body "..."

# 5. Merge the PR (squash preferred for clean history)
gh pr merge --squash
```

## Branch naming
- `feat/` — new functionality
- `fix/` — bug fixes
- `style/` — visual/CSS changes with no logic change
- `docs/` — README, comments, documentation only

## Commit style
- Present tense, imperative: "add settings modal" not "added settings modal"
- Prefix with type: `feat:`, `fix:`, `style:`, `docs:`
- Keep subject line under 72 chars

## Project context
- Chrome Extension, Manifest V3, vanilla JS ES modules, no build tooling
- All logic in `src/lib/`, UI components in `src/components/`, pages in `src/pages/`
- `chrome.storage.local` for all persistence — no backend
- CSS variables defined in `src/assets/styles/global.css`, page styles in `src/pages/main.css`
- Do not add external dependencies

## What this extension does
Ranks Canvas LMS assignments by priority score: `(BASE_SCORE × TIME_DECAY) + GRADE_RISK_BONUS`
