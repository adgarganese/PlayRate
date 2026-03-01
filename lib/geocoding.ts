import { googlePlacesApiKey } from '@/lib/config';

/**
 * Geocode an address using Google Geocoding API
 * @param address - The address string to geocode
 * @returns Promise with lat/lng coordinates or null if geocoding fails
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address || !address.trim()) {
    return null;
  }

  const apiKey = googlePlacesApiKey ?? '';

  if (!apiKey) {
    if (__DEV__) console.warn('[geocoding] Google Places API key not found. Geocoding will fail.');
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address.trim());
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }
    if (__DEV__) console.warn('[geocoding] Failed:', data.status, data.error_message || '');
    return null;
  } catch (error) {
    if (__DEV__) console.error('[geocoding] Error:', error);
    return null;
  }
}
