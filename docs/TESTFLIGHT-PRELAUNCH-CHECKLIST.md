# TestFlight pre-launch checklist

Run through this before building and submitting to TestFlight. No code changes—verification only.

---

## EAS environment (required for auth)

- [ ] **EXPO_PUBLIC_SUPABASE_URL** is set in EAS for the build profile you use (e.g. **production** or **preview**).
  - Where: [expo.dev](https://expo.dev) → your project → **Secrets** (or **Environment variables** for the profile).
  - If missing: app will show “EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing” after load.
- [ ] **EXPO_PUBLIC_SUPABASE_ANON_KEY** is set in EAS for the same profile.
  - If missing: same config-error screen; auth will not work.

---

## Supabase storage buckets (required for uploads)

- [ ] **avatars** bucket exists (Profile picture upload).
  - Supabase Dashboard → **Storage** → bucket `avatars`.
  - RLS: users can upload to `avatars/{user_id}/*` and read public URLs. See `docs/SUPABASE-AVATARS-BUCKET.md` if you have it.
- [ ] **highlights** bucket exists (Highlight create: camera / photos).
  - Storage → bucket `highlights`.
  - RLS: authenticated users can upload; public read for playback.
- [ ] **court-photos** bucket exists (Court photos).
  - Storage → bucket `court-photos`.
  - RLS: appropriate policies for upload and read.

---

## Optional but recommended for TestFlight

- [ ] **EXPO_PUBLIC_SENTRY_DSN** set in EAS (so TestFlight crashes and errors are reported to Sentry).
- [ ] Sentry auth token configured for source maps if you use EAS + Sentry.

---

## After checklist

- Build: `eas build --platform ios --profile production` (or your profile).
- Submit: `eas submit --platform ios --profile production --latest`.
- Install from TestFlight and smoke-test: sign in, Home, profile avatar, create highlight, open a court.
