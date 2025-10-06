# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Pause/Resume controls for running brews, with accessible announcements, a frozen progress arc, and
  automatic fallback to an `input_text` helper when `timer.pause` is unavailable. Resuming via
  `timer.start` (without a duration) keeps remaining time authoritative across devices.
- Extend-in-place **+1 minute** control for running brews. The card now prefers Home Assistant’s
  `timer.change` service when available, and falls back to a seamless `timer.start` restart when the
  change would exceed the native cap or the service is missing. Configurable increment and optional
  per-brew cap keep automations authoritative while preventing visual reset.

### Documentation
- Document pause/resume flows, helper setup, restore caveats, near-finish races, and update the Lovelace
  examples to include a pause/resume configuration alongside the extend button guidance.

## [0.1.0] - 2025-10-03

### Highlights
- 🎉 First minimum viable deliverable of the Tea Timer Card for Home Assistant, including the circular brew dial, preset chips, and real-time countdown synced to your `timer` entity.
- Multi-device awareness keeps dashboards aligned across browsers, and the five-second finish overlay announces when brewing completes.
- Accessibility polish covers keyboard interaction, screen reader announcements, and reduced-motion fallbacks.

### Packaging
- Ship both a stable `dist/tea-timer-card.js` loader and a fingerprinted bundle for cache busting.
- Publish SHA-256 checksums for every artifact to support manual integrity verification.

### Documentation
- Document installation, upgrade, and automation workflows, including [Getting Started](docs/getting-started.md) and [Automate on finish](docs/automations/finished.md).
- Record QA coverage, minimum Home Assistant version, and release checklist sign-off.

### Links
- Release: [Tea Timer Card v0.1.0](https://github.com/sharwell/ha-tea-timer/releases/tag/v0.1.0)
