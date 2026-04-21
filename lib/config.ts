/**
 * Single source for environment and app config.
 * Reads from Expo extra (app.json) and process.env; safe defaults to avoid runtime crashes.
 * In __DEV__, missing keys are warned once.
 */

import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? (Constants.manifest as any)?.extra ?? {};
const env = typeof process !== 'undefined' ? process.env : {};

/** app.json may contain literal "${EXPO_PUBLIC_*}" before EAS substitutes; prefer process.env in that case. */
function isUnresolvedEnvPlaceholder(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^\$\{EXPO_PUBLIC_[A-Z0-9_]+\}$/.test(value.trim());
}

function get(key: string, envKey: string, fallback: string): string {
  const fromExtra = (extra as any)[key];
  const fromEnv = (env as any)[envKey];
  const raw = !isUnresolvedEnvPlaceholder(fromExtra) ? fromExtra : undefined;
  const value = raw ?? fromEnv ?? fallback;
  if (__DEV__ && !value && fallback === '') {
    console.warn(`[config] Missing ${envKey} (or extra.${key}); feature may be disabled.`);
  }
  return value ?? fallback;
}

function getOptional(key: string, envKey: string): string | undefined {
  const fromExtra = (extra as any)[key];
  const fromEnv = (env as any)[envKey];
  const candidate =
    (!isUnresolvedEnvPlaceholder(fromExtra) ? fromExtra : undefined) ?? fromEnv;
  return candidate && String(candidate).trim() ? String(candidate) : undefined;
}

/** Supabase project URL. Required for app to function. Reads from process.env.EXPO_PUBLIC_SUPABASE_URL (and extra). */
export const supabaseUrl = get(
  'supabaseUrl',
  'EXPO_PUBLIC_SUPABASE_URL',
  ''
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

/**
 * Google Places (autocomplete + place details) — loaded only from env / Expo extra. Never hardcode.
 * Used client-side by `react-native-google-places-autocomplete` (HTTP to maps.googleapis.com).
 */
export const googlePlacesApiKey = getOptional('googlePlacesApiKey', 'EXPO_PUBLIC_GOOGLE_PLACES_API_KEY');

/**
 * Geocoding API key. If unset, falls back to `googlePlacesApiKey` (one key with both APIs enabled is common).
 * Set `EXPO_PUBLIC_GOOGLE_GEOCODING_API_KEY` to use a separate key restricted to Geocoding API only.
 */
export const googleGeocodingApiKey =
  getOptional('googleGeocodingApiKey', 'EXPO_PUBLIC_GOOGLE_GEOCODING_API_KEY') ?? googlePlacesApiKey;

/** Sentry DSN. Empty disables error reporting. */
export const sentryDsn = getOptional('sentryDsn', 'EXPO_PUBLIC_SENTRY_DSN');

/**
 * Sentry environment tag. Prefer `EXPO_PUBLIC_SENTRY_ENVIRONMENT` per EAS profile (e.g. preview, production, beta);
 * otherwise use development vs production from the JS bundle mode.
 */
const explicitSentryEnv = (env as any).EXPO_PUBLIC_SENTRY_ENVIRONMENT;
export const sentryEnvironment =
  typeof explicitSentryEnv === 'string' && explicitSentryEnv.trim()
    ? explicitSentryEnv.trim()
    : __DEV__
      ? 'development'
      : 'production';

/** App display name from Expo config. */
export const appName = Constants.expoConfig?.name ?? 'PlayRate';

/**
 * Hostname only (e.g. app.playrate.com) for universal links / iOS associated domains / Android App Links.
 * See `app.config.js` and `docs/deep-links.md`. Optional until the marketing site serves AASA + assetlinks.
 */
export const universalLinkHost = getOptional('universalLinkHost', 'EXPO_PUBLIC_UNIVERSAL_LINK_HOST');

/**
 * Max highlight video upload size after client compression (bytes).
 * Adjust here for policy changes without hunting call sites.
 */
export const HIGHLIGHT_VIDEO_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** User-facing copy when post-compression size still exceeds {@link HIGHLIGHT_VIDEO_MAX_UPLOAD_BYTES}. */
export const HIGHLIGHT_VIDEO_TOO_LARGE_MESSAGE =
  'This video is too large. Try a shorter clip.';
