# TestFlight sign-in verification checklist

Use this after shipping a build that includes the auth-diagnostics and config-error handling.

## Before installing from TestFlight

- [ ] EAS build used env: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` set in EAS environment variables for production/preview (URL: **sensitive** visibility recommended; anon key: **secret**).
- [ ] `app.json` has `scheme: "playrate"` and iOS `bundleIdentifier: "com.playrate.app"` (no change needed if already set).

## After installing the TestFlight build

1. **Open the app** (signed out).
2. **Sign in** with email/password.
3. **If you see the generic error screen:**
   - Note the **exact message** if it’s not the default (real error is now shown when caught by the boundary).
   - Use **Try again** once; if it still fails, use **Sign out** and continue.
4. **If sign-in works:** Confirm you land on Home and can use the app.

## Dev-only: seeing the real error

- In **Expo Go** or a **dev build**, repro the same flow. In the console you’ll see:
  - `[AuthDiagnostics]` with `EXPO_PUBLIC_SUPABASE_URL_present`, `supabase_client_initialized`, `session_on_start`, `user_id_present`.
  - `[AuthDiagnostics] caught error` with `message`, `code`, `stack` when something throws or Supabase returns an error.
- Use that to fix the root cause (missing env, bad redirect, or a line that throws post-login).

## Likely root causes (from diagnostics)

| Symptom | Likely cause |
|--------|----------------|
| Error screen: "EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing" | Env not set in EAS for that build environment (preview/production). |
| Sign-in Alert with Supabase error (e.g. invalid credentials) | User/password or Supabase project config. |
| Error screen right after sign-in, no config message | Post-login crash (e.g. null profile). Check dev logs for `caught error` and stack. |
| Works in Expo Go, fails on TestFlight | Env vars not injected in EAS build; or release-only crash (add guards / use __DEV__ logs to find it). |
