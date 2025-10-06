export interface StringTable {
  cardTitleFallback: string;
  emptyState: string;
  missingEntity: string;
  draftNote: string;
  interactionHintDoubleTapRestart: string;
  interactionHintLongPressRestart: string;
  interactionHintLongPressPresetPicker: string;
  interactionHintLongPressMenu: string;
  interactionHintDismiss: string;
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
  statusPaused: string;
  statusFinished: string;
  statusUnavailable: string;
  statusDisconnected: string;
  statusReconnecting: string;
  statusError: string;
  timerFinished: string;
  timerUnavailable: string;
  timeUnknown: string;
  remainingEstimateNotice: string;
  dialLabel: string;
  dialBlockedTooltip: string;
  disconnectedMessage: string;
  disconnectedReconnectingMessage: string;
  entityUnavailableBanner: (entityId: string) => string;
  serviceFailureMessage: string;
  durationSpeech: {
    hour: (value: number) => string;
    minute: (value: number) => string;
    second: (value: number) => string;
    list: (parts: string[]) => string;
  };
  ariaIdle: string;
  ariaRunning: string;
  ariaPaused: string;
  ariaFinished: string;
  ariaUnavailable: string;
  ariaStarting: (durationSpeech: string) => string;
  ariaRestarting: (durationSpeech: string) => string;
  ariaPausedAnnouncement: string;
  ariaResumedAnnouncement: string;
  ariaFinishedWithDuration: (durationSpeech: string) => string;
  ariaRemaining: (durationSpeech: string) => string;
  ariaQueuedPreset: (label: string, durationSpeech: string) => string;
  ariaQueuedCustom: (durationSpeech: string) => string;
  extendButtonAriaLabel: (durationSpeech: string) => string;
  ariaExtendAdded: (durationSpeech: string, remainingLabel: string) => string;
  ariaExtendCapReached: string;
  ariaExtendRaceLost: string;
  pendingStartLabel: string;
  pendingRestartLabel: string;
  toastStartFailed: string;
  toastRestartFailed: string;
  toastExtendFailed: string;
  toastPauseFailed: string;
  toastResumeFailed: string;
  toastPauseHelperMissing: string;
  toastPauseRemainingUnknown: string;
  toastEntityUnavailable: (entityId: string) => string;
  restartConfirmMessage: (durationLabel: string) => string;
  restartConfirmConfirm: string;
  restartConfirmCancel: string;
  primaryActionStart: string;
  primaryActionRestart: string;
  pauseButtonLabel: string;
  pauseButtonAriaLabel: string;
  resumeButtonLabel: string;
  resumeButtonAriaLabel: string;
  primaryActionStartLabel: (
    durationSpeech: string,
    presetLabel?: string,
    queued?: boolean,
  ) => string;
  primaryActionRestartLabel: (
    durationSpeech: string,
    presetLabel?: string,
    queued?: boolean,
  ) => string;
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
    plusButtonIncrementInvalid: string;
    maxExtendInvalid: string;
    tapActionModeInvalid: string;
    doubleTapWindowInvalid: string;
    longPressActionInvalid: string;
  };
}

export const STRINGS: StringTable = {
  cardTitleFallback: "Tea Timer",
  emptyState: "Configure an entity and presets to get started.",
  missingEntity: "Timer entity not configured.",
  draftNote: "This is a preview of the Tea Timer Card. Functionality will be enabled in upcoming updates.",
  interactionHintDoubleTapRestart: "Tip: Double-tap the card to restart while it is running.",
  interactionHintLongPressRestart: "Tip: Long-press the card to restart while it is running.",
  interactionHintLongPressPresetPicker: "Tip: Long-press to focus the preset list.",
  interactionHintLongPressMenu: "Tip: Long-press to open the Lovelace card menu.",
  interactionHintDismiss: "Dismiss",
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
  statusPaused: "Paused",
  statusFinished: "Finished",
  statusUnavailable: "Entity unavailable",
  statusDisconnected: "Disconnected",
  statusReconnecting: "Reconnecting",
  statusError: "Error",
  timerFinished: "Done",
  timerUnavailable: "Unavailable",
  timeUnknown: "--:--",
  remainingEstimateNotice: "Time remaining is estimated (waiting for Home Assistant update).",
  dialLabel: "Brew duration",
  dialBlockedTooltip: "Timer is running—cannot change duration.",
  disconnectedMessage:
    "Disconnected from Home Assistant. Controls are paused until the link returns.",
  disconnectedReconnectingMessage: "Connection lost—trying to reconnect to Home Assistant…",
  entityUnavailableBanner: (entityId: string) =>
    "Timer entity " +
    entityId +
    " is unavailable. Open Home Assistant to re-enable it.",
  serviceFailureMessage:
    "Couldn't complete the timer action. Check your Home Assistant connection and try again.",
  durationSpeech: {
    hour: (value: number) => `${value} hour${value === 1 ? "" : "s"}`,
    minute: (value: number) => `${value} minute${value === 1 ? "" : "s"}`,
    second: (value: number) => `${value} second${value === 1 ? "" : "s"}`,
    list: (parts: string[]) => {
      if (parts.length <= 1) {
        return parts.join("");
      }

      if (parts.length === 2) {
        return `${parts[0]} and ${parts[1]}`;
      }

      return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
    },
  },
  ariaIdle: "Timer idle.",
  ariaRunning: "Timer running.",
  ariaPaused: "Timer paused.",
  ariaFinished: "Timer finished.",
  ariaUnavailable: "Timer unavailable.",
  ariaStarting: (durationSpeech: string) => `Timer started for ${durationSpeech}.`,
  ariaRestarting: (durationSpeech: string) => `Timer restarted for ${durationSpeech}.`,
  ariaPausedAnnouncement: "Timer paused.",
  ariaResumedAnnouncement: "Timer resumed.",
  ariaFinishedWithDuration: (durationSpeech: string) =>
    `Timer finished with ${durationSpeech} elapsed.`,
  ariaRemaining: (durationSpeech: string) => `${durationSpeech} remaining.`,
  ariaQueuedPreset: (label: string, durationSpeech: string) =>
    `Next preset selected: ${label} for ${durationSpeech}.`,
  ariaQueuedCustom: (durationSpeech: string) =>
    `Next preset selected: custom duration for ${durationSpeech}.`,
  extendButtonAriaLabel: (durationSpeech: string) => `Add ${durationSpeech} to the running timer.`,
  ariaExtendAdded: (durationSpeech: string, remainingLabel: string) =>
    `Added ${durationSpeech}. New remaining time: ${remainingLabel}.`,
  ariaExtendCapReached: "Cannot add more time.",
  ariaExtendRaceLost: "Timer finished before the extra time could be added.",
  pendingStartLabel: "Starting…",
  pendingRestartLabel: "Restarting…",
  toastStartFailed: "Couldn't start the timer. Please try again.",
  toastRestartFailed: "Couldn't restart the timer. Please try again.",
  toastExtendFailed: "Couldn't add more time. Please try again.",
  toastPauseFailed: "Couldn't pause the timer. Please try again.",
  toastResumeFailed: "Couldn't resume the timer. Please try again.",
  toastPauseHelperMissing: "Pause storage helper not found. Create the input_text helper for this timer.",
  toastPauseRemainingUnknown: "Remaining time is unknown while paused. Wait for Home Assistant to update, then try again.",
  toastEntityUnavailable: (entityId: string) => "Timer entity " + entityId + " is unavailable.",
  restartConfirmMessage: (durationLabel: string) => "Restart the timer for " + durationLabel + "?",
  restartConfirmConfirm: "Restart",
  restartConfirmCancel: "Cancel",
  primaryActionStart: "Start",
  primaryActionRestart: "Restart",
  pauseButtonLabel: "Pause",
  pauseButtonAriaLabel: "Pause the running timer.",
  resumeButtonLabel: "Resume",
  resumeButtonAriaLabel: "Resume the paused timer.",
  primaryActionStartLabel: (durationSpeech: string, presetLabel?: string, queued?: boolean) => {
    if (presetLabel) {
      return queued
        ? `Start next preset ${presetLabel} for ${durationSpeech}`
        : `Start ${presetLabel} for ${durationSpeech}`;
    }
    return `Start timer for ${durationSpeech}`;
  },
  primaryActionRestartLabel: (
    durationSpeech: string,
    presetLabel?: string,
    queued?: boolean,
  ) => {
    if (presetLabel) {
      return queued
        ? `Restart with next preset ${presetLabel} for ${durationSpeech}`
        : `Restart ${presetLabel} for ${durationSpeech}`;
    }
    return `Restart timer for ${durationSpeech}`;
  },
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
    plusButtonIncrementInvalid: "plusButtonIncrementS must be a positive number of seconds.",
    maxExtendInvalid: "maxExtendS must be zero or a positive number of seconds.",
    tapActionModeInvalid: "tapActionMode must be either 'restart' or 'pause_resume'.",
    doubleTapWindowInvalid: "doubleTapWindowMs must be between 200 and 500 milliseconds.",
    longPressActionInvalid:
      "longPressAction must be 'none', 'restart', 'open_preset_picker', or 'open_card_menu'.",
  },
};
