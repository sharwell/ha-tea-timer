import { describe, expect, it } from "vitest";
import { ClockSkewEstimator } from "./ClockSkewEstimator";

function createMonotonicClock(initial = 0) {
  let current = initial;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe("ClockSkewEstimator", () => {
  it("estimates offset from server timestamps", () => {
    const mono = createMonotonicClock();
    const estimator = new ClockSkewEstimator(mono.now);
    const local = 1_000_000;
    const serverStamp = new Date(local - 250).toISOString();

    estimator.estimateFromServerStamp(serverStamp, local);

    expect(estimator.getOffsetMs()).toBeCloseTo(250, 1);
  });

  it("smooths subsequent samples", () => {
    const mono = createMonotonicClock();
    const estimator = new ClockSkewEstimator(mono.now);
    const base = 2_000_000;
    estimator.estimateFromServerStamp(new Date(base - 100).toISOString(), base);
    estimator.serverNowMs(base);

    const laterLocal = base + 10_000;
    estimator.estimateFromServerStamp(new Date(laterLocal - 500).toISOString(), laterLocal);
    mono.advance(1_000);
    estimator.serverNowMs(laterLocal);

    // Expect offset between the two samples due to smoothing
    expect(estimator.getOffsetMs()).toBeGreaterThan(100);
    expect(estimator.getOffsetMs()).toBeLessThan(500);
  });

  it("computes server now using estimated offset", () => {
    const mono = createMonotonicClock();
    const estimator = new ClockSkewEstimator(mono.now);
    const local = 3_000_000;
    estimator.estimateFromServerStamp(new Date(local - 750).toISOString(), local);

    mono.advance(250);
    const serverNow = estimator.serverNowMs(local + 500);

    expect(serverNow).toBeCloseTo(local + 500 - 750, 1);
  });

  it("can be reset to drop the existing estimate", () => {
    const mono = createMonotonicClock();
    const estimator = new ClockSkewEstimator(mono.now);
    const local = 4_000_000;
    estimator.estimateFromServerStamp(new Date(local - 600).toISOString(), local);

    estimator.reset();

    expect(estimator.getOffsetMs()).toBe(0);

    const laterLocal = local + 1000;
    estimator.estimateFromServerStamp(new Date(laterLocal - 200).toISOString(), laterLocal);

    expect(estimator.getOffsetMs()).toBeCloseTo(200, 1);
  });

  it("limits how quickly offset corrections are applied", () => {
    const mono = createMonotonicClock();
    const estimator = new ClockSkewEstimator(mono.now);
    const first = 5_000_000;

    estimator.estimateFromServerStamp(new Date(first - 50).toISOString(), first);
    estimator.serverNowMs(first);

    const second = first + 1000;
    mono.advance(1_000);
    estimator.estimateFromServerStamp(new Date(second - 400).toISOString(), second);

    // Only 500ms of monotonic time elapses before reading serverNow.
    mono.advance(500);
    estimator.serverNowMs(second + 500);

    const offset = estimator.getOffsetMs();
    expect(offset).toBeGreaterThan(50);
    const maxExpected = 50 + ClockSkewEstimator.MAX_CORRECTION_RATE_MS_PER_SEC * 0.5;
    expect(offset).toBeLessThanOrEqual(maxExpected + 1e-6);
  });
});
