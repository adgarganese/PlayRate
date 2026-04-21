import { googleGeocodingApiKey } from '@/lib/config';
import { logger } from '@/lib/logger';

/**
 * Geocode an address using Google Geocoding API (REST).
 * The key is sent as a query parameter from the app; anyone with the bundle can extract it.
 * Prefer API key restrictions in Google Cloud; for stronger protection, proxy geocoding on your backend.
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address || !address.trim()) {
    return null;
  }

  const apiKey = googleGeocodingApiKey ?? '';

  if (!apiKey) {
    if (__DEV__) {
      console.warn(
        '[geocoding] No Geocoding API key (EXPO_PUBLIC_GOOGLE_GEOCODING_API_KEY or EXPO_PUBLIC_GOOGLE_PLACES_API_KEY). Geocoding disabled.'
      );
    }
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
    if (data.status !== 'ZERO_RESULTS') {
      logger.warn('[geocoding] Geocode API non-OK', {
        status: data.status,
        errorMessage: data.error_message || '',
      });
    }
    return null;
  } catch (error) {
    logger.error('[geocoding] Request failed', { err: error });
    return null;
  }
}
