import { css } from "lit";

export const baseStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
    color: var(--primary-text-color, #1f2933);
    font-family: var(--ha-card-header-font-family, "Roboto", "Noto", sans-serif);
  }

  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
`;
