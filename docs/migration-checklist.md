# Supabase migration audit checklist

Generated from a full read of `supabase/migrations/*.sql` and a scan of `lib/`, `app/`, `components/`, `hooks/`, and `contexts/` for `.from('…')`, `.rpc('…')`, and `storage.from('…')`.

**Scope:** Audit only — no migration or app source files were modified for this document.

---

## Recommended apply order

Apply **all** files below **in filename (timestamp) order** on a database that already has Supabase’s default **`auth`** schema and a **`public.profiles`** table (typical Supabase starter / dashboard schema).

**Before or alongside migrations:**

1. **`public.profiles`** and related domain tables that this repo **does not** create (see [Missing migrations](#app-database-objects-with-no-migration-in-supabasemigrations)) must exist, or several migrations will fail when they `REFERENCES` or `SELECT` them.
2. **Storage bucket `court-photos`:** `20260228180000_court_photos_storage_rls.sql` only adds RLS policies; comments say to create the bucket in the Dashboard first (or create it via SQL elsewhere).
3. **`20260408130000_highlight_reposts.sql`** installs a trigger that calls **`public.create_notification(...)`**. If that function does not exist, this migration **fails at trigger creation**. Add or apply the function (and any `notifications` table shape it expects) before or as part of your baseline.

**Optional / environment-specific:**

- **`20260215160009_spatial_ref_sys_rls.sql`** is a no-op if `spatial_ref_sys` is not in `public` (e.g. after PostGIS moved to `extensions`).

---

## Every migration (timestamp order)

| # | Filename | One-line summary | Tables / functions / views / buckets touched |
|---|----------|------------------|-----------------------------------------------|
| 1 | `20260215160000_profiles_courts_runs.sql` | Adds rep columns on `profiles`; ensures PostGIS + `courts` baseline; creates `runs` + `run_participants` + indexes | `profiles` (ALTER), `courts` (CREATE IF NOT EXISTS + ALTER), `runs`, `run_participants`, extension `postgis` |
| 2 | `20260215160001_cosigns_rep_rollups_follows_prefs.sql` | Drops/recreates `cosigns` (run-scoped); creates `rep_rollups`, `court_follows`, `notification_prefs` | `cosigns`, `rep_rollups`, `court_follows`, `notification_prefs` |
| 3 | `20260215160002_recompute_rep_trigger.sql` | Defines `recompute_rep(uuid)`, trigger fn, AFTER INSERT trigger on `cosigns` | Functions `recompute_rep`, `cosigns_recompute_rep_trigger_fn`; trigger on `cosigns` |
| 4 | `20260215160003_rls_new_tables.sql` | RLS + policies for `courts`, `runs`, `run_participants`, `cosigns`, `rep_rollups`, `court_follows`, `notification_prefs` | Same tables (policies only) |
| 5 | `20260215160006_postgis_courts_location.sql` | Court geometry column `location_geom`, indexes, **`courts_nearby`** RPC, broad courts UPDATE/DELETE RLS | `courts`, `pgcrypto`, `postgis`, function `courts_nearby`, `storage` n/a |
| 6 | `20260215160007_move_postgis_to_extensions.sql` | Moves PostGIS/pgcrypto to `extensions` schema; **recreates `courts_nearby`** with `search_path` fix | Schemas `extensions`, functions `courts_nearby` |
| 7 | `20260215160008_courts_update_rls_restrict.sql` | Tightens `courts` INSERT/UPDATE/DELETE to creator (`created_by = auth.uid()`) | `courts` policies |
| 8 | `20260215160009_spatial_ref_sys_rls.sql` | RLS on `public.spatial_ref_sys` if that table exists | `spatial_ref_sys` (conditional) |
| 9 | `20260217180000_check_ins.sql` | Creates `check_ins`, RLS, RPCs **`check_in`**, **`get_court_leaderboard`** | `check_ins`, functions `check_in`, `get_court_leaderboard` |
| 10 | `20260228120000_cosigns_allow_profile_cosigns.sql` | `run_id` nullable; unique partial index; splits cosign INSERT policies (run vs profile) | `cosigns` (ALTER, indexes, policies) |
| 11 | `20260228140000_cosigns_30day_cooldown.sql` | Drops profile unique index; 30-day cooldown in profile cosign RLS | `cosigns` (index, policy) |
| 12 | `20260228160000_highlights_views_replies.sql` | **`highlight_views`** table + RLS; **`parent_id`** on `highlight_comments`; **`highlights_with_counts`** view (likes, comments, views) | `highlight_views`, `highlight_comments`, view `highlights_with_counts` (requires `highlights`, `highlight_likes`, `highlight_comments`) |
| 13 | `20260228170000_highlight_views_dedup.sql` | `user_id` on `highlight_views`; index; stricter INSERT RLS | `highlight_views` |
| 14 | `20260228180000_court_photos_storage_rls.sql` | Storage RLS on bucket **`court-photos`**; conditional RLS on **`court_photos`** if table exists | `storage.objects`, `court_photos` |
| 15 | `20260228190000_avatars_bucket_and_rls.sql` | Inserts **`avatars`** bucket; storage RLS; **`profiles.avatar_url`** column | `storage.buckets`, `storage.objects`, `profiles` |
| 16 | `20260228200000_cosigns_add_four_attributes.sql` | Widens `cosigns.attribute` CHECK constraint | `cosigns` |
| 17 | `20260402120000_court_staff_and_edit_suggestions.sql` | **`profiles.is_staff`**, **`auth_is_staff()`**, staff court policies, **`court_edit_suggestions`** + RLS | `profiles`, `courts`, `court_edit_suggestions`, function `auth_is_staff` |
| 18 | `20260402140000_check_in_duplicate_utc_day.sql` | Dedupes legacy `check_ins`; unique index per user/court/UTC day; **replaces `check_in`** RPC | `check_ins`, function `check_in` |
| 19 | `20260408120000_profile_sports_profile_id_index.sql` | Index **`idx_profile_sports_profile_id`** | `profile_sports` |
| 20 | `20260408130000_highlight_reposts.sql` | **`highlight_reposts`** + RLS; **replaces `highlights_with_counts`** (+ repost_count); trigger **`notify_on_highlight_repost`** → **`create_notification`** | `highlight_reposts`, view `highlights_with_counts`, functions/triggers on `highlight_reposts` |
| 21 | `20260408140000_highlight_drafts.sql` | **`highlight_drafts`** + RLS; bucket **`highlights-drafts`** + storage policies | `highlight_drafts`, `storage.buckets`, `storage.objects` |

---

## Status column (per file)

| Filename | Status | Notes |
|----------|--------|--------|
| `20260215160000_profiles_courts_runs.sql` | **required** | Foundation for courts/runs; assumes `profiles` pre-exists |
| `20260215160001_cosigns_rep_rollups_follows_prefs.sql` | **required** | Requires `profiles`, `runs`, `courts` from prior file |
| `20260215160002_recompute_rep_trigger.sql` | **required** | Requires `cosigns`, `rep_rollups`, `profiles` |
| `20260215160003_rls_new_tables.sql` | **required** | Same |
| `20260215160006_postgis_courts_location.sql` | **required** | Expects `courts`; adds `courts_nearby` |
| `20260215160007_move_postgis_to_extensions.sql` | **required** | Supersedes `courts_nearby` definition from #5 for PostGIS-in-extensions |
| `20260215160008_courts_update_rls_restrict.sql` | **required** | Replaces permissive court mutator policies from #5 |
| `20260215160009_spatial_ref_sys_rls.sql` | **required** (safe no-op if table missing) | **obsolete / skip** only if you’ve confirmed `spatial_ref_sys` is never in `public` |
| `20260217180000_check_ins.sql` | **required** | Creates `check_in` (later replaced by #18) |
| `20260228120000_cosigns_allow_profile_cosigns.sql` | **required** | |
| `20260228140000_cosigns_30day_cooldown.sql` | **required** | |
| `20260228160000_highlights_views_replies.sql` | **required** *if* base highlight tables exist | **missing prerequisite** on empty DB: needs `highlights`, `highlight_likes`, `highlight_comments` |
| `20260228170000_highlight_views_dedup.sql` | **required** | Needs #12 |
| `20260228180000_court_photos_storage_rls.sql` | **required** | Bucket + table may be external to this folder |
| `20260228190000_avatars_bucket_and_rls.sql` | **required** | |
| `20260228200000_cosigns_add_four_attributes.sql` | **required** | |
| `20260402120000_court_staff_and_edit_suggestions.sql` | **required** | |
| `20260402140000_check_in_duplicate_utc_day.sql` | **required** | **Replaces** `check_in` from #9 — keep both in order; do not apply only #18 on empty DB without #9’s table |
| `20260408120000_profile_sports_profile_id_index.sql` | **required** | **missing prerequisite** if `profile_sports` missing |
| `20260408130000_highlight_reposts.sql` | **required** | **missing prerequisite:** `create_notification`; needs `highlights` + prior view pieces |
| `20260408140000_highlight_drafts.sql` | **required** | |

---

## Duplicates and superseded definitions

| What | Files | Verdict |
|------|-------|---------|
| **`check_in` RPC** | #9 creates; #18 **CREATE OR REPLACE** | **Keep both in order.** #18 is the authoritative behavior (UTC-day dedupe). Not safe to delete #9 from history without also inlining table + first function revision into a squashed migration. |
| **`courts_nearby` RPC** | #5 creates; #7 **replaces** | **Keep both in order.** #7 fixes `search_path` after PostGIS move. |
| **`highlights_with_counts` view** | #12 creates; #20 **CREATE OR REPLACE** (adds `repost_count`) | **Keep both in order.** #20 supersedes the view shape; squashing would merge into one migration. |
| **`courts` RLS (mutating)** | #4 (insert), #5 (adds update/delete open), #8 (creator-only) | **Intentional progression** — not duplicate mistakes; final behavior is #8 for INSERT/UPDATE/DELETE. |
| **Cosign profile uniqueness** | #10 adds partial unique index; #11 **drops** it | **Intentional** — cooldown enforced in RLS instead. |

No two migrations **independently create the same table** without `IF NOT EXISTS` / drop-recreate patterns that are ordered on purpose (`cosigns` is explicitly dropped in #2 only once at history start).

---

## Orphaned / fragile references (review before applying)

| Migration | Issue |
|-----------|--------|
| **`20260228160000` / `20260228170000` / `20260408130000`** | Reference **`highlights`**, **`highlight_likes`**, **`highlight_comments`** (and `highlight_views` after #12). None of these base tables are created in `supabase/migrations/`. Fresh apply on DB without them **fails**. |
| **`20260408120000_profile_sports_profile_id_index.sql`** | References **`profile_sports(profile_id)`**; table not created in this folder. |
| **`20260408130000_highlight_reposts.sql`** | Trigger calls **`public.create_notification`**. Not defined in any file under `supabase/migrations/`. **Fails** unless defined elsewhere. |
| **`20260228180000_court_photos_storage_rls.sql`** | Assumes **`court_photos`** table may exist; comments point to external **`court-photos-migration.sql`**. Bucket creation may be manual. |
| **`20260215160009_spatial_ref_sys_rls.sql`** | If PostGIS moved `spatial_ref_sys` out of `public`, this block never runs — harmless. |

**Legacy SQL outside `supabase/migrations/` (not applied by `supabase db push` by default):**

- `court-ratings-migration.sql` — includes `court_ratings`, **`get_court_rating_info`**, **`court_rating_stats`** view (matches `lib/courts-api.ts` / `lib/courts-recommendations.ts`).
- `check-in-migration.sql` — alternate / older check-in DDL (risk of overlap with #9 + #18 if both applied blindly).

---

## Ordering dependency issues (must run after prerequisites)

| Earlier file | Depends on (not from earlier migrations in folder) |
|--------------|------------------------------------------------------|
| `20260215160000` | `profiles` table (typical Supabase template) |
| `20260215160001` | `profiles`, `courts`, `runs` |
| `20260217180000` | `courts`, `profiles` |
| `20260228160000` | **`highlights`**, **`highlight_likes`**, **`highlight_comments`** |
| `20260408120000` | **`profile_sports`** |
| `20260408130000` | Everything for highlights view + **`create_notification`** |
| `20260408140000` | `auth.users` (standard) |

There is **no** case where an **earlier** timestamp file references an object **only** introduced in a **later** file **within this repo**, except the intentional **`check_in`** replacement chain (#9 → #18) and **`highlights_with_counts`** (#12 → #20).

---

## App database objects with no migration in `supabase/migrations/`

The app references the following **tables/views** in `lib/`, `app/`, `components/`, `hooks/`, or `contexts/` with **no `CREATE` / `CREATE VIEW`** in `supabase/migrations/`:

| Object | Used for (examples) | Migration gap |
|--------|---------------------|---------------|
| **`profiles`** (base table) | Auth, snapshots, DM, highlights | Assumed Supabase starter; only **ALTER**s in folder |
| **`sports`** | Court create, self-ratings, my-sports | No migration |
| **`sport_profiles`** | Profile, athletes, home snapshot | No migration |
| **`profile_sports`** | Athletes list, profiles, self-ratings | Index only in #19 |
| **`sport_attributes`** | Self-ratings UI | No migration |
| **`self_ratings`** | Ratings flows, profile counts | No migration |
| **`follows`** | Home, athletes, DMs, hooks | No migration |
| **`highlights`** | Feed, create, profile | No migration |
| **`highlight_likes`** | Likes, activity, detail screens | No migration |
| **`highlight_comments`** | Comments, activity | No migration |
| **`court_sports`** | Courts CRUD, API | No migration |
| **`court_comments`** | Courts, recommendations | No migration |
| **`court_ratings`** | `submitCourtRating` / delete | No migration |
| **`court_photos`** | Photos carousel, API | RLS only in #14 |
| **`court_rating_stats`** | `courts-recommendations.ts` | See **`court-ratings-migration.sql`** (repo root), not in migrations |
| **`court_chat_messages`** | Court chat | No migration |
| **`conversations`**, **`conversation_participants`**, **`messages`** | DMs | No migration |
| **`notifications`** | Inbox | No migration |

**RPCs used by app, not in `supabase/migrations/`:**

| RPC | Call sites |
|-----|------------|
| **`get_court_rating_info`** | `lib/courts-api.ts` |
| **`get_follow_counts`**, **`toggle_follow`** | `hooks/useFollow.ts` |
| **`get_or_create_conversation`** | `lib/dms.ts` |
| **`create_notification`** | Invoked from trigger in #20 (must exist in DB) |

**Storage buckets used by app, not fully covered in migrations:**

| Bucket | In migrations? | Notes |
|--------|----------------|--------|
| **`avatars`** | Yes (#15) | |
| **`court-photos`** | Policies only (#14) | Create bucket in Dashboard / SQL |
| **`highlights-drafts`** | Yes (#21) | |
| **`highlights`** (published media) | **No** | `lib/highlight-drafts.ts` / create flow uses **`highlights`** bucket; **add bucket + RLS migration** or create manually |

---

## Suggested SQL / DDL for missing pieces (outline only)

Use app types and queries as the source of truth when writing real migrations. Below is **not** executable as-is; it lists what a migration would need to cover.

### Core social / profile (if not from Supabase template)

- **`profiles`**: align with `auth.users`, columns used in app (`name`, `username`, `bio`, `avatar_url`, `active_sport_id`, `play_style`, `cosign_count`, `rep_level`, `rep_points`, `is_staff`, …).
- **`follows`**: at minimum `follower_id`, `following_id` (or names matching app queries), RLS for insert/delete/select as required.
- **`sports`**, **`profile_sports`**, **`sport_profiles`**, **`sport_attributes`**, **`self_ratings`**: match `app/self-ratings.tsx`, `app/my-sports.tsx`, `app/athletes/[userId]/index.tsx`, `components/PlayRateSnapshotCard.tsx`.

### Highlights core

- **`highlights`**: columns matching `lib/highlights.ts`, `highlight-drafts` publish path (`user_id`, `sport`, `media_type`, `media_url`, `thumbnail_url`, `caption`, `location_*`, `is_public`, …), RLS for owner vs feed read.
- **`highlight_likes`**, **`highlight_comments`**: FK to `highlights`, RLS; comments need **`parent_id`** (added in #12 if table pre-exists).

### Courts extras

- **`court_sports`**, **`court_comments`**, **`court_ratings`**, **`court_photos`** (table definition), **`court_rating_stats`** view, **`get_court_rating_info`**: follow `court-ratings-migration.sql` and `lib/courts-api.ts` as reference.

### Messaging

- **`conversations`**, **`conversation_participants`**, **`messages`**, **`get_or_create_conversation`**: match `lib/dms.ts` (participant checks, message body, etc.).

### Notifications

- **`notifications`** table + **`create_notification(...)`** signature expected by `20260408130000_highlight_reposts.sql` trigger (parameters: recipient, actor, type, entity, id, title, body, … per `PERFORM public.create_notification(...)` in that file).
- Align with `lib/notifications.ts` (list, mark read).

### Storage: **`highlights`** (published)

- Create bucket (likely **public** or signed-URL flow per `resolveMediaUrlForPlayback`).
- RLS: authenticated upload to own prefix; read rules consistent with `HIGHLIGHTS_PUBLISH_BUCKET = 'highlights'` in `lib/highlight-drafts.ts` and `app/(tabs)/highlights/create.tsx` upload path.

---

## Quick reference: RPCs defined in migrations

| RPC | Defined in |
|-----|------------|
| `courts_nearby` | #5, replaced #6 |
| `check_in` | #9, replaced #18 |
| `get_court_leaderboard` | #9 |

---

## Quick reference: views defined in migrations

| View | Defined in |
|------|------------|
| `highlights_with_counts` | #12, replaced #20 |

---

*End of checklist.*
