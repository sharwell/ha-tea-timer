import { describe, expect, it, vi } from "vitest";
import { changeTimer, restartTimer, startTimer, supportsTimerChange } from "./timer";
import type { HomeAssistant } from "../../types/home-assistant";

describe("timer services", () => {
  it("calls timer.start with seconds", async () => {
    const callService = vi.fn().mockResolvedValue(undefined);
    const hass: HomeAssistant = {
      locale: { language: "en" },
      states: {},
      callService,
    };

    await startTimer(hass, "timer.test", 180);

    expect(callService).toHaveBeenCalledWith("timer", "start", {
      entity_id: "timer.test",
      duration: 180,
    });
  });

  it("restarts the timer with a single start call", async () => {
    const callService = vi.fn().mockResolvedValue(undefined);
    const hass: HomeAssistant = {
      locale: { language: "en" },
      states: {},
      callService,
    };

    await restartTimer(hass, "timer.kitchen", 90);

    expect(callService).toHaveBeenCalledTimes(1);
    expect(callService).toHaveBeenCalledWith("timer", "start", {
      entity_id: "timer.kitchen",
      duration: 90,
    });
  });

  it("calls timer.change to add seconds", async () => {
    const callService = vi.fn().mockResolvedValue(undefined);
    const hass: HomeAssistant = {
      locale: { language: "en" },
      states: {},
      services: { timer: { change: {} } },
      callService,
    } as unknown as HomeAssistant;

    await changeTimer(hass, "timer.tea", 45);

    expect(callService).toHaveBeenCalledWith("timer", "change", {
      entity_id: "timer.tea",
      duration: 45,
      action: "add",
    });
  });

  it("detects timer.change support", () => {
    const hassWithChange = {
      locale: { language: "en" },
      states: {},
      services: { timer: { change: {} } },
      callService: vi.fn(),
    } as unknown as HomeAssistant;

    const hassWithoutChange = {
      locale: { language: "en" },
      states: {},
      services: { timer: {} },
      callService: vi.fn(),
    } as unknown as HomeAssistant;

    expect(supportsTimerChange(hassWithChange)).toBe(true);
    expect(supportsTimerChange(hassWithoutChange)).toBe(false);
    expect(supportsTimerChange(undefined)).toBe(false);
  });
});
