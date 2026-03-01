# GotGame? Design System Implementation Summary

## ✅ Completed Components & Theme

### 1. Design System (`constants/theme.ts`)
- **Colors**: `background`, `card`, `textPrimary`, `textMuted`, `accent` (gold), `border`
- **Spacing**: `xs: 4`, `sm: 8`, `md: 12`, `lg: 16`, `xl: 24`
- **Radius**: `sm: 12`, `md: 14`, `lg: 16`
- **Typography**: `h1`, `h2`, `h3`, `body`, `bodyBold`, `muted`, `mutedSmall`

### 2. Reusable UI Components (`components/ui/`)

#### Screen Component
- Handles SafeArea, background color, consistent horizontal padding
- Usage: `<Screen><YourContent /></Screen>`

#### Header Component
- Title + optional subtitle + back button + optional right icon
- Consistent back button behavior
- Usage: `<Header title="Title" subtitle="Subtitle" rightIcon={{...}} />`

#### Button Component
- Primary (gold background) and Secondary (gold border) variants
- Loading state support
- Usage: `<Button title="Text" onPress={...} variant="primary" />`

#### TextInput Component
- Optional label
- Matches design system styling
- Usage: `<TextInput label="Label" placeholder="..." />`

#### ListItem Component
- Title, subtitle, optional chevron, optional left/right content
- Usage: `<ListItem title="..." subtitle="..." showChevron onPress={...} />`

### 3. Updated Components
- **SectionTitle**: Uses Typography.h3 and Spacing.md
- **Card**: Uses GotGameColors.card, Radius.md, Spacing.lg padding
- **StatBar**: Uses Typography.muted and Spacing constants
- **RunListItem**: Now uses ListItem component internally

## ✅ Updated Screens

1. **Home Screen** (`app/(tabs)/index.tsx`)
   - Uses Screen, Header, Button, SectionTitle
   - Consistent spacing and typography

2. **Sign In** (`app/sign-in.tsx`)
   - Uses Screen, Header, Button, TextInput
   - Dark theme applied

3. **Sign Up** (`app/sign-up.tsx`)
   - Uses Screen, Header, Button, TextInput
   - Dark theme applied

4. **Profile** (`app/profile.tsx`)
   - Uses Screen, Header, Card, Button, TextInput
   - Consistent styling throughout

5. **Forgot Password** (`app/forgot-password.tsx`)
   - Uses Screen, Header, Button, TextInput
   - Dark theme applied

## 🔄 Remaining Screens to Update

Apply the same pattern to these screens:

### High Priority
- `app/reset-password.tsx` - Use Screen, Header, Button, TextInput
- `app/my-sports.tsx` - Use Screen, Header, Card, ListItem, Button
- `app/self-ratings.tsx` - Use Screen, Header, Card, Button
- `app/profiles.tsx` - Use Screen, Header, ListItem
- `app/athletes/[userId].tsx` - Use Screen, Header, Card

### Medium Priority
- `app/courts/index.tsx` - Use Screen, Header, ListItem, Button
- `app/courts/[courtId].tsx` - Use Screen, Header, Card, Button
- `app/courts/new.tsx` - Use Screen, Header, Card, TextInput, Button
- `app/modal.tsx` - Use Screen, Header

## 📋 Update Pattern for Remaining Screens

1. **Replace container**: Change `<View style={styles.container}>` to `<Screen>`
2. **Add Header**: Replace custom back buttons with `<Header title="..." />`
3. **Replace buttons**: Use `<Button>` component instead of custom TouchableOpacity
4. **Replace inputs**: Use `<TextInput>` component
5. **Use Cards**: Wrap content sections in `<Card>` component
6. **Use ListItem**: Replace custom list rows with `<ListItem>`
7. **Update styles**: Remove custom colors/spacing, use theme constants
8. **Typography**: Replace custom text styles with Typography helpers

## 🎨 Design System Rules

- **NO custom colors** - Always use `GotGameColors`
- **NO custom spacing** - Always use `Spacing` constants
- **NO custom radius** - Always use `Radius` constants
- **NO custom typography** - Always use `Typography` helpers
- **All screens** must use `Screen` component
- **All screens** must use `Header` component (except home when logged in)
- **All buttons** must use `Button` component
- **All inputs** must use `TextInput` component
- **All cards** must use `Card` component

## 📝 Notes

- Keep the 60% sleek / 40% sports-stats balance
- NO overalls/badges - only tiers based on cosigns
- Maintain dark theme consistency
- All navigation should use consistent back button behavior via Header component
