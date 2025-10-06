import type { TeaTimerCardConfig, TeaTimerPresetDefinition } from "../model/config";

export interface HaDurationData {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}

export interface HaFormSchema {
  name: string;
  selector: Record<string, unknown>;
  required?: boolean;
  default?: unknown;
  description?: { suffix?: string };
}

export interface TeaTimerEditorPresetFormData {
  label?: string;
  duration?: HaDurationData;
}

export interface TeaTimerEditorBaseFormData {
  title?: string;
  entity?: string;
  defaultPreset?: string;
}

export interface TeaTimerEditorAdvancedFormData {
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
  stepSeconds?: number;
  confirmRestart?: boolean;
  finishedAutoIdleMs?: number;
  disableClockSkewEstimator?: boolean;
}

export interface TeaTimerEditorFormData {
  base: TeaTimerEditorBaseFormData;
  presets: TeaTimerEditorPresetFormData[];
  advanced: TeaTimerEditorAdvancedFormData;
}

export const BASE_FORM_SCHEMA: readonly HaFormSchema[] = [
  { name: "title", selector: { text: {} } },
  { name: "entity", selector: { entity: { domain: "timer" } } },
  { name: "defaultPreset", selector: { text: {} } },
] as const;

export const PRESET_FORM_SCHEMA: readonly HaFormSchema[] = [
  { name: "label", selector: { text: {} } },
  { name: "duration", selector: { duration: {} } },
] as const;

export const ADVANCED_FORM_SCHEMA: readonly HaFormSchema[] = [
  { name: "minDurationSeconds", selector: { number: { min: 0, step: 1 } } },
  { name: "maxDurationSeconds", selector: { number: { min: 1, step: 1 } } },
  { name: "stepSeconds", selector: { number: { min: 1, step: 1 } } },
  { name: "confirmRestart", selector: { boolean: {} } },
  { name: "finishedAutoIdleMs", selector: { number: { min: 0, step: 100 } } },
  { name: "disableClockSkewEstimator", selector: { boolean: {} } },
] as const;

export interface CreateConfigOptions {
  readonly defaultPresetWasNumber?: boolean;
}

export function secondsToDurationData(seconds: number): HaDurationData {
  const remaining = Math.max(0, Math.floor(seconds));
  if (!Number.isFinite(remaining) || remaining <= 0) {
    return {};
  }

  let leftover = remaining;
  const days = Math.floor(leftover / 86400);
  leftover -= days * 86400;
  const hours = Math.floor(leftover / 3600);
  leftover -= hours * 3600;
  const minutes = Math.floor(leftover / 60);
  leftover -= minutes * 60;
  const secondsPart = leftover;

  const result: HaDurationData = {};
  if (days) {
    result.days = days;
  }
  if (hours) {
    result.hours = hours;
  }
  if (minutes) {
    result.minutes = minutes;
  }
  if (secondsPart) {
    result.seconds = secondsPart;
  }

  if (!Object.keys(result).length) {
    result.seconds = remaining;
  }

  return result;
}

export function durationDataToSeconds(data: HaDurationData | undefined | null): number | undefined {
  if (!data) {
    return undefined;
  }

  const days = Number(data.days ?? 0);
  const hours = Number(data.hours ?? 0);
  const minutes = Number(data.minutes ?? 0);
  const seconds = Number(data.seconds ?? 0);

  if ([days, hours, minutes, seconds].some((part) => Number.isNaN(part))) {
    return undefined;
  }

  const total = days * 86400 + hours * 3600 + minutes * 60 + seconds;
  if (total <= 0) {
    return undefined;
  }

  return total;
}

export function createEditorFormData(
  config: (TeaTimerCardConfig & Record<string, unknown>) | Record<string, unknown>,
): TeaTimerEditorFormData {
  const cardConfig = config as TeaTimerCardConfig & Record<string, unknown>;
  const base: TeaTimerEditorBaseFormData = {
    title: typeof cardConfig.title === "string" ? cardConfig.title : "",
    entity: typeof cardConfig.entity === "string" ? cardConfig.entity : "",
    defaultPreset:
      typeof cardConfig.defaultPreset === "string"
        ? cardConfig.defaultPreset
        : typeof cardConfig.defaultPreset === "number"
          ? String(cardConfig.defaultPreset)
          : "",
  };

  const advanced: TeaTimerEditorAdvancedFormData = {
    minDurationSeconds:
      typeof cardConfig.minDurationSeconds === "number" ? cardConfig.minDurationSeconds : undefined,
    maxDurationSeconds:
      typeof cardConfig.maxDurationSeconds === "number" ? cardConfig.maxDurationSeconds : undefined,
    stepSeconds:
      typeof cardConfig.stepSeconds === "number" ? cardConfig.stepSeconds : undefined,
    confirmRestart:
      typeof cardConfig.confirmRestart === "boolean" ? cardConfig.confirmRestart : undefined,
    finishedAutoIdleMs:
      typeof cardConfig.finishedAutoIdleMs === "number" ? cardConfig.finishedAutoIdleMs : undefined,
    disableClockSkewEstimator:
      typeof cardConfig.disableClockSkewEstimator === "boolean"
        ? cardConfig.disableClockSkewEstimator
        : undefined,
  };

  const presets: TeaTimerEditorPresetFormData[] = Array.isArray(cardConfig.presets)
    ? cardConfig.presets.map((preset) => ({
        label: preset?.label ?? "",
        duration:
          typeof preset?.durationSeconds === "number"
            ? secondsToDurationData(preset.durationSeconds)
            : undefined,
      }))
    : [];

  if (!presets.length) {
    presets.push({});
  }

  return { base, presets, advanced };
}

export function createConfigFromEditorFormData(
  formData: TeaTimerEditorFormData,
  previousConfig: (TeaTimerCardConfig & Record<string, unknown>) | Record<string, unknown>,
  options: CreateConfigOptions = {},
): TeaTimerCardConfig & Record<string, unknown> {
  const result: TeaTimerCardConfig & Record<string, unknown> = {
    ...(previousConfig as TeaTimerCardConfig & Record<string, unknown>),
  };

  const base = formData.base;
  if (base.title && base.title.trim().length) {
    result.title = base.title.trim();
  } else {
    delete result.title;
  }

  if (base.entity && base.entity.trim().length) {
    result.entity = base.entity.trim();
  } else {
    delete result.entity;
  }

  if (base.defaultPreset && base.defaultPreset.trim().length) {
    const trimmed = base.defaultPreset.trim();
    if (options.defaultPresetWasNumber && /^-?\d+$/.test(trimmed)) {
      result.defaultPreset = Number(trimmed);
    } else {
      result.defaultPreset = trimmed;
    }
  } else {
    delete result.defaultPreset;
  }

  const advanced = formData.advanced;
  if (typeof advanced.minDurationSeconds === "number") {
    result.minDurationSeconds = advanced.minDurationSeconds;
  } else {
    delete result.minDurationSeconds;
  }

  if (typeof advanced.maxDurationSeconds === "number") {
    result.maxDurationSeconds = advanced.maxDurationSeconds;
  } else {
    delete result.maxDurationSeconds;
  }

  if (typeof advanced.stepSeconds === "number") {
    result.stepSeconds = advanced.stepSeconds;
  } else {
    delete result.stepSeconds;
  }

  if (advanced.confirmRestart === true) {
    result.confirmRestart = true;
  } else {
    delete result.confirmRestart;
  }

  if (typeof advanced.finishedAutoIdleMs === "number") {
    result.finishedAutoIdleMs = advanced.finishedAutoIdleMs;
  } else {
    delete result.finishedAutoIdleMs;
  }

  if (advanced.disableClockSkewEstimator === true) {
    result.disableClockSkewEstimator = true;
  } else {
    delete result.disableClockSkewEstimator;
  }

  const presets: TeaTimerPresetDefinition[] = [];
  formData.presets.forEach((preset) => {
    const label = typeof preset.label === "string" ? preset.label : "";
    if (!label && !preset.duration) {
      return;
    }

    const durationSeconds = durationDataToSeconds(preset.duration);
    const presetConfig: TeaTimerPresetDefinition = {
      label,
      durationSeconds: durationSeconds ?? Number.NaN,
    };
    presets.push(presetConfig);
  });

  result.presets = presets;

  return result;
}
