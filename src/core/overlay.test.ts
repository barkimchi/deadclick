import { describe, it, expect } from 'vitest';
import { isClickTrapOverlay, OverlayProbe } from './overlay';

/** A canonical invisible click-trap sheet: fixed, transparent, full-viewport, empty, on top. */
function trap(over: Partial<OverlayProbe> = {}): OverlayProbe {
  return {
    position: 'fixed',
    opacity: 0,
    bgAlpha: 0,
    coverage: 1,
    textLength: 0,
    childCount: 0,
    pointerEvents: 'auto',
    isTopmostHit: true,
    isConsentLike: false,
    isMediaLike: false,
    allowlisted: false,
    ...over,
  };
}

describe('isClickTrapOverlay', () => {
  it('flags a canonical invisible full-viewport trap', () => {
    expect(isClickTrapOverlay(trap())).toBe(true);
  });

  it('flags a near-transparent (opacity 0.05) absolute trap', () => {
    expect(isClickTrapOverlay(trap({ position: 'absolute', opacity: 0.05 }))).toBe(true);
  });

  it('flags an opacity:1 element with a transparent background (classic invisible trap)', () => {
    expect(isClickTrapOverlay(trap({ opacity: 1, bgAlpha: 0 }))).toBe(true);
  });

  // --- false-positive guards ---

  it('spares an allowlisted site', () => {
    expect(isClickTrapOverlay(trap({ allowlisted: true }))).toBe(false);
  });

  it('spares elements that cannot receive clicks', () => {
    expect(isClickTrapOverlay(trap({ pointerEvents: 'none' }))).toBe(false);
  });

  it('spares statically-positioned elements', () => {
    expect(isClickTrapOverlay(trap({ position: 'static' }))).toBe(false);
    expect(isClickTrapOverlay(trap({ position: 'relative' }))).toBe(false);
  });

  it('spares cookie/consent banners', () => {
    expect(isClickTrapOverlay(trap({ isConsentLike: true }))).toBe(false);
  });

  it('spares video / media players', () => {
    expect(isClickTrapOverlay(trap({ isMediaLike: true }))).toBe(false);
  });

  it('spares a real modal with visible text', () => {
    expect(isClickTrapOverlay(trap({ textLength: 240, opacity: 1, bgAlpha: 0.6 }))).toBe(false);
  });

  it('spares a layout wrapper with many children', () => {
    expect(isClickTrapOverlay(trap({ childCount: 12 }))).toBe(false);
  });

  it('spares a transparent whole-page link wrap (has content) — Layer 3 handles it', () => {
    // full-viewport, transparent, but wraps real page content -> not an empty trap sheet
    expect(isClickTrapOverlay(trap({ bgAlpha: 0, textLength: 800, childCount: 1 }))).toBe(false);
  });

  it('spares an element that is not the topmost hit (real content sits above it)', () => {
    expect(isClickTrapOverlay(trap({ isTopmostHit: false }))).toBe(false);
  });

  it('spares a visible dark modal backdrop (alpha 0.5, not see-through enough)', () => {
    expect(isClickTrapOverlay(trap({ opacity: 1, bgAlpha: 0.5 }))).toBe(false);
  });

  it('spares a small transparent corner widget (low coverage)', () => {
    expect(isClickTrapOverlay(trap({ coverage: 0.2 }))).toBe(false);
  });
});
