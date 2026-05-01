# PlayRate Handoff

> Single source of truth for current project state. Updated at end of every working session. For tactical details (how a specific fix was implemented, what was tried), prompt Cursor — this doc is state, not history.

_Last updated: 2026-05-01_  
_Last commit at update: latest tip on `main` (run `git log -1 --oneline` to confirm)._  
_Latest app code commit: `5793341` — chore(cleanup): remove orphan modal styles after cosign modal simplification (commits since are docs-only)._

## 1. Project

PlayRate — mobile social app for pickup and recreational athletes. Multi-sport infrastructure exists; basketball-first for beta.

## 2. Stack & environment

- **Framework:** Expo (React Native) SDK **~54.0.33** (`expo` in `package.json`)
- **Backend:** Supabase (project ref `nhqhkwvmludnsblimjeu`)
- **Analytics:** PostHog
- **Error monitoring:** Sentry (`@sentry/react-native` ~7.2.0)
- **Repo:** [github.com/adgarganese/PlayRate](https://github.com/adgarganese/PlayRate), branch `main`
- **Domain:** playrate.io (Vercel)
- **Local dev:** Windows, Cursor IDE, PowerShell
- **Solo dev:** Andrew Garganese (git: `Andrew.G` / `garganese187@gmail.com`)
- **iOS native:** Managed via `expo prebuild` — **no committed `ios/`**; EAS regenerates native projects each build. `.gitignore` includes `/ios` and `/android`.
- **CI:** GitHub Actions — job **`verify`** (tsc, lint, test) + **`eas-preview-build`** (queues EAS preview) on push to `main` (requires `EXPO_TOKEN`).
- **Current version:** **1.1.2** (marketing) / iOS build **4** / Android `versionCode` **4** (`app.json`; `runtimeVersion` **1.1.2**)

## 3. Current status

- **Phase:** Internal beta / TestFlight-oriented (preview builds, small tester set).
- **Latest EAS build:** iOS **preview** **1.1.2 (4)** — the build for git **`5793341`** **errored** in Xcode (Ad Hoc provisioning profile missing **Push Notifications** / **`aps-environment`** vs `expo-notifications` entitlements from prebuild). **Resolved outside the repo:** enabled **Push Notifications** on App ID **`com.playrate.app`** in Apple Developer; deleted the cached Ad Hoc provisioning profile via **`npx eas-cli credentials`** so EAS can mint a **new** profile that includes push. A **fresh** preview build for **latest `main`** (this handoff refresh push) should be **queueing or running** and **supersedes** the failed **`5793341`** attempt (an earlier CI slot for **`d34cc1c`** may still appear until concurrency cancels it). Confirm status and artifact in [Expo dashboard](https://expo.dev) → project **playrate** → Builds.
- **Working on device:** Last **green** reference build remains **1.1.2 (3)** (`82f5170`) until **1.1.2 (4)** completes successfully — then validate **managed prebuild** + **RNCSlider** + recent UI on that binary.
- **Pending verification:** Smoke-test **1.1.2 (4)** on iPhone: prebuild/native modules, tabbed scroll / create-highlight bottom clearance, cosign card + modal, self-rating / court rating sliders. **Push end-to-end** after the new profile lands: token in `device_push_tokens`, `send-push-notification` Edge Function path — entitlement chain was just rewired.

## 4. Latest session summary

---

## Session 2026-05-01 — Preview build crashes on launch (UNRESOLVED, beta blocked)

### Goals (planned)
Confirm latest EAS build pushed → work leftover issues → targeted device test on recent-sessions work → push to first 1-2 person TestFlight beta. Did not reach beta launch.

### Shipped (committed to main, pushed)
- **CI scope EAS preview builds to iOS only** (commit `e49ac86`, `.github/workflows/ci.yml`). Android EAS preview builds paused — do not auto-run from CI until explicit re-enable.
- **Reverted to committed-`ios/` strategy** to bypass open Expo SDK 54 EAS prebuild bug (EACCES on `.expo/web` — see [expo/expo#44062](https://github.com/expo/expo/issues/44062), [eas-cli#3570](https://github.com/expo/eas-cli/issues/3570)). Steps:
  - Removed `/ios` from `.gitignore` (commit `7ff6270`)
  - Ran `Prebuild iOS` GitHub Actions workflow → committed regenerated `ios/` folder back to main (commit `301c066`, 21 files, by github-actions[bot])
- **Diagnostic: disabled EXUpdatesEnabled** in `ios/PlayRate/Supporting/Expo.plist` (commit `e5c28ec`). Did NOT fix the crash.

### Crash signature (both diagnostic builds, byte-for-byte identical)
- `EXC_CRASH` / `SIGABRT`, `abort() called`, uncaught Objective-C exception
- Crashed thread queue: `expo.controller.errorRecoveryQueue`
- `lastExceptionBacktrace` offsets in PlayRate binary: `437152, 432456, 438300, 141716`
- App crashes before JS bridge loads; Sentry (even if wired correctly) never receives the event

### Why both diagnostic builds returned identical signatures (HYPOTHESIS — needs verification)
- Locally modified `Expo.plist` after commit `e5c28ec` showed `EXUpdatesEnabled` reverted to `<true/>` in working tree (now restored). Strongly suggests EAS regenerates `Expo.plist` from `app.json` at build time even with committed `ios/`, defeating any plist-only diagnostic.
- Compounded by iOS install caching: both builds stamped `1.1.2 (4)`, so iOS likely kept the cached binary across reinstalls. The next diagnostic must bump build number AND delete the app from device before installing.

### Other findings (not crash causes, but real cleanup items)
- **Sentry slug mismatch.** `app.json` plugin and `ios/sentry.properties` say org=`playrate`, project=`playrate`. Actual Sentry project is `react-native` under `garganese` org. Sentry has never received an event from any build (dashboard shows "Waiting for first error"). Affects source map uploads and would affect runtime error capture if JS were loading. Not the crash cause (Sentry never initializes — JS never runs).
- **Native version mismatch.** `ios/PlayRate.xcodeproj/project.pbxproj` has `CURRENT_PROJECT_VERSION = 1` and `MARKETING_VERSION = 1.0` (template defaults from prebuild on macOS runner). `app.json` has `buildNumber = 4` and `version = 1.1.2`. Plausible-but-unproven contributor to the crash.
- **EAS warning at build time:** "Specified value for `ios.bundleIdentifier` in `app.config.js` or `app.json` is ignored because an `ios` directory was detected." Native files are now source of truth.

### Top of open work list (next session, in order — execute, don't improvise)
1. **Clean working tree** before any changes. Confirm `git status` is clean and tip of `main` is the session-wrap commit.
2. **Diagnostic build #3** — single commit:
   - Bump build to `5` in BOTH `app.json` (`expo.ios.buildNumber: "5"`, `expo.android.versionCode: 5`) AND `ios/PlayRate.xcodeproj/project.pbxproj` (`CURRENT_PROJECT_VERSION = 5;` — there are two occurrences for Debug and Release; change both)
   - Add `"enabled": false` to the `expo.updates` block in `app.json` so any EAS regeneration of `Expo.plist` preserves the disable
   - Set `"EXPO_PUBLIC_SENTRY_DSN": ""` (empty string) in `eas.json` `preview` profile `env` block — overrides the EAS-environment-level DSN and disables Sentry init at runtime
   - Commit, push, run interactive `npx eas-cli build --platform ios --profile preview`
   - **DELETE PlayRate from iPhone** before installing the new build
   - Launch from home screen icon (NOT `expo start`)
3. **If still crashes:** hard-revert option — revert commit `f9dcca8` (the original "switch to managed prebuild" commit that started this regression chain) and rebuild from a state closer to last known-good (1.1.2 build 3 / commit `82f5170`). This bypasses everything we've added since.
4. **Once preview build launches successfully:**
   - Fix Sentry org/project slugs in `app.json` and `ios/sentry.properties` to match actual project (`react-native` under `garganese` org)
   - Re-enable updates (revert the `enabled: false` from step 2)
   - Run Option A push notification test (single device, self-send)
   - Then proceed to Option C with first 1-2 testers

### Deferred (not blocking, do after crash is solved)
- Remove `EXPO_CACHE_DIR` from `eas.json` `preview` AND `production` env (pre-install script `scripts/eas-ensure-expo-cache.js` handles cache; the env var is unnecessary)
- Update version-bump SOP in this doc for committed-`ios/` workflow (must edit `pbxproj` or re-run `Prebuild iOS` workflow; `app.json` alone no longer sufficient)
- `supabase_migrations.schema_migrations` ledger drift cleanup
- `pg_cron` / Edge Function for scheduled `recompute_rep`
- Universal links / AASA on `playrate.io`
- Hosted Privacy/Terms URLs

### Build credit cost
2 wasted full builds for commit `e5c28ec` (CI auto-build + interactive both ran). Going forward: single-variable diagnostics only, with build-number bumps to defeat iOS caching.

---

- **Latest** — Refreshed **HANDOFF** (`docs: refresh HANDOFF after build-4 credentials fix`): **5793341** preview failed on provisioning / **`aps-environment`**; fixed via Apple **Push** on **`com.playrate.app`** + EAS credentials profile reset; next **1.1.2 (4)** IPA is the first **managed prebuild** + **push-capable** profile combo — verify push on device.
- **`d34cc1c`** — Added this **HANDOFF** as canonical project state.
- **`5793341`** — Orphan `CosignModal` stylesheet cleanup (this commit’s **1.1.2 (4)** EAS build hit **provisioning/signing** failure; not a code defect).
- **`a10f29f`** — Create-highlight scroll padding clears the floating tab bar (`useScrollContentBottomPadding` + defensive floor in `create.tsx`).
- **`7b62f00`** — Cosign on athlete skill cards: larger pill, right-aligned; cosign confirmation modal uses space-between and a larger primary pill.
- **`f9dcca8`** — iOS **managed native**: deleted committed `ios/`, migrated two `Info.plist` usage strings into `app.json`, `.gitignore` `/ios`, bumped to build **4** for a new binary.

## 5. Open work

### Blocking (must fix before next milestone)

- **Until the next iOS preview build is `FINISHED`:** Treat **1.1.2 (4)** as **not verified** on device — signing was broken for **`5793341`**; confirm the **post-credentials** build succeeds.

### Active backlog (working on these soon)

- **First good build 4 on device:** First binary with **managed prebuild** **and** a **push-capable** regenerated Ad Hoc profile — explicitly verify **push** (registration + `send-push-notification` / real notification), not only UI.
- **Device pass (UI):** Tabbed scroll, create-highlight, cosign, sliders once the IPA is available.
- **Create-highlight keyboard:** If caption stays hidden under the keyboard, add `KeyboardAvoidingView` (or equivalent); tab-bar padding fix does not cover that.

### Post-beta backlog (deferred but tracked)

- Universal links / AASA on **playrate.io**; optional hosted Privacy/Terms URLs for `lib/feedback.ts` mailto/form fallbacks.
- Deeper analytics, feedback channel beyond mailto + external form (see prior inventory).

## 6. Working preferences

- **Git:** Batch pushes — typically **end of session** or when explicitly asked; don’t assume every local commit is on `origin`.
- **Pre-TestFlight / build bump SOP:** Update **`app.json`** only for `expo.version`, `expo.runtimeVersion` (when marketing/runtime changes), `expo.ios.buildNumber`, `expo.android.versionCode`. **`package.json` / `package-lock.json`** stay at **marketing** version string. **`lib/feedback.ts`** and **`lib/sentry.ts`** string fallbacks stay aligned with marketing version. **Do not** hand-edit `Info.plist` / `project.pbxproj` — no committed `ios/`.
- **Native modules:** Anything with native code (e.g. community slider) needs **dev client or EAS build**, not Expo Go.
- **iOS signing / push:** `expo-notifications` implies **Push** on the App ID and provisioning profiles that include **`aps-environment`**; if Xcode reports profile vs entitlement mismatch, fix in **Apple Developer + EAS credentials** (regenerate profile), not by stripping push from the app unless intentionally dropping the feature.
- **Quality bar:** Prefer fixing at the **shared hook / shared component** when the bug is systemic (example: scroll padding hook), then narrow overrides per screen when justified.

---

## Verification before completing

1. **`_Last commit at update_`** matches `git log -1 --oneline` on `main`; **`_Latest app code commit_`** still points at **`5793341`** until new app code lands. ✓  
2. **Current version** matches `app.json`: **1.1.2**, iOS build **"4"**, Android **4**. ✓  
3. **Latest EAS iOS narrative** matches Expo: failed **5793341** / **4** (provisioning); credentials fixed; follow **latest `main`** builds in the dashboard. ✓  
4. **Section 5** calls out **push verification** after profile regeneration; no duplicate “fix RNCSlider” as a separate code task — covered under first good **4** on device. ✓  
