import { describe, it, expect } from 'vitest';
import { isAdDomain, AD_DOMAINS } from './domains';

describe('isAdDomain', () => {
  it('matches a known ad domain exactly', () => {
    expect(isAdDomain('https://popcash.net/x')).toBe(true);
  });
  it('matches a subdomain of a known ad domain', () => {
    expect(isAdDomain('https://ads.popcash.net/serve?id=1')).toBe(true);
    expect(isAdDomain('http://a.b.doubleclick.net/')).toBe(true);
  });
  it('does not match a lookalike that only contains the domain as a substring', () => {
    expect(isAdDomain('https://notpopcash.net.example.com/')).toBe(false);
    expect(isAdDomain('https://popcash.net.evil.com/')).toBe(false);
  });
  it('does not match an ordinary site', () => {
    expect(isAdDomain('https://www.netflix.com/watch/123')).toBe(false);
  });
  it('is case-insensitive on host', () => {
    expect(isAdDomain('https://PopCash.NET/')).toBe(true);
  });
  it('handles junk / empty / relative input without throwing', () => {
    expect(isAdDomain('')).toBe(false);
    expect(isAdDomain(null)).toBe(false);
    expect(isAdDomain(undefined)).toBe(false);
    expect(isAdDomain('about:blank')).toBe(false);
    expect(isAdDomain('not a url')).toBe(false);
  });
  it('respects a custom list', () => {
    expect(isAdDomain('https://foo.test/', ['foo.test'])).toBe(true);
    expect(isAdDomain('https://popcash.net/', ['foo.test'])).toBe(false);
  });
  it('ships a non-empty seed list', () => {
    expect(AD_DOMAINS.length).toBeGreaterThan(10);
  });
});
