export class ClockSkewEstimator {
  private offsetMs = 0;
  private inited = false;
  private static readonly ALPHA = 0.2;

  public getOffsetMs(): number {
    return this.offsetMs;
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
      this.offsetMs = this.offsetMs + (sample - this.offsetMs) * ClockSkewEstimator.ALPHA;
    } else {
      this.offsetMs = sample;
      this.inited = true;
    }
  }

  public serverNowMs(localMs: number = Date.now()): number {
    return localMs - this.offsetMs;
  }
}
