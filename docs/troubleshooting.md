# Troubleshooting

Something not working as expected? Use this checklist to diagnose the most common Tea Timer Card
issues.

## Entity missing or unavailable

- **Symptom:** Card shows one of the consolidated entity alerts:
  - “This card isn’t set up yet. Add a timer entity in the card settings.”
  - “The configured entity … isn’t a timer (or doesn’t exist). Choose a `timer.*` entity.”
  - “The timer entity … is unavailable. Check that the helper exists and the `entity_id` is correct.”
- **Diagnosis:**
  1. If the message says the card isn’t set up, edit the Lovelace card and choose a timer helper (`timer.*`).
  2. If it mentions the entity isn’t a timer, confirm the configured id starts with `timer.` instead of `sensor.` or another domain.
  3. If it calls out an unavailable timer, open **Settings → Devices & services → Helpers** and ensure the helper is enabled and retains the shown `entity_id`.
- **Fix:** Update the configuration or helper based on the guidance above. The card hides the dial and presets until the entity reports a healthy state, then resumes normal operation automatically.

## WebSocket disconnected

- **Symptom:** Banner reads “Disconnected from Home Assistant,” countdown pauses, and the dial is
  disabled.
- **Diagnosis:**
  1. Check network connectivity between the device and Home Assistant.
  2. Open the browser developer console; look for WebSocket errors.
  3. Confirm no reverse proxy or firewall is blocking `/api/websocket`.
- **Fix:** Restore the network path. The card resumes once the WebSocket reconnects and a fresh state
  snapshot arrives.

## No live updates (stale countdown)

- **Symptom:** Timer only updates when you refresh the page.
- **Diagnosis:**
  1. Verify the Home Assistant WebSocket connection is active (see above).
  2. Ensure no browser extensions are blocking websockets or JavaScript timers.
  3. Confirm the Home Assistant instance is not overloaded—check system logs for warnings about event
     loop delays.
- **Fix:** Resolve the underlying WebSocket issue or performance bottleneck. The card intentionally
  relies on server events to stay authoritative.

## Dragging the dial doesn't start the timer

- **Symptom:** Adjusting the circular dial changes the displayed duration, but the brew stays Idle
  when you lift your finger or pointer.
- **Diagnosis:** This is expected. Dial drags only update the pending duration; they never call
  Home Assistant services. Starting or restarting always requires the configured primary action
  (tap/click/keyboard activation) so you can adjust the time without accidentally triggering a brew.
- **Fix:** After dragging to the desired time, tap/click the card (or press **Enter**/**Space**) to
  call `timer.start`.

## Custom duration indicator shifts the layout

- **Symptom:** The preset chip row jumps taller/shorter while you scrub the dial or use the
  keyboard near preset boundaries.
- **Diagnosis:** Current builds reserve space for the **Custom duration** badge at all times, so
  the dial and controls stay put. Layout changes usually mean an older bundle is still cached or
  custom styling is overriding `.preset-custom`.
- **Fix:** Refresh the browser to pick up the latest card build, or remove conflicting theme CSS.
  The included demo also exposes a toggle to watch the preset row height for regression testing.

## Countdown drift after reconnect

- **Symptom:** Remaining time briefly jumps forward/backward when the connection restores.
- **Diagnosis:**
  1. Determine whether Home Assistant provided a `remaining` value in the latest update.
  2. If `remaining` is missing, the card estimates it from `duration` and `last_changed` and flags the
     drift when it exceeds two seconds.
- **Fix:** Allow one or two updates after reconnection—the card re-syncs to the server value. If you
  prefer to pause instead of estimating, set `disableClockSkewEstimator: true` in the card
  configuration.

## Card unavailable in Lovelace

- **Symptom:** Lovelace shows “Custom element doesn’t exist: tea-timer-card.”
- **Diagnosis:**
  1. Confirm the card bundle is installed (via HACS or manually) and appears under **Settings →
     Dashboards → Resources**.
  2. Ensure the resource URL matches your deployment (for manual installs it should be
     `/local/tea-timer-card.js`).
  3. Clear your browser cache or perform a hard reload to discard stale resources.
- **Fix:** Add or correct the resource entry, then reload the browser. HACS installations may require a
  resource refresh after updates.

## Extend button missing or disabled

- **Symptom:** The **+1:00** chip never appears or is disabled while the timer is running.
- **Diagnosis:**
  1. Confirm the card configuration has `showPlusButton: true` (default).
  2. Verify the timer entity is available and the WebSocket connection is online. The button hides when
     the entity is unavailable or the connection is down.
  3. Check that no start/restart action is pending. The button temporarily disables while Home
     Assistant confirms the last command.
- **Fix:** Restore the connection or entity, or update the configuration to show the button. It becomes
  interactive again as soon as the timer reports a healthy running state.

## Extend pressed near finish

- **Symptom:** Pressing extend just before the timer expires sometimes has no effect.
- **Diagnosis:** Extends issued within ~350 ms of the finish event race against Home Assistant’s
  authoritative `timer.finished`. The event may fire before the extend reaches Home Assistant.
- **Fix:** The card automatically announces “Timer finished before the extra time could be added.” If
  you need guaranteed extensions, tap a little earlier or increase your increment duration to add more
  runway.

## Paused but remaining time unknown

- **Symptom:** The card announces “Remaining time is unknown while paused” when you try to extend or
  resume.
- **Diagnosis:** Home Assistant did not report a `remaining` value for the paused timer, and the
  compatibility helper value is missing or blank. When native pause is available the card waits for Home
  Assistant to report the remaining seconds. In compatibility mode you must provide an `input_text`
  helper named `input_text.<timer_slug>_paused_remaining` (for example
  `input_text.kitchen_tea_paused_remaining`).
- **Fix:** Wait for the paused entity to report `remaining`, or add/update the helper entity so it
  stores the latest paused seconds. The card resumes normal operation as soon as the value is
  available.

## Pause service not available

- **Symptom:** Attempting to pause displays “Couldn’t pause the timer. Please try again.” or the Pause
  button never appears.
- **Diagnosis:** Your Home Assistant build does not expose the `timer.pause` service. The card falls
  back to compatibility mode when an `input_text.<timer_slug>_paused_remaining` helper exists, but it
  hides the control when neither native pause nor the helper is available.
- **Fix:** Update Home Assistant to a version that supports `timer.pause`, or create the helper entity
  described above and ensure the Tea Timer Card can read and write it. Lovelace reloads pick up the new
  helper automatically.

## “Cannot add more time” after several extends

- **Symptom:** The card announces “Cannot add more time.” even though the timer is running.
- **Diagnosis:** The configuration includes `maxExtendS` and the total added seconds reached that cap.
- **Fix:** Wait for the brew to finish or restart the timer. Increase `maxExtendS` if you need more head
  room for extensions, or remove the option for an unlimited top-up.

## Pause pressed as the timer finished

- **Symptom:** Sometimes the brew finishes instead of pausing (or vice-versa) when you click Pause at
  the last moment.
- **Diagnosis:** Pause requests issued within a few hundred milliseconds of zero race against the
  authoritative `timer.finished` event. Home Assistant decides which action wins based on the entity’s
  final state.
- **Fix:** The card announces the winning outcome (“Timer paused.” or “Tea is ready!”). If you routinely
  cut it close, add a little buffer to your brew or extend earlier.

## Automations not firing

- **Symptom:** `timer.finished` automations never run even though the card shows “Done.”
- **Diagnosis:**
  1. Listen for the `timer.finished` event in **Developer Tools → Events** to confirm Home Assistant
     emits it.
  2. Check automation trigger filters—ensure `event_data.entity_id` matches your timer id.
  3. Review Home Assistant logs for automation errors.
- **Fix:** Update the automation to listen to the correct entity id or adjust conditions. Remember that
  Home Assistant does not replay finishes missed while it was offline; consider a startup automation
  if you need catch-up behavior.

## Paused state lost after Home Assistant restart

- **Symptom:** A paused brew resumes from the beginning after Home Assistant restarts.
- **Diagnosis:** Timers only restore their paused/remaining duration when the helper is created with
  `restore: true`. Without restoration Home Assistant treats the entity as idle on startup, so the card
  follows suit.
- **Fix:** Edit the timer helper in **Settings → Devices & services → Helpers** and enable **Restore**.
  Alternatively, update your YAML helper definition to include `restore: true`. Compatibility mode also
  resumes correctly as long as the associated `input_text` helper retains its value across restarts.

## Still stuck?

- Review the [FAQ](faq.md) for quick answers.
- Ask a question on the project’s issue tracker—include steps to reproduce and any console/log output.
