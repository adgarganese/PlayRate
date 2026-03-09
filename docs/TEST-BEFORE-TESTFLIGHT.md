# How to test before TestFlight

Run these checks locally (Expo Go or dev build) so you’re confident before uploading to TestFlight.

---

## Prerequisites

1. **Supabase**
   - Apply migration: run `supabase/migrations/20260228120000_cosigns_allow_profile_cosigns.sql` in Supabase SQL Editor (or `supabase db push`).
   - Create `avatars` bucket and RLS: follow `docs/SUPABASE-AVATARS-BUCKET.md` (Storage → New bucket `avatars`, then run the policy SQL).

2. **Run the app**
   - `npx expo start` then press `i` for iOS simulator, or scan QR with Expo Go / dev client on a device.
   - Or use a dev build: `eas build --profile development --platform ios` (or your dev profile), install, then run with that build.

---

## 1. Tab bar

- **Goal:** Every tab is tappable and switches correctly.
- **Steps:**
  1. Sign in and land on Home.
  2. Tap **Highlights** → feed should show.
  3. Tap **Courts** → courts list.
  4. Tap **Athletes** → athletes.
  5. Tap **Home** → back to home.
- **Pass:** Each tap switches to the right tab; no “stuck” or unresponsive tab bar.

---

## 2. Highlights play in-app

- **Goal:** Video/image highlights play or display inside the app; no redirect to Supabase or browser.
- **Steps:**
  1. Go to **Highlights** tab.
  2. Tap a **video** highlight → it should play in the same screen with native controls (no Safari/browser).
  3. Go back, tap an **image** highlight → image loads in-app.
  4. From **Profile → My Highlights** (or a profile’s highlights), open a highlight → same in-app behavior.
- **Pass:** All media loads in the app; no external browser or “redirect” screen.

---

## 3. Profile picture (avatars)

- **Goal:** Upload, replace, and display work; no “bucket not found.”
- **Steps:**
  1. Go to **Profile** (your profile).
  2. Tap your avatar (or placeholder) → choose **photo from library** (or take photo if allowed).
  3. Confirm upload succeeds (avatar updates).
  4. Tap avatar again → choose a different photo (replace).
  5. Optional: remove photo if you have that flow.
- **Pass:** Upload and replace work; avatar shows everywhere it’s used. If bucket/RLS aren’t set up, you’ll see a clear bucket/error message instead of a silent fail.

---

## 4. Cosigns

- **Goal:** Profile cosign works; after cosigning, the pill is dimmer (cooldown) and state is correct.
- **Steps:**
  1. Sign in, go to **Athletes** and open **another user’s profile** (not your own).
  2. Find a skill row with a **Cosign** button (not already cosigned).
  3. Tap **Cosign** → add optional note → confirm.
  4. **Pass (a):** Success; no “invalid” or “run_id” error; cosign count updates.
  5. **Pass (b):** That skill’s pill now shows **Cosigned** and looks **dimmer** (e.g. ~50% opacity) for the 30-day cooldown.
- **Pass:** Cosign from profile succeeds and cooldown state is visible; run recap cosigns still work if you use them.

---

## 5. Add Court – single title

- **Goal:** Only one “Add Court” title at the top.
- **Steps:**
  1. Go to **Courts** tab.
  2. Open “Add Court” (or equivalent entry).
  3. Look at the top of the screen.
- **Pass:** One “Add Court” title (the in-screen header); no duplicate title above it.

---

## Quick checklist (copy-paste)

- [ ] Tabs: Home / Highlights / Courts / Athletes all tappable and switch correctly
- [ ] Highlights: Video and image play/display in-app (no browser)
- [ ] Profile picture: Upload and replace work (avatars bucket + RLS done)
- [ ] Cosigns: Cosign from another user’s profile succeeds; pill dims for cooldown
- [ ] Add Court: Only one “Add Court” title at top

---

## If something fails

- **Tabs:** Confirm you’re on the latest build that includes `pointerEvents` and `box-none` on Home; try a different tab order.
- **Highlights:** If “Highlight not found” appears for a known-good highlight, check network; we now fall back to the stored URL if signed URL fails. Ensure `highlights` bucket exists and RLS allows read (or use signed URLs).
- **Avatar:** “Bucket not found” → create `avatars` and run RLS SQL from `SUPABASE-AVATARS-BUCKET.md`.
- **Cosign:** “run_id” or “profile not supported” → run migration `20260228120000_cosigns_allow_profile_cosigns.sql`. Dim state → confirm CosignButton receives `isCosignPending` from athlete profile.
- **Add Court title:** If you still see two titles, confirm `app/(tabs)/courts/_layout.tsx` has `title: ''` and `headerShown: false` for the `new` screen.

Once this checklist passes, you’re in good shape to create and submit your next TestFlight build.
