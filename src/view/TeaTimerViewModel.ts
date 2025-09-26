import { TeaTimerConfig, TeaTimerPresetDefinition } from "../model/config";
import {
  DurationBounds,
  durationToAngleRadians,
  formatDurationSeconds,
  normalizeDurationSeconds,
} from "../model/duration";
import { STRINGS } from "../strings";
import type { TimerStatus, TimerViewState } from "../state/TimerStateMachine";

export interface TeaTimerPresetViewModel {
  label: string;
  durationLabel: string;
  durationSeconds: number;
}

export interface TeaTimerDialViewModel {
  selectedDurationSeconds: number;
  bounds: DurationBounds;
  visual: { angleRadians: number };
  isInteractive: boolean;
  aria: {
    label: string;
    valueText: string;
  };
}

export interface TeaTimerViewModel {
  ui: {
    title: string;
    entityLabel: string;
    presets: TeaTimerPresetViewModel[];
    hasPresets: boolean;
  };
  status: TimerStatus;
  dial: TeaTimerDialViewModel;
}

export interface CreateTeaTimerViewModelOptions {
  previousState?: TimerViewState;
  previousViewModel?: TeaTimerViewModel;
}

function normalizeSelectedDuration(
  state: TimerViewState,
  bounds: DurationBounds,
  options: CreateTeaTimerViewModelOptions,
): number {
  const previousState = options.previousState;
  const previousViewModel = options.previousViewModel;
  const stateDuration = state.remainingSeconds ?? state.durationSeconds;
  const previousStateDuration = previousState?.remainingSeconds ?? previousState?.durationSeconds;

  let selected = previousViewModel?.dial.selectedDurationSeconds;

  if (state.status !== "idle") {
    if (stateDuration !== undefined) {
      selected = stateDuration;
    }
  } else {
    if (selected === undefined) {
      selected = stateDuration ?? bounds.min;
    } else if (previousState?.status !== "idle" && stateDuration !== undefined) {
      selected = stateDuration;
    } else if (stateDuration !== undefined && previousStateDuration !== stateDuration) {
      selected = stateDuration;
    }
  }

  if (selected === undefined) {
    selected = bounds.min;
  }

  return normalizeDurationSeconds(selected, bounds);
}

function createDialViewModel(
  bounds: DurationBounds,
  selectedDurationSeconds: number,
  status: TimerStatus,
): TeaTimerDialViewModel {
  const angleRadians = durationToAngleRadians(selectedDurationSeconds, bounds);
  const isInteractive = status === "idle";

  return {
    selectedDurationSeconds,
    bounds: { ...bounds },
    visual: { angleRadians },
    isInteractive,
    aria: {
      label: STRINGS.dialLabel,
      valueText: formatDurationSeconds(selectedDurationSeconds),
    },
  };
}

export function updateDialSelection(
  viewModel: TeaTimerViewModel,
  selectedDurationSeconds: number,
): TeaTimerViewModel {
  const normalized = normalizeDurationSeconds(selectedDurationSeconds, viewModel.dial.bounds);
  const dial = createDialViewModel(viewModel.dial.bounds, normalized, viewModel.status);

  return {
    ...viewModel,
    dial,
  };
}

export function createTeaTimerViewModel(
  config: TeaTimerConfig,
  state: TimerViewState,
  options: CreateTeaTimerViewModelOptions = {},
): TeaTimerViewModel {
  const presets = config.presets.map((preset: TeaTimerPresetDefinition) => ({
    label: preset.label,
    durationLabel: formatDurationSeconds(preset.durationSeconds),
    durationSeconds: preset.durationSeconds,
  }));

  const dialBounds = config.dialBounds;
  const selectedDurationSeconds = normalizeSelectedDuration(state, dialBounds, options);
  const dial = createDialViewModel(dialBounds, selectedDurationSeconds, state.status);

  return {
    ui: {
      title: config.title?.trim() || STRINGS.cardTitleFallback,
      entityLabel: config.entity?.trim() || STRINGS.missingEntity,
      presets,
      hasPresets: presets.length > 0,
    },
    status: state.status,
    dial,
  };
}
