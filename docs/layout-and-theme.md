# Layout & Theme

This card now exposes deterministic layout rules and CSS variable theming hooks so you can tune it for dense dashboards or colorful preset collections without breaking accessibility.

## Layout density

The `layoutDensity` option controls whether the card renders in regular or compact mode. When set to `"auto"` (the default), the runtime selects a density based on the inner width/height of the card using the same breakpoints defined in [`src/layout/responsive.ts`](../src/layout/responsive.ts):

| Width | Density |
| --- | --- |
| `< 260px` | Compact |
| `260-359px` | Compact (Regular allowed if height ≥ 360px) |
| `≥ 360px` | Regular |

Compact density reduces dial size and ring thickness and is designed for two rows of presets. If the dial would drop below 160px the remaining time text moves to the header so the progress ring stays legible.

### Example configuration

```yaml
type: custom:tea-timer-card
entity: timer.evening_tea
layoutDensity: compact
```

## Theming tokens

The card exposes a stable set of CSS custom properties prefixed with `--ttc-`. They inherit from the active Home Assistant theme when not overridden. You can override any subset by providing a `themeTokens` object in the card configuration.

| Token | Purpose |
| --- | --- |
| `--ttc-bg` | Card background |
| `--ttc-fg` | Default text color |
| `--ttc-accent` | Accent controls |
| `--ttc-dial-track` | Dial track ring |
| `--ttc-dial-progress` | Active dial progress |
| `--ttc-chip-bg` | Preset chip background |
| `--ttc-chip-fg` | Preset chip text |
| `--ttc-chip-selected-bg` | Selected preset background |
| `--ttc-chip-selected-fg` | Selected preset text |
| `--ttc-danger` | Error/warning text |
| `--ttc-focus-ring` | Focus outline color |

```yaml
type: custom:tea-timer-card
entity: timer.matcha
layoutDensity: auto
themeTokens:
  --ttc-bg: "#1f2933"
  --ttc-fg: "#f9fafb"
  --ttc-accent: "#7c3aed"
```

### Per-preset colors and icons

Each preset entry now accepts optional `icon` and `color` keys. The color is run through the [WCAG-aware contrast helper](../src/theme/colors.ts) which picks an appropriate foreground (`#000` or `#fff`) and will gently adjust the background lightness when required to reach a 4.5:1 contrast ratio.

```yaml
presets:
  - label: Sencha
    durationSeconds: 120
    icon: mdi:leaf
    color: "#1abc9c"
  - label: Earl Grey
    durationSeconds: 240
    icon: mdi:cup
    color: "#7c3aed"
```

If a color cannot reach the target contrast, the card falls back to the neutral chip background and surfaces a warning in the configuration preview rather than on the running card.

## Related files

* Layout rules: [`src/layout/responsive.ts`](../src/layout/responsive.ts)
* Theme helpers: [`src/theme/colors.ts`](../src/theme/colors.ts), [`src/theme/tokens.ts`](../src/theme/tokens.ts)
* Preset styling pipeline: [`src/view/TeaTimerViewModel.ts`](../src/view/TeaTimerViewModel.ts)
