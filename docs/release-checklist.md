# Release checklist — Tea Timer Card v0.3.0

This checklist records release gates for the UX stabilization release prepared from the `ux-audit` branch.

## Quality gates

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`
- [x] `npm run docs:check`

## Packaging & distribution

- [x] Vite emits a fingerprinted bundle (`tea-timer-card.<hash>.js`) with source maps.
- [x] Stable loader `tea-timer-card.js` re-exports the fingerprinted build for Lovelace resources and HACS.
- [x] Release verification script (`npm run release:verify`) passes against generated build artifacts.
- [x] SHA-256 checksums can be produced via `npm run release:checksums`.
- [x] Release workflow (`.github/workflows/release.yml`) publishes artifacts and uses `docs/releases/v0.3.0.md` as release notes when tag `v0.3.0` is pushed.

## Documentation & links

- [x] `CHANGELOG.md` includes v0.3.0 highlights and release link.
- [x] `README.md` points installation guidance to v0.3.0 assets and current behavior semantics.
- [x] Release notes are documented in [`docs/releases/v0.3.0.md`](releases/v0.3.0.md).
- [x] QA evidence is captured in [`docs/qa-matrix.md`](qa-matrix.md) and [`docs/ux-audit.md`](ux-audit.md).

## Compatibility & QA results

- Minimum Home Assistant version: **2024.7.0**.
- Browser/device coverage retained from v0.2.0 matrix plus UX-audit validation artifacts.
- Additional manual spot-check: older Android tablet in Fully Kiosk Browser confirmed finished-state fallback behavior.

## Known limitations carried into release

- Pause/resume helper fallback still requires `input_text.<entity>_paused_remaining` on Home Assistant versions without native `timer.pause`.
- Manual Lovelace resource reload may still be required after updating assets.
- Dashboard-level viewport behavior can vary in kiosk shells that override browser scaling defaults.

## Triage

- [x] No open P0 defects blocking v0.3.0 release preparation in this branch.

## Sign-off

- Release owner: _Tea Timer maintainers_
- Date: 2026-02-20
