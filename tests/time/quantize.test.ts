import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { quantizeDisplaySeconds } from "../../src/time/quantize";

describe("quantizeDisplaySeconds", () => {
  it("does not re-increase once a second ticks down", () => {
    const samples = [
      10_200,
      9_980,
      9_920,
      9_870,
      9_930,
      9_880,
      9_120,
      9_060,
      9_020,
      8_980,
    ];

    let previous: number | undefined;
    const observed: number[] = [];

    for (const remaining of samples) {
      const value = quantizeDisplaySeconds(remaining, previous);
      observed.push(value);
      previous = value;
    }

    for (let index = 1; index < observed.length; index += 1) {
      expect(observed[index]).toBeLessThanOrEqual(observed[index - 1]);
    }
    expect(observed).toContain(9);
  });

  it("absorbs small upward corrections without raising the display", () => {
    let previous: number | undefined;

    previous = quantizeDisplaySeconds(10_000, previous);
    expect(previous).toBe(10);

    previous = quantizeDisplaySeconds(9_000, previous);
    expect(previous).toBe(9);

    const afterCorrection = quantizeDisplaySeconds(9_600, previous);
    expect(afterCorrection).toBe(9);
  });

  it("allows a material correction to raise the display once", () => {
    const before = quantizeDisplaySeconds(8_000, undefined);
    expect(before).toBe(8);

    const corrected = quantizeDisplaySeconds(10_700, undefined);
    expect(corrected).toBe(11);
  });

  it("keeps tick cadence between 0.85s and 1.15s", () => {
    const durationMs = 45_000;
    const frameStepMs = 50;
    let previous: number | undefined;
    const changes: number[] = [];

    for (let elapsed = 0; elapsed <= durationMs; elapsed += frameStepMs) {
      const remaining = Math.max(0, durationMs - elapsed);
      const value = quantizeDisplaySeconds(remaining, previous);
      if (value !== previous) {
        changes.push(elapsed);
      }
      previous = value;
    }

    for (let index = 1; index < changes.length; index += 1) {
      const delta = changes[index] - changes[index - 1];
      expect(delta).toBeGreaterThanOrEqual(850);
      expect(delta).toBeLessThanOrEqual(1_150);
    }
  });

  it("emits a non-increasing sequence for decreasing remaining time", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 60_000 }), { minLength: 2, maxLength: 90 }),
        (raw) => {
          const values = raw
            .slice()
            .sort((a, b) => b - a);

          let previous: number | undefined;
          const observed: number[] = [];

          for (const remaining of values) {
            previous = quantizeDisplaySeconds(remaining, previous);
            observed.push(previous);
          }

          for (let index = 1; index < observed.length; index += 1) {
            expect(observed[index]).toBeLessThanOrEqual(observed[index - 1]);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
