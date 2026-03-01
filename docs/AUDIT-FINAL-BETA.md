# Final audit – beta readiness (read-only)

**Date:** As of latest changes. **Scope:** All areas touched today (migrations, RLS, Home Recommended Runs, Run detail, Recap, PostHog, lib split, smoke test, dev logging).  
**Rule:** No UI/UX/code/SQL changes; report only. Recommend fixes and ask before applying.

---

## AUDIT SUMMARY

### ✅ Confirmed OK

- **Migrations:** 000 = profiles + courts (single `CREATE TABLE IF NOT EXISTS courts`) + runs + run_participants; 001 = cosigns (with constraints) + rep_rollups + court_follows + notification_prefs; 002 = recompute_rep + trigger on cosigns INSERT only; 003 = RLS on all new tables; 006 = PostGIS + courts ALTER only (location_geom, indexes, RPC). No `ALTER EXTENSION postgis SET SCHEMA` anywhere.
- **PostGIS:** `CREATE EXTENSION IF NOT EXISTS postgis` in 000 and 006; no schema move.
- **Courts schema:** Only one `CREATE TABLE courts` (in 000); 006 only ALTERs/adds columns and indexes.
- **Cosigns constraints:** `cosigns_no_self` (from_user_id != to_user_id), `cosigns_unique_per_run_attribute` UNIQUE(from_user_id, to_user_id, run_id, attribute), note `CHECK (char_length(note) <= 140)`.
- **recompute_rep + trigger:** Trigger is AFTER INSERT ON cosigns only; no UPDATE/DELETE so no recursion. Level thresholds 0,5,15,30,50,80 (levels 1–6). Upserts rep_rollups and updates profiles.rep_level.
- **Smoke test:** Single DO $$ block; uses existing profiles; creates court → run → run_participants → cosign; verifies rep_rollups; cleans up only created rows (cosigns, run_participants, runs, courts). No placeholders.
- **RLS:** Enabled on courts, runs, run_participants, cosigns, rep_rollups, court_follows, notification_prefs. Policies: runs public read / creator write; run_participants public read / own row write; cosigns SELECT for sender/recipient, INSERT with run ended + both participants, no UPDATE/DELETE; rep_rollups SELECT only; court_follows and notification_prefs own-row only. No heavy geo in RLS.
- **Home Recommended Runs:** Title "Recommended Runs", subtitle "Top courts for your next run"; tap goes to `/courts/${rec.id}` (court detail). Placeholder time/spots handled via RunListItem (startTime/spotsLeft optional).
- **Run detail:** Single-wave load (fetchRunById + participant/prefs); reminders card only when `user && isParticipant`; notification_prefs use atomic upsert (`onConflict: 'user_id'`), single-field updates.
- **Recap:** Eligibility (run ended/completed + participant); MAX_COSIGNS = 3 enforced; duplicate cosign returns 23505 → friendly error; isMountedRef guards setState after unmount; fetchRepRollups only when user?.id, no crash when logged out.
- **PostHog:** Init once via provider; missing-key warning once in __DEV__; identify/reset on user id change; track/trackOnce use shouldCapture (no double fire in prod); no sensitive props in events.
- **lib/courts split:** Barrel `lib/courts.ts` re-exports courts-api, courts-recommendations, court-follows; home imports from `@/lib/courts`; no duplicate exports.
- **Expo-router:** Route paths used in audit (e.g. `/courts/${rec.id}`, `/(tabs)/courts/run/${run.id}`) match file-based layout.

### ⚠️ Potential issues

**Critical**

1. **TypeScript / parse errors (build broken)**  
   - `app/(tabs)/courts/[courtId].tsx(899,7): error TS1005: ')' expected.`  
   - `app/(tabs)/profile/account.tsx(102,38): error TS1005: ':' expected.`  
   → TypeScript and ESLint both report parsing errors here. Build/typecheck will fail until resolved.

**High**

2. **Table name mismatch: court_follows vs followed_courts**  
   - Migration 001 creates **court_follows**; RLS in 003 is on **court_follows**.  
   - **App/layer:** `lib/court-follows.ts`, `app/(tabs)/courts/[courtId].tsx`, `app/profile.tsx` use **followed_courts**.  
   - `lib/runs.ts` uses **court_follows** for follow check in fetchUpcomingRuns.  
   → If the app is supposed to use the migrated schema, follow reads/writes should target **court_follows** and RLS is correct. If the app intentionally uses a legacy **followed_courts** table, that table must exist and have RLS (e.g. from setup-database.sql or fix-followed-courts-rls.sql). Confirm which table is canonical and that the app and migrations align.

3. **Console logs not gated in app (beta noise)**  
   - `app/(tabs)/profile/highlights/index.tsx` line 181: `console.error('Highlight post error:', err)` — not __DEV__ gated.  
   - `app/athletes/[userId]/index.tsx`: multiple `console.error` (lines 112, 122, 153, 207, 216, 247, 259, 310) — not gated.  
   - `app/(tabs)/highlights/[highlightId]/comments.tsx` lines 72, 96: `console.error` — not gated.  
   - `app/(tabs)/courts/find.tsx` lines 53, 87, 130: `console.error` — not gated.  
   - `app/chat/[conversationId].tsx` line 127: `console.error('Load messages:', e)` — not gated.  
   - `app/(tabs)/courts/new.tsx` line 190: `console.warn('Geocoding failed...')` — not gated.  
   → In production/beta builds these will still log; recommend wrapping in `if (__DEV__)` or using `logDevError`.

**Medium**

4. **Lint: unescaped entities (and one import)**  
   - `app/(tabs)/index.tsx` line 292: "You're set for today." — `'` triggers react/no-unescaped-entities (escape e.g. `You&apos;re` or use `{"You're set for today."}`).  
   - `app/runs/[id]/recap.tsx` line 209: "You're done for today." — same.  
   - `app/(tabs)/profile/highlights/index.tsx` line 135: `FileSystem.EncodingType` — lint reports `'EncodingType' not found in imported namespace 'FileSystem'` (expo-file-system API/typing); may need different encoding constant or type.

5. **Lint: unused variable**  
   - `app/(tabs)/courts/run/[runId].tsx` line 126: catch `(e)` unused — use `_e` or omit.

6. **notification_prefs upsert when row missing**  
   - App uses `upsert(payload, { onConflict: 'user_id' })`; RLS allows INSERT with user_id = auth.uid(). First-time toggle will insert; policy is correct. No race issue identified.

**Low**

7. **lib/courts-api.ts: two console.warn without __DEV__**  
   - Lines 100 and 282 (court sports error, profiles error) are inside `if (courtSportsError)` / `if (profilesError)` but the grep showed 100 as `console.warn('[fetchCourts] court sports', courtSportsError)` — if that block is `if (courtSportsError && __DEV__)` then it’s gated; 282 similarly.  
   - Line 368 in fetchCourtsNearLocation: `if (courtSportsError && __DEV__)` — gated.  
   → If any of these are not behind __DEV__, gate them for beta.

8. **lib/geocoding.ts**  
   - Lines 21, 36, 39: console.warn/error not __DEV__ gated — minor for beta if geocoding is used.

9. **lib/highlights.ts line 99**  
   - `console.log('[HighlightsFeed] query result:', ...)` is inside `if (__DEV__)` block — OK.

10. **Remaining lint warnings**  
    - react-hooks/exhaustive-deps and @typescript-eslint/no-unused-vars in several files (profile, athletes, highlights, CosignButton, etc.). Not blocking but can be cleaned up later.

---

## EVIDENCE

### Commands run and results

- **TypeScript:** `npx tsc --noEmit`  
  - Exit code 1.  
  - `app/(tabs)/courts/[courtId].tsx(899,7): error TS1005: ')' expected.`  
  - `app/(tabs)/profile/account.tsx(102,38): error TS1005: ':' expected.`

- **Lint:** `npx expo lint`  
  - 29 problems (5 errors, 24 warnings).  
  - Errors: [courtId].tsx 899 parsing; account.tsx 102 parsing; index.tsx 292 unescaped entity; profile/highlights/index.tsx 135 EncodingType; recap.tsx 209 unescaped entity.  
  - Warnings: unused vars, exhaustive-deps, etc. (see above).

- **Migrations:** Read in order 000 → 001 → 002 → 003 → 006.  
  - No `ALTER EXTENSION postgis SET SCHEMA`.  
  - Single `CREATE TABLE courts` in 000; 006 ALTER only.  
  - Cosigns constraints and trigger behavior as summarized.

- **RLS:** Read 003 in full; policies and table list checked against app flows.

- **Smoke test:** Read `supabase/smoke-test-runs-cosign.sql`; single DO $$ block, cleanup only created data.

- **App:** Grep and read for Recommended Runs, Run detail, Recap, PostHog, courts barrel, console usage, court_follows vs followed_courts.

### File paths / line refs for issues

| Issue | File | Line(s) |
|-------|------|--------|
| TS ') expected' | app/(tabs)/courts/[courtId].tsx | 899 |
| TS ': expected' | app/(tabs)/profile/account.tsx | 102 |
| Unescaped entity | app/(tabs)/index.tsx | 292 |
| Unescaped entity | app/runs/[id]/recap.tsx | 209 |
| EncodingType / import | app/(tabs)/profile/highlights/index.tsx | 135 |
| console.error not gated | app/(tabs)/profile/highlights/index.tsx | 181 |
| console.error not gated | app/athletes/[userId]/index.tsx | 112, 122, 153, 207, 216, 247, 259, 310 |
| console.error not gated | app/(tabs)/highlights/[highlightId]/comments.tsx | 72, 96 |
| console.error not gated | app/(tabs)/courts/find.tsx | 53, 87, 130 |
| console.error not gated | app/chat/[conversationId].tsx | 127 |
| console.warn not gated | app/(tabs)/courts/new.tsx | 190 |
| Unused catch var | app/(tabs)/courts/run/[runId].tsx | 126 |
| court_follows vs followed_courts | lib/court-follows.ts, lib/runs.ts, app/(tabs)/courts/[courtId].tsx, app/profile.tsx | various |

---

## RECOMMENDED FIXES

1. **TS/parse at [courtId].tsx:899**  
   - **What:** Parser expects `)` at start of line 899 (Photos Modal comment).  
   - **Why:** Suggests the `{!BETA_HIDE_LEADERBOARD && (` block (845–897) is not closed with `)` before the next sibling.  
   - **Fix:** Ensure line 897 is exactly `)}` (close conditional), and that there are no extra/missing braces in the Leaderboard Modal block. If the Photos Modal is intended to be inside the same fragment as the Leaderboard conditional, ensure the fragment is correctly closed.

2. **TS/parse at account.tsx:102**  
   - **What:** Parser expects `:` at 102:38.  
   - **Why:** Could be a stray character, encoding, or JSX/expression boundary issue.  
   - **Fix:** Inspect line 102 (`{ opacity: pressed ? 0.7 },`) for non-ASCII or wrong quote; ensure the style array and Pressable are well-formed. If the linter also complains about `&` on line 108 ("app & device info"), escape as `&amp;` or use `{'app & device info'}`.

3. **court_follows vs followed_courts**  
   - **What:** Migrations and RLS use **court_follows**; most app code uses **followed_courts**.  
   - **Why:** Either the app is on an old table name or migrations introduced a second table.  
   - **Fix (choose one):**  
     - If **court_follows** is canonical: change `lib/court-follows.ts` and all app references from `followed_courts` to `court_follows`, and ensure DB has no duplicate semantics.  
     - If **followed_courts** is canonical: ensure it exists (e.g. setup-database.sql or a migration), has RLS, and that migration 001/003 either rename to court_follows or you keep using followed_courts and add RLS for it. Document which table is used in production.

4. **Console logs (beta)**  
   - **What:** Several app files log to console without __DEV__.  
   - **Why:** Reduces noise and avoids leaking info in beta/prod.  
   - **Fix:** Wrap each listed console.error/warn in `if (__DEV__) { ... }` or replace with `logDevError(scope, err)`.

5. **Unescaped entities**  
   - **What:** "You're" in index and recap triggers react/no-unescaped-entities.  
   - **Why:** Lint rule.  
   - **Fix:** Use `You&apos;re` or `{"You're set for today."}` (and same for recap "You're done for today.").

6. **EncodingType**  
   - **What:** Lint says `EncodingType` not in `FileSystem` namespace.  
   - **Why:** expo-file-system types or API may use a different export.  
   - **Fix:** Use the encoding value that expo-file-system expects (e.g. `'base64'` string or the correct enum from the version you use) and fix the import/type if needed.

7. **Unused catch variable run/[runId].tsx**  
   - **What:** `catch (e)` — e unused.  
   - **Fix:** `catch (_e)` or `catch`.

---

**No changes have been applied.** Please confirm which fixes you want (especially Critical/High), and I can apply only those after your approval.
