# Password Reset Setup Guide

## Root cause when “the email link does nothing”

1. **Native `redirectTo` was `playrate://reset-password`.** Supabase’s email uses `{{ .ConfirmationURL }}`, which eventually **302-redirects the browser** to your `redirectTo` with tokens in the **URL hash** (`#access_token=…&refresh_token=…&type=recovery`). Many clients (especially **Gmail**) do not treat **non-HTTPS** links reliably, and **in-app browsers** often refuse to hand off **custom URL schemes** from a redirect chain.

2. **Dashboard drift:** Redirect allow list must include every `redirectTo` you send. Older docs mentioned `athleteapp://`; the app scheme is **`playrate`** (`app.json` → `scheme`).

## Recommended production flow (native)

1. **Host the bridge page** (one static file): copy `web/password-reset-bridge.html` to any **HTTPS** static host (Netlify Drop, Cloudflare Pages, GitHub Pages, S3 + CloudFront, etc.). Example final URL:
   - `https://reset-bridge.yourdomain.com/password-reset-bridge.html`

2. **Set in EAS / env** (bundled at build time):
   - `EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL=https://reset-bridge.yourdomain.com/password-reset-bridge.html`

3. **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**  
   Add **exactly** that same URL (scheme, host, path). Also keep:
   - `playrate://reset-password` (optional fallback / manual links)
   - `playrate://auth/callback` if you use it for OAuth / magic links

4. **Rebuild** the native app after changing `EXPO_PUBLIC_*` (they are compiled into the JS bundle).

### What the bridge does

User taps email → opens **HTTPS** in the mail client’s browser → Supabase appends `#access_token=…` → the bridge runs `location.replace('playrate://reset-password' + hash)` → OS opens PlayRate → `app/_layout.tsx` deep link handler calls `setSession` and navigates to `/reset-password`.

## Supabase Dashboard (reference)

### Site URL

Use your real **web** site or marketing URL if you have one (HTTPS). For Expo web dev, `http://localhost:8081` is common. **Do not** set Site URL to a custom scheme alone.

### Redirect URLs (examples)

```
http://localhost:8081/reset-password
playrate://reset-password
playrate://auth/callback
https://YOUR_BRIDGE_HOST/password-reset-bridge.html
https://YOUR_UNIVERSAL_LINK_HOST/reset-password
```

- **Web:** The app uses `origin + '/reset-password'` when running on web.
- **Native with no env:** Falls back to `playrate://reset-password` (works in some clients; **not** reliable in Gmail).
- **Universal links:** Set `EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL` to `https://<your-app-link-host>/reset-password` (or any path) **only** if that URL serves the bridge page or your site forwards the hash into the app; the app does **not** infer this from `EXPO_PUBLIC_UNIVERSAL_LINK_HOST` alone (avoids 404s on hosts with no `/reset-password` page).

## App behavior (already implemented)

1. **`app/forgot-password.tsx`** — Calls `resetPasswordForEmail` with `getPasswordResetRedirectTo()` from `lib/password-reset-redirect.ts`.

2. **`app/_layout.tsx`** — Listens for URLs containing recovery tokens (query or hash via `mergeQueryAndHash`), calls `supabase.auth.setSession`, then `router.replace('/reset-password')`.

3. **`app/reset-password.tsx`** — Confirms session (or reads params), then `updateUser({ password })`.

4. **`app/auth/callback.tsx`** — If the user is redirected to `playrate://auth/callback` with recovery tokens, sets session and routes to `/reset-password`.

## Email template

Dashboard → **Authentication → Email Templates → Reset password**. The default template uses **`{{ .ConfirmationURL }}`**, which is correct. You normally **do not** need to hardcode `playrate://` in the template if `redirectTo` is set correctly from the app.

## Testing

- **Web:** Forgot password → open link in browser → should land on `/reset-password` with hash (Expo / browser may expose hash to the app depending on setup).
- **Native + bridge:** Set `EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL`, add URL in Supabase, send reset email, tap link on a physical device → bridge → app → reset screen.

## Troubleshooting

| Symptom | Check |
|--------|--------|
| Link never opens app | Use HTTPS bridge + env var; add exact URL to Supabase Redirect URLs |
| “Invalid or expired” | Token expired (1h) or link already used; request new email |
| Works on iOS Mail but not Gmail | Expected without HTTPS bridge |
| `playrate://` not registered | Reinstall dev client / store build; verify `scheme` in `app.json` |
