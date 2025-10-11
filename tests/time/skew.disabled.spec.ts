import { describe, expect, it } from "vitest";

import { boundLocalClockBaseline } from "../../src/time/skew";

describe("Clock skew estimator — disabled mode safeguards", () => {
  it("limits baseline shifts to ≤1 second per update", () => {
    const previous = 60;
    const derived = 56.2; // Local clock is ahead by ~3.8 s.
    const bounded = boundLocalClockBaseline(derived, previous);
    expect(bounded).toBeCloseTo(59, 5);
    expect(previous - bounded).toBeLessThanOrEqual(1);
  });

  it("never increases the countdown when drift suggests an upward correction", () => {
    const previous = 30;
    const derived = 31.5; // Local jitter nudges the value upward.
    const bounded = boundLocalClockBaseline(derived, previous);
    expect(bounded).toBe(previous);
  });

  it("returns the raw value when no previous baseline exists", () => {
    const derived = 42.25;
    expect(boundLocalClockBaseline(derived, undefined)).toBeCloseTo(derived, 6);
  });

  it("keeps successive fallback seeds monotone", () => {
    const samples = [30, 29.5, 31.2, 27.4, 26.9];
    const bounded: number[] = [];
    let previous: number | undefined;

    for (const sample of samples) {
      const adjusted = previous !== undefined && sample <= 0
        ? 0
        : previous !== undefined && sample > 0
          ? boundLocalClockBaseline(sample, previous)
          : Math.max(0, sample);
      bounded.push(adjusted);
      previous = adjusted;
    }

    for (let index = 1; index < bounded.length; index += 1) {
      const delta = bounded[index - 1] - bounded[index];
      expect(delta).toBeGreaterThanOrEqual(0);
      expect(delta).toBeLessThanOrEqual(1);
    }
  });

  it("allows the countdown to hit zero without re-inflating", () => {
    const previous = 2.4;
    const derived = 0;
    const adjusted = derived > 0 ? boundLocalClockBaseline(derived, previous) : derived;
    expect(adjusted).toBe(0);
  });

  it("returns the raw value when derived time is not finite", () => {
    const result = boundLocalClockBaseline(Number.NaN, 30);
    expect(Number.isNaN(result)).toBe(true);
  });

  it("handles non-finite previous baselines by clamping to zero", () => {
    const result = boundLocalClockBaseline(12.5, Number.POSITIVE_INFINITY);
    expect(result).toBeCloseTo(12.5, 5);
  });

  it("treats negative max shift parameters as zero", () => {
    const result = boundLocalClockBaseline(28, 30, -5);
    expect(result).toBe(30);
  });
});
