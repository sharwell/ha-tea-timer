import { HassEntity } from "../types/home-assistant";

export type TimerStatus = "idle" | "running" | "finished" | "unavailable";

export interface TimerViewState {
  status: TimerStatus;
  durationSeconds?: number;
  remainingSeconds?: number;
  lastChangedTs?: number;
  finishedUntilTs?: number;
  remainingIsEstimated?: boolean;
  estimationDriftSeconds?: number;
}

export interface TimerStateMachineOptions {
  finishedOverlayMs: number;
  now?: () => number;
}

function parseTimestamp(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseHaTime(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const parts = value.split(":").map((part) => part.trim());
  if (parts.length === 0 || parts.length > 3 || parts.some((part) => part === "" || Number.isNaN(Number(part)))) {
    return undefined;
  }

  while (parts.length < 3) {
    parts.unshift("0");
  }

  const [hours, minutes, seconds] = parts.map((part) => Number(part));
  if (![hours, minutes, seconds].every((item) => Number.isFinite(item) && item >= 0)) {
    return undefined;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

function normalizeEntity(
  entity: HassEntity | undefined,
  clientNow: number,
  serverNow?: number,
): TimerViewState {
  if (!entity) {
    return { status: "unavailable" };
  }

  const rawState = entity.state ?? "";
  const state = rawState.toLowerCase();

  if (state === "unavailable" || state === "unknown") {
    return { status: "unavailable" };
  }

  const lastChangedTs = parseTimestamp(entity.last_changed);
  const durationSeconds = parseHaTime(entity.attributes?.duration);
  const reportedRemainingSeconds = parseHaTime(entity.attributes?.remaining);
  const finishesAt = parseTimestamp(entity.attributes?.finishes_at);

  const effectiveServerNow = serverNow ?? clientNow;

  if (state === "active" || state === "paused") {
    let remainingSeconds = reportedRemainingSeconds;
    let remainingIsEstimated = false;
    let estimationDriftSeconds: number | undefined;

    if (state === "active" && finishesAt !== undefined) {
      const remainingMs = finishesAt - effectiveServerNow;
      remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      remainingIsEstimated = false;
    }

    if (remainingSeconds === undefined && durationSeconds !== undefined && lastChangedTs !== undefined) {
      const elapsedMs = Math.max(0, effectiveServerNow - lastChangedTs);
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      const computedRemaining = Math.max(0, durationSeconds - elapsedSeconds);
      remainingSeconds = computedRemaining;
      remainingIsEstimated = true;

      const driftSeconds = Math.max(0, Math.floor(elapsedSeconds - durationSeconds));
      if (driftSeconds > 0) {
        estimationDriftSeconds = driftSeconds;
      }
    }

    return {
      status: "running",
      durationSeconds,
      remainingSeconds,
      lastChangedTs,
      remainingIsEstimated,
      estimationDriftSeconds,
    };
  }

  if (state === "idle") {
    const remainingSeconds = reportedRemainingSeconds ?? durationSeconds;
    return {
      status: "idle",
      durationSeconds,
      remainingSeconds,
      lastChangedTs,
    };
  }

  return {
    status: "idle",
    durationSeconds,
    remainingSeconds: reportedRemainingSeconds ?? durationSeconds,
    lastChangedTs,
  };
}

export class TimerStateMachine {
  private finishedOverlayMs: number;

  private readonly now: () => number;

  private overlayUntil?: number;

  private lastEntity?: HassEntity;

  private current: TimerViewState = { status: "unavailable" };

  constructor(options: TimerStateMachineOptions) {
    this.finishedOverlayMs = Math.max(0, options.finishedOverlayMs);
    this.now = options.now ?? (() => Date.now());
  }

  public setFinishedOverlayMs(value: number): void {
    if (!Number.isFinite(value)) {
      return;
    }

    this.finishedOverlayMs = Math.max(0, value);
  }

  public get state(): TimerViewState {
    return this.current;
  }

  public updateFromEntity(
    entity: HassEntity | undefined,
    atTime = this.now(),
    options?: { serverNow?: number },
  ): TimerViewState {
    this.lastEntity = entity ?? undefined;
    const baseState = normalizeEntity(entity, atTime, options?.serverNow);
    const state = this.applyOverlay(baseState, atTime);
    this.current = state;
    return state;
  }

  public markFinished(atTime = this.now(), options?: { serverNow?: number }): TimerViewState {
    this.overlayUntil = atTime + this.finishedOverlayMs;
    const baseState = normalizeEntity(this.lastEntity, atTime, options?.serverNow);
    const state = this.applyOverlay(baseState, atTime);
    this.current = state;
    return state;
  }

  public handleTimeAdvance(atTime = this.now(), options?: { serverNow?: number }): TimerViewState {
    const baseState = normalizeEntity(this.lastEntity, atTime, options?.serverNow);
    const state = this.applyOverlay(baseState, atTime);
    this.current = state;
    return state;
  }

  public clear(): TimerViewState {
    this.lastEntity = undefined;
    this.overlayUntil = undefined;
    this.current = { status: "unavailable" };
    return this.current;
  }

  public getOverlayDeadline(): number | undefined {
    return this.overlayUntil;
  }

  private applyOverlay(baseState: TimerViewState, atTime: number): TimerViewState {
    if (this.overlayUntil === undefined) {
      return baseState;
    }

    if (this.overlayUntil <= atTime) {
      this.overlayUntil = undefined;
      return baseState;
    }

    return {
      ...baseState,
      status: "finished",
      finishedUntilTs: this.overlayUntil,
    };
  }
}

export function normalizeTimerEntity(
  entity: HassEntity | undefined,
  now: number,
  options?: { serverNow?: number },
): TimerViewState {
  return normalizeEntity(entity, now, options?.serverNow);
}
