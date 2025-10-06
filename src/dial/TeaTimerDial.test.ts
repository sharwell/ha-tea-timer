import { describe, expect, it, vi } from "vitest";
import { TeaTimerDial } from "./TeaTimerDial";

describe("TeaTimerDial", () => {
  async function setupInteractiveDial() {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const dial = document.createElement("tea-timer-dial");
    dial.bounds = { min: 15, max: 360, step: 5 };
    dial.value = 60;
    dial.interactive = true;

    container.appendChild(dial);
    await dial.updateComplete;

    const root = dial.shadowRoot?.querySelector<HTMLElement>(".dial-root");
    if (!root) {
      throw new Error("dial root not found");
    }

    const captured = new Set<number>();
    Object.defineProperty(root, "setPointerCapture", {
      configurable: true,
      value: vi.fn((pointerId: number) => {
        captured.add(pointerId);
      }),
    });
    Object.defineProperty(root, "releasePointerCapture", {
      configurable: true,
      value: vi.fn((pointerId: number) => {
        captured.delete(pointerId);
      }),
    });
    Object.defineProperty(root, "hasPointerCapture", {
      configurable: true,
      value: (pointerId: number) => captured.has(pointerId),
    });
    Object.defineProperty(root, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        width: 200,
        height: 200,
        right: 200,
        bottom: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    return { dial, root, container };
  }

  function createPointerEvent(
    root: HTMLElement,
    overrides: Partial<{ button: number; pointerId: number; clientX: number; clientY: number }> = {},
  ): PointerEvent {
    return {
      button: overrides.button ?? 0,
      pointerId: overrides.pointerId ?? 1,
      clientX: overrides.clientX ?? 100,
      clientY: overrides.clientY ?? 100,
      currentTarget: root,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as PointerEvent;
  }

  async function renderDial(dial: TeaTimerDial) {
    document.body.appendChild(dial);
    await dial.updateComplete;
    const root = dial.shadowRoot?.querySelector<HTMLElement>(".dial-root");
    const handle = dial.shadowRoot?.querySelector<HTMLElement>(".dial-handle");
    if (!root || !handle) {
      throw new Error("dial root or handle not found");
    }

    return { root, handle };
  }

  it("hides the handle and removes focus when running", async () => {
    const dial = document.createElement("tea-timer-dial");
    dial.bounds = { min: 15, max: 360, step: 5 };
    dial.value = 120;
    dial.status = "running";
    dial.interactive = false;

    const { root } = await renderDial(dial);

    expect(root.classList.contains("is-running")).toBe(true);
    expect(root.tabIndex).toBe(-1);
    expect(root.getAttribute("aria-disabled")).toBe("true");

    dial.remove();
  });

  it("shows the handle and allows focus while idle", async () => {
    const dial = document.createElement("tea-timer-dial");
    dial.bounds = { min: 15, max: 360, step: 5 };
    dial.value = 90;
    dial.status = "idle";
    dial.interactive = true;

    const { root } = await renderDial(dial);

    expect(root.classList.contains("is-running")).toBe(false);
    expect(root.tabIndex).toBe(0);
    expect(root.getAttribute("aria-disabled")).toBe("false");

    dial.remove();
  });

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
    const circumference = 2 * Math.PI * (50 - 6 / 2);
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
    const circumference = 2 * Math.PI * (50 - 6 / 2);
    const afterMin = Number(arc.style.strokeDashoffset || arc.getAttribute("stroke-dashoffset") || "0");
    expect(afterMin).toBeCloseTo(circumference, 2);
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

  it("suppresses the synthetic click after a drag exceeds the slop", async () => {
    const { dial, root, container } = await setupInteractiveDial();
    const handlers = dial as unknown as {
      rootPointerDownHandler(event: PointerEvent): void;
      pointerMoveHandler(event: PointerEvent): void;
      pointerEndHandler(event: PointerEvent): void;
    };

    handlers.rootPointerDownHandler(createPointerEvent(root, { clientX: 90, clientY: 90 }));
    handlers.pointerMoveHandler(createPointerEvent(root, { clientX: 150, clientY: 90 }));
    handlers.pointerEndHandler(createPointerEvent(root, { clientX: 150, clientY: 90 }));

    const bubbleSpy = vi.fn();
    container.addEventListener("click", bubbleSpy);

    const dragClick = new MouseEvent("click", { bubbles: true, cancelable: true, composed: true });
    root.dispatchEvent(dragClick);

    expect(dragClick.defaultPrevented).toBe(true);
    expect(bubbleSpy).not.toHaveBeenCalled();

    handlers.rootPointerDownHandler(createPointerEvent(root, { clientX: 120, clientY: 120 }));
    handlers.pointerMoveHandler(createPointerEvent(root, { clientX: 122, clientY: 120 }));
    handlers.pointerEndHandler(createPointerEvent(root, { clientX: 122, clientY: 120 }));

    const tapClick = new MouseEvent("click", { bubbles: true, cancelable: true, composed: true });
    root.dispatchEvent(tapClick);

    expect(tapClick.defaultPrevented).toBe(false);
    expect(bubbleSpy).toHaveBeenCalledTimes(1);

    container.remove();
  });

  it("allows dial taps to bubble when movement stays within the slop", async () => {
    const { dial, root, container } = await setupInteractiveDial();
    const handlers = dial as unknown as {
      rootPointerDownHandler(event: PointerEvent): void;
      pointerMoveHandler(event: PointerEvent): void;
      pointerEndHandler(event: PointerEvent): void;
    };

    handlers.rootPointerDownHandler(createPointerEvent(root, { clientX: 100, clientY: 100 }));
    handlers.pointerMoveHandler(createPointerEvent(root, { clientX: 106, clientY: 100 }));
    handlers.pointerEndHandler(createPointerEvent(root, { clientX: 106, clientY: 100 }));

    const bubbleSpy = vi.fn();
    container.addEventListener("click", bubbleSpy);

    const click = new MouseEvent("click", { bubbles: true, cancelable: true, composed: true });
    root.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(false);
    expect(bubbleSpy).toHaveBeenCalledTimes(1);

    container.remove();
  });
});
