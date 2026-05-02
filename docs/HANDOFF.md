# PlayRate Handoff

> Single source of truth for current project state. Updated at end of every working session. For tactical details (how a specific fix was implemented, what was tried), prompt Cursor — this doc is state, not history.

_Last updated: 2026-05-02 (end of day)_
_Current branch: main_
_Current HEAD: `e54cfe8` — build: hard reset to 82f5170 (green build 3) + bump to build 7_
_Recovery branch: `backup-before-reset-2026-05-02` at `0b13d28` (preserves recent JS work + push config; not pushed to origin)_

## 1. Project

PlayRate — mobile social app for pickup and recreational athletes. Multi-sport infrastructure exists; basketball-first for beta.

## 2. CRITICAL — READ BEFORE TOUCHING ANYTHING

**The app is currently blocked by a confirmed upstream Expo SDK 54 bug, not by anything in this repo.**

Builds 4, 5, 6, and 7 (May 2 session) all crashed instantly on launch with identical signature: `EXC_CRASH/SIGABRT` on `expo.controller.errorRecoveryQueue`, NSException raised at ~780ms after launch, JS bridge never loads. Frame offsets in the main binary are byte-identical across all four builds (437152, 432456, 438300, 141716) despite each having different `ios/` contents.

**Build 7 (`e54cfe8`) is sourced from green build 3 (`82f5170`) byte-identical for tracked files** — only the build number was bumped from 3 to 7. It crashes the same way build 3 now crashes when reinstalled. Build 3 worked on April 30; the same binary fails on May 2.

The variable that changed: **iPhone OS updated to 26.4.2 (build 23E261) between Apr 30 and May 2.**

### Confirmed upstream bug

This matches GitHub issue **expo/expo#44356** — "[SDK 54/55] Hermes crashes systematically on physical iOS 26 devices — PAC pointer authentication." Summary: ARM64 PAC enforcement was hardened in iOS 26.x; the Hermes JS engine bytecode shipped by SDK 54/55 fails PAC validation, so apps crash at launch on physical iOS 26 devices. Simulators are unaffected. Dev client builds work (Hermes runs interpreted).

Related issues with similar fingerprints:
- expo/expo#41824 (iOS launch crash, same SDK 54, expo-notifications, no code changes between working and broken builds)
- expo/expo#44680 (production builds crash, dev builds work; SIGABRT variant on RN 0.85)

### What this means for this project

- **Do NOT spend EAS build credits trying to fix this in code.** It is not in our code.
- Today's session burned 4 build credits (4, 5, 6, 7) before this was confirmed.
- Until upstream fixes ship, the only paths to a working app on iOS 26.x physical hardware are: (a) dev client (requires Mac), (b) wait for Hermes/RN/Expo patch, (c) test on a device running iOS 25.x or pre-26.4 iOS 26.

## 3. Stack & environment

- **Framework:** Expo (React Native) SDK **~54.0.33** (`expo` in `package.json`)
- **Backend:** Supabase (project ref `nhqhkwvmludnsblimjeu`)
- **Analytics:** PostHog
- **Error monitoring:** Sentry (`@sentry/react-native` ~7.2.0) — config plugin in `app.json`; "first event" Sentry slug mismatch was noted earlier and never resolved (deferred)
- **Repo:** [github.com/adgarganese/PlayRate](https://github.com/adgarganese/PlayRate), branch `main`
- **Domain:** playrate.io (Vercel)
- **Local dev:** Windows, Cursor IDE, PowerShell
- **Solo dev:** Andrew Garganese
- **iOS native:** **Committed `ios/` directory** (NOT managed prebuild — see Section 6)
- **CI:** `.github/workflows/ci.yml` — verify (tsc/lint/test) → eas-preview-build (queued via `eas build --platform ios --profile preview`). Concurrency cancels in-progress earlier slots.
- **Disabled CI workflow:** `.github/workflows/prebuild-ios.yml` — DISABLED in GitHub UI on May 2. Do not re-enable without first understanding why (see Section 6).
- **Current version on main:** **1.1.2** (marketing), iOS build **7**, Android `versionCode` **7** — but this binary crashes on iOS 26.4.2.

## 4. Current status

- **Phase:** Beta launch BLOCKED on upstream Expo bug (issue #44356).
- **Current main HEAD `e54cfe8`:** Source code is byte-identical to green build 3 (`82f5170`) for all tracked files except build numbers (bumped to 7). Crashes on iOS 26.4.2 due to upstream PAC issue.
- **Recovery branch `backup-before-reset-2026-05-02` at `0b13d28`:** Preserves all post-`82f5170` JS work (cosign UI in `7b62f00`, scroll padding hook in `a10f29f`, modal cleanup in `5793341`) plus the push notification entitlement (`aps-environment=development`) and the URL scheme/Face ID Info.plist additions made today. NOT pushed to origin. To restore: `git checkout backup-before-reset-2026-05-02` then merge/cherry-pick into main.
- **Test device:** iPhone 14 Pro (`iPhone15,2`) running iOS 26.4.2 (`23E261`). Cannot be used to validate any preview build until upstream fix lands.
- **Apple Developer / EAS credentials:** Push Notifications capability enabled on App ID `com.playrate.app` (done May 1); Ad Hoc provisioning profile regenerated to include push entitlement. This work is preserved server-side and survives any code change. Re-applies on next push-capable build.

## 5. Open work

### Blocking (cannot proceed in app code)

- **Upstream Expo SDK 54 + iOS 26 incompatibility (issue #44356).** Watch for: Hermes patch landing in RN, RN patch landing in Expo SDK 54.0.x, or Expo SDK 55 GA with the fix. Subscribe to the GitHub issues to get notified.

### Decisions to make next session (free, no builds required)

1. **Restore JS work to main, OR keep main at e54cfe8.** Recovery branch `backup-before-reset-2026-05-02` (`0b13d28`) has the recent UI work. We can cherry-pick those commits onto `e54cfe8` so when the upstream fix lands, the app has the latest JS. Do NOT cherry-pick + push + build — that wastes credits while bug persists. Cherry-pick + commit only.
2. **Sentry first-event mismatch (deferred from earlier sessions).** Config plugin is `@sentry/react-native/expo` with org/project both `playrate`. "First event" never received. Investigation deferred until app launches at all.
3. **Decide on a non-iOS-26.4.2 testing path.** Options: friend's phone on older iOS, iPad simulator on a Mac, dev client build (requires Mac access), or wait. Each has tradeoffs.

### Post-fix work (do not start until app launches successfully on device)

- **Push verification (was the headline test we never reached today):** Token registration into `device_push_tokens`, `send-push-notification` Edge Function path producing a real notification on device.
- **Device UI smoke test:** Tabbed scroll, create-highlight bottom clearance, cosign card + modal, RNCSlider rating sliders.
- **Create-highlight keyboard handling:** If caption stays hidden under keyboard, add `KeyboardAvoidingView`. Was queued as the next "build 6 after build 5 verifies" task; never reached.
- **Universal links / AASA on playrate.io.**

## 6. Working preferences and traps

### Build credit conservation (HARD RULE)

- Never push to `main` while the upstream bug is unresolved. CI auto-queues `eas-preview-build` on push to main, which spends a credit. Local commits encouraged.
- When credits are required: run `npx tsc --noEmit && npm run lint` locally first.
- One credit per intentional change. Bundle multiple fixes into one build when possible.

### iOS native strategy (HARD-WON LESSON FROM TODAY)

- The repo uses **committed `ios/`**. EAS uses it as-is and does NOT run `expo prebuild` (no override in `eas.json`).
- The `prebuild-ios.yml` workflow is DISABLED in GitHub UI. It was the cause of commit `301c066` ("chore: add ios from prebuild [skip ci]") which silently regenerated `ios/` from a stale baseline that lost `ENABLE_USER_SCRIPT_SANDBOXING`, `MARKETING_VERSION 1.1.2`, and `CURRENT_PROJECT_VERSION 3`. This created a Frankenstein `ios/` and was a major source of confusion in the May 2 session before we identified it.
- DO NOT re-enable `prebuild-ios.yml` without first auditing why its prebuild output drifted from intended config. The workflow is not deleted; it lives in the repo for reference.
- When adding a native module locally: run `npx expo prebuild --platform ios` yourself, eyeball the diff, commit the `ios/` changes manually.

### Build version SOP (committed `ios/` flavor)

When bumping for a new build, edit ALL of these in one commit:
- `app.json` — `expo.version`, `expo.runtimeVersion` (when marketing/runtime changes), `expo.ios.buildNumber`, `expo.android.versionCode`
- `ios/PlayRate/Info.plist` — `CFBundleVersion` (must match `app.json` ios.buildNumber)
- `ios/PlayRate.xcodeproj/project.pbxproj` — both `CURRENT_PROJECT_VERSION` lines in target build configs `13B07F94` (Debug) and `13B07F95` (Release); leave project-level `83CBBA20`/`83CBBA21` untouched
- Leave `package.json` / `package-lock.json` at marketing version
- Leave `lib/feedback.ts` and `lib/sentry.ts` string fallbacks aligned with marketing version

### Session opener pattern

- Each session starts in a new chat (cold start).
- This file + Claude memory are source of truth. First message typically pastes or references this handoff.
- Claude should `web_fetch` `https://raw.githubusercontent.com/adgarganese/PlayRate/main/docs/HANDOFF.md` before answering.
- **Trust the handoff over Claude's prior memory** when they disagree. Memory snapshots can lag behind handoff updates by a session or more.

## 7. May 2 session — what was tried, what we know, what we burned

This section exists so tomorrow's session does not repeat any of these.

### Hypotheses tested (and ruled out)

| # | Hypothesis | How tested | Result |
|---|---|---|---|
| 1 | Provisioning / push entitlement | Build 4 with new push-capable Ad Hoc profile | Crashed; signing was correct |
| 2 | expo-updates init | Build 5: disabled updates in `app.json` | Crashed identically |
| 3 | Sentry plugin | Build 5: removed `@sentry/react-native/expo` plugin | Crashed identically |
| 4 | Stale `ios/` from prebuild bot (`301c066`) | Build 6: restored `ios/` from `82f5170` + bumped + added push entitlement | Crashed identically; same frame offsets |
| 5 | Any post-`82f5170` regression in repo | Build 7: hard reset to `82f5170` for ALL tracked files, build numbers bumped to 7 only | Crashed identically; **same source as green build 3** |
| 6 | Phone-side change | Reinstalled the actual build 3 IPA from Expo dashboard | Crashed identically — confirmed phone OS is the variable |

### Build credits spent today: 4

### Key data points

- Build 3 fingerprint: `2950963` (Apr 30)
- Build 7 fingerprint: `c09f3e4` (May 2, identical source) — different fingerprint = EAS toolchain shifted between builds, but this is secondary; the dominant variable is iOS 26.4.2 PAC enforcement.
- Phone: iPhone 14 Pro (`iPhone15,2`), iOS 26.4.2 (build `23E261`).
- Crash queue every time: `expo.controller.errorRecoveryQueue`.
- Crash always at ~780ms after `procLaunch`.

### Files/branches that exist as a result of today

- Branch `backup-before-reset-2026-05-02` at `0b13d28` — preserves recent JS work; not on origin.
- Untracked files in working tree: `ios-diff.txt`, `ios-final-diff.txt` (diagnostic dumps; can be deleted).
- GitHub workflow `prebuild-ios.yml` — disabled in UI, file still in repo.

## 8. Verification before completing this handoff

1. ✅ HEAD on main is `e54cfe8` (`git log -1 --oneline`)
2. ✅ Recovery branch `backup-before-reset-2026-05-02` exists at `0b13d28` (`git branch -v`)
3. ✅ Working tree clean of code changes (`git status` — only ios-diff.txt / ios-final-diff.txt untracked)
4. ✅ `app.json` ios.buildNumber = "7", android.versionCode = 7
5. ✅ `ios/PlayRate/Info.plist` CFBundleVersion = 7
6. ✅ `ios/PlayRate.xcodeproj/project.pbxproj` CURRENT_PROJECT_VERSION = 7 in target Debug + Release
7. ✅ `prebuild-ios.yml` workflow disabled in GitHub UI
