import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { quantizeDisplaySeconds } from "../../src/time/quantize";

describe("quantizeDisplaySeconds", () => {
  it("never re-increases once a second ticks down", () => {
    const samples = [
      10_050,
      9_980,
      9_940,
      9_880,
      9_920,
      9_860,
      9_120,
      9_080,
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

  it("absorbs sub-threshold upward corrections", () => {
    let previous: number | undefined;

    previous = quantizeDisplaySeconds(10_000, previous);
    expect(previous).toBe(10);

    previous = quantizeDisplaySeconds(9_000, previous);
    expect(previous).toBe(9);

    const afterCorrection = quantizeDisplaySeconds(9_650, previous);
    expect(afterCorrection).toBe(9);
  });

  it("allows a material correction to raise the display once", () => {
    const before = quantizeDisplaySeconds(8_000, undefined);
    expect(before).toBe(8);

    const corrected = quantizeDisplaySeconds(10_800, undefined);
    expect(corrected).toBe(11);
  });

  it("eliminates back-ticks even with jitter around second boundaries", () => {
    const remaining = [
      10_200,
      9_850,
      9_780,
      9_960,
      9_870,
      9_050,
      9_020,
      9_110,
      9_010,
      8_980,
    ];

    let previous: number | undefined;
    const sequence: number[] = [];

    for (const value of remaining) {
      const display = quantizeDisplaySeconds(value, previous);
      sequence.push(display);
      previous = display;
    }

    for (let index = 2; index < sequence.length; index += 1) {
      const previous = sequence[index - 2];
      const middle = sequence[index - 1];
      const current = sequence[index];
      expect(middle).toBeLessThanOrEqual(previous);
      expect(current).toBeLessThanOrEqual(middle);
      expect(!(previous === current && middle > current)).toBe(true);
    }
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

  it("emits a non-increasing sequence for monotonically decreasing inputs", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 90_000 }), { minLength: 2, maxLength: 120 }),
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
