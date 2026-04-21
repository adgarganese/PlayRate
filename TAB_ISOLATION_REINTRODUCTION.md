# Tab bar isolation: reintroduction order

Use this after you confirm whether the **plain tab shell** (current `app/(tabs)/_layout.tsx`) is tappable in TestFlight.

## Baseline (current state)

- `app/(tabs)/_layout.tsx`: Default Tabs only. No AppErrorBoundary, no screenListeners, no elevation/zIndex/overflow/sceneStyle/tabBarHideOnKeyboard.
- Root `app/_layout.tsx`: Unchanged (Stack with `gestureEnabled: false` for `(tabs)`).
- Tab screens: Still the real screens (Home, Highlights, etc.) using Screen/KeyboardScreen.

## Optional: purest test (navigator only)

If the baseline still fails, the problem may be in screen content or root. To test **navigator only**:

1. In `app/(tabs)/index.tsx`, at the top of the component, add:  
   `import { TabBaselinePlaceholder } from '@/components/TabBaselinePlaceholder';`  
   and make the component return `<TabBaselinePlaceholder />` (comment out the real Home UI).
2. Build and test. If tabs work with this placeholder, the failure is in **screen-level** content/wrappers. If they still fail, the failure is **root/navigator-level**.

## Reintroduction order (add one layer, build, test)

Add back in this order. **Stop at the first layer that makes tab bar taps fail again** — that layer is the culprit.

### 1. Current tab layout styling

**File:** `app/(tabs)/_layout.tsx`

Add back to `screenOptions`:

- `tabBarStyle`: `elevation: 9999`, `zIndex: 9999`, `overflow: 'hidden'`
- `tabBarHideOnKeyboard: true`
- `sceneStyle: { zIndex: -1 }`

**If this breaks:** Failure is **navigator-level** (tab bar / scene styling). Fix: keep default tab styling; do not reintroduce elevation/zIndex/sceneStyle/tabBarHideOnKeyboard.

---

### 2. Root stack behavior around (tabs)

**File:** `app/_layout.tsx`

Ensure `(tabs)` still has `gestureEnabled: false`. If you had changed anything else for tabs (e.g. animation, presentation), restore it here.

**If this breaks:** Failure is **root-layout-level**. Fix: keep minimal Stack options for `(tabs)`.

---

### 3. Shared wrappers / providers around tabs

**File:** `app/(tabs)/_layout.tsx`

Wrap `<Tabs>` with:

- `<AppErrorBoundary ... onSignOut={handleErrorSignOut}>` (and restore `useRouter`, `handleErrorSignOut`, `screenListeners` for haptics if desired).

**If this breaks:** Failure is **provider-level** (error boundary or its tree). Fix: remove AppErrorBoundary from around Tabs or move it elsewhere.

---

### 4. Real tab screens

Ensure all tabs use the real screens (no placeholder). Already true if you didn’t use the purest test, or revert index to real Home.

**If this breaks:** Failure is **screen-level** (one or more screens’ content or wrappers). Then narrow to which screen(s) by replacing one tab at a time with `TabBaselinePlaceholder`.

---

### 5. Overlays / loading states

Use screens that show overlays or loading (e.g. Find Courts loading, Court detail modals). No code change if already on real screens.

**If this breaks:** Failure is **screen-level** (overlay or loading blocking tab bar). Fix: constrain overlays so they don’t cover the tab bar, or simplify loading UI.

---

### 6. Keyboard behavior

Restore or add `tabBarHideOnKeyboard: true` if not already in step 1.

**If this breaks:** Failure is **navigator-level** (keyboard + tab bar). Fix: leave tab bar visible when keyboard is open or handle differently.

---

### 7. Custom header / right-side logic

Use screens with custom headers and right-side icons (e.g. Profile, Home). No layout change unless you had stripped them.

**If this breaks:** Failure is **screen-level** (header/rightElement). Fix: adjust header/rightElement so they don’t capture or cover tab bar taps.

---

### 8. Any remaining tab customization

Anything else you had (e.g. extra screenListeners, other tabBarOptions). Add last.

---

## Summary

- **A. Did the plain tab shell isolate the issue?**  
  You’ll know after testing the current build: tabs either work (yes) or don’t (no; then try the purest test).

- **B. First layer that reintroduced the failure**  
  The step number and name from the list above where taps failed again.

- **C. Exact file(s) involved**  
  The file(s) you changed in that step (e.g. `app/(tabs)/_layout.tsx`).

- **D. Exact fix from baseline**  
  Permanently keep the baseline for that layer (see “Fix” in each step) and do not reintroduce the breaking option.

- **E. Temporary code for isolation**  
  Current `_layout.tsx` (minimal Tabs) and, if used, `TabBaselinePlaceholder` in index.

- **F. What stays vs what reverts**  
  - **Keep:** Minimal tab layout and any layer that did not break taps.  
  - **Revert:** Only the specific option(s) in the first layer that caused the failure; keep the rest of the app as-is.
