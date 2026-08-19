# PlayRate Handoff

> Single source of truth for current project state. Updated at end of every working session. For tactical details (how a specific fix was implemented, what was tried), prompt Cursor — this doc is state, not history.

_Last updated: 2026-08-19_
_Branch: `main`_
_Shipping binary: **1.1.4 (29)** — EAS `9cb81478` built from `57c1eac`, `eas submit` succeeded 2026-08-17. Installability confirmed 2026-08-19 (device install + `device_push_tokens` row)._
_Git: origin/main includes `1d9e358` (HANDOFF rewrite) and this session's create-highlight / home-timeout commit. Expo.plist alignment is `1aa100d` (not in binary 29). No EAS build._

May 2026 launch-crash investigation is **closed**. Do not treat iOS 26 / Hermes PAC / `expo/expo#44356` as a current blocker. Full write-up: [`docs/post-mortems/2026-05-07-launch-crash-investigation.md`](./post-mortems/2026-05-07-launch-crash-investigation.md).

---

## 1. Project

PlayRate — mobile social app for pickup and recreational athletes. Multi-sport infrastructure exists; basketball-first for beta.

- **Repo:** [github.com/adgarganese/PlayRate](https://github.com/adgarganese/PlayRate)
- **Bundle ID:** `com.playrate.app`
- **App Store Connect:** app `6759843242` — TestFlight iOS: https://appstoreconnect.apple.com/apps/6759843242/testflight/ios
- **EAS:** `@garganese/playrate` (`ce8747bd-f927-488b-b71b-9db2f74f1508`)
- **Apple team:** `K6252RR6WP` (Andrew Garganese, Individual). Account: `adgarganese@gmail.com`
- **Solo dev:** Andrew Garganese. Local: Windows, Cursor, PowerShell.

## 2. Stack & environment

- **Framework:** Expo SDK **~54.0.33**, committed **`ios/`** (EAS does **not** prebuild; `eas.json` has no prebuild override)
- **Backend:** Supabase project `nhqhkwvmludnsblimjeu`
- **Analytics:** PostHog (`EXPO_PUBLIC_POSTHOG_API_KEY` in EAS production/preview; prefix `phc_vamGj9VpDGcG`; no `--environment` suffix in the env value). **IPA bundle grep on 29 still pending.**
- **Errors:** Sentry org **`playrate`**, project **`react-native`**. Slug settled in `63df4b3` (2026-05-07). DSN + `SENTRY_AUTH_TOKEN` in EAS. A **1.1.3 release exists** on the dashboard (source-map upload path healthy). No captured crash events observed as of 2026-08-12 (low tester traffic + short free-tier issue retention). That does **not** by itself prove JS `Sentry.init` ran on device. Native `AppDelegate.swift` init stays deferred until a real crash on 29 fails to appear.
- **Domain:** playrate.io (Vercel). Password-reset bridge live at `https://playrate.io/password-reset.html` (`EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL` set in EAS).
- **CI:** `.github/workflows/ci.yml` — `verify` (tsc/lint/test) then `eas-preview-build` on push to `main` **unless** the head commit message contains `[skip ci]`. That preview job spends an EAS credit and does **not** produce a TestFlight binary.
- **Disabled:** `.github/workflows/prebuild-ios.yml` — do **not** re-enable. It once regenerated `ios/` from a stale baseline.

## 3. Current status (2026-08-19)

**Phase:** 1.1.4 (29) is installed on at least one device. Device push **registration works** (at least one `device_push_tokens` row after install + notification permission, 2026-08-19). End-to-end lock-screen delivery (Vault → Edge Function → Expo → device) is **waiting on a second-user DM test**. Do not collapse this into “push works” until that test confirms delivery.

What 29 carries vs 28 (`6ae38ef`, 2026-05-07):

- June 8: cosign modal + primary `#38BDF8`; push trigger reads Vault; onboarding polish; courts 2-up portrait grid
- Aug 17: APNs entitlement (`aps-environment=production`), production push logging, `updated_at` on token upsert, `Constants.easConfig?.projectId` fallback
- Version bump per native SOP **except** `Expo.plist` `EXUpdatesRuntimeVersion`, which was still `1.1.2` in `57c1eac`. **29 was built from `57c1eac`.** Alignment to `1.1.4` is `1aa100d` on top of that, **not in the shipping binary**. It applies to future OTA and the next native build.

**This session (not in 29):** create-highlight compose uses `KeyboardScreen` so the caption stays above the keyboard. Home already had a 12s full-screen load gate; location is now raced at 8s and each home section at 10s so a hung GPS/request cannot leave a spinner up forever.

**Push plumbing**

- Server: `trigger_push_on_notification()` reads Vault secrets `supabase_functions_url` and `service_role_key` (both present). Applied via SQL Editor (CLI `db push` needs Docker).
- Schema: `device_push_tokens` has `updated_at` (added 2026-08-12 via SQL Editor; was missing vs migration `20260414121100` — that drift caused silent upsert failures on 28).
- Client: empty entitlements on 28 meant `getExpoPushTokenAsync` could not register. Fixed in `4e81857`. Failures now `logger.warn` → Sentry `captureMessage` in production (`lib/logger.ts` verified 2026-08-17: `warn` → `captureMessage`, `info` → `addBreadcrumb`; not `__DEV__`-guarded).
- Signing: first 29 attempt (`397db901`) failed because App Store profile `VKTPMNRFBN` / `*[expo] com.playrate.app AppStore 2026-03-01…` lacked Push. Interactive rebuild (`9cb81478`) minted a new profile after Apple login. Dist cert `63DAEE2A…` (expires 2027-03-01) was kept.

**EAS production/preview env present:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_POSTHOG_API_KEY`, `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL`.

**EAS env not set:** `EXPO_PUBLIC_UNIVERSAL_LINK_HOST`, `EXPO_PUBLIC_SENTRY_ENVIRONMENT`, `EXPO_PUBLIC_FEEDBACK_FORM_URL`, `EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_TERMS_URL`, Google Maps/Places keys. None blocked 29.

**Beta flags** (`constants/features.ts`): `FEATURE_PHONE_AUTH = false`, `SOCCER_ENABLED = false`, `BETA_HIDE_LEADERBOARD = true`. Android is postponed (iOS-first).

**Product baseline (do not revert without instruction):**

- Primary `#38BDF8` — intentional June 8 swap. Contrast on light backgrounds is an eyeball item on 29 (Section 4), not a blanket ban on per-spot token tweaks if text is unreadable.
- Courts browse is 2-up photo cards; sports chips and inline Following were dropped from the grid card on purpose (still on detail).
- Onboarding done screen uses `star.fill` because `basketball.fill` is not in the `IconSymbol` mapping. Swap when that mapping expands.

## 4. Open work

**Now / this week**

1. Confirm lock-screen push via a DM between two accounts (registration already proven). If delivery fails: Sentry `[push] …` warnings on the **recipient** device first; Mac Console.app if Sentry is silent.
2. PostHog IPA grep on 29: one `Select-String -SimpleMatch` per pattern; confirm `phc_vamGj9VpDGcG` present and `--environment` absent.

**Soon, no build required unless noted**

- Universal links / AASA (`EXPO_PUBLIC_UNIVERSAL_LINK_HOST` unset; shares use `playrate://`).
- Home → highlight detail back navigation (may skip Highlights tab). Unverified on 29.
- Eyeball 29: court-grid placeholders if few photos; `#38BDF8` contrast on light backgrounds.
- `EXPO_PUBLIC_SENTRY_ENVIRONMENT=production` in EAS (trivial, next build).
- `schema_migrations` ledger drift (prod applied more migrations than the first-5 ledger). Post-beta.

**Deferred (design or dedicated session)**

- Achievement / streak / King of the Court badges — integrate with Bronze→Diamond rep, not a parallel system.
- `IconSymbol` mapping: `basketball.fill` / `figure.basketball` (then swap onboarding done icon).
- Phone auth, soccer UI, court leaderboard (flags).
- Android: Maps/Places keys, notification icon, Play Internal Testing, CI Android.
- Squads / coach-scout badges.
- Native Sentry `AppDelegate.swift` init — only if a crash on 29 never appears in `playrate/react-native`.
- Face ID: not in current `Info.plist` or app code. Needs `NSFaceIDUsageDescription` if ever added.

## 5. Working preferences and traps

**Credits:** Spend them when it ships something. Stay efficient — one intentional production build, not CI preview + production. `[skip ci]` on commits that should not queue `eas-preview-build`.

**`--non-interactive` after entitlement changes:** Never pass `--non-interactive` on the first production build after entitlements change. It skips Apple auth and reuses a stale App Store profile (this caused `397db901` — profile lacked Push / `aps-environment`).

**Production iOS build:** `npx eas build --platform ios --profile production` from a **standalone PowerShell** (not Cursor’s terminal) when Apple login / 2FA / profile prompts are needed. If signing failed and the binary **never reached App Store Connect**, retry that **same git SHA** — do not invent a new commit or bump 1.1.5 just to rebuild.

**After a green production build:** `npx eas submit --platform ios --profile production --latest`. Internal testers install after Apple processing; **external** testers wait on beta review for a **new marketing version**. `ITSAppUsesNonExemptEncryption` is `false` in committed `ios/PlayRate/Info.plist` (verified 2026-08-17).

**Apple agreements:** If EAS says it failed to register `com.playrate.app` and mentions the Developer Program License Agreement, the Account Holder must accept it at https://developer.apple.com/account **before** retrying. EU DSA trader status is App Store Connect compliance; TestFlight can often proceed after the license agreement alone.

**Entitlements vs profiles:** Committed `ios/PlayRate/PlayRate.entitlements` is what EAS signs. Empty `<dict/>` ships with no Push. After adding `aps-environment`, **do not reuse** an old App Store profile (e.g. `VKTPMNRFBN` / `AppStore 2026-03-01`). Generate a new one. Do **not** churn a still-valid distribution certificate.

**Committed `ios/`:** When adding a native module: `npx expo prebuild --platform ios` locally, review the diff, commit `ios/` by hand. Keep `app.json` `ios.entitlements` / `infoPlist` in sync so a future prebuild does not drop Push. Do not re-enable `prebuild-ios.yml`.

**`EXPO_PUBLIC_*` inlining:** Must be static `process.env.EXPO_PUBLIC_NAME`. Dynamic `env[key]` is invisible to Babel and caused the May launch crash. EAS env present ≠ value in the JS bundle — verify with IPA grep when it matters.

**`resolveMediaUrlForPlayback`:** Calls `createSignedUrl` per URL. Safe on detail screens; **not** on browse lists (N+1). Courts grid uses `getPublicUrl` only.

**Windows `Select-String -SimpleMatch`:** One pattern per command. `|` is a literal, not alternation.

**Memory vs disk:** Assistant memory is summary. Trust this file + `git` / dashboards over memory. Claude should fetch `https://raw.githubusercontent.com/adgarganese/PlayRate/main/docs/HANDOFF.md` once this commit is on origin.

**Migrations:** Prefer Supabase SQL Editor when Docker is not running. Do not edit already-applied migration files.

**Dev-client push:** Hardcoded `aps-environment=production` is for TestFlight/App Store. Dev-client APNs sandbox push is not supported until that is revisited.

## 6. Build version SOP (committed `ios/`)

When bumping for a new binary, in **one** commit (usually `chore(release): … [skip ci]`):

- `app.json` — `expo.version`, `expo.runtimeVersion` (when marketing/runtime changes), `expo.ios.buildNumber`, `expo.android.versionCode`
- `ios/PlayRate/Info.plist` — `CFBundleShortVersionString`, `CFBundleVersion` (build number)
- `ios/PlayRate.xcodeproj/project.pbxproj` — `CURRENT_PROJECT_VERSION` and `MARKETING_VERSION` in target Debug + Release (`13B07F94`, `13B07F95`) only
- `ios/PlayRate/Supporting/Expo.plist` — `EXUpdatesRuntimeVersion` (missed on the 1.1.4 bump; fixed in `1aa100d` — **not in binary 29**)
- `package.json` + `package-lock.json` root / `packages[""]` marketing version
- `lib/feedback.ts` and `lib/sentry.ts` fallback strings

Reuse the same marketing/build numbers if that build **never reached App Store Connect** (failed EAS/signing). Bump if ASC already accepted that build number.

**`runtimeVersion` vs reuse:** Bump `expo.runtimeVersion` **and** `Expo.plist` `EXUpdatesRuntimeVersion` together when native code or native config changes (entitlements, Info.plist, native modules). Reuse the current runtime when only JS/assets change so EAS Update can still target existing installs. Mismatched `app.json` vs `Expo.plist` runtimes will make OTA refuse to apply.

## 7. Session opener

1. Read this file (from origin once pushed).
2. `git status` / `git log -5 --oneline` — do not assume HEAD from memory.
3. Open work is Section 4. Do not revive quarantined May hypotheses.

Trust this handoff over stale chat memory when they disagree.
