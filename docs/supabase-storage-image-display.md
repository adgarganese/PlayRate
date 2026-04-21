# Supabase Storage: avatars & court photos not loading

The app aligns stored URLs to `EXPO_PUBLIC_SUPABASE_URL` and uses **signed URLs** when possible (`lib/storage-media-url.ts`, `hooks/useResolvedMediaUri.ts`). If images still fail, check the following in the **Supabase Dashboard**.

## 1. Buckets exist

- **Storage → Buckets**
- Required names: **`avatars`**, **`court-photos`** (must match the app).

## 2. Public vs private

- **Public bucket** ON: objects are readable via `/storage/v1/object/public/{bucket}/...` without auth. This matches the migrations that add broad **SELECT** policies on `storage.objects`.
- **Public bucket** OFF (private): the app relies on **`createSignedUrl`**. The user must be **signed in** (valid JWT on the Supabase client). Anonymous users may not get working image URLs for private buckets.

## 3. Storage RLS (policies on `storage.objects`)

For each bucket, ensure policies allow:

- **SELECT** on objects in that bucket for the roles that should view images (often `public` or `anon` for public buckets, or `authenticated` for private).
- Your repo migrations to apply or compare against:
  - `supabase/migrations/20260228190000_avatars_bucket_and_rls.sql` — `avatars`, policy **"Public read avatars"**.
  - `supabase/migrations/20260228180000_court_photos_storage_rls.sql` — `court-photos`, policy **"court_photos_storage_select"**.

If policies are missing or stricter than these, fix them in **Storage → Policies** or re-run the migrations.

## 4. Wrong hostname in `profiles.avatar_url`

If you **moved projects** or changed the project URL, old rows may still store `https://OLD_PROJECT.supabase.co/storage/...`. The app rewrites paths that contain `/storage/v1/object/public/` to the current project URL. If URLs use a different path shape or a custom domain, update rows or re-save avatars.

## 5. Object path vs database

- **Avatars:** path in Storage should be `avatars/{user_id}/{file}` (see `ProfilePicture.tsx`).
- **Court photos:** DB column `court_photos.storage_path` should match the object key in `court-photos` (e.g. `{court_id}/{user_id}/{filename}.jpg`). Legacy paths `{court_id}/{filename}` may still work if the file exists.

## 6. File missing or extension mismatch

If compression or upload changed extensions but the DB still points at an old key, re-upload or fix `storage_path` / `avatar_url` in the database. The display layer cannot fix missing objects.
