import { describe, expect, it } from "vitest";
import { createTeaTimerViewModel, updateDialSelection } from "./TeaTimerViewModel";
import { TeaTimerConfig } from "../model/config";
import type { TimerViewState } from "../state/TimerStateMachine";

const config: TeaTimerConfig = {
  type: "custom:tea-timer-card",
  title: "Kitchen Timer",
  entity: "timer.kitchen",
  presets: [
    { label: "Green", durationSeconds: 120 },
    { label: "Black", durationSeconds: 240 },
  ],
  cardInstanceId: "test",
  dialBounds: { min: 15, max: 1200, step: 5 },
  confirmRestart: false,
};

describe("createTeaTimerViewModel", () => {
  it("maps config to view model", () => {
    const state: TimerViewState = {
      status: "idle",
      durationSeconds: 180,
      remainingSeconds: 180,
    };

    const viewModel = createTeaTimerViewModel(config, state);

    expect(viewModel.ui.title).toBe("Kitchen Timer");
    expect(viewModel.ui.entityLabel).toBe("timer.kitchen");
    expect(viewModel.ui.presets).toHaveLength(2);
    expect(viewModel.ui.presets[0].durationLabel).toBe("2:00");
    expect(viewModel.dial.selectedDurationSeconds).toBe(180);
    expect(viewModel.dial.bounds).toEqual(config.dialBounds);
    expect(viewModel.selectedDurationSeconds).toBe(180);
    expect(viewModel.ui.confirmRestart).toBe(false);
    expect(viewModel.ui.pendingAction).toBe("none");
  });

  it("falls back to defaults when title missing", () => {
    const state: TimerViewState = { status: "idle" };
    const viewModel = createTeaTimerViewModel(
      { ...config, title: undefined, entity: undefined, presets: [] },
      state,
    );

    expect(viewModel.ui.title).toBe("Tea Timer");
    expect(viewModel.ui.entityLabel).toBe("Timer entity not configured.");
    expect(viewModel.ui.hasPresets).toBe(false);
    expect(viewModel.dial.selectedDurationSeconds).toBe(config.dialBounds.min);
    expect(viewModel.selectedDurationSeconds).toBe(config.dialBounds.min);
  });

  it("retains user-selected duration while idle when state unchanged", () => {
    const initialState: TimerViewState = {
      status: "idle",
      durationSeconds: 180,
      remainingSeconds: 180,
    };

    const initialViewModel = createTeaTimerViewModel(config, initialState);
    const adjusted = updateDialSelection(initialViewModel, 305);
    const nextState: TimerViewState = { ...initialState };
    const nextViewModel = createTeaTimerViewModel(config, nextState, {
      previousState: initialState,
      previousViewModel: adjusted,
    });

    expect(nextViewModel.dial.selectedDurationSeconds).toBe(305);
    expect(nextViewModel.selectedDurationSeconds).toBe(305);
  });

  it("syncs to Home Assistant updates when idle duration changes", () => {
    const initialState: TimerViewState = {
      status: "idle",
      durationSeconds: 200,
      remainingSeconds: 200,
    };

    const initialViewModel = createTeaTimerViewModel(config, initialState);
    const adjusted = updateDialSelection(initialViewModel, 600);
    const updatedState: TimerViewState = {
      status: "idle",
      durationSeconds: 260,
      remainingSeconds: 260,
    };

    const viewModel = createTeaTimerViewModel(config, updatedState, {
      previousState: initialState,
      previousViewModel: adjusted,
    });

    expect(viewModel.dial.selectedDurationSeconds).toBe(260);
    expect(viewModel.selectedDurationSeconds).toBe(260);
  });
});
