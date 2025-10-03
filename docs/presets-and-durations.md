# Presets and durations

Presets keep your favorite brew times one tap away. Use this guide to plan and maintain presets that
match your household’s routine.

## Designing presets

1. **List your beverages.** Capture the teas, coffees, or recipes you brew regularly.
2. **Assign target durations.** Convert minutes and seconds into `durationSeconds` values.
3. **Order by frequency.** Place the most-used presets first so they stay within easy reach.
4. **Keep labels short.** Aim for one or two words so the preset chip remains readable on phones.
5. **Limit to eight.** The card enforces an upper bound of eight presets to preserve layout and
   accessibility.

> Tip: You can always start with three presets and expand later. The dial remains available for
> ad-hoc brews.

## Mixing presets with dial bounds

Dial bounds (`minDurationSeconds`, `maxDurationSeconds`, `stepSeconds`) shape how freeform brews
behave alongside presets:

- Set `minDurationSeconds` slightly below your shortest preset to leave room for experimentation.
- Keep `maxDurationSeconds` at or above your longest preset so queued presets never clamp.
- Reduce `stepSeconds` to `1` or `2` if you brew espresso or teas that need fine-grained control.

Example configuration with fine control for espresso testing:

```yaml
minDurationSeconds: 10
maxDurationSeconds: 300
stepSeconds: 1
presets:
  - label: Ristretto
    durationSeconds: 30
  - label: Espresso
    durationSeconds: 40
  - label: Lungo
    durationSeconds: 55
```

## Queueing presets during a brew

Selecting a preset while the timer runs does not interrupt the current brew. Instead:

1. The card announces the next preset (for example, “Next: Herbal 5:00”).
2. The queued preset appears in the subtitle to signal the pending change.
3. When you restart the timer—either manually or when it finishes—the queued preset becomes active.

This behavior keeps the running brew predictable while still letting you line up the next tea.

## Sharing presets across multiple cards

Using the same preset definitions across rooms keeps the experience consistent. Place your preset
YAML in a [Lovelace dashboard template](https://www.home-assistant.io/lovelace/dashboards-and-views/)
or copy from [`examples/lovelace/tea-timer-card-two-timers.yaml`](../examples/lovelace/tea-timer-card-two-timers.yaml)
which shows two cards with shared presets and entity overrides.

## Maintaining presets over time

- **Seasonal updates:** Adjust presets when you rotate blends so the defaults stay relevant.
- **Community feedback:** Encourage household members to suggest changes—shorter herbal preset,
  longer cold brew, etc.—and record updates in your version control or automation notes.
- **Backup:** Store your Lovelace YAML in source control or the Home Assistant configuration backup
  so the presets survive rebuilds.
