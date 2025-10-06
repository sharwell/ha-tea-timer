# Accessibility & reduced motion

Tea Timer Card is designed to work with screen readers, keyboards, and reduced-motion preferences.
Use these notes to verify behavior during accessibility reviews.

## Focus order

1. Title (if present) is skipped to keep focus on interactive elements.
2. Preset chips appear left-to-right.
3. The card body (start/restart surface) is last.

Keyboard users can cycle through presets with **Tab**/**Shift+Tab** and activate the focused control
with **Space** or **Enter**. The card exposes ARIA labels that include the preset name and formatted
duration (for example, “Preset Green Tea – 2 minutes”).

## Slider semantics

- The dial uses `role="slider"` while idle and publishes `aria-valuemin`, `aria-valuemax`, and
  `aria-valuenow` reflecting the configured bounds and duration.
- Arrow keys adjust the value by `stepSeconds`; **PageUp/PageDown** add or subtract 30 seconds; the
  **Home** and **End** keys jump to the minimum and maximum bounds.
- While the timer runs or is paused the dial switches to a read-only progress indicator: the handle hides, the
  slider reports `aria-readonly="true"` and `aria-disabled="true"`, and the element leaves the tab
  order so screen readers skip it until the card returns to Idle.

## Live regions

- Remaining time announcements are throttled to avoid overwhelming assistive technology
  (30 s ≥ 2:00, 10 s ≥ 1:00, 5 s ≥ 0:20, 1 s < 0:10).
- Start, restart, finish, and queued preset messages use a polite live region so they do not interrupt
  ongoing announcements.
- Error banners use `role="alert"` to ensure critical issues (such as missing entities) are announced
  immediately.

## Reduced motion & high contrast

- When the operating system reports `prefers-reduced-motion: reduce`, the card disables dial sweep
  animations and replaces spinners with static indicators.
- High-contrast and forced-colors modes rely on system colors for primary buttons and text to maintain
  readability.
- The finished overlay fades in/out without blur effects so it remains legible with contrast themes.

## Screen reader testing checklist

1. Navigate through presets and the card body using only the keyboard.
2. Start a brew and confirm you hear a single announcement for the selected preset and duration.
3. Queue a different preset mid-brew and verify the “Next preset” announcement.
4. Wait for the brew to finish; listen for the completion message.
5. Simulate an unavailable entity (disable the timer helper) and confirm the alert is announced.

## Troubleshooting accessibility issues

- **No announcements:** Check your screen reader verbosity and ensure the browser allows live region
  updates. The card avoids aria-live="assertive" to reduce interruption.
- **Focus trapped:** Confirm custom dashboards do not wrap the card in containers that alter focus
  order (such as negative `tabindex`).
- **Animations still playing:** Some browsers cache motion preferences. Reload the page or toggle the
  OS setting to refresh the media query.
