const expoMockState: { extra: Record<string, string> } = { extra: {} };

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      name: 'PlayRate',
      get extra() {
        return expoMockState.extra;
      },
    },
    manifest: {},
  },
}));

const CLEARED_KEYS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_POSTHOG_API_KEY',
  'POSTHOG_API_KEY',
  'EXPO_PUBLIC_POSTHOG_HOST',
  'EXPO_PUBLIC_GOOGLE_PLACES_API_KEY',
  'EXPO_PUBLIC_GOOGLE_GEOCODING_API_KEY',
  'EXPO_PUBLIC_SENTRY_DSN',
  'EXPO_PUBLIC_SENTRY_ENVIRONMENT',
] as const;

function clearExpoPublicEnv() {
  for (const k of CLEARED_KEYS) {
    delete process.env[k];
  }
}

function loadConfig(): typeof import('../config') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../config') as typeof import('../config');
}

describe('config', () => {
  beforeEach(() => {
    clearExpoPublicEnv();
    expoMockState.extra = {};
    jest.resetModules();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses empty string defaults when Supabase env and extra are missing, and warns in __DEV__', () => {
    const { supabaseUrl, supabaseAnonKey, isSupabaseConfigured } = loadConfig();
    expect(supabaseUrl).toBe('');
    expect(supabaseAnonKey).toBe('');
    expect(isSupabaseConfigured).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });

  it('reads Supabase URL and anon key from process.env', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    const { supabaseUrl, supabaseAnonKey, isSupabaseConfigured } = loadConfig();
    expect(supabaseUrl).toBe('https://proj.supabase.co');
    expect(supabaseAnonKey).toBe('test-anon-key');
    expect(isSupabaseConfigured).toBe(true);
  });

  it('ignores unresolved Expo extra placeholders and uses env', () => {
    expoMockState.extra = {
      supabaseUrl: '${EXPO_PUBLIC_SUPABASE_URL}',
      supabaseAnonKey: '${EXPO_PUBLIC_SUPABASE_ANON_KEY}',
    };
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://from-env.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'from-env-key';
    const { supabaseUrl, supabaseAnonKey } = loadConfig();
    expect(supabaseUrl).toBe('https://from-env.supabase.co');
    expect(supabaseAnonKey).toBe('from-env-key');
  });

  it('prefers extra over env when extra is a concrete value', () => {
    expoMockState.extra = {
      supabaseUrl: 'https://from-extra.supabase.co',
      supabaseAnonKey: 'extra-key',
    };
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://from-env.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'env-key';
    const { supabaseUrl, supabaseAnonKey } = loadConfig();
    expect(supabaseUrl).toBe('https://from-extra.supabase.co');
    expect(supabaseAnonKey).toBe('extra-key');
  });

  it('posthogHost defaults to US cloud without trailing slash', () => {
    const { posthogHost } = loadConfig();
    expect(posthogHost).toBe('https://us.i.posthog.com');
  });

  it('strips trailing slash from posthogHost', () => {
    expoMockState.extra = { posthogHost: 'https://eu.posthog.com/' };
    const { posthogHost } = loadConfig();
    expect(posthogHost).toBe('https://eu.posthog.com');
  });

  it('posthogApiKey is undefined when unset', () => {
    const { posthogApiKey } = loadConfig();
    expect(posthogApiKey).toBeUndefined();
  });

  it('sentryEnvironment defaults to beta', () => {
    const { sentryEnvironment } = loadConfig();
    expect(sentryEnvironment).toBe('beta');
  });

  it('sentryEnvironment reads EXPO_PUBLIC_SENTRY_ENVIRONMENT', () => {
    process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT = 'production';
    const { sentryEnvironment } = loadConfig();
    expect(sentryEnvironment).toBe('production');
  });

  it('googlePlacesApiKey is undefined when unset', () => {
    const { googlePlacesApiKey } = loadConfig();
    expect(googlePlacesApiKey).toBeUndefined();
  });

  it('googleGeocodingApiKey falls back to googlePlacesApiKey', () => {
    expoMockState.extra = { googlePlacesApiKey: 'places-only-key' };
    const { googleGeocodingApiKey, googlePlacesApiKey } = loadConfig();
    expect(googlePlacesApiKey).toBe('places-only-key');
    expect(googleGeocodingApiKey).toBe('places-only-key');
  });
});
