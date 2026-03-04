/**
 * Sentry error reporting. Enabled only when EXPO_PUBLIC_SENTRY_DSN is set (e.g. in beta builds).
 * Attaches user id, app version, platform, and current route/screen to events.
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { sentryDsn as DSN, sentryEnvironment, appName as configAppName } from '@/lib/config';

let initialized = false;

export function isSentryEnabled(): boolean {
  return !!DSN;
}

/** Call once at app startup. No-op if DSN is not set. */
export function initSentry(): void {
  if (!DSN || initialized) return;
  const appVersion =
    Application.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    '1.0.0';
  Sentry.init({
    dsn: DSN,
    enabled: true,
    environment: sentryEnvironment,
    release: `${configAppName}@${appVersion}`,
    dist: Application.nativeBuildVersion ?? undefined,
    tracesSampleRate: 0,
    attachStacktrace: true,
    beforeSend(event) {
      event.tags = event.tags ?? {};
      event.tags.platform = Platform.OS;
      event.tags.app_version = appVersion;
      return event;
    },
  });
  Sentry.setTag('platform', Platform.OS);
  Sentry.setTag('app_version', appVersion);
  initialized = true;
}

/** Set user context when auth state changes. Pass null to clear. */
export function setSentryUser(userId: string | null): void {
  if (!initialized) return;
  if (userId) {
    Sentry.setUser({ id: userId });
  } else {
    Sentry.setUser(null);
  }
}

/** Set current route/screen for context on errors. */
export function setSentryRoute(route: string): void {
  if (!initialized) return;
  Sentry.setTag('route', route);
}

/** Call to send a test event to Sentry. Use this to verify setup (e.g. from a dev/settings screen). */
export function captureSentryTestEvent(): void {
  if (!initialized) {
    console.warn('[Sentry] Not initialized (EXPO_PUBLIC_SENTRY_DSN not set). No test event sent.');
    return;
  }
  Sentry.captureMessage('PlayRate Sentry test event', 'info');
}

export { Sentry };
