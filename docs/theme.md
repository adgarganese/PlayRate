# GotGame? Theme System

**Style**: 50% "2K energy" + 50% sleek/minimal  
**Philosophy**: High contrast, subtle glow, premium accents used sparingly

## Color Tokens

### Primary Color
- **PRIMARY (Primary Blue)**: `#0000FF` - Main brand color, used for primary actions, active states, and key UI elements

### Light Mode
```typescript
bg: '#EEF1F5'           // Light grey background
surface: '#FFFFFF'      // Card/surface background
surfaceAlt: '#F7F8FB'   // Alternative surface (subtle variation)
border: '#D8DEE9'       // Subtle border color
text: '#0B1020'         // Primary text (dark)
textMuted: '#5B657A'    // Muted/secondary text
```

### Dark Mode
```typescript
bg: '#0B0F1A'           // Dark background
surface: '#12182A'       // Card/surface background
surfaceAlt: '#161F35'    // Alternative surface (subtle variation)
border: '#24304A'        // Subtle border color
text: '#F4F7FF'          // Primary text (light)
textMuted: '#AAB3C8'     // Muted/secondary text
```

### Accent Colors (Theme-agnostic)
```typescript
primary: '#0000FF'       // Primary Blue - main brand color
cyanGlow: '#00E5FF'      // Cyan glow - use SPARINGLY for selected state/glow
goldTier: '#E7C66A'      // Gold tier - use ONLY for tier/premium highlights
```

## Usage

### Import Theme Hook
```typescript
import { useThemeColors } from '@/contexts/theme-context';
import { PRIMARY, AccentColors } from '@/constants/theme';

function MyComponent() {
  const { colors, isDark } = useThemeColors();
  
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
      <Text style={{ color: colors.text }}>Hello</Text>
      <Text style={{ color: colors.textMuted }}>Subtitle</Text>
    </View>
  );
}
```

## Component Examples

### Button

**Primary Button:**
- Background: `PRIMARY` (#0000FF)
- Text: White (#FFFFFF)
- Subtle shadow in light mode, subtle glow in dark mode

```typescript
<Button 
  title="Action" 
  variant="primary" 
  onPress={handlePress} 
/>
```

**Secondary Button:**
- Background: Transparent
- Border: `PRIMARY` (#0000FF)
- Text: `PRIMARY` (#0000FF)

```typescript
<Button 
  title="Action" 
  variant="secondary" 
  onPress={handlePress} 
/>
```

### Card

**Standard Card:**
- Background: `colors.surface`
- Border: `colors.border` (1px)
- Subtle shadow in light mode, subtle cyan glow in dark mode

```typescript
<Card>
  <Text>Card content</Text>
</Card>
```

**Elevated Card:**
- Same as standard but with stronger shadow/glow

```typescript
<Card elevated>
  <Text>Elevated content</Text>
</Card>
```

### Text Input

- Background: `colors.surface`
- Border: `colors.border` (1px)
- Text: `colors.text`
- Placeholder: `colors.textMuted`

```typescript
<TextInput
  label="Email"
  placeholder="Enter email"
  value={email}
  onChangeText={setEmail}
/>
```

### Chip/Badge

**Standard Chip:**
- Background: `colors.surfaceAlt`
- Border: `colors.border`
- Text: `colors.text`

**Selected Chip:**
- Background: `PRIMARY` with subtle opacity
- Border: `PRIMARY`
- Text: White
- Optional: Subtle `cyanGlow` shadow in dark mode

### Navigation

**Tab Bar:**
- Background: `colors.surface`
- Border Top: `colors.border`
- Active Icon: `PRIMARY`
- Inactive Icon: `colors.textMuted`

**Header:**
- Background: `colors.bg` (inherits from Screen)
- Text: `colors.text`
- Icons: `colors.textMuted` (inactive), `PRIMARY` (active)

## Do's and Don'ts

### ✅ DO:
- Use `PRIMARY` for primary actions, active states, and key highlights
- Use `colors.text` for primary text
- Use `colors.textMuted` for secondary text, hints, and labels
- Use `colors.surface` for cards and elevated content
- Use `colors.border` for all borders and dividers
- Use `cyanGlow` sparingly for selected states or subtle glow effects (dark mode)
- Use `goldTier` ONLY for tier/premium highlights (e.g., tier badges, premium features)

### ❌ DON'T:
- Don't use random blue colors - always use `PRIMARY` for blue accents
- Don't use `goldTier` for general accents - only for tier/premium features
- Don't hardcode hex colors in components - always use theme tokens
- Don't use `cyanGlow` excessively - it's meant for subtle highlights only
- Don't mix light and dark mode colors - always use `useThemeColors()` hook

## Spacing Scale

```typescript
xs: 4
sm: 8
md: 12
lg: 16
xl: 24
xxl: 32
```

## Border Radius

```typescript
xs: 6
sm: 12
md: 14
lg: 16
xl: 20
full: 9999
```

## Typography

All typography styles are defined in `constants/theme.ts` under `Typography`. Colors are applied dynamically via the theme hook.

```typescript
Typography.h1    // 32px, bold
Typography.h2    // 24px, bold
Typography.h3    // 18px, semibold
Typography.body  // 16px, regular
Typography.bodyBold // 16px, semibold
Typography.muted // 14px, regular
Typography.mutedSmall // 12px, regular
```

## Migration Checklist

When updating a component:

1. ✅ Import `useThemeColors` hook
2. ✅ Replace all `GotGameColors.*` with `colors.*`
3. ✅ Replace hardcoded hex colors with theme tokens
4. ✅ Update text colors to use `colors.text` or `colors.textMuted`
5. ✅ Update backgrounds to use `colors.bg`, `colors.surface`, or `colors.surfaceAlt`
6. ✅ Update borders to use `colors.border`
7. ✅ Replace accent colors with `PRIMARY` or appropriate accent token
8. ✅ Test in both light and dark mode

## Files Updated

### Core Theme System ✅
- ✅ `constants/theme.ts` - New Primary Blue theme tokens (light + dark)
- ✅ `contexts/theme-context.tsx` - ThemeProvider and useThemeColors hook
- ✅ `app/_layout.tsx` - Integrated ThemeProvider, custom navigation themes

### UI Components ✅
- ✅ `components/ui/Button.tsx` - Primary/secondary variants with PRIMARY
- ✅ `components/ui/Card.tsx` - Surface colors with shadows/glow
- ✅ `components/ui/TextInput.tsx` - Theme-aware inputs
- ✅ `components/ui/Screen.tsx` - Theme-aware background
- ✅ `components/ui/Header.tsx` - Theme-aware header
- ✅ `components/ui/ListItem.tsx` - Theme-aware list items
- ✅ `components/SectionTitle.tsx` - Theme-aware titles
- ✅ `components/StatBar.tsx` - PRIMARY fill color
- ✅ `components/Card.tsx` - Updated to use theme

### Brand Components ✅
- ✅ `components/brand/GotGameLogoText.tsx` - Theme-aware logo (goldTier for ?)

### Screens ✅
- ✅ `app/(tabs)/index.tsx` - Home screen
- ✅ `app/(tabs)/_layout.tsx` - Tab bar with PRIMARY active color
- ✅ `app/sign-in.tsx` - Sign in screen
- ✅ `app/sign-up.tsx` - Sign up screen
- ✅ `app/profile.tsx` - Profile screen
- ✅ `app/courts/index.tsx` - Courts list screen
- ✅ `app/courts/find.tsx` - Find courts map screen

### Components ✅
- ✅ `components/GotGameSnapshotCard.tsx` - Snapshot card
- ✅ `components/ProfilePicture.tsx` - Profile picture component
- ✅ `components/CourtCard.tsx` - Court card component

### Remaining Files to Update ⏳
- ⏳ `app/courts/[courtId].tsx` - Court detail screen
- ⏳ `app/courts/new.tsx` - New court screen
- ⏳ `app/athletes/[userId].tsx` - Athlete profile screen
- ⏳ `app/my-sports.tsx` - My sports screen
- ⏳ `app/self-ratings.tsx` - Self ratings screen
- ⏳ `app/forgot-password.tsx` - Forgot password screen
- ⏳ `app/reset-password.tsx` - Reset password screen
- ⏳ `app/profiles.tsx` - Profiles list screen
- ⏳ `app/modal.tsx` - Modal screen
- ⏳ `app/(tabs)/explore.tsx` - Explore tab
- ⏳ `components/profiles.tsx` - Profiles list component
- ⏳ `components/attribute-row.tsx` - Attribute row component
- ⏳ `components/CourtComments.tsx` - Court comments component
- ⏳ Other component files as needed

See `THEME_MIGRATION_SUMMARY.md` for detailed migration patterns.
