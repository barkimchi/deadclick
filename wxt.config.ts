import { defineConfig } from 'wxt';
import { mkdirSync, writeFileSync } from 'node:fs';
import { AD_DOMAINS } from './src/core/domains';

// Keep the DNR ruleset in lockstep with AD_DOMAINS on every build.
function writeDnrRules() {
  const rules = [
    {
      id: 1,
      priority: 1,
      action: { type: 'block' },
      condition: {
        requestDomains: [...AD_DOMAINS],
        resourceTypes: [
          'main_frame',
          'sub_frame',
          'script',
          'xmlhttprequest',
          'image',
          'ping',
          'media',
          'websocket',
          'object',
          'font',
          'other',
        ],
      },
    },
  ];
  mkdirSync('public', { recursive: true });
  writeFileSync('public/dnr-rules.json', JSON.stringify(rules, null, 2) + '\n');
}

// DeadClick is vanilla TS — no UI framework. WXT emits Chrome / Firefox / Safari
// packages from this single config.
export default defineConfig({
  hooks: {
    'build:before': () => writeDnrRules(),
  },
  // MV3 everywhere so the MAIN-world gatekeeper (Layer 1) works on Chrome AND Firefox
  // (Chrome 111+ / Firefox 128+). Safari ignores MAIN-world and relies on Layer 2.
  manifestVersion: 3,
  manifest: {
    name: 'DeadClick',
    description:
      'Neutralizes click-trap ads: the invisible overlays and window.open hijacks that spawn a new tab on every click. Local-only, zero telemetry.',
    // storage = toggle + allowlist; declarativeNetRequest = block requests/navigations to
    // known ad domains (popup & redirect destinations). Content scripts run via `matches`;
    // per-tab badge uses sender.tab.id (no "tabs" perm).
    permissions: ['storage', 'declarativeNetRequest'],
    host_permissions: ['<all_urls>'],
    declarative_net_request: {
      rule_resources: [{ id: 'deadclick-ads', enabled: true, path: 'dnr-rules.json' }],
    },
    action: {
      default_title: 'DeadClick',
      default_popup: 'popup.html',
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png',
    },
    browser_specific_settings: {
      gecko: {
        id: 'deadclick@barkimchi.dev',
        // MAIN-world content scripts need a recent Firefox.
        strict_min_version: '128.0',
      },
    },
  },
});
