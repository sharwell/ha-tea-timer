import { describe, expect, it } from "vitest";
import { TimerStateMachine, normalizeTimerEntity } from "./TimerStateMachine";
import type { HassEntity } from "../types/home-assistant";

function createEntity(options: {
  entity_id?: string;
  state: string;
  duration?: string;
  remaining?: string;
  lastChangedOffsetMs?: number;
}): HassEntity {
  const now = Date.now();
  const lastChanged = new Date(now - (options.lastChangedOffsetMs ?? 0)).toISOString();

  return {
    entity_id: options.entity_id ?? "timer.test_timer",
    state: options.state,
    attributes: {
      duration: options.duration,
      remaining: options.remaining,
    },
    last_changed: lastChanged,
    last_updated: lastChanged,
  };
}

describe("normalizeTimerEntity", () => {
  it("maps active entity to running", () => {
    const now = Date.now();
    const entity = createEntity({
      state: "active",
      duration: "0:05:00",
      remaining: "0:04:30",
      lastChangedOffsetMs: 30_000,
    });

    const state = normalizeTimerEntity(entity, now);

    expect(state.status).toBe("running");
    expect(state.remainingSeconds).toBe(270);
    expect(state.durationSeconds).toBe(300);
  });

  it("derives remaining time when missing", () => {
    const now = Date.now();
    const entity = createEntity({
      state: "active",
      duration: "0:05:00",
      lastChangedOffsetMs: 120_000,
    });

    const state = normalizeTimerEntity(entity, now);

    expect(state.status).toBe("running");
    expect(state.remainingSeconds).toBe(180);
    expect(state.remainingIsEstimated).toBe(true);
  });
});

describe("TimerStateMachine", () => {
  it("keeps finished overlay for configured duration", () => {
    const start = Date.now();
    let clock = start;
    const machine = new TimerStateMachine({
      finishedOverlayMs: 5000,
      now: () => clock,
    });

    const runningEntity = createEntity({
      state: "active",
      duration: "0:00:30",
      remaining: "0:00:05",
      lastChangedOffsetMs: 25_000,
    });

    machine.updateFromEntity(runningEntity, clock);
    expect(machine.state.status).toBe("running");

    machine.markFinished(clock);
    expect(machine.state.status).toBe("finished");
    expect(machine.state.finishedUntilTs).toBe(start + 5000);

    clock += 2000;
    const idleEntity = createEntity({
      state: "idle",
      duration: "0:00:30",
    });
    machine.updateFromEntity(idleEntity, clock);
    expect(machine.state.status).toBe("finished");

    clock += 4000;
    machine.handleTimeAdvance(clock);
    expect(machine.state.status).toBe("idle");
    expect(machine.state.finishedUntilTs).toBeUndefined();
  });

  it("stays idle when no finished event is received", () => {
    const start = Date.now();
    const machine = new TimerStateMachine({
      finishedOverlayMs: 5000,
      now: () => start,
    });

    const runningEntity = createEntity({
      state: "active",
      duration: "0:00:10",
      remaining: "0:00:04",
      lastChangedOffsetMs: 6000,
    });

    machine.updateFromEntity(runningEntity, start);
    expect(machine.state.status).toBe("running");

    const idleEntity = createEntity({
      state: "idle",
      duration: "0:00:10",
      remaining: "0:00:10",
    });

    machine.updateFromEntity(idleEntity, start + 2000);
    expect(machine.state.status).toBe("idle");
    expect(machine.state.finishedUntilTs).toBeUndefined();
  });

  it("handles extremely short timers without flicker", () => {
    const start = Date.now();
    let clock = start;
    const machine = new TimerStateMachine({
      finishedOverlayMs: 5000,
      now: () => clock,
    });

    const runningEntity = createEntity({
      state: "active",
      duration: "0:00:02",
      remaining: "0:00:01",
      lastChangedOffsetMs: 1000,
    });

    machine.updateFromEntity(runningEntity, clock);
    expect(machine.state.status).toBe("running");

    machine.markFinished(clock);
    expect(machine.state.status).toBe("finished");

    const stillActive = createEntity({
      state: "active",
      duration: "0:00:02",
      remaining: undefined,
      lastChangedOffsetMs: 2000,
    });

    machine.updateFromEntity(stillActive, clock + 10);
    expect(machine.state.status).toBe("finished");

    const idleEntity = createEntity({
      state: "idle",
      duration: "0:00:02",
    });

    machine.updateFromEntity(idleEntity, clock + 20);
    expect(machine.state.status).toBe("finished");

    clock += 6000;
    machine.handleTimeAdvance(clock);
    expect(machine.state.status).toBe("idle");
  });

  it("detects large drift when estimating remaining", () => {
    const start = Date.now();
    const machine = new TimerStateMachine({ finishedOverlayMs: 5000, now: () => start });
    const entity = createEntity({
      state: "active",
      duration: "0:01:00",
      lastChangedOffsetMs: 600_000,
    });

    const state = machine.updateFromEntity(entity, start);

    expect(state.remainingIsEstimated).toBe(true);
    expect(state.estimationDriftSeconds ?? 0).toBeGreaterThanOrEqual(540);
  });

  it("clears to unavailable when no entity provided", () => {
    const machine = new TimerStateMachine({ finishedOverlayMs: 5000 });
    machine.updateFromEntity(undefined);
    expect(machine.state.status).toBe("unavailable");

    machine.markFinished();
    expect(machine.state.status).toBe("finished");

    machine.clear();
    expect(machine.state.status).toBe("unavailable");
  });

  it("applies updated finished overlay duration", () => {
    const start = Date.now();
    const clock = start;
    const machine = new TimerStateMachine({ finishedOverlayMs: 5000, now: () => clock });

    const entity = createEntity({
      state: "idle",
      duration: "0:00:10",
    });

    machine.updateFromEntity(entity, clock);
    machine.setFinishedOverlayMs(1000);
    machine.markFinished(clock);

    expect(machine.state.finishedUntilTs).toBe(start + 1000);
  });
});
