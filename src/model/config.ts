import { DurationBounds } from "./duration";
import { createCardInstanceId } from "./instance";
import { STRINGS } from "../strings";

export interface TeaTimerPresetDefinition {
  label: string;
  durationSeconds: number;
}

export interface TeaTimerCardConfig {
  type: string;
  title?: string;
  entity?: string;
  presets?: TeaTimerPresetDefinition[];
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
  stepSeconds?: number;
  defaultPreset?: number | string;
  confirmRestart?: boolean;
  finishedAutoIdleMs?: number;
  disableClockSkewEstimator?: boolean;
  showPlusButton?: boolean;
  plusButtonIncrementS?: number;
  maxExtendS?: number;
}

export interface TeaTimerConfig {
  type: string;
  title?: string;
  entity?: string;
  presets: TeaTimerPresetDefinition[];
  cardInstanceId: string;
  dialBounds: DurationBounds;
  confirmRestart: boolean;
  finishedAutoIdleMs: number;
  defaultPresetId?: number;
  clockSkewEstimatorEnabled: boolean;
  showPlusButton: boolean;
  plusButtonIncrementSeconds: number;
  maxExtendSeconds?: number;
}

export interface ParsedTeaTimerConfig {
  config: TeaTimerConfig | null;
  errors: string[];
}

const RESERVED_OPTIONS = new Set<string>();

const DEFAULT_MIN_DURATION_SECONDS = 15;
const DEFAULT_MAX_DURATION_SECONDS = 1200;
const DEFAULT_STEP_SECONDS = 5;
const DEFAULT_PLUS_BUTTON_INCREMENT_SECONDS = 60;

export function parseTeaTimerConfig(input: unknown): ParsedTeaTimerConfig {
  const errors: string[] = [];

  if (typeof input !== "object" || input === null) {
    errors.push(STRINGS.validation.notAnObject);
    return { config: null, errors };
  }

  const raw = input as TeaTimerCardConfig & Record<string, unknown>;

  const type = typeof raw.type === "string" ? raw.type : "custom:tea-timer-card";
  const title = typeof raw.title === "string" ? raw.title : undefined;
  const rawEntity = typeof raw.entity === "string" ? raw.entity : undefined;
  const entity = rawEntity?.trim() ? rawEntity.trim() : undefined;

  if (!entity) {
    errors.push(STRINGS.validation.entityRequired);
  }

  const presetValues = Array.isArray(raw.presets) ? (raw.presets as unknown[]) : undefined;

  if (Array.isArray(raw.presets)) {
    // continue below
  } else if (raw.presets !== undefined && !Array.isArray(raw.presets)) {
    errors.push(STRINGS.validation.presetsInvalidType);
  }

  const presets: TeaTimerPresetDefinition[] = [];
  if (presetValues) {
    presetValues.forEach((item, index) => {
      if (typeof item !== "object" || item === null) {
        errors.push(`${STRINGS.validation.presetInvalid} (index ${index})`);
        return;
      }

      const preset = item as Record<string, unknown>;
      const label = preset.label;
      const durationSeconds = preset.durationSeconds;

      if (typeof label !== "string" || typeof durationSeconds !== "number") {
        errors.push(`${STRINGS.validation.presetInvalid} (index ${index})`);
        return;
      }

      if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
        errors.push(`${STRINGS.validation.presetDurationInvalid} (index ${index})`);
        return;
      }

      presets.push({ label, durationSeconds });
    });

    if (presets.length > 8) {
      errors.push(STRINGS.validation.presetsTooLong);
      presets.length = 8;
    }
  }

  const rawMinDuration =
    typeof raw.minDurationSeconds === "number" && Number.isFinite(raw.minDurationSeconds)
      ? Math.round(raw.minDurationSeconds)
      : undefined;
  const rawMaxDuration =
    typeof raw.maxDurationSeconds === "number" && Number.isFinite(raw.maxDurationSeconds)
      ? Math.round(raw.maxDurationSeconds)
      : undefined;
  const rawStepSeconds =
    typeof raw.stepSeconds === "number" && Number.isFinite(raw.stepSeconds)
      ? Math.round(raw.stepSeconds)
      : undefined;

  let minDurationSeconds = DEFAULT_MIN_DURATION_SECONDS;
  if (rawMinDuration !== undefined) {
    if (rawMinDuration < 0) {
      errors.push(STRINGS.validation.minDurationInvalid);
    } else {
      minDurationSeconds = rawMinDuration;
    }
  }

  let maxDurationSeconds = DEFAULT_MAX_DURATION_SECONDS;
  if (rawMaxDuration !== undefined) {
    if (rawMaxDuration <= 0) {
      errors.push(STRINGS.validation.maxDurationInvalid);
    } else {
      maxDurationSeconds = rawMaxDuration;
    }
  }

  if (maxDurationSeconds <= minDurationSeconds) {
    errors.push(STRINGS.validation.durationBoundsInvalid);
    maxDurationSeconds = Math.max(minDurationSeconds + DEFAULT_STEP_SECONDS, minDurationSeconds + 1);
  }

  let stepSeconds = DEFAULT_STEP_SECONDS;
  if (rawStepSeconds !== undefined) {
    if (rawStepSeconds <= 0) {
      errors.push(STRINGS.validation.stepSecondsInvalid);
    } else {
      stepSeconds = rawStepSeconds;
    }
  }

  for (const key of RESERVED_OPTIONS) {
    if (key in raw) {
      errors.push(STRINGS.validation.reservedOption(key));
    }
  }

  const rawFinishedAutoIdleMs =
    typeof raw.finishedAutoIdleMs === "number" && Number.isFinite(raw.finishedAutoIdleMs)
      ? Math.round(raw.finishedAutoIdleMs)
      : undefined;
  const finishedAutoIdleMs = rawFinishedAutoIdleMs !== undefined ? Math.max(0, rawFinishedAutoIdleMs) : 5000;

  const showPlusButton = raw.showPlusButton !== false;

  let plusButtonIncrementSeconds = DEFAULT_PLUS_BUTTON_INCREMENT_SECONDS;
  if (typeof raw.plusButtonIncrementS === "number" && Number.isFinite(raw.plusButtonIncrementS)) {
    const rounded = Math.round(raw.plusButtonIncrementS);
    if (rounded > 0) {
      plusButtonIncrementSeconds = rounded;
    } else {
      errors.push(STRINGS.validation.plusButtonIncrementInvalid);
    }
  } else if (raw.plusButtonIncrementS !== undefined) {
    errors.push(STRINGS.validation.plusButtonIncrementInvalid);
  }

  let maxExtendSeconds: number | undefined;
  if (raw.maxExtendS !== undefined) {
    if (typeof raw.maxExtendS === "number" && Number.isFinite(raw.maxExtendS)) {
      const rounded = Math.round(raw.maxExtendS);
      if (rounded >= 0) {
        maxExtendSeconds = rounded;
      } else {
        errors.push(STRINGS.validation.maxExtendInvalid);
      }
    } else {
      errors.push(STRINGS.validation.maxExtendInvalid);
    }
  }

  let defaultPresetId: number | undefined;
  if (Array.isArray(presets) && presets.length) {
    const defaultPreset = raw.defaultPreset;
    if (typeof defaultPreset === "number" && Number.isFinite(defaultPreset)) {
      const index = Math.floor(defaultPreset);
      if (index >= 0 && index < presets.length) {
        defaultPresetId = index;
      }
    } else if (typeof defaultPreset === "string") {
      const index = presets.findIndex((preset) => preset.label === defaultPreset);
      if (index >= 0) {
        defaultPresetId = index;
      }
    }
  }

  const dialBounds: DurationBounds = {
    min: Math.min(minDurationSeconds, maxDurationSeconds),
    max: Math.max(minDurationSeconds, maxDurationSeconds),
    step: Math.max(1, stepSeconds),
  };

  const confirmRestart = typeof raw.confirmRestart === "boolean" ? raw.confirmRestart : false;
  const clockSkewEstimatorEnabled = raw.disableClockSkewEstimator === true ? false : true;

  const config: TeaTimerConfig = {
    type,
    title,
    entity,
    presets,
    cardInstanceId: createCardInstanceId(),
    dialBounds,
    confirmRestart,
    finishedAutoIdleMs,
    defaultPresetId,
    clockSkewEstimatorEnabled,
    showPlusButton,
    plusButtonIncrementSeconds,
    maxExtendSeconds,
  };

  return { config, errors };
}
