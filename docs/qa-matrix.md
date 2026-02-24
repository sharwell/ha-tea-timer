# QA matrix — Tea Timer Card v0.4.0

## Summary

- Release tag: `v0.4.0`
- Minimum Home Assistant version: **2024.7.0**
- Focus areas in this cycle:
  - in-dial countdown readability at distance
  - responsive text behavior when dial geometry shrinks
  - finished-overlay reliability on older Android WebView
  - finished-state handle visibility consistency

## Home Assistant coverage

| Home Assistant version | Installation method | Result | Notes |
| --- | --- | --- | --- |
| core-2024.7.x | HACS custom repository install | ✅ | Stable loader `tea-timer-card.js` references fingerprinted bundle after browser refresh. |
| core-2024.7.x | Manual copy of release assets | ✅ | Release workflow packages loader, fingerprinted bundle, source map, and checksums. |

## Browser & device coverage

| Browser | OS / Device | Layout | Result | Notes |
| --- | --- | --- | --- | --- |
| Chrome | Windows 11 desktop | Light | ✅ | Done overlay persists for configured duration; dial text readability improved. |
| Microsoft Edge | Windows 11 desktop | Light | ✅ | Finished state and handle visibility verified. |
| Chrome | Android 14 phone | Mobile | ✅ | Responsive dial text scales down with dial width. |
| Fully Kiosk Browser / WebView | Older Android tablet | Kiosk/mobile | ✅ | Finished overlay fallback no longer skips immediately on observed device profile. |

## Network conditions

| Network profile | Result | Notes |
| --- | --- | --- |
| Normal LAN (<20 ms) | ✅ | Baseline dashboard behavior. |
| Intermittent connectivity | ✅ | Reconnecting overlay and control disablement behave consistently. |

## Feature scenarios

| Scenario | Result | Notes |
| --- | --- | --- |
| Full-size dial countdown readability | ✅ | Larger in-face typography validated at normal dashboard card widths. |
| Narrow card dial typography scaling | ✅ | Text scales down with dial shrink; full-size text remains unchanged. |
| Finished state handle visibility | ✅ | Handle hidden for running, paused, and finished states. |
| Finished -> idle fallback without finish event | ✅ | Near-zero running->idle transitions still show finished state before auto-idle timeout. |
| WebView monotonic lag finish behavior | ✅ | Fallback uses wall-clock and stale-baseline inference to preserve finished overlay duration. |

## Automated checks

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run docs:check`
- `npm run release:verify`
