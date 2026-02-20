# QA matrix — Tea Timer Card v0.3.0

## Summary

- Release tag: `v0.3.0`
- Minimum Home Assistant version: **2024.7.0**
- Focus areas in this cycle: touch UX stability, layout consistency across states, narrow-width dial integrity, and finished-state resilience.
- Evidence set:
  - Structured observations: [`docs/qa/artifacts/2026-02-07/ux-audit/ux-observations.json`](qa/artifacts/2026-02-07/ux-audit/ux-observations.json)
  - Screenshot sample: [`docs/qa/artifacts/2026-02-07/ux-audit/01-idle-baseline.png`](qa/artifacts/2026-02-07/ux-audit/01-idle-baseline.png)
  - UX findings and prioritization: [`docs/ux-audit.md`](ux-audit.md)

## Home Assistant coverage

| Home Assistant version | Installation method | Result | Notes |
| --- | --- | --- | --- |
| core-2024.7.x | HACS custom repository install | ✅ | Stable loader `tea-timer-card.js` references fingerprinted bundle after browser refresh. |
| core-2024.7.x | Manual copy of release assets | ✅ | Release workflow packages loader, fingerprinted bundle, source map, and checksums. |

## Browser & device coverage

| Browser | OS / Device | Layout | Result | Notes |
| --- | --- | --- | --- | --- |
| Chrome | Windows 11 desktop | Light | ✅ | Baseline interaction shell, queued presets, and restart semantics validated. |
| Microsoft Edge | Windows 11 desktop | Light | ✅ | Confirmed finished overlay timing and idle fallback behavior. |
| Chrome | Android 14 phone | Mobile | ✅ | Touch targets and dial-plus-rail flow validated. |
| Fully Kiosk Browser | Older Android tablet | Kiosk/mobile | ✅ | Verified fallback finished overlay behavior when native finished transition is skipped. |

## Network conditions

| Network profile | Result | Notes |
| --- | --- | --- |
| Normal LAN (<20 ms) | ✅ | Baseline dashboard behavior. |
| Intermittent connectivity | ✅ | Reconnecting overlay and control disablement behave consistently. |

## Feature scenarios

| Scenario | Result | Notes |
| --- | --- | --- |
| Idle -> start via card body tap | ✅ | Enabled only in idle mode; guarded by `cardBodyTapStart`. |
| Running/paused accidental card-body restart prevention | ✅ | Restart requires explicit action control. |
| Running -> queued preset feedback | ✅ | Context rendered in primary action secondary line (no dedicated subtitle row). |
| Overlay feedback surfaces | ✅ | Reconnecting/service/entity alerts render without shifting core shell layout. |
| Narrow-width dial rendering | ✅ | Dial maintains circular geometry under constrained widths. |
| Finished -> idle fallback without finish event | ✅ | Near-zero running->idle transitions still show finished state before auto-idle timeout. |
| Pause/resume and extend controls | ✅ | Touch-safe targets and rail grouping verified. |

## Automated checks

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run docs:check`
- `npm run release:verify`
