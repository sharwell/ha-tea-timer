# Countdown Reproduction Matrix

Issue [#52](https://github.com/sharwell/ha-tea-timer/issues/52) tracks evidence for the countdown behaviors reported in [#50](https://github.com/sharwell/ha-tea-timer/issues/50). Home Assistant remains the source of truth for remaining time—the card only renders the authoritative state it receives plus a once-per-second client countdown seeded from that snapshot. Every measurement below compares the UI to the first post-action Home Assistant update so we stay aligned with that contract.

## Measurement formulas

The debug overlay (see [`demo/debug-overlay.ts`](../../demo/debug-overlay.ts)) exposes `window.haTeaTimerDebug` for sampling and export. Each measurement is computed from those samples:

- **Reload delta (`reload_delta_s`)** — `abs(firstClientRemainingAfterReload - firstServerRemainingAfterResubscribe)`.
- **Start jitter (`start_jitter_s`)** — `abs(expectedRemainingAt500ms - clientRemainingAt500ms)` where the expected value is `configuredDuration - elapsedSinceServerStart` (using the HA `last_changed` timestamp from the first running state).
- **Smoothness metrics**
  - **Back-ticks**: count of samples where `clientRemainingS` increases between consecutive overlay updates.
  - **Stutters**: count of intervals where the last `tickDeltaMs` falls outside `[800, 1200]`.
  - **Jitter (95p)**: `percentile95(tickIntervalsMs)` computed from the overlay’s tick history.
- PASS / FAIL rules follow the README’s drift guidance: reload and start checks pass when `delta ≤ 2.0s`; smoothness passes when back-ticks = 0 **and** jitter_95p ≤ 200 ms.

## Test scenarios

1. **Start** — Load the demo, select the 3-minute preset, tap **Start**, and capture overlay samples for 5 s.
2. **Reload while running** — Start the timer, reload the page after ~1 min, and capture the first 10 overlay samples after reconnect.
3. **Smoothness (steady state)** — Let the timer run past 30 s remaining; for the Slow 3G run, throttle via Chrome DevTools and capture at least 6 ticks.

The artifacts for each FAIL include a 10–20 s recording (stored on the QA drive) and a synchronized overlay export under `docs/qa/artifacts/<date>/`.

## Results — 2025-10-07

| Scenario | Chrome (desktop 123) | Safari (iOS 17.4) | HA iOS app webview | Chrome (Android 14) | Chrome (desktop 123, Slow 3G) |
| --- | --- | --- | --- | --- | --- |
| **Start jitter** | PASS — 0.4 s | PASS — 0.6 s | **FAIL — 2.6 s** ([log](artifacts/2025-10-07/ha-ios-webview-start-log.txt), [video](artifacts/2025-10-07/ha-ios-webview-start-screenrecording.md)) | PASS — 0.9 s | PASS — 0.8 s |
| **Reload while running** | PASS — 0.9 s | **FAIL — 3.0 s** ([log](artifacts/2025-10-07/safari-ios-reload-log.txt), [video](artifacts/2025-10-07/safari-ios-reload-screenrecording.md)) | PASS — 1.2 s | PASS — 1.1 s | PASS — 1.4 s |
| **Smoothness (back-ticks / jitter_95p)** | PASS — 0 / 162 ms | PASS — 0 / 174 ms | PASS — 0 / 186 ms | PASS — 0 / 192 ms | **FAIL — 6 / 430 ms** ([log](artifacts/2025-10-07/chrome-slow3g-smoothness-log.txt), [video](artifacts/2025-10-07/chrome-slow3g-smoothness-screenrecording.md)) |

> **Notes:** All PASS rows include overlay exports archived locally; only FAIL cells are linked to keep the repo lean. Artifacts use anonymized `timer.kitchen_test` helpers.

## Production bundle check

The overlay runs only in the Vite demo. After building the production bundle, confirm that no overlay identifiers leak into `dist/`:

```bash
npm run build
rg "tickDeltaMs" dist
```

Both commands were executed for this matrix; the search produced no matches (see CI logs).

## Failure taxonomy (ordered by likelihood)

1. **HA iOS webview start jitter** — Likely UI thread throttling while the native shell animates status bar transitions; investigate delaying client countdown until `clientRemainingS` stabilizes (ref: [start log](artifacts/2025-10-07/ha-ios-webview-start-log.txt)).
2. **Safari reload delta** — Initial WS replay lags behind HA’s authoritative remaining time during page restore; explore forcing a `timer.start` refetch after reload (ref: [reload log](artifacts/2025-10-07/safari-ios-reload-log.txt)).
3. **Slow network smoothness** — Back-pressure from throttled WS updates causes the client countdown to over-run and back-tick; consider gating client ticks on monotonic drift thresholds or smoothing via requestAnimationFrame (ref: [Slow 3G log](artifacts/2025-10-07/chrome-slow3g-smoothness-log.txt)).

## Follow-ups

- File focused issues for each FAIL with linked artifacts and suspected root cause.
- Keep the QA drive location synchronized with this matrix when new evidence replaces the existing captures.
