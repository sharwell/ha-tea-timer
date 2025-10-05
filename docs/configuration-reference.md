# Configuration reference

Every Tea Timer Card instance is defined with YAML (in Lovelace or the UI editor). This reference
covers each supported option, its default, and example uses. Options marked **Required** must be
provided for the card to load.

## Card-level options

### `type` — **Required**

- **Description:** Identifies the custom card. Lovelace sets this automatically when you pick the
  card from the UI selector.
- **Default:** `custom:tea-timer-card`
- **Example:** Always leave the default unless you are debugging multiple card versions locally.

### `entity` — **Required**

- **Description:** Home Assistant `timer` entity the card controls and listens to.
- **Default:** None. The card shows an error until a valid timer id is supplied.
- **Example:** `entity: timer.kitchen_tea` links the card to a kitchen timer helper.

### `title`

- **Description:** Text shown at the top of the card.
- **Default:** No title (the entity id appears in smaller text instead).
- **Example:** `title: Kitchen Tea Timer` helps differentiate multiple cards on the same view.

### `presets`

- **Description:** List of preset buttons a user can select. Each preset needs a `label` and a
  `durationSeconds` value greater than zero.
- **Default:** No presets. The dial still works, but users choose durations manually.
- **Example:**

  ```yaml
  presets:
    - label: Green Tea
      durationSeconds: 120
    - label: Oolong
      durationSeconds: 180
    - label: Herbal
      durationSeconds: 300
  ```

  Add up to eight presets to cover your favorite brews.

### `defaultPreset`

- **Description:** Preset that is selected automatically when the card loads.
- **Default:** The first preset, if any.
- **Example:** `defaultPreset: Oolong` loads the preset with that label. Alternatively, use
  `defaultPreset: 2` to select the third preset in the list.

### `minDurationSeconds`

- **Description:** Smallest allowed duration for the dial when the timer is idle.
- **Default:** `15` seconds.
- **Example:** `minDurationSeconds: 30` ensures quick taps never start a brew shorter than 30 seconds.

### `maxDurationSeconds`

- **Description:** Largest allowed duration for the dial.
- **Default:** `1200` seconds (20 minutes).
- **Example:** `maxDurationSeconds: 900` limits the dial to a 15-minute maximum brew.

### `stepSeconds`

- **Description:** Increment used when dragging the dial or pressing arrow keys.
- **Default:** `5` seconds.
- **Example:** `stepSeconds: 10` creates a coarser dial that moves in 10-second increments.

### `confirmRestart`

- **Description:** Adds a confirmation dialog before restarting a running timer. Helps prevent
  accidental restarts when multiple people use the timer.
- **Default:** `false` (restarts immediately).
- **Example:** `confirmRestart: true` forces a confirmation dialog before canceling a brew in
  progress.

### `finishedAutoIdleMs`

- **Description:** Duration that the **Done** overlay remains before the card returns to Idle.
- **Default:** `5000` milliseconds (5 seconds).
- **Example:** `finishedAutoIdleMs: 7000` keeps the completion overlay visible for seven seconds so
  everyone can see it.

### `disableClockSkewEstimator`

- **Description:** When `false` (default) the card smooths remaining-time estimates between Home
  Assistant updates. Set to `true` to disable the estimator and rely solely on the browser clock.
- **Default:** `false` (estimator enabled).
- **Example:** `disableClockSkewEstimator: true` is useful if you run a kiosk that routinely loses
  WebSocket updates and you prefer the timer to pause instead of estimating.

### `showPlusButton`

- **Description:** Shows the **+1 minute** extend control while the timer is running. When disabled the
  card hides the button for that card instance.
- **Default:** `true` (rendered whenever the timer is running and available).
- **Example:** `showPlusButton: false` removes the extend button for a timer you never want to extend
  mid-brew.

### `plusButtonIncrementS`

- **Description:** Number of seconds added each time the extend button is activated.
- **Default:** `60` seconds.
- **Example:** `plusButtonIncrementS: 30` creates a **+0:30** chip for smaller top-ups.

### `maxExtendS`

- **Description:** Maximum total seconds that can be added via the extend button during a single brew.
- **Default:** Unlimited.
- **Example:** `maxExtendS: 180` allows at most three 60-second extensions before the card refuses
  further adds and announces “Cannot add more time.”

## Preset object options

Each entry inside `presets` uses the following keys:

### `label` — **Required**

- **Description:** Text shown on the preset chip and in announcements.
- **Example:** `label: White Tea`

### `durationSeconds` — **Required**

- **Description:** Length of the brew in seconds. Must be a positive number.
- **Example:** `durationSeconds: 180` creates a three-minute preset.

## Complete example

```yaml
type: custom:tea-timer-card
title: Office Tea Timer
entity: timer.office_tea
presets:
  - label: Sencha
    durationSeconds: 90
  - label: Assam
    durationSeconds: 180
  - label: Herbal Blend
    durationSeconds: 300
defaultPreset: Assam
minDurationSeconds: 30
maxDurationSeconds: 1200
stepSeconds: 5
confirmRestart: false
finishedAutoIdleMs: 5000
```

> Tip: Need YAML for testing or onboarding? Start with the
> [`single-timer example`](../examples/lovelace/tea-timer-card-basic.yaml) or the
> [`two-timer layout`](../examples/lovelace/tea-timer-card-two-timers.yaml).
