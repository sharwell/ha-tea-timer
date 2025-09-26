import { describe, expect, it } from "vitest";
import { parseTeaTimerConfig } from "./config";

describe("parseTeaTimerConfig", () => {
  it("returns error when config is not an object", () => {
    const result = parseTeaTimerConfig(null);
    expect(result.config).toBeNull();
    expect(result.errors).toContain("Card configuration must be an object.");
  });

  it("parses valid configuration", () => {
    const result = parseTeaTimerConfig({
      title: "Kitchen",
      entity: " timer.kitchen ",
      presets: [
        { label: "Green", durationSeconds: 120 },
        { label: "Black", durationSeconds: 240 },
      ],
    });

    expect(result.errors).toHaveLength(0);
    expect(result.config).not.toBeNull();
    expect(result.config?.presets).toHaveLength(2);
    expect(result.config?.entity).toBe("timer.kitchen");
  });

  it("limits presets to 8 items", () => {
    const result = parseTeaTimerConfig({
      presets: new Array(10).fill(0).map((_, index) => ({
        label: `Preset ${index}`,
        durationSeconds: 60 + index,
      })),
    });

    expect(result.errors).toContain("Presets are limited to a maximum of 8 items.");
    expect(result.config?.presets).toHaveLength(8);
  });

  it("flags reserved options", () => {
    const result = parseTeaTimerConfig({
      presets: [],
      minDurationSeconds: 10,
    });

    expect(result.errors).toContain('The "minDurationSeconds" option is reserved for a future release.');
  });

  it("rejects invalid preset entries", () => {
    const result = parseTeaTimerConfig({
      presets: [{ label: "Test", durationSeconds: -1 }],
    });

    expect(result.errors).toContain("Preset durations must be positive numbers of seconds. (index 0)");
    expect(result.config?.presets).toHaveLength(0);
  });

  it("requires an entity id", () => {
    const result = parseTeaTimerConfig({
      title: "Kitchen",
      presets: [],
    });

    expect(result.errors).toContain('The "entity" option is required.');
  });
});
