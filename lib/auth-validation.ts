import { sanitizeUsername } from '@/lib/sanitize';

/** Practical email check; Supabase still validates server-side. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmailFormat(email: string): boolean {
  const t = email.trim();
  return t.length > 0 && t.length <= 254 && EMAIL_RE.test(t);
}

/** Client rule; align Supabase Auth “Minimum password length” in dashboard to >= this value. */
export const AUTH_PASSWORD_MIN_LENGTH = 8;

export function validateSignUpPassword(password: string): string | null {
  if (password.length < AUTH_PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${AUTH_PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include at least one letter and one number.';
  }
  return null;
}

/** Normalized usernames are lowercase [a-z0-9_]; see sanitizeUsername. */
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function validateUsername(username: string): string | null {
  const t = sanitizeUsername(username);
  if (t.length < 3) return 'Username must be at least 3 characters.';
  if (!USERNAME_RE.test(t)) {
    return 'Use 3–20 characters: letters, numbers, and underscores only (stored as lowercase).';
  }
  return null;
}

export function getRateLimitUserMessage(message: string): string | null {
  const m = message.toLowerCase();
  if (
    m.includes('rate limit') ||
    m.includes('too many requests') ||
    m.includes('too many') ||
    m.includes('over_email_send_rate') ||
    m.includes('over_sms_send_rate') ||
    m.includes('429')
  ) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  return null;
}
