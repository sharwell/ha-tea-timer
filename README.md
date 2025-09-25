# Tea Timer Card

Tea Timer is a custom Lovelace card for Home Assistant that helps you brew the perfect cup. The project is currently in a preview state while core functionality is being implemented.

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

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

### Using the Card in Home Assistant

1. Build the project to produce `dist/tea-timer-card.js`.
2. Copy the `dist` output to your Home Assistant `www` folder.
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
   presets:
     - label: Green Tea
       durationSeconds: 120
     - label: Black Tea
       durationSeconds: 240
   ```

### Documentation

- [Getting Started Guide](docs/getting-started.md)

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
   3.1. **Single tap/click on the card body** when idle → starts countdown using the **currently selected preset duration** (or dial‑set duration if no preset selected).
   3.2. **Single tap/click while running** → **restarts** the countdown to the current preset/dial duration from full (no pause in MVD).
   3.3. Optional “Are you sure?” restart confirmation is **off by default**, to satisfy the “restart by clicking” requirement.

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
   6.2. Optional subtitle to reflect **selected preset** (e.g., “Black Tea • 4:00”) while idle/running.

7. **Automation Hook at Zero**
   7.1. Completion relies on the underlying `timer` entity’s **`timer.finished`** event.
   7.2. Users can attach any automation to `timer.finished` for the bound entity (e.g., chime speaker, flash lights).
   7.3. The card **does not** implement its own scheduling in MVD; **no race conditions** because HA owns timekeeping.

8. **Core States & Visuals**
   8.1. **Idle:** dial editable; start action available.
   8.2. **Running:** progress arc animates; dial read‑only; restart action available; remaining time visible.
   8.3. **Finished:** “Done” state until user taps (which restarts) or it auto‑returns to idle after 5 seconds (configurable).
   8.4. **Disabled/Error:** clearly indicated if bound entity not found/unavailable.

9. **Configuration (per card instance)**
   9.1. `entity` (required): HA `timer` entity id.
   9.2. `title` (optional).
   9.3. `presets` (array of `{label, duration}`; at least 3, up to 8).
   9.4. `default_preset` (optional index or label).
   9.5. `min_duration`, `max_duration`, `step_seconds` (optional, with MVD defaults).
   9.6. `finished_auto_idle_ms` (default 5000).
   9.7. `confirm_restart` (default false).

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

1. **+1 Minute Button**
   1.1. Visible while running; each tap **extends** remaining time by +60s **without resetting** the timer.
   1.2. Implementation: compute new remaining and call a service path that updates the HA timer (custom helper if core timer lacks adjust).
   1.3. Configurable increment (e.g., 15/30/60 seconds).

2. **Pause/Resume**
   2.1. Add Pause/Resume alongside Restart.
   2.2. Leverage `timer.pause`/`timer.resume` (if available) or custom helper.

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
5. `min_duration` (seconds), `max_duration` (seconds), `step_seconds` (number)
6. `confirm_restart` (boolean)
7. `finished_auto_idle_ms` (number)
8. *(Post‑MVD)* `plus_button_increment_s`, `show_plus_button`, `pause_enabled`, `preset_icons`, `preset_colors`, `compact`

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

   * Acceptance: Tap when idle → calls `timer.start(duration)`; tap when running → restarts with selected duration; finish state visible.
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
