# TestFlight pre-launch audit

**Date:** Pre-relaunch audit (no code changes made).  
**Scope:** Auth, tabs, profile/avatar, highlights, courts/runs/athletes, deep links, loading/errors, config, iOS/TestFlight readiness.

---

## 1. Critical issues to fix before TestFlight

### 1.1 None identified as strictly “critical”

After review, there are **no issues that clearly cause crashes or hard blocks** on the main flows you’ve already hardened (sign-in, Home snapshot, error boundary, config check, Supabase env). The following are the closest to critical; all are **recommended** rather than “must fix before any TestFlight build.”

- **Sign-up profile check:** `app/sign-up.tsx` uses `.single()` when checking if a profile exists right after sign-up. Supabase returns `{ data: null, error }` for 0 rows (no throw), and the code uses `if (profile)` so it doesn’t crash. **Risk: low.** Making this `.maybeSingle()` is a small robustness improvement.
- **app/profile.tsx active_sport_id:** Same pattern: `.single()` for profile; code uses `currentProfile?.active_sport_id`, so null is handled. **Risk: low.** `.maybeSingle()` is still recommended for consistency.
- **Court not found:** `lib/courts-api.ts` `fetchCourtById` uses `.single()` and then `if (courtError) throw courtError`. The court detail screen catches that and shows `ErrorScreen`. So “court not found” does not crash the app. **Risk: low.** Optional improvement: use `.maybeSingle()` and return `null` instead of throwing.

**Conclusion:** No change is strictly required before TestFlight for these; addressing them is recommended for robustness and consistency.

---

## 2. Recommended improvements before TestFlight

### 2.1 Supabase `.single()` → `.maybeSingle()` where 0 rows are possible

| Location | What | Why it matters | Confidence | Safest fix |
|----------|------|-----------------|------------|------------|
| `app/sign-up.tsx` ~line 80 | `.single()` when reading profile after sign-up | If profile isn’t created yet (e.g. trigger delay), 0 rows; Supabase returns `error` and `data: null`. Code already handles null; this just avoids relying on that behavior. | Medium | Use `.maybeSingle()` and keep `if (profile)` / `else`. |
| `app/profile.tsx` ~line 270 | `.single()` when reading `active_sport_id` for save | Same: 0 rows → null; code uses `currentProfile?.active_sport_id`. | Medium | Use `.maybeSingle()`. |
| `lib/courts-api.ts` `fetchCourtById` | `.single()` for court by id | Court might be deleted or invalid id; currently we throw and caller shows ErrorScreen. | Medium | Use `.maybeSingle()`, return `null` when no row, and have caller keep existing “Court not found” / ErrorScreen behavior. |

No UI/UX or flow changes; only safer query semantics.

### 2.2 Home initial load: safety timeout

| Location | What | Why it matters | Confidence | Safest fix |
|----------|------|----------------|------------|------------|
| `app/(tabs)/index.tsx` | `hasInitialLoadCompleted` is set only when all 3 of (loadRecommendedFriends, loadRecommendedRuns, loadHighlightsPreview) finish | If one request never resolves (e.g. bad network, backend hang), the user stays on “Loading...” forever. | Medium | Add a safety timeout (e.g. 12–15s): if not `hasInitialLoadCompleted` by then, set it true anyway so Home renders with whatever data is ready; optionally show a “Some content couldn’t load” message or retry in the UI later. |

### 2.3 EAS / environment checklist (no code change)

| What | Why it matters | Action |
|------|----------------|--------|
| **EXPO_PUBLIC_SUPABASE_URL** and **EXPO_PUBLIC_SUPABASE_ANON_KEY** | If missing in EAS for the build environment used for TestFlight, `isSupabaseConfigured` is false and the app shows the config-error screen after load. | Confirm both are set (URL: **sensitive**; anon key: **secret**). |
| **Storage buckets** | Avatar upload uses `avatars`; highlights use `highlights`; court photos use `court-photos`. Missing bucket or wrong RLS causes upload to fail. | Confirm in Supabase Dashboard that `avatars`, `highlights`, and `court-photos` exist and RLS allows the intended uploads. |
| **Sentry (optional)** | Crashes and unhandled rejections are reported only if DSN is set. | For TestFlight, set `EXPO_PUBLIC_SENTRY_DSN` (and optionally auth token) in EAS so you get reports. |

### 2.4 Deep links (optional for relaunch)

| Location | What | Why it matters | Confidence | Safest fix |
|----------|------|----------------|------------|------------|
| `app/_layout.tsx` deep link handler | Only reset-password and “playrate” URLs are handled; reset-password navigates; other `playrate://` URLs are only tracked, not navigated | Notifications or links like `playrate://highlights/123` won’t open the corresponding screen. | High | For relaunch you can leave as-is. When you want in-app navigation from notifications, add routing (e.g. parse path and call `router.replace` / `router.push` to the right screen). |

---

## 3. Safe to leave for later

- **YourSnapshotCard** `.single()` usage: Component is not imported anywhere (dead code). When/if you use it, switch to `.maybeSingle()` and handle null.
- **CourtChat / DMS** `.single()` on insert: Insert + select returns one row; acceptable. Optional: use `.maybeSingle()` when fetching profile by id for consistency.
- **Highlight create / profile highlights insert** `.single()` after insert: Supabase returns the inserted row; low risk. Can stay as-is.
- **Keyboard / input:** Sign-in and forms use `KeyboardScreen`; no obvious iOS keyboard bugs found. Leave unless you see issues.
- **Headers / layouts:** Tab layout and header options are consistent; no change suggested for this audit.
- **Performance:** No obvious N+1 or heavy sync work on the main thread; no change recommended before relaunch.
- **App Store / TestFlight metadata:** Not reviewed (screenshots, description, privacy). Do your usual App Store Connect checklist separately.

---

## 4. What was verified (and is in good shape)

- **Sign-in / sign-up / session:** Config check and clear error when Supabase env is missing; auth uses `maybeSingle()` in critical paths; sign-in has try/catch and user-facing errors; session restore and `ensureProfileExists` are guarded.
- **Tab navigation:** Tabs layout wrapped in `AppErrorBoundary` with Try again and Sign out; no Rhode Island or narrow-region restrictions; Home waits for initial data with a clear loading state.
- **Profile / avatar:** `ProfilePicture` uploads to `avatars` with a clear path and handles errors; bucket doc exists. No `.single()` on profile read in the snapshot card (already fixed).
- **Highlights:** Create uses storage + insert; playback uses `expo-video` in-app; detail screens use `maybeSingle()` for highlight and profile.
- **Courts / runs / athletes:** Court detail handles missing court via catch and ErrorScreen; runs and athletes flows use safe queries and error state.
- **Loading and errors:** Loading screens and ErrorScreens are used where needed; root and tabs have error boundary; unhandled rejection handler is in place.
- **iOS:** Scheme and bundle id set; camera/photo/location usage strings present; no obvious iOS-only bugs in the paths audited.

---

## 5. Ready to relaunch on TestFlight?

**Verdict:** **Yes, you can relaunch on TestFlight with the current code**, provided:

1. **EAS environment variables** for the build environment used for TestFlight include at least **EXPO_PUBLIC_SUPABASE_URL** and **EXPO_PUBLIC_SUPABASE_ANON_KEY** (and you’ve confirmed storage buckets + RLS in Supabase).
2. You’re comfortable with the small remaining risks (e.g. Home loading forever if one of the three requests never resolves; very rare).

Fixing the **recommended** items (`.maybeSingle()` in the three places, optional Home timeout, and double-checking env/buckets) will make the build more robust and easier to support, but they are not hard blockers for a TestFlight build.

---

## 6. Top 3 things to fix first before relaunch (recommended order)

1. **Confirm EAS env and Supabase buckets**  
   Ensure production (or the profile you use for TestFlight) has `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` set, and that `avatars`, `highlights`, and `court-photos` exist with correct RLS. Prevents config-error screen and upload failures.

2. **Replace the three `.single()` usages with `.maybeSingle()`**  
   In `app/sign-up.tsx`, `app/profile.tsx`, and `lib/courts-api.ts` (`fetchCourtById`). Handle null/error as already done (or return null and let caller show ErrorScreen). Reduces risk of any future Supabase behavior change or edge case and keeps patterns consistent.

3. **Add a safety timeout for Home initial load**  
   In `app/(tabs)/index.tsx`, if `hasInitialLoadCompleted` is still false after e.g. 12–15 seconds, set it true so the user sees Home with partial data instead of staying on “Loading...” indefinitely.

---

**No code changes were made during this audit; this document is report-only.**
