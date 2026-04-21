import { Platform } from 'react-native';

const PLAYRATE_RESET_SCHEME = 'playrate://reset-password';

/**
 * `redirectTo` passed to `supabase.auth.resetPasswordForEmail`.
 *
 * **Why HTTPS:** Many mail clients (Gmail, Outlook) do not open custom URL schemes from
 * email links. Supabase redirects the browser to this URL with `#access_token=…&type=recovery`.
 * Use a tiny HTTPS page (see `web/password-reset-bridge.html`) that forwards the hash to
 * `playrate://reset-password`, and set `EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL` to that page.
 *
 * If you use universal links, you may set the env var to e.g. `https://app.yourdomain.com/reset-password`
 * only after that path serves the bridge HTML (or otherwise opens the app with the hash).
 *
 * **Supabase dashboard:** Add this exact URL under Authentication → URL Configuration → Redirect URLs.
 */
export function getPasswordResetRedirectTo(): string {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin.replace(/\/$/, '')}/reset-password`;
    }
    return 'http://localhost:8081/reset-password';
  }

  const fromEnv =
    typeof process !== 'undefined'
      ? process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL?.trim()
      : undefined;
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }

  return PLAYRATE_RESET_SCHEME;
}
