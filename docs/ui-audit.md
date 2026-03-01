# UI/UX Audit & Cleanup Report

## Executive Summary

This document outlines inconsistencies found across the app and the cleanup/standardization plan. The audit covers UI uniformity (Goal A) and code quality (Goal B).

---

## GOAL A: UI/UX Uniformity Audit

### 1. COLOR INCONSISTENCIES

#### Hardcoded Hex Colors Found:
- **`components/ui/Button.tsx`** (Lines 50, 57)
  - `color: '#FFFFFF'` - Should use theme token for white text
  - **Fix**: Use `colors.text` with conditional or add `colors.textOnPrimary` token

- **`app/self-ratings.tsx`** (Line 456)
  - `color: '#FFFFFF'` - White text on badge
  - **Fix**: Use theme token or create `colors.textOnPrimary`

- **`components/themed-text.tsx`** (Line 58)
  - `color: '#0a7ea4'` - Hardcoded link color
  - **Status**: Component appears unused (only in explore.tsx)
  - **Fix**: Remove if unused, or use `colors.primary` if kept

- **`app/courts/find.tsx`** (Lines 261, 265, 269)
  - `#0A0A0A`, `#999999` - Google Maps custom styling
  - **Status**: Acceptable (map-specific styling)

- **`components/attribute-row.tsx`** (Lines 81, 90, 97)
  - Uses `GotGameColors.accent` and `GotGameColors.background` (legacy colors)
  - **Fix**: Replace with `colors.primary` and `colors.bg` from theme

#### Legacy Color Usage:
- **`components/attribute-row.tsx`** - Uses `GotGameColors` instead of theme tokens
- **Fix**: Migrate to `useThemeColors()` hook

### 2. TYPOGRAPHY INCONSISTENCIES

#### Issues Found:
- **Inline fontSize/fontWeight** (18 instances across 11 files)
  - Some screens use inline styles instead of Typography constants
  - Examples: `fontSize: 14`, `fontSize: 13`, `fontWeight: '600'`
  - **Files affected**: profile.tsx, courts/new.tsx, courts/index.tsx, self-ratings.tsx, etc.

- **ThemedText Component** - Exists but barely used
  - Only used in `app/(tabs)/explore.tsx`
  - Has hardcoded color `#0a7ea4`
  - **Decision needed**: Remove or standardize

- **Typography Variants** - Inconsistent usage
  - Some places use `Typography.bodyBold`, others use `Typography.body` + `fontWeight: '600'`
  - Some use `Typography.mutedSmall`, others use `Typography.muted` + `fontSize: 12`

#### Standardization Needed:
- Create consistent typography variants
- Replace all inline fontSize/fontWeight with Typography constants
- Decide on ThemedText component (remove or fix)

### 3. BUTTON INCONSISTENCIES

#### Issues Found:
- **Custom textStyle with fontSize** (multiple files)
  - `textStyle={{ fontSize: 14 }}` in attribute-row.tsx, courts/new.tsx, profile.tsx
  - **Fix**: Standardize button text size or add variant

- **Custom padding/minHeight** (multiple files)
  - Different padding values across screens
  - `minHeight: 32`, `minHeight: 40`, `minHeight: 44` vs standard `52`
  - **Fix**: Standardize or add size variants (small/medium/large)

- **Button radius** - Already consistent (uses `Radius.sm`)

### 4. INPUT INCONSISTENCIES

#### Issues Found:
- **TextInput component** - Already standardized ✅
- **RNTextInput usage** - Some screens use raw RNTextInput with custom styles
  - `app/profile.tsx` - Custom play style input
  - `app/courts/new.tsx` - Address and comment textareas
  - **Fix**: Create TextArea component or extend TextInput

- **Input focus states** - Need to verify consistency
- **Error states** - Need to verify consistency

### 5. CARD INCONSISTENCIES

#### Status:
- **Card component** - Already standardized ✅
- Uses theme tokens correctly
- Consistent border radius and padding

### 6. HEADER/BACK BUTTON INCONSISTENCIES

#### Status:
- **Header component** - Already standardized ✅
- Consistent back button (chevron.left icon)
- Consistent hit area and spacing
- Uses theme tokens

### 7. SPACING INCONSISTENCIES

#### Issues Found:
- **Inline spacing values** - Some places use numbers instead of Spacing constants
- **Gap usage** - Some use `gap`, others use `marginBottom`
- **Section spacing** - Inconsistent margins between sections

### 8. ICON INCONSISTENCIES

#### Status:
- **IconSymbol component** - Standardized ✅
- Consistent size (24px for headers, 28px for tabs)
- Uses theme colors

### 9. LIGHT/DARK MODE PARITY

#### Issues Found:
- **Hardcoded white** - `#FFFFFF` may not work in light mode (should be fine, but not theme-aware)
- **Map styles** - Dark mode map colors hardcoded (acceptable)
- **Overall**: Good parity, but hardcoded colors need fixing

---

## GOAL B: CODE CLEANUP OPPORTUNITIES

### 1. DEAD CODE

#### Unused Components:
- **`components/themed-text.tsx`** - Only used in explore.tsx, has hardcoded color
- **`components/themed-view.tsx`** - Need to check usage
- **`components/hello-wave.tsx`** - Likely unused
- **`components/parallax-scroll-view.tsx`** - Need to check usage
- **`components/external-link.tsx`** - Need to check usage
- **`components/connection-test.tsx`** - Likely dev/debug component

#### Unused Imports:
- Need to scan all files for unused imports
- Common: unused React imports, unused style imports

### 2. DUPLICATE LOGIC

#### Repeated Patterns:
- **Loading states** - Similar loading UI across many screens
  - Could extract `LoadingScreen` component

- **Error states** - Similar error UI across screens
  - Could extract `ErrorScreen` component

- **Empty states** - Similar empty state UI
  - Could extract `EmptyState` component

- **Resend timer logic** - Duplicated in sign-in.tsx and sign-up.tsx
  - Could extract `useResendTimer` hook

- **Phone validation** - Duplicated phone validation logic
  - Could extract utility function

### 3. STATE MANAGEMENT

#### Issues:
- **Unnecessary state** - Some screens have redundant state
- **Missing useMemo/useCallback** - Some expensive computations not memoized
- **State updates** - Some could be simplified

### 4. SUPABASE QUERIES

#### Issues Found:
- **Repeated fetches** - Some screens fetch same data multiple times
- **Missing limits** - Some queries don't limit results
- **Missing ordering** - Some queries don't specify order
- **N+1 queries** - Potential in some screens

### 5. CLEANUP ISSUES

#### Intervals/Timeouts:
- **`app/sign-in.tsx`** - Resend timer interval (needs cleanup) ✅ Already handled
- **`app/sign-up.tsx`** - Resend timer interval (needs cleanup) ✅ Already handled
- **`app/courts/index.tsx`** - Debounce timer (needs cleanup) ✅ Already handled

#### Subscriptions:
- **`contexts/auth-context.tsx`** - Auth subscription ✅ Properly cleaned up
- Need to check for realtime subscriptions

### 6. TYPE SAFETY

#### Issues:
- **`any` types** - Some error handling uses `any`
- **Missing types** - Some function parameters not typed
- **Shared types** - Some types duplicated across files

---

## TOP 20 INCONSISTENCIES (Priority Order)

### UI Inconsistencies:
1. **Hardcoded `#FFFFFF`** in Button.tsx (2 places) - High priority
2. **Hardcoded `#FFFFFF`** in self-ratings.tsx - High priority
3. **Legacy `GotGameColors`** in attribute-row.tsx - High priority
4. **Inline fontSize/fontWeight** (18 instances) - Medium priority
5. **Custom button textStyle fontSize: 14** (multiple files) - Medium priority
6. **Custom button padding/minHeight** variations - Medium priority
7. **ThemedText component** with hardcoded color - Low priority (unused)
8. **RNTextInput** instead of TextInput component (3 places) - Medium priority
9. **Inconsistent section spacing** - Low priority
10. **Gap vs marginBottom** inconsistency - Low priority

### Code Cleanup:
11. **Unused ThemedText component** - Low priority
12. **Unused themed-view component** - Low priority
13. **Duplicate loading state UI** - Medium priority
14. **Duplicate error state UI** - Medium priority
15. **Duplicate empty state UI** - Medium priority
16. **Duplicate resend timer logic** - Medium priority
17. **Duplicate phone validation** - Low priority
18. **Missing query limits** - Medium priority
19. **Missing query ordering** - Low priority
20. **`any` types in error handling** - Low priority

---

## PROPOSED FIX PLAN

### Phase 1: Color Standardization
1. Add `textOnPrimary` color token to theme
2. Replace all `#FFFFFF` with theme tokens
3. Replace `GotGameColors` with theme tokens
4. Remove or fix ThemedText component

### Phase 2: Typography Standardization
1. Create AppText component with variants
2. Replace all inline fontSize/fontWeight
3. Standardize typography usage across app

### Phase 3: Component Standardization
1. Standardize Button variants/sizes
2. Create TextArea component
3. Extract LoadingScreen, ErrorScreen, EmptyState components
4. Extract useResendTimer hook

### Phase 4: Code Cleanup
1. Remove unused components
2. Remove unused imports
3. Fix duplicate logic
4. Improve type safety
5. Optimize Supabase queries

---

## FILES TO CHANGE

### High Priority (Colors):
- `components/ui/Button.tsx`
- `app/self-ratings.tsx`
- `components/attribute-row.tsx`

### Medium Priority (Typography):
- `app/profile.tsx`
- `app/courts/new.tsx`
- `app/courts/index.tsx`
- `app/self-ratings.tsx`
- `app/my-sports.tsx`
- `app/(tabs)/index.tsx`
- `app/courts/[courtId].tsx`
- `app/courts/find.tsx`
- `app/forgot-password.tsx`
- `app/sign-in.tsx`
- `app/sign-up.tsx`

### Medium Priority (Components):
- `app/sign-in.tsx` (extract resend timer)
- `app/sign-up.tsx` (extract resend timer)
- Create shared components (LoadingScreen, ErrorScreen, EmptyState)

### Low Priority (Cleanup):
- Remove unused components
- Remove unused imports
- Fix type safety

---

## NEXT STEPS

1. Review this audit report
2. Approve fix plan
3. Implement fixes in phases
4. Test after each phase
5. Final regression testing
