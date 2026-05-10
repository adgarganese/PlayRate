# Post-mortem: PlayRate iOS Launch Crash Investigation

**Resolved:** 2026-05-07
**Investigation duration:** May 1 – May 7, 2026 (7 days, ~6 working days)
**Resolution commit:** `209e81d`

## TL;DR

PlayRate's iOS preview builds began crashing on launch on May 1, 2026, during routine pre-beta work. The crash signature was an `EXC_CRASH/SIGABRT` on `expo.controller.errorRecoveryQueue` — visually identical to several published Expo SDK 54 issues — and was misattributed for five days to an upstream iOS 26.4.2 / Hermes pointer-authentication bug.

The actual root cause was a single anti-pattern in `lib/config.ts`: the file read `EXPO_PUBLIC_*` environment variables via dynamic indexing (`const env = process.env; ... env[envKey]`) rather than static member access (`process.env.EXPO_PUBLIC_NAME`). Babel's `expoInlineEnvVars` plugin can only inline static AST patterns. Dynamic indexing is invisible to it. Every preview and production build for the entire 1.1.2 series shipped with empty Supabase credentials baked into the JS bundle. `lib/supabase.ts` threw `"Missing Supabase configuration"` at module-import time, before any UI rendered. `expo-updates` caught the throw and re-raised it on its error-recovery queue, producing the documented `errorRecoveryQueue` crash signature that obscured the underlying cause.

The fix was a rewrite of `lib/config.ts` to use static `process.env.EXPO_PUBLIC_*` accesses at every call site. Build 9 (commit `209e81d`) launched cleanly on the test device.

**Cost:** ~6 working days, 14+ EAS iOS preview builds, measurable operator frustration, and one beta-launch slip.

**Single biggest leverage point missed:** capturing device console logs on day 1 via `Console.app` on a Mac would have surfaced the actual JS error string within minutes and very likely shortened the path significantly. Device logs were not captured until day 7.

## Root cause (technical)

Two independent failures contributed. They must be distinguished, because future debugging sessions will encounter the same fork:

- **(a) Operator/config bug:** EAS environment variables had been set with malformed values. The literal string `"EXPO_PUBLIC_SUPABASE_URL= https://nhqhkwvmludnsblimjeu.supabase.co"` had been pasted into the *value* field of `EXPO_PUBLIC_SUPABASE_URL`. The production `EXPO_PUBLIC_POSTHOG_API_KEY` had a trailing `--environment` suffix from a CLI mishap.
- **(b) Engineering bug:** `lib/config.ts` used dynamic `env[envKey]` indexing, which `babel-preset-expo`'s `expoInlineEnvVars` plugin cannot match. Even with clean EAS env values, the bundle would have contained no env literals, because Babel never matched the AST pattern.

Commit `63df4b3` (May 7, 13:22) fixed (a). The crash persisted. Commit `209e81d` (May 7, 14:02) fixed (b). The crash required both fixes to land. A "clean the EAS env, the build still crashes" moment is not evidence the config was a red herring — it is evidence that two independent bugs were stacked.

### The bug

In `lib/config.ts`, every `EXPO_PUBLIC_*` env var was read through an indirection:

```typescript
const env = typeof process !== 'undefined' ? process.env : {};

function get(key: string, envKey: string, fallback: string): string {
  const fromExtra = (extra as any)[key];
  const fromEnv = (env as any)[envKey];   // ← dynamic indexing
  // ...
}
```

The pattern Babel's `expoInlineEnvVars` plugin matches is specifically `process.env.EXPO_PUBLIC_<NAME>` as a static MemberExpression on the `process.env` object, where `<NAME>` is a string literal at the AST level. The plugin's visitor:

```js
MemberExpression(path, state) {
  if (path.get('object').matchesPattern('process.env')) {
    const key = path.toComputedKey();
    if (t.isStringLiteral(key) &&
        !isFirstInAssign(path) &&
        key.value.startsWith('EXPO_PUBLIC_')) {
      // ... replace with literal value
    }
  }
}
```

`env[envKey]` fails this check on two counts: the object is the local identifier `env`, not `process.env`, and the key is a runtime variable, not a string literal. So Babel never matched, never inlined, and the production iOS bundle had no `EXPO_PUBLIC_*` literals at all.

### The downstream chain

1. Bundle contains no `EXPO_PUBLIC_SUPABASE_URL` literal → `lib/config.ts`'s `get()` returns `''` from the fallback path.
2. `lib/supabase.ts` runs at top of import graph (loaded via TWO static paths from `app/_layout.tsx`: a direct `import { supabase } from '@/lib/supabase'` AND transitively via `contexts/auth-context.tsx`).
3. `if (!url || !anonKey) throw new Error('Missing Supabase configuration...')` fires synchronously at module evaluation, ~1.4 seconds after process launch.
4. The unhandled exception is caught by React Native's `RCTFatal` handler.
5. `expo-updates`' error-recovery infrastructure wraps `RCTFatal` and re-raises on `expo.controller.errorRecoveryQueue`.
6. No Objective-C handler exists on that queue → `std::terminate` → `abort()` → `EXC_CRASH/SIGABRT`.

This pattern appears in expo/expo issues #21421, #21835, #24624, and #33737 (same symptom class — SIGABRT on ErrorRecovery). Issue #38108 shares the SIGABRT/ErrorRecovery symptom but represents a different underlying cause (a `require` ReferenceError via `Updates.reloadAsync`); it is related machinery, not the same failure mode.

### The regression: how the bug became visible

The dynamic-indexing pattern had been in `lib/config.ts` since the 1.0.0 production era. At commit `d3d6b7c` (the last green production tag, March 2026, builds 19–27 on TestFlight under marketing version 1.0.0), the same pattern was present:

```typescript
const env = typeof process !== 'undefined' ? process.env : {};

function get(key: string, envKey: string, fallback: string): string {
  const value = (extra as any)[key] ?? (env as any)[envKey] ?? fallback;
  // ...
}

export const supabaseUrl = get(
  'supabaseUrl',
  'EXPO_PUBLIC_SUPABASE_URL',
  'https://nhqhkwvmludnsblimjeu.supabase.co'   // ← hardcoded fallback
);
```

The hardcoded URL fallback was the safety net. Babel never inlined the env value, but the third argument to `get()` always supplied a working URL anyway. The bug was latent and silent.

Commit `f0a752a` (April 21, 2026) was a large multi-file pre-beta refactor commit. Among its changes, the regression-relevant hunk on `lib/config.ts` removed the safety net:

```diff
 export const supabaseUrl = get(
   'supabaseUrl',
   'EXPO_PUBLIC_SUPABASE_URL',
-  'https://nhqhkwvmludnsblimjeu.supabase.co'
+  ''
 );
```

The intent was apparently-defensive: remove a hardcoded credential from source. The change required Babel inlining to actually populate the value at runtime. Because dynamic indexing silently bypassed Babel inlining, removing the hardcoded fallback exposed the latent bug. From `f0a752a` forward, every preview and production build of the 1.1.2 series shipped with empty Supabase config baked into the bundle.

The investigation began May 1 because that is when iOS launch testing of the 1.1.2 series resumed. The bug-in-its-fully-broken-form had been latent in `main` since April 21 — ten days of merged work sitting on top of a build that, had anyone tried to launch it, would have crashed.

**Lesson, in one line:** you cannot safely remove a hardcoded fallback unless its replacement actually works at runtime — and "actually works" depends on toolchain machinery (Babel transform passes) that is invisible from the source code level.

**Known unknown.** At `d3d6b7c`, `supabaseUrl` had a hardcoded URL fallback, but `supabaseAnonKey` already had `''` as its fallback. `lib/supabase.ts`'s check is `if (!url || !anonKey)` — meaning a missing anon key alone would still have thrown. Yet 1.0.0 production builds (TestFlight 19–27, March 2026) shipped and ran. That means EAS production env at the time *was* supplying a non-empty anon key via some path. Plausible hypotheses, none of which are verified:

- EAS env values at the time were clean, AND something about the 1.0.0 build pipeline was inlining them via a different code path (e.g., Expo CLI's bundler stage rather than `babel-preset-expo`, or a different Metro config).
- `lib/supabase.ts`'s validation check was different in March 2026 (e.g., warned but did not throw).
- Production builds at that time used a different config-loading flow that bypassed `lib/config.ts` entirely.

This is flagged as a known-unknown rather than resolved here. Resolving it would require checking out `d3d6b7c`, building a production iOS bundle locally with the March-era EAS env, and inspecting the result. That work has not been done and is not blocking — but if the same investigator hits a similar "this used to work, what changed" puzzle, this is the unresolved thread.

### The fix

`lib/config.ts` was rewritten so every `EXPO_PUBLIC_*` value reaches Babel as a static MemberExpression. The helper signatures change from `(key, envKey, fallback)` to `(extraKey, envValue, fallback, warnEnvKey)`, with the env value passed by the caller as `process.env.EXPO_PUBLIC_NAME`:

```typescript
export const supabaseUrl = pickExtraOrEnv(
  'supabaseUrl',
  process.env.EXPO_PUBLIC_SUPABASE_URL,   // ← literal AST member expression
  '',
  'EXPO_PUBLIC_SUPABASE_URL'
);
```

Nine `EXPO_PUBLIC_*` variables now appear as static literal accesses in the file. Babel inlines each at build time.

Verified empirically: build 9's `main.jsbundle` contains the literal Supabase project ref (`nhqhkwvmludnsblimjeu`), the anon key prefix (`sb_publishable_QPSR2PT0BZAvw`), and the PostHog key prefix (`phc_vamGj9VpDGcG`). The string `process.env.EXPO_PUBLIC_SUPABASE_URL` does not appear in the bundle — confirming Babel replaced the access with the inlined literal.

## Timeline

Times in `America/New_York`. Commits and build IDs verified from `git log` and `eas-cli build:list`.

### Pre-incident context

Last green production build before the incident: 2026-03-10 (EAS build `e77fe110`), version `1.0.0 (27)`, built from commit `d3d6b7c`. PlayRate had a working production app shipped to TestFlight prior to this investigation (TestFlight builds 19–27 under 1.0.0). The latent dynamic-indexing bug existed at `d3d6b7c` but was masked by the hardcoded URL fallback (see *The regression* above). Commit `f0a752a` (April 21, 2026) removed that fallback. The investigation began May 1 because that is when iOS launch testing of the 1.1.2 series resumed; the bug had been live in `main` since April 21.

### May 1 — Day 1

| Time  | Event |
|-------|-------|
| 14:34 | Build at commit `e49ac86`, version 1.1.2 (4). ERRORED. |
| 14:47 | `7ff6270` "un-ignore /ios so committed native project skips EAS prebuild". Build `bf98bd38`, finished. **Crashes on device.** |
| 15:01 | Build `29a66b32` at `301c066` ("add ios from prebuild"), finished. Crashes. |
| 16:16 | `e5c28ec` "fix(diag): disable EXUpdatesEnabled". Build `338fb506`, finished. Crashes. |
| 16:22 | Build `f8048443` at `e5c28ec`, finished (duplicate trigger). Crashes. |
| 18:00 | `091c5ea` "docs(handoff): preview build crashes on launch, unresolved". Build `de2c818e`, finished. Crashes. |

Day 1: 6 builds (1 errored, 5 crashing artifacts). The "disable EXUpdatesEnabled" diagnostic was an early attempt to rule out expo-updates involvement; whether the disable took effect natively was never end-to-end verified.

### May 2 — Day 2

| Time  | Event |
|-------|-------|
| 13:01 | `7b2b42f` "disable updates and remove Sentry plugin to isolate launch crash". |
| 13:04 | Build `7ee9a9d7` at `7b2b42f`. ERRORED. |
| 13:17 | Build `15816975` at `7b2b42f`, finished. Crashes. (build 5) |
| 14:06 | `0b13d28` "restore green build 3 native config + push entitlement, bump to build 6". |
| 14:09 | Build `f11f1723` at `0b13d28`, finished. Crashes. (build 6) |
| 15:09 | `e54cfe8` "hard reset to 82f5170 (green build 3) + bump to build 7". |
| 15:12 | Build `82c452dc` at `e54cfe8`, finished. Crashes. (build 7) |
| 15:54 | `fbad48b` "docs(handoff): beta blocked on upstream Expo SDK 54 + iOS 26.4.2 Hermes PAC bug". |
| 16:07 | `496fdc2` "docs(handoff): add section 9 — beta-quality scope and launch decision tree". |

Day 2: 4 builds (1 errored, 3 crashing). A 6-row diagnostic hypothesis-elimination table was constructed (see Appendix B). The conclusion — "every reasonable code-side hypothesis is ruled out; therefore the cause must be upstream (iOS 26.4.2 / Hermes PAC bug, expo/expo#44356)" — was written into HANDOFF.md Section 2 and used as the operative model for the next 4 days. It was wrong on the specific upstream issue and on the underlying cause.

The "build 3 IPA reinstalled today crashes identically" observation was correct but its interpretation was wrong — the binary was the same, but the missing env vars were the same too, so reinstalling produced the same crash for reasons unrelated to iOS version.

### May 3 — Day 3

No code commits, no builds. One docs commit: `8980261` "Section 10 corrections".

Section 10 made three correct corrections to Section 2:
1. The recovery branch had no unique commits.
2. The crash fingerprint did **not** match #44356 PAC. The fingerprint was correctly identified as expo-updates' `errorRecoveryQueue` rethrow path. Zero hermesvm frames in the crash → JS engine wasn't faulting; something earlier was throwing.
3. The "single experiment never run" was: install build 7 IPA on a non-iOS-26.4.2 device.

Section 10 correctly identified the rethrow stack pattern. **It did not connect this to the implication that the underlying error message was logged but not yet captured.** That insight sat unrecognized for 4 more days.

### May 5 — Day 4

| Time  | Event |
|-------|-------|
| 12:02 | Resign of build 7 (`21418991`) at `e54cfe8`, finished. Same fingerprint as original. |
| 13:01 | Resigned IPA installed on iPhone 16 Plus running iOS 26.3.1 (different chip family, different OS version, fresh device). **Crashes identically.** |

Day 4: 1 build (resign, counts as a credit).

The resign was a test of the iOS-26.4.2-is-the-variable hypothesis. Outcome: refuted. iOS version is not the variable.

The session ended with the hypothesis dead but no replacement hypothesis. HANDOFF.md was not updated to reflect the disconfirmation; Section 2 still claimed the wrong hypothesis as operative.

### May 7 — Day 5: Resolution

| Time  | Event |
|-------|-------|
| ~10:30 | New session opens. Confirms Section 10 corrections. |
| ~11:30 | Investigation pivots to "capture the underlying error message via device logs." Discusses idevicesyslog from Windows (iOS 26 risk) vs Mac Console.app. |
| ~12:00 | Operator goes to a Mac with iPhone 14 Pro. Captures Console.app log during crash reproduction. |
| ~12:15 | Log reveals: `error PlayRate Unhandled JS Exception: Error: Missing Supabase configuration. Make sure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set...` |
| ~12:30 | Initial diagnosis: malformed EAS env vars (half-correct — separate operator config bug, not root cause). |
| 13:22 | Commit `63df4b3` "fix(env+sentry+ci): clean malformed EAS env, fix Sentry slug, ci skip-guard, bump to build 8". |
| 13:30 | Build `cc82b46a` at `63df4b3`, build 8, finished. |
| ~13:45 | Bundle inspection of build 8 returns no Supabase project ref. Initial interpretation incorrect — assumed env vars still missing from build context. (They were present; Babel had not inlined them. The grep methodology was also broken — see below.) |
| ~14:00 | Cross-checked with IDE agent. IDE agent reads `babel-preset-expo` source and identifies the actual bug: dynamic indexing in `lib/config.ts` cannot be matched by `expoInlineEnvVars`. |
| 14:02 | Commit `209e81d` "fix(config): static process.env.EXPO_PUBLIC_* for babel inlining, bump to build 9". |
| 14:03 | Build `b79a5e46` at `209e81d`, build 9, finished. |
| ~14:10 | Bundle inspection of build 9 again returns "no matches" — initially interpreted as fix not landing. |
| ~14:15 | Cross-checked with IDE agent again. IDE agent identifies the bundle-grep methodology bug: `Select-String -Pattern "a|b|c" -SimpleMatch` treats `\|` as literal character, not regex alternation. Per-pattern grep confirms env values **are** in the bundle. |
| ~14:20 | Build 9 IPA installed on iPhone 14 Pro. **App launches successfully.** |
| 15:17 | Commit `6ae38ef` "chore(release): bump to 1.1.3 (build 28) for first TestFlight of 1.1.3 series". |
| 15:20 | Production build `fb162cce` at `6ae38ef` queued. |
| ~15:29 | Production build finished. `eas submit` to ASC succeeded (submission `b2117e7f`). |
| 20:36 | Guardrail block added to top of HANDOFF.md (`0edd4b3`). All commits pushed to origin. |

Day 5: 3 builds (build 8, build 9, plus production build 28). Total May iOS builds: ~15. The investigation consumed effectively the entire May EAS free-tier quota.

## Wrong paths

Four hypotheses were treated as operative or live during the investigation and turned out to be wrong. Each is broken down by (1) the incorrect conclusion, (2) why it was plausible at the time, (3) what disproved it, (4) what to do next time.

### The iOS 26.4.2 / Hermes PAC bug (expo/expo#44356)

1. **Conclusion:** The crash was caused by an upstream Hermes pointer-authentication bug specific to iOS 26.4.2 on A17/A18 chips, exactly matching the open issue #44356.
2. **Plausible because:** The crash signature (`EXC_CRASH/SIGABRT`, no Hermes frames in the stack) loosely matched the public reports. The test device had iOS 26.4.2 installed. After May 2's hypothesis-elimination table appeared to rule out every code-side cause, an upstream/OS cause was the remaining candidate by elimination.
3. **Disproved by:** May 5, 13:01 — installing the same IPA on iPhone 16 Plus running iOS 26.3.1 (different chip family, different OS) reproduced an identical crash.
4. **Next time:** A hypothesis that points outward (upstream, OS, vendor) is exactly the kind of hypothesis that demands a falsification test before being elevated to operative status. The cross-device test was cheap (one device, no build credit) and should have been the very first step after the hypothesis was formed on May 2 — not the step taken three days later.

### The managed-prebuild migration (commit `301c066`) as trigger

1. **Conclusion:** The recently-committed `ios/` directory from `expo prebuild` had introduced something subtly broken; reverting native config to a known-green snapshot would fix the launch.
2. **Plausible because:** `301c066` was the most recent significant native-side change before the crashes started. The mental model "what changed?" pointed there first.
3. **Disproved by:** May 2, 14:06 (`0b13d28`) — restoring `ios/` from the green build-3 baseline and rebuilding still crashed. Then May 2, 15:09 (`e54cfe8`) — hard-resetting to `82f5170` (the green build-3 commit itself) still crashed. Two consecutive disconfirmations on the same day.
4. **Next time:** The confounder was that the JS bundle, not the native shell, was carrying the bug. Resetting native config preserved the broken bundle. When a "what changed" answer points to one layer (native), test by varying *only* that layer while holding the JS bundle constant — and vice versa. The May 2 reset accidentally varied both at once, so the negative result didn't isolate the layer.

### The `backup-before-reset-2026-05-02` recovery branch as containing unique work

1. **Conclusion:** Before the May 2 hard reset, the branch `backup-before-reset-2026-05-02` was assumed to contain commits that would not survive the reset and would need to be cherry-picked back.
2. **Plausible because:** The branch was created defensively at `0b13d28`. Without checking, it felt like the kind of safety net that is later discovered to actually contain something.
3. **Disproved by:** May 3 (Section 10 corrections, commit `8980261`) — `git log` confirmed single linear history. The backup branch was a no-op marker, not divergent work.
4. **Next time:** "I created a safety branch in case" should be paired with "and here is what `git log backup-branch ^main` says" before the branch is treated as containing unrecovered work. This took 24 hours to verify. The verification is two seconds.

### iOS version as the variable

1. **Conclusion:** Something specific about iOS 26.4.2 was the trigger.
2. **Plausible because:** The test device had iOS 26.4.2; the Expo PAC bug was OS-version-correlated; "device-side change" was the last place left after the May 2 elimination table.
3. **Disproved by:** May 5, 13:01 — same fingerprint on iOS 26.3.1.
4. **Next time:** Same lesson as the upstream-bug case. Cross-device testing across at least one OS-version delta is part of the launch-crash baseline kit, not a late-stage falsification step.

## Near misses and delayed connections

Several pieces of correct information were collected during the investigation but their full implications were not drawn out for days.

**The errorRecoveryQueue rethrow pattern was identified May 3, but the implication was missed until May 7.** Section 10 (`8980261`) correctly observed that the crash sat on `expo.controller.errorRecoveryQueue` and that this was `expo-updates`' wrapper around an underlying error, not a native fault. That observation is one inference away from "therefore the underlying JS error was logged via `os_log` and is captureable from `Console.app`." That inference was not drawn for four days. The mental energy on May 3 went into correcting Section 2's wrong claims — a defensive activity — rather than chasing the implication forward.

**The May 2 "build 5 disabled updates and still crashed" experiment was over-trusted.** The conclusion drawn was "expo-updates is not involved." But the disable was never end-to-end verified at the native level — no one confirmed that the resulting `.app` bundle actually had `EXUpdatesEnabled` set to false at runtime, or that `expo-updates`' error handlers had actually been removed from the launch sequence. The negative result was treated with more confidence than warranted, and that overconfidence drove the hypothesis space toward upstream causes that turned out to be wrong.

**The "zero Hermes frames in the crash report" observation was correctly made on May 1 and incorrectly interpreted.** The reading at the time was "the JS engine never started." The more accurate reading was "the JS engine started, threw early, and the post-throw stack frame the OS captured is the post-throw stack frame, not the throw site." Hermes frames were absent because by the time the OS sampled the stack, Hermes had already unwound. This is a generic property of JS-error-into-`abort()` paths, not evidence about whether JS ran.

**The crash log's `Last Exception Backtrace` was not fully read.** iOS crash reports include a `Last Exception Backtrace` section that, when an Objective-C exception is involved, contains the actual exception type and message. This was either not present in the captured logs or not consulted; either way the section was not used as a tool. By contrast, the Mac Console.app session on May 7 immediately surfaced the exception string. The same string class is often captured in the crash log itself.

## Tooling and observability gaps

**No working device-log capture path on Windows from day 1.** The operator's primary machine is Windows. iOS device console logs require either a Mac (`Console.app`) or `idevicesyslog` from `libimobiledevice` (which has known compatibility risk on iOS 26). The investigation reached for builds before reaching for logs because reaching for logs was non-trivial on the available hardware. A pre-built workflow — "for iOS launch crashes, the first action is to walk the iPhone to the Mac in the next room and open Console.app" — would have collapsed roughly four days of search.

**Sentry never received an event from any build during the investigation.** This was discovered late, on May 7. The cause: the project name in the Sentry plugin config was `playrate`, but the actual Sentry project is `react-native`. The wrong project name was committed to `app.json` and `ios/sentry.properties` for the duration of the investigation. Any crash that Sentry would have caught was sent to a non-existent project. Even after the project name was corrected on May 7 (`63df4b3`), zero events have been observed in the dashboard — likely because Sentry's React Native SDK initializes from JS, and JS never reached the init call before throwing. Native `AppDelegate.swift` Sentry init is the next-step fix.

**EAS build logs do not surface the values of injected environment variables** (security policy — values would leak in logs). The verification path is bundle inspection of the resulting `main.jsbundle`, not log reading. Multiple times during the investigation, the EAS dashboard was checked, env variable *names* were confirmed present, and that was treated as evidence that the values were being injected. It was not.

**PowerShell `Select-String -Pattern "a|b|c" -SimpleMatch` is silently broken for verification.** With `-SimpleMatch`, the `|` character is matched literally, not as regex alternation. So a pattern containing three substrings separated by `|` finds none of them when none of the joined-with-pipes string appears in the file. On May 7, this caused the assistant to twice misdiagnose successful builds 8 and 9 as still-failing builds. The IDE agent caught the methodology bug on the second occurrence at ~14:15. Per Appendix C, the corrected workflow runs one pattern per `Select-String` invocation.

**Cursor agent transcripts at `C:\Users\burto\.cursor\projects\...\agent-transcripts\` were not consulted during this investigation.** The standing workflow rule is to fetch them before generating hypotheses on multi-day bugs. They were not fetched at the start of any of the five sessions. Whether the historical transcripts would have surfaced the dynamic-indexing pattern earlier is unknown, but the workflow rule existed precisely for this case and was not followed.

## Verification ladder

A rough ranking of investigation actions, cheapest to most expensive in time and EAS credit:

1. **Capture device logs** — free, ~15–30 min one-time setup, no credits, surfaces the actual error string. Requires a Mac for the Windows-primary operator, but the Mac was physically available the whole time.
2. **Bundle inspection of an existing failing artifact** — free, no credits, no rebuild. Unzips an IPA, greps `main.jsbundle`. Disambiguates "is the env variable in the bundle" definitively.
3. **EAS `build:list` / dashboard env inspection** — free, no credits. Confirms what *names* are configured. Does not confirm injection (see above).
4. **Targeted code change + new EAS build** — 1 credit per build, ~15–25 min wall clock. Should follow a hypothesis grounded in steps 1–3, not precede them.
5. **Cross-device test** — free if the second device is on hand. The only way to isolate OS-version or chip-family variables.

The investigation followed roughly the inverse order. Step 4 was reached for first; steps 1, 2, and 5 were the last actions taken before resolution. This is the single biggest process error of the investigation.

## Lessons — operational

**Capture device logs first when investigating launch crashes.** Before any rebuild. Before any hypothesis. The Mac walk on May 7 should have been the May 1 morning action.

**Verify before assuming when assistant memory contradicts repo state.** The investigation hit memory-vs-reality drift on the Sentry project name, on the recovery-branch contents, and on whether `[skip ci]` was CI-enforced. Memory is summary, not source of truth. When acting on a memory-derived claim that affects a fix, spend the 30 seconds to check the repo or the dashboard.

**Cross-device testing is part of the launch-crash baseline kit, not a late-stage falsifier.** If a crash hypothesis can be tested by installing the same IPA on a different device, that test should be performed before the hypothesis is committed to operative documentation.

**HANDOFF.md must be updated when a hypothesis is disconfirmed.** The May 2 15:54 commit `fbad48b` wrote the iOS 26.4.2 / PAC hypothesis into the handoff. The May 5 13:01 cross-device test refuted it. The handoff was not updated to reflect the refutation until May 7 20:36 (`0edd4b3`). For roughly two days, the operative document and the operative reality disagreed — and any new session opening on the handoff would have been pointed at the wrong upstream issue.

**One PowerShell command at a time.** Do not chain with `&&`. Capture each output before issuing the next. Two compounding errors during this investigation — the `-SimpleMatch` pattern bug and one duplicate build trigger on May 1 16:22 — would have been visible earlier with output-by-output inspection.

**Propose stop points when fatigue compounds error rate.** Across May 1–7 the assistant generally took pace from the operator. By May 5 there was visible signal — repeated rebuilds without log capture, hypotheses surviving falsification, the same memory drifts recurring — that the next productive action was not another build but a session boundary. The assistant did not propose one.

## Lessons — technical

**Babel's `expoInlineEnvVars` plugin matches a specific AST pattern.** `MemberExpression` on `process.env` with a string-literal key starting with `EXPO_PUBLIC_`. Anything else — local-variable aliases, computed access with a runtime key, destructuring — is silently bypassed. There is no warning, no error, no diagnostic. The bundle simply does not contain the literal.

**React Native release bundles do not reliably expose `EXPO_PUBLIC_*` on `process.env` at runtime.** Expo's intended production path is Babel inlining at bundle time, not runtime injection. A pattern that "works in dev because dev bundlers do something different" is exactly the pattern that ships broken to production.

**`expo-updates`' `errorRecoveryQueue` is a wrapper, not a root cause.** Crashes whose top frame is on this queue are rethrows of an underlying error that the JS layer threw. The underlying error is logged via `os_log` and is visible in `Console.app` and in the iOS crash report's `Last Exception Backtrace` section.

**TestFlight `CFBundleVersion` is monotonic across all marketing versions for a given bundle ID.** When 1.0.0 ended at build 27 and 1.1.3 needed to be a fresh TestFlight upload, build 28 was the only legal next number. Resetting to 1 inside a new marketing version produces an ASC rejection.

**A successful Babel inline produces a specific bundle signature.** The substring of the env value appears as a literal in `main.jsbundle`, AND the literal `process.env.EXPO_PUBLIC_<NAME>` does *not* appear. Both halves of the test matter — value present alone is consistent with a runtime injection path that won't survive in some configurations; runtime reference absent alone could mean Babel inlined, or could mean the access was never there to begin with.

## Anti-pattern catalog

### 1. Generic env getter via dynamic indexing

```typescript
const env = process.env;
function get(envKey: string) { return env[envKey]; }
```

**Why it fails:** `babel-preset-expo`'s `expoInlineEnvVars` plugin matches only static MemberExpression on `process.env` with a string-literal key. Local-variable aliases and computed property access are AST-invisible to the plugin. The resulting bundle contains no env literals and depends on a runtime `process.env` that React Native does not reliably populate.

**What to do instead:** Reference each `EXPO_PUBLIC_*` variable as a literal `process.env.EXPO_PUBLIC_NAME` member expression at every call site that needs it. If a helper function is desired, pass the value, not the key, into the helper — see the `pickExtraOrEnv` pattern in commit `209e81d`.

### 2. Memory-as-source-of-truth

The assistant's persistent memory is a summary. It drifts from repo state. Acting on memory claims without verification produces specific, recurring failures.

Three concrete instances from this investigation:

- **Sentry project name in committed config.** Memory: project named `playrate`. Reality: project named `react-native` (the org is `playrate`, which was correct in committed files; the *project* name was the drifted value). The wrong project name was in `app.json`'s Sentry plugin config and in `ios/sentry.properties` for the duration of the investigation; events Sentry would have caught were sent to a non-existent project. Corrected by the IDE agent on May 7 during the env-cleanup pass (`63df4b3`). Delay between the wrong values entering the repo and correction: weeks (the misnaming predated the investigation; the wrong values were already committed when May 1 began).

- **Recovery branch `backup-before-reset-2026-05-02`.** Memory: contains unique work that needs cherry-picking. Reality: empty — single linear git history, no divergent commits. Corrected by `git log backup-branch ^main` during the May 3 Section 10 corrections work (`8980261`). Delay between memory claim (May 2 reset planning) and verification: ~24 hours. Verification cost: two seconds.

- **`[skip ci]` convention as CI-enforced.** Memory: pushes containing `[skip ci]` are gated by CI workflow guard. Reality: the `eas-preview-build` job had no `[skip ci]` guard until May 7. Corrected by reading `.github/workflows/ci.yml` directly during the May 7 env-cleanup pass; the missing guard was added in the same commit (`63df4b3`). Delay between memory claim and correction: the entire investigation (all `[skip ci]` pushes during May 1–7 were in fact gated only by the `paths-ignore` rule on docs files, not by the commit message).

**What to do instead:** Treat memory as a hypothesis. When acting on a memory-derived claim about org names, branch contents, CI behavior, file paths, version numbers, or workflow state, verify against the repo or the dashboard *before* the claim affects a commit.

### 3. Hypothesis written into HANDOFF before device proof

Commit `fbad48b` (May 2, 15:54) wrote `"beta blocked on upstream Expo SDK 54 + iOS 26.4.2 Hermes PAC bug"` into the handoff. The cross-device test that would have falsified this hypothesis — install the same IPA on a non-iOS-26.4.2 device — happened on May 5 at 13:01. The wrong hypothesis sat in operative documentation for ~3 days before falsification, and ~3 more days after that before the documentation was updated to reflect it (`0edd4b3` on May 7 at 20:36).

**Why it fails:** The handoff is the document the next session reads to orient. A wrong hypothesis written there is loaded into the next session's working memory as fact. The cost of the wrong claim compounds across every session that opens on the stale doc.

**What to do instead:** Hypotheses do not enter the handoff until they have survived at least one falsification test that could have refuted them. Working hypotheses live in the session log; only confirmed (or specifically-falsified) findings cross into the handoff.

### 4. Conflating env presence with env injection

EAS dashboard shows `EXPO_PUBLIC_SUPABASE_URL` configured → assumption that the value is reaching the bundle. The dashboard confirms only that the *name* is configured. Whether the *value* is correct, whether it is being injected during the build, and whether it is being inlined into the JS bundle are three independent questions.

**What to do instead:** Verify by inspecting the resulting `main.jsbundle` (Appendix C runbook). The bundle is the ground truth.

### 5. PowerShell `-SimpleMatch` with `|`-joined patterns

```powershell
Select-String -Path bundle.js -Pattern "supabase|posthog|sentry" -SimpleMatch
```

**Why it fails:** `-SimpleMatch` treats the pattern as a literal string. The `|` character is matched as a literal `|`, not as regex alternation. The query above looks for the literal eight-character string `supabase|posthog|sentry`. Silent zero matches.

**What to do instead:** One pattern per `Select-String` invocation. Or omit `-SimpleMatch` and use proper regex if alternation is desired (with appropriate escaping of any literal regex metacharacters in the targets).

### 6. Bundle name preservation as proof of correctness

After May 2's hard reset to `82f5170` (the green build-3 commit), the assumption was that reproducing the same source tree would reproduce the same build. The build crashed identically anyway. The interpretation reached for was "therefore the bug is not in the source — must be device or OS." The actual reading was "the broken bundle and the green-3 bundle had the same dynamic-indexing pattern; the green-3 bundle had been working only because the EAS env was clean *and* the lookup happened to succeed by some path no longer available in the 1.1.2 series."

**Why it fails:** "Same source produces same build" assumes the build pipeline and its inputs (env, dependencies, toolchain versions) are identical between the two points in time. This investigation crossed a `f0a752a` regression that changed neither the source at the relevant call site nor the green-3 commit — but did change the configuration semantics by removing the safety-net fallback.

**What to do instead:** When reproducing a known-green commit and getting a crash, do not conclude "the source is fine." Verify that the green commit, *re-built today*, still produces a launching artifact. If yes, the regression is in the code. If no, the regression is in the build environment or its inputs (env, dependencies, EAS config).

### 7. Pace inherited from operator without proposed stop points

When an investigation accumulates failed builds, repeated memory drifts, and hypotheses surviving falsification, the next productive action is often a session boundary, not another command. The assistant has visibility into the failure pattern across the session that the operator may not have in the moment. Proposing "stop here, next session, capture device logs first thing" is a legitimate move and was not made during May 1–5.

**What to do instead:** When the same class of error recurs three times in a session, surface the pattern explicitly and propose a stop. The session boundary is cheaper than the next build.

## Cost

| Category | Quantity |
|---|---|
| Working days | 6 (May 1, 2, 3, 5, 7) |
| EAS iOS builds attributable to investigation | ~14 preview + 1 production |
| Builds that ERRORED before producing artifact | 3 (May 1 14:34, May 2 13:04, plus an April 30 errored build at the version 1.1.2 boundary) |
| Builds that produced a crashing artifact | 11 |
| Builds that produced a launching artifact | 1 (build 9 / `b79a5e46`) |
| Beta launch slip | ≥ 1 week |
| HANDOFF.md drift | Section 2's wrong hypothesis sat as operative for 4 days |

## Follow-ups (deferred work)

Top of next session list:
1. Add tester to TestFlight (after Apple processing email arrives).
2. Sentry: confirm crash events flow to `playrate/react-native` dashboard from a real device crash. If not, native `AppDelegate.swift` Sentry init may be required for pre-JS coverage.
3. Verify production `EXPO_PUBLIC_POSTHOG_API_KEY` (was previously corrupted with `--environment` suffix; cleaned during this session) lands clean in next production build's bundle.
4. Restructure HANDOFF.md to remove or quarantine sections 2/7/9 (currently contain the wrong iOS-26.4.2 hypothesis, partially superseded by Section 10 and now by this post-mortem).

Lower priority:
- Sentry native AppDelegate.swift init for true pre-JS native crash capture
- Google Cloud Console for Maps/Places/Geocoding API keys (Android-launch blocker)
- Patch-version drift per `expo-doctor` (8 packages out of date)
- Schema-drift cleanup post-beta
- Resolve the 1.0.0-production known-unknown (see *The regression* in Root Cause): how did builds 19–27 ship with `''` as the anon-key fallback and run successfully? Checking out `d3d6b7c` and reproducing a production bundle locally would resolve it.

## Appendices

### Appendix A — Git log of investigation period

```
0edd4b3 docs(handoff): add 2026-05-07 EOD status guardrail block at top [skip ci]
6ae38ef chore(release): bump to 1.1.3 (build 28) for first TestFlight of 1.1.3 series [skip ci]
209e81d fix(config): static process.env.EXPO_PUBLIC_* for babel inlining, bump to build 9 [skip ci]
63df4b3 fix(env+sentry+ci): clean malformed EAS env, fix Sentry slug, ci skip-guard, bump to build 8 [skip ci]
8980261 docs(handoff): 2026-05-03 EOD — Section 10 corrections [skip ci]
496fdc2 docs(handoff): add section 9 — beta-quality scope and launch decision tree [skip ci]
fbad48b docs(handoff): 2026-05-02 EOD — beta blocked on upstream Expo SDK 54 + iOS 26.4.2 Hermes PAC bug [skip ci]
e54cfe8 build: hard reset to 82f5170 (green build 3) + bump to build 7
0b13d28 fix(ios): restore green build 3 native config + push entitlement, bump to build 6
7b2b42f fix(ios): disable updates and remove Sentry plugin to isolate launch crash
091c5ea docs(handoff): 2026-05-01 — preview build crashes on launch, unresolved
e5c28ec fix(diag): disable EXUpdatesEnabled to bypass launch crash for diagnostic
301c066 chore: add ios from prebuild [skip ci]
7ff6270 chore(ios): un-ignore /ios so committed native project skips EAS prebuild
```

### Appendix B — May 2 diagnostic hypothesis table

(Each row's "Result" was correctly observed but incorrectly attributed to "code-side cause ruled out" — none of these tests actually disprove the eventual root cause.)

| # | Hypothesis | How tested | Result |
|---|---|---|---|
| 1 | Provisioning / push entitlement | Build 4 with new push-capable Ad Hoc profile | Crashed |
| 2 | expo-updates init | Build 5 with updates.enabled false | Crashed identically |
| 3 | Sentry plugin | Build 5 with @sentry/react-native/expo plugin removed | Crashed identically |
| 4 | Stale ios/ from prebuild bot (301c066) | Build 6: restored ios/ from 82f5170 baseline | Crashed identically |
| 5 | Any post-82f5170 regression | Build 7: hard reset to 82f5170 | Crashed identically |
| 6 | Phone-side change | Reinstalled the actual build 3 IPA | Crashed identically — interpreted as confirming phone OS as variable |

### Appendix C — Bundle verification runbook (Windows)

```powershell
# 1. Download IPA from EAS dashboard.
# 2. Copy with .zip extension and extract.
Copy-Item "C:\Users\burto\Downloads\application-<id>.ipa" "C:\Users\burto\Downloads\build.zip"
Expand-Archive -Path "C:\Users\burto\Downloads\build.zip" -DestinationPath "C:\Users\burto\Downloads\build_extracted"

# 3. Run ONE pattern per Select-String. Do NOT use "a|b|c" patterns with -SimpleMatch
#    (the | is treated as a literal character, not regex OR — silent false negatives).
Select-String -Path "C:\Users\burto\Downloads\build_extracted\Payload\PlayRate.app\main.jsbundle" -Pattern "<unique substring>" -SimpleMatch

# 4. Negative check — confirm runtime reference absent (i.e. Babel inlined):
Select-String -Path "...\main.jsbundle" -Pattern "process.env.EXPO_PUBLIC_<NAME>" -SimpleMatch
```

A successful inline produces: substring of the value matches; the literal `process.env.EXPO_PUBLIC_<NAME>` does NOT appear in the bundle.

### Appendix D — Source materials

- IDE agent (Cursor) transcripts for May 1–7 are stored locally at `C:\Users\burto\Scratch\transcripts_extracted\`. Not committed (contain auth tokens and other sensitive content).
- HANDOFF.md sections 1–9 (pre-May 7) preserved with the supersession warnings noted in Section 10 and elaborated here.
- Build artifacts from this investigation expire 88 days after creation. The May 7 IPAs (`b79a5e46`, `fb162cce`) will remain available through ~August 2026.
