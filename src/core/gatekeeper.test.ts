import { describe, it, expect } from 'vitest';
import { decideOpen, GateContext } from './gatekeeper';

function ctx(over: Partial<GateContext> = {}): GateContext {
  return {
    msSinceUserGesture: 50,
    url: 'https://example.com/page',
    allowlisted: false,
    popupsThisGesture: 0,
    ...over,
  };
}

describe('decideOpen', () => {
  it('allows a fresh user-initiated popup to a normal site', () => {
    const d = decideOpen(ctx());
    expect(d.allow).toBe(true);
    expect(d.reason).toBe('user-initiated');
  });

  it('blocks a popup with no recent user gesture (programmatic / timer)', () => {
    const d = decideOpen(ctx({ msSinceUserGesture: 5000 }));
    expect(d.allow).toBe(false);
    expect(d.reason).toBe('no-user-gesture');
  });

  it('blocks a popup to a known ad domain even within a gesture', () => {
    const d = decideOpen(ctx({ url: 'https://ads.popcash.net/serve' }));
    expect(d.allow).toBe(false);
    expect(d.reason).toBe('ad-domain');
  });

  it('blocks a second popup in the same gesture (popup flood)', () => {
    const d = decideOpen(ctx({ popupsThisGesture: 1 }));
    expect(d.allow).toBe(false);
    expect(d.reason).toBe('popup-flood');
  });

  it('always allows on an allowlisted site', () => {
    expect(decideOpen(ctx({ allowlisted: true, msSinceUserGesture: 9999 })).allow).toBe(true);
    expect(decideOpen(ctx({ allowlisted: true, url: 'https://popcash.net/' })).allow).toBe(true);
  });

  it('allows an about:blank popup within a gesture (legit window.open + write)', () => {
    expect(decideOpen(ctx({ url: 'about:blank' })).allow).toBe(true);
  });
});
