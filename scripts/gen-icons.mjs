// Renders the DeadClick mark to PNG icons at every required size using Playwright's
// bundled Chromium. The mark: an orange "blocked" ring + slash on the near-black panel.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const sizes = [16, 32, 48, 96, 128];

const svg = (s) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="${s}" height="${s}">
  <rect width="128" height="128" rx="26" fill="#0e0d0c"/>
  <circle cx="64" cy="64" r="33" fill="none" stroke="#e5482f" stroke-width="12"/>
  <line x1="40.5" y1="40.5" x2="87.5" y2="87.5" stroke="#e5482f" stroke-width="12" stroke-linecap="round"/>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 256, height: 256 }, deviceScaleFactor: 1 });
mkdirSync('public/icon', { recursive: true });

for (const s of sizes) {
  await page.setContent(`<body style="margin:0;padding:0">${svg(s)}</body>`);
  const el = await page.$('svg');
  const buf = await el.screenshot({ omitBackground: true });
  writeFileSync(`public/icon/${s}.png`, buf);
  console.log(`wrote public/icon/${s}.png`);
}

await browser.close();
