# Supabase: Create "avatars" bucket and Storage RLS

Profile picture upload fails with **"Bucket not found"** until the bucket exists and RLS is set. Do this in the Supabase dashboard (not from the client app). **Create the bucket first (A), then run the SQL (B).**

---

## A) Create the bucket in Supabase Dashboard (required first)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. In the left sidebar, open **Storage**.
3. Click **New bucket**.
4. **Name:** `avatars` (must match exactly; the app uses this name).
5. **Public bucket:** Optional. If you want avatar URLs to be viewable without auth, enable it. Otherwise keep it private and use signed URLs when needed.
6. Click **Create bucket**.

---

## B) Storage RLS policies (SQL)

Run this in **SQL Editor** in the Supabase dashboard. It allows authenticated users to upload only to their own path `avatars/{user_id}/*` and to update/delete only their own objects.

```sql
-- Storage policies for bucket "avatars"
-- Authenticated users can INSERT only when object name starts with auth.uid() + '/'

CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can UPDATE only their own objects in avatars/{user_id}/*

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can DELETE only their own objects in avatars/{user_id}/*

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT: allow authenticated to read (for viewing avatars in-app).
-- Use this if avatar URLs are not public. If the bucket is public, you may not need a SELECT policy.

CREATE POLICY "Authenticated can read avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');
```

If you prefer **public** avatar URLs (no auth required to view), make the bucket public in step A and you can omit the SELECT policy or use:

```sql
CREATE POLICY "Public read avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

---

## App path convention

The app uploads to path: `avatars/{user_id}/{timestamp}.{ext}` (e.g. `avatars/abc-123/1709123456789.jpg`). The RLS above allows only paths whose first folder is the current user's id.
