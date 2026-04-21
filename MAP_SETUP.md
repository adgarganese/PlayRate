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

**Example** (use your real key from Google Cloud; do not commit it):
```bash
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_maps_sdk_android_key
```

**Note**: iOS uses Apple Maps by default (no key required). If you want Google Maps on iOS, you'll need to add `googleMapsApiKey` to `ios.config.googleMaps` as well.

### 2. Google Places + Geocoding keys (REST, from the app)

**Purpose**

| Variable | Used for | Google APIs to enable on that key |
|----------|-----------|-----------------------------------|
| `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` | Find Courts search (`GooglePlacesAutocomplete`): legacy **Place Autocomplete** + **Place Details** | **Places API** (legacy autocomplete/details) |
| `EXPO_PUBLIC_GOOGLE_GEOCODING_API_KEY` (optional) | Add court flow: `geocodeAddress()` in `lib/geocoding.ts` | **Geocoding API** |
| *(fallback)* | If geocoding env is empty, geocoding uses `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` | That key must enable **Geocoding API** as well |

**Implementation notes**

- `react-native-google-places-autocomplete` defaults to **legacy** endpoints: `.../place/autocomplete/json` and `.../place/details/json` on `maps.googleapis.com/maps/api` (not Places API (New) unless you pass `isNewPlacesAPI`).
- Geocoding uses `GET .../maps/api/geocode/json?address=...&key=...`.
- **There is no proxy**: these keys are loaded from env / `app.json` extra only (see `lib/config.ts`). They are **not** hardcoded in source. They **are** embedded in the client bundle (`EXPO_PUBLIC_*`) and sent as **`key=` query parameters** on HTTPS requests to Google, so treat them as **public** and **lock them down in Google Cloud** (API restrictions + app restrictions).

**Where to get keys**:
1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → enable the APIs above.
2. Create credentials → API key(s). Prefer **one key for Android Maps SDK only** and **one key for Places+Geocoding** (or split Places vs Geocoding with two keys using `EXPO_PUBLIC_GOOGLE_GEOCODING_API_KEY`).

**Recommended restrictions**

- **Maps key** (`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`): Application restriction **Android apps** (package `com.playrate.app` + SHA-1). API restriction: **Maps SDK for Android** only.
- **Places / Geocoding key(s)**: Application restriction **Android app** and/or **iOS app** (bundle `com.playrate.app`) for requests from React Native, when supported for your enabled APIs. API restriction: only **Places API** and/or **Geocoding API** (not Maps SDK). Splitting geocoding to `EXPO_PUBLIC_GOOGLE_GEOCODING_API_KEY` lets you restrict that key to Geocoding API only.
- For stronger security than client-side keys, move Places autocomplete and geocoding behind **your own backend** and use a **server-restricted** key or no key in the app.

**Billing**: Places and Geocoding require billing on the GCP project; free tier credits apply per Google’s pricing.

**Where to put them**:
- **Environment**: `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`, optional `EXPO_PUBLIC_GOOGLE_GEOCODING_API_KEY`
- **app.json** `extra`: `googlePlacesApiKey`, `googleGeocodingApiKey` (substituted at build from the same env names)
- **In code**: `lib/config.ts` (`googlePlacesApiKey`, `googleGeocodingApiKey`); Find Courts uses `googlePlacesApiKey`; geocoding uses `googleGeocodingApiKey`

**Example**:
```bash
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_places_key
EXPO_PUBLIC_GOOGLE_GEOCODING_API_KEY=your_geocoding_only_key
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

Do **not** paste real keys into `app.json` for production; use EAS secrets / env so values stay `${EXPO_PUBLIC_...}` at rest in repo.

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
