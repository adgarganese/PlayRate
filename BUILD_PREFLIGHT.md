# Build preflight checklist

Use this after each iOS dev build or TestFlight upload to verify core flows.

## Before building

- [ ] `app.json`: `expo.ios.bundleIdentifier` = `com.playrate.app`
- [ ] `app.json`: `expo.name` = `PlayRate`
- [ ] Env: Required keys set (Supabase URL + anon key; see `.env.example`)
- [ ] Run `npx expo prebuild --clean` if you changed native config or plugins

## After installing the build

1. **Launch** – App opens without red screen or immediate crash.
2. **Auth** – Sign in (or sign up) and land on home.
3. **Onboarding / player builder** – If shown, complete or skip without crash.
4. **Home** – Recommended runs and snapshot card load; tap snapshot → profile.
5. **Courts** – Courts list and map load; tap a court → detail; follow/unfollow works.
6. **Highlights** – Feed loads; open a highlight; like/share if available.
7. **DMs** – Inbox opens; open a conversation; send a message.
8. **Settings / account** – Open profile tab, account; sign out works.
9. **Photos** – Profile picture change or highlight upload (photo library) works and shows permission prompt if first time.

## Deep links (if used)

- [ ] `playrate://reset-password?...` opens reset-password flow.

## Notes

- Connection Test screen is dev-only (`__DEV__`); production builds redirect to home.
- Missing optional env (PostHog, Sentry, Google API keys) should not crash the app; features are disabled with dev-only warnings.
