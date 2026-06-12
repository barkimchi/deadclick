/**
 * Layer 1 — the window.open gatekeeper. Runs in the page's MAIN world at
 * document_start so it shims `window.open` before page scripts can call it.
 * (Desktop power-up: Chrome 111+ / Firefox 128+. Safari/iOS ignore MAIN-world
 * declarations, which is fine — the isolated shield covers those.)
 *
 * MAIN world has NO access to chrome.* APIs, so it talks to the isolated shield
 * over window.postMessage (tagged + direction-stamped).
 */
import { decideOpen } from '../src/core/gatekeeper';
import { BRIDGE_TAG, IsolatedToShim, ShimToIsolated } from '../src/messaging';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  world: 'MAIN',
  allFrames: true,
  main() {
    let enabled = true;
    let allowlisted = false;
    let lastGesture = Number.NEGATIVE_INFINITY;
    let popupsThisGesture = 0;

    // Only TRUSTED events count as a user gesture — synthetic .click() / dispatchEvent
    // do not, which is exactly how we starve popunders that fake interaction.
    const markGesture = (e: Event) => {
      if (!e.isTrusted) return;
      lastGesture = Date.now();
      popupsThisGesture = 0;
    };
    addEventListener('click', markGesture, true);
    addEventListener('auxclick', markGesture, true);
    addEventListener('keydown', markGesture, true);

    // Config pushed from the isolated shield (it can read chrome.storage; we can't).
    addEventListener('message', (e: MessageEvent) => {
      const d = e.data as IsolatedToShim | undefined;
      if (!d || d.tag !== BRIDGE_TAG || d.dir !== 'iso->shim' || d.kind !== 'config') return;
      enabled = d.enabled;
      allowlisted = d.allowlisted;
    });

    const realOpen = window.open.bind(window);

    const notifyBlocked = (reason: string, url: string) => {
      const msg: ShimToIsolated = {
        tag: BRIDGE_TAG,
        dir: 'shim->iso',
        kind: 'blocked',
        layer: 'popup',
        reason,
        url,
      };
      window.postMessage(msg, '*');
    };

    const shimmed = function (
      url?: string | URL,
      target?: string,
      features?: string,
    ): Window | null {
      const u = url == null ? '' : String(url);
      if (!enabled || allowlisted) {
        return realOpen(url as string, target as string, features as string);
      }
      const decision = decideOpen({
        msSinceUserGesture: Date.now() - lastGesture,
        url: u,
        allowlisted,
        popupsThisGesture,
      });
      if (decision.allow) {
        popupsThisGesture++;
        return realOpen(url as string, target as string, features as string);
      }
      notifyBlocked(decision.reason, u);
      return null;
    } as typeof window.open;

    window.open = shimmed;
  },
});
