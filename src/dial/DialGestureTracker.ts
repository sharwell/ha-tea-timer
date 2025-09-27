const clampNormalized = (value: number): number => Math.min(1, Math.max(0, value));

const normalizeWrapped = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
};

export class DialGestureTracker {
  private normalized: number;

  private lastRaw?: number;

  constructor(initialNormalized = 0) {
    this.normalized = clampNormalized(initialNormalized);
  }

  public getNormalized(): number {
    return this.normalized;
  }

  public setNormalized(normalized: number): void {
    this.normalized = clampNormalized(normalized);
    this.lastRaw = undefined;
  }

  public synchronize(normalized: number): void {
    this.normalized = clampNormalized(normalized);
  }

  public jumpToRaw(rawNormalized: number): number {
    const wrapped = normalizeWrapped(rawNormalized);
    const candidates = [wrapped, wrapped + 1, wrapped - 1];
    let best = wrapped;
    let bestDelta = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      const delta = Math.abs(candidate - this.normalized);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = candidate;
      }
    }

    const clamped = clampNormalized(best);
    this.normalized = clamped;
    this.lastRaw = wrapped;
    return this.normalized;
  }

  public updateFromRaw(rawNormalized: number): number {
    const wrapped = normalizeWrapped(rawNormalized);

    if (this.lastRaw === undefined) {
      this.lastRaw = wrapped;
      return this.normalized;
    }

    let delta = wrapped - this.lastRaw;
    if (delta > 0.5) {
      delta -= 1;
    } else if (delta < -0.5) {
      delta += 1;
    }

    this.lastRaw = wrapped;
    this.normalized = clampNormalized(this.normalized + delta);
    return this.normalized;
  }
}

export { clampNormalized as clampNormalizedRatio, normalizeWrapped as wrapNormalizedRatio };
