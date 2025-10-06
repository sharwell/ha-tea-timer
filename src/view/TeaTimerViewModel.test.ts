import { describe, expect, it } from "vitest";
import {
  applyPresetSelection,
  applyQueuedPreset,
  clearQueuedPreset,
  createTeaTimerViewModel,
  CUSTOM_PRESET_ID,
  queuePresetSelection,
  updateDialSelection,
} from "./TeaTimerViewModel";
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
  finishedAutoIdleMs: 5000,
  clockSkewEstimatorEnabled: true,
  showPlusButton: true,
  plusButtonIncrementSeconds: 60,
  maxExtendSeconds: undefined,
  showPauseResume: true,
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
    expect(viewModel.ui.presets[0].id).toBe(0);
    expect(viewModel.dial.selectedDurationSeconds).toBe(120);
    expect(viewModel.dial.bounds).toEqual(config.dialBounds);
    expect(viewModel.selectedDurationSeconds).toBe(120);
    expect(viewModel.pendingDurationSeconds).toBe(120);
    expect(viewModel.ui.selectedPresetId).toBe(0);
    expect(viewModel.ui.isCustomDuration).toBe(false);
    expect(viewModel.ui.confirmRestart).toBe(false);
    expect(viewModel.ui.pendingAction).toBe("none");
    expect(viewModel.ui.showPauseResumeButton).toBe(true);
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
    expect(viewModel.pendingDurationSeconds).toBe(config.dialBounds.min);
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
    expect(nextViewModel.pendingDurationSeconds).toBe(305);
    expect(nextViewModel.ui.selectedPresetId).toBe(CUSTOM_PRESET_ID);
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
    expect(viewModel.pendingDurationSeconds).toBe(260);
    expect(viewModel.ui.selectedPresetId).toBe(CUSTOM_PRESET_ID);
  });

  it("selects the configured default preset on first load", () => {
    const configWithDefault: TeaTimerConfig = {
      ...config,
      defaultPresetId: 1,
    };

    const state: TimerViewState = { status: "idle" };
    const viewModel = createTeaTimerViewModel(configWithDefault, state);

    expect(viewModel.ui.selectedPresetId).toBe(1);
    expect(viewModel.pendingDurationSeconds).toBe(240);
    expect(viewModel.ui.isCustomDuration).toBe(false);
  });
});

describe("preset helpers", () => {
  it("queues and applies presets", () => {
    const state: TimerViewState = { status: "running", durationSeconds: 240 };
    const base = createTeaTimerViewModel(config, state);
    const queued = queuePresetSelection(base, 0);
    expect(queued.ui.queuedPresetId).toBe(0);
    expect(queued.pendingDurationSeconds).toBe(120);

    const applied = applyQueuedPreset(queued);
    expect(applied.ui.queuedPresetId).toBeUndefined();
    expect(applied.ui.selectedPresetId).toBe(0);
    expect(applied.pendingDurationSeconds).toBe(120);
  });

  it("clears queued preset when deselected", () => {
    const state: TimerViewState = { status: "running", durationSeconds: 240 };
    const base = createTeaTimerViewModel(config, state);
    const queued = queuePresetSelection(base, 0);
    const cleared = clearQueuedPreset(queued);
    expect(cleared.ui.queuedPresetId).toBeUndefined();
    expect(cleared.pendingDurationSeconds).toBe(cleared.selectedDurationSeconds);
  });

  it("applies preset selection for idle", () => {
    const state: TimerViewState = { status: "idle" };
    const base = createTeaTimerViewModel(config, state);
    const applied = applyPresetSelection(base, 1);
    expect(applied.ui.selectedPresetId).toBe(1);
    expect(applied.pendingDurationSeconds).toBe(240);
    expect(applied.ui.isCustomDuration).toBe(false);
  });

  it("preserves preset identity when durations are duplicated", () => {
    const duplicatedConfig: TeaTimerConfig = {
      ...config,
      presets: [
        { label: "Coffee", durationSeconds: 240 },
        { label: "Black Tea", durationSeconds: 240 },
      ],
    };
    const state: TimerViewState = { status: "idle", durationSeconds: 240, remainingSeconds: 240 };

    const base = createTeaTimerViewModel(duplicatedConfig, state);
    const selected = applyPresetSelection(base, 1);
    expect(selected.ui.selectedPresetId).toBe(1);

    const afterDial = updateDialSelection(selected, 240);
    expect(afterDial.ui.selectedPresetId).toBe(1);

    const recomputed = createTeaTimerViewModel(duplicatedConfig, state, {
      previousState: state,
      previousViewModel: afterDial,
    });
    expect(recomputed.ui.selectedPresetId).toBe(1);
    expect(recomputed.ui.isCustomDuration).toBe(false);
  });
});
