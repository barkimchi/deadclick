// Generates the declarativeNetRequest ruleset from the single source of truth
// (src/core/domains.ts). One rule blocks ALL requests — including main_frame navigations
// and popup/redirect destinations — to known ad/popunder domains, at the network layer.
// Re-run after editing AD_DOMAINS:  node scripts/gen-dnr.mjs
import { AD_DOMAINS } from '../src/core/domains.ts';
import { mkdirSync, writeFileSync } from 'node:fs';

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
console.log(`wrote public/dnr-rules.json (${AD_DOMAINS.length} ad domains, 1 rule)`);
