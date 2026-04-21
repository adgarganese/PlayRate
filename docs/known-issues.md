<!-- TODO: [DOCS-CLEANUP] The following docs reference removed components or outdated patterns
and should be updated or archived:
- DEAD_CODE_AUDIT.md
- docs/TESTFLIGHT-PRELAUNCH-AUDIT.md
- docs/design-system-audit.md
- THEME_MIGRATION_SUMMARY.md
- docs/theme.md
- docs/text-color-standardization.md
- DESIGN_SYSTEM_COMPLETE.md
- TIER-SYSTEM-README.md
- LOGO_ASSETS_*.md
- assets/archive/brand-old/*.md
Also verify docs/migration-checklist.md includes the 20260415* migration files. -->

# Known issues & beta rough edges

This list is for **beta testers and maintainers**. It is intentionally honest so support expectations stay realistic.

## Product / UX

- **Court leaderboard** — Hidden in the app (`BETA_HIDE_LEADERBOARD`). The data paths may still exist on the backend; the UI is trimmed for beta.
- **Highlight repost** — Tapping repost shows “not available yet”; sharing uses the system share sheet with a custom URL scheme link.
- **Phone sign-up / sign-in** — Disabled in the client (`FEATURE_PHONE_AUTH`). Email auth is the supported path for beta.
- **Soccer (and other non-basketball sports)** — Additional sports are gated (`SOCCER_ENABLED`). Beta flows assume basketball-first content.
- **Cosign from another user’s profile** — Depends on your Supabase schema (e.g. `run_id` nullability). If cosign fails, the app shows a short message; some cases are “use recap/run context” rather than raw DB errors.
- **Court share / highlight share links** — Use the `playrate://` scheme; recipients need the app installed (and universal links may be incomplete until `EXPO_PUBLIC_UNIVERSAL_LINK_HOST` is configured — see `app.config.js`).

## Environment & configuration

- **Supabase migrations** — If migrations are missing, features degrade gracefully in some places (e.g. optional columns) and fail generically in others. Always run migrations before a beta build.
- **Storage** — Avatars and highlight/court media need the correct buckets and RLS. Misconfiguration shows a generic upload error in the app; fix in the Supabase dashboard.
- **Feedback URLs** — `EXPO_PUBLIC_FEEDBACK_FORM_URL`, `EXPO_PUBLIC_SUPPORT_EMAIL`, privacy/terms URLs should be set for production-like beta; defaults in `lib/feedback.ts` are placeholders.

## Analytics (PostHog)

- **Release builds** (TestFlight, Play internal/production) have `__DEV__ === false`, so events **are sent** when `EXPO_PUBLIC_POSTHOG_API_KEY` (and host, if non-default) are set.
- **Local Expo dev** does **not** send events unless you set `EXPO_PUBLIC_DEBUG_ANALYTICS=true` (or `1`). After a build, sign up, open a few screens, then confirm events in the PostHog **Live events** view.

## Store & ops (not enforced in code)

- **App Store / Play Store** — You still need screenshots, description, category, age rating, privacy policy URL, and (for Google) fuller listing data than TestFlight’s minimum.
- **Database backups** — In the Supabase dashboard: **Project Settings → Database** — confirm **Point-in-time recovery** (or equivalent backup strategy) for the project that beta users hit. Beta data is real data.

## Support

- Testers can use **Profile → Account & Security → Report a problem** (email) or **Send Feedback** (form URL from env).
