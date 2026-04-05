# KrakenCam Refactor Plan
## Code Split + Photo Migration

**Goal:** Break `jobsite-reporter.jsx` (2.3MB / ~23,000 lines) into focused component
files, and simultaneously migrate photos from JSONB to the new `project_photos` table.
Doing both together avoids a messy dual-write phase — each new component file uses
the correct data source from day one.

**Estimated time:** 3–5 focused sessions
**Risk level:** Medium — large mechanical refactor, but each step is independently testable
**DB table:** `project_photos` already created in Supabase with proper RLS ✓

---

## Why now

- A 350–450KB gzipped JS bundle is manageable today but will grow as features are added
- Code splitting lets Vite lazy-load each tab — users only download code for tabs they open
- `projects.photos` JSONB gets large as photo counts grow; dedicated table + indexes = fast queries
- Doing it now with few live users means zero migration headaches

---

## Phase 1 — Extract shared utilities (Session 1, ~1 hour)

These have zero UI impact and can be extracted first to reduce the main file size.

**Files to create:**
- `src/lib/photos.js` — CRUD for `project_photos` table (replaces JSONB)
- `src/lib/reportHelpers.js` — PDF/report generation utilities
- `src/lib/cameraUtils.js` — Camera stream management helpers
- `src/constants/icons.js` — The `ic` icon paths object (large, currently inline)
- `src/constants/defaults.js` — Default templates, config objects

**photos.js API to build:**
```javascript
export async function getPhotos(projectId)           // SELECT from project_photos
export async function insertPhoto(orgId, projectId, photo)  // INSERT
export async function updatePhoto(id, changes)        // UPDATE (room, caption, tags, url)
export async function deletePhoto(id)                 // DELETE row only (storage handled separately)
```

**Vite config change needed** — enable code splitting:
```javascript
// vite.config.js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom'],
        'vendor-supabase': ['@supabase/supabase-js'],
      }
    }
  }
}
```

---

## Phase 2 — Extract tab components (Sessions 2–3, ~2–3 hours each)

Extract each tab into its own file with lazy loading. Order matters — start with
the tabs that are most self-contained.

### Extraction order:

**Session 2 (simpler tabs):**
1. `src/components/tabs/ProjectActivityFeed.jsx`
   - Reads: `project.activityLog`, `project.photos`, `project.videos`, etc.
   - Writes: `onUpdateProject({ ...project, activityLog: [...] })`
   - No DB change needed

2. `src/components/tabs/ProjectFilesTab.jsx`
   - Already uses `project_files` table ✓
   - Clean extraction

3. `src/components/tabs/VoiceNotesTab.jsx`
   - Already uses `voice_notes` table ✓
   - Clean extraction

4. `src/components/tabs/VideosTab.jsx`
   - Already uses `video_recordings` table ✓
   - Clean extraction

**Session 3 (photos migration included):**
5. `src/components/tabs/PhotosTab.jsx` ← **photo migration happens here**
   - Switch reads from `project_photos` DB table (via `getPhotos`)
   - Switch writes to `project_photos` table (via `insertPhoto`, `updatePhoto`, `deletePhoto`)
   - Handle camera save: `handleCameraSave` inserts to table after Storage upload
   - Handle file upload: `addUploadedPhotos` inserts to table after Storage upload
   - Handle image editor save: calls `updatePhoto` after re-upload
   - Remove `photos: stripPhotos(p.photos || [])` from `toDbRow` in `projects.js`
   - **Migrate existing JSONB data:** Run SQL to copy existing `projects.photos` rows into
     the new table (one-time migration script)

**Session 4 (complex tabs):**
6. `src/components/tabs/SketchesTab.jsx`
7. `src/components/tabs/ChecklistsTab.jsx`
8. `src/components/tabs/ReportsTab.jsx`
9. `src/components/tabs/ClientPortalTab.jsx`

---

## Phase 3 — Extract modal/overlay components (Session 5, ~1–2 hours)

These large inline components inflate the main file significantly:

- `src/components/ImageEditor.jsx` — full-screen photo editor
- `src/components/CameraPage.jsx` — camera capture interface
- `src/components/ReportCreator.jsx` — report builder
- `src/components/ProjectModal.jsx` — new/edit project form
- `src/components/TemplatesManager.jsx` — checklist template manager

---

## Lazy loading pattern (apply to each tab)

```javascript
// In jobsite-reporter.jsx (or future AppRouter.jsx)
const PhotosTab     = lazy(() => import('./components/tabs/PhotosTab'));
const VideosTab     = lazy(() => import('./components/tabs/VideosTab'));
const ChecklistsTab = lazy(() => import('./components/tabs/ChecklistsTab'));
// etc.

// Wrap with Suspense
<Suspense fallback={<div className="tab-loading">Loading...</div>}>
  {tab === "photos" && <PhotosTab ... />}
</Suspense>
```

---

## Photo migration SQL (run during Session 3)

After `PhotosTab.jsx` is extracting and writing to `project_photos`, run this once
to migrate any existing JSONB photos:

```sql
-- One-time migration: copy projects.photos JSONB array → project_photos table
INSERT INTO public.project_photos (
  id, organization_id, project_id, public_url, storage_path,
  name, room, date, tags, caption, created_at
)
SELECT
  COALESCE((photo->>'id')::uuid, gen_random_uuid()),
  p.organization_id,
  p.id,
  COALESCE(photo->>'dataUrl', photo->>'url', ''),
  COALESCE(photo->>'storagePath', ''),
  COALESCE(photo->>'name', ''),
  COALESCE(photo->>'room', 'General'),
  COALESCE(photo->>'date', ''),
  COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(photo->'tags')),
    '{}'::text[]
  ),
  COALESCE(photo->>'caption', ''),
  now()
FROM public.projects p,
     jsonb_array_elements(COALESCE(p.photos, '[]'::jsonb)) AS photo
WHERE p.photos IS NOT NULL AND jsonb_array_length(p.photos) > 0
ON CONFLICT (id) DO NOTHING;
```

After verifying data migrated correctly, remove `photos` from `toDbRow` in `projects.js`.

---

## Expected bundle size after refactor

| Chunk | Estimated size (gzip) |
|---|---|
| vendor-react | ~45KB |
| vendor-supabase | ~30KB |
| main app shell | ~80KB |
| PhotosTab (lazy) | ~30KB |
| ReportsTab (lazy) | ~40KB |
| ChecklistsTab (lazy) | ~35KB |
| Other tabs (lazy, each) | ~15–25KB |
| **Total initial load** | **~155KB** (vs 400KB+ today) |

That's a ~60% reduction in initial load time.

---

## Session checklist

- [ ] Session 1: Extract utilities + update vite.config.js
- [ ] Session 2: Extract Activity, Files, VoiceNotes, Videos tabs
- [ ] Session 3: Extract PhotosTab + photo migration
- [ ] Session 4: Extract Checklists, Reports, Portal tabs
- [ ] Session 5: Extract modal components (ImageEditor, CameraPage, ReportCreator)
- [ ] Post-refactor: Verify bundle sizes, test all tabs, clean up JSONB photos column
