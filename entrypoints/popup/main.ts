/**
 * Popdown UI logic. Reads the per-tab block count from the toolbar badge text and the
 * on/off + allowlist state from storage; writes toggles straight back to storage (the
 * content shield listens for storage changes and re-applies live).
 */
import { browser } from 'wxt/browser';
import { normalizeHost, isAllowlisted, toggleAllowlist } from '../../src/core/allowlist';
import { KEY_ENABLED, KEY_ALLOWLIST } from '../../src/messaging';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const els = {
  count: $('count'),
  enabled: $<HTMLInputElement>('enabled'),
  allow: $<HTMLInputElement>('allow'),
  enabledSub: $('enabled-sub'),
  hostSub: $('host-sub'),
  dot: $('state-dot'),
  version: $('version'),
};

async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function render(count: number, enabled: boolean, allowlisted: boolean, host: string) {
  els.count.textContent = count > 99 ? '99+' : String(count);
  els.count.classList.toggle('has', count > 0);

  els.enabled.checked = enabled;
  els.enabledSub.textContent = enabled ? 'On for every site' : 'Paused everywhere';

  els.allow.checked = allowlisted;
  els.hostSub.textContent = host ? (allowlisted ? `${host} is trusted` : host) : 'this page';

  const standingDown = !enabled || allowlisted;
  els.dot.classList.toggle('off', standingDown);
  els.dot.title = standingDown ? 'standing down' : 'active';
}

async function load() {
  const tab = await activeTab();
  const host = normalizeHost(tab?.url ?? '');
  const store = await browser.storage.local.get([KEY_ENABLED, KEY_ALLOWLIST]);
  const enabled = store[KEY_ENABLED] !== false;
  const allowlist: string[] = (store[KEY_ALLOWLIST] as string[]) ?? [];
  const allowlisted = host ? isAllowlisted(host, allowlist) : false;

  let count = 0;
  if (tab?.id != null) {
    try {
      const txt = await browser.action.getBadgeText({ tabId: tab.id });
      count = parseInt(txt, 10) || 0;
    } catch {
      /* no badge yet */
    }
  }

  render(count, enabled, allowlisted, host);

  els.enabled.onchange = async () => {
    await browser.storage.local.set({ [KEY_ENABLED]: els.enabled.checked });
    load();
  };

  els.allow.onchange = async () => {
    if (!host) return;
    const cur: string[] =
      ((await browser.storage.local.get(KEY_ALLOWLIST))[KEY_ALLOWLIST] as string[]) ?? [];
    await browser.storage.local.set({ [KEY_ALLOWLIST]: toggleAllowlist(host, cur) });
    load();
  };

  els.version.textContent = `v${browser.runtime.getManifest().version}`;
}

load();
