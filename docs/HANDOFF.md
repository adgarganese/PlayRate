# PlayRate Handoff

> Single source of truth for current project state. Updated at end of every working session. For tactical details (how a specific fix was implemented, what was tried), prompt Cursor — this doc is state, not history.

_Last updated: 2026-09-08_
_Branch: `main`_
_Shipping binary: **1.1.4 (29)** — EAS `9cb81478` built from `57c1eac`, `eas submit` succeeded 2026-08-17. Installability confirmed 2026-08-19 (device install + `device_push_tokens` row)._
_Git: trust `git log -1`. Binary 29 is still `57c1eac` / EAS `9cb81478`. Expo.plist alignment is `1aa100d` (not in that binary). No EAS build 2026-09-08._

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
- **Analytics:** PostHog (`EXPO_PUBLIC_POSTHOG_API_KEY` in EAS production/preview; prefix `phc_vamGj9VpDGcG`; no `--environment` suffix in the env value). **IPA grep on 29 (2026-08-19):** `phc_vamGj9VpDGcG` present in `main.jsbundle`; `--environment` absent; `process.env.EXPO_PUBLIC_POSTHOG_API_KEY` as a runtime reference is absent (Babel inlined the value at build time).
- **Errors:** Sentry org **`playrate`**, project **`react-native`**. Slug settled in `63df4b3` (2026-05-07). DSN + `SENTRY_AUTH_TOKEN` in EAS. A **1.1.3 release exists** on the dashboard (source-map upload path healthy). No captured crash events observed as of 2026-08-12 (low tester traffic + short free-tier issue retention). That does **not** by itself prove JS `Sentry.init` ran on device. Native `AppDelegate.swift` init stays deferred until a real crash on 29 fails to appear.
- **Domain:** playrate.io (Vercel). Password-reset bridge live at `https://playrate.io/password-reset.html` (`EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL` set in EAS).
- **CI:** `.github/workflows/ci.yml` — `verify` (tsc/lint/test) then `eas-preview-build` on push to `main` **unless** the head commit message contains `[skip ci]`. That preview job spends an EAS credit and does **not** produce a TestFlight binary.
- **Disabled:** `.github/workflows/prebuild-ios.yml` — do **not** re-enable. It once regenerated `ios/` from a stale baseline.

## 3. Current status (2026-09-08)

**Phase:** 1.1.4 (29) on TestFlight. **Lock-screen push delivered** on a two-phone DM, 2026-09-08 ~22:51 UTC (recipient banner immediately after send). User IDs not recorded — add them here if you still have both accounts handy. SQL probe `net.http_post` id 8 returned 200 at 22:40 UTC and showed **Push probe from SQL** on the most-recently-updated token’s phone. Do not treat Expo/APNs as unproven anymore. Still not a blanket “all notification types forever” claim — DMs + that probe are the known-good baseline.

**What was broken (2026-08-20 → 2026-09-08):**

1. Edge Function `send-push-notification` `verify_jwt` accepted the Vault `service_role` JWT, then `isAuthorized` 401’d because that JWT string ≠ `SUPABASE_SERVICE_ROLE_KEY` after the API-key migration (`SUPABASE_*` keys marked DEPRECATED). Likes/reposts **did** queue `pg_net` (HTTP 401). Deployed 2026-09-08: allow a platform-verified JWT with `role=service_role`; keep `verify_jwt=true`.
2. DMs never inserted `notifications` (`new_message`). Inbox bell is unread messages. Applied via SQL Editor 2026-09-08: `on_message_inserted_notify` on `public.messages`. Client `createInAppNotification` in `lib/dms.ts` removed so a later binary does not double-notify.

What 29 carries vs 28 (`6ae38ef`, 2026-05-07):

- June 8: cosign modal + primary `#38BDF8`; push trigger reads Vault; onboarding polish; courts 2-up portrait grid
- Aug 17: APNs entitlement (`aps-environment=production`), production push logging, `updated_at` on token upsert, `Constants.easConfig?.projectId` fallback
- Version bump per native SOP **except** `Expo.plist` `EXUpdatesRuntimeVersion`, which was still `1.1.2` in `57c1eac`. **29 was built from `57c1eac`.** Alignment to `1.1.4` is `1aa100d` on top of that, **not in binary 29**. Binary 29 checks in as runtime **1.1.2** for OTA — EAS Updates published against runtime 1.1.4 will **not** reach binary 29 installs. The next native build picks up 1.1.4 going forward. Do not publish an OTA “fix” for testers on 29 against runtime 1.1.4 and wonder why they don’t see it.

**On origin after 29 (not in TestFlight 29):**

| SHA | What |
|---|---|
| `1aa100d` | `Expo.plist` `EXUpdatesRuntimeVersion` 1.1.2 → 1.1.4 |
| `1d9e358` | HANDOFF rewrite (current-state source of truth) |
| `b260d21` | Create-highlight `KeyboardScreen`; home load races: GPS 8s then continue without coords; each home section 10s then error/retry UI; 12s hard gate unblocks the full-screen “Loading…” even if a request is still in flight |
| `49170c7` | Highlight detail is a root-stack overlay at `/highlight/[id]`. Back/swipe returns to the origin tab. Share URLs stay `playrate://highlights/{id}`. Legacy `/highlights/:id` redirects. |
| `5739023` | `IconSymbol` maps `basketball.fill` / `figure.basketball`; onboarding done uses `basketball.fill`. PostHog IPA grep recorded. |
| `4c169a0` | Add Court Places autocomplete **when** `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` is set; otherwise the plain address field. |

**Push plumbing**

- Server: `trigger_push_on_notification()` reads Vault secrets `supabase_functions_url` and `service_role_key` (both present). Applied via SQL Editor (CLI `db push` needs Docker). DM inserts now create `notifications` via `on_message_inserted_notify` (SQL Editor 2026-09-08; migration `20260908220000`).
- Edge Function `send-push-notification` (deploy 2026-09-08): `isAuthorized` accepts env secret match **or** Bearer JWT `iss=supabase` / `role=service_role`. **Load-bearing:** `verify_jwt` must stay true (`supabase/config.toml`). Payload role is not auth if Kong verify is off. Vault JWT need not equal function env `SUPABASE_SERVICE_ROLE_KEY` (DEPRECATED keys; drift vs dashboard Legacy unaudited).
- Schema: `device_push_tokens` has `updated_at` (added 2026-08-12 via SQL Editor; was missing vs migration `20260414121100` — that drift caused silent upsert failures on 28).
- Client: empty entitlements on 28 meant `getExpoPushTokenAsync` could not register. Fixed in `4e81857`. Failures now `logger.warn` → Sentry `captureMessage` in production (`lib/logger.ts` verified 2026-08-17: `warn` → `captureMessage`, `info` → `addBreadcrumb`; not `__DEV__`-guarded).
- Signing: first 29 attempt (`397db901`) failed because App Store profile `VKTPMNRFBN` / `*[expo] com.playrate.app AppStore 2026-03-01…` lacked Push. Interactive rebuild (`9cb81478`) minted a new profile after Apple login. Dist cert `63DAEE2A…` (expires 2027-03-01) was kept.

**EAS production/preview env present:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_POSTHOG_API_KEY`, `EXPO_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL`.

**EAS env not set:** `EXPO_PUBLIC_UNIVERSAL_LINK_HOST`, `EXPO_PUBLIC_SENTRY_ENVIRONMENT`, `EXPO_PUBLIC_FEEDBACK_FORM_URL`, `EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_TERMS_URL`, Google Maps/Places keys. None blocked 29.

**Beta flags** (`constants/features.ts`): `FEATURE_PHONE_AUTH = false`, `SOCCER_ENABLED = false`, `BETA_HIDE_LEADERBOARD = true`. Android is postponed (iOS-first).

**Product baseline (do not revert without instruction):**

- Primary `#38BDF8` — intentional June 8 swap. Contrast on light backgrounds is an eyeball item on 29 (Section 4), not a blanket ban on per-spot token tweaks if text is unreadable.
- Courts browse is 2-up photo cards; sports chips and inline Following were dropped from the grid card on purpose (still on detail).
- Onboarding done screen uses `basketball.fill` (`IconSymbol` mapping added 2026-08-19).
- **Visual work:** do not change functionality unless Andrew notes an exception. Look/feel, hierarchy, spacing, icons. The comment composer is an explicit exception (broken).

## 4. Open work

**Now (order: origin has the lock-screen commits → comment composer → visual *list*, then polish commits).** Look/feel only unless noted. No EAS credit unless a later native item needs a binary.

1. Optional: two tester user IDs into Section 3 for a known-good DM pair.
2. **Highlight comments (broken):** composer text box not visible. `app/highlight/[highlightId]/comments.tsx` — iOS `KeyboardAvoidingView` `behavior="position"`. Legacy redirect file too.
3. **Visual audit** produces a *list*, not a commit-per-spot. Then one polish commit. Screens: home, courts grid, court detail, Find Courts, profile, highlights. Include: shrink Find Courts empty overlay / hide when courts in view; court-card check-in opposite ratings; center profile header icons.
4. **Client-only notification RPCs** (same silent-fail class as DMs before the message trigger): `highlight_like` and `highlight_comment` (`lib/highlights.ts`), `new_follower` (`hooks/useFollow.ts`), `run_join` (`lib/runs.ts`), `cosign` (`lib/recap.ts`). Likes *did* insert tonight (21:09) so some client RPCs work; DMs did not. Don’t assume the RPC is globally dead. Optional belt: partial unique index on `notifications (user_id, type, entity_id) WHERE type = 'new_message'` so 29’s still-shipped client call cannot double-push if it starts succeeding.
5. Other Edge Functions that string-compare `SUPABASE_SERVICE_ROLE_KEY` — same env drift possible. Only `send-push-notification` exists in repo today.

**Dead-code sweep (not now):** separate `[skip ci]` commit. Two-phase: move candidates to `_deprecated/`, TestFlight for a week, then delete. Cursor lists, Andrew reviews. Do not touch: `docs/` (incl. May post-mortem), `HANDOFF.md`, `supabase/migrations/`, `supabase/functions/send-push-notification/`, `ios/`, anything behind `constants/features.ts`, `lib/config.ts`, string-loaded names (analytics, notification types, deep links, MMKV/AsyncStorage), `.github/workflows/prebuild-ios.yml`.

**Next product (after visual is settled)**

- **Runs** stays the name. Check-in = “I am at this court now.” A Run = who is playing / the session. Prefer `check_ins.run_id` nullable FK so a check-in can exist without a run. Integration UX is its own session.
- **Run intensity:** labels first. Proposed: **Shootaround, Casual, Competitive,** plus a top tier — prefer **Elite** / **Serious** over **Semi-pro** (identity-loaded). Drop “balanced”. Keep `skill_min` / `skill_max` for later matching. Recap is cosigns, not W/L.

**Later (inventory 2026-09-08 — do not start)**

| Idea | Already in the app? |
|---|---|
| Better Bronze→Diamond icons | **Partial.** `TierBadge` is a letter in a colored square (`B`/`S`/`G`/`P`/`D`). Needs illustration, not a new tier system. |
| King of the Court = most check-ins | **Partial, hidden.** `get_court_leaderboard` + court detail UI exist; `BETA_HIDE_LEADERBOARD = true`. No crown, not on profile. Unhide + badge, don’t build a second table. |
| Streaks / log W–L / teammate & court win% | **No.** Recap is cosign-only. Needs new game-log schema. |
| Leaderboards by zip / city / state (check-ins, cosigns, rating) | **No** at geo grain. Court-level check-in leaderboard only (flagged off). |
| Highlights “most liked/commented” + weekly Top 10 | **No product.** `top10` is a notification *type* stub only. Counts exist on highlight cards. |
| Filter feed by sport(s) you want to see | **Partial.** Beta is basketball-only (`SOCCER_ENABLED = false`, `isSportEnabled`). No user “hide sports” control. Add when a second sport ships. |

**Soon, no build required unless noted**

- Universal links / AASA (`EXPO_PUBLIC_UNIVERSAL_LINK_HOST` unset; shares use `playrate://`).
- Eyeball 29: court-grid placeholders if few photos; `#38BDF8` contrast on light backgrounds; **card proportions** (2-up, 3:4 photo) — fold into the visual pass.
- `EXPO_PUBLIC_SENTRY_ENVIRONMENT=production` in EAS (trivial, next build).
- Google Places key: closer to launch, next binary, restrict-first. See Section 5.
- `schema_migrations` ledger drift. Post-beta.

**Deferred (design or dedicated session)**

- Phone auth, soccer UI (`SOCCER_ENABLED`).
- Android: notification icon, Play Internal Testing, CI Android.
- Squads / coach-scout badges.
- Native Sentry `AppDelegate.swift` init — only if a crash on 29 never appears in `playrate/react-native`.
- Face ID: not in current `Info.plist` or app code. Needs `NSFaceIDUsageDescription` if ever added.

## 5. Working preferences and traps

**Credits:** Spend them when it ships something. Stay efficient — one intentional production build, not CI preview + production. `[skip ci]` on commits that should not queue `eas-preview-build`.

**`--non-interactive` after entitlement changes:** Never pass `--non-interactive` on the first production build after entitlements change. It skips Apple auth and reuses a stale App Store profile (this caused `397db901` — profile lacked Push / `aps-environment`).

**Production iOS build:** `npx eas build --platform ios --profile production` from a **standalone PowerShell** (not Cursor’s terminal) when Apple login / 2FA / profile prompts are needed. If signing failed and the binary **never reached App Store Connect**, retry that **same git SHA** — do not invent a new commit or bump 1.1.5 just to rebuild. Profile/credential fixes between attempts are server-side (Apple + Expo); they do not require a git change.

**After a green production build:** `npx eas submit --platform ios --profile production --latest`. Internal testers install after Apple processing; **external** testers wait on beta review for a **new marketing version**. `ITSAppUsesNonExemptEncryption` is `false` in committed `ios/PlayRate/Info.plist` (verified 2026-08-17).

**Apple agreements:** If EAS says it failed to register `com.playrate.app` and mentions the Developer Program License Agreement, the Account Holder must accept it at https://developer.apple.com/account **before** retrying. EU DSA trader status is App Store Connect compliance; TestFlight can often proceed after the license agreement alone.

**Entitlements vs profiles:** Committed `ios/PlayRate/PlayRate.entitlements` is what EAS signs. Empty `<dict/>` ships with no Push. After adding `aps-environment`, **do not reuse** an old App Store profile (e.g. `VKTPMNRFBN` / `AppStore 2026-03-01`). Generate a new one. Do **not** churn a still-valid distribution certificate.

**Committed `ios/`:** When adding a native module: `npx expo prebuild --platform ios` locally, review the diff, commit `ios/` by hand. Keep `app.json` `ios.entitlements` / `infoPlist` in sync so a future prebuild does not drop Push. Do not re-enable `prebuild-ios.yml`.

**`EXPO_PUBLIC_*` inlining:** Must be static `process.env.EXPO_PUBLIC_NAME`. Dynamic `env[key]` is invisible to Babel and caused the May launch crash. EAS env present ≠ value in the JS bundle — verify with IPA grep when it matters. Google Places/Geocoding keys are `EXPO_PUBLIC_*` and **will appear in `main.jsbundle` in plaintext** if set. **Restrict the Google Cloud key before setting it in EAS** (iOS app restriction, bundle `com.playrate.app`; APIs: Places + Geocoding if using one key — not HTTP referrer, not IP). Once EAS has the value, the next production build inlines it regardless of whether Google Cloud restriction is finished.

**Google Places billing:** Autocomplete is billed per session/request. Add Court (`4c169a0`) and Find Courts both `debounce={300}`. Do not drop that debounce or fire a session on component mount.

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

**`runtimeVersion` vs reuse:** Bump `expo.runtimeVersion` **and** `Expo.plist` `EXUpdatesRuntimeVersion` together when native code or native config changes (entitlements, Info.plist, native modules). Reuse the current runtime when only JS/assets change so EAS Update can still target existing installs. Mismatched `app.json` runtime vs `Expo.plist` `EXUpdatesRuntimeVersion` means the native binary and the OTA channel disagree — updates will not apply, and there is **no error**, just silent OTA orphaning.

## 7. Session opener

1. Read this file (from origin once pushed).
2. `git status` / `git log -5 --oneline` — do not assume HEAD from memory.
3. Open work is Section 4. Do not revive quarantined May hypotheses.

Trust this handoff over stale chat memory when they disagree.
