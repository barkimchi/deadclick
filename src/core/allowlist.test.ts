import { describe, it, expect } from 'vitest';
import { normalizeHost, isAllowlisted, toggleAllowlist } from './allowlist';

describe('normalizeHost', () => {
  it('extracts host from a full URL and strips www', () => {
    expect(normalizeHost('https://www.Example.com/path?x=1')).toBe('example.com');
  });
  it('accepts a bare host', () => {
    expect(normalizeHost('Example.COM')).toBe('example.com');
  });
  it('returns empty for junk/empty', () => {
    expect(normalizeHost('')).toBe('');
    expect(normalizeHost(null)).toBe('');
  });
});

describe('isAllowlisted', () => {
  const list = ['example.com', 'sub.foo.test'];
  it('matches an exact host', () => {
    expect(isAllowlisted('https://example.com/', list)).toBe(true);
  });
  it('matches a subdomain of an allowlisted host', () => {
    expect(isAllowlisted('https://app.example.com/', list)).toBe(true);
  });
  it('ignores www', () => {
    expect(isAllowlisted('https://www.example.com/', list)).toBe(true);
  });
  it('does not match an unrelated host', () => {
    expect(isAllowlisted('https://other.com/', list)).toBe(false);
  });
});

describe('toggleAllowlist', () => {
  it('adds a host when absent', () => {
    expect(toggleAllowlist('https://www.new.com/', ['example.com'])).toEqual(['example.com', 'new.com']);
  });
  it('removes a host when present', () => {
    expect(toggleAllowlist('https://example.com/', ['example.com', 'new.com'])).toEqual(['new.com']);
  });
  it('does not duplicate', () => {
    const once = toggleAllowlist('a.com', []);
    const twice = toggleAllowlist('a.com', toggleAllowlist('a.com', once));
    expect(twice).toEqual(['a.com']);
  });
});
