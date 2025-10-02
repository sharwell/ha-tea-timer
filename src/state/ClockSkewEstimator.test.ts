import { describe, expect, it } from "vitest";
import { ClockSkewEstimator } from "./ClockSkewEstimator";

describe("ClockSkewEstimator", () => {
  it("estimates offset from server timestamps", () => {
    const estimator = new ClockSkewEstimator();
    const local = 1_000_000;
    const serverStamp = new Date(local - 250).toISOString();

    estimator.estimateFromServerStamp(serverStamp, local);

    expect(estimator.getOffsetMs()).toBeCloseTo(250, 1);
  });

  it("smooths subsequent samples", () => {
    const estimator = new ClockSkewEstimator();
    const base = 2_000_000;
    estimator.estimateFromServerStamp(new Date(base - 100).toISOString(), base);

    const laterLocal = base + 10_000;
    estimator.estimateFromServerStamp(new Date(laterLocal - 500).toISOString(), laterLocal);

    // Expect offset between the two samples due to smoothing (alpha = 0.2)
    expect(estimator.getOffsetMs()).toBeGreaterThan(100);
    expect(estimator.getOffsetMs()).toBeLessThan(500);
  });

  it("computes server now using estimated offset", () => {
    const estimator = new ClockSkewEstimator();
    const local = 3_000_000;
    estimator.estimateFromServerStamp(new Date(local - 750).toISOString(), local);

    const serverNow = estimator.serverNowMs(local + 500);

    expect(serverNow).toBeCloseTo(local + 500 - 750, 1);
  });

  it("can be reset to drop the existing estimate", () => {
    const estimator = new ClockSkewEstimator();
    const local = 4_000_000;
    estimator.estimateFromServerStamp(new Date(local - 600).toISOString(), local);

    estimator.reset();

    expect(estimator.getOffsetMs()).toBe(0);

    const laterLocal = local + 1000;
    estimator.estimateFromServerStamp(new Date(laterLocal - 200).toISOString(), laterLocal);

    expect(estimator.getOffsetMs()).toBeCloseTo(200, 1);
  });
});
