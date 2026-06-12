/**
 * window.open gatekeeper — the desktop Layer 1 decision. Pure so it can be unit
 * tested. The MAIN-world shim measures the live context into a `GateContext` and
 * acts on the verdict.
 */

import { isAdDomain } from './domains';

export interface GateContext {
  /** ms since the last *trusted* user gesture (click / keydown) */
  msSinceUserGesture: number;
  /** the URL window.open was called with (may be '' / 'about:blank') */
  url: string;
  /** is the current site on the user's allowlist? */
  allowlisted: boolean;
  /** how many popups have already been opened during the current gesture */
  popupsThisGesture: number;
  /** is this call coming from a cross-origin (third-party / ad) iframe? */
  crossOriginFrame?: boolean;
  /** ad-domain list override (tests) */
  adDomains?: readonly string[];
}

export interface OpenDecision {
  allow: boolean;
  reason: string;
}

/** Within this window, a window.open is plausibly tied to a real user gesture. */
export const GESTURE_WINDOW_MS = 1000;

export function decideOpen(ctx: GateContext): OpenDecision {
  if (ctx.allowlisted) return { allow: true, reason: 'allowlisted' };
  // Popunders overwhelmingly fire from third-party ad iframes; legitimate popups
  // (OAuth, share dialogs) come from the top frame. Blocking cross-origin-frame opens
  // is high-yield and low-false-positive.
  if (ctx.crossOriginFrame) return { allow: false, reason: 'third-party-frame' };
  if (ctx.msSinceUserGesture > GESTURE_WINDOW_MS) {
    return { allow: false, reason: 'no-user-gesture' };
  }
  if (isAdDomain(ctx.url, ctx.adDomains)) {
    return { allow: false, reason: 'ad-domain' };
  }
  if (ctx.popupsThisGesture >= 1) {
    return { allow: false, reason: 'popup-flood' };
  }
  return { allow: true, reason: 'user-initiated' };
}
