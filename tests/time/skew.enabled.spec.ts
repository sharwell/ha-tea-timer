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
});
