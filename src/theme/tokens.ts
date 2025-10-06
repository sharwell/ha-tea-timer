import { ensureAccessibleText } from "./colors";

export interface ThemeTokensConfig {
  [key: string]: string | undefined;
}

export interface ThemeTokensResult {
  values: Record<string, string>;
}

export const TOKEN_KEYS = [
  "--ttc-bg",
  "--ttc-fg",
  "--ttc-accent",
  "--ttc-dial-track",
  "--ttc-dial-progress",
  "--ttc-chip-bg",
  "--ttc-chip-fg",
  "--ttc-chip-selected-bg",
  "--ttc-chip-selected-fg",
  "--ttc-danger",
  "--ttc-focus-ring",
] as const;

export type ThemeTokenKey = (typeof TOKEN_KEYS)[number];

const DEFAULT_TOKENS: Record<ThemeTokenKey, string> = {
  "--ttc-bg": "var(--ha-card-background, var(--card-background-color, #ffffff))",
  "--ttc-fg": "var(--primary-text-color, #1f2933)",
  "--ttc-accent": "var(--primary-color, #1f2933)",
  "--ttc-dial-track": "var(--divider-color, rgba(0, 0, 0, 0.16))",
  "--ttc-dial-progress": "var(--info-color, rgba(0, 122, 255, 0.85))",
  "--ttc-chip-bg": "var(--chip-background-color, rgba(0, 0, 0, 0.04))",
  "--ttc-chip-fg": "var(--chip-text-color, var(--primary-text-color, #1f2933))",
  "--ttc-chip-selected-bg": "var(--primary-color, rgba(0, 122, 255, 0.12))",
  "--ttc-chip-selected-fg": "var(--text-on-primary-color, #ffffff)",
  "--ttc-danger": "var(--error-color, #c62828)",
  "--ttc-focus-ring": "var(--focus-ring-color, rgba(0, 122, 255, 0.55))",
};

export function resolveThemeTokens(overrides: ThemeTokensConfig | undefined): ThemeTokensResult {
  const values: Record<string, string> = {};
  for (const token of TOKEN_KEYS) {
    const override = overrides?.[token];
    values[token] = override ?? DEFAULT_TOKENS[token];
  }

  return { values };
}

export interface PresetThemeResult {
  background: string;
  foreground: string;
  contrast: number;
  adjusted: boolean;
}

export function resolvePresetTheme(color: string | undefined): PresetThemeResult | undefined {
  if (!color) {
    return undefined;
  }

  const accessible = ensureAccessibleText(color);
  const foreground = accessible.text === "light" ? "#ffffff" : "#000000";

  return {
    background: accessible.background,
    foreground,
    contrast: accessible.contrast,
    adjusted: accessible.adjusted,
  };
}
