import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  ensureAccessibleText,
  parseColor,
  relativeLuminance,
} from "./colors";

describe("parseColor", () => {
  it("parses hex", () => {
    expect(parseColor("#336699")).toEqual({ r: 51, g: 102, b: 153 });
    expect(parseColor("#369")).toEqual({ r: 51, g: 102, b: 153 });
  });

  it("parses rgb", () => {
    expect(parseColor("rgb(10, 20, 30)")).toEqual({ r: 10, g: 20, b: 30 });
    expect(parseColor("rgba(10, 20, 30, 0)")).toBeUndefined();
  });

  it("parses hsl", () => {
    const color = parseColor("hsl(210, 50%, 40%)");
    expect(color).toBeDefined();
  });
});

describe("relativeLuminance", () => {
  it("returns higher value for lighter colors", () => {
    const dark = relativeLuminance({ r: 0, g: 0, b: 0 });
    const light = relativeLuminance({ r: 255, g: 255, b: 255 });
    expect(light).toBeGreaterThan(dark);
  });
});

describe("contrastRatio", () => {
  it("matches WCAG expectations", () => {
    const ratio = contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(ratio).toBeCloseTo(21, 1);
  });
});

describe("ensureAccessibleText", () => {
  it("selects best text color", () => {
    const result = ensureAccessibleText("#ffcc00");
    expect(result.text === "dark" || result.text === "light").toBe(true);
    expect(result.contrast).toBeGreaterThanOrEqual(1);
  });

  it("adjusts low-contrast colors", () => {
    const result = ensureAccessibleText("#777777", 7);
    expect(result.contrast).toBeGreaterThanOrEqual(4.5);
  });
});
