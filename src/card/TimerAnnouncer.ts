import type { StringTable } from "../strings";
import { formatDurationSpeech } from "../model/duration";
import type { PendingTimerAction } from "../view/TeaTimerViewModel";

export interface ActionAnnouncementOptions {
  action: Exclude<PendingTimerAction, "none">;
  durationSeconds: number;
  presetLabel?: string;
  queued?: boolean;
}

export interface QueuedPresetOptions {
  id: number | "custom" | undefined;
  label?: string;
  durationSeconds: number;
  isCustom: boolean;
}

export class TimerAnnouncer {
  private readonly strings: StringTable;

  private lastAnnouncedSeconds: number | undefined;

  private nextThreshold: number | undefined;

  private activeRun = false;

  private readonly formatDurationSpeech: (seconds: number) => string;

  private lastQueuedId: number | "custom" | undefined;

  constructor(strings: StringTable) {
    this.strings = strings;
    this.formatDurationSpeech = (seconds: number) =>
      formatDurationSpeech(seconds, this.strings.durationSpeech);
  }

  public reset(): void {
    this.lastAnnouncedSeconds = undefined;
    this.nextThreshold = undefined;
    this.activeRun = false;
    this.lastQueuedId = undefined;
  }

  public beginRun(initialSeconds: number | undefined): void {
    if (initialSeconds === undefined) {
      this.lastAnnouncedSeconds = undefined;
      this.nextThreshold = undefined;
    } else {
      const normalized = Math.max(0, Math.floor(initialSeconds));
      this.lastAnnouncedSeconds = normalized;
      this.nextThreshold = this.computeNextThreshold(normalized);
    }
    this.activeRun = true;
    this.lastQueuedId = undefined;
  }

  public endRun(): void {
    this.reset();
  }

  public announceAction(options: ActionAnnouncementOptions): string {
    const durationSpeech = this.formatDurationSpeech(options.durationSeconds);
    if (options.action === "start") {
      return this.strings.ariaStarting(durationSpeech);
    }
    return this.strings.ariaRestarting(durationSpeech);
  }

  public announceRunning(seconds: number | undefined): string | undefined {
    if (!this.activeRun) {
      this.beginRun(seconds);
      return undefined;
    }

    if (seconds === undefined) {
      return undefined;
    }

    const normalized = Math.max(0, Math.floor(seconds));

    if (this.lastAnnouncedSeconds === undefined) {
      this.lastAnnouncedSeconds = normalized;
      this.nextThreshold = this.computeNextThreshold(normalized);
      return undefined;
    }

    if (normalized >= this.lastAnnouncedSeconds) {
      this.lastAnnouncedSeconds = normalized;
      this.nextThreshold = this.computeNextThreshold(normalized);
      return undefined;
    }

    if (this.nextThreshold === undefined) {
      this.nextThreshold = this.computeNextThreshold(this.lastAnnouncedSeconds);
    }

    const previousInterval = this.getInterval(this.lastAnnouncedSeconds);
    const currentInterval = this.getInterval(normalized);

    if (currentInterval < previousInterval) {
      this.nextThreshold = normalized;
    }

    if (this.nextThreshold === undefined) {
      return undefined;
    }

    if (normalized > this.nextThreshold) {
      return undefined;
    }

    const durationSpeech = this.formatDurationSpeech(normalized);
    this.lastAnnouncedSeconds = normalized;
    this.nextThreshold = this.computeNextThreshold(normalized);
    return this.strings.ariaRemaining(durationSpeech);
  }

  public announceFinished(durationSeconds: number | undefined): string {
    const durationSpeech = this.formatDurationSpeech(durationSeconds ?? 0);
    return this.strings.ariaFinishedWithDuration(durationSpeech);
  }

  public announceQueuedPreset(options: QueuedPresetOptions): string | undefined {
    const { id } = options;
    if (id === undefined) {
      this.lastQueuedId = undefined;
      return undefined;
    }

    if (this.lastQueuedId === id) {
      return undefined;
    }

    this.lastQueuedId = id;
    const durationSpeech = this.formatDurationSpeech(options.durationSeconds);

    if (options.isCustom || id === "custom") {
      return this.strings.ariaQueuedCustom(durationSpeech);
    }

    if (options.label) {
      return this.strings.ariaQueuedPreset(options.label, durationSpeech);
    }

    return undefined;
  }

  private computeNextThreshold(seconds: number | undefined): number | undefined {
    if (seconds === undefined) {
      return undefined;
    }

    if (seconds <= 0) {
      return 0;
    }

    const interval = this.getInterval(seconds);
    const next = seconds - interval;
    return next < 0 ? 0 : next;
  }

  private getInterval(seconds: number): number {
    if (seconds > 120) {
      return 30;
    }
    if (seconds > 60) {
      return 10;
    }
    if (seconds > 10) {
      return 5;
    }
    return 1;
  }
}
