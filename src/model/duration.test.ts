import { describe, expect, it } from "vitest";
import { formatDurationSeconds } from "./duration";

describe("formatDurationSeconds", () => {
  it("floors fractional seconds without rounding up", () => {
    expect(formatDurationSeconds(62.9)).toBe("1:02");
  });

  it("clamps negative values to zero", () => {
    expect(formatDurationSeconds(-5)).toBe("0:00");
  });

  it("formats hours when present", () => {
    expect(formatDurationSeconds(3661)).toBe("1:01:01");
  });
});
