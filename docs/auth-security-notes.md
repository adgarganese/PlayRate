# Auth security notes (Issue #12)

## Client (this app)

- **Session storage:** Native builds use `expo-secure-store` when possible (`lib/supabase-auth-storage.ts`), with AsyncStorage fallback if SecureStore fails or the session JSON exceeds platform limits. Align **Supabase Auth minimum password length** with `AUTH_PASSWORD_MIN_LENGTH` in `lib/auth-validation.ts` (currently 8).
- **Recovery deep links:** Password-reset tokens are applied with `setSession` in `app/auth/callback.tsx` and `app/_layout.tsx` before navigating to `/reset-password`, so tokens are not passed as Expo Router params (which could linger in navigation state).
- **Logging:** Auth request failures in dev use `logAuthErrorSafe` (code/status/name only). Full `logCaughtError` remains for non-auth errors.

## Supabase Dashboard (manual)

- **Password policy:** Authentication → Providers → Email → set minimum length ≥ 8; optional complexity to match client rules.
- **Rate limits:** Supabase enforces email/SMS and auth rate limits; tune **Auth → Rate limits** if legitimate users hit caps; consider CAPTCHA / hooks for abuse (not in this repo).
- **Leaked password protection / MFA:** Enable if your plan supports them.

## Optional hardening (not implemented)

- Backend proxy for sensitive flows, or **Supabase Auth Hooks** for extra validation.
- Move refresh tokens to a true split-storage scheme if JWT payload consistently exceeds SecureStore limits.
