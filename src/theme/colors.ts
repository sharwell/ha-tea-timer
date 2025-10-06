export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const HEX_3 = /^#([a-f\d])([a-f\d])([a-f\d])$/i;
const HEX_6 = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
const RGB = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i;
const RGBA = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/i;
const HSL = /^hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*\)$/i;
const HSLA = /^hsla\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*,\s*(0|1|0?\.\d+)\s*\)$/i;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseColor(value: string | undefined): RgbColor | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  let match = trimmed.match(HEX_3);
  if (match) {
    const [, r, g, b] = match;
    return {
      r: parseInt(r.repeat(2), 16),
      g: parseInt(g.repeat(2), 16),
      b: parseInt(b.repeat(2), 16),
    };
  }

  match = trimmed.match(HEX_6);
  if (match) {
    const [, r, g, b] = match;
    return {
      r: parseInt(r, 16),
      g: parseInt(g, 16),
      b: parseInt(b, 16),
    };
  }

  match = trimmed.match(RGBA) ?? trimmed.match(RGB);
  if (match) {
    const [, r, g, b, alphaRaw] = match;
    const alpha = alphaRaw !== undefined ? Number.parseFloat(alphaRaw) : 1;
    if (alpha === 0) {
      return undefined;
    }

    return {
      r: clamp(Number.parseInt(r, 10), 0, 255),
      g: clamp(Number.parseInt(g, 10), 0, 255),
      b: clamp(Number.parseInt(b, 10), 0, 255),
    };
  }

  match = trimmed.match(HSLA) ?? trimmed.match(HSL);
  if (match) {
    const [, hRaw, sRaw, lRaw, alphaRaw] = match;
    const alpha = alphaRaw !== undefined ? Number.parseFloat(alphaRaw) : 1;
    if (alpha === 0) {
      return undefined;
    }

    const h = Number.parseInt(hRaw, 10) % 360;
    const s = clamp(Number.parseInt(sRaw, 10) / 100, 0, 1);
    const l = clamp(Number.parseInt(lRaw, 10) / 100, 0, 1);

    const chroma = (1 - Math.abs(2 * l - 1)) * s;
    const hPrime = h / 60;
    const x = chroma * (1 - Math.abs((hPrime % 2) - 1));
    let r1 = 0;
    let g1 = 0;
    let b1 = 0;

    if (hPrime >= 0 && hPrime < 1) {
      r1 = chroma;
      g1 = x;
    } else if (hPrime >= 1 && hPrime < 2) {
      r1 = x;
      g1 = chroma;
    } else if (hPrime >= 2 && hPrime < 3) {
      g1 = chroma;
      b1 = x;
    } else if (hPrime >= 3 && hPrime < 4) {
      g1 = x;
      b1 = chroma;
    } else if (hPrime >= 4 && hPrime < 5) {
      r1 = x;
      b1 = chroma;
    } else if (hPrime >= 5 && hPrime < 6) {
      r1 = chroma;
      b1 = x;
    }

    const m = l - chroma / 2;
    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255),
    };
  }

  return undefined;
}

export function relativeLuminance(color: RgbColor): number {
  const normalize = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  const r = normalize(color.r);
  const g = normalize(color.g);
  const b = normalize(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: RgbColor, background: RgbColor): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface AccessibleTextResult {
  background: string;
  text: "light" | "dark";
  contrast: number;
  adjusted: boolean;
}

function rgbToHex(color: RgbColor): string {
  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function adjustLightness(color: RgbColor, delta: number): RgbColor {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  const newL = clamp(l + delta, 0, 1);

  if (s === 0) {
    const gray = Math.round(newL * 255);
    return { r: gray, g: gray, b: gray };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = newL < 0.5 ? newL * (1 + s) : newL + s - newL * s;
  const p = 2 * newL - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

export function ensureAccessibleText(backgroundInput: string, minimumContrast = 4.5): AccessibleTextResult {
  const parsed = parseColor(backgroundInput);
  if (!parsed) {
    return {
      background: backgroundInput,
      text: "dark",
      contrast: 1,
      adjusted: false,
    };
  }

  const candidates = {
    light: contrastRatio({ r: 255, g: 255, b: 255 }, parsed),
    dark: contrastRatio({ r: 0, g: 0, b: 0 }, parsed),
  } as const;

  let chosen: AccessibleTextResult = {
    background: rgbToHex(parsed),
    text: candidates.light >= candidates.dark ? "light" : "dark",
    contrast: Math.max(candidates.light, candidates.dark),
    adjusted: false,
  };

  if (chosen.contrast >= minimumContrast) {
    return chosen;
  }

  const direction = chosen.text === "light" ? -1 : 1;
  const step = 0.04 * direction;
  let current = parsed;
  let adjusted = false;

  for (let i = 0; i < 3; i += 1) {
    current = adjustLightness(current, step);
    const lightContrast = contrastRatio({ r: 255, g: 255, b: 255 }, current);
    const darkContrast = contrastRatio({ r: 0, g: 0, b: 0 }, current);
    const text = lightContrast >= darkContrast ? "light" : "dark";
    const contrast = Math.max(lightContrast, darkContrast);
    if (contrast >= minimumContrast) {
      adjusted = true;
      chosen = {
        background: rgbToHex(current),
        text,
        contrast,
        adjusted,
      };
      break;
    }
  }

  return chosen;
}
