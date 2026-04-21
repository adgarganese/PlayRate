# Fresh Supabase database: migration apply order

This document explains how to apply every SQL migration in `supabase/migrations/` on a **brand-new** Supabase project (empty `public` schema aside from Supabase defaults), including dependencies that **filename sort order alone** does not satisfy.

## Prerequisites (outside this folder)

1. **Supabase project** with `auth` schema and **`auth.users`**.
2. **`public.profiles`** aligned with the app: primary identifier **`user_id`** referencing `auth.users(id)` (the app queries `.eq('user_id', …)` everywhere). If you use the dashboard template, confirm the column name matches; rename or add `user_id` if needed before applying migrations that reference `profiles(user_id)`.
3. Optional: enable **PostGIS** if not already present (early migrations use `CREATE EXTENSION IF NOT EXISTS postgis`).

## Why lexicographic order is not always enough

`supabase db reset` / `supabase db push` applies files in **strict filename (timestamp) order**. That order can fail or leave gaps because:

| Issue | Details |
|-------|---------|
| **`20260228160000_highlights_views_replies.sql`** | Creates `highlight_views`, alters `highlight_comments`, and defines **`highlights_with_counts`**. It expects **`public.highlights`**, **`highlight_likes`**, and **`highlight_comments`** to already exist. On an empty DB they are only created by **`20260414120200_app_highlights_core.sql`**, which sorts **after** `20260228…` and **`20260408130000`**. |
| **`20260408130000_highlight_reposts.sql`** | Creates `highlight_reposts`, replaces **`highlights_with_counts`** with a **repost_count** version, and installs a trigger that calls **`public.create_notification(…)`**. That function is created in **`20260414120500_app_notifications.sql`**, which sorts **before** `20260408130000` in lexicographic order — so **this file can fail on a clean apply** unless `create_notification` already exists from a prior manual step. |
| **`20260408120000_profile_sports_profile_id_index.sql`** | Creates an index on **`profile_sports`**. That table is created in **`20260414120000_app_profiles_sports_and_ratings.sql`**, which sorts **after** `20260408120000` — index migration may **no-op or fail** depending on Postgres behavior when the table is missing. |

The **`20260414120900_app_highlights_with_counts_verify.sql`** migration runs **last** among current app migrations and (re)creates **`highlights_with_counts`** when all five base tables exist, fixing a missing or pre-repost view shape after the rest of the chain has been applied.

## Recommended apply strategy for a truly empty project

Use one of these approaches:

### Strategy A — Two-phase push (simplest operationally)

1. **Phase 1 — Minimal “highlights + notifications” bootstrap**  
   Copy or temporarily add a single squashed migration **with a timestamp earlier than `20260228160000`** that only contains:
   - `CREATE TABLE` statements for **`highlights`**, **`highlight_likes`**, **`highlight_comments`** (same shapes as `20260414120200`), or run `20260414120200` manually once via SQL Editor before any older migration that needs them.  
   - Optionally create **`notifications`** + **`create_notification`** before **`20260408130000`** if you need that file in phase 2.

   *Practical shortcut:* run the SQL from **`20260414120000`** → **`20260414120500`** and **`20260414120200`** once in the SQL Editor (in that dependency order: sports before court extras; notifications before `081300`), **or** temporarily rename those files to timestamps **before `20260228160000`**, run `db reset`, then rename back (only for bootstrap; keep repo history sensible for your team).

2. **Phase 2 — Full folder**  
   Run `supabase db reset` (or push all migrations) so the remainder runs in normal order. Finish with **`20260414120900`** to ensure **`highlights_with_counts`** is correct.

### Strategy B — Lexicographic only, accept one failure then repair

1. Run `supabase db reset`.
2. If it fails at **`20260228160000`** (missing `highlights`) or **`20260408130000`** (missing `create_notification`), apply the missing pieces from **`20260414120200`** / **`20260414120500`** via SQL Editor (or temporarily reorder filenames for one bootstrap run).
3. Re-run failed migrations or run **`supabase db push`** again; **`20260414120900`** will recreate **`highlights_with_counts`** when dependencies exist.

### Strategy C — Documented manual order (SQL Editor or scripted)

Apply migrations **in the dependency order below** (group labels match logical phases; file timestamps may differ).

1. **`20260215160000`** → **`20260215160009`** — profiles columns, courts, runs, participants, cosigns, rep rollups, court follows, notification prefs, PostGIS, `courts_nearby`, RLS tightening, spatial ref optional.
2. **`20260217180000`** — `check_ins`, `check_in`, `get_court_leaderboard`.
3. **`20260228120000`**, **`20260228140000`** — cosign profile / cooldown changes.
4. **`20260414120000`** — sports, `profile_sports`, `sport_profiles`, `self_ratings`, profile column backfills.
5. **`20260408120000`** — index on `profile_sports` (table now exists).
6. **`20260414120100`** — `follows`, follow RPCs.
7. **`20260414120200`** — `highlights`, `highlight_likes`, `highlight_comments` (+ conditional view if views/reposts already exist).
8. **`20260228160000`**, **`20260228170000`** — `highlight_views`, `parent_id`, `highlights_with_counts` (first version with view counts).
9. **`20260228180000`** — court photo storage RLS (bucket row then completed by **`20260414120800`**).
10. **`20260228190000`**, **`20260228200000`**, **`20260402120000`**, **`20260402140000`** — avatars, cosign attributes, staff, check-in UTC-day rule.
11. **`20260414120300`** — court extras, ratings, `court_photos`, `get_court_rating_info`.
12. **`20260414120400`** — DMs (`conversations`, `messages`, `get_or_create_conversation`).
13. **`20260414120500`** — **`notifications`**, **`create_notification`** (required **before** `20260408130000` trigger).
14. **`20260408130000`** — `highlight_reposts`, trigger `notify_on_highlight_repost`, view with **`repost_count`**.
15. **`20260408140000`** — highlight drafts table + `highlights-drafts` bucket.
16. **`20260414120600`**, **`20260414120700`**, **`20260414120800`** — court chat, `highlights` bucket, **`court-photos`** bucket.
17. **`20260414120900`** — verify / recreate **`highlights_with_counts`** (full 16-column shape).

After step 14, **`20260414120900`** is redundant unless the view was skipped in step 7; it is still safe (idempotent).

## Lexicographic list (default `supabase` sort)

For reference, filenames sort as:

`20260215160000` … `20260215160009` → `20260217180000` → `20260228120000` → `20260228140000` → `20260228160000` → … → `20260402140000` → `20260408120000` → `20260408130000` → `20260408140000` → `20260414120000` … `20260414120900`.

Note the problematic positions: **`20260408130000` runs before `20260414120000`–`20260414120500`**, and **`20260228160000` runs before `20260414120200`**.

## Quick verification queries

After everything applies:

```sql
-- View exists and exposes repost_count (and 15 other columns)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'highlights_with_counts'
ORDER BY ordinal_position;

-- Smoke: one row shape (may be empty)
SELECT * FROM public.highlights_with_counts LIMIT 1;
```

Buckets:

```sql
SELECT id, name, public FROM storage.buckets WHERE id IN ('highlights', 'court-photos', 'highlights-drafts', 'avatars');
```

## Related internal docs

- `docs/migration-checklist.md` — inventory of migrations vs app references and orphan risks.

## Outstanding verification

- **GRANT EXECUTE on rate-limited RPCs:** `20260415145000_rpc_rate_limiting.sql` uses
  `CREATE OR REPLACE FUNCTION` for `check_in`, `toggle_follow`, `get_or_create_conversation`,
  `create_notification`, and `recompute_rep`. On a fresh database, verify that `GRANT EXECUTE`
  privileges from earlier migrations (`20260414120100`, `20260414120400`, `20260414120500`) are preserved after the
  replacement. If not, add explicit `GRANT EXECUTE ON FUNCTION ... TO authenticated` statements
  after the rate-limit migration.
