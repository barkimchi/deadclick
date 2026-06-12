/**
 * End-to-end verification: load the REAL built Chrome extension and prove that each
 * click-trap pattern is neutralized, while a legitimate modal + user-initiated popup
 * are left untouched (the false-positive guard). Evidence screenshots land in
 * test-harness/evidence/.
 */
import { test as base, expect, chromium, type BrowserContext } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(dir, '../.output/chrome-mv3');
const HARNESS = path.resolve(dir, '../test-harness');
const EVIDENCE = path.resolve(HARNESS, 'evidence');

let server: Server;
let baseURL = '';

base.beforeAll(async () => {
  await mkdir(EVIDENCE, { recursive: true });
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const body = await readFile(path.join(HARNESS, path.basename(url.pathname)));
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end('not found');
    }
  });
  await new Promise<void>((r) => server.listen(0, () => r()));
  const addr = server.address();
  baseURL = `http://localhost:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

base.afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

// Each test gets a fresh browser with the extension loaded.
const test = base.extend<{ context: BrowserContext }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXT}`,
        `--load-extension=${EXT}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
    await use(context);
    await context.close();
  },
});

test('Layer 2: invisible overlay is removed, real button becomes clickable, no popup', async ({
  context,
}) => {
  const page = await context.newPage();
  const popups: unknown[] = [];
  page.on('popup', (p) => popups.push(p));

  await page.goto(`${baseURL}/overlay-popunder.html`);
  await expect(page.locator('#trap')).toHaveCount(0, { timeout: 5000 });

  await page.locator('#real').click();
  await page.waitForTimeout(400);

  await expect(page).toHaveTitle('real-clicked');
  expect(popups).toHaveLength(0);
  await page.screenshot({ path: `${EVIDENCE}/overlay-popunder.png` });
});

test('Layer 1: window.open to an ad domain on a real click is blocked', async ({ context }) => {
  const page = await context.newPage();
  const popups: unknown[] = [];
  page.on('popup', (p) => popups.push(p));

  await page.goto(`${baseURL}/window-open-ad.html`);
  await page.locator('#b').click();
  await page.waitForTimeout(800);

  expect(popups).toHaveLength(0);
  await page.screenshot({ path: `${EVIDENCE}/window-open-ad.png` });
});

test('Layer 1: gesture-less popunder on a timer is blocked', async ({ context }) => {
  const page = await context.newPage();
  const popups: unknown[] = [];
  page.on('popup', (p) => popups.push(p));

  await page.goto(`${baseURL}/window-open-timer.html`);
  await page.waitForTimeout(1000);

  expect(popups).toHaveLength(0);
  await expect(page).not.toHaveTitle('opened');
  await page.screenshot({ path: `${EVIDENCE}/window-open-timer.png` });
});

test('Layer 3: whole-page target=_blank link wrap is defused', async ({ context }) => {
  const page = await context.newPage();
  const popups: unknown[] = [];
  page.on('popup', (p) => popups.push(p));

  await page.goto(`${baseURL}/target-blank-wrap.html`);
  await expect
    .poll(async () => page.locator('#wrap').getAttribute('href'), { timeout: 5000 })
    .toBeNull();

  await page.locator('#wrap').click();
  await page.waitForTimeout(500);
  expect(popups).toHaveLength(0);
  await page.screenshot({ path: `${EVIDENCE}/target-blank-wrap.png` });
});

test('Network: meta-refresh to an ad domain never reaches the ad', async ({ context }) => {
  // An inline <meta refresh> can't be cancelled by element removal once Chromium has
  // scheduled it, so DeadClick blocks the *destination* at the network layer (DNR).
  // The honest guarantee: you do not land on the ad/scam domain.
  const page = await context.newPage();
  await page.goto(`${baseURL}/meta-refresh.html`);
  await page.waitForTimeout(2000); // refresh would have fired at 1s

  expect(page.url()).not.toContain('popcash.net');
  await page.screenshot({ path: `${EVIDENCE}/meta-refresh.png` });
});

test('Control: legit modal is preserved and a user-initiated popup still opens', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto(`${baseURL}/legit-modal.html`);
  await page.waitForTimeout(800); // give the shield time to (not) act

  await expect(page.locator('#backdrop')).toHaveCount(1);
  await expect(page.locator('#modal')).toHaveCount(1);

  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 5000 }),
    page.locator('#oauth').click(),
  ]);
  expect(popup).toBeTruthy();
  await page.screenshot({ path: `${EVIDENCE}/legit-modal.png` });
});
