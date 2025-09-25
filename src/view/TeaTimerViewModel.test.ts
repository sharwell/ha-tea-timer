import { describe, expect, it } from "vitest";
import { createTeaTimerViewModel } from "./TeaTimerViewModel";
import { TeaTimerConfig } from "../model/config";

const config: TeaTimerConfig = {
  type: "custom:tea-timer-card",
  title: "Kitchen Timer",
  entity: "timer.kitchen",
  presets: [
    { label: "Green", durationSeconds: 120 },
    { label: "Black", durationSeconds: 240 },
  ],
  cardInstanceId: "test",
};

describe("createTeaTimerViewModel", () => {
  it("maps config to view model", () => {
    const viewModel = createTeaTimerViewModel(config);

    expect(viewModel.ui.title).toBe("Kitchen Timer");
    expect(viewModel.ui.entityLabel).toBe("timer.kitchen");
    expect(viewModel.ui.presets).toHaveLength(2);
    expect(viewModel.ui.presets[0].durationLabel).toBe("2:00");
  });

  it("falls back to defaults when title missing", () => {
    const viewModel = createTeaTimerViewModel({ ...config, title: undefined, entity: undefined, presets: [] });

    expect(viewModel.ui.title).toBe("Tea Timer");
    expect(viewModel.ui.entityLabel).toBe("Timer entity not configured.");
    expect(viewModel.ui.hasPresets).toBe(false);
  });
});
