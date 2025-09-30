# Automate on `timer.finished`

The Tea Timer Card relies on Home Assistant’s native [`timer` integration](https://www.home-assistant.io/integrations/timer/).
When a timer completes, Home Assistant emits a `timer.finished` event that includes the
`entity_id` and `finished_at` timestamp. You can hook your own automations into this event to play
sounds, flash lights, or send notifications.

This guide walks through a lightweight QA automation you can enable while evaluating the card. It
also calls out the edge cases that the card purposely leaves to Home Assistant.

## Demo QA automation

The card’s playground (`npm run dev`) now includes a demo automation logger. Click **Emit finished
event** to fire `timer.finished`; the logger records the event and the time it took for each card on
the page to show the "Done" overlay. The delay stays under 500 ms so you can validate that the UI
and automation fire in lock-step.

The same pattern works in Home Assistant. The YAML below creates a persistent notification any time
`timer.kitchen_tea` finishes:

```yaml
alias: QA – Tea timer finished
triggers:
  - platform: event
    event_type: timer.finished
    event_data:
      entity_id: timer.kitchen_tea
actions:
  - service: persistent_notification.create
    data:
      title: Tea timer finished
      message: |
        Timer finished at {{ trigger.event.data.finished_at }}.
        Remaining: {{ state_attr('timer.kitchen_tea', 'remaining') | default('unknown') }}
mode: single
```

### What to expect

Run through the following scenarios to confirm the integration behaves as expected:

1. **Legitimate finish** – start a 5 s timer. When it completes you should see one notification and
   the card will display "Done" for five seconds.
2. **Restart mid-run** – start a 10 s timer and restart it around the 6 s mark. Only the final
   completion triggers the automation.
3. **Cancel** – start a timer and cancel it. The automation does not run.
4. **Multi-view sync** – open the dashboard on two devices. Start and finish a timer from either
   device; both sessions show the "Done" overlay together and the automation fires once.
5. **Unavailable entity** – set the timer entity to unavailable (e.g., remove it or disable the
   integration). The card surfaces the error and the automation does not run.
6. **Ultra-short runs** – run a one-second timer. The automation fires once without overlay flicker.

The demo logger in `npm run dev` mirrors these scenarios so you can rehearse locally before testing
inside Home Assistant.

## Limitations and guidance

- Home Assistant does **not replay** missed finishes after a restart. If a timer would have expired
  while Home Assistant was offline, `timer.finished` is not fired on startup. Consider adding a
  startup automation that inspects `states.timer` to detect expired timers if you need to handle
  that case.
- The card restarts a running timer by calling `timer.cancel` followed by `timer.start` so you always
  get the `timer.finished` event only for the latest brew.
- When a timer is cancelled or restarted before finishing, Home Assistant **does not** emit
  `timer.finished`. Any automation driven by that event will also skip those runs.
- Automations should always filter on `event_data.entity_id` to avoid triggering from unrelated
  timers. The `finished_at` stamp is helpful for logging or calculating drift.
- The card delegates all actions (chimes, lights, etc.) to Home Assistant automations. It does not
  play sounds, vibrate, or retry missed finishes on the client.
