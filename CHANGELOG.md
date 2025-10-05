# Changelog

All notable changes to this project will be documented in this file.

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
