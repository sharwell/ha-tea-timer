import { describe, expect, it } from "vitest";
import {
  computeDialDiameter,
  computeDialTrackWidth,
  computeLayout,
  resolveLayoutDensity,
} from "./responsive";

describe("resolveLayoutDensity", () => {
  it("forces compact below small breakpoint", () => {
    expect(resolveLayoutDensity(200, 400, "auto")).toBe("compact");
  });

  it("prefers compact in medium width", () => {
    expect(resolveLayoutDensity(300, 200, "auto")).toBe("compact");
  });

  it("allows regular in medium width when tall", () => {
    expect(resolveLayoutDensity(320, 480, "auto")).toBe("regular");
  });

  it("forces regular at large widths", () => {
    expect(resolveLayoutDensity(400, 200, "auto")).toBe("regular");
  });

  it("respects explicit density", () => {
    expect(resolveLayoutDensity(180, 200, "regular")).toBe("regular");
    expect(resolveLayoutDensity(480, 200, "compact")).toBe("compact");
  });
});

describe("computeDialDiameter", () => {
  it("clamps to minimum", () => {
    expect(computeDialDiameter(140, "regular")).toBeGreaterThanOrEqual(140);
  });

  it("applies compact scaling", () => {
    const regular = computeDialDiameter(400, "regular");
    const compact = computeDialDiameter(400, "compact");
    expect(compact).toBeLessThan(regular);
  });
});

describe("computeDialTrackWidth", () => {
  it("reduces track width for compact", () => {
    expect(computeDialTrackWidth("compact")).toBeLessThan(computeDialTrackWidth("regular"));
  });
});

describe("computeLayout", () => {
  it("includes header time flag when dial below threshold", () => {
    const layout = computeLayout({ width: 220, height: 200, density: "auto" });
    expect(layout.density).toBe("compact");
    expect(layout.showHeaderTime).toBeTypeOf("boolean");
  });
});
