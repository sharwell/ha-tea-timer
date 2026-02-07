# Tea Timer Touch UX Audit (2026-02-07)

## Scope and method
- Code review focused on touch interaction and layout behavior in `src/card/TeaTimerCard.ts`, `src/dial/TeaTimerDial.ts`, `src/styles/card.ts`, and `src/strings.ts`.
- Executed 23 touchscreen-oriented scenarios in the local dev demo (`/demo`) with mobile emulation and full-page screenshots.
- Collected structured UI snapshots (state text, control positions, control sizes, disabled/queued flags) into `docs/qa/artifacts/2026-02-07/ux-audit/ux-observations.json`.
- Screenshot evidence is in `docs/qa/artifacts/2026-02-07/ux-audit/` (`01-...png` through `23-...png`).
- Caveat: the demo shell does not include a viewport meta tag, so the harness renders at a wide layout viewport and scales down. Relative layout/state behavior is still directly observable.

## Scenario record

### A. Core brew flow scenarios
| ID | Scenario | What looked good | What did not look good | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Idle baseline | Clear hierarchy: title, status, dial, presets, primary action. Primary action is visually strong. | None major in idle state. | `01-idle-baseline.png` |
| 2 | Idle dial drag | Dial manipulation is smooth and immediate. Primary action duration updates consistently with dial. | Custom hint appears but is subtle and easy to miss when moving quickly. | `02-idle-dial-drag.png` |
| 3 | Start by tapping card body | Very fast start path. Running visual state is obvious (blue dial, Running status). | Full-card tap start/restart is implicit and easy to trigger accidentally. Card height jumps from ~516px (`02`) to ~632px (`03`), moving shared controls (preset row and primary action) downward; this breaks positional continuity across a core transition. | `03-start-via-card-body-tap.png` |
| 4 | Running steady | Countdown updates feel stable. Readability of remaining time is strong. | Preset row is still interactive during run, but its behavior is “queue for later,” which is non-obvious at first glance. | `04-running-steady.png` |
| 5 | Queue preset while running | Subtitle “Next: …” gives clear queued feedback. Dashed queued chip state is visible. | Card height grows when subtitle appears (layout shift), moving all controls down. | `05-queue-preset-while-running.png` |
| 6 | Clear queued preset | Tapping queued chip again is reversible and quick. | Subtitle removal shifts layout back up (muscle memory break). | `06-clear-queued-preset.png` |
| 7 | Tap dial while running | Blocked interaction feedback appears quickly. | Tooltip insertion increases card height and pushes controls (unexpected movement while timer active). | `07-tap-dial-while-running.png` |
| 8 | Extend while running | Extend applies immediately and displayed time/action duration stay in sync. | Extend button is a small target (40px height) compared to other controls. | `08-extend-while-running.png` |
| 9 | Pause while running | Pause state color/label is clear and distinct. Resume control label is clear. | Primary action changes to `Start` while paused (semantically ambiguous vs restart). | `09-pause-running-timer.png` |
| 10 | Extend while paused | Extend works in paused state without resuming; predictable. | Same small extend target issue persists. | `10-extend-while-paused.png` |
| 11 | Resume paused timer | Resume returns to normal running state cleanly. | No major issue specific to this step. | `11-resume-paused-timer.png` |
| 12 | Rapid double-tap while running | UI remained stable and did not visibly glitch/crash. | Full-card tap restart remains risky under rapid taps because restart is too easy to trigger. | `12-rapid-double-tap-restart-attempt.png` |

### B. Connectivity and entity health scenarios
| ID | Scenario | What looked good | What did not look good | Evidence |
| --- | --- | --- | --- | --- |
| 13 | Disconnect/reconnecting | Controls visibly disable and reconnect message is explicit. | Card grows significantly (banner insertion), causing vertical reflow during unstable connectivity. | `13-disconnect-state.png` |
| 14 | Reconnect | State recovery is immediate and coherent. | No major issue in this step. | `14-reconnect-state.png` |
| 15 | Entity unavailable | Strong fail-safe: interactive controls are removed, alert is prominent. | Card collapses from full interactive layout to short error-only layout (large page reflow). | `15-entity-unavailable.png` |
| 16 | Recover from unavailable | Recovery returns to expected idle UI cleanly. | No major issue in this step. | `16-recovered-after-unavailable.png` |
| 17 | Missing entity config | Error message is direct and useful. | Same abrupt collapse/reflow pattern as unavailable. | `17-missing-entity-configuration.png` |
| 18 | Wrong domain entity | Message is specific enough to diagnose misconfiguration. | Same abrupt collapse/reflow pattern. | `18-wrong-domain-entity.png` |
| 19 | Unknown timer entity | Message remains clear and safe. | Same abrupt collapse/reflow pattern. | `19-unknown-timer-entity.png` |
| 20 | Restore valid config | Returns to baseline safely. | No major issue in this step. | `20-restored-entity-config.png` |

### C. Error and confirmation scenarios
| ID | Scenario | What looked good | What did not look good | Evidence |
| --- | --- | --- | --- | --- |
| 21 | Start service failure | Failure is clearly surfaced and retry path remains available. | Error is duplicated as both banner and toast; toast overlays primary CTA area and truncates readability. | `21-start-service-failure.png` |
| 22 | Restart confirmation overlay | Confirmation flow correctly blocks background interactions. | Dialog buttons are visually tiny for touch and the modal does not match the scale of the rest of the control. | `22-restart-confirmation-overlay.png` |
| 23 | Cancel restart confirmation | Dismiss path works and state is preserved. | No major issue beyond small dialog control sizing. | `23-restart-confirm-canceled.png` |

## Things that work well
- Dial-centric visual hierarchy is strong across idle/running/paused states.
- State colors communicate mode changes effectively (idle, running, paused, reconnecting).
- Pause/resume and extend behavior is functionally predictable.
- Queued preset behavior is reversible and includes explicit “Next …” messaging.
- Disconnected state properly disables actions, reducing invalid interactions.
- Entity error messaging is clear and specific.

## Things that do not work well
- Action activation is too implicit in high-risk states: whole-card tap can restart while running.
- Layout stability is weak during common interactions: subtitle, dial tooltip, and banners introduce noticeable vertical jumps.
- Idle-to-running transition changes overall card height and shifts shared controls, reducing predictability for repeated taps.
- Semantics are inconsistent in paused state: main CTA label becomes `Start` rather than a clearly reset-oriented label.
- Feedback surfaces are redundant in failures (banner + toast for same event), increasing clutter and obscuring controls.
- Touch target sizing is inconsistent (`+1:00` and confirm buttons are smaller than primary touch controls).
- State label duplication (`Idle`/`Running`/`Paused`/`Reconnecting`) appears both in the top pill and inside the dial, consuming vertical space that could increase dial diameter and distance readability of the time value.
- Error/unavailable modes collapse the card dramatically, causing large dashboard reflow.

## Code points behind the main UX issues
- Card-wide action tap: `src/card/TeaTimerCard.ts:1213`, `src/card/TeaTimerCard.ts:1250`.
- Paused-state primary action label decision: `src/card/TeaTimerCard.ts:842`.
- Blocking tooltip that inserts/removes layout content: `src/card/TeaTimerCard.ts:2359`, `src/styles/card.ts` (`.dial-tooltip`).
- Redundant error surfaces (banner + toast): `src/card/TeaTimerCard.ts:1150`, `src/card/TeaTimerCard.ts:1119`.
- Small touch targets: `src/styles/card.ts` (`.extend-button` min-height 40; confirm button padding under `.confirm-actions button`).

## Prioritized UX improvement plan

### P0 (highest value: consistency + safety in frequent flows)
1. Restrict card-body tap behavior by state.
- Idle: allow optional card-body tap start.
- Running/Paused: require explicit button tap for restart.
- Rationale: avoids accidental restart while preserving one-tap convenience where risk is low.

2. Normalize primary action semantics.
- Idle main CTA: `Start`.
- Running main CTA: `Restart`.
- Paused main CTA: `Restart` (not `Start`), with `Resume` kept as separate continuation action.
- Rationale: removes paused-state ambiguity.

3. Freeze control ordering and reserve row space.
- Use one fixed vertical structure in all active states: `Status/Banner` -> `Dial` -> `Preset row` -> `Secondary controls row` -> `Primary CTA`.
- Keep a reserved subtitle row (empty when unused) to prevent jumps.
- Keep blocked-dial feedback non-layout-shifting (overlay badge inside dial region).
- Rationale: preserves muscle memory and reduces mis-taps.

4. Make touch target sizing consistent.
- Enforce minimum 44x44 for extend and confirm controls.
- Keep visual style but increase tappable box via padding/container rules.

5. Remove redundant status labeling and reallocate space to the dial.
- For normal timer modes (idle/running/paused), keep one status label location only (prefer the in-dial secondary label).
- Reserve top status/banners for exceptional states only (reconnecting/disconnected/error/unavailable).
- Increase dial diameter with reclaimed vertical space to improve time readability at distance.
- Rationale: better information density and visual clarity without losing state awareness.

### P1 (high value: predictability + clarity in failure/reconnect states)
1. Consolidate error messaging to one primary surface per event.
- Service action failures: inline banner only, no duplicate toast.
- Non-blocking transient notices: toast only when no inline banner exists.
- Rationale: removes overlap and conflicting attention cues.

2. Stabilize disconnected/reconnecting and entity-error layout.
- Prefer an in-place state panel within fixed card height for recoverable errors.
- Keep dial/controls visible but visibly locked where appropriate.
- Rationale: reduces severe dashboard reflow during transient outages.

3. Improve confirmation modal ergonomics.
- Increase button size to touch-safe minimums.
- Use stronger visual hierarchy (`Cancel` and `Restart`) and clearer spacing.

### P2 (polish: aesthetics + comprehension)
1. Improve running-state control grouping.
- Present `Pause/Resume`, `+1:00`, and `Restart` as a coherent action cluster.
- Keep consistent spacing and weight across states.

2. Refine queued preset presentation.
- Show selected preset and queued preset states simultaneously with clearer visual tokens.
- Keep subtitle row reserved to avoid motion.

3. Tone and typography pass.
- Reduce minor text density around controls.
- Increase contrast consistency for small helper labels.

## Conflict-resolution rules used for prioritization
1. Safety over speed when timer is active.
- If quick restart and accidental restart prevention conflict, prioritize prevention in running/paused states.

2. Spatial stability over dynamic compactness.
- If conditional rows save space but cause control movement, prioritize stable control positions.

3. Single-source feedback over redundant emphasis.
- If multiple messages increase visibility but reduce clarity, prefer one clear message surface.

4. Frequent-path optimization over rare-path optimization.
- Core brew flow (start, adjust, pause, resume, extend, restart) gets priority over misconfiguration screens.

## Suggested acceptance criteria for the next iteration
1. No layout shift > 8px when toggling queued preset, dial-blocked feedback, or transient status messages.
2. Idle -> running transition keeps overall card height stable (or within 8px) and preserves vertical placement of controls present in both states.
3. Running/paused restart cannot be triggered by tapping non-control card regions.
4. All tappable controls meet minimum 44x44 touch target size.
5. Paused state main CTA reads `Restart` and never `Start`.
6. Service failure presents one visible message surface at a time.
7. Normal timer modes show only one state label location (no duplicated idle/running/paused label), and reclaimed space is applied to larger dial/time display.
