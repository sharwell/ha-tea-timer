import { describe, expect, it } from "vitest";

import { ClockSkewEstimator } from "../../src/time/skew";

interface FakeMonotonic {
  now: () => number;
  advance: (deltaMs: number) => void;
}

const createMonotonic = (): FakeMonotonic => {
  let current = 0;
  return {
    now: () => current,
    advance: (deltaMs: number) => {
      current += Math.max(0, deltaMs);
    },
  };
};

const BASE_SERVER_START = Date.UTC(2024, 0, 1, 12, 0, 0);
const DURATION_MS = 5 * 60 * 1000; // 5 minutes.

const makeIso = (ms: number): string => new Date(ms).toISOString();

const trueRemainingSeconds = (serverNow: number, lastChanged: number): number => {
  const elapsedMs = Math.max(0, serverNow - lastChanged);
  return Math.max(0, (DURATION_MS - elapsedMs) / 1000);
};

describe("Clock skew estimator — enabled mode", () => {
  const jitterSamples = [40, 90, 120, 180, 60, 150, 110];

  const runScenario = (offsetMs: number) => {
    const monotonic = createMonotonic();
    const estimator = new ClockSkewEstimator({ monotonicNow: monotonic.now });
    const lastChanged = BASE_SERVER_START;
    let previousLocal = BASE_SERVER_START + offsetMs;

    for (let index = 0; index < 12; index += 1) {
      const jitter = jitterSamples[index % jitterSamples.length];
      const serverNow = BASE_SERVER_START + (index + 1) * 1000;
      const localNow = serverNow + offsetMs + jitter;
      monotonic.advance(localNow - previousLocal);
      estimator.estimateFromServerStamp(makeIso(serverNow), localNow);

      const derivedRemaining = Math.max(
        0,
        (DURATION_MS - estimator.elapsedSince(lastChanged, localNow)) / 1000,
      );
      const actualRemaining = trueRemainingSeconds(localNow - offsetMs, lastChanged);

      if (index >= 2) {
        expect(Math.abs(derivedRemaining - actualRemaining)).toBeLessThanOrEqual(0.5);
      }

      previousLocal = localNow;
    }

    expect(Math.abs(estimator.getSkewMs() - offsetMs)).toBeLessThanOrEqual(250);
  };

  it("converges under +3s client skew with jitter", () => {
    runScenario(3000);
  });

  it("converges under -3s client skew with jitter", () => {
    runScenario(-3000);
  });

  it("ignores latency spikes while maintaining the lower envelope", () => {
    const monotonic = createMonotonic();
    const estimator = new ClockSkewEstimator({ monotonicNow: monotonic.now });
    const lastChanged = BASE_SERVER_START;
    let previousLocal = BASE_SERVER_START + 2500;

    // Warm-up samples.
    for (let index = 0; index < 4; index += 1) {
      const serverNow = BASE_SERVER_START + (index + 1) * 1000;
      const localNow = serverNow + 2500 + jitterSamples[index];
      monotonic.advance(localNow - previousLocal);
      estimator.estimateFromServerStamp(makeIso(serverNow), localNow);
      previousLocal = localNow;
    }

    const baselineSkew = estimator.getSkewMs();

    // Introduce a latency spike.
    const spikeServerNow = BASE_SERVER_START + 5000;
    const spikeLocalNow = spikeServerNow + 2500 + 650;
    monotonic.advance(spikeLocalNow - previousLocal);
    estimator.estimateFromServerStamp(makeIso(spikeServerNow), spikeLocalNow);

    expect(estimator.getSkewMs()).toBeLessThanOrEqual(baselineSkew + 1);

    const derivedRemaining = Math.max(
      0,
      (DURATION_MS - estimator.elapsedSince(lastChanged, spikeLocalNow)) / 1000,
    );
    const actualRemaining = trueRemainingSeconds(spikeLocalNow - 2500, lastChanged);
    expect(Math.abs(derivedRemaining - actualRemaining)).toBeLessThanOrEqual(0.5);
  });

  it("limits upward skew growth based on the configured rate and trims old samples", () => {
    const monotonic = createMonotonic();
    const estimator = new ClockSkewEstimator({
      monotonicNow: monotonic.now,
      windowMs: 1_000,
      maxIncreaseRateMsPerSec: 100,
      maxMagnitudeMs: 5_000,
    });

    const internal = estimator as unknown as { samples: Array<{ atMs: number; skewMs: number }>; };

    let previousLocal = BASE_SERVER_START;
    const server1 = BASE_SERVER_START + 1_000;
    const local1 = server1 + 100;
    monotonic.advance(local1 - previousLocal);
    estimator.estimateFromServerStamp(makeIso(server1), local1);
    previousLocal = local1;
    expect(estimator.getSkewMs()).toBe(100);

    const server2 = server1 + 2_000;
    const local2 = server2 + 400;
    monotonic.advance(local2 - previousLocal);
    estimator.estimateFromServerStamp(makeIso(server2), local2);

    expect(estimator.getSkewMs()).toBeCloseTo(330, 6);
    expect(internal.samples.length).toBe(1);
  });

  it("drops samples entirely when the configured window is negative", () => {
    const monotonic = createMonotonic();
    const estimator = new ClockSkewEstimator({
      monotonicNow: monotonic.now,
      windowMs: -1,
    });

    const serverNow = BASE_SERVER_START + 1_000;
    const localNow = serverNow + 800;
    monotonic.advance(localNow);
    estimator.estimateFromServerStamp(makeIso(serverNow), localNow);

    expect(estimator.getSkewMs()).toBe(0);
  });

  it("handles missing or invalid timestamps without updating skew", () => {
    const estimator = new ClockSkewEstimator();
    const before = estimator.getSkewMs();

    estimator.estimateFromServerStamp(undefined, Date.now());
    estimator.estimateFromServerStamp("not-a-date", Date.now());

    expect(estimator.getSkewMs()).toBe(before);
    expect(estimator.getOffsetMs()).toBe(before);

    estimator.estimateFromServerStamp(new Date(BASE_SERVER_START).toISOString(), BASE_SERVER_START + 10);
    expect(estimator.getSkewMs()).toBeGreaterThanOrEqual(before);
  });

  it("clamps large negative skew estimates to the minimum bound", () => {
    const monotonic = createMonotonic();
    const estimator = new ClockSkewEstimator({ monotonicNow: monotonic.now });

    const serverNow = BASE_SERVER_START + 5_000;
    const localNow = serverNow - 15_000;
    monotonic.advance(serverNow - BASE_SERVER_START);
    estimator.estimateFromServerStamp(makeIso(serverNow), localNow);

    expect(estimator.getSkewMs()).toBe(-10_000);
  });

  it("falls back to Date.now when performance.now is unavailable", () => {
    const original = globalThis.performance;
    try {
      // @ts-expect-error - override for test coverage.
      delete (globalThis as typeof globalThis & { performance?: Performance }).performance;
      const estimator = new ClockSkewEstimator();
      const base = Date.now();
      estimator.estimateFromServerStamp(new Date(base).toISOString(), base + 50);
      expect(estimator.getSkewMs()).toBeGreaterThanOrEqual(0);
    } finally {
      if (original) {
        globalThis.performance = original;
      }
    }
  });

  it("skips upward adjustments when the increase rate is zero", () => {
    const monotonic = createMonotonic();
    const estimator = new ClockSkewEstimator({
      monotonicNow: monotonic.now,
      maxIncreaseRateMsPerSec: 0,
      windowMs: 1_000,
    });

    let previousLocal = BASE_SERVER_START;
    const firstServer = BASE_SERVER_START + 1_000;
    const firstLocal = firstServer + 200;
    monotonic.advance(firstLocal - previousLocal);
    estimator.estimateFromServerStamp(makeIso(firstServer), firstLocal);
    previousLocal = firstLocal;

    const secondServer = firstServer + 2_000;
    const secondLocal = secondServer + 600;
    monotonic.advance(secondLocal - previousLocal);
    estimator.estimateFromServerStamp(makeIso(secondServer), secondLocal);

    expect(estimator.getSkewMs()).toBe(200);
  });

  it("computes server-relative times and resets state", () => {
    const monotonic = createMonotonic();
    const estimator = new ClockSkewEstimator({ monotonicNow: monotonic.now });

    const serverNow = BASE_SERVER_START + 1_500;
    const localNow = serverNow + 250;
    monotonic.advance(localNow - BASE_SERVER_START);
    estimator.estimateFromServerStamp(makeIso(serverNow), localNow);

    expect(estimator.serverNowMs(localNow)).toBeCloseTo(serverNow, 6);
    expect(estimator.applySkew(serverNow)).toBe(serverNow + estimator.getSkewMs());
    expect(estimator.elapsedSince(serverNow, localNow + 750)).toBeCloseTo(750, 6);
    expect(estimator.elapsedSince(serverNow, serverNow - 100)).toBe(0);
    const defaultServerNow = estimator.serverNowMs();
    expect(defaultServerNow).toBeGreaterThan(0);
    const defaultElapsed = estimator.elapsedSince(serverNow);
    expect(defaultElapsed).toBeGreaterThanOrEqual(0);

    estimator.reset();
    expect(estimator.getSkewMs()).toBe(0);
  });

  it("ignores increases when the monotonic clock does not advance", () => {
    const monotonic = createMonotonic();
    const estimator = new ClockSkewEstimator({
      monotonicNow: monotonic.now,
      maxIncreaseRateMsPerSec: 100,
    });

    let previousLocal = BASE_SERVER_START;
    const firstServer = BASE_SERVER_START + 1_000;
    const firstLocal = firstServer + 200;
    monotonic.advance(firstLocal - previousLocal);
    estimator.estimateFromServerStamp(makeIso(firstServer), firstLocal);
    previousLocal = firstLocal;

    const secondServer = firstServer + 1_500;
    const secondLocal = secondServer + 600;
    // Monotonic clock does not advance between samples.
    estimator.estimateFromServerStamp(makeIso(secondServer), secondLocal);

    expect(estimator.getSkewMs()).toBe(200);
  });
});
