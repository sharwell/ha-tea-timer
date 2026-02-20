# Tea Timer Card

Tea Timer is a custom Lovelace card for Home Assistant that helps you brew the perfect cup. The project is currently in a preview state while core functionality is being implemented.

> **Latest release:** [Tea Timer Card v0.3.0](https://github.com/sharwell/ha-tea-timer/releases/tag/v0.3.0) — our touch UX stabilization release with improved layout consistency and timer-state resilience. Minimum Home Assistant core: **2024.7.0**. See the [QA matrix](docs/qa-matrix.md), the [UX audit](docs/ux-audit.md), and the [release checklist](docs/release-checklist.md) for validation evidence and release gates.

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

> **New to Home Assistant?** Follow the [Quick Start guide](docs/quick-start.md) for an end-to-end
> walkthrough that covers helpers, installation, and first-run validation.

### Installation

#### Via HACS (recommended)

1. Add this repository as a [custom repository](https://hacs.xyz/docs/faq/custom_repositories/) in HACS using the **Lovelace** category.
2. Install **Tea Timer Card** v0.3.0 (or the latest available release) from the HACS frontend.
3. HACS will place `tea-timer-card.js` in your Home Assistant instance. The file is a stable loader that re-exports the fingerprinted production bundle shipped with each release.
4. Reload your browser or clear the Lovelace resources cache so Home Assistant picks up the new card bundle.

#### Manual install (download release assets)

1. Download the `tea-timer-card.js`, `tea-timer-card.<hash>.js`, and optional `tea-timer-card.<hash>.js.map` files from [Tea Timer Card v0.3.0](https://github.com/sharwell/ha-tea-timer/releases/tag/v0.3.0).
2. (Optional) Verify integrity by comparing the SHA-256 checksums of the downloaded files with the release `checksums.txt`.
3. Copy the downloaded files into `<config>/www/` in your Home Assistant setup.
4. Add a Lovelace resource entry pointing at `/local/tea-timer-card.js` (see [Using the Card in Home Assistant](#using-the-card-in-home-assistant)). The stable loader automatically imports the fingerprinted bundle so browsers refresh cached assets between releases.

#### Local build (for contributors)

```bash
npm ci
```

### Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start a local development server with Vite. |
| `npm run build` | Build the card bundle for distribution. |
| `npm test` | Run unit tests with Vitest. |
| `npm run lint` | Run ESLint static analysis. |
| `npm run typecheck` | Type-check the project with TypeScript. |

### How state sync works

- Each card instance binds to a Home Assistant `timer` entity specified by the required `entity` option. When the configured entity is missing, mis-typed, or unavailable, the card surfaces a single high-priority alert and hides the dial and presets until the timer is healthy again.
- The card derives a normalized `TimerViewState` from the entity’s attributes (`state`, `duration`, `remaining`, `last_changed`).
- WebSocket subscriptions mirror Home Assistant updates:
  - `state_changed` keeps the card synchronized with the entity’s state.
  - `timer.finished` triggers a five-second overlay before settling back to Idle.
- When Home Assistant omits `remaining`, the card derives an estimated value using `duration` and `last_changed`. With the skew estimator enabled (default) it tracks a lower-envelope server-to-client offset and applies it to those timestamps so the baseline stays within about 0.5 s once warmed up. Disabling the estimator bypasses offset tracking and falls back to the local clock with a ±1 s safety band so the countdown remains monotone until the next server update; the UI still surfaces a drift notice if Home Assistant stays out of sync for long.
- Between Home Assistant updates, the card performs a visual once-per-second countdown from the last synchronized `remaining` value (clamped to zero). Each server update resets the baseline so Home Assistant stays authoritative for countdown accuracy. The countdown pauses while disconnected and resumes after a successful resync.
- A monotonic countdown engine renders directly from that baseline using a monotonic clock. A quantizer rounds the remaining time to integer seconds with a small hysteresis window so the visible value never jumps upward between ticks—only material state changes (start/restart/resume) or large upward corrections (≥1.5 s) can raise the display, eliminating back-ticks after background tabs or jittery frames.
- Right after a start or restart, the card seeds a monotonic baseline so the first running frame matches the requested duration within ±0.25 s while waiting for Home Assistant’s authoritative snapshot.
- Card-body taps proxy to Home Assistant only while idle: with `cardBodyTapStart` enabled (default), idle taps call `timer.start` with the normalized dial duration. Running/paused restart always requires explicit controls (`Restart`, plus optional confirmation). Dial drags never trigger service calls—releasing after an adjustment leaves the timer idle until you explicitly start. The UI enforces a single in-flight action with a pending overlay (“Starting…” / “Restarting…”) and ignores further taps until Home Assistant confirms the new state. While running or paused, the dial presents a read-only progress indicator—the handle hides and the slider leaves the tab order to reinforce that the duration cannot be changed mid-brew.
- The connection status is monitored in real time. If the Home Assistant WebSocket disconnects the card freezes the countdown, surfaces a “Disconnected” banner, and disables interactions until the link is restored and a fresh state snapshot is fetched.
- Entity errors and connection status follow a clear precedence: the existing “Disconnected” banner wins whenever the WebSocket is offline, otherwise a consolidated entity alert appears (for missing/wrong-domain/unknown/unavailable entities), and only when both are clear do preset hints or secondary notices render.

### Dial duration configuration

- The circular dial is interactive only while the timer is Idle. Dragging or using the keyboard updates the local `selectedDurationSeconds` field shown in the time text; no Home Assistant service calls are made yet, and releasing after a drag never starts the brew on its own. As soon as the timer begins running—or if it is paused—the dial switches into a read-only progress display, hides the handle, and exposes `aria-disabled="true"` so assistive tech skips the slider until it returns to Idle.
- Duration selection is bounded and rounded with optional card options:
  - `minDurationSeconds` (default `15` seconds)
  - `maxDurationSeconds` (default `1200` seconds / 20 minutes)
  - `stepSeconds` (default `5` seconds)
- Values are clamped within the configured range and rounded to the nearest step. Crossing the 12‑o’clock boundary is smoothed so the value continues naturally.
  - Accessibility: the dial exposes `role="slider"` with `aria-valuemin`, `aria-valuemax`, and `aria-valuenow`. Keyboard controls mirror the pointer interactions (`←`/`↓` decrease by `stepSeconds`, `→`/`↑` increase by `stepSeconds`, `PageDown`/`PageUp` adjust by 30 seconds). Right and Left follow the current text direction so RTL locales nudge in the expected direction. When running or paused, the slider reports `aria-readonly="true"` and `aria-disabled="true"` so screen readers announce the locked state.
- The **Custom duration** indicator fades in when you leave a preset, but the preset row keeps its height reserved so drag or keyboard tweaks never shift surrounding controls.

### Accessibility

- Preset chips and the primary Start/Restart button sit in the tab order (chips left-to-right followed by the main action). Each control exposes an accessible name that includes the preset label and its formatted duration.
- The timer status is announced through a polite live region. Start, restart, finish, and remaining-time updates are throttled (30s ≥2:00, 10s ≥1:00, 5s ≥0:20, 1s <0:10) to avoid overwhelming assistive tech.
- Queuing a new preset while the timer runs surfaces a single “Next preset selected …” announcement; clearing the queue suppresses stale messages.
- Entity errors surface via a single `role="alert"` region without stealing focus. Toasts for service failures remain polite live regions so screen readers receive exactly one high-priority announcement at a time.
- Reduced-motion preferences disable dial and spinner animations, and forced-colors/high-contrast modes fall back to system colors for primary controls.

### Troubleshooting

- **Entity missing/unavailable**: Follow the card’s alert message. “This card isn’t set up yet…” means the `entity` option is blank; open the editor and select a `timer.*` helper. “The configured entity … isn’t a timer” indicates the id does not start with `timer.`; pick a timer helper instead of a sensor/light. “The timer entity … is unavailable” points to a disabled or renamed helper—re-enable it in Home Assistant and verify the `entity_id` matches.
- **Disconnected banner**: If you see “Disconnected from Home Assistant,” check that your browser still has a WebSocket path to the server. The card freezes the countdown and disables the dial until it reconnects and replays the latest entity state.
- **No live updates**: Ensure the Home Assistant WebSocket connection is available. The card falls back to the latest `hass` object update but real-time updates rely on the connection being online.
- **Estimated remaining time**: If Home Assistant does not provide `remaining`, the card estimates the value. When the estimate drifts more than ~2 seconds, a note appears until Home Assistant reports an authoritative value.

To experiment locally, run `npm run dev` and open the playground at <http://localhost:5173/>. The demo page includes controls to simulate timer runs, finished events, and unavailable states.

### Using the Card in Home Assistant

1. Download the release assets (or run `npm run build` locally) to obtain `tea-timer-card.js` and the fingerprinted bundle in `dist/`.
2. Copy the files into your Home Assistant `www` folder.
3. Add the following resource reference in your Lovelace configuration:

   ```yaml
   url: /local/tea-timer-card.js
   type: module
   ```

4. Configure the card in Lovelace:

    ```yaml
    type: custom:tea-timer-card
    title: Kitchen Tea Timer
    entity: timer.kitchen_tea
    defaultPreset: Black Tea
    presets:
      - label: Green Tea
        durationSeconds: 120
      - label: Black Tea
        durationSeconds: 240
    ```

   Optional dial bounds (add alongside the other card options):

    ```yaml
    minDurationSeconds: 30
    maxDurationSeconds: 900
    stepSeconds: 10
    cardBodyTapStart: true # optional—allow tap-to-start on non-control card body regions while idle
    confirmRestart: true # optional—require confirmation before restarting a running timer
    finishedAutoIdleMs: 7000 # optional—show the Done overlay before returning to Idle
    disableClockSkewEstimator: true # optional—prefer the local clock with bounded drift instead of estimating skew
    ```

   Preset chips render in the order provided. Set `defaultPreset` to the label or zero-based index of the preset you want selected when the card loads; if omitted, the first preset is used. Selecting a preset while the timer is idle updates the dial immediately, while taps during a brew queue the new selection for the next restart and surface a “Next …” context label in the primary action line.

#### Configure with the Lovelace Visual Editor

- When editing a dashboard, choose **Add card → Tea Timer** to open the guided form. The picker filters the entity selector to `timer` helpers and seeds the preview with sample presets so you can see the dial immediately.
- The editor mirrors the YAML options above: title, timer entity, default preset, and preset rows with a duration selector. Expand **Advanced options** to edit dial bounds, confirm-before-restart, the finished overlay delay, and the clock skew estimator toggle.
- Switch between **Visual** and **YAML** modes at any time—unknown keys are preserved so you can maintain manual tweaks. See [Configure with the Visual Editor](docs/visual-editor.md) for screenshots and step-by-step guidance.

#### Pause/Resume compatibility helper (optional)

- The card automatically prefers Home Assistant’s native `timer.pause` and resumes paused brews by calling `timer.start` without a duration. When the pause service is missing, it transparently falls back to a helper named `input_text.<timer_slug>_paused_remaining` (for example `input_text.kitchen_tea_paused_remaining`).
- Create the helper via **Settings → Devices & services → Helpers → Create helper → Text** (or add the YAML equivalent). Leave the value editable; the card accepts either numeric or string states as long as the helper stores the remaining seconds.
- Enable `restore: true` on both the timer helper and the compatibility helper so paused brews survive Home Assistant restarts. Without restoration Home Assistant returns the entity to Idle on boot.
- With the helper in place, the Pause/Resume buttons appear even on older Home Assistant versions and continue to coalesce +1 minute updates while paused.

### Automate on finish

- The card listens for Home Assistant’s `timer.finished` event to surface the five-second “Done” overlay. You can attach your own automations to the same event to play sounds, flash lights, or send notifications.
- See [Automate on `timer.finished`](docs/automations/finished.md) for a QA automation example, manual test scenarios, and guidance on handling edge cases like multi-device sync or timers that finish while Home Assistant is offline.
- Home Assistant does **not replay** missed finishes after a restart. If a timer would have expired while Home Assistant was offline, no `timer.finished` event is emitted on startup.
- Avoid triggering automations from `timer.started`. The extend button may reissue `timer.start` calls when `timer.change` is unavailable, but the brew still produces a single `timer.finished` event.

### Documentation

- [Quick Start](docs/quick-start.md)
- [Configuration reference](docs/configuration-reference.md)
- [Presets and durations](docs/presets-and-durations.md)
- [State & actions](docs/state-and-actions.md)
- [Automate on `timer.finished`](docs/automations/finished.md)
- [Multi-instance & sync](docs/multi-instance-and-sync.md)
- [Configure with the Visual Editor](docs/visual-editor.md)
- [Accessibility & reduced motion](docs/accessibility-and-reduced-motion.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Frequently asked questions](docs/faq.md)
- [Contributing & support](docs/contributing-and-support.md)
- [Changelog & versioning](docs/changelog-and-versioning.md)

Below is a crisp, implementation‑ready specification for a **Tea Timer Card** as an independent Home Assistant extension (custom Lovelace card + optional helper). It’s organized into **MVD** (minimum viable deliverable) and **Post‑MVD**. Every item is numbered for easy re‑ordering. After the spec, you’ll find a set of **concrete unit milestones**.

---

## A. Goal & Scope (high level)

1. **Goal:** Create a Lovelace card with a circular “dial” (Android‑style) to set and start a countdown for brewing tea/coffee, with beverage presets, clear remaining‑time text, and automation hooks at timer completion.
2. **Scope:** Multiple independent card instances on the same dashboard; state synchronized across devices viewing the same underlying entity; ability to start (and restart) by clicking; optional +1 min bump; automation hook on zero.
3. **Assumptions:**
   3.1. The card will bind to one **Home Assistant `timer` entity** per card instance for shared, server‑side state.
   3.2. The dial UI can be inspired by HA’s climate/thermostat dial but is a **self‑contained control** (no climate dependency).
   3.3. Beverage “type” buttons are **presets** that define a duration (and label); presets are configurable per card.

---

## B. MVD — Features & Behaviors

1. **Card Instances & Entities**
   1.1. Each card instance **targets exactly one** `timer` entity (e.g., `timer.tea_timer_kitchen`).
   1.2. Multiple instances on a dashboard are allowed and **act independently** if bound to different entities.
   1.3. If the **same card instance** (same entity) is visible on multiple devices, state and UI **stay in sync** via HA entity updates.

2. **Dial Interaction (Duration Selection)**
   2.1. Circular dial to select duration before starting (minutes:seconds).
   2.2. **Default range:** 00:15–20:00; **step:** 5 seconds.
   2.3. Drag to set duration when the timer is **idle**; dial is **locked** while running (shows progress instead).
   2.4. **Visuals:** static outer track, animated progress arc while running, marker at end time.

3. **Start & Restart by Click**
   3.1. **Single tap/click on the card body** when idle can start the countdown using the
        **currently selected preset duration** (or dial-set duration if no preset is selected).
   3.2. While running/paused, restart requires an explicit control tap (`Restart`) rather than a
        non-control card-body tap. Dedicated Pause/Resume controls halt and continue without reset.
   3.3. Optional restart confirmation is **off by default**.

4. **Remaining Time Text**
   4.1. Prominent time display in `M:SS` (or `H:MM:SS` above 59:59).
   4.2. When idle, shows the selected duration; when running, shows **continuously updating** remaining time.
   4.3. When finished, shows **“Done”** (and optional preset label, e.g., “Black Tea done”).

5. **Beverage Preset Buttons**
   5.1. A row of small “chip” buttons, each with **label + configured duration** (e.g., Green 2:00; Oolong 3:00; Black 4:00; Herbal 5:00; Coffee 4:00).
   5.2. Tapping a preset **selects** it and updates the dial duration (if idle).
   5.3. Tapping a preset while running **queues** the new duration for the **next start/restart** (does **not** change the current run in MVD).
   5.4. Configurable **order, labels, durations** in the card’s options.

6. **Title & Subtitle**
   6.1. **Title** field shown at top (e.g., “Kitchen Tea Timer”).
   6.2. Optional secondary context line in the primary action to reflect queued/custom duration
        information (for example, “Next: Black 4:00”).

7. **Automation Hook at Zero**
   7.1. Completion relies on the underlying `timer` entity’s **`timer.finished`** event.
   7.2. Users can attach any automation to `timer.finished` for the bound entity (e.g., chime speaker, flash lights).
   7.3. The card **does not** implement its own scheduling in MVD; **no race conditions** because HA owns timekeeping.

8. **Core States & Visuals**
   8.1. **Idle:** dial editable; start action available.
  8.2. **Running:** progress arc animates; dial read‑only; pause and restart actions available; remaining time visible; optional extend chip renders when enabled.
  8.3. **Paused:** progress arc freezes; dial stays read‑only; resume and restart actions available; “Paused” badge visible; +1 Minute updates retained remaining without resuming.
   8.4. **Finished:** “Done” state until user taps (which restarts) or it auto‑returns to idle after 5 seconds (configurable).
   8.5. **Disabled/Error:** clearly indicated if bound entity not found/unavailable.

9. **Configuration (per card instance)**
   9.1. `entity` (required): HA `timer` entity id.
   9.2. `title` (optional).
   9.3. `presets` (array of `{label, duration}`; at least 3, up to 8).
   9.4. `default_preset` (optional index or label).
  9.5. `minDurationSeconds`, `maxDurationSeconds`, `stepSeconds` (optional, with MVD defaults).
 9.6. `finishedAutoIdleMs` (default 5000).
  9.7. `confirmRestart` (default false).
  9.8. `disableClockSkewEstimator` (default false; when true the card seeds from the local clock with ±1 s safety bounds instead of tracking server skew).
  9.9. `showPlusButton` (default true; hide the extend chip when false).
  9.10. `plusButtonIncrementS` (default 60; controls the extend increment).
  9.11. `maxExtendS` (optional cap on total extend seconds per brew).
  9.12. `showPauseResume` (default true; hide the pause/resume controls when false).

10. **Accessibility & Internationalization**
    10.1. Full keyboard support: focusable chips; Space/Enter to start/restart; arrow keys to nudge dial when idle (+/‑ step).
    10.2. Live region for remaining time (ARIA) without spamming assistive tech (throttled).
    10.3. Localized time formats and labels (strings externalized).

11. **Performance & Reliability**
    11.1. Subscribe to the bound entity’s state for real‑time sync across devices.
    11.2. Debounce dial changes; only send duration to HA **once** on start.
    11.3. No client‑side timing authority (avoid drift).

---

## C. Post‑MVD — Nice‑to‑Haves

1. **+1 Minute Button** *(delivered in Milestone 14—see §§8.2 & 9)*
   1.1. Visible while running; each tap **extends** remaining time by the configured increment **without resetting** the timer.
   1.2. Implementation: prefer `timer.change` when supported; otherwise restart via `timer.start` with the new remaining time.
   1.3. Configurable increment and optional per-brew cap (`maxExtendS`).

2. **Pause/Resume** *(delivered in Milestone 15 — see §§8.2, 8.3, and 9.12)*
   2.1. Pause/Resume lives alongside Restart with a frozen dial, ARIA announcements, and cross-device
        sync.
   2.2. Native `timer.pause`/`timer.start` resume is preferred; a compatibility helper keeps the feature
        available on older installs.

3. **Haptics & Sound**
   3.1. Optional **client‑side chime** on finish (in addition to server automations).
   3.2. **Haptic feedback** on mobile for start/restart and preset selection.

4. **Advanced Presets**
   4.1. Per‑preset icon and color.
   4.2. Per‑preset **post‑finish actions** (e.g., “turn off kettle” script).
   4.3. Preset **groups** (Tea/Coffee) with scrolling chips.

5. **Dial Enhancements**
   5.1. **Long‑press** dial to quickly set common marks (1:00, 2:00, 3:00…).
   5.2. **Double‑tap to restart** (and make single tap Pause), configurable interaction model.

6. **Multi‑Timer Template**
   6.1. Wizard to auto‑create `timer` entities for named locations (e.g., Kitchen/Office).
   6.2. One‑click duplication of a configured card.

7. **Finish Animations & Badges**
   7.1. Subtle confetti/pulse animation on finish.
   7.2. Badge when an instance finished recently (“Done 0:12 ago”).

8. **History & Telemetry**
   8.1. Show last N runs and durations (uses Recorder).
   8.2. Average brew times per preset.

9. **Compact Layout**
   9.1. Auto‑switch to compact chip‑first layout on phones.
   9.2. Responsive dial size with min/max diameter settings.

10. **Blueprints**
    10.1. Provide **automation blueprints** for common actions (play sound, blink light, notify mobile app) on `timer.finished`.

---

## D. Behavior Details & Edge Cases

1. **Restart While Running (MVD):** A tap restarts to the selected preset/dial duration from full; this is explicit to meet the requirement.
2. **Preset Change While Running (MVD):** Changes **do not** modify the current run; they take effect on the next start/restart (prevents surprise).
3. **Multiple Viewers:** If two devices interact at once, HA’s last valid service call wins; UI reconciles on the next state update.
4. **Unavailable Entity:** Card shows a clear error with the configured `entity` id and a link (“Open Helpers”) for quick fix.
5. **Recorder Off:** History/telemetry items (post‑MVD) gracefully hide if Recorder isn’t enabled.
6. **Internationalization:** All user‑facing strings pulled from a dictionary to support translations; time formats rely on locale.

---

## E. Configuration Surface (concise)

1. `entity` (string, required)
2. `title` (string)
3. `presets` (array of `{ label: string, duration: "MM:SS" | seconds }`)
4. `default_preset` (string|number)
5. `minDurationSeconds` (seconds), `maxDurationSeconds` (seconds), `stepSeconds` (number)
6. `confirm_restart` (boolean)
7. `finished_auto_idle_ms` (number)
8. *(Post‑MVD)* `plus_button_increment_s`, `show_plus_button`, `show_pause_resume`, `preset_icons`, `preset_colors`, `compact`

---

## F. Unit Milestones (from zero to MVD, then Post‑MVD)

1. **Spec Freeze & Assumptions Locked**

   * Acceptance: This document checked into repo (README/spec) as v0.1.
2. **Project Skeleton (Card Scaffolding)**

   * Acceptance: Card renders a placeholder with `title` and binds to a provided `entity` id (no logic yet).
3. **Entity Binding & State Wire‑Up**

   * Acceptance: Card subscribes to `timer` entity; shows Idle/Running/Finished based on state; displays raw remaining/duration values.
4. **Dial Control (Idle‑Only) & Duration Model**

   * Acceptance: Dragging the dial updates a local duration model with min/max/step; changes are visible in the time text.
5. **Start/Restart Actions**

   * Acceptance: Tap when idle can call `timer.start(duration)` when `cardBodyTapStart` is enabled;
     running/paused restart requires explicit action controls; finish state visible.
6. **Beverage Presets (Static)**

   * Acceptance: Configurable preset chips render; selecting a chip updates dial (idle) and queues next duration (running).
7. **Remaining‑Time Presentation**

   * Acceptance: Time text formats as `M:SS` / `H:MM:SS`; updates smoothly at ~1Hz during running without excessive reflows.
8. **Finish → Automation Hook Validation**

   * Acceptance: Demo automation triggers on `timer.finished` for the bound entity; confirming event metadata is accessible.
9. **Accessibility Pass (MVD)**

   * Acceptance: Keyboard navigation for chips and start/restart; ARIA live region announces state changes and remaining time throttled.
10. **Error & Edge Handling**

    * Acceptance: Clear UI for missing/unavailable entity; safe handling of concurrent taps (no uncaught exceptions).
11. **Visual Polish & Progress Arc**

    * Acceptance: Progress arc animates proportionally; responsive sizing down to small card widths.
12. **Docs & Example Configs**

    * Acceptance: README with examples for single/multiple instances; automation examples for `timer.finished`.
13. **Release MVD**

    * Acceptance: Versioned build, changelog, and basic test matrix across desktop/mobile browsers.

**Post‑MVD Milestones**

14. **+1 Minute Increment (Extend Without Reset)**

    * Acceptance: While running, +1m adjusts remaining time in place; verified with wall‑clock and finish event timing.
15. **Pause/Resume**

    * Acceptance: Pause/Resume buttons function with visual/ARIA feedback; restart behavior still consistent.
16. **Interaction Preferences**

    * Acceptance: Config to switch tap = Pause (double‑tap = Restart) vs. tap = Restart; persisted per card.
17. **Haptics/Chime (Client‑Side Optional)**

    * Acceptance: Toggleable haptic & small chime on finish; respects browser autoplay policies.
18. **Blueprints Pack**

    * Acceptance: Published blueprints for finish actions (sound, light, mobile notification).
19. **Compact & Theming Enhancements**

    * Acceptance: Responsive compact layout and optional per‑preset icon/color.

---

## G. Risks & Mitigations (succinct)

1. **Extending HA Timer Remaining Time:** If core `timer` cannot be adjusted mid‑run, implement a tiny **custom helper** that tracks end‑time and supports “extend” semantics; the card calls that helper’s service for +1m.
2. **Accidental Restarts:** Default interaction meets the requirement; provide `confirm_restart` and alternate interaction (post‑MVD) to mitigate.
3. **Drift/Sync:** Keep HA authoritative; card never runs its own countdown logic beyond UI tick display.
