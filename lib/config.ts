/**
 * Single source for environment and app config.
 * Reads from Expo extra (app.json) and process.env; safe defaults to avoid runtime crashes.
 * In __DEV__, missing keys are warned once.
 */

import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? (Constants.manifest as any)?.extra ?? {};
const env = typeof process !== 'undefined' ? process.env : {};

function get(key: string, envKey: string, fallback: string): string {
  const value = (extra as any)[key] ?? (env as any)[envKey] ?? fallback;
  if (__DEV__ && !value && fallback === '') {
    console.warn(`[config] Missing ${envKey} (or extra.${key}); feature may be disabled.`);
  }
  return value ?? fallback;
}

function getOptional(key: string, envKey: string): string | undefined {
  const value = (extra as any)[key] ?? (env as any)[envKey];
  return value && String(value).trim() ? String(value) : undefined;
}

/** Supabase project URL. Required for app to function. Reads from process.env.EXPO_PUBLIC_SUPABASE_URL (and extra). */
export const supabaseUrl = get(
  'supabaseUrl',
  'EXPO_PUBLIC_SUPABASE_URL',
  'https://nhqhkwvmludnsblimjeu.supabase.co'
);

/** Supabase anon/public key. Required for app to function. Reads from process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY (and extra). */
export const supabaseAnonKey = get(
  'supabaseAnonKey',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  ''
);

/** True only when both URL and anon key are set (so Supabase auth will work). */
export const isSupabaseConfigured = Boolean(
  supabaseUrl && String(supabaseUrl).trim() && supabaseAnonKey && String(supabaseAnonKey).trim()
);

/** PostHog API key. Empty disables analytics (no crash). */
export const posthogApiKey = getOptional('posthogApiKey', 'EXPO_PUBLIC_POSTHOG_API_KEY')
  ?? (env as any).POSTHOG_API_KEY;

/** PostHog host. Defaults to US cloud. */
export const posthogHost = get('posthogHost', 'EXPO_PUBLIC_POSTHOG_HOST', 'https://us.i.posthog.com')
  .replace(/\/$/, '');

/** Google Places / Geocoding / Maps API key. Empty disables map/geocode features. */
export const googlePlacesApiKey = getOptional('googlePlacesApiKey', 'EXPO_PUBLIC_GOOGLE_PLACES_API_KEY')
  ?? (extra as any).googlePlacesApiKey;

/** Sentry DSN. Empty disables error reporting. */
export const sentryDsn = getOptional('sentryDsn', 'EXPO_PUBLIC_SENTRY_DSN');

/** Sentry environment label (e.g. beta, production). */
export const sentryEnvironment = (env as any).EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'beta';

/** App display name from Expo config. */
export const appName = Constants.expoConfig?.name ?? 'PlayRate';
