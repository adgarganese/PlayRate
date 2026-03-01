# Phone Authentication Analysis

## 1. Phone Auth Implementation Status

**Answer: NO** - Phone number authentication is **NOT** implemented in the app UI.

### Evidence:
- ❌ No `signInWithOtp({ phone })` calls found
- ❌ No `signUp({ phone })` calls found  
- ❌ No `verifyOtp({ phone })` calls found
- ❌ No phone input fields in auth screens
- ❌ No phone-related auth logic in auth context

## 2. Current Email Auth Flow

### Files Involved:

#### **Auth Screens:**
1. **`app/sign-in.tsx`**
   - Email + Password form
   - Uses `signIn(email, password)` from auth context
   - Calls `supabase.auth.signInWithPassword({ email, password })`

2. **`app/sign-up.tsx`**
   - Username + Email + Password form
   - Uses `signUp(email, password, username)` from auth context
   - Calls `supabase.auth.signUp({ email, password, options: { data: { username } } })`

3. **`app/forgot-password.tsx`**
   - Email-only form for password reset
   - Uses `supabase.auth.resetPasswordForEmail(email)`

4. **`app/reset-password.tsx`**
   - New password + confirm password form
   - Uses `supabase.auth.updateUser({ password })`

#### **Auth Service Layer:**
5. **`contexts/auth-context.tsx`**
   - **`signIn(email: string, password: string)`** → `supabase.auth.signInWithPassword()`
   - **`signUp(email: string, password: string, username: string)`** → `supabase.auth.signUp()`
   - **`signOut()`** → `supabase.auth.signOut()`
   - Session management via `getSession()` and `onAuthStateChange()`
   - Profile creation helper `ensureProfileExists()`

#### **Supabase Client:**
6. **`lib/supabase.ts`**
   - Initializes Supabase client
   - Config: `{ auth: { autoRefreshToken, persistSession, detectSessionInUrl, flowType: 'pkce' } }`

## 3. Supabase Configuration

### Where Config is Stored:

**File: `lib/supabase.ts`**

Configuration is read in this priority order:
1. `Constants.expoConfig?.extra?.supabaseUrl`
2. `Constants.manifest?.extra?.supabaseUrl`
3. `process.env.EXPO_PUBLIC_SUPABASE_URL`
4. Hardcoded fallback: `'https://nhqhkwvmludnsblimjeu.supabase.co'`

Same priority for anon key:
1. `Constants.expoConfig?.extra?.supabaseAnonKey`
2. `Constants.manifest?.extra?.supabaseAnonKey`
3. `process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. Hardcoded fallback: `'sb_publishable_QPSR2PT0BZAvw8azqWqEdw_rYL05CpQ'`

### Auth Settings in Code:

**File: `lib/supabase.ts`**
```typescript
auth: {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  flowType: 'pkce',
}
```

**Note:** No phone-specific auth settings are referenced. Phone auth configuration would need to be done in Supabase Dashboard (Authentication → Providers → Phone).

## 4. Required Changes to Add Phone Auth (High-Level)

### Frontend Changes:

1. **New Auth Screens:**
   - `app/phone-sign-in.tsx` (or modify existing `sign-in.tsx` to support both)
   - `app/verify-otp.tsx` (new screen for OTP verification)
   - Update `app/sign-up.tsx` to support phone option (or create separate screen)

2. **Auth Context Updates (`contexts/auth-context.tsx`):**
   - Add `signInWithPhone(phone: string)` → `supabase.auth.signInWithOtp({ phone })`
   - Add `verifyPhoneOtp(phone: string, token: string)` → `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`
   - Add `signUpWithPhone(phone: string, username: string)` → `supabase.auth.signInWithOtp({ phone, options: { data: { username } } })`

3. **Navigation/Routing:**
   - Add routes for phone auth screens
   - Update `sign-in.tsx` to offer email vs phone choice (or separate entry points)

4. **UI Components:**
   - Phone input field (with country code selector recommended)
   - OTP input field (6-digit code entry)
   - Validation for phone number format
   - Error handling for phone auth errors

### Backend/Database Changes:

5. **Supabase Dashboard Configuration:**
   - Enable Phone provider in Supabase Dashboard (Authentication → Providers → Phone)
   - Configure SMS provider (Twilio, MessageBird, etc.)
   - Set up phone verification templates
   - Configure phone auth settings (OTP expiration, rate limiting, etc.)

6. **Database Schema:**
   - May need to update `profiles` table if phone number storage is desired
   - Consider adding `phone` column to `profiles` table (optional)

### Dependencies:

7. **No new npm packages required:**
   - `@supabase/supabase-js` already supports phone auth
   - Phone input components: Can use native React Native `TextInput` with `keyboardType="phone-pad"` or a library like `react-native-phone-number-input`

### Considerations:

- **User Experience:** Decide on auth flow:
  - Option A: Separate phone auth screens
  - Option B: Unified auth screen with email/phone toggle
  - Option C: Keep email-only, add phone as additional option

- **Profile Creation:** Phone auth doesn't automatically provide email, so `ensureProfileExists()` logic may need updates to handle phone-based users

- **Username Generation:** For phone-based signup, username generation logic in `signUp()` may need adjustment (currently uses email prefix)

- **Password Reset:** Phone users won't use email-based password reset, so consider SMS-based reset flow

- **Cost:** SMS/OTP services have per-message costs (Supabase charges for SMS sent)
