# Find Courts Map Implementation Summary

## Route Structure

**New Route**: `/courts/find`

This route is accessible via:
- Direct navigation: `router.push('/courts/find')`
- URL: `athleteapp://courts/find` (deep link)

## Files Changed/Created

### 1. New File: `app/courts/find.tsx`
Complete map screen with:
- Google Places autocomplete search bar
- Map with markers for courts
- "Use my location" button
- Marker callouts with court info
- Loading, error, and empty states
- Dark theme styling matching GotGame? design system

### 2. Modified: `lib/courts.ts`
Added new function:
```typescript
fetchCourtsNearLocation(centerLat: number, centerLng: number, radiusKm: number): Promise<Court[]>
```
- Queries courts within a bounding box around center point
- Filters by exact distance using Haversine formula
- Includes court sports via join
- Returns only courts with valid lat/lng coordinates

### 3. Modified: `app.json`
Changes:
- Added `android.config.googleMaps.apiKey` for Google Maps SDK
- Added `expo-location` plugin with location permission message
- Added `extra.googlePlacesApiKey` for Places API access

### 4. Created: `MAP_SETUP.md`
Complete setup guide with:
- API key configuration instructions
- Environment variable setup
- Dependencies installation
- Troubleshooting guide

## Required Dependencies Installation

Run these commands to install required packages:

```bash
# Install Expo packages (includes native code)
npx expo install expo-location react-native-maps

# Install third-party autocomplete library
npm install react-native-google-places-autocomplete

# For iOS, install CocoaPods dependencies
cd ios && pod install && cd ..
```

**Note**: `expo-constants` is already installed in your project.

## Required API Keys

### 1. Google Maps API Key (Android)
- **Env Var**: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- **Location in app.json**: `android.config.googleMaps.apiKey`
- **Purpose**: Display Google Maps on Android
- **Setup**: Enable "Maps SDK for Android" in Google Cloud Console

### 2. Google Places API Key
- **Env Var**: `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`
- **Location in app.json**: `extra.googlePlacesApiKey`
- **Purpose**: Power address autocomplete search
- **Setup**: Enable "Places API" and "Places API (New)" in Google Cloud Console
- **Billing**: Required (but $200/month free credit available)

## Environment Variables Setup

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_android_maps_key_here
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_places_api_key_here
```

**Important**: 
- Restart Expo dev server after adding/changing env vars
- Never commit `.env` to git
- The `EXPO_PUBLIC_` prefix is required for Expo to expose the variable

## Database Requirements

The `courts` table already has the required fields:
- `lat` (NUMERIC(10, 8)) - Latitude
- `lng` (NUMERIC(11, 8)) - Longitude
- `address` (TEXT) - Address for display

**Index**: Already exists at `idx_courts_location ON courts(lat, lng)` for query performance.

If you need to add these fields to an existing database, run:

```sql
ALTER TABLE courts
ADD COLUMN IF NOT EXISTS lat NUMERIC(10, 8),
ADD COLUMN IF NOT EXISTS lng NUMERIC(11, 8);

CREATE INDEX IF NOT EXISTS idx_courts_location ON courts(lat, lng);
```

## Features Implemented

✅ Google Places autocomplete search bar  
✅ Map with court markers (Apple Maps on iOS, Google Maps on Android)  
✅ "Use my location" button with permission handling  
✅ Marker callouts showing court name and address  
✅ Tapping marker navigates to court detail page  
✅ Loading states with overlay  
✅ Error handling with retry  
✅ Empty state when no courts found  
✅ Results count badge  
✅ Dark theme matching GotGame? design  
✅ Automatic refresh when map region changes  
✅ Bounding box query with exact distance filtering  

## Testing Checklist

1. ✅ Install dependencies
2. ✅ Set up API keys in environment
3. ✅ Restart Expo dev server
4. ✅ Navigate to `/courts/find`
5. ✅ Test search bar autocomplete
6. ✅ Test "Use my location" button
7. ✅ Test marker tap/callout
8. ✅ Test map region changes (pan/zoom)
9. ✅ Test loading states
10. ✅ Test error states
11. ✅ Test empty state (if no courts in area)

## Next Steps

1. **Add to navigation**: Consider adding a "Find Courts" button/link in the courts list screen
2. **Customize default region**: Update `DEFAULT_REGION` in `find.tsx` to your app's primary area
3. **Add filters**: Consider adding sport filters to only show courts for specific sports
4. **Performance**: For large datasets, consider using PostGIS for better geospatial queries
5. **Caching**: Consider caching court locations to reduce database queries

## Known Limitations

- Uses bounding box + Haversine filtering (PostGIS would be more performant for large datasets)
- Limits to 100 courts per query (can be adjusted in `fetchCourtsNearLocation`)
- Google Places API requires billing (but has free tier)
- iOS uses Apple Maps by default (to use Google Maps on iOS, need additional config)
