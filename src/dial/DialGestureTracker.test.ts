import { describe, expect, it } from "vitest";
import { DialGestureTracker } from "./DialGestureTracker";

describe("DialGestureTracker", () => {
  it("keeps motion continuous across wrap-around when increasing", () => {
    const tracker = new DialGestureTracker(0.95);
    tracker.jumpToRaw(0.95);

    const first = tracker.updateFromRaw(0.98);
    expect(first).toBeGreaterThan(0.95);

    const second = tracker.updateFromRaw(0.02);
    expect(second).toBeGreaterThanOrEqual(0.99);
    expect(second).toBeLessThanOrEqual(1);
  });

  it("keeps motion continuous across wrap-around when decreasing", () => {
    const tracker = new DialGestureTracker(0.05);
    tracker.jumpToRaw(0.05);

    const first = tracker.updateFromRaw(0.02);
    expect(first).toBeLessThan(0.05);

    const second = tracker.updateFromRaw(0.98);
    expect(second).toBeLessThanOrEqual(0.01);
    expect(second).toBeGreaterThanOrEqual(0);
  });

  it("aligns jump targets to nearest value", () => {
    const tracker = new DialGestureTracker(0.9);
    const normalized = tracker.jumpToRaw(0.1);
    expect(normalized).toBeCloseTo(1);
  });
});
