/**
 * Click-trap overlay heuristic — the universal Layer 2 logic that runs on every
 * platform including iOS. Kept as a pure function over a "probe" so it can be unit
 * tested without a real DOM. The content script is responsible for measuring an
 * element into an `OverlayProbe` (it only probes elements that are the *topmost*
 * hit-test result, which is itself strong evidence of a click interceptor).
 */

export interface OverlayProbe {
  /** computed `position` value */
  position: string;
  /** computed element opacity, 0..1 */
  opacity: number;
  /** alpha channel of the element's own background-color, 0..1 (1 if opaque/unknown) */
  bgAlpha: number;
  /** fraction of the viewport this element's rect covers, 0..1 */
  coverage: number;
  /** total visible text length of the element AND its descendants (an empty trap sheet ~0) */
  textLength: number;
  /** number of direct element children */
  childCount: number;
  /** computed `pointer-events` value */
  pointerEvents: string;
  /** is this element the topmost hit-test result at the sampled points? */
  isTopmostHit: boolean;
  /** matches cookie / consent / gdpr / privacy banner signals */
  isConsentLike: boolean;
  /** is inside (or is) a <video> / media player container */
  isMediaLike: boolean;
  /** is the current site on the user's allowlist? */
  allowlisted: boolean;
}

export const OVERLAY_DEFAULTS = {
  /** below this opacity OR background alpha, the element is "see-through" */
  transparencyThreshold: 0.15,
  /** must cover at least this fraction of the viewport */
  minCoverage: 0.7,
  /** more text (incl. descendants) than this looks like real content, not a trap sheet */
  maxText: 50,
  /** more children than this looks like a real layout wrapper, not a trap sheet */
  maxChildren: 3,
} as const;

/**
 * Decide whether a probed element is a click-trap overlay that should be neutralized.
 * Conservative by construction: every "no" guard fires before the "yes".
 */
export function isClickTrapOverlay(p: OverlayProbe, cfg = OVERLAY_DEFAULTS): boolean {
  // Never touch a site the user explicitly trusts.
  if (p.allowlisted) return false;
  // If it can't receive clicks, it can't be a trap.
  if (p.pointerEvents === 'none') return false;
  // Traps are taken out of flow and laid over the page.
  if (p.position !== 'fixed' && p.position !== 'absolute' && p.position !== 'sticky') return false;
  // Don't fight legitimate consent banners or media players.
  if (p.isConsentLike || p.isMediaLike) return false;
  // A real modal / wrapper has visible content; a trap sheet is empty. Checking TOTAL
  // text (with descendants) is what lets us spare a whole-page link wrap so Layer 3 can
  // defuse it without nuking the page content.
  if (p.textLength > cfg.maxText) return false;
  if (p.childCount > cfg.maxChildren) return false;
  // It must actually be intercepting clicks (sits on top of everything).
  if (!p.isTopmostHit) return false;
  // It must be see-through (you can see the page through it but clicks don't pass).
  const seeThrough = p.opacity < cfg.transparencyThreshold || p.bgAlpha < cfg.transparencyThreshold;
  if (!seeThrough) return false;
  // It must blanket the viewport.
  if (p.coverage < cfg.minCoverage) return false;
  return true;
}
