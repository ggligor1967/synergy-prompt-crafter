import { describe, it, expect } from 'vitest';
import { sanitize } from '../services/sanitize';

describe('sanitize', () => {
  it('returns plain text unchanged', () => {
    expect(sanitize('Hello world')).toBe('Hello world');
  });

  it('strips a complete HTML tag', () => {
    expect(sanitize('<b>bold</b>')).toBe('bold');
  });

  it('strips script tags (XSS vector)', () => {
    expect(sanitize('<script>alert(1)</script>')).toBe('alert(1)');
  });

  it('strips XML tags used in prompt injection', () => {
    expect(sanitize('<injection>payload</injection>')).toBe('payload');
  });

  it('strips self-closing tags', () => {
    expect(sanitize('text<br/>more')).toBe('textmore');
  });

  it('strips tags with attributes', () => {
    expect(sanitize('<a href="evil.com">click</a>')).toBe('click');
  });

  it('replaces backticks with single quotes', () => {
    expect(sanitize('`code`')).toBe("'code'");
  });

  it('replaces multiple backticks', () => {
    expect(sanitize('`a` and `b`')).toBe("'a' and 'b'");
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(sanitize('')).toBe('');
  });

  it('handles whitespace-only string', () => {
    expect(sanitize('   ')).toBe('');
  });

  it('handles combined threats: tags + backticks + whitespace', () => {
    expect(sanitize('  <b>`bold`</b>  ')).toBe("'bold'");
  });

  it('leaves text with no threats unchanged (after trim)', () => {
    const input = 'The role of music in mathematics';
    expect(sanitize(input)).toBe(input);
  });
});
