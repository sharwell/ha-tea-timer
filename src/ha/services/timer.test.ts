import { describe, expect, it, vi } from "vitest";
import { restartTimer, startTimer } from "./timer";
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

  it("cancels then restarts the timer", async () => {
    const callService = vi.fn().mockResolvedValue(undefined);
    const hass: HomeAssistant = {
      locale: { language: "en" },
      states: {},
      callService,
    };

    await restartTimer(hass, "timer.kitchen", 90);

    expect(callService).toHaveBeenNthCalledWith(1, "timer", "cancel", {
      entity_id: "timer.kitchen",
    });
    expect(callService).toHaveBeenNthCalledWith(2, "timer", "start", {
      entity_id: "timer.kitchen",
      duration: 90,
    });
  });
});
