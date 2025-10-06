import { beforeEach, describe, expect, it, vi } from "vitest";
import { GestureEngine } from "./gestureEngine";

interface MockPointerEventInit {
  pointerId?: number;
  clientX?: number;
  clientY?: number;
  pointerType?: string;
  button?: number;
  isPrimary?: boolean;
  timeStamp?: number;
}

function createPointerEvent(init: MockPointerEventInit = {}): PointerEvent {
  const event = {
    pointerId: init.pointerId ?? 1,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    pointerType: init.pointerType ?? "touch",
    button: init.button ?? 0,
    isPrimary: init.isPrimary ?? true,
    timeStamp: init.timeStamp ?? performance.now(),
  } as PointerEvent;

  return event;
}

describe("GestureEngine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("fires tap immediately when double tap is disabled", () => {
    const tap = vi.fn();
    const engine = new GestureEngine({ onTap: tap });

    engine.onPointerDown(createPointerEvent());
    engine.onPointerUp(createPointerEvent());

    expect(tap).toHaveBeenCalledTimes(1);
  });

  it("delays tap to allow double tap window", () => {
    const tap = vi.fn();
    const engine = new GestureEngine({ onTap: tap });
    engine.configure({ doubleTapEnabled: true, doubleTapWindowMs: 250 });

    engine.onPointerDown(createPointerEvent());
    engine.onPointerUp(createPointerEvent({ timeStamp: 10 }));

    expect(tap).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(tap).toHaveBeenCalledTimes(1);
  });

  it("fires double tap when second tap occurs within window", () => {
    const tap = vi.fn();
    const doubleTap = vi.fn();
    const engine = new GestureEngine({ onTap: tap, onDoubleTap: doubleTap });
    engine.configure({ doubleTapEnabled: true, doubleTapWindowMs: 300 });

    engine.onPointerDown(createPointerEvent({ timeStamp: 0 }));
    engine.onPointerUp(createPointerEvent({ timeStamp: 0 }));
    engine.onPointerDown(createPointerEvent({ timeStamp: 100 }));
    engine.onPointerUp(createPointerEvent({ timeStamp: 100 }));

    expect(doubleTap).toHaveBeenCalledTimes(1);
    expect(tap).not.toHaveBeenCalled();
  });

  it("treats spaced taps as independent taps", () => {
    const tap = vi.fn();
    const doubleTap = vi.fn();
    const engine = new GestureEngine({ onTap: tap, onDoubleTap: doubleTap });
    engine.configure({ doubleTapEnabled: true, doubleTapWindowMs: 200 });

    engine.onPointerDown(createPointerEvent({ timeStamp: 0 }));
    engine.onPointerUp(createPointerEvent({ timeStamp: 0 }));

    vi.advanceTimersByTime(210);

    engine.onPointerDown(createPointerEvent({ timeStamp: 220 }));
    engine.onPointerUp(createPointerEvent({ timeStamp: 220 }));

    vi.advanceTimersByTime(210);

    expect(doubleTap).not.toHaveBeenCalled();
    expect(tap).toHaveBeenCalledTimes(2);
  });

  it("fires long press after threshold", () => {
    const longPress = vi.fn();
    const engine = new GestureEngine({ onTap: vi.fn(), onLongPress: longPress });
    engine.configure({ longPressEnabled: true, longPressMs: 500 });

    engine.onPointerDown(createPointerEvent());
    vi.advanceTimersByTime(500);

    expect(longPress).toHaveBeenCalledTimes(1);
  });

  it("cancels long press when pointer moves too far", () => {
    const longPress = vi.fn();
    const engine = new GestureEngine({ onTap: vi.fn(), onLongPress: longPress });
    engine.configure({ longPressEnabled: true, longPressMs: 500, movementThresholdPx: 10 });

    engine.onPointerDown(createPointerEvent({ clientX: 0, clientY: 0 }));
    engine.onPointerMove(createPointerEvent({ clientX: 20, clientY: 0 }));
    vi.advanceTimersByTime(600);

    expect(longPress).not.toHaveBeenCalled();
  });

  it("ignores non-primary pointers", () => {
    const tap = vi.fn();
    const engine = new GestureEngine({ onTap: tap });

    engine.onPointerDown(createPointerEvent({ isPrimary: false }));
    engine.onPointerUp(createPointerEvent({ isPrimary: false }));

    expect(tap).not.toHaveBeenCalled();
  });
});
