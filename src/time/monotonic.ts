export interface MonotonicCountdownState {
  baselineEndMs?: number;
  /**
   * When defined, caps the visible countdown to avoid upward ticks after small
   * positive corrections. Cleared once the quantized countdown reaches or
   * drops below the cap.
   */
  holdMaxSeconds?: number;
  lastDisplaySeconds?: number;
}

export interface SeedBaselineOptions {
  /**
   * When true, clears any hold and allows the next computed display value to
   * increase relative to the previously rendered value. This is used for
   * material state changes like start/restart or large corrections.
   */
  allowIncrease?: boolean;
}

/**
 * Threshold for allowing the displayed countdown to jump upward for server
 * corrections. Values below this threshold are visually gated even though they
 * are still logged when they exceed 0.75s per #53.
 */
export const VISUAL_CORRECTION_THRESHOLD_MS = 1500;

export function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

export function seedBaseline(
  state: MonotonicCountdownState,
  baselineEndMs: number | undefined,
  options: SeedBaselineOptions = {},
): void {
  if (baselineEndMs === undefined) {
    state.baselineEndMs = undefined;
    state.holdMaxSeconds = undefined;
    state.lastDisplaySeconds = undefined;
    return;
  }

  const allowIncrease = options.allowIncrease ?? false;

  if (allowIncrease) {
    state.holdMaxSeconds = undefined;
    state.lastDisplaySeconds = undefined;
  } else if (state.lastDisplaySeconds !== undefined) {
    state.holdMaxSeconds = state.lastDisplaySeconds;
  }

  state.baselineEndMs = baselineEndMs;
}

export function remainingMs(
  state: MonotonicCountdownState,
  now: number = nowMs(),
): number | undefined {
  if (state.baselineEndMs === undefined) {
    return undefined;
  }

  return Math.max(0, state.baselineEndMs - now);
}

export function displaySeconds(
  state: MonotonicCountdownState,
  now: number = nowMs(),
): number | undefined {
  const remaining = remainingMs(state, now);
  if (remaining === undefined) {
    state.lastDisplaySeconds = undefined;
    return undefined;
  }

  const quantized = Math.max(0, Math.ceil(remaining / 1000));

  let value = quantized;
  if (state.holdMaxSeconds !== undefined && value > state.holdMaxSeconds) {
    value = state.holdMaxSeconds;
  } else if (state.holdMaxSeconds !== undefined && value <= state.holdMaxSeconds) {
    state.holdMaxSeconds = undefined;
  }

  if (state.lastDisplaySeconds !== undefined && value > state.lastDisplaySeconds) {
    value = state.lastDisplaySeconds;
  }

  state.lastDisplaySeconds = value;
  return value;
}
