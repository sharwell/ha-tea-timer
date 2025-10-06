# Automate on `timer.finished`

Tea Timer Card shows a **Done** overlay when Home Assistant emits `timer.finished`. Attach your own
automations to play a chime, flash lights, or send notifications.

## Prerequisites

- A timer helper entity (for example `timer.kitchen_tea`).
- Tea Timer Card installed and bound to that entity.
- Home Assistant automation editor access (UI or YAML).

## Step-by-step: notification automation

1. Open **Settings → Automations & Scenes**.
2. Click **Create automation → From scratch**.
3. Set a name such as **Tea timer finished – notify**.
4. Add a trigger with **Event** type, event type `timer.finished`, and set the event data to the YAML
   snippet below.

```yaml
entity_id: timer.kitchen_tea
```

5. Add an action. The example below sends a persistent notification:

```yaml
service: persistent_notification.create
data:
  title: Tea timer finished
  message: |
    Timer finished at {{ trigger.event.data.finished_at }}.
    Remaining: {{ state_attr('timer.kitchen_tea', 'remaining') | default('unknown') }}
```

6. Save the automation.

Start a brew from the Tea Timer Card and let it finish. You should receive the notification at the
same moment the card displays **Done**.

## Example: shared automation for two timers

Use a condition to branch based on the entity that triggered the finish:

```yaml
alias: Tea timers – finish handler
triggers:
  - platform: event
    event_type: timer.finished
    event_data:
      entity_id:
        - timer.kitchen_tea
        - timer.living_room_tea
actions:
  - choose:
      - conditions:
          - condition: template
            value_template: "{{ trigger.event.data.entity_id == 'timer.kitchen_tea' }}"
        sequence:
          - service: notify.family
            data:
              message: Kitchen tea is ready!
      - conditions:
          - condition: template
            value_template: "{{ trigger.event.data.entity_id == 'timer.living_room_tea' }}"
        sequence:
          - service: light.turn_on
            target:
              entity_id: light.living_room_lamp
            data:
              flash: long
  - service: logbook.log
    data:
      name: Tea Timer Card
      message: "{{ trigger.event.data.entity_id }} finished at {{ trigger.event.data.finished_at }}"
mode: parallel
```

## Manual testing checklist

1. **Normal finish:** Start a 10 s brew and wait. Verify the automation fires once.
2. **Restart mid-run:** Restart a running timer. Only the completion after the restart should fire.
3. **Cancel:** Call `timer.cancel`; no automation should run.
4. **Multi-device:** Start the timer from a second device. Automation still fires once.
5. **Home Assistant restart:** Start a brew, restart Home Assistant before it finishes, and note that
   no `timer.finished` event is replayed. Consider a startup automation if you need catch-up logic.

## Edge cases & guidance

- Home Assistant does **not replay** missed `timer.finished` events after restarts. If this matters,
  add an automation on `homeassistant.start` to inspect timers with `remaining` less than or equal to
  zero.
- Pausing and later resuming a brew may emit `timer.restarted` (native pause) or `timer.started`
  (compatibility mode) as the timer continues, but the brew still produces a single
  `timer.finished` event at the true end. Keep automations keyed to `timer.finished` for
  deterministic behavior.
- Restarting the timer via the card issues `timer.cancel` followed by `timer.start`. Only the final
  finish fires the event, so your automation will not run twice.
- Always filter on `event_data.entity_id` to avoid triggering from unrelated timers.
- Ultra-short runs (≤1 s) still emit `timer.finished`; consider debouncing if you chain multiple
  actions.

## Troubleshooting

- Use **Developer Tools → Events** to listen for `timer.finished` while testing.
- Check the automation trace if an action does not execute.
- Review [Troubleshooting](../troubleshooting.md#automations-not-firing) for additional guidance.
