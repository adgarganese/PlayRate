# PlayRate Handoff

> Single source of truth for current project state. Updated at end of every working session. For tactical details (how a specific fix was implemented, what was tried), prompt Cursor — this doc is state, not history.

_Last updated: 2026-04-30_  
_Last commit at update: `5793341` — chore(cleanup): remove orphan modal styles after cosign modal simplification_

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
- **Latest EAS build:** iOS **preview** — app **1.1.2**, native build **4**, git **`5793341`**, status **`NEW`** (queued / not yet finished at handoff time). Confirm final status and artifact in [Expo dashboard](https://expo.dev) → project **playrate** → Builds.
- **Working on device:** Prior builds through **1.1.2 (3)** exercised core flows; **1.1.2 (4)** is intended to validate **managed prebuild** (fixes native module drift, e.g. `@react-native-community/slider` / `RNCSlider`) plus recent UI fixes — **confirm on the completed **4** binary**.
- **Pending verification:** Smoke-test **1.1.2 (4)** on iPhone: tabbed scroll / create-highlight bottom clearance, cosign card + modal layout, self-rating / court rating sliders. Optional: caption field with keyboard open on create-highlight (no `KeyboardAvoidingView` yet — add only if occlusion reproduces).

## 4. Latest session summary

- **`5793341`** — Removed unused `CosignModal` stylesheet keys; keeps bundle tidy after cosign UI work.
- **`a10f29f`** — Create-highlight scroll padding clears the floating tab bar (`useScrollContentBottomPadding` + defensive floor in `create.tsx`).
- **`7b62f00`** — Cosign on athlete skill cards: larger pill, right-aligned; cosign confirmation modal uses space-between and a larger primary pill.
- **`f9dcca8`** — iOS **managed native**: deleted committed `ios/`, migrated two `Info.plist` usage strings into `app.json`, `.gitignore` `/ios`, bumped to build **4** for a new binary.
- **`82f5170`** — Release chore: **1.1.2 (3)** alignment (superseded by **4** for next store submission).

## 5. Open work

### Blocking (must fix before next milestone)

- None recorded — **blocker emerges if EAS iOS build 4 fails** or `RNCSlider` / prebuild regression shows up on device; triage in Expo build logs first.

### Active backlog (working on these soon)

- **Remote sync:** As of this handoff, `main` is **up to date with `origin/main`** — confirm after your next local commits.
- **Device pass on build 4:** Confirm prebuild + sliders + scroll + cosign on a physical iPhone (preview or TestFlight).
- **Create-highlight keyboard:** If testers report the caption hidden by the keyboard, add `KeyboardAvoidingView` (or equivalent) — padding fix addressed tab bar only.

### Post-beta backlog (deferred but tracked)

- Universal links / AASA on **playrate.io**; optional hosted Privacy/Terms URLs for `lib/feedback.ts` mailto/form fallbacks.
- Deeper analytics, feedback channel beyond mailto + external form (see prior inventory).

## 6. Working preferences

- **Git:** Batch pushes — typically **end of session** or when explicitly asked; don’t assume every local commit is on `origin`.
- **Pre-TestFlight / build bump SOP:** Update **`app.json`** only for `expo.version`, `expo.runtimeVersion` (when marketing/runtime changes), `expo.ios.buildNumber`, `expo.android.versionCode`. **`package.json` / `package-lock.json`** stay at **marketing** version string. **`lib/feedback.ts`** and **`lib/sentry.ts`** string fallbacks stay aligned with marketing version. **Do not** hand-edit `Info.plist` / `project.pbxproj` — no committed `ios/`.
- **Native modules:** Anything with native code (e.g. community slider) needs **dev client or EAS build**, not Expo Go.
- **Quality bar:** Prefer fixing at the **shared hook / shared component** when the bug is systemic (example: scroll padding hook), then narrow overrides per screen when justified.

---

## Verification before completing

1. **Last commit** matches `git log -1 --oneline`: **`5793341`** — orphan modal styles cleanup. ✓  
2. **Current version** matches `app.json`: **1.1.2**, iOS build **"4"**, Android **4**. ✓  
3. **Latest EAS iOS build** pulled live: **`NEW`** for **`5793341`** / **1.1.2 (4)** at handoff — recheck Expo if status has advanced. ✓  
4. **Section 5** separates verification (§3) from backlog; no duplicate “fix RNCSlider” items — prebuild migration addresses that once build 4 is green. ✓  
