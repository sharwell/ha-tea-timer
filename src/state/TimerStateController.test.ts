import { describe, expect, it } from "vitest";
import type { ReactiveController, ReactiveControllerHost } from "lit";

import { TimerStateController } from "./TimerStateController";
import type { TimerViewState as MachineTimerViewState } from "./TimerStateMachine";

class TestHost implements ReactiveControllerHost {
  private controllers: ReactiveController[] = [];

  public addController(controller: ReactiveController): void {
    this.controllers.push(controller);
  }

  public removeController(controller: ReactiveController): void {
    this.controllers = this.controllers.filter((item) => item !== controller);
  }

  public requestUpdate(): void {
    // no-op for tests
  }

  public get updateComplete(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

describe("TimerStateController baseline seeding", () => {
  it("seeds from the remaining attribute when available", () => {
    const monotonic = 10_000;
    const controller = new TimerStateController(new TestHost(), {
      monotonicNow: () => monotonic,
    });

    const state: MachineTimerViewState = {
      status: "running",
      durationSeconds: 600,
      remainingSeconds: 245,
    };

    const seed = (controller as unknown as {
      seedRunningBaseline(
        entityState: MachineTimerViewState,
        wallNow: number,
      ): { remainingSeconds: number; monotonicT0: number; baselineEndMs: number } | undefined;
    }).seedRunningBaseline(state, 1_000_000);

    expect(seed).toBeDefined();
    expect(seed?.remainingSeconds).toBe(245);
    expect(seed?.monotonicT0).toBe(monotonic);
    expect(seed?.baselineEndMs).toBe(monotonic + 245_000);
  });

  it("computes remaining time from duration and last_changed when missing", () => {
    const monotonic = 5_000;
    const controller = new TimerStateController(new TestHost(), {
      monotonicNow: () => monotonic,
    });

    const wallNow = 2_000_000;
    const lastChanged = wallNow - 90_000;
    const state: MachineTimerViewState = {
      status: "running",
      durationSeconds: 300,
      lastChangedTs: lastChanged,
    };

    const seed = (controller as unknown as {
      seedRunningBaseline(
        entityState: MachineTimerViewState,
        wallNow: number,
      ): { remainingSeconds: number; monotonicT0: number; baselineEndMs: number } | undefined;
    }).seedRunningBaseline(state, wallNow);

    expect(seed).toBeDefined();
    expect(seed?.remainingSeconds).toBeCloseTo(210, 5);
    expect(seed?.baselineEndMs).toBeCloseTo(monotonic + 210_000, 5);
  });

  it("clamps computed remaining to the configured duration", () => {
    const monotonic = 7_500;
    const controller = new TimerStateController(new TestHost(), {
      monotonicNow: () => monotonic,
    });

    const wallNow = 3_000_000;
    const lastChanged = wallNow + 5_000; // future timestamp due to skew
    const state: MachineTimerViewState = {
      status: "running",
      durationSeconds: 120,
      lastChangedTs: lastChanged,
    };

    const seed = (controller as unknown as {
      seedRunningBaseline(
        entityState: MachineTimerViewState,
        wallNow: number,
      ): { remainingSeconds: number; monotonicT0: number; baselineEndMs: number } | undefined;
    }).seedRunningBaseline(state, wallNow);

    expect(seed).toBeDefined();
    expect(seed?.remainingSeconds).toBe(120);
    expect(seed?.baselineEndMs).toBe(monotonic + 120_000);
  });

  it("clamps computed remaining to zero when elapsed exceeds duration", () => {
    const monotonic = 12_345;
    const controller = new TimerStateController(new TestHost(), {
      monotonicNow: () => monotonic,
    });

    const wallNow = 9_000_000;
    const lastChanged = wallNow - 500_000;
    const state: MachineTimerViewState = {
      status: "running",
      durationSeconds: 60,
      lastChangedTs: lastChanged,
    };

    const seed = (controller as unknown as {
      seedRunningBaseline(
        entityState: MachineTimerViewState,
        wallNow: number,
      ): { remainingSeconds: number; monotonicT0: number; baselineEndMs: number } | undefined;
    }).seedRunningBaseline(state, wallNow);

    expect(seed).toBeDefined();
    expect(seed?.remainingSeconds).toBe(0);
    expect(seed?.baselineEndMs).toBe(monotonic);
  });
});

