# iOS Build Guide

This guide walks you through building your app for iOS using Expo Application Services (EAS) - **no Mac required!**

## Prerequisites

1. ✅ EAS CLI installed (already done: `npm install -g eas-cli`)
2. ✅ Expo account (create one at https://expo.dev/signup if needed)
3. ✅ Apple Developer Account ($99/year) - Required for App Store distribution

## Step 1: Login to EAS

```bash
eas login
```

This will open a browser window to log in with your Expo account.

## Step 2: Configure Your Project

Run the build configuration wizard (optional, but recommended for first-time setup):

```bash
eas build:configure
```

This will create/update the `eas.json` file. **Note**: We've already created a basic `eas.json` for you, so you can skip this if you want.

## Step 3: Build for iOS

### Option A: Build for iOS Simulator (Free - No Apple Developer Account needed)

```bash
eas build --platform ios --profile development
```

This creates a build you can install on the iOS Simulator (requires macOS).

### Option B: Build for Physical Device (Requires Apple Developer Account)

```bash
eas build --platform ios --profile preview
```

This creates an `.ipa` file you can install on a physical iOS device via TestFlight or direct installation.

### Option C: Build for App Store (Requires Apple Developer Account)

```bash
eas build --platform ios --profile production
```

This creates a production build ready for App Store submission.

## Step 4: Monitor Build Progress

After starting a build, EAS will:
1. Upload your project to Expo's servers
2. Build your app in the cloud
3. Provide you with a build URL to track progress

You'll see output like:
```
Build started, it may take a few minutes to complete.
You can monitor the build at: https://expo.dev/accounts/[your-account]/builds/[build-id]
```

## Step 5: Download & Install

Once the build completes:

### For Simulator Builds:
- You'll get a link to download the build
- Extract the `.tar.gz` file
- Open it on a Mac with Xcode installed
- Drag the app bundle to the iOS Simulator

### For Device Builds:
- Download the `.ipa` file
- Install via TestFlight (recommended) or direct installation
- Or use `eas submit` to automatically submit to App Store

## Important Notes

### Bundle Identifier
- Current bundle identifier: `com.gotgame.athleteapp`
- If you need to change it, edit `app.json` → `expo.ios.bundleIdentifier`
- Bundle identifier must be unique and match your Apple Developer account

### Apple Developer Account Setup

If you don't have one yet:

1. **Sign up** at https://developer.apple.com/programs/ ($99/year)
2. **Add your Apple ID** to your Expo account:
   ```bash
   eas credentials
   ```
3. Follow the prompts to configure credentials (EAS can manage this automatically)

### Environment Variables

Make sure your `.env` file has:
```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_key_here
```

These will be included in the build automatically.

## Troubleshooting

### "No Apple Developer account found"
- You need to sign up for an Apple Developer Program
- Or use the `development` profile for simulator builds only

### "Bundle identifier already in use"
- Change the bundle identifier in `app.json`
- Format: `com.yourcompany.appname` (use your own domain)

### "Build failed"
- Check the build logs at the provided URL
- Common issues:
  - Missing environment variables
  - Invalid API keys
  - Native module configuration issues

### Need to update native code?
After adding new native dependencies (like `react-native-maps`):
1. Make sure `app.json` plugins are configured correctly
2. EAS will automatically rebuild native code
3. No need to run `pod install` - EAS handles this in the cloud

## Testing Without Building

If you just want to test on iOS:

1. **Use Expo Go** (limited - won't work with native modules like maps):
   ```bash
   npx expo start
   ```
   Then scan QR code with Expo Go app on iOS device

2. **Use Development Build** (recommended for testing native modules):
   ```bash
   eas build --profile development --platform ios
   ```
   Install the resulting build on your device/simulator, then:
   ```bash
   npx expo start --dev-client
   ```

## Next Steps After Building

1. **TestFlight Distribution** (Beta testing):
   ```bash
   eas submit --platform ios
   ```
   Then invite testers via TestFlight

2. **App Store Submission**:
   ```bash
   eas submit --platform ios --latest
   ```
   Then complete submission in App Store Connect

3. **Continuous Integration**:
   - Set up GitHub Actions or similar CI/CD
   - Automate builds on push to main branch
   - See: https://docs.expo.dev/build/automating-builds/

## Cost

- **EAS Build**: Free tier includes 30 builds/month
- **Apple Developer**: $99/year (required for device builds and App Store)
- **TestFlight**: Free (included with Apple Developer account)

## Need Help?

- EAS Documentation: https://docs.expo.dev/build/introduction/
- Expo Discord: https://chat.expo.dev
- EAS Support: https://expo.dev/support
