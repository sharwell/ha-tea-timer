# Quick Start — Tea Timer Card

Get a Tea Timer Card up and running in Home Assistant in under ten minutes. This guide assumes you
have administrative access to Home Assistant and can install custom Lovelace cards.

## 1. Create a timer helper

1. Open **Settings → Devices & services → Helpers**.
2. Select **Create helper → Timer**.
3. Name it something memorable such as **Kitchen Tea Timer**.
4. Leave the duration empty; the card will set it when you start a brew.
5. Note the generated entity id (for example `timer.kitchen_tea`).

## 2. Install the Tea Timer Card

### Recommended: HACS

1. Install [HACS](https://hacs.xyz/docs/setup/download/) if you have not already.
2. In **HACS → Integrations**, open the overflow menu and choose **Custom repositories**.
3. Add `https://github.com/sharwell/ha-tea-timer` with the **Lovelace** category.
4. Search for **Tea Timer Card** and click **Download**.
5. When prompted, reload your browser or clear the Lovelace resources cache.

### Manual build

You can build the card locally if you prefer to review the bundle before installing it.

```bash
npm ci
npm run build
```

Copy `dist/tea-timer-card.js` into your Home Assistant `www` folder and add a Lovelace resource:

```yaml
url: /local/tea-timer-card.js
type: module
```

Reload your browser after updating Lovelace resources.

## 3. Add the card to your dashboard

The Tea Timer Card is configurable from the Lovelace UI or YAML editor.

### Lovelace UI editor

1. Open the dashboard where you want the card.
2. Click **Edit dashboard → Add card → Custom: Tea Timer Card**.
3. Fill in at least the **Entity** field with your timer helper (`timer.kitchen_tea`).
4. (Optional) Set a **Title** and add presets under **Presets**.
5. Save the card.

### YAML example

Paste the following configuration into the YAML editor. Replace the `entity` value with your timer.

```yaml
type: custom:tea-timer-card
title: Kitchen Tea Timer
entity: timer.kitchen_tea
defaultPreset: Black Tea
presets:
  - label: Green Tea
    durationSeconds: 120
  - label: Oolong Tea
    durationSeconds: 180
  - label: Black Tea
    durationSeconds: 240
```

## 4. Start your first brew

1. Tap a preset to select its duration, or turn the dial to a custom time.
2. Activate the card (tap/click/press **Space** or **Enter**) to start the timer.
3. Watch the countdown; the dial locks while the timer runs so you cannot change it accidentally.
4. When the timer finishes, the card displays a five-second **Done** overlay.
5. Tap the card again to restart with the same duration, or pick a different preset.

## 5. Verify the finished event (optional)

Open **Developer Tools → Events** and listen for `timer.finished`. When the timer completes you will
see an event for your entity. Use this as a hook for automations—see
[Automate on `timer.finished`](automations/finished.md) for an end-to-end example.

## Next steps

- Review the [Configuration reference](configuration-reference.md) for every available option.
- Explore [Presets and durations](presets-and-durations.md) to design presets for your favorite
  brews.
- Learn how the card behaves across states in [State & actions](state-and-actions.md).
- Configure notifications or lights in [Automate on `timer.finished`](automations/finished.md).
