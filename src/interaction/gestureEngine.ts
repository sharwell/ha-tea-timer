export type GestureType = "tap" | "doubleTap" | "longPress";

export interface GestureEngineCallbacks {
  onTap: (event: PointerEvent) => void;
  onDoubleTap?: (event: PointerEvent) => void;
  onLongPress?: (event: PointerEvent) => void;
}

export interface GestureEngineOptions {
  doubleTapWindowMs: number;
  doubleTapEnabled: boolean;
  longPressEnabled: boolean;
  longPressMs: number;
  movementThresholdPx: number;
}

interface PointerContext {
  id: number;
  startX: number;
  startY: number;
  startTime: number;
  pointerType: string;
}

const DEFAULT_OPTIONS: GestureEngineOptions = {
  doubleTapEnabled: false,
  doubleTapWindowMs: 300,
  longPressEnabled: false,
  longPressMs: 550,
  movementThresholdPx: 12,
};

function getEventTimestamp(event: PointerEvent): number {
  const ts = event.timeStamp;
  if (typeof ts === "number" && Number.isFinite(ts) && ts > 0) {
    return ts;
  }

  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function getDistanceSquared(a: PointerContext, event: PointerEvent): number {
  const dx = event.clientX - a.startX;
  const dy = event.clientY - a.startY;
  return dx * dx + dy * dy;
}

export class GestureEngine {
  private readonly callbacks: GestureEngineCallbacks;

  private options: GestureEngineOptions;

  private pointer?: PointerContext;

  private longPressTimer?: number;

  private longPressFired = false;

  private pendingTapTimer?: number;

  private lastTapTime = 0;

  constructor(callbacks: GestureEngineCallbacks, options?: Partial<GestureEngineOptions>) {
    this.callbacks = callbacks;
    this.options = { ...DEFAULT_OPTIONS, ...(options ?? {}) };
  }

  public configure(options: Partial<GestureEngineOptions>): void {
    this.options = { ...this.options, ...options };
  }

  public onPointerDown(event: PointerEvent): void {
    if (!this.isPrimaryPointer(event)) {
      return;
    }

    this.pointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: getEventTimestamp(event),
      pointerType: event.pointerType,
    };

    this.longPressFired = false;
    this.clearLongPressTimer();

    if (this.options.longPressEnabled) {
      this.longPressTimer = window.setTimeout(() => {
        this.longPressTimer = undefined;
        this.longPressFired = true;
        if (this.callbacks.onLongPress) {
          this.callbacks.onLongPress(event);
        }
        this.cancelPendingTap();
      }, Math.max(0, this.options.longPressMs));
    }
  }

  public onPointerMove(event: PointerEvent): void {
    if (!this.pointer || event.pointerId !== this.pointer.id) {
      return;
    }

    if (!this.options.longPressEnabled) {
      return;
    }

    if (!this.longPressTimer) {
      return;
    }

    const distanceSq = getDistanceSquared(this.pointer, event);
    const threshold = this.options.movementThresholdPx;
    if (distanceSq > threshold * threshold) {
      this.clearLongPressTimer();
    }
  }

  public onPointerCancel(event: PointerEvent): void {
    if (!this.pointer || event.pointerId !== this.pointer.id) {
      return;
    }

    this.resetPointer();
  }

  public onPointerUp(event: PointerEvent): void {
    if (!this.pointer || event.pointerId !== this.pointer.id) {
      return;
    }

    const hadLongPress = this.longPressFired;
    this.resetPointer();

    if (hadLongPress) {
      return;
    }

    if (!this.options.doubleTapEnabled) {
      this.dispatchTap(event);
      return;
    }

    const now = getEventTimestamp(event);

    if (this.pendingTapTimer && now - this.lastTapTime <= this.options.doubleTapWindowMs) {
      this.cancelPendingTap();
      this.lastTapTime = 0;
      if (this.callbacks.onDoubleTap) {
        this.callbacks.onDoubleTap(event);
      } else {
        this.dispatchTap(event);
      }
      return;
    }

    this.scheduleTap(event, now);
  }

  public reset(): void {
    this.resetPointer();
    this.cancelPendingTap();
  }

  private scheduleTap(event: PointerEvent, timestamp: number): void {
    this.cancelPendingTap();
    this.lastTapTime = timestamp;
    this.pendingTapTimer = window.setTimeout(() => {
      this.pendingTapTimer = undefined;
      this.dispatchTap(event);
    }, this.options.doubleTapWindowMs);
  }

  private dispatchTap(event: PointerEvent): void {
    this.cancelPendingTap();
    this.callbacks.onTap(event);
  }

  private isPrimaryPointer(event: PointerEvent): boolean {
    if (event.isPrimary === false) {
      return false;
    }

    if (event.button !== undefined && event.button !== 0 && event.pointerType !== "touch") {
      return false;
    }

    return true;
  }

  private resetPointer(): void {
    this.clearLongPressTimer();
    this.pointer = undefined;
    this.longPressFired = false;
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer !== undefined) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = undefined;
    }
  }

  private cancelPendingTap(): void {
    if (this.pendingTapTimer !== undefined) {
      clearTimeout(this.pendingTapTimer);
      this.pendingTapTimer = undefined;
    }
  }
}
