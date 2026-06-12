/**
 * Layer 2 + Layer 3 — the isolated-world shield. Runs everywhere (Chrome, Firefox,
 * Safari, iOS). It:
 *   - reads config (enabled + allowlist) from browser.storage and pushes it to the
 *     MAIN-world gatekeeper,
 *   - detects & neutralizes invisible click-trap overlays (Layer 2),
 *   - strips redirect traps: meta-refresh + whole-page target=_blank link wraps (Layer 3),
 *   - relays every block to the background worker for the per-tab badge.
 */
import { browser } from 'wxt/browser';
import { isClickTrapOverlay, OverlayProbe } from '../src/core/overlay';
import { isAllowlisted } from '../src/core/allowlist';
import {
  BRIDGE_TAG,
  IsolatedToShim,
  ShimToIsolated,
  BlockLayer,
  KEY_ENABLED,
  KEY_ALLOWLIST,
} from '../src/messaging';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    let enabled = true;
    let allowlisted = false;

    const active = () => enabled && !allowlisted;
    const safeSend = (m: unknown) => {
      try {
        browser.runtime.sendMessage(m);
      } catch {
        /* worker asleep / context gone — fine */
      }
    };
    const report = (layer: BlockLayer, reason: string) =>
      safeSend({ type: 'dc:blocked', layer, reason });

    const pushConfig = () => {
      const msg: IsolatedToShim = {
        tag: BRIDGE_TAG,
        dir: 'iso->shim',
        kind: 'config',
        enabled,
        allowlisted,
      };
      window.postMessage(msg, '*');
    };

    // Fresh count for this page load.
    safeSend({ type: 'dc:reset' });

    // Relay popup blocks reported by the MAIN-world gatekeeper.
    window.addEventListener('message', (e: MessageEvent) => {
      const d = e.data as ShimToIsolated | undefined;
      if (!d || d.tag !== BRIDGE_TAG || d.dir !== 'shim->iso' || d.kind !== 'blocked') return;
      report('popup', d.reason);
    });

    // ---- meta-refresh defuse (Layer 3, time-critical) -------------------------------
    // Runs immediately at document_start, BEFORE the async storage read, because an inline
    // <meta refresh> can fire on a short timer and cold-start storage latency would miss it.
    // Stripping an external auto-redirect is safe even on a trusted site, so this single
    // layer is intentionally ungated.
    function stripMetaRefresh(root: ParentNode) {
      root.querySelectorAll?.('meta[http-equiv="refresh" i]').forEach((m) => {
        const c = m.getAttribute('content') ?? '';
        if (/url=|https?:|\/\//i.test(c)) {
          m.remove();
          report('redirect', 'meta-refresh');
        }
      });
    }
    stripMetaRefresh(document);
    new MutationObserver(() => stripMetaRefresh(document)).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    // ---- overlay detection (Layer 2) -------------------------------------------------

    const NEVER_REMOVE = new Set(['HTML', 'BODY', 'VIDEO', 'IFRAME']);

    function bgAlpha(color: string): number {
      // rgba(…, a) -> a ; rgb(…) -> 1 ; transparent -> 0
      if (!color || color === 'transparent') return 0;
      const m = color.match(/rgba?\(([^)]+)\)/);
      if (!m) return 1;
      const parts = (m[1] ?? '').split(',').map((s) => s.trim());
      return parts.length >= 4 ? parseFloat(parts[3] ?? '1') : 1;
    }

    function isConsentLike(el: Element): boolean {
      const hay = `${el.id} ${el.className} ${el.getAttribute('aria-label') ?? ''}`.toLowerCase();
      return /cookie|consent|gdpr|privacy|ccpa|cmp/.test(hay);
    }

    function isMediaLike(el: Element): boolean {
      if (NEVER_REMOVE.has(el.tagName)) return el.tagName === 'VIDEO';
      const hay = `${el.id} ${el.className}`.toLowerCase();
      return /player|video|jwplayer|plyr|vjs|shaka/.test(hay) || !!el.closest('video');
    }

    function probe(el: Element): OverlayProbe {
      const cs = getComputedStyle(el as HTMLElement);
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth || 1;
      const vh = window.innerHeight || 1;
      return {
        position: cs.position,
        opacity: parseFloat(cs.opacity || '1'),
        bgAlpha: bgAlpha(cs.backgroundColor),
        coverage: Math.min(1, (rect.width * rect.height) / (vw * vh)),
        textLength: (el.textContent ?? '').trim().length,
        childCount: el.childElementCount,
        pointerEvents: cs.pointerEvents,
        isTopmostHit: true, // caller passes only elements that ARE the topmost hit
        isConsentLike: isConsentLike(el),
        isMediaLike: isMediaLike(el),
        allowlisted,
      };
    }

    function neutralize(el: Element, reason: string) {
      if (NEVER_REMOVE.has(el.tagName)) {
        (el as HTMLElement).style.pointerEvents = 'none';
      } else {
        el.remove();
      }
      report('overlay', reason);
    }

    // Sample the points a user is most likely to click. elementFromPoint returns the
    // TOPMOST element there, so anything it hands back is genuinely intercepting clicks.
    function scan() {
      if (!active() || !document.body) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pts: Array<[number, number]> = [
        [vw / 2, vh / 2],
        [vw * 0.25, vh * 0.3],
        [vw * 0.75, vh * 0.7],
        [vw * 0.5, vh * 0.15],
        [vw * 0.5, vh * 0.85],
      ];
      const seen = new Set<Element>();
      for (const [x, y] of pts) {
        const el = document.elementFromPoint(x, y);
        if (!el || seen.has(el)) continue;
        seen.add(el);
        if (isClickTrapOverlay(probe(el))) neutralize(el, 'overlay-scan');
      }
    }

    // Safety net: if a trap sheet is clicked before a scan catches it, swallow the
    // click and remove it in the same tick.
    function onClickCapture(e: MouseEvent) {
      if (!active()) return;
      const el = e.target as Element | null;
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
      if (isClickTrapOverlay(probe(el))) {
        e.preventDefault();
        e.stopImmediatePropagation();
        neutralize(el, 'click-trap');
      }
    }

    // ---- redirect traps (Layer 3) ----------------------------------------------------

    function cleanupRedirects() {
      if (!active()) return;
      // (meta-refresh is handled immediately above, ungated.)
      // harden all new-tab links, and defuse whole-page link wraps
      const vw = window.innerWidth || 1;
      const vh = window.innerHeight || 1;
      document.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]').forEach((a) => {
        a.rel = a.rel ? `${a.rel} noopener noreferrer` : 'noopener noreferrer';
        const rect = a.getBoundingClientRect();
        if ((rect.width * rect.height) / (vw * vh) > 0.7 && a.childElementCount > 0) {
          a.removeAttribute('href');
          a.removeAttribute('target');
          report('redirect', 'page-wrap-link');
        }
      });
    }

    // ---- lifecycle -------------------------------------------------------------------

    function start() {
      const run = () => {
        scan();
        cleanupRedirects();
      };
      window.addEventListener('click', onClickCapture, true);

      const observe = () => {
        run();
        const mo = new MutationObserver(() => run());
        mo.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class'],
        });
      };

      if (document.body) observe();
      else document.addEventListener('DOMContentLoaded', observe, { once: true });
      // catch late-injected overlays after full load too
      window.addEventListener('load', run);
    }

    // Load config, push to gatekeeper, then arm.
    browser.storage.local
      .get([KEY_ENABLED, KEY_ALLOWLIST])
      .then((s: Record<string, unknown>) => {
        enabled = s[KEY_ENABLED] !== false; // default ON
        const list = (s[KEY_ALLOWLIST] as string[]) ?? [];
        allowlisted = isAllowlisted(location.href, list);
        pushConfig();
        start();
      })
      .catch(() => {
        pushConfig();
        start();
      });

    // React to popdown toggles live.
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (KEY_ENABLED in changes) enabled = changes[KEY_ENABLED].newValue !== false;
      if (KEY_ALLOWLIST in changes) {
        allowlisted = isAllowlisted(location.href, (changes[KEY_ALLOWLIST].newValue as string[]) ?? []);
      }
      pushConfig();
      if (active()) {
        scan();
        cleanupRedirects();
      }
    });
  },
});
