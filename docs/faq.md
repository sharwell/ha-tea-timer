# Frequently asked questions

## Can I pause a brew instead of restarting?

Not yet. The card intentionally exposes start and restart only to stay aligned with Home Assistant’s
`timer` helper. Pause/resume support is tracked separately and would require changes to the helper
itself.

## How do I play a sound when the timer finishes?

Attach an automation to `timer.finished`. The example in
[`docs/automations/finished.md`](automations/finished.md) shows how to trigger a notification, light,
or speaker.

## Why does the card show an estimated remaining time banner?

When Home Assistant omits the `remaining` attribute (often during reconnects), the card estimates the
countdown based on the last known duration. The banner disappears after the next authoritative
update. If you would rather bypass the estimator, set `disableClockSkewEstimator: true`; the countdown
will seed from the local clock with a ±1 s safety band until the next server update arrives.

## Can I run multiple timers on one dashboard?

Yes. Create separate timer helpers and assign each card a unique `entity` value. The
[`examples/lovelace/tea-timer-card-two-timers.yaml`](../examples/lovelace/tea-timer-card-two-timers.yaml)
file demonstrates the pattern.

## Does the card work without presets?

Absolutely. Leave the `presets` array empty to rely on the dial alone. The card still remembers the
last dialed duration between runs.

## How do I localize preset labels?

Preset labels come directly from your YAML configuration. Provide labels in your preferred language or
include emoji for quick recognition. Time formatting follows your Home Assistant locale.

## What happens after a Home Assistant restart?

Home Assistant restores the timer state but does not emit `timer.finished` events that were missed
while it was offline. The card reconnects, fetches the latest state, and continues counting down if
`remaining` is still positive.

## Where can I report issues or request features?

Open an issue on the project’s GitHub repository. Include your Home Assistant version, browser, card
configuration, and reproduction steps. For quick tips, check the [Troubleshooting](troubleshooting.md)
page first.
