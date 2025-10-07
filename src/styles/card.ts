import { css } from "lit";

export const cardStyles = css`
  :host {
    color-scheme: light dark;
    color: var(--primary-text-color, #1f2933);
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
    gap: 4px;
  }

  .title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }

  .entity {
    font-size: 0.875rem;
    color: var(--secondary-text-color, #52606d);
    word-break: break-word;
  }

  .subtitle {
    font-size: 0.85rem;
    color: var(--secondary-text-color, #52606d);
    margin: -8px 0 0;
  }

  .dial-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  tea-timer-dial {
    width: 100%;
  }

  .dial-tooltip {
    font-size: 0.8rem;
    color: var(--secondary-text-color, #52606d);
    background: rgba(0, 0, 0, 0.08);
    padding: 6px 12px;
    border-radius: 999px;
  }

  .status-pill {
    align-self: flex-start;
    border-radius: 999px;
    padding: 4px 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: var(--chip-background-color, rgba(0, 0, 0, 0.04));
    color: var(--secondary-text-color, #52606d);
  }

  .status-pill.status-running {
    background: rgba(0, 122, 255, 0.12);
    color: var(--primary-text-color, #1f2933);
  }

  .status-pill.status-paused {
    background: rgba(250, 204, 21, 0.16);
    color: var(--warning-color, #a86a13);
  }

  .status-pill.status-finished {
    background: rgba(73, 190, 125, 0.16);
    color: var(--primary-text-color, #1f2933);
  }

  .status-pill.status-disconnected {
    background: rgba(250, 204, 21, 0.2);
    color: var(--warning-color, #a86a13);
  }

  .status-pill.status-error {
    background: rgba(191, 26, 47, 0.16);
    color: #8a1c1c;
  }

  .status-pill.status-unavailable {
    background: rgba(128, 128, 128, 0.14);
  }

  .interaction {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .extend-controls {
    display: flex;
    justify-content: center;
  }

  .extend-button {
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.2));
    border-radius: 999px;
    padding: 6px 14px;
    background: var(--chip-background-color, var(--mdc-chip-background-color));
    color: var(--chip-text-color, var(--mdc-chip-label-ink-color));
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
    min-height: 40px;
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

  .interaction .presets {
    order: 1;
  }

  .interaction .dial-wrapper {
    order: 0;
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
    margin: 16px 0;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(191, 26, 47, 0.12);
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
    .status-pill {
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
    padding: 16px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 260px;
    width: 100%;
  }

  .confirm-message {
    margin: 0;
    font-size: 0.95rem;
    color: var(--primary-text-color, #1f2933);
  }

  .confirm-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .confirm-actions button {
    border: none;
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 0.9rem;
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

  .state-banner {
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .state-banner-info {
    background: rgba(0, 122, 255, 0.12);
    color: var(--primary-text-color, #1f2933);
  }

  .state-banner-warn {
    background: rgba(250, 204, 21, 0.18);
    color: var(--warning-color, #a86a13);
  }

  .state-banner-error {
    background: rgba(191, 26, 47, 0.12);
    color: #8a1c1c;
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
`;
