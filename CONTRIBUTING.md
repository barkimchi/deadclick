# Contributing to DeadClick

Thanks for helping kill click-traps.

## Setup

```bash
npm install
npm run dev      # Chrome, live reload
```

## Project shape

- `src/core/` — pure, framework-free heuristics (overlay detection, the `window.open` gatekeeper, ad-domain + allowlist matching). **All logic with branches lives here and is unit-tested.**
- `entrypoints/gate.content.ts` — Layer 1, MAIN-world `window.open` shim.
- `entrypoints/shield.content.ts` — Layers 2 & 3 + meta-refresh strip, isolated world.
- `entrypoints/background.ts` — per-tab badge.
- `entrypoints/popup/` — the popdown UI.
- `public/dnr-rules.json` — generated from `src/core/domains.ts`; do not hand-edit.

## Rules of the road

- **New blocking logic goes in `src/core/` with a test first.** Keep the content scripts as thin DOM/runtime adapters over pure functions.
- **Bias hard against false positives.** A blocked legit site is worse than a missed trap. New heuristics need a sparing test in `overlay.test.ts` proving they don't nuke real modals/players/content.
- **Adding ad domains:** edit `AD_DOMAINS` in `src/core/domains.ts`. The DNR ruleset regenerates on build.
- **No network calls, ever.** DeadClick is local-only by design.

## Before a PR

```bash
npm run compile && npm test && npm run build:chrome && npm run e2e
```

All four must pass. e2e launches a headed Chromium with the built extension and drives `test-harness/`.

## License

By contributing you agree your work is licensed under GPLv3.
