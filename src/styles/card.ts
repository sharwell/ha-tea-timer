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
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 16px;
    padding: 6px 12px;
    background: var(--chip-background-color, rgba(0, 0, 0, 0.04));
    color: inherit;
    font-size: 0.85rem;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: not-allowed;
  }

  .preset-chip[disabled] {
    opacity: 0.6;
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
`;
