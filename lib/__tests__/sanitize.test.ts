import { isOffensiveContent, sanitizeText, sanitizeUsername } from '../sanitize';

describe('sanitizeText', () => {
  it('trims and collapses internal whitespace (single-line)', () => {
    expect(sanitizeText('  hello   world  ')).toBe('hello world');
    expect(sanitizeText('a\t\tb\nc')).toBe('a b c');
  });

  it('strips BOM', () => {
    expect(sanitizeText('\uFEFFhello')).toBe('hello');
  });

  it('normalizes CRLF before multiline handling', () => {
    expect(sanitizeText('line1\r\nline2', undefined, { multiline: true })).toBe('line1\nline2');
  });

  it('multiline: trims outer, collapses horizontal runs, caps blank lines', () => {
    expect(sanitizeText('  a  b  \n  c  ', undefined, { multiline: true })).toBe('a b \n c');
    expect(sanitizeText('a\n\n\n\nb', undefined, { multiline: true })).toBe('a\n\nb');
  });

  it('enforces maxLength after normalization', () => {
    expect(sanitizeText('1234567890', 5)).toBe('12345');
    expect(sanitizeText('  hello  ', 4)).toBe('hell');
  });

  it('handles empty and whitespace-only', () => {
    expect(sanitizeText('')).toBe('');
    expect(sanitizeText('   \t\n  ')).toBe('');
  });

  it('malicious / odd inputs are length-bounded, not interpreted as markup', () => {
    const xss = '<script>alert(1)</script>';
    expect(sanitizeText(`  ${xss}  `, 50)).toBe(xss.trim());
    const sql = "'; DROP TABLE users; --";
    expect(sanitizeText(sql, 100)).toBe(sql.replace(/\s+/g, ' ').trim());
  });
});

describe('sanitizeUsername', () => {
  it('trims, lowercases, keeps alnum and underscore', () => {
    expect(sanitizeUsername('  Hello_World  ')).toBe('hello_world');
    expect(sanitizeUsername('User-Name!')).toBe('username');
  });

  it('strips unicode and symbols', () => {
    expect(sanitizeUsername('tëst_ušer')).toBe('tst_uer');
    expect(sanitizeUsername('a@b#c$')).toBe('abc');
  });

  it('edge cases', () => {
    expect(sanitizeUsername('')).toBe('');
    expect(sanitizeUsername('   ')).toBe('');
    expect(sanitizeUsername('___')).toBe('___');
  });
});

describe('isOffensiveContent', () => {
  it('placeholder returns false', () => {
    expect(isOffensiveContent('anything')).toBe(false);
    expect(isOffensiveContent('')).toBe(false);
  });
});
