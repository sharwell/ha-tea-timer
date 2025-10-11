import { describe, expect, it } from "vitest";

import { TimerStateController } from "../../src/state/TimerStateController";
import { TimerStateMachine, type TimerViewState as MachineTimerViewState } from "../../src/state/TimerStateMachine";
import type { HassEntity } from "../../src/types/home-assistant";
import { TestHost } from "./testHost";
import { callSeedRunningBaseline } from "./seedUtils";

describe("baseline seeding from server remaining attribute", () => {
  it("seeds using a numeric remaining value", () => {
    const wallNow = Date.UTC(2024, 3, 1, 12, 0, 0);
    const entity: HassEntity = {
      entity_id: "timer.tea",
      state: "active",
      attributes: {
        duration: 600,
        remaining: 245,
      },
      last_changed: new Date(wallNow - 45_000).toISOString(),
      last_updated: new Date(wallNow - 45_000).toISOString(),
    };

    const machine = new TimerStateMachine({ finishedOverlayMs: 0, now: () => wallNow });
    const viewState = machine.updateFromEntity(entity, wallNow);

    const monotonicSeed = 10_000;
    const controller = new TimerStateController(new TestHost(), {
      monotonicNow: () => monotonicSeed,
    });

    const seed = callSeedRunningBaseline(controller, viewState, wallNow);
    expect(seed).toBeDefined();
    expect(seed?.remainingSeconds).toBe(245);
    expect(seed?.monotonicT0).toBe(monotonicSeed);
    expect(seed?.baselineEndMs).toBe(monotonicSeed + 245_000);
  });

  it("parses HH:MM:SS remaining strings", () => {
    const wallNow = Date.UTC(2024, 3, 1, 12, 0, 0);
    const entity: HassEntity = {
      entity_id: "timer.tea",
      state: "active",
      attributes: {
        duration: "00:10:00",
        remaining: "00:04:05",
      },
      last_changed: new Date(wallNow - 45_000).toISOString(),
      last_updated: new Date(wallNow - 45_000).toISOString(),
    };

    const machine = new TimerStateMachine({ finishedOverlayMs: 0, now: () => wallNow });
    const viewState = machine.updateFromEntity(entity, wallNow);

    const monotonicSeed = 32_500;
    const controller = new TimerStateController(new TestHost(), {
      monotonicNow: () => monotonicSeed,
    });

    const seed = callSeedRunningBaseline(controller, viewState, wallNow);
    expect(seed).toBeDefined();
    expect(seed?.remainingSeconds).toBe(245);
    expect(seed?.baselineEndMs).toBe(monotonicSeed + 245_000);
  });

  it("clamps parsed remaining to the configured duration bounds", () => {
    const controller = new TimerStateController(new TestHost(), {
      monotonicNow: () => 5_000,
    });

    const wallNow = Date.UTC(2024, 3, 1, 12, 30, 0);
    const overfull: MachineTimerViewState = {
      status: "running",
      durationSeconds: 600,
      remainingSeconds: 900,
    };
    const seedOverfull = callSeedRunningBaseline(controller, overfull, wallNow);
    expect(seedOverfull).toBeDefined();
    expect(seedOverfull?.remainingSeconds).toBe(600);
    expect(seedOverfull?.baselineEndMs).toBe(5_000 + 600_000);

    const underflow: MachineTimerViewState = {
      status: "running",
      durationSeconds: 120,
      remainingSeconds: -25,
    };
    const seedUnderflow = callSeedRunningBaseline(controller, underflow, wallNow);
    expect(seedUnderflow).toBeDefined();
    expect(seedUnderflow?.remainingSeconds).toBe(0);
    expect(seedUnderflow?.baselineEndMs).toBe(5_000);
  });
});
