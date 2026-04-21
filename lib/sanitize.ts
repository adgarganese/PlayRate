/**
 * Client-side string cleanup before Supabase writes. Not a substitute for RLS / server validation.
 * Supabase client uses parameterized queries — no raw SQL from these strings.
 * User-generated text is rendered in RN Text / AppText (not WebView HTML); still normalize length & whitespace.
 */

/** Use these for UI maxLength and server-aligned caps. */
export const SANITIZE_LIMITS = {
  profileName: 80,
  profileBio: 500,
  playStyleCustom: 24,
  highlightComment: 500,
  dmBody: 4000,
  courtChatMessage: 280,
  courtEditSuggestion: 2000,
} as const;

/**
 * Trim, normalize line endings, collapse whitespace.
 * - `multiline: false` (default): all whitespace → single spaces (chat/DM/single-line fields).
 * - `multiline: true`: preserves newlines; collapses runs of spaces/tabs; max 2 consecutive newlines.
 */
export function sanitizeText(
  input: string,
  maxLength?: number,
  options?: { multiline?: boolean }
): string {
  let s = input.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');

  if (options?.multiline) {
    s = s.trim();
    s = s.replace(/[ \t]+/g, ' ');
    s = s.replace(/\n{3,}/g, '\n\n');
  } else {
    s = s.trim().replace(/\s+/g, ' ');
  }

  if (maxLength !== undefined && s.length > maxLength) {
    s = s.slice(0, maxLength);
  }
  return s;
}

/** Lowercase, trim, keep only [a-z0-9_]. */
export function sanitizeUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * TODO: plug in profanity / moderation API or server-side check.
 * Return true to block client-side (caller should show a generic error).
 */
export function isOffensiveContent(_input: string): boolean {
  return false;
}
