export interface StringTable {
  cardTitleFallback: string;
  emptyState: string;
  missingEntity: string;
  draftNote: string;
  gettingStartedLabel: string;
  gettingStartedUrl: string;
  finishAutomationLabel: string;
  finishAutomationUrl: string;
  presetsGroupLabel: string;
  presetsMissing: string;
  presetsCustomLabel: string;
  presetsQueuedLabel: (label: string, durationLabel: string) => string;
  statusIdle: string;
  statusRunning: string;
  statusFinished: string;
  statusUnavailable: string;
  timerFinished: string;
  timerUnavailable: string;
  timeUnknown: string;
  remainingEstimateNotice: string;
  dialLabel: string;
  dialBlockedTooltip: string;
  ariaIdle: string;
  ariaRunning: string;
  ariaFinished: string;
  ariaUnavailable: string;
  ariaStarting: (durationLabel: string) => string;
  ariaRestarting: (durationLabel: string) => string;
  pendingStartLabel: string;
  pendingRestartLabel: string;
  toastStartFailed: string;
  toastRestartFailed: string;
  toastEntityUnavailable: (entityId: string) => string;
  restartConfirmMessage: (durationLabel: string) => string;
  restartConfirmConfirm: string;
  restartConfirmCancel: string;
  entityUnavailableWithId: (entityId: string) => string;
  validation: {
    notAnObject: string;
    entityRequired: string;
    presetsTooLong: string;
    presetsInvalidType: string;
    presetInvalid: string;
    presetDurationInvalid: string;
    minDurationInvalid: string;
    maxDurationInvalid: string;
    stepSecondsInvalid: string;
    durationBoundsInvalid: string;
    reservedOption: (name: string) => string;
  };
}

export const STRINGS: StringTable = {
  cardTitleFallback: "Tea Timer",
  emptyState: "Configure an entity and presets to get started.",
  missingEntity: "Timer entity not configured.",
  draftNote: "This is a preview of the Tea Timer Card. Functionality will be enabled in upcoming updates.",
  gettingStartedLabel: "Getting Started",
  gettingStartedUrl: "https://github.com/sharwell/ha-tea-timer/blob/main/docs/getting-started.md",
  finishAutomationLabel: "Automate timer finish",
  finishAutomationUrl: "https://github.com/sharwell/ha-tea-timer/blob/main/docs/automations/finished.md",
  presetsGroupLabel: "Presets",
  presetsMissing: "Add at least one preset to start brewing.",
  presetsCustomLabel: "Custom duration",
  presetsQueuedLabel: (label: string, durationLabel: string) =>
    `Next: ${label} ${durationLabel}`,
  statusIdle: "Idle",
  statusRunning: "Running",
  statusFinished: "Finished",
  statusUnavailable: "Entity unavailable",
  timerFinished: "Done",
  timerUnavailable: "Unavailable",
  timeUnknown: "--:--",
  remainingEstimateNotice: "Time remaining is estimated (waiting for Home Assistant update).",
  dialLabel: "Brew duration",
  dialBlockedTooltip: "Timer is running—cannot change duration.",
  ariaIdle: "Timer idle.",
  ariaRunning: "Timer running.",
  ariaFinished: "Timer finished.",
  ariaUnavailable: "Timer unavailable.",
  ariaStarting: (durationLabel: string) => "Starting timer for " + durationLabel + ".",
  ariaRestarting: (durationLabel: string) => "Restarting timer for " + durationLabel + ".",
  pendingStartLabel: "Starting…",
  pendingRestartLabel: "Restarting…",
  toastStartFailed: "Couldn't start the timer. Please try again.",
  toastRestartFailed: "Couldn't restart the timer. Please try again.",
  toastEntityUnavailable: (entityId: string) => "Timer entity " + entityId + " is unavailable.",
  restartConfirmMessage: (durationLabel: string) => "Restart the timer for " + durationLabel + "?",
  restartConfirmConfirm: "Restart",
  restartConfirmCancel: "Cancel",
  entityUnavailableWithId: (entityId: string) => `Entity unavailable (${entityId}).`,
  validation: {
    notAnObject: "Card configuration must be an object.",
    entityRequired: "The \"entity\" option is required.",
    presetsTooLong: "Presets are limited to a maximum of 8 items.",
    presetsInvalidType: "Presets must be an array of preset definitions.",
    presetInvalid: "Each preset must be an object with a label and durationSeconds.",
    presetDurationInvalid: "Preset durations must be positive numbers of seconds.",
    minDurationInvalid: "minDurationSeconds must be a non-negative number of seconds.",
    maxDurationInvalid: "maxDurationSeconds must be a positive number of seconds.",
    stepSecondsInvalid: "stepSeconds must be a positive number of seconds.",
    durationBoundsInvalid: "maxDurationSeconds must be greater than minDurationSeconds.",
    reservedOption: (name: string) => `The "${name}" option is reserved for a future release.`,
  },
};
