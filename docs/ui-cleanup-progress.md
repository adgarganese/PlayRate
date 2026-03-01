# UI Cleanup Progress Report

## ✅ COMPLETED (Phase 1)

### Color Standardization
1. ✅ **Added `textOnPrimary` color token** to theme
   - `constants/theme.ts` - Added to LightColors and DarkColors
   - `contexts/theme-context.tsx` - Added to ThemeColors type and context

2. ✅ **Fixed hardcoded `#FFFFFF` in Button.tsx**
   - Replaced with `colors.textOnPrimary`

3. ✅ **Fixed hardcoded `#FFFFFF` in self-ratings.tsx**
   - Replaced with `colors.textOnPrimary`

4. ✅ **Fixed legacy `GotGameColors` in attribute-row.tsx**
   - Replaced `GotGameColors.accent` with `colors.primary`
   - Replaced `GotGameColors.background` with `colors.textOnPrimary`
   - Now fully uses theme tokens

### Shared Components Created
1. ✅ **AppText component** (`components/ui/AppText.tsx`)
   - Standardized typography component with variants
   - Supports: h1, h2, h3, body, bodyBold, muted, mutedSmall
   - Color variants: text, textMuted, primary, textOnPrimary

2. ✅ **LoadingScreen component** (`components/ui/LoadingScreen.tsx`)
   - Reusable loading state UI
   - Consistent across app

3. ✅ **ErrorScreen component** (`components/ui/ErrorScreen.tsx`)
   - Reusable error state UI
   - Supports retry button

4. ✅ **EmptyState component** (`components/ui/EmptyState.tsx`)
   - Reusable empty state UI
   - Supports action button

### Hooks Created
1. ✅ **useResendTimer hook** (`hooks/use-resend-timer.ts`)
   - Extracted duplicate resend timer logic
   - Proper cleanup of intervals
   - Used in sign-in.tsx and sign-up.tsx

### Code Cleanup
1. ✅ **Refactored sign-in.tsx**
   - Uses `useResendTimer` hook
   - Removed duplicate timer logic

2. ✅ **Refactored sign-up.tsx**
   - Uses `useResendTimer` hook
   - Removed duplicate timer logic

---

## 🔄 IN PROGRESS / REMAINING

### High Priority Remaining

#### Typography Standardization
- **Replace inline fontSize/fontWeight** (18 instances found)
  - Files: profile.tsx, courts/new.tsx, courts/index.tsx, self-ratings.tsx, my-sports.tsx, courts/[courtId].tsx, courts/find.tsx, (tabs)/index.tsx
  - Pattern: Replace `fontSize: 14` with `Typography.mutedSmall` or create new variant
  - Pattern: Replace `fontSize: 13` with `Typography.mutedSmall` (may need new variant)

#### Button Standardization
- **Custom button textStyle fontSize: 14** (5+ instances)
  - Files: attribute-row.tsx, courts/new.tsx, profile.tsx, courts/[courtId].tsx, my-sports.tsx
  - **Fix**: Add button size variants (small/medium/large) or standardize text size

- **Custom button padding/minHeight** variations
  - Some buttons use `minHeight: 32`, `40`, `44` vs standard `52`
  - **Fix**: Add size variants to Button component

#### Component Migration
- **Replace LoadingScreen usage** in screens:
  - self-ratings.tsx, courts/index.tsx, courts/[courtId].tsx, profile.tsx, my-sports.tsx, (tabs)/index.tsx, athletes/[userId].tsx

- **Replace ErrorScreen usage** in screens:
  - courts/index.tsx, courts/[courtId].tsx, athletes/[userId].tsx

- **Replace EmptyState usage** in screens:
  - courts/index.tsx, my-sports.tsx, self-ratings.tsx

#### TextInput Standardization
- **Replace RNTextInput with TextInput component** (3 places)
  - profile.tsx - Custom play style input
  - courts/new.tsx - Address and comment textareas
  - **Fix**: Create TextArea component or extend TextInput

### Medium Priority

#### Unused Components (Verify & Remove)
- `components/themed-text.tsx` - Only used in explore.tsx, has hardcoded color
- `components/themed-view.tsx` - Check usage
- `components/hello-wave.tsx` - Likely unused
- `components/parallax-scroll-view.tsx` - Check usage
- `components/external-link.tsx` - Check usage
- `components/connection-test.tsx` - Likely dev component

#### Unused Imports
- Scan all files for unused imports
- Remove unused React imports, style imports, etc.

#### Type Safety
- Replace `any` types in error handling
- Create shared types file
- Improve TypeScript coverage

### Low Priority

#### Supabase Query Optimization
- Add limits where missing
- Add ordering where missing
- Check for N+1 query patterns

#### State Management
- Review unnecessary state
- Add useMemo/useCallback where beneficial
- Simplify state updates

---

## 📋 IMPLEMENTATION PATTERN

### For Typography Fixes:
```tsx
// Before:
<Text style={{ fontSize: 14, color: colors.textMuted }}>Text</Text>

// After:
<AppText variant="mutedSmall" color="textMuted">Text</AppText>
```

### For Loading States:
```tsx
// Before:
<Screen>
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={PRIMARY} />
    <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading...</Text>
  </View>
</Screen>

// After:
<LoadingScreen message="Loading..." />
```

### For Error States:
```tsx
// Before:
<Screen>
  <View style={styles.errorContainer}>
    <Text style={[styles.errorTitle, { color: colors.text }]}>Error</Text>
    <Text style={[styles.errorText, { color: colors.textMuted }]}>{error}</Text>
    <Button title="Retry" onPress={onRetry} variant="primary" />
  </View>
</Screen>

// After:
<ErrorScreen message={error} onRetry={onRetry} />
```

### For Empty States:
```tsx
// Before:
<View style={styles.emptyContainer}>
  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No items</Text>
  <Button title="Add Item" onPress={onAdd} variant="primary" />
</View>

// After:
<EmptyState 
  title="No items" 
  actionLabel="Add Item" 
  onAction={onAdd} 
/>
```

---

## 📁 FILES CHANGED SO FAR

### New Files:
- `components/ui/AppText.tsx`
- `components/ui/LoadingScreen.tsx`
- `components/ui/ErrorScreen.tsx`
- `components/ui/EmptyState.tsx`
- `hooks/use-resend-timer.ts`
- `docs/ui-audit.md`
- `docs/ui-cleanup-progress.md`

### Modified Files:
- `constants/theme.ts` - Added textOnPrimary token
- `contexts/theme-context.tsx` - Added textOnPrimary to context
- `components/ui/Button.tsx` - Fixed hardcoded #FFFFFF
- `app/self-ratings.tsx` - Fixed hardcoded #FFFFFF
- `components/attribute-row.tsx` - Replaced GotGameColors with theme tokens
- `app/sign-in.tsx` - Uses useResendTimer hook
- `app/sign-up.tsx` - Uses useResendTimer hook

---

## 🎯 NEXT STEPS (Recommended Order)

### Step 1: Complete Typography Migration
1. Replace all inline `fontSize: 14` with AppText variant="mutedSmall"
2. Replace all inline `fontSize: 13` with AppText variant="mutedSmall" (or create new variant)
3. Replace all inline `fontWeight: '600'` with AppText variant="bodyBold" or Typography.bodyBold

### Step 2: Migrate Loading/Error/Empty States
1. Replace loading states with LoadingScreen component
2. Replace error states with ErrorScreen component
3. Replace empty states with EmptyState component

### Step 3: Button Size Standardization
1. Add size prop to Button component (small/medium/large)
2. Update all custom button styles to use size prop

### Step 4: TextInput Standardization
1. Create TextArea component or extend TextInput
2. Replace RNTextInput usage

### Step 5: Cleanup
1. Remove unused components
2. Remove unused imports
3. Improve type safety
4. Optimize queries

---

## ✅ VERIFICATION CHECKLIST

After completing all phases, verify:

### UI Consistency
- [ ] No hardcoded hex colors (except map styles)
- [ ] All typography uses AppText or Typography constants
- [ ] All buttons use consistent styling
- [ ] All inputs use TextInput/TextArea components
- [ ] All loading states use LoadingScreen
- [ ] All error states use ErrorScreen
- [ ] All empty states use EmptyState
- [ ] Consistent spacing throughout
- [ ] Light mode works correctly
- [ ] Dark mode works correctly

### Code Quality
- [ ] No unused components
- [ ] No unused imports
- [ ] No duplicate logic
- [ ] Proper cleanup of intervals/timeouts
- [ ] Strong TypeScript types
- [ ] Optimized Supabase queries

### Functionality (Regression Testing)
- [ ] Auth flow (email + phone)
- [ ] Home screen
- [ ] Court list + detail
- [ ] Profile (self + other)
- [ ] Ratings
- [ ] Search
- [ ] Light/Dark mode toggle

---

## 📊 PROGRESS METRICS

- **Colors Fixed**: 4/4 hardcoded colors (100%)
- **Components Created**: 4/4 shared components (100%)
- **Hooks Created**: 1/1 hooks (100%)
- **Typography**: 0/18 inline styles (0% - Next phase)
- **Loading States**: 0/7 screens (0% - Next phase)
- **Error States**: 0/3 screens (0% - Next phase)
- **Empty States**: 0/3 screens (0% - Next phase)

**Overall Progress**: ~25% complete

---

## 🚀 QUICK WINS REMAINING

These can be done quickly for immediate impact:

1. **Replace LoadingScreen** in 7 screens (15 min)
2. **Replace ErrorScreen** in 3 screens (10 min)
3. **Replace EmptyState** in 3 screens (10 min)
4. **Fix fontSize: 14** in 5 button textStyles (10 min)
5. **Remove unused components** (5 min)

**Total Quick Wins**: ~50 minutes for significant improvement
