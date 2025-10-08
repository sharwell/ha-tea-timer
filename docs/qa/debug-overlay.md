# Runtime diagnostics overlay & logs

The diagnostics tooling for Tea Timer can be enabled at runtime in any build:

- **Query string**: append `?tt_debug=1` for overlay + logs, `tt_debug=overlay`, `tt_debug=logs`, or
  `tt_debug=0` to disable.
- **Local storage**: set `localStorage.tt_debug` to `"1"`, `"overlay"`, `"logs"`, or `"0"`.
- **Console helpers**: `window.teaTimerDebug.enable("overlay")`, `.enable("logs")`, `.disable()`, or
  `.toggle()`.

When enabled, a fixed overlay renders with these fields updated at most once per second:

| Field | Description |
| --- | --- |
| `seedSource` | Last baseline seed source (`server_remaining`, `estimated_last_changed`, `resume`, `reload`, or `start`). |
| `serverRemaining` | Server-sourced remaining seconds at the last baseline. |
| `estimatedRemaining` | Client-side estimated remaining seconds shown on the dial. |
| `baselineEndMs` | Epoch milliseconds when the current run is predicted to finish. |
| `nowMs` | `performance.now()` sample at the latest overlay repaint. |
| `clockSkewMs` | Difference between wall-clock and monotonic clocks since enabling diagnostics. |
| `lastServerUpdate` | ISO timestamp of the most recent Home Assistant update that affected the baseline. |

Structured logs are written only while the `logs` mode is active. Each baseline seed emits

```
{ evt:"seed", ts_iso, seedSource, serverRemaining, estimatedRemaining, baselineEndMs, lastServerUpdate, entityId }
```

and any Home Assistant correction that shifts the predicted end time by more than 750ms emits

```
{ evt:"server_correction", ts_iso, delta_ms, serverRemaining, baselineEndMs, lastServerUpdate, entityId }
```

The `entityId` value is lightly anonymized (domain plus a shortened object id) to avoid leaking
exact identifiers in shared logs.

## Demo helpers

The development demo (`npm run dev`) includes a diagnostics section with a "Mirror debug logs
below" toggle. When checked, it mirrors structured debug entries into an ordered list by temporarily
wrapping `console.info`. Uncheck the toggle to restore the original console behavior and clear the
captured list.

## Test snapshot

A representative test run after enabling the runtime diagnostics support:

```
$ CI=1 npm test
 Test Files  14 passed (14)
      Tests  150 passed (150)
```
