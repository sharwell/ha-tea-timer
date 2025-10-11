import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import {
  displaySeconds,
  remainingMs,
  seedBaseline,
  VISUAL_CORRECTION_THRESHOLD_MS,
  nowMs,
  type MonotonicCountdownState,
} from "../../src/time/monotonic";
import * as quantizeModule from "../../src/time/quantize";

describe("monotonic countdown engine", () => {
  it("produces a non-increasing sequence for any non-decreasing nowMs", () => {
    fc.assert(
      fc.property(
        fc.record({
          start: fc.integer({ min: 0, max: 10_000 }),
          durationMs: fc.integer({ min: 1, max: 20 * 60 * 1000 }),
          deltas: fc.array(fc.integer({ min: 0, max: 5_000 }), { minLength: 1, maxLength: 240 }),
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

  it("never ticks upward after long rendering gaps", () => {
    const state: MonotonicCountdownState = {};
    const start = 100;
    const durationMs = 30_000;
    seedBaseline(state, start + durationMs, { allowIncrease: true });

    const beforeGap = displaySeconds(state, start + 5_000);
    const afterGap = displaySeconds(state, start + 90_000);

    expect(afterGap).toBeLessThanOrEqual(beforeGap ?? Number.POSITIVE_INFINITY);
    expect(afterGap).toBe(0);
  });

  it("clamps the baseline at zero once elapsed", () => {
    const state: MonotonicCountdownState = {};
    seedBaseline(state, 2_500, { allowIncrease: true });

    expect(remainingMs(state, 10_000)).toBe(0);
    expect(displaySeconds(state, 10_000)).toBe(0);
    expect(displaySeconds(state, 20_000)).toBe(0);
  });

  it("holds the visible countdown for small upward corrections", () => {
    const state: MonotonicCountdownState = {};
    const start = 0;
    const originalBaseline = start + 12_000;
    seedBaseline(state, originalBaseline, { allowIncrease: true });

    const before = displaySeconds(state, start + 4_000);
    expect(before).toBe(8);

    const correctedBaseline = originalBaseline + 1_000;
    seedBaseline(state, correctedBaseline, { allowIncrease: false });
    const afterCorrection = displaySeconds(state, start + 4_000);
    expect(afterCorrection).toBe(8);

    const later = displaySeconds(state, start + 11_200);
    expect(later).toBeLessThanOrEqual(8);
  });

  it("allows a single upward adjustment for material corrections", () => {
    const state: MonotonicCountdownState = {};
    const start = 5_000;
    const baseline = start + 15_000;
    seedBaseline(state, baseline, { allowIncrease: true });

    const before = displaySeconds(state, start + 6_000);
    expect(before).toBe(9);

    const largeCorrection = baseline + VISUAL_CORRECTION_THRESHOLD_MS + 250;
    seedBaseline(state, largeCorrection, { allowIncrease: true });
    const after = displaySeconds(state, start + 6_000);
    const expected = Math.ceil((largeCorrection - (start + 6_000)) / 1000);
    expect(after).toBe(expected);
    expect(after).toBeGreaterThan(before ?? -1);
  });

  it("releases the hold after the countdown drops back to the capped value", () => {
    const state: MonotonicCountdownState = {};
    seedBaseline(state, 15_000, { allowIncrease: true });

    expect(displaySeconds(state, 0)).toBe(15);
    seedBaseline(state, 16_000, { allowIncrease: false });
    expect(displaySeconds(state, 0)).toBe(15);

    const afterDrop = displaySeconds(state, 6_000);
    expect(afterDrop).toBe(10);
    const postHold = displaySeconds(state, 6_500);
    expect(postHold).toBeLessThanOrEqual(afterDrop ?? Number.POSITIVE_INFINITY);
    expect(state.holdMaxSeconds).toBeUndefined();
  });

  it("prevents increases when the quantizer would raise the value", () => {
    const start = 1_000;
    const state: MonotonicCountdownState = {
      baselineEndMs: start + 12_000,
      lastDisplaySeconds: 3,
    };

    const value = displaySeconds(state, start);
    expect(value).toBe(3);
    expect(state.lastDisplaySeconds).toBe(3);
  });

  it("clears the baseline when reseeded with undefined", () => {
    const state: MonotonicCountdownState = {};
    seedBaseline(state, 8_000, { allowIncrease: true });
    expect(displaySeconds(state, 1_000)).toBe(7);

    seedBaseline(state, undefined);
    expect(state.baselineEndMs).toBeUndefined();
    expect(state.holdMaxSeconds).toBeUndefined();
    expect(state.lastDisplaySeconds).toBeUndefined();
    expect(displaySeconds(state, 2_000)).toBeUndefined();
  });

  it("caps the display at the hold value while a correction is in effect", () => {
    const start = 0;
    const state: MonotonicCountdownState = {
      baselineEndMs: start + 9_000,
      holdMaxSeconds: 5,
      lastDisplaySeconds: 5,
    };

    const value = displaySeconds(state, start + 1_000);
    expect(value).toBe(5);
    expect(state.holdMaxSeconds).toBeUndefined();
  });

  it("caps the display using hold when no previous value exists", () => {
    const state: MonotonicCountdownState = {
      baselineEndMs: 12_000,
      holdMaxSeconds: 6,
    };

    const value = displaySeconds(state, 2_000);
    expect(value).toBe(6);
    expect(state.holdMaxSeconds).toBe(6);
  });

  it("retains the prior display when the quantizer attempts to increase it", () => {
    const spy = vi.spyOn(quantizeModule, "quantizeDisplaySeconds").mockReturnValueOnce(9);
    const state: MonotonicCountdownState = {
      baselineEndMs: 15_000,
      lastDisplaySeconds: 4,
    };

    const value = displaySeconds(state, 3_000);
    expect(value).toBe(4);
    spy.mockRestore();
  });

  it("defaults to holding the previous value when allowIncrease is omitted", () => {
    const state: MonotonicCountdownState = {
      lastDisplaySeconds: 4,
    };

    seedBaseline(state, 12_000);
    expect(state.holdMaxSeconds).toBe(4);
    expect(state.baselineEndMs).toBe(12_000);
  });

  it("uses the current monotonic clock when now is omitted", () => {
    const baseline = nowMs() + 5_000;
    const state: MonotonicCountdownState = {};
    seedBaseline(state, baseline, { allowIncrease: true });

    const value = displaySeconds(state);
    expect(value).toBeDefined();
    expect(value ?? 0).toBeGreaterThanOrEqual(4);
    expect(value ?? 0).toBeLessThanOrEqual(6);
  });

  it("falls back to Date.now when performance.now is unavailable", () => {
    const original = globalThis.performance;
    try {
      // @ts-expect-error - intentionally unset to test the fallback path.
      delete (globalThis as typeof globalThis & { performance?: Performance }).performance;

      const before = Date.now();
      const result = nowMs();
      expect(result).toBeGreaterThanOrEqual(before);
    } finally {
      if (original) {
        globalThis.performance = original;
      }
    }
  });
});
