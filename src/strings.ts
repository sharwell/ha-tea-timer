export interface StringTable {
  cardTitleFallback: string;
  emptyState: string;
  missingEntity: string;
  draftNote: string;
  gettingStartedLabel: string;
  gettingStartedUrl: string;
  presetsGroupLabel: string;
  validation: {
    notAnObject: string;
    presetsTooLong: string;
    presetsInvalidType: string;
    presetInvalid: string;
    presetDurationInvalid: string;
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
  presetsGroupLabel: "Presets",
  validation: {
    notAnObject: "Card configuration must be an object.",
    presetsTooLong: "Presets are limited to a maximum of 8 items.",
    presetsInvalidType: "Presets must be an array of preset definitions.",
    presetInvalid: "Each preset must be an object with a label and durationSeconds.",
    presetDurationInvalid: "Preset durations must be positive numbers of seconds.",
    reservedOption: (name: string) => `The "${name}" option is reserved for a future release.`,
  },
};
