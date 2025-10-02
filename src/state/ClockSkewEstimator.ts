export class ClockSkewEstimator {
  public static readonly MAX_CORRECTION_RATE_MS_PER_SEC = 150;
  private static readonly ALPHA_INCREASE = 0.05;
  private static readonly ALPHA_DECREASE = 0.2;

  private targetOffsetMs = 0;
  private appliedOffsetMs = 0;
  private inited = false;
  private lastMonotonicMs: number | undefined;
  private readonly monotonicNow: () => number;

  constructor(monotonicNow: () => number = () =>
    (typeof performance !== "undefined" ? performance.now() : Date.now())) {
    this.monotonicNow = monotonicNow;
  }

  public getOffsetMs(): number {
    return this.appliedOffsetMs;
  }

  public estimateFromServerStamp(serverIso: string | undefined, localMs: number = Date.now()): void {
    if (!serverIso) {
      return;
    }

    const serverMs = Date.parse(serverIso);
    if (!Number.isFinite(serverMs)) {
      return;
    }

    const sample = localMs - serverMs;
    if (this.inited) {
      const alpha = sample > this.targetOffsetMs
        ? ClockSkewEstimator.ALPHA_INCREASE
        : ClockSkewEstimator.ALPHA_DECREASE;
      this.targetOffsetMs = this.targetOffsetMs + (sample - this.targetOffsetMs) * alpha;
    } else {
      this.targetOffsetMs = sample;
      this.appliedOffsetMs = sample;
      this.inited = true;
      this.lastMonotonicMs = this.monotonicNow();
    }
  }

  public serverNowMs(localMs: number = Date.now()): number {
    if (!this.inited) {
      return localMs - this.appliedOffsetMs;
    }

    const nowMonotonic = this.monotonicNow();
    if (this.lastMonotonicMs === undefined) {
      this.lastMonotonicMs = nowMonotonic;
    }

    const deltaMs = Math.max(0, nowMonotonic - this.lastMonotonicMs);
    this.lastMonotonicMs = nowMonotonic;

    if (deltaMs > 0) {
      const deltaSeconds = deltaMs / 1000;
      const maxStep = ClockSkewEstimator.MAX_CORRECTION_RATE_MS_PER_SEC * deltaSeconds;
      const diff = this.targetOffsetMs - this.appliedOffsetMs;
      if (Math.abs(diff) <= maxStep) {
        this.appliedOffsetMs = this.targetOffsetMs;
      } else {
        this.appliedOffsetMs += Math.sign(diff) * maxStep;
      }
    } else {
      this.appliedOffsetMs = this.targetOffsetMs;
    }

    return localMs - this.appliedOffsetMs;
  }

  public reset(): void {
    this.targetOffsetMs = 0;
    this.appliedOffsetMs = 0;
    this.inited = false;
    this.lastMonotonicMs = undefined;
  }
}
