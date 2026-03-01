# Password Reset Setup Guide

## Supabase Dashboard Configuration

### Step 1: Configure Site URL

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: **nhqhkwvmludnsblimjeu**
3. Navigate to: **Authentication → URL Configuration**
4. Set **Site URL** to: `http://localhost:8081`

**Important:** Keep this as a web URL (not `athleteapp://`). Supabase's email system requires HTTP/HTTPS URLs.

### Step 2: Add Redirect URLs

In the **Redirect URLs** section, add these URLs (one per line):

```
athleteapp://reset-password
http://localhost:8081/reset-password
```

**Explanation:**
- `athleteapp://reset-password`: Deep link for native mobile apps (iOS/Android)
- `http://localhost:8081/reset-password`: Web URL for browser testing

### Step 3: Save Changes

Click **Save** to apply the changes.

## How It Works

1. **User requests reset:**
   - User goes to Sign In → clicks "Forgot password?"
   - Enters email on Forgot Password screen
   - App sends platform-specific `redirectTo` URL:
     - Native: `athleteapp://reset-password`
     - Web: `http://localhost:8081/reset-password`

2. **User clicks email link:**
   - **On Native (iOS/Android):** Deep link opens app directly to Reset Password screen
   - **On Web:** Web URL opens in browser to Reset Password screen
   - Supabase automatically detects tokens in URL (web) or app extracts them (native)

3. **User sets new password:**
   - Enters new password and confirms
   - Password is updated via Supabase
   - User is redirected to Sign In

## Testing

### Test on Web:
1. Go to Sign In screen
2. Click "Forgot password?"
3. Enter your email
4. Check email for reset link
5. Click link (should open in browser)
6. Enter new password
7. Should redirect to Sign In

### Test on Native:
1. Go to Sign In screen
2. Click "Forgot password?"
3. Enter your email
4. Check email for reset link
5. Click link (should open app)
6. Enter new password
7. Should redirect to Sign In

## Troubleshooting

- **Link doesn't open app (native):**
  - Ensure `athleteapp://reset-password` is in Supabase Redirect URLs
  - Ensure your `app.json` `scheme` is `athleteapp`
  - Test on a physical device or emulator (deep links don't work in web browser)

- **"Invalid or expired reset link" error:**
  - The token may have expired (request a new link)
  - The link may have been used already
  - Check console logs for details

- **Web redirect not working:**
  - Ensure `http://localhost:8081/reset-password` is in Supabase Redirect URLs
  - Check browser console for errors
  - Verify Expo dev server is running on port 8081

## Production Setup

When deploying to production, update:

1. **Site URL:** Change to your production domain (e.g., `https://yourdomain.com`)
2. **Redirect URLs:** Add your production URLs:
   ```
   athleteapp://reset-password
   https://yourdomain.com/reset-password
   ```

