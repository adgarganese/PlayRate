/**
 * Single source for environment and app config.
 * Reads from Expo extra (app.json) and process.env; safe defaults to avoid runtime crashes.
 * In __DEV__, missing keys are warned once.
 *
 * EXPO_PUBLIC_* reads use static `process.env.EXPO_PUBLIC_*` (or chained off it) so
 * babel-preset-expo's `expoInlineEnvVars` can inline them in production bundles.
 */

import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? (Constants.manifest as any)?.extra ?? {};

/** app.json may contain literal "${EXPO_PUBLIC_*}" before EAS substitutes; prefer process.env in that case. */
function isUnresolvedEnvPlaceholder(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /^\$\{EXPO_PUBLIC_[A-Z0-9_]+\}$/.test(value.trim());
}

function pickExtraOrEnv(
  extraKey: string,
  envValue: string | undefined,
  fallback: string,
  warnEnvKey: string
): string {
  const fromExtra = (extra as any)[extraKey];
  const raw = !isUnresolvedEnvPlaceholder(fromExtra) ? fromExtra : undefined;
  const value = raw ?? envValue ?? fallback;
  if (__DEV__ && !value && fallback === '') {
    console.warn(`[config] Missing ${warnEnvKey} (or extra.${extraKey}); feature may be disabled.`);
  }
  return value ?? fallback;
}

function pickExtraOrEnvOptional(extraKey: string, envValue: string | undefined): string | undefined {
  const fromExtra = (extra as any)[extraKey];
  const raw = !isUnresolvedEnvPlaceholder(fromExtra) ? fromExtra : undefined;
  const candidate = raw ?? envValue;
  return candidate && String(candidate).trim() ? String(candidate) : undefined;
}

/** Supabase project URL. Required for app to function. Reads from process.env.EXPO_PUBLIC_SUPABASE_URL (and extra). */
export const supabaseUrl = pickExtraOrEnv(
  'supabaseUrl',
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  '',
  'EXPO_PUBLIC_SUPABASE_URL'
);

/** Supabase anon/public key. Required for app to function. Reads from process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY (and extra). */
export const supabaseAnonKey = pickExtraOrEnv(
  'supabaseAnonKey',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  '',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY'
);

/** True only when both URL and anon key are set (so Supabase auth will work). */
export const isSupabaseConfigured = Boolean(
  supabaseUrl && String(supabaseUrl).trim() && supabaseAnonKey && String(supabaseAnonKey).trim()
);

function pickPosthogApiKey(): string | undefined {
  const fromExtra = (extra as any).posthogApiKey;
  const raw = !isUnresolvedEnvPlaceholder(fromExtra) ? fromExtra : undefined;
  const candidate = raw ?? process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? process.env.POSTHOG_API_KEY;
  return candidate && String(candidate).trim() ? String(candidate) : undefined;
}

/** PostHog API key. Empty disables analytics (no crash). */
export const posthogApiKey = pickPosthogApiKey();

/** PostHog host. Defaults to US cloud. */
export const posthogHost = pickExtraOrEnv(
  'posthogHost',
  process.env.EXPO_PUBLIC_POSTHOG_HOST,
  'https://us.i.posthog.com',
  'EXPO_PUBLIC_POSTHOG_HOST'
).replace(/\/$/, '');

/**
 * Google Places (autocomplete + place details) — loaded only from env / Expo extra. Never hardcode.
 * Used client-side by `react-native-google-places-autocomplete` (HTTP to maps.googleapis.com).
 */
export const googlePlacesApiKey = pickExtraOrEnvOptional(
  'googlePlacesApiKey',
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY
);

/**
 * Geocoding API key. If unset, falls back to `googlePlacesApiKey` (one key with both APIs enabled is common).
 * Set `EXPO_PUBLIC_GOOGLE_GEOCODING_API_KEY` to use a separate key restricted to Geocoding API only.
 */
export const googleGeocodingApiKey =
  pickExtraOrEnvOptional('googleGeocodingApiKey', process.env.EXPO_PUBLIC_GOOGLE_GEOCODING_API_KEY) ??
  googlePlacesApiKey;

/** Sentry DSN. Empty disables error reporting. */
export const sentryDsn = pickExtraOrEnvOptional('sentryDsn', process.env.EXPO_PUBLIC_SENTRY_DSN);

/**
 * Sentry environment tag. Prefer `EXPO_PUBLIC_SENTRY_ENVIRONMENT` per EAS profile (e.g. preview, production, beta);
 * otherwise use development vs production from the JS bundle mode.
 */
const explicitSentryEnv = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT;
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
export const universalLinkHost = pickExtraOrEnvOptional(
  'universalLinkHost',
  process.env.EXPO_PUBLIC_UNIVERSAL_LINK_HOST
);

/**
 * Max highlight video upload size after client compression (bytes).
 * Adjust here for policy changes without hunting call sites.
 */
export const HIGHLIGHT_VIDEO_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** User-facing copy when post-compression size still exceeds {@link HIGHLIGHT_VIDEO_MAX_UPLOAD_BYTES}. */
export const HIGHLIGHT_VIDEO_TOO_LARGE_MESSAGE =
  'This video is too large. Try a shorter clip.';
