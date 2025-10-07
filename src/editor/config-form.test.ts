import { describe, expect, it } from "vitest";
import type { TeaTimerCardConfig } from "../model/config";
import {
  ADVANCED_FORM_SCHEMA,
  BASE_FORM_SCHEMA,
  PRESET_FORM_SCHEMA,
  createConfigFromEditorFormData,
  createEditorFormData,
  durationDataToSeconds,
  secondsToDurationData,
  type TeaTimerEditorFormData,
} from "./config-form";

describe("config-form", () => {
  it("exposes schemas for core fields", () => {
    expect(BASE_FORM_SCHEMA.map((field) => field.name)).toEqual(["title", "entity"]);

    expect(PRESET_FORM_SCHEMA.map((field) => field.name)).toEqual(["label", "duration"]);

    expect(ADVANCED_FORM_SCHEMA.map((field) => field.name)).toEqual([
      "minDurationSeconds",
      "maxDurationSeconds",
      "stepSeconds",
      "confirmRestart",
      "finishedAutoIdleMs",
      "disableClockSkewEstimator",
    ]);
  });

  it("converts seconds to duration data", () => {
    expect(secondsToDurationData(0)).toEqual({});
    expect(secondsToDurationData(125)).toEqual({ minutes: 2, seconds: 5 });
    expect(secondsToDurationData(3725)).toEqual({ hours: 1, minutes: 2, seconds: 5 });
    expect(secondsToDurationData(90061)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 });
  });

  it("converts duration data to seconds", () => {
    expect(durationDataToSeconds(undefined)).toBeUndefined();
    expect(durationDataToSeconds({ minutes: 2, seconds: 5 })).toBe(125);
    expect(durationDataToSeconds({ hours: 1, minutes: 2, seconds: 5 })).toBe(3725);
    expect(durationDataToSeconds({ days: 1, hours: 1, minutes: 1, seconds: 1 })).toBe(90061);
    expect(durationDataToSeconds({ seconds: -1 })).toBeUndefined();
  });

  it("creates form data from config", () => {
    const config: TeaTimerCardConfig & Record<string, unknown> = {
      type: "custom:tea-timer-card",
      title: "Evening Brew",
      entity: "timer.tea_time",
      presets: [
        { label: "Green", durationSeconds: 120 },
        { label: "Black", durationSeconds: 240 },
      ],
      defaultPreset: "Green",
      minDurationSeconds: 30,
      maxDurationSeconds: 900,
      stepSeconds: 15,
      confirmRestart: true,
      finishedAutoIdleMs: 2000,
      disableClockSkewEstimator: true,
    };

    const form = createEditorFormData(config);
    expect(form.base).toEqual({
      title: "Evening Brew",
      entity: "timer.tea_time",
    });
    expect(form.presets).toEqual([
      { label: "Green", duration: { minutes: 2 } },
      { label: "Black", duration: { minutes: 4 } },
    ]);
    expect(form.advanced).toEqual({
      minDurationSeconds: 30,
      maxDurationSeconds: 900,
      stepSeconds: 15,
      confirmRestart: true,
      finishedAutoIdleMs: 2000,
      disableClockSkewEstimator: true,
    });
    expect(form.defaultPreset).toEqual({ value: "Green", index: 0 });
  });

  it("builds config from form data while preserving extras", () => {
    const original: TeaTimerCardConfig & Record<string, unknown> = {
      type: "custom:tea-timer-card",
      presets: [{ label: "Default", durationSeconds: 60 }],
      showPauseResume: false,
      unexpected: "keep-me",
    };

    const formData: TeaTimerEditorFormData = {
      base: {
        title: "Morning Tea",
        entity: "timer.morning",
      },
      presets: [
        { label: "Green", duration: { minutes: 2 } },
        { label: "Black", duration: { minutes: 4 } },
      ],
      advanced: {
        minDurationSeconds: 15,
        maxDurationSeconds: 600,
        stepSeconds: 5,
        confirmRestart: true,
        finishedAutoIdleMs: 1500,
        disableClockSkewEstimator: true,
      },
      defaultPreset: { value: 1, index: 1 },
    };

    const config = createConfigFromEditorFormData(formData, original, { defaultPresetWasNumber: true });
    expect(config).toMatchObject({
      type: "custom:tea-timer-card",
      title: "Morning Tea",
      entity: "timer.morning",
      defaultPreset: 1,
      presets: [
        { label: "Green", durationSeconds: 120 },
        { label: "Black", durationSeconds: 240 },
      ],
      minDurationSeconds: 15,
      maxDurationSeconds: 600,
      stepSeconds: 5,
      confirmRestart: true,
      finishedAutoIdleMs: 1500,
      disableClockSkewEstimator: true,
      showPauseResume: false,
      unexpected: "keep-me",
    });
  });

  it("omits default preset when none selected", () => {
    const original: TeaTimerCardConfig & Record<string, unknown> = {
      type: "custom:tea-timer-card",
      defaultPreset: "Keep",
    };

    const formData: TeaTimerEditorFormData = {
      base: {
        title: "Untitled",
        entity: "timer.test",
      },
      presets: [{ label: "A", duration: { seconds: 30 } }],
      advanced: {},
      defaultPreset: {},
    };

    const config = createConfigFromEditorFormData(formData, original);
    expect(config.defaultPreset).toBeUndefined();
  });
});
