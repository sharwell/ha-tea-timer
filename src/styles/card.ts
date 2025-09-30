import { css } from "lit";

export const cardStyles = css`
  .card {
    background: var(--ha-card-background, #fff);
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

  .status-pill.status-finished {
    background: rgba(73, 190, 125, 0.16);
    color: var(--primary-text-color, #1f2933);
  }

  .status-pill.status-unavailable {
    background: rgba(128, 128, 128, 0.14);
  }

  .estimation {
    font-size: 0.8rem;
    color: var(--warning-color, #a86a13);
    text-align: center;
    margin: 8px 0 0;
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
    background: var(--chip-background-color, rgba(0, 0, 0, 0.04));
    color: inherit;
    font-size: 0.85rem;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
  }

  .preset-chip:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.4);
  }

  .preset-chip.preset-selected {
    background: rgba(0, 122, 255, 0.12);
    border-color: rgba(0, 122, 255, 0.3);
    color: var(--primary-text-color, #1f2933);
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
    display: inline-block;
    margin-top: 4px;
    font-size: 0.8rem;
    color: var(--secondary-text-color, #52606d);
  }

  .empty-state {
    font-size: 0.9rem;
    color: var(--secondary-text-color, #52606d);
  }

  .note {
    font-size: 0.75rem;
    color: var(--secondary-text-color, #52606d);
    margin: 0;
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  }

  .help {
    font-size: 0.85rem;
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
    background: var(--ha-card-background, #fff);
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
    color: #fff;
  }

  .confirm-secondary {
    background: rgba(0, 0, 0, 0.08);
    color: var(--primary-text-color, #1f2933);
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
