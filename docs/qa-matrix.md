# QA matrix — Tea Timer Card v0.1.0

## Summary
- Release tag: `v0.1.0`
- Minimum Home Assistant version: **2024.5.0** (validated on `core-2024.5.3`).
- Known limitations: no mid-run extend, no pause/resume, manual Lovelace resource reload required after updates.

## Home Assistant coverage
| Home Assistant version | Installation method | Result | Notes |
| --- | --- | --- | --- |
| core-2024.5.3 (Supervisor) | HACS custom repository install | ✅ | Stable loader `tea-timer-card.js` references fingerprinted bundle after browser refresh. |
| core-2024.5.3 (Supervisor) | Manual copy of release assets | ✅ | `checksums.txt` verified locally; Lovelace resource `/local/tea-timer-card.js`. |

## Browser & device coverage
| Browser | Version | OS / Device | Layout | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| Chrome | 124 | Windows 11 (desktop) | Light & dark | ✅ | Dial, presets, finish overlay, and restart flows validated. |
| Microsoft Edge | 124 | Windows 11 (desktop) | Light | ✅ | Keyboard navigation and screen reader announcements exercised. |
| Firefox | 125 | macOS Sonoma (desktop) | Light & dark | ✅ | Reduced-motion preference disables animations. |
| Safari | iOS 17 (iPhone 14) | Mobile | Dark | ✅ | Multi-device sync confirmed via shared timer entity. |
| Chrome | Android 14 (Pixel 7) | Mobile | Light | ✅ | Touch interactions and queued presets verified. |

## Feature scenarios
| Scenario | Result | Notes |
| --- | --- | --- |
| Idle → start via tap | ✅ | Service call uses selected preset duration. |
| Running → restart | ✅ | Restart overlay displayed, countdown resets. |
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
- Monitored memory usage in dev playground during 30-minute run; no growth observed beyond normal GC churn.
- Verified that Lovelace resources load the hashed bundle after cache clear, ensuring cache busting between releases.
