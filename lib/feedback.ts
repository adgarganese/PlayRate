/**
 * Report a problem: builds a prefilled mailto URL with device/app/user context for beta feedback.
 * Send Feedback: builds questionnaire URL with query params for context.
 */

import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const SUPPORT_EMAIL =
  process.env.EXPO_PUBLIC_SUPPORT_EMAIL ||
  Constants.expoConfig?.extra?.supportEmail ||
  'support@example.com';

/**
 * Beta feedback questionnaire URL — used by the "Send Feedback" button (Profile → Account & Security).
 * Setup (pick one):
 *   1. Env: EXPO_PUBLIC_FEEDBACK_FORM_URL=https://your-form-url.com/...
 *   2. App config: extra.feedbackFormUrl in app.config.js/ts
 * The app appends query params: build_number, app_version, platform, device_model, user_id (if logged in).
 */
export const FEEDBACK_FORM_URL: string =
  process.env.EXPO_PUBLIC_FEEDBACK_FORM_URL ||
  (Constants.expoConfig?.extra?.feedbackFormUrl as string | undefined) ||
  'https://example.com/feedback';

/** App version and build for analytics; safe fallbacks. */
export function getFeedbackContext(): { app_version: string; build_number: string } {
  const app_version =
    Application.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    '1.1.0';
  const build_number =
    Application.nativeBuildVersion ??
    Constants.expoConfig?.ios?.buildNumber ??
    (Constants.expoConfig?.android?.versionCode != null
      ? String(Constants.expoConfig.android.versionCode)
      : '') ??
    '';
  return { app_version, build_number };
}

/** Build feedback form URL with query params (app_version, build_number, platform, device_model, user_id). */
export function getFeedbackFormUrl(options: { userId?: string | null }): string {
  const { app_version, build_number } = getFeedbackContext();
  const params = new URLSearchParams();
  if (build_number) params.set('build_number', build_number);
  if (app_version) params.set('app_version', app_version);
  params.set('platform', Platform.OS);
  const deviceModel = Device.modelName ?? undefined;
  if (deviceModel) params.set('device_model', deviceModel);
  if (options.userId) params.set('user_id', options.userId);
  const query = params.toString();
  const [base, existingQuery] = FEEDBACK_FORM_URL.split('?');
  const fullQuery = existingQuery ? `${existingQuery}&${query}` : query;
  return fullQuery ? `${base}?${fullQuery}` : base;
}

/** Build body lines for feedback email (device, app version, platform, user id, route). */
export function getReportProblemBody(options: {
  userId?: string | null;
  route?: string;
}): string {
  const { userId, route } = options;
  const appVersion = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.1.0';
  const deviceName = Device.deviceName ?? Device.modelName ?? 'Unknown device';
  const osVersion = Device.osVersion ?? Platform.Version ?? '';

  const lines = [
    '',
    '---',
    'App: ' + (Constants.expoConfig?.name ?? 'PlayRate') + ' v' + appVersion,
    'Platform: ' + Platform.OS + (osVersion ? ' ' + osVersion : ''),
    'Device: ' + deviceName,
  ];
  if (userId) lines.push('User ID: ' + userId);
  if (route) lines.push('Screen: ' + route);
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

/** Full mailto URL for "Report a problem" (subject + body with context). */
export function getReportProblemMailtoUrl(options: {
  userId?: string | null;
  route?: string;
}): string {
  const body = getReportProblemBody(options);
  const subject = encodeURIComponent('App feedback / Report a problem');
  const bodyEnc = encodeURIComponent(body);
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${bodyEnc}`;
}

/**
 * Privacy Policy URL for Account & Security. Returns null if not configured.
 * Set EXPO_PUBLIC_PRIVACY_POLICY_URL or extra.privacyPolicyUrl to enable.
 */
export function getPrivacyPolicyUrl(): string | null {
  const url =
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ||
    (Constants.expoConfig?.extra?.privacyPolicyUrl as string | undefined);
  return url && url.trim() ? url : null;
}

/**
 * Terms of Service URL for Account & Security. Returns null if not configured.
 * Set EXPO_PUBLIC_TERMS_URL or extra.termsUrl to enable.
 */
export function getTermsUrl(): string | null {
  const url =
    process.env.EXPO_PUBLIC_TERMS_URL ||
    (Constants.expoConfig?.extra?.termsUrl as string | undefined);
  return url && url.trim() ? url : null;
}

export { SUPPORT_EMAIL };
