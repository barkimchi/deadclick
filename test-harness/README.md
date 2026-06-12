# Test harness

Static pages that reproduce each click-trap pattern, plus legit controls. Used by the
e2e suite (`../e2e/click-trap.spec.ts`), which serves this folder over HTTP, loads the
real built extension, and asserts each outcome.

| Page | Pattern | Expected with DeadClick |
|------|---------|-------------------------|
| `overlay-popunder.html` | invisible full-viewport sheet that `window.open`s on click | sheet removed; real button clickable; no popup |
| `window-open-ad.html` | trusted click → `window.open` to an ad domain | popup blocked |
| `window-open-timer.html` | timer `window.open`, no user gesture | popup blocked |
| `target-blank-wrap.html` | whole page wrapped in `target="_blank"` ad link | href/target stripped; no popup |
| `meta-refresh.html` | `<meta refresh>` to an ad domain | never reaches the ad (network block) |
| `legit-modal.html` | **control:** real modal + user-initiated OAuth popup | modal preserved; popup allowed |

Run: `npm run e2e`. Screenshots are written to `evidence/`.

You can also open any page manually after loading the unpacked extension to eyeball behavior.
