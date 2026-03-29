# KrakenCam — File Split Plan

## Why Split?

The main file `src/jobsite-reporter.jsx` is **23,292 lines / ~2.4MB**. Problems this causes:
- Vite bundles it as one giant chunk → slow initial load
- Any browser push risks corrupting the entire app
- Hard to edit without touching unrelated code
- No code splitting possible

**Goal:** Break it into ~20 focused files. After the split, the main file drops to ~2,000 lines. Page-level components become lazily loaded (not downloaded until the user navigates to that page).

---

## Current Component Map (by size)

| Component(s) | Lines | What it does |
|---|---|---|
| ReportCreator + BlockRenderer + ReportPages + AiWriterModal + support | ~2,500 | Report builder |
| AccountPage | ~1,520 | Account/billing/team management |
| SketchEditor | ~1,270 | Sketch/floor plan drawing |
| SettingsPage + AddItemInput + StatusListEditor | ~1,330 | App settings |
| ChecklistsTab family (6 components) | ~1,280 | Checklists and templates |
| PhotosTab + BAPairCard/Slider + buildEmbedCode | ~900 | Photos management |
| ImageEditor | ~730 | Photo annotation/editing |
| CameraPage | ~700 | Live camera capture |
| ClientPortalTab family | ~740 | Client portal |
| ChatPanel + ChatButton + NewChatModal | ~700 | Direct messaging |
| ProjectModal | ~635 | Create/edit project modal |
| ProjectDetail | ~615 | Project detail view (tabs shell) |
| CalendarPage + EventModal | ~850 | Calendar |
| TasksPage + TaskModal | ~1,050 | Tasks management |
| ProjectFilesTab | ~515 | File attachments |
| AnalyticsDashboard | ~440 | Analytics |
| JobsiteMapPage | ~430 | Map view |
| TemplatesPage | ~395 | Report templates |
| VoiceNotesTab | ~280 | Voice notes |
| VideosTab | ~220 | Videos |
| ProjectActivityFeed | ~140 | Activity log |
| AIProjectOverview | ~160 | AI overview card |
| SketchesTab | ~140 | Sketches list tab |
| ReportsTab + SendEmailModal | ~270 | Reports tab |

---

## Target File Structure

```
src/
├── jobsite-reporter.jsx          ← Main App + state (~2,000 lines, down from 23k)
├── AppRouter.jsx                 ← unchanged
│
├── utils/
│   ├── constants.js              ← PLAN_AI_LIMITS, DEFAULT_*, TEMPLATES, etc.
│   ├── icons.js                  ← Icon component, ic object, RoomIcon, RoomIconBadge
│   └── helpers.js                ← uid(), formatDate(), canAccessFeature(), getWeekWindowStart(), etc.
│
├── features/
│   ├── camera/
│   │   ├── CameraPage.jsx        ← lazy loaded
│   │   └── ImageEditor.jsx
│   │
│   ├── report/
│   │   ├── ReportCreator.jsx     ← lazy loaded (biggest win ~2,500 lines)
│   │   ├── ReportPages.jsx       ← page layout + BlockRenderer + PageFooter
│   │   ├── AiWriterModal.jsx
│   │   └── AiWriterUpgradeModal.jsx
│   │
│   ├── sketch/
│   │   └── SketchEditor.jsx      ← lazy loaded (~1,270 lines)
│   │
│   ├── project/
│   │   ├── ProjectModal.jsx      ← create/edit project
│   │   ├── ProjectsList.jsx      ← project list view
│   │   ├── ProjectDetail.jsx     ← tabs shell + ProjectActivityFeed + AIProjectOverview
│   │   └── tabs/
│   │       ├── PhotosTab.jsx
│   │       ├── ChecklistsTab.jsx ← includes all 6 checklist components + TemplateManagerModal
│   │       ├── ClientPortalTab.jsx
│   │       ├── ProjectFilesTab.jsx
│   │       ├── VoiceNotesTab.jsx
│   │       ├── VideosTab.jsx
│   │       ├── SketchesTab.jsx
│   │       └── ReportsTab.jsx
│   │
│   ├── account/
│   │   └── AccountPage.jsx       ← lazy loaded (~1,520 lines)
│   │                                (includes UserModal, BillingHistoryModal,
│   │                                 UpdateCardModal, InviteUserButton)
│   │
│   ├── settings/
│   │   └── SettingsPage.jsx      ← lazy loaded (~1,330 lines)
│   │
│   ├── chat/
│   │   └── ChatPanel.jsx         ← lazy loaded (~700 lines)
│   │                                (includes ChatButton, NewChatModal)
│   │
│   ├── calendar/
│   │   └── CalendarPage.jsx      ← lazy loaded (~850 lines, includes EventModal)
│   │
│   ├── tasks/
│   │   └── TasksPage.jsx         ← lazy loaded (~1,050 lines, includes TaskModal)
│   │
│   ├── map/
│   │   └── JobsiteMapPage.jsx    ← lazy loaded (~430 lines)
│   │
│   ├── analytics/
│   │   └── AnalyticsDashboard.jsx ← lazy loaded (~440 lines)
│   │
│   └── templates/
│       └── TemplatesPage.jsx     ← lazy loaded (~395 lines)
│
├── lib/                          ← already exists, unchanged
├── components/                   ← already exists, unchanged
└── hooks/                        ← already exists, unchanged
```

---

## Execution Plan (Phase by Phase)

### ⚠️ Safety Rules
1. **One phase at a time.** Deploy and verify in browser before starting the next phase.
2. **Never delete from the main file until the extracted file is confirmed working.**
3. **Always push via git commit, never via browser.**
4. **Each phase should be a single git commit** so we can revert cleanly if needed.

---

### Phase 1 — Extract Utilities (Zero Risk)
**No JSX, no component changes, just moving constants and functions.**

Create `src/utils/constants.js`:
- `PLAN_AI_LIMITS`
- `DEFAULT_ROLE_PERMISSIONS`, `DEFAULT_PERMISSION_POLICIES`
- `DEFAULT_CLIENT_PORTAL`
- `DEFAULT_ROOMS`
- `TEMPLATES` (report templates)
- `DEFAULT_CL_TEMPLATES` (checklist templates)
- `DEFAULT_COLUMNS` (task columns)
- `DEFAULT_SETTINGS`

Create `src/utils/helpers.js`:
- `uid()`
- `formatDate()`
- `formatDateTimeLabel()`
- `today()`
- `canAccessFeature()`
- `getWeekWindowStart()`
- `getNextResetDate()`
- `drawImageWithOrientation()`
- `normalizeSketchScale()`, `getTitleBlockHeight()`, `buildSketchTitleBlockData()`
- `estimateBlockHeight()`
- `buildSignature()`
- `buildEmbedCode()`

Create `src/utils/icons.js`:
- `Icon` component
- `ic` object (all icon paths)
- `RoomIcon`, `RoomIconBadge`
- `KRAKENCAM_LOGO`, `KRAKENCAM_TEXT_LOGO` (base64 images)

Main file: add imports for all of the above, remove the inline definitions.

**Test:** App loads and looks identical.

---

### Phase 2 — Extract ReportCreator (Biggest Win)
**Reduces main file by ~2,500 lines immediately.**

Create `src/features/report/ReportCreator.jsx`:
- Move: `ReportCreator`, `BlockRenderer`, `ReportPages`, `PageFooter`, `ScaledReportPreview`, `SignatureDrawModal`, `BlockInsertBar`

Create `src/features/report/AiWriterModal.jsx`:
- Move: `AiWriterModal`, `AiWriterUpgradeModal`

In main file, replace with:
```jsx
const ReportCreator = React.lazy(() => import('./features/report/ReportCreator'));
```
Wrap usage in `<Suspense fallback={<div className="page">Loading report editor…</div>}>`.

**Test:** Open a report, edit blocks, AI Write, save, export PDF.

---

### Phase 3 — Extract SketchEditor & CameraPage
**Two heavy, self-contained components.**

Create `src/features/sketch/SketchEditor.jsx` (~1,270 lines, lazy loaded).
Create `src/features/camera/CameraPage.jsx` (~700 lines) + `src/features/camera/ImageEditor.jsx` (~730 lines). CameraPage lazy loaded; ImageEditor imported by CameraPage.

**Test:** Open camera, take a photo, open sketch editor, draw, save.

---

### Phase 4 — Extract Account & Settings Pages
**Both are large, rarely visited on every session.**

Create `src/features/account/AccountPage.jsx` (~1,520 lines, lazy loaded).
- Includes: `UserModal`, `BillingHistoryModal`, `UpdateCardModal`, `InviteUserButton`

Create `src/features/settings/SettingsPage.jsx` (~1,330 lines, lazy loaded).
- Includes: `AddItemInput`, `StatusListEditor`

**Test:** Navigate to Account, add/edit user, navigate to Settings, change setting, save.

---

### Phase 5 — Extract Chat, Calendar, Tasks, Map, Analytics
**All page-level, all lazy loaded.**

- `src/features/chat/ChatPanel.jsx` (includes `ChatButton`, `NewChatModal`)
- `src/features/calendar/CalendarPage.jsx` (includes `EventModal`)
- `src/features/tasks/TasksPage.jsx` (includes `TaskModal`, `ListCheckToggle`, `DatePickerInput`, `CommentInput`)
- `src/features/map/JobsiteMapPage.jsx`
- `src/features/analytics/AnalyticsDashboard.jsx`
- `src/features/templates/TemplatesPage.jsx`

**Test:** Navigate to each section and verify it loads and functions.

---

### Phase 6 — Extract Project Components
**The project tabs are the most complex due to shared `project` state passed as props, but they follow the same pattern.**

Extract project tabs (each imported directly, not lazy — they're needed the moment you open a project):
- `src/features/project/tabs/PhotosTab.jsx` (~900 lines)
- `src/features/project/tabs/ChecklistsTab.jsx` (~1,280 lines, includes all checklist components + TemplateManagerModal)
- `src/features/project/tabs/ClientPortalTab.jsx` (~740 lines)
- `src/features/project/tabs/ProjectFilesTab.jsx` (~515 lines)
- `src/features/project/tabs/VoiceNotesTab.jsx` (~280 lines)
- `src/features/project/tabs/VideosTab.jsx` (~220 lines)
- `src/features/project/tabs/SketchesTab.jsx` (~140 lines)
- `src/features/project/tabs/ReportsTab.jsx` (~270 lines, includes SendEmailModal)

Extract project-level components:
- `src/features/project/AIProjectOverview.jsx` (~160 lines)
- `src/features/project/ProjectActivityFeed.jsx` (~140 lines)
- `src/features/project/ProjectDetail.jsx` (~615 lines) — lazy loaded, imports all tabs above
- `src/features/project/ProjectModal.jsx` (~635 lines)
- `src/features/project/ProjectsList.jsx` (~217 lines)

**Test:** Open projects list, create/edit project, open each tab, take photo, run checklist, create report.

---

### Phase 7 — Cleanup & Optimization
After all phases, the main `jobsite-reporter.jsx` contains only:
- The top-level `App` component
- App-level state (projects, settings, users, tasks, etc.)
- Navigation/routing logic
- `LoginPage` (small, needed on load — not lazy)
- `NotificationBell` (small, always visible)

At this point the file is ~2,000 lines.

Final additions:
- Add `/* webpackChunkName */` hints for better chunk naming (optional, Vite handles this automatically)
- Verify bundle sizes with `vite build --analyze` equivalent

---

## Expected Improvements

| Metric | Before | After |
|---|---|---|
| Main bundle chunk | ~2.4MB | ~200KB |
| Report editor loaded upfront | Yes | No (lazy) |
| Camera loaded upfront | Yes | No (lazy) |
| Sketch editor loaded upfront | Yes | No (lazy) |
| Account/Settings loaded upfront | Yes | No (lazy) |
| File corruption risk | Entire app | 1 feature file |
| Time to interactive | Slow | Fast |

---

## What to Do About Lost Features

The AI 1-click report generator with 4 options was lost in the browser push corruption — it was never in a git commit. Once the split is done and each file is small and pushable safely, rebuild it fresh in `src/features/report/ReportCreator.jsx`. Details needed from you:
- What were the 4 options called?
- Roughly how many Krakens did each cost?
- Where did the button live (in the report toolbar/sidebar)?
