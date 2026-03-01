# Phone Authentication Implementation

## Overview

Phone number authentication (SMS OTP) has been successfully added to the app alongside the existing email authentication. Users can now choose between Email or Phone when signing in or signing up.

## Files Changed

### New Components
1. **`components/ui/SegmentedControl.tsx`**
   - Reusable segmented control for Email/Phone tabs
   - Uses theme tokens (no hardcoded colors)
   - Supports light and dark modes

2. **`components/PhoneInput.tsx`**
   - Phone number input with country code selector
   - E.164 format normalization
   - US phone number formatting: (XXX) XXX-XXXX
   - Exposes `getE164Format()` via ref for Supabase API calls
   - Currently supports US (+1), easily extensible for more countries

3. **`components/OtpInput.tsx`**
   - 6-digit OTP input with auto-advance
   - Individual digit inputs with proper keyboard handling
   - Backspace navigation support
   - Auto-completes when all 6 digits are entered

### Updated Files
1. **`contexts/auth-context.tsx`**
   - Added `signInWithPhone(phone: string)` method
   - Added `verifyPhoneOtp(phone: string, token: string, username?: string)` method
   - Updated `ensureProfileExists()` to handle phone-based users
   - Username generation now supports:
     - Email prefix (for email users)
     - Phone number last 4 digits (for phone users)
     - Fallback to user ID

2. **`app/sign-in.tsx`**
   - Unified auth screen with Email/Phone tabs
   - Email flow: unchanged (email + password)
   - Phone flow: phone input → send code → OTP verification
   - Resend timer (30 seconds)
   - Error handling for invalid phone, wrong code, expired code

3. **`app/sign-up.tsx`**
   - Unified auth screen with Email/Phone tabs
   - Email flow: unchanged (username + email + password)
   - Phone flow: username → phone input → send code → OTP verification
   - Resend timer (30 seconds)
   - Profile creation handled automatically after OTP verification

## Implementation Details

### Phone Auth Flow

#### Sign In Flow:
1. User selects "Phone" tab
2. Enters phone number
3. Clicks "Send Code"
4. Receives SMS with 6-digit code
5. Enters code in OTP input (auto-advances)
6. Code verified → User signed in → Redirected to app

#### Sign Up Flow:
1. User selects "Phone" tab
2. Enters username (required, min 3 chars)
3. Enters phone number
4. Clicks "Send Code"
5. Receives SMS with 6-digit code
6. Enters code in OTP input
7. Code verified → Account created → Profile created → Redirected to app

### Phone Number Validation

- **Format**: E.164 format required by Supabase (`+1XXXXXXXXXX`)
- **Validation**: Minimum 10 digits (US format)
- **Normalization**: Automatically converts user input to E.164 format
- **Display**: Formatted as `(XXX) XXX-XXXX` for better UX

### OTP Verification

- **Length**: 6 digits
- **Auto-advance**: Moves to next input when digit entered
- **Backspace**: Moves to previous input when backspace pressed
- **Auto-complete**: Calls `onComplete` callback when all 6 digits entered
- **Error handling**: Shows error for invalid/expired codes

### Anti-Spam Protection

- **Resend timer**: 30 seconds cooldown after sending code
- **Button disabled**: "Send Code" button disabled during cooldown
- **Visual feedback**: Timer countdown displayed ("Resend code in Xs")

### Profile Creation

Phone-based users get profiles created automatically:
- Username: From sign-up form (if provided) or generated from phone number
- Profile table: `profiles` (same as email users)
- Onboarding: Same state as email users

## Supabase Configuration Required

### PHASE 1: Verify Supabase Dashboard Settings

**⚠️ IMPORTANT: Phone auth will NOT work until these are configured in Supabase Dashboard**

1. **Enable Phone Provider**
   - Go to: Supabase Dashboard → Authentication → Providers
   - Find "Phone" provider
   - Toggle it to **Enabled**
   - Save changes

2. **Configure SMS Provider**
   - Supabase uses Twilio by default (or MessageBird in some regions)
   - Go to: Authentication → Settings → Phone Auth
   - Configure your SMS provider:
     - **Twilio** (recommended for US):
       - Account SID
       - Auth Token
       - Phone number (from Twilio)
     - **MessageBird** (alternative)
   - Or use Supabase's built-in SMS service (may have costs)

3. **SMS Template Configuration**
   - Go to: Authentication → Templates → SMS
   - Customize the OTP message template
   - Default: `Your code is {{ .Code }}`
   - Can customize with your app name/branding

4. **Rate Limiting** (Optional but recommended)
   - Go to: Authentication → Settings → Rate Limits
   - Configure:
     - Max OTP requests per phone per hour
     - Max OTP requests per IP per hour
   - Prevents abuse and reduces costs

### Current Supabase Project Status

**You need to verify in your Supabase Dashboard:**
- ✅ Phone provider enabled?
- ✅ SMS provider configured (Twilio/MessageBird)?
- ✅ SMS templates set up?
- ✅ Rate limiting configured?

**Note**: The code implementation is complete, but phone auth will fail until Supabase Dashboard is configured.

## Testing Checklist

### Email Auth (Should Still Work)
- [ ] Sign in with email + password
- [ ] Sign up with email + password + username
- [ ] Email verification flow
- [ ] Password reset flow

### Phone Auth - Sign In
- [ ] New user: Enter phone → Send code → Receive SMS → Enter code → Sign in
- [ ] Existing user: Enter phone → Send code → Receive SMS → Enter code → Sign in
- [ ] Wrong code: Enter incorrect code → See error message
- [ ] Expired code: Wait for code to expire → Enter code → See error message
- [ ] Resend code: Click resend → Wait 30s → Resend works
- [ ] Resend timer: Click send → Button disabled for 30s → Timer countdown visible

### Phone Auth - Sign Up
- [ ] Enter username → Enter phone → Send code → Receive SMS → Enter code → Account created
- [ ] Profile created automatically after verification
- [ ] Username saved correctly in profile
- [ ] Can sign in with same phone number after sign up

### UI/UX
- [ ] Email/Phone tabs visible and functional
- [ ] Theme colors work in light mode
- [ ] Theme colors work in dark mode
- [ ] Phone input formats correctly: (XXX) XXX-XXXX
- [ ] OTP input auto-advances correctly
- [ ] Error messages display clearly
- [ ] Loading states work correctly
- [ ] Resend timer displays correctly

### Edge Cases
- [ ] Invalid phone number (too short) → Error shown
- [ ] Non-numeric phone input → Rejected
- [ ] Empty phone field → Error shown
- [ ] Network error → Error message displayed
- [ ] Rate limit exceeded → Friendly error message

## Code Examples

### Using Phone Auth in Code

```typescript
import { useAuth } from '@/contexts/auth-context';

const { signInWithPhone, verifyPhoneOtp } = useAuth();

// Send OTP
const { error } = await signInWithPhone('+15551234567');

// Verify OTP
const { error } = await verifyPhoneOtp('+15551234567', '123456', 'username');
```

### Phone Input Usage

```typescript
import { PhoneInput, PhoneInputRef } from '@/components/PhoneInput';
import { useRef } from 'react';

const phoneInputRef = useRef<PhoneInputRef>(null);

<PhoneInput
  ref={phoneInputRef}
  value={phone}
  onChangeText={setPhone}
  error={phoneError}
/>

// Get E.164 format
const e164Phone = phoneInputRef.current?.getE164Format();
```

### OTP Input Usage

```typescript
import { OtpInput } from '@/components/OtpInput';

<OtpInput
  length={6}
  onComplete={(otp) => handleVerify(otp)}
  error={otpError}
  editable={!loading}
/>
```

## Theme Tokens Used

All components use theme tokens (no hardcoded colors):
- `colors.text` - Primary text color
- `colors.textMuted` - Secondary/muted text
- `colors.surface` - Input backgrounds
- `colors.surfaceAlt` - Alternative surface (tabs)
- `colors.border` - Borders
- `colors.primary` - Primary accent (Primary Blue #0000FF)
- `colors.background` - Screen background

## Dependencies

No new npm packages required. Uses existing:
- `@supabase/supabase-js` (already installed)
- React Native built-in components
- Theme system from `@/contexts/theme-context`

## Cost Considerations

**SMS/OTP Costs:**
- Supabase charges per SMS sent (varies by provider)
- Twilio: ~$0.0075 per SMS in US
- MessageBird: Similar pricing
- Consider implementing rate limiting to prevent abuse

## Future Enhancements

Potential improvements:
1. **Country Picker**: Expand beyond US (+1) to support international numbers
2. **Phone Number Library**: Use `react-native-phone-number-input` for better country support
3. **Auto-detect Country**: Detect user's country from device settings
4. **Phone Verification Badge**: Show verified phone badge in profile
5. **Two-Factor Auth**: Use phone as 2FA for email accounts

## Troubleshooting

### "Phone provider not enabled" error
- Check Supabase Dashboard → Auth → Providers → Phone is enabled

### "SMS provider not configured" error
- Configure Twilio/MessageBird in Supabase Dashboard → Auth → Settings → Phone Auth

### "Invalid phone number" error
- Ensure phone is in E.164 format: `+1XXXXXXXXXX`
- Check phone number has 10+ digits (US format)

### "OTP expired" error
- OTP codes typically expire after 5-10 minutes
- User needs to request a new code

### "Rate limit exceeded" error
- Too many OTP requests in short time
- Wait before trying again
- Consider implementing rate limiting in Supabase Dashboard

## Support

For issues:
1. Check Supabase Dashboard configuration
2. Verify phone number format (E.164)
3. Check network connectivity
4. Review Supabase logs in Dashboard → Logs → Auth
