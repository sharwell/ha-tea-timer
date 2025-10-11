const DEFAULT_WINDOW_MS = 60000;
const DEFAULT_MAX_MAGNITUDE_MS = 10000;
const DEFAULT_MAX_INCREASE_RATE_MS_PER_SEC = 200;
const DISABLED_BASELINE_MAX_SHIFT_SECONDS = 1;

interface SkewSample {
  atMs: number;
  skewMs: number;
}

export interface ClockSkewEstimatorOptions {
  windowMs?: number;
  maxMagnitudeMs?: number;
  maxIncreaseRateMsPerSec?: number;
  monotonicNow?: () => number;
}

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

export class ClockSkewEstimator {
  private readonly windowMs: number;

  private readonly maxMagnitudeMs: number;

  private readonly maxIncreaseRateMsPerSec: number;

  private readonly monotonicNow: () => number;

  private samples: SkewSample[] = [];

  private skewMs = 0;

  private initialized = false;

  private lastMonotonicSample?: number;

  constructor(options: ClockSkewEstimatorOptions = {}) {
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    this.maxMagnitudeMs = Math.max(0, options.maxMagnitudeMs ?? DEFAULT_MAX_MAGNITUDE_MS);
    this.maxIncreaseRateMsPerSec = Math.max(
      0,
      options.maxIncreaseRateMsPerSec ?? DEFAULT_MAX_INCREASE_RATE_MS_PER_SEC,
    );
    this.monotonicNow = options.monotonicNow ?? (() =>
      typeof performance !== "undefined" ? performance.now() : Date.now());
  }

  public getSkewMs(): number {
    return this.skewMs;
  }

  // Compatibility for existing debug hooks/tests that still reference the old name.
  public getOffsetMs(): number {
    return this.getSkewMs();
  }

  public estimateFromServerStamp(serverIso: string | undefined, localMs: number = Date.now()): void {
    if (!serverIso) {
      return;
    }

    const serverMs = Date.parse(serverIso);
    if (!Number.isFinite(serverMs)) {
      return;
    }

    const candidate = clamp(localMs - serverMs, -this.maxMagnitudeMs, this.maxMagnitudeMs);
    this.pushSample({ atMs: localMs, skewMs: candidate });
    const windowMin = this.computeWindowMinimum();

    if (windowMin === undefined) {
      return;
    }

    const monotonicNow = this.monotonicNow();
    const deltaMonotonic = this.lastMonotonicSample !== undefined
      ? Math.max(0, monotonicNow - this.lastMonotonicSample)
      : 0;
    this.lastMonotonicSample = monotonicNow;

    if (!this.initialized) {
      this.skewMs = windowMin;
      this.initialized = true;
      return;
    }

    if (windowMin <= this.skewMs) {
      this.skewMs = windowMin;
      return;
    }

    if (this.maxIncreaseRateMsPerSec <= 0 || deltaMonotonic <= 0) {
      return;
    }

    const maxStep = (deltaMonotonic / 1000) * this.maxIncreaseRateMsPerSec;
    this.skewMs = clamp(windowMin, -this.maxMagnitudeMs, this.skewMs + maxStep);
  }

  public serverNowMs(localMs: number = Date.now()): number {
    return localMs - this.skewMs;
  }

  public applySkew(serverWallMs: number): number {
    return serverWallMs + this.skewMs;
  }

  public elapsedSince(serverWallMs: number, localMs: number = Date.now()): number {
    const adjusted = this.applySkew(serverWallMs);
    return Math.max(0, localMs - adjusted);
  }

  public reset(): void {
    this.samples = [];
    this.skewMs = 0;
    this.initialized = false;
    this.lastMonotonicSample = undefined;
  }

  private pushSample(sample: SkewSample): void {
    this.samples.push(sample);
    this.trimSamples(sample.atMs - this.windowMs);
  }

  private trimSamples(cutoffMs: number): void {
    let removeCount = 0;
    for (const sample of this.samples) {
      if (sample.atMs >= cutoffMs) {
        break;
      }
      removeCount += 1;
    }
    if (removeCount > 0) {
      this.samples = this.samples.slice(removeCount);
    }
  }

  private computeWindowMinimum(): number | undefined {
    if (!this.samples.length) {
      return undefined;
    }

    let min = this.samples[0].skewMs;
    for (let index = 1; index < this.samples.length; index += 1) {
      const value = this.samples[index]?.skewMs;
      if (value < min) {
        min = value;
      }
    }
    return clamp(min, -this.maxMagnitudeMs, this.maxMagnitudeMs);
  }
}

export function boundLocalClockBaseline(
  derivedSeconds: number,
  previousSeconds: number | undefined,
  maxShiftSeconds: number = DISABLED_BASELINE_MAX_SHIFT_SECONDS,
): number {
  if (!Number.isFinite(derivedSeconds)) {
    return derivedSeconds;
  }

  if (previousSeconds === undefined || !Number.isFinite(previousSeconds)) {
    return Math.max(0, derivedSeconds);
  }

  const safeShift = Math.max(0, maxShiftSeconds);
  const maxAllowed = previousSeconds;
  const minAllowed = Math.max(0, previousSeconds - safeShift);
  return clamp(derivedSeconds, minAllowed, maxAllowed);
}
