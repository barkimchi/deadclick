# DeadClick ⊘

**A cursor that doesn't trip ads.** DeadClick is a cross-platform browser extension that neutralizes *click-traps* — the invisible overlays and `window.open` hijacks on sketchy streaming sites where every click, anywhere on the page, spawns a new tab.

Regular ad blockers (uBlock Origin, AdGuard) block ad *networks*. They don't reliably kill the **click-intercept layer** — the transparent sheet sitting on top of the real UI that turns your first click into a popunder. DeadClick targets exactly that.

- **Local only. Zero telemetry.** No network requests, no tracking, nothing leaves your browser.
- **One codebase → Chrome, Firefox, and Safari/iOS.** Built with [WXT](https://wxt.dev).
- **Open source (GPLv3).** Free forever; nobody can ship a closed paid fork.

---

## How it works

DeadClick stacks four defenses. They share one small, unit-tested heuristics core (`src/core/`).

| # | Layer | What it does | Where it runs |
|---|-------|--------------|---------------|
| 1 | **`window.open` gatekeeper** | Intercepts the browser's "open a new tab" call and refuses it unless *you* genuinely triggered it (a trusted gesture in the last second), it isn't an ad domain, it isn't flooding popups, **and it isn't fired from a third-party ad iframe**. | MAIN world, `document_start` — **Chrome + Firefox** |
| 2 | **Overlay remover** | Finds the invisible, full-viewport, empty, top-most sheet that hijacks clicks and removes it, so your click lands on the real button underneath. | Isolated content script — **all browsers incl. iOS** |
| 3 | **Redirect cleanup** | Defuses whole-page `target="_blank"` link wraps and hardens new-tab links with `rel="noopener"`. | Isolated content script — all browsers |
| 4 | **Network ad-block (DNR)** | Blocks requests *and navigations* to known ad/popunder domains at the network layer — this is what stops a meta-refresh or JS redirect from ever reaching the ad. | `declarativeNetRequest` — Chrome + Firefox |

**On your iPhone**, Safari won't let an extension intercept the new-tab call, so Layer 2 (the overlay remover) carries the load. Same end result for the click-anywhere-spawns-a-tab problem; different mechanism.

### False-positive safety

The overlay heuristic is conservative by construction. It spares: cookie/consent banners, `<video>`/player containers, anything with real text or content, dimmed modal backdrops, and any site you've put on your allowlist. If something still breaks, the popdown's **Trust this site** toggle stands DeadClick down on that host instantly.

---

## The popdown

Click the toolbar icon for a small panel:

- **traps blocked here** — live count for the current tab (also shown on the icon badge).
- **Protection** — master on/off.
- **Trust this site** — per-site allowlist; your escape hatch if a legit site misbehaves.

---

## Install (desktop, unpacked)

No store submission needed to run it yourself.

**Chrome / Edge / Brave**
1. `npm install && npm run build:chrome`
2. Go to `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select `.output/chrome-mv3`.

**Firefox**
1. `npm run build:firefox`
2. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick any file in `.output/firefox-mv3`.

**Safari / iOS** — see [iOS_SETUP.md](./iOS_SETUP.md).

---

## Develop

```bash
npm install          # deps + wxt prepare
npm run dev          # live-reload dev build (Chrome)
npm test             # unit tests (heuristics core, vitest)
npm run compile      # typecheck
npm run e2e          # end-to-end: loads the built extension, drives the trap pages
npm run build:all    # chrome + firefox + safari packages
```

The ad-domain list lives in [`src/core/domains.ts`](./src/core/domains.ts) — the single source of truth. The DNR ruleset (`public/dnr-rules.json`) is regenerated from it on every build.

---

## Tested against

`test-harness/` contains a page per trap pattern plus legit controls. The e2e suite (`e2e/click-trap.spec.ts`) loads the real built extension and asserts each one. Evidence screenshots land in `test-harness/evidence/`.

- invisible overlay popunder → removed, real button clickable
- `window.open` to an ad domain on a click → blocked
- gesture-less timer popunder → blocked
- whole-page `target="_blank"` wrap → defused
- meta-refresh to an ad domain → never reaches the ad (network block)
- **control:** real modal + user-initiated OAuth popup → preserved

---

## Known limits (honest)

- **Click-traps are an arms race.** Heuristics need occasional tuning as sites adapt.
- **Inline meta-refresh can't be cancelled by a content script** once Chromium schedules it. DeadClick blocks the *destination* if it's a known ad domain (Layer 4); a redirect to a non-ad domain is left alone (those are usually legitimate).
- **iOS background instability** — Safari sleeps the extension's background process after ~5 min, which is why iOS relies on the in-page overlay remover rather than the gatekeeper.
- The ad-domain list is a starting seed, not exhaustive.

---

## License

[GPLv3](./LICENSE). Use it, fork it, improve it — just keep it open.
