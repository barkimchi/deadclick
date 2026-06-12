// DeadClick trap diagnostic.
//
//   node scripts/diagnose.mjs <url> [clickRounds]
//
// Loads a site WITHOUT then WITH the built extension, captures how it spawns tabs
// across EVERY frame (window.open calls + their originating frame/origin, native
// new-tab popups, meta-refresh, main-frame redirects), and prints a structured JSON
// report + a best-effort vector classification. This is the repeatable version of a
// manual triage session — feed its output to the `deadclick-triage` skill.
//
// Note: gray-market sites frequency/IP-cap their popunders, so a single run can come
// up empty. Run a few times; absence of a popup is not proof of protection.
import { chromium } from '@playwright/test';
import path from 'node:path';

const target = process.argv[2];
const rounds = Number(process.argv[3] ?? 8);
if (!target) {
  console.error('usage: node scripts/diagnose.mjs <url> [clickRounds]');
  process.exit(1);
}
const EXT = path.resolve('.output/chrome-mv3');

const INIT = () => {
  // runs in EVERY frame at document_start
  window.__dc = { opens: [], clicks: [], metaRefresh: [] };
  const top = window.top === window.self;
  const origin = location.origin;
  const ro = window.open;
  window.open = function (u, ...rest) {
    window.__dc.opens.push({ url: String(u || ''), topFrame: top, frameOrigin: origin });
    return ro.call(window, u, ...rest);
  };
  document.addEventListener(
    'click',
    (e) => {
      const a = e.target.closest && e.target.closest('a');
      window.__dc.clicks.push({
        tag: e.target.tagName,
        anchorHref: a ? a.href : null,
        anchorTarget: a ? a.getAttribute('target') : null,
      });
    },
    true,
  );
  document.querySelectorAll?.('meta[http-equiv="refresh" i]').forEach((m) =>
    window.__dc.metaRefresh.push(m.getAttribute('content')),
  );
};

async function probe(withExt) {
  const args = ['--no-first-run', '--no-default-browser-check'];
  if (withExt) args.push(`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`);
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args,
  });
  const popupDests = [];
  ctx.on('page', async (p) => {
    try {
      await p.waitForLoadState('domcontentloaded', { timeout: 4000 });
    } catch {}
    try {
      popupDests.push(new URL(p.url()).host);
    } catch {
      popupDests.push(p.url().slice(0, 40));
    }
  });
  const page = ctx.pages()[0];
  await page.addInitScript(INIT);
  let startHost = '';
  try {
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
    startHost = new URL(page.url()).host;
  } catch (e) {
    await ctx.close();
    return { error: String(e).split('\n')[0] };
  }
  await page.waitForTimeout(2500);
  const W = 1280,
    H = 800;
  for (let i = 0; i < rounds; i++) {
    const x = 200 + Math.floor((i * 137) % (W - 400));
    const y = 200 + Math.floor((i * 211) % (H - 400));
    try {
      await page.mouse.click(x, y);
    } catch {}
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(1500);

  // gather per-frame logs
  const opens = [];
  const clicks = [];
  const metaRefresh = [];
  for (const f of page.frames()) {
    try {
      const dc = await f.evaluate(() => window.__dc);
      if (dc) {
        opens.push(...dc.opens);
        clicks.push(...dc.clicks);
        metaRefresh.push(...dc.metaRefresh);
      }
    } catch {}
  }
  let finalHost = '';
  try {
    finalHost = new URL(page.url()).host;
  } catch {}
  await ctx.close();
  return {
    popups: popupDests.length,
    popupDests,
    opens,
    clicks: clicks.slice(0, 20),
    metaRefresh,
    startHost,
    finalHost,
    navAway: finalHost !== startHost,
  };
}

function classify(r) {
  const v = [];
  if (!r || r.error) return ['could-not-load'];
  if (r.opens.some((o) => !o.topFrame)) v.push('iframe-window.open (cross-frame popunder)');
  if (r.opens.some((o) => o.topFrame)) v.push('top-frame window.open');
  if (r.popups > 0 && r.opens.length === 0)
    v.push('native target=_blank or synthetic-anchor (no window.open seen)');
  if (r.metaRefresh.length) v.push('meta-refresh redirect');
  if (r.navAway) v.push(`main-frame redirect (${r.startHost} -> ${r.finalHost})`);
  return v.length ? v : ['no trap observed this run (may be frequency-capped — re-run)'];
}

console.log(`\n=== DeadClick diagnostic: ${target} (${rounds} clicks/run) ===`);
const without = await probe(false);
console.log('\n[WITHOUT extension]');
console.log(JSON.stringify(without, null, 2));
console.log('vectors:', classify(without));

const withe = await probe(true);
console.log('\n[WITH extension]');
console.log(JSON.stringify(withe, null, 2));
console.log('vectors:', classify(withe));

console.log('\n=== verdict ===');
if (without.error || withe.error) {
  console.log('site failed to load — try again / check geo.');
} else {
  console.log(`popups  without=${without.popups}  with=${withe.popups}`);
  console.log(`redirect without=${without.navAway}  with=${withe.navAway}`);
}
