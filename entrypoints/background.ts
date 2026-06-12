/**
 * Background service worker — keeps a per-tab "traps blocked" tally and paints the
 * toolbar badge. The badge text doubles as the count source the popdown reads back,
 * so there's no request/response messaging to get wrong. No network, no browsing data.
 */
import { browser } from 'wxt/browser';
import { RuntimeMessage } from '../src/messaging';

export default defineBackground(() => {
  const counts = new Map<number, number>();
  const BADGE_COLOR = '#e5482f';

  function paint(tabId: number) {
    const n = counts.get(tabId) ?? 0;
    browser.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
    browser.action.setBadgeText({ tabId, text: n > 0 ? (n > 99 ? '99+' : String(n)) : '' });
  }

  browser.runtime.onMessage.addListener((message, sender) => {
    const msg = message as RuntimeMessage;
    const tabId = sender.tab?.id;
    if (tabId == null) return;

    if (msg?.type === 'dc:reset') {
      counts.set(tabId, 0);
      paint(tabId);
    } else if (msg?.type === 'dc:blocked') {
      counts.set(tabId, (counts.get(tabId) ?? 0) + 1);
      paint(tabId);
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => counts.delete(tabId));
});
