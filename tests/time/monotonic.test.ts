import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  displaySeconds,
  type MonotonicCountdownState,
  remainingMs,
  seedBaseline,
  VISUAL_CORRECTION_THRESHOLD_MS,
} from "../../src/time/monotonic";

describe("monotonic countdown engine", () => {
  it("emits a non-increasing sequence for any non-decreasing nowMs", () => {
    fc.assert(
      fc.property(
        fc.record({
          start: fc.integer({ min: 0, max: 10_000 }),
          durationMs: fc.integer({ min: 1, max: 10 * 60 * 1000 }),
          deltas: fc.array(fc.integer({ min: 0, max: 5_000 }), { minLength: 1, maxLength: 180 }),
        }),
        ({ start, durationMs, deltas }) => {
          const state: MonotonicCountdownState = {};
          seedBaseline(state, start + durationMs, { allowIncrease: true });

          let now = start;
          const observed: number[] = [];
          const first = displaySeconds(state, now);
          if (first !== undefined) {
            observed.push(first);
          }

          for (const delta of deltas) {
            now += delta;
            const value = displaySeconds(state, now);
            if (value !== undefined) {
              observed.push(value);
            }
          }

          for (let index = 1; index < observed.length; index += 1) {
            expect(observed[index]).toBeLessThanOrEqual(observed[index - 1]);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("holds the displayed second for small upward corrections", () => {
    const state: MonotonicCountdownState = {};
    const start = 0;
    const baseline = start + 10_000;
    seedBaseline(state, baseline, { allowIncrease: true });

    expect(displaySeconds(state, start)).toBe(10);
    expect(displaySeconds(state, start + 2_000)).toBe(8);

    seedBaseline(state, baseline + 1_000, { allowIncrease: false });
    expect(displaySeconds(state, start + 2_000)).toBe(8);

    const later = displaySeconds(state, start + 9_500);
    expect(later).toBeLessThanOrEqual(8);
  });

  it("allows increases for material or large corrections", () => {
    const state: MonotonicCountdownState = {};
    const start = 5_000;
    const baseline = start + 12_000;
    seedBaseline(state, baseline, { allowIncrease: true });

    expect(displaySeconds(state, start)).toBe(12);
    const beforeCorrection = displaySeconds(state, start + 4_000)!;
    expect(beforeCorrection).toBe(8);

    const largeCorrection = baseline + VISUAL_CORRECTION_THRESHOLD_MS + 200;
    seedBaseline(state, largeCorrection, { allowIncrease: true });

    const afterCorrection = displaySeconds(state, start + 4_000)!;
    expect(afterCorrection).toBeGreaterThan(beforeCorrection);
    const expected = Math.ceil((largeCorrection - (start + 4_000)) / 1000);
    expect(afterCorrection).toBe(expected);
  });

  it("does not tick upward after long gaps", () => {
    const state: MonotonicCountdownState = {};
    const start = 0;
    seedBaseline(state, start + 30_000, { allowIncrease: true });

    const beforeGap = displaySeconds(state, start + 5_000);
    const afterGap = displaySeconds(state, start + 30_000 + 10_000);

    expect(afterGap).toBeLessThanOrEqual(beforeGap ?? Number.POSITIVE_INFINITY);
    expect(afterGap).toBe(0);
  });

  it("clamps remaining time at zero", () => {
    const state: MonotonicCountdownState = {};
    const start = 0;
    seedBaseline(state, start + 2_500, { allowIncrease: true });

    const first = remainingMs(state, start + 10_000);
    expect(first).toBe(0);

    expect(displaySeconds(state, start + 10_000)).toBe(0);
    expect(displaySeconds(state, start + 20_000)).toBe(0);
  });
});
