import type { TimerStateController } from "../../src/state/TimerStateController";
import type { TimerViewState as MachineTimerViewState } from "../../src/state/TimerStateMachine";

export interface SeedResult {
  remainingSeconds: number;
  monotonicT0: number;
  baselineEndMs: number;
}

export const callSeedRunningBaseline = (
  controller: TimerStateController,
  entityState: MachineTimerViewState,
  wallNow: number,
): SeedResult | undefined =>
  (controller as unknown as {
    seedRunningBaseline(
      entityState: MachineTimerViewState,
      wallNow: number,
    ): SeedResult | undefined;
  }).seedRunningBaseline(entityState, wallNow);
