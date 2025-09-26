import { describe, expect, it } from "vitest";
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
});
