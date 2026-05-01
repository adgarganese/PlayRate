# PlayRate Handoff

> Single source of truth for current project state. Updated at end of every working session. For tactical details (how a specific fix was implemented, what was tried), prompt Cursor — this doc is state, not history.

_Last updated: 2026-04-30_  
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
