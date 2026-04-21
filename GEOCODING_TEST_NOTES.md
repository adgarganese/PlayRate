# Geocoding Function Test Notes

## Function Review

The `geocodeAddress()` function in `lib/geocoding.ts` has been implemented with the following logic:

✅ **Validations:**
- Checks for empty/null addresses
- Checks for API key availability
- Handles errors gracefully

✅ **API Call:**
- Uses Google Geocoding API
- Encodes address properly
- Parses response correctly

✅ **Error Handling:**
- Returns `null` on errors (doesn't crash)
- Logs warnings/errors for debugging

## Important Note

⚠️ **API Key Configuration:**
`lib/geocoding.ts` uses `googleGeocodingApiKey` from `lib/config.ts`:

- **`EXPO_PUBLIC_GOOGLE_GEOCODING_API_KEY`** — if set, used for Geocoding API only (tighter key restrictions).
- **Otherwise** falls back to **`EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`** — that key must have **Geocoding API** enabled in Google Cloud as well.

**Places vs Geocoding:**

- **Places API** — autocomplete + place details on Find Courts (`find.tsx`).
- **Geocoding API** — address → lat/lng when adding a court.

## Testing the Function

### Option 1: Test via App (Recommended)
1. Open the app
2. Navigate to "Add Court" (`/courts/new`)
3. Enter a court name and address (e.g., "1600 Amphitheatre Parkway, Mountain View, CA")
4. Submit the form
5. Check the console logs for:
   - Geocoding success messages
   - Or warnings if geocoding fails
6. Verify in database: Check if `lat` and `lng` fields are populated

### Option 2: Manual API Test
Test the Google Geocoding API directly:

```bash
# Replace YOUR_API_KEY with your actual key
curl "https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=YOUR_API_KEY"
```

Expected response:
```json
{
  "status": "OK",
  "results": [{
    "geometry": {
      "location": {
        "lat": 37.4224764,
        "lng": -122.0842499
      }
    },
    "formatted_address": "1600 Amphitheatre Parkway, Mountain View, CA 94043, USA"
  }]
}
```

### Option 3: Check Console Logs
When creating a court:
- **Success**: Coordinates should be in database, no errors in console
- **Failure**: Console warning like "Geocoding failed: [status]" or "Google Places API key not found"
- **Partial success**: Court created but with `null` coordinates (graceful degradation)

## Common Issues & Solutions

### Issue: "Geocoding failed: REQUEST_DENIED"
**Cause**: API key doesn't have Geocoding API enabled
**Solution**: Enable "Geocoding API" in Google Cloud Console

### Issue: "Google Places API key not found"
**Cause**: API key not set in environment
**Solution**: Set `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` in `.env` or `app.json`

### Issue: "Geocoding failed: ZERO_RESULTS"
**Cause**: Address couldn't be found
**Solution**: This is expected for invalid addresses - court will still be created with null coordinates

### Issue: Coordinates are null after creation
**Possible causes:**
1. Geocoding API not enabled
2. API key incorrect/expired
3. Network error during geocoding
4. Invalid address format

**Check:**
- Console logs for specific error messages
- Database to see if lat/lng are null
- API key permissions in Google Cloud Console

## Expected Behavior

✅ **Success Case:**
- Address: "1600 Amphitheatre Parkway, Mountain View, CA"
- Result: `{ lat: 37.4224764, lng: -122.0842499 }`
- Database: Court saved with coordinates

✅ **Graceful Failure:**
- Address: "Invalid Address 12345"
- Result: `null`
- Database: Court saved with `lat: null, lng: null`
- Console: Warning logged, app continues normally

✅ **Error Handling:**
- Network error: Returns `null`, court still created
- API error: Returns `null`, court still created
- No API key: Returns `null`, court still created

## Verification Steps

After implementing, verify:

1. ✅ Create a court with a valid address
2. ✅ Check database - coordinates should be populated
3. ✅ Create a court with invalid address
4. ✅ Check database - coordinates should be null (graceful degradation)
5. ✅ Check map finder - courts with coordinates should appear
6. ✅ Check map finder - courts without coordinates should NOT appear (expected)
