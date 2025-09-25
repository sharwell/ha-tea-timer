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
}

export interface TeaTimerConfig {
  type: string;
  title?: string;
  entity?: string;
  presets: TeaTimerPresetDefinition[];
  cardInstanceId: string;
}

export interface ParsedTeaTimerConfig {
  config: TeaTimerConfig | null;
  errors: string[];
}

const RESERVED_OPTIONS = new Set([
  "minDurationSeconds",
  "maxDurationSeconds",
  "stepSeconds",
  "defaultPreset",
  "confirmRestart",
  "finishedAutoIdleMs",
]);

export function parseTeaTimerConfig(input: unknown): ParsedTeaTimerConfig {
  const errors: string[] = [];

  if (typeof input !== "object" || input === null) {
    errors.push(STRINGS.validation.notAnObject);
    return { config: null, errors };
  }

  const raw = input as TeaTimerCardConfig & Record<string, unknown>;

  const type = typeof raw.type === "string" ? raw.type : "custom:tea-timer-card";
  const title = typeof raw.title === "string" ? raw.title : undefined;
  const entity = typeof raw.entity === "string" ? raw.entity : undefined;

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

  for (const key of RESERVED_OPTIONS) {
    if (key in raw) {
      errors.push(STRINGS.validation.reservedOption(key));
    }
  }

  const config: TeaTimerConfig = {
    type,
    title,
    entity,
    presets,
    cardInstanceId: createCardInstanceId(),
  };

  return { config, errors };
}
