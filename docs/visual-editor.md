# Configure the Tea Timer Card with the Visual Editor

Home Assistant's Lovelace editor now includes the Tea Timer card in the **Add card** picker. This page walks through the guided configuration flow and highlights the options exposed in the graphical editor.

## Requirements

- Tea Timer Card v0.2.0 or later
- Home Assistant 2023.12 or newer with Lovelace dashboards
- A `timer` helper for each brew you want to control

## Add the card from the picker

1. Open any dashboard, choose **Edit dashboard**, and click **Add card**.
2. Search for **Tea Timer**. The entry includes a short description and links back to this documentation.
3. Select the card to open the visual editor. A stub configuration loads immediately with:
   - A placeholder timer entity (`timer.example_tea`)
   - Three sample presets (Green 2:00, Black 4:00, Herbal 5:00)
   - The dial preview so you can see changes without writing YAML

Replace the entity with one of your timers to connect the card to a real brew.

## Configure presets and defaults

The main form covers the most common options:

- **Title** — Optional heading displayed above the dial.
- **Timer entity** — Entity selector filtered to `timer` helpers.
- **Default preset** — Label or index applied when the card loads (leave blank to use the first preset).
- **Presets** — Each row includes a label and a duration selector. The duration picker accepts minutes and seconds, and you can add or remove rows as needed.

Changes appear immediately in the preview. The YAML panel stays in sync, so you can switch views at any time.

## Advanced options

Expand **Advanced options** to adjust the remaining YAML fields:

- **Minimum duration (seconds)** — Lower bound for dial drags.
- **Maximum duration (seconds)** — Upper bound for dial drags.
- **Dial step (seconds)** — Increment when adjusting custom durations.
- **Confirm before restarting** — Prompt before restarting a finished brew.
- **Finished overlay auto-hide (ms)** — Delay before the “Done” overlay dismisses itself.
- **Disable clock skew estimator** — Opt out of network clock smoothing (for troubleshooting).

Leave any field blank to fall back to the defaults documented in [configuration-reference.md](configuration-reference.md).

## YAML parity and validation

- Unknown YAML keys are preserved across Visual ↔ YAML switches so you can keep manual tweaks.
- Invalid combinations (for example, negative durations) surface through the existing `assertConfig` validation. Fix the values in the form to re-enable the visual editor.
- The editor never changes runtime behavior—only the configuration surface—so dashboards using YAML continue to work as before.

## Next steps

- Review the [Quick Start](quick-start.md) to wire up your first dashboard.
- Dive into [Presets and durations](presets-and-durations.md) for advanced brewing strategies.
- Share feedback or report issues on [GitHub](https://github.com/sharwell/ha-tea-timer/issues).
