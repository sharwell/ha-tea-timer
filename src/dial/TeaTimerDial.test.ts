import { describe, expect, it, vi } from "vitest";
import { TeaTimerDial } from "./TeaTimerDial";

describe("TeaTimerDial", () => {
  it("updates the progress arc when the fraction changes", () => {
    const dial = new TeaTimerDial();
    const arc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    arc.classList.add("dial-progress-arc");
    Object.defineProperty(dial, "shadowRoot", {
      configurable: true,
      value: {
        querySelector: (selector: string) => (selector === ".dial-progress-arc" ? arc : null),
      },
    });

    dial.setProgressFraction(0.25);

    const internals = dial as unknown as { pendingProgressSync: boolean };
    expect(internals.pendingProgressSync).toBe(false);

    const offset = Number(arc.style.strokeDashoffset || arc.getAttribute("stroke-dashoffset") || "0");
    const circumference = 2 * Math.PI * (50 - dial.trackWidth / 2);
    expect(offset).toBeCloseTo(circumference * 0.75, 2);
  });

  it("clamps the progress fraction between 0 and 1", () => {
    const dial = new TeaTimerDial();
    const arc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    arc.classList.add("dial-progress-arc");
    Object.defineProperty(dial, "shadowRoot", {
      configurable: true,
      value: {
        querySelector: (selector: string) => (selector === ".dial-progress-arc" ? arc : null),
      },
    });

    dial.setProgressFraction(2);
    const internals = dial as unknown as { pendingProgressSync: boolean };
    expect(internals.pendingProgressSync).toBe(false);
    const afterMax = Number(arc.style.strokeDashoffset || arc.getAttribute("stroke-dashoffset") || "0");
    expect(afterMax).toBeCloseTo(0, 2);

    dial.setProgressFraction(-1);
    const circumference = 2 * Math.PI * (50 - dial.trackWidth / 2);
    const afterMin = Number(arc.style.strokeDashoffset || arc.getAttribute("stroke-dashoffset") || "0");
    expect(afterMin).toBeCloseTo(circumference, 2);
  });

  it("adapts the progress arc to the configured track width", () => {
    const dial = new TeaTimerDial();
    dial.trackWidth = 4;
    const arc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    arc.classList.add("dial-progress-arc");
    Object.defineProperty(dial, "shadowRoot", {
      configurable: true,
      value: {
        querySelector: (selector: string) => (selector === ".dial-progress-arc" ? arc : null),
      },
    });

    dial.setProgressFraction(0.5);

    const circumference = 2 * Math.PI * (50 - dial.trackWidth / 2);
    const offset = Number(arc.style.strokeDashoffset || arc.getAttribute("stroke-dashoffset") || "0");
    expect(offset).toBeCloseTo(circumference * 0.5, 2);
  });

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
