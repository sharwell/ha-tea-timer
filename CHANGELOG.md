# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

- _Nothing yet._

## [0.3.0] - 2026-02-20

### Highlights
- UX audit follow-up release focused on touch ergonomics, layout stability, and predictable control behavior across idle, running, paused, reconnecting, and error states.
- Core interaction shell now remains spatially stable across common state transitions, with denser information placement and larger in-face dial readability.
- Added a finished-state fallback for environments that occasionally miss or skip visible `Done` time before returning to idle.

### Added
- New `cardBodyTapStart` configuration option (default `true`) to control whether tapping non-control card body regions starts the timer while idle.
- UX audit evidence pack (`docs/ux-audit.md` plus scenario artifacts) documenting observed flows, tradeoffs, and prioritized improvements.

### Changed
- Active timer layout now uses a dial-plus-action-rail structure with stable control slots and touch-safe target sizes.
- Normal timer modes no longer duplicate state labels in multiple places; reclaimed space is applied to a larger dial.
- Queued preset and custom-duration context now appears in the primary action secondary line instead of separate subtitle/custom rows.
- State and entity alerts render as overlays to reduce layout reflow and improve consistency during transient errors.
- Card-body tap behavior is scoped to idle only; running and paused restart paths require explicit action controls.

### Fixed
- Preserve circular dial geometry at narrow card widths.
- Suppress duplicate failure messaging when inline banner feedback is active.
- Restore left-aligned primary action secondary text for improved scanability.
- Mark finished overlay when running transitions to idle near zero without a finish event.

### Documentation
- Added touchscreen UX audit scenarios, findings, and acceptance criteria.
- Updated release documentation, QA matrix, and release checklist for v0.3.0.

### Links
- Release: [Tea Timer Card v0.3.0](https://github.com/sharwell/ha-tea-timer/releases/tag/v0.3.0)

## [0.2.0] - 2025-10-14

### Highlights
- Pause/resume controls, extend-in-place adjustments, and a runtime debug overlay make it easier to keep brews on track and
  diagnose timing issues.
- Native Lovelace Visual Editor support simplifies configuration while keeping YAML parity for advanced options.

### Added
- Runtime-toggle debug overlay & structured logs for diagnosing baseline seeds and drift corrections. (#53)
- Pause/Resume controls for running brews, with accessible announcements, a frozen progress arc, and
  automatic fallback to an `input_text` helper when `timer.pause` is unavailable. Resuming via
  `timer.start` (without a duration) keeps remaining time authoritative across devices.
- Extend-in-place **+1 minute** control for running brews. The card now prefers Home Assistant’s
  `timer.change` service when available, and falls back to a seamless `timer.start` restart when the
  change would exceed the native cap or the service is missing. Configurable increment and optional
  per-brew cap keep automations authoritative while preventing visual reset.
- Native Lovelace Visual Editor support, including card picker registration and a presets-aware form
  for configuring timers without editing YAML. (#43)

### Changed
- Hide the dial handle while the timer is running or paused to reinforce the locked state. (#34)
- Clean up preliminary UI; docs via Editor Help (#44)
- Consolidate timer-entity errors into a single alert surface with clear precedence over secondary hints. (#38)
- Render the running countdown through a monotonic engine driven by `requestAnimationFrame`, holding the visible second on
  small corrections and allowing increases only for material state changes or large (+≥1.5 s) server updates to eliminate
  back-ticks. (#56)
- Quantize the monotonic countdown to integer seconds with a small hysteresis window so visual ticks stay smooth while small
  (<1.5 s) upward corrections are absorbed without momentary increases. (#57)
- Harden the clock-skew estimator with a lower-envelope offset tracker, bounded local-clock fallback, and clarified configuration semantics. (#58)

### Fixed
- Prevent idle dial drags from triggering `timer.start`; releasing a drag now leaves the timer idle
  until an explicit tap/click/keyboard activation starts the brew. (#32)
- Keep the preset chip row height stable while the **Custom duration** badge toggles during dial or
  keyboard adjustments. (#37)
- Ensure the first running render after start/restart matches the requested duration (±0.25 s) and
  suppress outlier starts while logging a single warning. (#55)

### Documentation
- Document pause/resume flows, helper setup, restore caveats, near-finish races, and update the Lovelace
  examples to include a pause/resume configuration alongside the extend button guidance.
- Add a Visual Editor quick-start guide outlining the picker flow and available form fields.

### Links
- Release: [Tea Timer Card v0.2.0](https://github.com/sharwell/ha-tea-timer/releases/tag/v0.2.0)

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
