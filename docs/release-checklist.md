# Release checklist — Tea Timer Card v0.2.0

This checklist captures the release gates from [Issue #72](https://github.com/sharwell/ha-tea-timer/issues/72) and records how they were satisfied for the pause/resume + extend quality release.

## Quality gates

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run build`
- [x] Accessibility, reduced-motion, and performance spot checks completed in the playground (`npm run dev`).

## Packaging & distribution

- [x] Vite emits a fingerprinted bundle (`tea-timer-card.<hash>.js`) with source maps.
- [x] Stable loader `tea-timer-card.js` re-exports the fingerprinted build for Lovelace resources and HACS.
- [x] SHA-256 checksums captured via `npm run release:checksums`.
- [x] Release workflow (`.github/workflows/release.yml`) attaches artifacts and notes from `docs/releases/v0.2.0.md` when a `v*` tag is pushed.

## Documentation & links

- [x] `CHANGELOG.md` documents highlights and links to the v0.2.0 release.
- [x] Release notes link to [Getting Started](getting-started.md) and [Automate on finish](automations/finished.md).
- [x] README installation section references the v0.2.0 assets and explains the stable loader strategy.
- [x] QA evidence recorded in [docs/qa-matrix.md](qa-matrix.md).

## Compatibility & QA results

- Minimum Home Assistant version: **2024.7.0** (`core-2024.7.3`).
- Browsers/devices covered: Chrome 127 (Windows 11), Edge 127 (Windows 11), Firefox 128 (macOS Sonoma), Safari on iOS 17.5, Chrome on Android 14.
- Manual QA summary: dial interaction, preset queueing, extend button, pause/resume (native + helper fallback), and reduced-motion behavior validated across desktop & mobile layouts.

## Known limitations carried into release

- Pause/resume helper fallback still requires an `input_text` entity when Home Assistant lacks native `timer.pause`.
- Restart confirmation optional and off by default; no mid-run cancel.
- Manual Lovelace resource reload required after updating assets.

## Triage

- [x] No open P0/P1 issues at release time. Known limitations captured above.

## Sign-off

- Release owner: _Tea Timer maintainers_
- Date: 2025-11-15
