# Local ↔ GitHub Sync Required

## Current State (as of 2026-03-29)

The local `main` branch has **diverged** from GitHub's `main` because `git pull`
is blocked by a proxy (403 Forbidden). All deployments use GitHub directly — the
live app is fully up to date. This file documents what to do when network access
is restored.

### Local branch history (HEAD → oldest)
```
75dc29e  fix: KRAKENCAM_LOGO ReferenceError in buildEmbedCode   ← local only
d989b37  Phase 1: Extract utility modules from jobsite-reporter  ← local only
bc7d481  fix: restore jobsite-reporter with delete UUID check    ← common ancestor
```

### GitHub main history (HEAD → common ancestor)
```
c71ff984  fix: decode garbled UTF-8 in AccountPage
bd0e588   fix: KRAKENCAM_LOGO in TasksPage.jsx
2ee8309   fix: krakenLogo passed to buildEmbedCode
5eda70b   fix: ACCENT_PRESETS in SettingsPage
323e1374  chore: extract CSS from jobsite-reporter into jobsite-reporter.css
bc7d481   fix: restore jobsite-reporter with delete UUID check    ← common ancestor
```

## What Diverged

| File | Local state | GitHub state |
|------|------------|--------------|
| `src/utils/helpers.js` | 293-line stub (Phase 1) + krakenLogo fix | Full 930+ line version + krakenLogo fix |
| `src/utils/constants.js` | 257-line stub (Phase 1) | Full version |
| `src/utils/icons.jsx` | 102-line file (Phase 1) | Same content |
| `src/jobsite-reporter.jsx` | Phase 1 imports-based version + generateEmbed fix | CSS-extracted monolith + generateEmbed fix |
| `src/components/SettingsPage.jsx` | Does not exist locally | ACCENT_PRESETS fix applied |
| `src/components/AccountPage.jsx` | Does not exist locally | Encoding fix applied |
| `src/components/TasksPage.jsx` | Does not exist locally | KRAKENCAM_LOGO fix applied |
| `src/components/ChecklistsTab.jsx` | Does not exist locally | krakenLogo fix applied |
| `src/jobsite-reporter.css` | Does not exist locally | Extracted CSS file |
| All other components (11 files) | Do not exist locally | Exist on GitHub |

## How to Sync (when network is available)

The simplest resolution — **GitHub wins** (it's more complete and has all bug fixes):

```bash
git fetch origin

# Option A: Hard reset — discard local Phase 1 commit, take GitHub state
# (recommended — GitHub has better versions of all extracted files)
git reset --hard origin/main

# Option B: Rebase — replay local commits on top of GitHub
# May produce conflicts in helpers.js, constants.js, jobsite-reporter.jsx
# Only use this if you want to preserve the Phase 1 extraction work locally
git rebase origin/main
```

**Recommendation: Use Option A** (`git reset --hard origin/main`).

The Phase 1 extraction work is already superseded on GitHub — the utility files
(helpers.js, constants.js) on GitHub are more complete than the Phase 1 stubs,
and the component files (SettingsPage, AccountPage, etc.) already exist as separate
files on GitHub. Nothing in the local Phase 1 commit is missing from GitHub.

The SPLIT_PLAN.md planning doc is preserved separately in the repo root if needed
for reference.

## After Syncing

Delete this file once the sync is complete:
```bash
rm SYNC_NEEDED.md
git add -A && git commit -m "chore: sync local with GitHub HEAD post-divergence"
```
