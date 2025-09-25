import { TeaTimerConfig, TeaTimerPresetDefinition } from "../model/config";
import { formatDurationSeconds } from "../model/duration";
import { STRINGS } from "../strings";

export interface TeaTimerPresetViewModel {
  label: string;
  durationLabel: string;
  durationSeconds: number;
}

export interface TeaTimerViewModel {
  ui: {
    title: string;
    entityLabel: string;
    presets: TeaTimerPresetViewModel[];
    hasPresets: boolean;
  };
}

export function createTeaTimerViewModel(config: TeaTimerConfig): TeaTimerViewModel {
  const presets = config.presets.map((preset: TeaTimerPresetDefinition) => ({
    label: preset.label,
    durationLabel: formatDurationSeconds(preset.durationSeconds),
    durationSeconds: preset.durationSeconds,
  }));

  return {
    ui: {
      title: config.title?.trim() || STRINGS.cardTitleFallback,
      entityLabel: config.entity?.trim() || STRINGS.missingEntity,
      presets,
      hasPresets: presets.length > 0,
    },
  };
}
