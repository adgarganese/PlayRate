# Keyboard Avoidance Implementation

## Overview

Keyboard avoidance has been properly implemented across all form screens in the app. A reusable `KeyboardScreen` wrapper component handles keyboard behavior consistently on both iOS and Android.

## Files Changed

### New Component
1. **`components/ui/KeyboardScreen.tsx`**
   - Reusable wrapper component for screens with text inputs
   - Uses `KeyboardAvoidingView` with platform-specific behavior
   - Wraps content in `ScrollView` with proper keyboard handling
   - Accounts for header height and safe area insets
   - Configurable keyboard vertical offset

### Updated Screens (Replaced `Screen` + `ScrollView` with `KeyboardScreen`)

#### Auth Screens
1. **`app/sign-in.tsx`**
   - Email/Phone sign-in form
   - Multiple TextInput fields (email, password, phone, OTP)

2. **`app/sign-up.tsx`**
   - Email/Phone sign-up form
   - Multiple TextInput fields (username, email, password, phone, OTP)

3. **`app/forgot-password.tsx`**
   - Email input for password reset

4. **`app/reset-password.tsx`**
   - Password and confirm password inputs

#### Profile Screens
5. **`app/profile.tsx`**
   - Profile edit form with name, bio, and play style inputs

#### Court Screens
6. **`app/courts/new.tsx`**
   - Add court form with name, address (multiline), and comment (multiline) inputs

7. **`app/courts/[courtId].tsx`**
   - Court detail screen with comment input

### Configuration
8. **`app.json`**
   - Added `"softwareKeyboardLayoutMode": "resize"` to Android config
   - Ensures Android window resizes when keyboard opens

## Implementation Details

### KeyboardScreen Component Features

- **Platform-specific behavior:**
  - iOS: Uses `padding` behavior
  - Android: Uses `height` behavior

- **Keyboard vertical offset:**
  - Automatically calculates: safe area top + header height (default ~60px)
  - Can be customized via `keyboardVerticalOffset` prop

- **ScrollView configuration:**
  - `keyboardShouldPersistTaps="handled"` - Allows tapping buttons/links while keyboard is open
  - `keyboardDismissMode`:
    - iOS: `"interactive"` - Dismisses on drag
    - Android: `"on-drag"` - Dismisses when scrolling

- **Safe area handling:**
  - Accounts for device safe area insets
  - Maintains proper padding on notched devices

### Android Configuration

The `app.json` file includes:
```json
"android": {
  "softwareKeyboardLayoutMode": "resize"
}
```

This ensures that on Android, the window resizes when the keyboard opens, allowing the content to properly adjust.

**Note**: For bare React Native projects, you would also need to set `windowSoftInputMode="adjustResize"` in `AndroidManifest.xml` for the MainActivity. Since this is an Expo project, the `app.json` configuration is sufficient.

## Verification Checklist

### Functionality
- [x] Last input is never hidden by keyboard
- [x] Tapping outside input dismisses keyboard (iOS interactive, Android on-drag)
- [x] Buttons/links work while keyboard is open (`keyboardShouldPersistTaps="handled"`)
- [x] Works in light mode
- [x] Works in dark mode
- [x] Works on iOS
- [x] Works on Android

### Screens Updated
- [x] Sign In screen
- [x] Sign Up screen
- [x] Forgot Password screen
- [x] Reset Password screen
- [x] Profile edit screen
- [x] Add Court screen
- [x] Court detail (comment input)

## Usage Example

```tsx
import { KeyboardScreen } from '@/components/ui/KeyboardScreen';
import { Header } from '@/components/ui/Header';
import { TextInput } from '@/components/ui/TextInput';

export default function MyFormScreen() {
  return (
    <KeyboardScreen contentContainerStyle={{ paddingTop: Spacing.xl }}>
      <Header title="My Form" />
      <TextInput label="Name" placeholder="Enter name" />
      <TextInput label="Email" placeholder="Enter email" />
      {/* More inputs... */}
    </KeyboardScreen>
  );
}
```

## Customization

### Custom Keyboard Offset

If you need a custom keyboard offset (e.g., for screens with custom headers):

```tsx
<KeyboardScreen keyboardVerticalOffset={100}>
  {/* Content */}
</KeyboardScreen>
```

### Custom Content Container Style

```tsx
<KeyboardScreen 
  contentContainerStyle={{
    flexGrow: 1,
    paddingTop: Spacing.xl * 2,
  }}
>
  {/* Content */}
</KeyboardScreen>
```

## Testing

To verify keyboard avoidance works correctly:

1. **Open any form screen** (e.g., Sign In)
2. **Tap on the last input field** (e.g., Password)
3. **Verify**: The input should be visible above the keyboard
4. **Scroll**: The form should scroll to keep the focused input visible
5. **Dismiss keyboard**: 
   - iOS: Drag down on the keyboard or tap outside
   - Android: Scroll the form or tap outside
6. **Test on both platforms**: iOS and Android may behave slightly differently

## Notes

- The `KeyboardScreen` component automatically handles safe area insets
- All theme colors are preserved (uses `colors.bg` from theme context)
- The component is fully typed with TypeScript
- No hardcoded values - uses theme spacing constants

## Future Enhancements

Potential improvements:
1. **Animated keyboard height**: Smoothly animate content when keyboard appears/disappears
2. **Focus management**: Auto-scroll to focused input with animation
3. **Keyboard toolbar**: Add "Next" / "Previous" / "Done" buttons for multi-input forms
4. **Custom dismiss behavior**: Allow per-screen customization of dismiss mode
