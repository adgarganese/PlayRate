import {
  AUTH_PASSWORD_MIN_LENGTH,
  getRateLimitUserMessage,
  isValidEmailFormat,
  validateSignUpPassword,
  validateUsername,
} from '@/lib/auth-validation';

describe('isValidEmailFormat', () => {
  it('accepts typical valid emails', () => {
    expect(isValidEmailFormat('a@b.co')).toBe(true);
    expect(isValidEmailFormat(' user@example.com ')).toBe(true);
  });

  it('rejects empty and invalid patterns', () => {
    expect(isValidEmailFormat('')).toBe(false);
    expect(isValidEmailFormat('   ')).toBe(false);
    expect(isValidEmailFormat('not-an-email')).toBe(false);
    expect(isValidEmailFormat('@nodomain.com')).toBe(false);
  });

  it('rejects over 254 chars', () => {
    const local = 'a'.repeat(100);
    const domain = 'b'.repeat(200);
    expect(isValidEmailFormat(`${local}@${domain}.com`)).toBe(false);
  });
});

describe('validateSignUpPassword', () => {
  it('returns null for valid passwords', () => {
    expect(validateSignUpPassword('abcd1234')).toBe(null);
    expect(validateSignUpPassword('Pass1word')).toBe(null);
  });

  it('enforces minimum length', () => {
    expect(validateSignUpPassword('a1')).toContain(String(AUTH_PASSWORD_MIN_LENGTH));
    expect(validateSignUpPassword('1234567')).toContain(String(AUTH_PASSWORD_MIN_LENGTH));
  });

  it('requires letter and number', () => {
    expect(validateSignUpPassword('abcdefgh')).toContain('letter');
    expect(validateSignUpPassword('12345678')).toContain('letter');
  });
});

describe('validateUsername', () => {
  it('returns null for valid sanitized usernames', () => {
    expect(validateUsername('valid_user')).toBe(null);
    expect(validateUsername('ABC')).toBe(null);
  });

  it('rejects too short after sanitize', () => {
    expect(validateUsername('ab')).toContain('at least 3');
    expect(validateUsername('a!')).toContain('at least 3');
  });

  it('rejects usernames longer than 20 characters', () => {
    const long = 'a'.repeat(21);
    expect(validateUsername(long)).toContain('underscores');
  });
});

describe('getRateLimitUserMessage', () => {
  const expected = 'Too many attempts. Please wait a few minutes and try again.';

  it('detects common rate limit phrases (case-insensitive)', () => {
    expect(getRateLimitUserMessage('Rate limit exceeded')).toBe(expected);
    expect(getRateLimitUserMessage('Too Many Requests')).toBe(expected);
    expect(getRateLimitUserMessage('You sent too many emails')).toBe(expected);
    expect(getRateLimitUserMessage('over_email_send_rate')).toBe(expected);
    expect(getRateLimitUserMessage('over_sms_send_rate')).toBe(expected);
    expect(getRateLimitUserMessage('Error 429')).toBe(expected);
  });

  it('returns null when not a rate limit message', () => {
    expect(getRateLimitUserMessage('Invalid login credentials')).toBe(null);
    expect(getRateLimitUserMessage('')).toBe(null);
  });
});
