import { describe, expect, it, vi } from "vitest";
import { TeaTimerDial } from "./TeaTimerDial";

describe("TeaTimerDial", () => {
  it("emits dial-input on keyboard adjustment", () => {
    const dial = document.createElement("tea-timer-dial");
    dial.bounds = { min: 15, max: 120, step: 5 };
    dial.value = 60;
    dial.interactive = true;

    const dispatched: Event[] = [];
    const originalDispatch = dial.dispatchEvent.bind(dial);
    dial.dispatchEvent = (event: Event) => {
      dispatched.push(event);
      return originalDispatch(event);
    };

    const handleKeyDown =
      TeaTimerDial.prototype as unknown as {
        handleKeyDown(this: TeaTimerDial, event: KeyboardEvent): void;
      };
    handleKeyDown.handleKeyDown.call(dial, new KeyboardEvent("keydown", { key: "ArrowUp" }));

    const valueEvent = dispatched.find(
      (event): event is CustomEvent<{ value: number }> => event.type === "dial-input",
    );
    expect(valueEvent?.detail.value).toBe(65);
  });

  it("accumulates repeated keyboard taps without waiting for host updates", () => {
    const dial = document.createElement("tea-timer-dial");
    dial.bounds = { min: 15, max: 120, step: 5 };
    dial.value = 60;
    dial.interactive = true;

    const handleKeyDown =
      TeaTimerDial.prototype as unknown as {
        handleKeyDown(this: TeaTimerDial, event: KeyboardEvent): void;
      };

    handleKeyDown.handleKeyDown.call(dial, new KeyboardEvent("keydown", { key: "ArrowUp" }));
    handleKeyDown.handleKeyDown.call(dial, new KeyboardEvent("keydown", { key: "ArrowUp" }));

    expect(dial.value).toBe(70);
  });

  it("blocks interaction when not interactive", () => {
    const dial = document.createElement("tea-timer-dial");
    dial.bounds = { min: 15, max: 120, step: 5 };
    dial.value = 60;
    dial.interactive = false;

    const dispatched: Event[] = [];
    const originalDispatch = dial.dispatchEvent.bind(dial);
    dial.dispatchEvent = (event: Event) => {
      dispatched.push(event);
      return originalDispatch(event);
    };

    const handleKeyDown =
      TeaTimerDial.prototype as unknown as {
        handleKeyDown(this: TeaTimerDial, event: KeyboardEvent): void;
      };
    handleKeyDown.handleKeyDown.call(dial, new KeyboardEvent("keydown", { key: "ArrowUp" }));

    expect(dispatched.some((event) => event.type === "dial-blocked")).toBe(true);
  });

  it("requests an update when normalized value changes locally", () => {
    const dial = document.createElement("tea-timer-dial");
    const requestUpdate = vi.spyOn(dial, "requestUpdate");

    const internals = TeaTimerDial.prototype as unknown as {
      setNormalizedValue(this: TeaTimerDial, normalized: number): void;
    };

    internals.setNormalizedValue.call(dial, 0.25);

    expect(requestUpdate).toHaveBeenCalled();
  });
});
