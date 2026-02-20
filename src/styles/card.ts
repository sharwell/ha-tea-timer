import { css } from "lit";

export const cardStyles = css`
  :host {
    color-scheme: light dark;
    color: var(--primary-text-color, #1f2933);
    --tea-timer-dial-size: 228px;
    --mdc-theme-primary: var(--primary-color, #1f2933);
    --mdc-theme-on-primary: var(
      --text-on-primary-color,
      var(--text-primary-color, #ffffff)
    );
    --mdc-theme-surface: var(
      --ha-card-background,
      var(--card-background-color, #ffffff)
    );
    --mdc-theme-on-surface: var(--primary-text-color, #1f2933);
    --mdc-chip-background-color: var(--mdc-theme-surface);
    --mdc-chip-label-ink-color: var(--mdc-theme-on-surface);
  }

  ha-card,
  .card {
    background: var(--mdc-theme-surface);
    color: inherit;
    border-radius: var(--ha-card-border-radius, 12px);
    border: 1px solid var(--ha-card-border-color, rgba(0, 0, 0, 0.12));
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: relative;
  }

  .header {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }

  .subtitle {
    font-size: 0.85rem;
    color: var(--secondary-text-color, #52606d);
    margin: 0;
    line-height: 1.4;
  }

  .subtitle-inline {
    margin-top: -2px;
  }

  .dial-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    position: relative;
  }

  tea-timer-dial {
    width: 100%;
  }

  .dial-tooltip {
    position: absolute;
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    font-size: 0.8rem;
    color: var(--secondary-text-color, #52606d);
    background: rgba(0, 0, 0, 0.08);
    padding: 6px 12px;
    border-radius: 999px;
    pointer-events: none;
    transition: opacity 120ms ease;
  }

  .dial-tooltip-hidden {
    opacity: 0;
    visibility: hidden;
  }

  .interaction {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .interaction-shell {
    position: relative;
  }

  .dial-and-rail {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
  }

  .action-rail {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 10px;
    min-width: 96px;
  }

  .action-rail .pause-resume-controls,
  .action-rail .extend-controls {
    min-height: 0;
    justify-content: stretch;
  }

  .action-rail .pause-resume-button,
  .action-rail .extend-button {
    width: 100%;
  }

  .extend-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 40px;
  }

  .extend-button {
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2));
    border-radius: 999px;
    padding: 8px 16px;
    background: var(--chip-background-color, var(--mdc-chip-background-color));
    color: var(--chip-text-color, var(--mdc-chip-label-ink-color));
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
    min-height: 44px;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
  }

  .extend-button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .extend-button:focus-visible {
    outline: 3px solid var(--focus-ring-color, rgba(0, 122, 255, 0.6));
    outline-offset: 2px;
    box-shadow: none;
  }

  .extend-controls[data-busy="true"] .extend-button {
    cursor: progress;
  }

  .pause-resume-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 44px;
  }

  .pause-resume-button {
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2));
    border-radius: 999px;
    padding: 6px 18px;
    background: var(--chip-background-color, var(--mdc-chip-background-color));
    color: var(--chip-text-color, var(--mdc-chip-label-ink-color));
    font-size: 0.95rem;
    min-height: 44px;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
  }

  .pause-resume-button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .pause-resume-button:focus-visible {
    outline: 3px solid var(--focus-ring-color, rgba(0, 122, 255, 0.6));
    outline-offset: 2px;
    box-shadow: none;
  }

  .pause-resume-controls[data-busy="true"] .pause-resume-button {
    cursor: progress;
  }

  .estimation {
    font-size: 0.8rem;
    color: var(--warning-color, #a86a13);
    text-align: center;
    margin: 8px 0 0;
  }

  .presets-section {
    display: flex;
    flex-direction: column;
  }

  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .preset-chip {
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2));
    border-radius: 16px;
    padding: 6px 12px;
    background: var(--chip-background-color, var(--mdc-chip-background-color));
    color: var(--chip-text-color, var(--mdc-chip-label-ink-color));
    font-size: 0.85rem;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
    min-height: 44px;
    justify-content: center;
  }

  .preset-chip[disabled] {
    opacity: 0.5;
    cursor: default;
  }

  .preset-chip:focus-visible {
    outline: 3px solid var(--focus-ring-color, rgba(0, 122, 255, 0.6));
    outline-offset: 2px;
    box-shadow: none;
  }

  .preset-chip.preset-selected {
    background: var(--primary-color, #1f2933);
    border-color: var(--primary-color, #1f2933);
    color: var(--text-on-primary-color, var(--mdc-theme-on-primary));
  }

  .preset-chip.preset-queued {
    border-style: dashed;
  }

  .preset-label {
    font-weight: 600;
  }

  .preset-duration {
    font-variant-numeric: tabular-nums;
  }

  .preset-custom {
    display: block;
    margin-top: 4px;
    font-size: 0.8rem;
    line-height: 1.4;
    min-height: calc(0.8rem * 1.4);
    color: var(--secondary-text-color, #52606d);
    opacity: 1;
    visibility: visible;
    transition: opacity 120ms ease;
  }

  .preset-custom-hidden {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .preset-custom {
      transition: none;
    }
  }

  .primary-action {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 12px 16px;
    border-radius: 12px;
    border: 2px solid var(--primary-color, #1f2933);
    background: var(--primary-color, #1f2933);
    color: var(--text-on-primary-color, var(--mdc-theme-on-primary));
    font-weight: 600;
    font-size: 1rem;
    line-height: 1.2;
    min-height: 48px;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease, border-color 120ms ease,
      box-shadow 120ms ease;
  }

  .primary-action:hover {
    filter: brightness(1.05);
  }

  .primary-action:focus-visible {
    outline: 3px solid var(--focus-ring-color, rgba(0, 122, 255, 0.6));
    outline-offset: 3px;
  }

  .primary-action[aria-disabled="true"] {
    opacity: 0.7;
    cursor: default;
  }

  .primary-action[disabled] {
    opacity: 0.7;
    cursor: default;
  }

  .primary-action-duration {
    font-size: 0.85rem;
    font-weight: 500;
    opacity: 0.9;
  }

  .empty-state {
    font-size: 0.9rem;
    color: var(--secondary-text-color, #52606d);
  }

  .entity-error {
    margin: 0;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(255, 240, 243, 0.98);
    border: 1px solid rgba(191, 26, 47, 0.35);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.14);
    color: #8a1c1c;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .entity-error-message {
    margin: 0;
  }

  .errors {
    margin: 0 0 12px;
    padding: 12px;
    border-radius: 8px;
    background: rgba(191, 26, 47, 0.1);
    color: #8a1c1c;
    list-style: none;
  }

  .errors li + li {
    margin-top: 4px;
  }

  .action-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.78);
    backdrop-filter: blur(2px);
    font-weight: 600;
    color: var(--primary-text-color, #1f2933);
    pointer-events: none;
    text-align: center;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 3px solid rgba(0, 0, 0, 0.12);
    border-top-color: var(--info-color, rgba(0, 122, 255, 0.6));
    animation: tea-timer-spin 900ms linear infinite;
  }

  @keyframes tea-timer-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 1ms;
      animation-iteration-count: 1;
    }

    .preset-chip,
    .primary-action,
    .dial-wrapper,
    .state-banner-detail {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .primary-action {
      border-color: ButtonText;
      background: ButtonFace;
      color: ButtonText;
    }

    .preset-chip {
      border-color: ButtonText;
      background: ButtonFace;
      color: ButtonText;
    }
  }

  .confirm-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.45);
    padding: 16px;
    z-index: 2;
  }

  .confirm-surface {
    background: var(--mdc-theme-surface);
    border-radius: 12px;
    padding: 18px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 320px;
    width: 100%;
  }

  .confirm-message {
    margin: 0;
    font-size: 0.95rem;
    color: var(--primary-text-color, #1f2933);
  }

  .confirm-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }

  .confirm-actions button {
    border: none;
    border-radius: 8px;
    padding: 10px 14px;
    min-height: 44px;
    min-width: 96px;
    font-size: 0.95rem;
    cursor: pointer;
  }

  .confirm-primary {
    background: var(--primary-color, #1f2933);
    color: var(--text-on-primary-color, var(--mdc-theme-on-primary));
  }

  .confirm-secondary {
    background: var(--chip-background-color, var(--mdc-chip-background-color));
    color: var(--chip-text-color, var(--mdc-chip-label-ink-color));
  }

  .card-overlays {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
    z-index: 2;
  }

  .card-overlays > * {
    pointer-events: auto;
  }

  .state-banner-wrap {
    position: relative;
  }

  .state-banner {
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 0.85rem;
    line-height: 1.2;
    min-height: 40px;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(0, 0, 0, 0.14);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.14);
  }

  .state-banner-text {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .state-banner-detail-toggle {
    border: 1px solid rgba(0, 0, 0, 0.22);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.92);
    color: inherit;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 4px 10px;
    min-height: 28px;
    white-space: nowrap;
    cursor: pointer;
  }

  .state-banner-detail-toggle:focus-visible {
    outline: 3px solid var(--focus-ring-color, rgba(0, 122, 255, 0.6));
    outline-offset: 2px;
  }

  .state-banner-detail {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 6px);
    z-index: 2;
    border-radius: 10px;
    padding: 10px 12px;
    background: var(--mdc-theme-surface, var(--ha-card-background, #ffffff));
    color: var(--primary-text-color, #1f2933);
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2));
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
    font-size: 0.84rem;
    line-height: 1.35;
    opacity: 1;
    transform: translateY(0);
    transition: opacity 120ms ease, transform 120ms ease;
  }

  .state-banner-detail-hidden {
    opacity: 0;
    transform: translateY(-4px);
    visibility: hidden;
    pointer-events: none;
  }

  .state-banner-info {
    background: rgba(232, 243, 255, 0.98);
    color: #12365d;
    border-color: rgba(0, 122, 255, 0.36);
  }

  .state-banner-warn {
    background: rgba(255, 246, 219, 0.98);
    color: #7f540f;
    border-color: rgba(250, 204, 21, 0.45);
  }

  .state-banner-error {
    background: rgba(255, 240, 243, 0.98);
    color: #8a1c1c;
    border-color: rgba(191, 26, 47, 0.35);
  }

  .toast {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: 16px;
    padding: 8px 14px;
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: 500;
    color: #fff;
    z-index: 3;
  }

  .toast-error {
    background: rgba(191, 26, 47, 0.9);
  }

  .toast-info {
    background: rgba(0, 0, 0, 0.75);
  }

  @media (max-width: 340px) {
    .dial-and-rail {
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
    }

    .action-rail {
      flex-direction: row;
      align-items: center;
      justify-content: center;
      min-width: 0;
    }

    .action-rail .pause-resume-controls,
    .action-rail .extend-controls {
      min-width: 110px;
    }
  }

  @media (max-width: 420px) {
    :host {
      --tea-timer-dial-size: 220px;
    }
  }

  @media (min-width: 520px) {
    :host {
      --tea-timer-dial-size: 236px;
    }
  }
`;
