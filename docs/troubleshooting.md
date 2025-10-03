# Troubleshooting

Something not working as expected? Use this checklist to diagnose the most common Tea Timer Card
issues.

## Missing or incorrect entity id

- **Symptom:** Card shows “Entity not found” or displays the wrong timer.
- **Diagnosis:**
  1. Open **Settings → Devices & services → Helpers** and confirm the timer helper exists.
  2. Copy the exact entity id (for example `timer.kitchen_tea`).
  3. Inspect the Lovelace configuration and verify the `entity` value matches.
- **Fix:** Update the card configuration and reload the dashboard. The card reconnects automatically
  when the entity id is corrected.

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

## Still stuck?

- Review the [FAQ](faq.md) for quick answers.
- Ask a question on the project’s issue tracker—include steps to reproduce and any console/log output.
