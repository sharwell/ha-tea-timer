import { TeaTimerConfig, TeaTimerPresetDefinition } from "../model/config";
import { DurationBounds, formatDurationSeconds, normalizeDurationSeconds } from "../model/duration";
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
  isInteractive: boolean;
  aria: {
    label: string;
    valueText: string;
  };
}

export type PendingTimerAction = "none" | "start" | "restart";

export interface TeaTimerViewModelError {
  message: string;
  code?: string;
}

export interface TeaTimerViewModel {
  ui: {
    title: string;
    entityLabel: string;
    presets: TeaTimerPresetViewModel[];
    hasPresets: boolean;
    confirmRestart: boolean;
    pendingAction: PendingTimerAction;
    lastActionTs?: number;
    error?: TeaTimerViewModelError;
  };
  status: TimerStatus;
  dial: TeaTimerDialViewModel;
  selectedDurationSeconds: number;
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
  const stateDuration = state.durationSeconds ?? state.remainingSeconds;
  const previousStateDuration = previousState?.remainingSeconds ?? previousState?.durationSeconds;

  let selected = previousViewModel?.dial.selectedDurationSeconds;

  if (state.status !== "idle") {
    if (state.durationSeconds !== undefined) {
      selected = state.durationSeconds;
    } else if (stateDuration !== undefined) {
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
  pendingAction: PendingTimerAction,
): TeaTimerDialViewModel {
  const isInteractive = status === "idle" && pendingAction === "none";

  return {
    selectedDurationSeconds,
    bounds: { ...bounds },
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
  const dial = createDialViewModel(
    viewModel.dial.bounds,
    normalized,
    viewModel.status,
    viewModel.ui.pendingAction,
  );

  return {
    ...viewModel,
    dial,
    selectedDurationSeconds: dial.selectedDurationSeconds,
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

  const previousUi = options.previousViewModel?.ui;
  const dialBounds = config.dialBounds;
  const selectedDurationSeconds = normalizeSelectedDuration(state, dialBounds, options);
  const pendingAction = previousUi?.pendingAction ?? "none";
  const dial = createDialViewModel(dialBounds, selectedDurationSeconds, state.status, pendingAction);

  return {
    ui: {
      title: config.title?.trim() || STRINGS.cardTitleFallback,
      entityLabel: config.entity?.trim() || STRINGS.missingEntity,
      presets,
      hasPresets: presets.length > 0,
      confirmRestart: config.confirmRestart,
      pendingAction,
      lastActionTs: previousUi?.lastActionTs,
      error: previousUi?.error,
    },
    status: state.status,
    dial,
    selectedDurationSeconds,
  };
}

export function setPendingAction(
  viewModel: TeaTimerViewModel,
  action: PendingTimerAction,
  timestamp: number,
): TeaTimerViewModel {
  const pendingAction = action;
  const dial = createDialViewModel(
    viewModel.dial.bounds,
    viewModel.selectedDurationSeconds,
    viewModel.status,
    pendingAction,
  );

  return {
    ...viewModel,
    ui: {
      ...viewModel.ui,
      pendingAction,
      lastActionTs: timestamp,
    },
    dial,
  };
}

export function clearPendingAction(viewModel: TeaTimerViewModel): TeaTimerViewModel {
  if (viewModel.ui.pendingAction === "none") {
    return viewModel;
  }

  const dial = createDialViewModel(
    viewModel.dial.bounds,
    viewModel.selectedDurationSeconds,
    viewModel.status,
    "none",
  );

  return {
    ...viewModel,
    ui: {
      ...viewModel.ui,
      pendingAction: "none",
    },
    dial,
  };
}

export function setViewModelError(
  viewModel: TeaTimerViewModel,
  error: TeaTimerViewModelError | undefined,
): TeaTimerViewModel {
  return {
    ...viewModel,
    ui: {
      ...viewModel.ui,
      error,
    },
  };
}
