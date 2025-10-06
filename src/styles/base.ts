import { css } from "lit";

export const baseStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
    color: var(--ttc-fg, var(--primary-text-color, #1f2933));
    font-family: var(--ha-card-header-font-family, "Roboto", "Noto", sans-serif);
  }

  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
`;
