import { describe, expect, it } from "vitest";

import { TimerStateController } from "../../src/state/TimerStateController";
import type { TimerViewState as MachineTimerViewState } from "../../src/state/TimerStateMachine";
import { ClockSkewEstimator } from "../../src/time/skew";
import { TestHost } from "./testHost";
import { callSeedRunningBaseline } from "./seedUtils";

describe("baseline seeding from duration + last_changed", () => {
  it("derives the remaining time when the attribute is absent", () => {
    let monotonic = 5_000;
    const controller = new TimerStateController(new TestHost(), {
      monotonicNow: () => monotonic,
    });

    const wallNow = Date.UTC(2024, 3, 1, 13, 0, 0);
    const start = wallNow - 90_000;
    const state: MachineTimerViewState = {
      status: "running",
      durationSeconds: 300,
      lastChangedTs: start,
      remainingSeconds: undefined,
    };

    const seed = callSeedRunningBaseline(controller, state, wallNow);
    expect(seed).toBeDefined();
    const expectedRemaining = 210;
    expect(seed?.remainingSeconds).toBeCloseTo(expectedRemaining, 6);
    expect(seed?.baselineEndMs).toBeCloseTo(monotonic + expectedRemaining * 1000, 5);

    monotonic += 1_000;
    const seedAfterOneSecond = callSeedRunningBaseline(controller, state, wallNow + 1_000);
    expect(seedAfterOneSecond?.remainingSeconds).toBeCloseTo(expectedRemaining - 1, 3);
  });

  it("stays within ±0.5 seconds of the true remaining time over short intervals", () => {
    let monotonic = 10_000;
    const controller = new TimerStateController(new TestHost(), {
      monotonicNow: () => monotonic,
    });

    const wallStart = Date.UTC(2024, 3, 1, 13, 15, 0);
    const durationSeconds = 180;
    const lastChanged = wallStart - 15_000;
    const state: MachineTimerViewState = {
      status: "running",
      durationSeconds,
      lastChangedTs: lastChanged,
      remainingSeconds: undefined,
    };

    for (let delta = 0; delta <= 2_000; delta += 250) {
      const wallNow = wallStart + delta;
      monotonic = 10_000 + delta;
      const seed = callSeedRunningBaseline(controller, state, wallNow);
      const elapsedSeconds = (wallNow - lastChanged) / 1000;
      const actualRemaining = Math.max(0, durationSeconds - elapsedSeconds);
      expect(Math.abs((seed?.remainingSeconds ?? 0) - actualRemaining)).toBeLessThanOrEqual(0.5);
    }
  });

  it("clamps the derived remaining time to zero", () => {
    const monotonic = 20_000;
    const controller = new TimerStateController(new TestHost(), {
      monotonicNow: () => monotonic,
    });

    const wallNow = Date.UTC(2024, 3, 1, 14, 0, 0);
    const state: MachineTimerViewState = {
      status: "running",
      durationSeconds: 60,
      lastChangedTs: wallNow - 180_000,
      remainingSeconds: undefined,
    };

    const seed = callSeedRunningBaseline(controller, state, wallNow);
    expect(seed?.remainingSeconds).toBe(0);
    expect(seed?.baselineEndMs).toBe(monotonic);
  });

  const createMonotonic = () => {
    let current = 0;
    return {
      now: () => current,
      advance: (deltaMs: number) => {
        current += Math.max(0, deltaMs);
      },
    };
  };

  it("uses the skew estimator to converge under ±3s client skew", () => {
    const monotonic = createMonotonic();
    const controller = new TimerStateController(new TestHost(), {
      monotonicNow: monotonic.now,
    });
    const internal = controller as unknown as { clockSkew: ClockSkewEstimator };
    const estimator = internal.clockSkew;

    const durationSeconds = 300;
    const startServer = Date.UTC(2024, 3, 1, 15, 0, 0) - durationSeconds * 1000;
    const skewMs = 3_000;
    let previousLocal = startServer + skewMs;

    for (let step = 0; step < 8; step += 1) {
      const serverNow = startServer + (step + 1) * 1_000;
      const localNow = serverNow + skewMs + (step % 2 === 0 ? 120 : -80);
      monotonic.advance(localNow - previousLocal);
      estimator.estimateFromServerStamp(new Date(serverNow).toISOString(), localNow);

      const state: MachineTimerViewState = {
        status: "running",
        durationSeconds,
        lastChangedTs: startServer,
        remainingSeconds: undefined,
      };

      const seed = callSeedRunningBaseline(controller, state, localNow);
      const elapsedSeconds = (serverNow - startServer) / 1000;
      const actualRemaining = Math.max(0, durationSeconds - elapsedSeconds);

      if (step >= 2) {
        expect(Math.abs((seed?.remainingSeconds ?? 0) - actualRemaining)).toBeLessThanOrEqual(0.5);
      }

      previousLocal = localNow;
    }

    expect(Math.abs(estimator.getSkewMs() - skewMs)).toBeLessThanOrEqual(250);
  });

  it("limits baseline shifts when the skew estimator is disabled", () => {
    const monotonic = 50_000;
    const controller = new TimerStateController(new TestHost(), {
      monotonicNow: () => monotonic,
      clockSkewEstimatorEnabled: false,
    });

    const internal = controller as unknown as { serverRemainingSecAtT0?: number };
    internal.serverRemainingSecAtT0 = 40;

    const wallNow = Date.UTC(2024, 3, 1, 16, 0, 0);
    const state: MachineTimerViewState = {
      status: "running",
      durationSeconds: 300,
      lastChangedTs: wallNow - 250_000,
      remainingSeconds: undefined,
    };

    const seed = callSeedRunningBaseline(controller, state, wallNow);
    expect(seed).toBeDefined();
    expect(seed?.remainingSeconds).toBeLessThanOrEqual(40);
    expect(seed?.remainingSeconds).toBeGreaterThanOrEqual(39);
    expect(seed?.baselineEndMs).toBeCloseTo(monotonic + (seed?.remainingSeconds ?? 0) * 1000, 5);
  });
});
