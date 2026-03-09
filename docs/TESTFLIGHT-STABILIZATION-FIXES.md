# TestFlight stabilization – fixes applied

**Date:** 2025-02-28  
**Scope:** Five known blockers only; no unrelated UI/UX or refactors.

---

## 1. Root causes and fixes

### 1) Bottom tab bar not clickable

- **Root cause:** Tab bar container or content views were capturing touches (no explicit `pointerEvents`), so in some layouts taps on the tab bar could be swallowed by a full-height content view or stacking context.
- **Fix:**  
  - Set `pointerEvents: 'box-none'` on the tab bar container (`tabBarStyle`) so the bar doesn’t capture touches outside the buttons; buttons still receive presses.  
  - Set `pointerEvents="box-none"` on the Home screen’s root content `View` (pageBackground) so that view doesn’t block touches intended for the tab bar.  
- **Design:** Unchanged; only touchability and pointer behavior were adjusted.

### 2) Highlights opening Supabase instead of playing in-app

- **Root cause:** Highlight media URLs are Supabase storage public URLs. If the `highlights` bucket is private (or returns redirects), loading that URL in `Video`/`Image` can redirect to Supabase auth in the system browser instead of playing in-app.
- **Fix:** Resolve a **signed URL** for playback when the stored URL is a Supabase storage URL.  
  - New helper: `lib/storage-media-url.ts` → `resolveMediaUrlForPlayback(url)`. It detects Supabase storage URLs, calls `createSignedUrl(path, 3600)`, and returns the signed URL (or the original URL if not Supabase or on error).  
  - Both highlight detail screens use this for the media `uri`: `app/(tabs)/highlights/[highlightId]/index.tsx` and `app/(tabs)/profile/highlights/[highlightId].tsx`. They keep a `playbackUri` state set after loading the highlight and pass `playbackUri || highlight.media_url` to `HighlightVideo`/`Image`.  
- **Design:** Unchanged; playback stays in-app with correct URL handling.

### 3) Profile picture upload broken (avatars bucket missing)

- **Root cause:** The `avatars` storage bucket did not exist (or RLS was missing), so uploads failed with “Bucket not found” or permission errors.
- **Fix:** No app code change. Documentation and SQL were updated so you can create the bucket and policies in Supabase:  
  - **Doc:** `docs/SUPABASE-AVATARS-BUCKET.md` (clarified that the bucket must be created first, then run the SQL).  
  - **Manual steps:** Create the `avatars` bucket in the Supabase Dashboard (Storage → New bucket → name: `avatars`; public/private per your choice), then run the RLS SQL from that doc in the SQL Editor.  
- **Security:** Policies allow upload/update/delete only under `avatars/{user_id}/*` and read as documented (authenticated or public read depending on bucket visibility).

### 4) Cosigns not working

- **Root cause:**  
  - **DB:** `cosigns.run_id` was `NOT NULL` and RLS required the row to be tied to a run and both users to be run participants. Profile cosigns (no run) send `run_id: null`, so inserts failed (constraint or RLS).  
  - **UI:** `CosignButton` had an `isPending` prop for the 30-day cooldown dimming but did not use it (`pendingOpacity` was never defined), so the dimmed state never appeared.  
- **Fix:**  
  - **DB:** New migration `supabase/migrations/20260228120000_cosigns_allow_profile_cosigns.sql`: (1) `run_id` made nullable; (2) partial unique index so one profile cosign per (from_user_id, to_user_id, attribute) when `run_id IS NULL`; (3) RLS split into `cosigns_insert_run_scoped` (existing run-based rules) and `cosigns_insert_profile_scoped` (authenticated, no self, `run_id IS NULL` only).  
  - **UI:** In `components/CosignButton.tsx`, `isPending` is now destructured and `pendingOpacity = isPending ? 0.5 : 1` is applied to the animated pill so the cosign pill appears dimmer during the 30-day cooldown.  
- **Design:** Only the cooldown dim state was added; no component redesign.

### 5) Add Court screen had two titles

- **Root cause:** The Stack screen for “new” had `title: 'Add Court'` while the in-screen `Header` also showed “Add Court”, so two titles appeared (depending on layout/header visibility).
- **Fix:** In `app/(tabs)/courts/_layout.tsx`, the “new” screen options were changed to `title: ''` (and `headerShown: false` kept). Only the in-screen `Header` shows “Add Court” now.  
- **Design:** No other changes on the Add Court screen.

---

## 2. Files changed

| File | Change |
|------|--------|
| `app/(tabs)/_layout.tsx` | `tabBarStyle.pointerEvents: 'box-none'` |
| `app/(tabs)/index.tsx` | Root content `View` given `pointerEvents="box-none"` |
| `lib/storage-media-url.ts` | **New.** `resolveMediaUrlForPlayback(url)` for signed playback URLs |
| `app/(tabs)/highlights/[highlightId]/index.tsx` | Use `resolveMediaUrlForPlayback`, `playbackUri` state, pass to Video/Image |
| `app/(tabs)/profile/highlights/[highlightId].tsx` | Same as above |
| `components/CosignButton.tsx` | Use `isPending`, define `pendingOpacity`, apply to pill |
| `app/(tabs)/courts/_layout.tsx` | `name="new"` options: `title: ''` |
| `docs/SUPABASE-AVATARS-BUCKET.md` | Clarified “create bucket first”, then run SQL |
| `supabase/migrations/20260228120000_cosigns_allow_profile_cosigns.sql` | **New.** Nullable `run_id`, profile cosign unique index, RLS for run vs profile |

---

## 3. SQL, storage, and manual Supabase steps

### Avatars bucket (required for profile picture upload)

1. **Create bucket (Dashboard)**  
   - Supabase Dashboard → Storage → New bucket.  
   - Name: **`avatars`** (exact).  
   - Public or private as desired.

2. **Storage RLS (SQL Editor)**  
   - Run the full SQL block from **`docs/SUPABASE-AVATARS-BUCKET.md`** (Section B).  
   - It creates policies: upload/update/delete only under `avatars/{auth.uid()}/*`, plus SELECT (authenticated or public read as in the doc).

No app code changes were made for avatars; the app already uses the `avatars` bucket and path `avatars/{user_id}/...`.

### Cosigns (profile cosigns and rep)

1. **Run migration**  
   - In Supabase: SQL Editor → run the contents of  
     **`supabase/migrations/20260228120000_cosigns_allow_profile_cosigns.sql`**  
   - Or apply via your normal migration path (e.g. `supabase db push` or running the file in the SQL Editor).

No other manual steps required for cosigns.

---

## 4. Regression checklist (what to test)

- **Tabs:** On each tab (Home, Highlights, Courts, Athletes), tap the tab bar; each tab should switch and show the correct screen. No change to tab bar look.
- **Highlights:** Open a video and an image highlight from the feed or profile; both should play/display **in-app** (no redirect to Supabase/browser). Thumbnails and sharing unchanged.
- **Profile picture:** Profile → tap avatar → choose photo → upload; should succeed (after creating `avatars` bucket + RLS). Replace and remove avatar; display should update.
- **Cosigns:** Open another user’s profile → Cosign on a skill → submit; should succeed. After cosigning, the cosign pill for that skill should appear **dimmer** (cooldown) until the 30-day window is over. Run-based cosigns from recap unchanged.
- **Add Court:** Courts → Add Court; only **one** title “Add Court” at the top (in-screen header). Rest of form and behavior unchanged.
- **Auth, navigation, other screens:** Sign-in, sign-up, navigation to courts/athletes/highlights, and other flows unchanged; no intentional changes.

---

## 5. Confirmation

- Only the five issues above and what’s directly required to fix them were changed.  
- No unrelated refactors, no renaming of files/components, no changes to unrelated screens or to the overall design language.  
- Fixes are minimal and aimed at TestFlight/production readiness.
