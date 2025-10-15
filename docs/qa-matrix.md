# QA matrix — Tea Timer Card v0.2.0

## Summary

- Release tag: `v0.2.0`
- Minimum Home Assistant version: **2024.7.0** (validated on `core-2024.7.3`).
- Known limitations: Lovelace resource cache must be refreshed after updating assets; pause/resume helper fallback still
  requires the optional `input_text` entity on Home Assistant versions without native `timer.pause`.

## Home Assistant coverage

| Home Assistant version | Installation method | Result | Notes |
| --- | --- | --- | --- |
| core-2024.7.3 (Supervisor) | HACS custom repository install | ✅ | Stable loader `tea-timer-card.js` references fingerprinted bundle after browser refresh. |
| core-2024.7.3 (Supervisor) | Manual copy of release assets | ✅ | `checksums.txt` verified locally; Lovelace resource `/local/tea-timer-card.js`. |

## Browser & device coverage

| Browser | Version | OS / Device | Layout | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| Chrome | 127 | Windows 11 (desktop) | Light & dark | ✅ | Dial, presets, pause/resume, and extend flows validated. |
| Microsoft Edge | 127 | Windows 11 (desktop) | Light | ✅ | Keyboard navigation, screen reader announcements, and extend button tested. |
| Firefox | 128 | macOS Sonoma (desktop) | Light & dark | ✅ | Reduced-motion preference disables animations and preserves pause overlay. |
| Safari | iOS 17.5 (iPhone 14) | Mobile | Dark | ✅ | Multi-device sync confirmed; touch hold for pause/resume stable. |
| Chrome | Android 14 (Pixel 7) | Mobile | Light | ✅ | Touch interactions, queued presets, and extend button verified. |

## Network conditions

| Network profile | Result | Notes |
| --- | --- | --- |
| Normal LAN (<20 ms) | ✅ | Baseline for Home Assistant dashboard usage. |
| High latency (200 ms, 2% packet loss) | ✅ | Countdown remains monotonic; pause overlay recovers after jitter. |
| Intermittent (lossy Wi-Fi, brief disconnects) | ✅ | “Disconnected” banner surfaces and clears once WebSocket recovers. |

## Feature scenarios

| Scenario | Result | Notes |
| --- | --- | --- |
| Idle → start via tap | ✅ | Service call uses selected preset duration. |
| Running → restart | ✅ | Restart overlay displayed, countdown resets. |
| Pause → resume | ✅ | Native `timer.pause` path verified; helper fallback exercised on 2024.7.0. |
| Extend while running | ✅ | `timer.change` increments remaining time without resetting countdown. |
| Finish overlay | ✅ | Five-second “Done” banner auto-dismissed. |
| Preset queue while running | ✅ | “Next:” subtitle and queued restart honored. |
| Entity unavailable handling | ✅ | Error banner & retry messaging displayed. |
| Reduced-motion | ✅ | Dial animation disabled when `prefers-reduced-motion: reduce`. |
| Accessibility announcements | ✅ | Live region updates throttled per spec. |

## Automated checks

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

## Manual QA notes

- Monitored memory usage in dev playground during 45-minute run mixing extend/pause/resume; no growth observed beyond normal
  GC churn.
- Verified that Lovelace resources load the hashed bundle after cache clear, ensuring cache busting between releases.
- Confirmed pause/resume helper fallback by temporarily removing native `timer.pause` support.
