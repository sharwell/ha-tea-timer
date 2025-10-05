import { TeaTimerConfig, TeaTimerPresetDefinition } from "../model/config";
import { DurationBounds, formatDurationSeconds, normalizeDurationSeconds } from "../model/duration";
import { STRINGS } from "../strings";
import type { TimerStatus, TimerViewState } from "../state/TimerStateMachine";

export const CUSTOM_PRESET_ID = "custom" as const;

export type TeaTimerPresetId = number | typeof CUSTOM_PRESET_ID;

export interface TeaTimerPresetViewModel {
  id: number;
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
    selectedPresetId?: TeaTimerPresetId;
    queuedPresetId?: TeaTimerPresetId;
    isCustomDuration: boolean;
    lastActionTs?: number;
    error?: TeaTimerViewModelError;
    showExtendButton: boolean;
    extendIncrementSeconds: number;
    extendIncrementLabel: string;
    maxExtendSeconds?: number;
  };
  status: TimerStatus;
  dial: TeaTimerDialViewModel;
  selectedDurationSeconds: number;
  pendingDurationSeconds: number;
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
  } else if (selected === undefined) {
    selected = stateDuration ?? bounds.min;
  } else if (previousState?.status !== "idle" && stateDuration !== undefined) {
    selected = stateDuration;
  } else if (stateDuration !== undefined && previousStateDuration !== stateDuration) {
    selected = stateDuration;
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

function createPresetViewModels(
  presets: TeaTimerPresetDefinition[],
  bounds: DurationBounds,
): TeaTimerPresetViewModel[] {
  return presets.map((preset, index) => {
    const durationSeconds = normalizeDurationSeconds(preset.durationSeconds, bounds);
    return {
      id: index,
      label: preset.label,
      durationSeconds,
      durationLabel: formatDurationSeconds(durationSeconds),
    };
  });
}

function findPresetId(
  presets: TeaTimerPresetViewModel[],
  durationSeconds: number,
  preferredId?: number,
): number | undefined {
  if (typeof preferredId === "number") {
    const preferred = presets.find((preset) => preset.id === preferredId);
    if (preferred && preferred.durationSeconds === durationSeconds) {
      return preferredId;
    }
  }

  return presets.find((preset) => preset.durationSeconds === durationSeconds)?.id;
}

function resolveDefaultPresetId(
  config: TeaTimerConfig,
  presets: TeaTimerPresetViewModel[],
): number | undefined {
  if (!presets.length) {
    return undefined;
  }

  const defaultIndex = config.defaultPresetId;
  if (typeof defaultIndex === "number" && defaultIndex >= 0 && defaultIndex < presets.length) {
    return defaultIndex;
  }

  return presets.length ? 0 : undefined;
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
  const hasPresets = viewModel.ui.presets.length > 0;
  let selectedPresetId: TeaTimerPresetId | undefined;
  if (hasPresets) {
    const previousSelected =
      typeof viewModel.ui.selectedPresetId === "number" ? viewModel.ui.selectedPresetId : undefined;
    const match = findPresetId(viewModel.ui.presets, normalized, previousSelected);
    selectedPresetId = match !== undefined ? match : CUSTOM_PRESET_ID;
  } else {
    selectedPresetId = undefined;
  }

  return {
    ...viewModel,
    dial,
    selectedDurationSeconds: dial.selectedDurationSeconds,
    pendingDurationSeconds: dial.selectedDurationSeconds,
    ui: {
      ...viewModel.ui,
      selectedPresetId,
      queuedPresetId: undefined,
      isCustomDuration: hasPresets && selectedPresetId === CUSTOM_PRESET_ID,
    },
  };
}

export function createTeaTimerViewModel(
  config: TeaTimerConfig,
  state: TimerViewState,
  options: CreateTeaTimerViewModelOptions = {},
): TeaTimerViewModel {
  const dialBounds = config.dialBounds;
  const presets = createPresetViewModels(config.presets, dialBounds);
  const hasPresets = presets.length > 0;
  const previousViewModel = options.previousViewModel;
  const previousUi = previousViewModel?.ui;
  const previousState = options.previousState;
  const pendingAction = previousUi?.pendingAction ?? "none";

  let selectedDurationSeconds = normalizeSelectedDuration(state, dialBounds, options);
  const defaultPresetId = resolveDefaultPresetId(config, presets);

  const applyDefaultPreset =
    hasPresets &&
    defaultPresetId !== undefined &&
    state.status === "idle" &&
    (previousViewModel === undefined || previousState?.status !== "idle");

  if (applyDefaultPreset) {
    const preset = presets[defaultPresetId];
    if (preset) {
      selectedDurationSeconds = preset.durationSeconds;
    }
  }

  const dial = createDialViewModel(dialBounds, selectedDurationSeconds, state.status, pendingAction);

  let selectedPresetId: TeaTimerPresetId | undefined = previousUi?.selectedPresetId;
  let queuedPresetId: TeaTimerPresetId | undefined = previousUi?.queuedPresetId;
  let isCustomDuration = previousUi?.isCustomDuration ?? false;

  if (queuedPresetId !== undefined && typeof queuedPresetId === "number") {
    if (!presets.some((preset) => preset.id === queuedPresetId)) {
      queuedPresetId = undefined;
    }
  }

  const previousSelectedId =
    typeof previousUi?.selectedPresetId === "number" ? previousUi.selectedPresetId : undefined;
  const dialMatch = hasPresets
    ? findPresetId(presets, dial.selectedDurationSeconds, previousSelectedId)
    : undefined;
  if (dialMatch !== undefined) {
    selectedPresetId = dialMatch;
    isCustomDuration = false;
  } else if (hasPresets) {
    selectedPresetId = CUSTOM_PRESET_ID;
    isCustomDuration = true;
  } else {
    selectedPresetId = undefined;
    isCustomDuration = false;
  }

  let pendingDurationSeconds = previousViewModel?.pendingDurationSeconds ?? dial.selectedDurationSeconds;

  if (applyDefaultPreset) {
    const preset = presets[defaultPresetId];
    if (preset) {
      selectedPresetId = preset.id;
      queuedPresetId = undefined;
      isCustomDuration = false;
      pendingDurationSeconds = preset.durationSeconds;
    }
  } else if (queuedPresetId !== undefined && typeof queuedPresetId === "number") {
    const preset = presets.find((item) => item.id === queuedPresetId);
    if (preset) {
      pendingDurationSeconds = preset.durationSeconds;
    } else {
      queuedPresetId = undefined;
      pendingDurationSeconds = dial.selectedDurationSeconds;
    }
  } else if (selectedPresetId !== CUSTOM_PRESET_ID && typeof selectedPresetId === "number") {
    const preset = presets.find((item) => item.id === selectedPresetId);
    if (preset) {
      pendingDurationSeconds = preset.durationSeconds;
      isCustomDuration = false;
    } else if (hasPresets) {
      selectedPresetId = CUSTOM_PRESET_ID;
      isCustomDuration = true;
      pendingDurationSeconds = dial.selectedDurationSeconds;
    }
  } else {
    pendingDurationSeconds = dial.selectedDurationSeconds;
  }

  if (!hasPresets) {
    queuedPresetId = undefined;
    pendingDurationSeconds = dial.selectedDurationSeconds;
  }

  return {
    ui: {
      title: config.title?.trim() || STRINGS.cardTitleFallback,
      entityLabel: config.entity?.trim() || STRINGS.missingEntity,
      presets,
      hasPresets,
      confirmRestart: config.confirmRestart,
      pendingAction,
      selectedPresetId,
      queuedPresetId,
      isCustomDuration,
      lastActionTs: previousUi?.lastActionTs,
      error: previousUi?.error,
      showExtendButton: config.showPlusButton,
      extendIncrementSeconds: config.plusButtonIncrementSeconds,
      extendIncrementLabel: `+${formatDurationSeconds(config.plusButtonIncrementSeconds)}`,
      maxExtendSeconds: config.maxExtendSeconds,
    },
    status: state.status,
    dial,
    selectedDurationSeconds: dial.selectedDurationSeconds,
    pendingDurationSeconds,
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

export function applyPresetSelection(
  viewModel: TeaTimerViewModel,
  presetId: number,
): TeaTimerViewModel {
  const preset = viewModel.ui.presets.find((item) => item.id === presetId);
  if (!preset) {
    return viewModel;
  }

  const dial = createDialViewModel(
    viewModel.dial.bounds,
    preset.durationSeconds,
    viewModel.status,
    viewModel.ui.pendingAction,
  );

  return {
    ...viewModel,
    dial,
    selectedDurationSeconds: preset.durationSeconds,
    pendingDurationSeconds: preset.durationSeconds,
    ui: {
      ...viewModel.ui,
      selectedPresetId: preset.id,
      queuedPresetId: undefined,
      isCustomDuration: false,
    },
  };
}

export function queuePresetSelection(
  viewModel: TeaTimerViewModel,
  presetId: number,
): TeaTimerViewModel {
  const preset = viewModel.ui.presets.find((item) => item.id === presetId);
  if (!preset) {
    return viewModel;
  }

  return {
    ...viewModel,
    pendingDurationSeconds: preset.durationSeconds,
    ui: {
      ...viewModel.ui,
      queuedPresetId: preset.id,
    },
  };
}

export function clearQueuedPreset(viewModel: TeaTimerViewModel): TeaTimerViewModel {
  if (viewModel.ui.queuedPresetId === undefined) {
    return viewModel;
  }

  return {
    ...viewModel,
    pendingDurationSeconds: viewModel.selectedDurationSeconds,
    ui: {
      ...viewModel.ui,
      queuedPresetId: undefined,
    },
  };
}

export function applyQueuedPreset(viewModel: TeaTimerViewModel): TeaTimerViewModel {
  const queuedId = viewModel.ui.queuedPresetId;
  if (typeof queuedId !== "number") {
    return clearQueuedPreset(viewModel);
  }

  const preset = viewModel.ui.presets.find((item) => item.id === queuedId);
  if (!preset) {
    return clearQueuedPreset(viewModel);
  }

  const dial = createDialViewModel(
    viewModel.dial.bounds,
    preset.durationSeconds,
    viewModel.status,
    viewModel.ui.pendingAction,
  );

  return {
    ...viewModel,
    dial,
    selectedDurationSeconds: preset.durationSeconds,
    pendingDurationSeconds: preset.durationSeconds,
    ui: {
      ...viewModel.ui,
      selectedPresetId: preset.id,
      queuedPresetId: undefined,
      isCustomDuration: false,
    },
  };
}

export function getPresetById(
  viewModel: TeaTimerViewModel,
  presetId: number,
): TeaTimerPresetViewModel | undefined {
  return viewModel.ui.presets.find((preset) => preset.id === presetId);
}
