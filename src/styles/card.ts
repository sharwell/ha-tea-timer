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

  .dial {
    width: 160px;
    height: 160px;
    border-radius: 50%;
    border: 3px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    align-self: center;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--secondary-text-color, #52606d);
    font-size: 0.875rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
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
