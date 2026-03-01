/**
 * PostHog analytics using the official posthog-react-native SDK.
 * Wrapper keeps the same API so call sites don't change.
 * The client is set by a bridge component inside PostHogProvider (see _layout).
 */

import { PostHog } from 'posthog-react-native';

import { posthogApiKey as API_KEY, posthogHost as HOST } from '@/lib/config';

let posthogKeyWarned = false;
/** Call once at app start when key is missing; dev-only one-time warning. */
export function warnPostHogKeyMissingOnce(): void {
  if (__DEV__ && !API_KEY && !posthogKeyWarned) {
    posthogKeyWarned = true;
    console.warn(
      '[analytics] PostHog API key not set; analytics disabled. Set EXPO_PUBLIC_POSTHOG_API_KEY to enable.'
    );
  }
}

let onboardingStartedAt: number | null = null;
const trackOnceKeys = new Set<string>();

let sessionId: string | null = null;
function getSessionId(): string {
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
  return sessionId;
}

/** Set by PostHogBridge in root layout when provider is mounted. */
let posthogClient: PostHog | null = null;

export function setPostHogClient(client: PostHog | null): void {
  posthogClient = client;
}

export function getPostHogClient(): PostHog | null {
  return posthogClient;
}

export const POSTHOG_API_KEY = API_KEY;
export const POSTHOG_HOST = HOST;

export async function initAnalytics(): Promise<void> {
  // No-op; client is created by PostHogProvider.
}

/** Only log when explicitly enabled via env; OFF by default. No spam. */
const DEBUG_ANALYTICS =
  (typeof process !== 'undefined' && (
    process.env.EXPO_PUBLIC_DEBUG_ANALYTICS === 'true' ||
    process.env.EXPO_PUBLIC_DEBUG_ANALYTICS === '1' ||
    process.env.DEBUG_ANALYTICS === 'true' ||
    process.env.DEBUG_ANALYTICS === '1'
  ));

/** In development, do not send events to PostHog unless analytics is explicitly enabled. */
const shouldCapture = () => !__DEV__ || DEBUG_ANALYTICS;

export function track(eventName: string, properties?: Record<string, unknown>): void {
  if (__DEV__ && DEBUG_ANALYTICS) {
    console.log('[Analytics]', eventName, properties ?? {});
  }
  if (shouldCapture()) {
    posthogClient?.capture(eventName, properties as Record<string, any> | undefined);
  }
}

export async function trackOnce(
  eventName: string,
  uniqueKey: string,
  properties?: Record<string, unknown>
): Promise<void> {
  const key = `${eventName}:${uniqueKey}`;
  if (trackOnceKeys.has(key)) return;
  trackOnceKeys.add(key);
  if (__DEV__ && DEBUG_ANALYTICS) {
    console.log('[Analytics]', eventName, '(trackOnce)', properties ?? {});
  }
  if (shouldCapture()) {
    posthogClient?.capture(eventName, properties as Record<string, any> | undefined);
  }
}

export function identifyUser(
  userId: string,
  profile?: { username?: string; name?: string }
): void {
  if (!userId) return;
  const traits: Record<string, string> = {};
  if (profile?.username) traits.username = profile.username;
  if (profile?.name) traits.name = profile.name;
  posthogClient?.identify(userId, Object.keys(traits).length ? traits : undefined);
}

export function resetAnalytics(): void {
  posthogClient?.reset();
  sessionId = null;
  trackOnceKeys.clear();
}

export function setUserProperties(properties: Record<string, unknown>): void {
  if (!posthogClient || Object.keys(properties).length === 0) return;
  const distinctId = posthogClient.getDistinctId?.();
  if (distinctId) {
    posthogClient.identify(distinctId, properties as Record<string, any>);
  }
}

export function getSessionIdForAnalytics(): string {
  return getSessionId();
}

export function setOnboardingStartedAt(at: number): void {
  if (onboardingStartedAt == null) onboardingStartedAt = at;
}

export function getOnboardingDurationSeconds(): number | null {
  if (onboardingStartedAt == null) return null;
  return Math.round((Date.now() - onboardingStartedAt) / 1000);
}

export function trackPushOptIn(): void {
  track('push_opt_in');
}

/**
 * Dev-only: send ph_test_event to verify Live Events in PostHog.
 * No-op in production (__DEV__ is false); never call from shipped UI.
 */
export function sendPhTestEvent(): void {
  if (!__DEV__) return;
  track('ph_test_event');
}
