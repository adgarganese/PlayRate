# Find Courts Map Setup Guide

This guide explains how to set up the required API keys and dependencies for the Find Courts map screen.

## Route Structure

The Find Courts screen is accessible at: `/courts/find`

## Required Dependencies

Install the following packages:

```bash
npx expo install expo-location react-native-maps
npm install react-native-google-places-autocomplete
```

### For iOS (CocoaPods)
After installing, run:
```bash
cd ios && pod install && cd ..
```

### For Android
No additional native setup required for react-native-maps with Expo.

## API Keys Required

### 1. Google Maps API Key (Android)

**Purpose**: Display Google Maps on Android devices

**Where to get it**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Maps SDK for Android** API
4. Create credentials → API Key
5. Restrict the API key to "Maps SDK for Android" for security

**Where to put it**:
- **Environment variable**: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- **app.json**: Already configured at `android.config.googleMaps.apiKey` (uses the env var)

**Example**:
```bash
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyExampleKey123456789
```

**Note**: iOS uses Apple Maps by default (no key required). If you want Google Maps on iOS, you'll need to add `googleMapsApiKey` to `ios.config.googleMaps` as well.

### 2. Google Places API Key

**Purpose**: Power the address autocomplete search bar

**Where to get it**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Same project as above (or different)
3. Enable the **Places API** and **Places API (New)** APIs
4. If using an existing API key, ensure it has Places API enabled
5. Restrict the API key to "Places API" for security

**Billing**: Google Places API requires billing to be enabled. You get $200 free credit per month, which covers approximately 40,000+ requests.

**Where to put it**:
- **Environment variable**: `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`
- **app.json**: Already configured at `extra.googlePlacesApiKey` (uses the env var)
- **In code**: The `find.tsx` screen reads from `Constants.expoConfig?.extra?.googlePlacesApiKey` or `process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`

**Example**:
```bash
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSyExamplePlacesKey123456789
```

## Environment Variables Setup

### Option 1: Using .env file (Recommended)

Create a `.env` file in the root of your project:

```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_android_maps_key_here
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_places_api_key_here
```

**Important**: 
- For Expo, environment variables must start with `EXPO_PUBLIC_` to be accessible in the app
- Never commit `.env` to git (add it to `.gitignore`)
- Restart your Expo dev server after adding/changing env vars

### Option 2: Using expo-constants extra (Alternative)

You can also hardcode keys directly in `app.json` under `extra` (NOT recommended for production):

```json
"extra": {
  "googlePlacesApiKey": "your_key_here"
}
```

## Required Permissions

### iOS (Info.plist)
Add these keys (handled automatically by `expo-location` plugin):

- `NSLocationWhenInUseUsageDescription`: "Allow PlayRate to use your location to find courts near you."

The plugin configuration in `app.json` handles this automatically.

### Android (AndroidManifest.xml)
Add these permissions (handled automatically by `expo-location`):

- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`

## Database Requirements

The `courts` table already has the required fields:
- `lat` (NUMERIC(10, 8)) - Latitude
- `lng` (NUMERIC(11, 8)) - Longitude
- `address` (TEXT) - Address for display

**Migration**: If you need to add these fields, run:

```sql
ALTER TABLE courts
ADD COLUMN IF NOT EXISTS lat NUMERIC(10, 8),
ADD COLUMN IF NOT EXISTS lng NUMERIC(11, 8);

CREATE INDEX IF NOT EXISTS idx_courts_location ON courts(lat, lng);
```

## Testing

1. Start your Expo dev server: `npx expo start`
2. Navigate to `/courts/find` route
3. Test the following:
   - Search bar autocomplete (requires Google Places API key)
   - "Use my location" button (requires location permission)
   - Map markers (requires courts with lat/lng in database)
   - Marker callouts (tap markers to see court info)

## Troubleshooting

### "Google Places API key not found"
- Ensure `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` is set in your environment
- Restart Expo dev server after setting env vars
- Check that the Places API is enabled in Google Cloud Console

### "Map not loading on Android"
- Ensure `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is set
- Verify Maps SDK for Android is enabled in Google Cloud Console
- Check that the API key restrictions allow your app's package name

### "Location permission denied"
- Check that location permissions are granted in device settings
- On iOS, ensure the permission message is shown (first time only)
- Verify `expo-location` plugin is properly configured in `app.json`

### "No courts found"
- Ensure courts in your database have valid `lat` and `lng` values
- Check that the map region covers courts in your database
- Try zooming out or searching a different location

## File Changes Summary

1. **app/courts/find.tsx** - New map screen component
2. **lib/courts.ts** - Added `fetchCourtsNearLocation()` function
3. **app.json** - Added Google Maps config and expo-location plugin
4. **package.json** - Requires installation of:
   - `expo-location`
   - `react-native-maps`
   - `react-native-google-places-autocomplete`
