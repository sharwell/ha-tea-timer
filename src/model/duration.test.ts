import { describe, expect, it } from "vitest";
import {
  DurationBounds,
  clampDurationSeconds,
  durationToAngleRadians,
  formatDurationSeconds,
  normalizeDurationSeconds,
  roundDurationSeconds,
} from "./duration";

describe("duration helpers", () => {
  const bounds: DurationBounds = { min: 15, max: 1200, step: 5 };

  it("formats durations above an hour", () => {
    expect(formatDurationSeconds(3665)).toBe("1:01:05");
  });

  it("rounds to nearest step", () => {
    expect(roundDurationSeconds(178, bounds.step)).toBe(180);
    expect(roundDurationSeconds(182, bounds.step)).toBe(180);
  });

  it("normalizes and clamps values", () => {
    expect(normalizeDurationSeconds(2, bounds)).toBe(15);
    expect(normalizeDurationSeconds(1213, bounds)).toBe(1200);
  });

  it("clamps non-finite values to min", () => {
    expect(clampDurationSeconds(Number.NaN, bounds)).toBe(15);
  });

  it("produces dial angles within range", () => {
    const angle = durationToAngleRadians(615, bounds);
    expect(angle).toBeGreaterThan(0);
    expect(angle).toBeLessThan(Math.PI * 2);
  });
});
