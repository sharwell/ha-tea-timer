import { StructuredLogger } from "./logger";
import {
  DEBUG_ALL,
  DEBUG_LOGS_BIT,
  DEBUG_OVERLAY_BIT,
  DebugMode,
  debugModeToString,
  modeIncludesLogs,
  modeIncludesOverlay,
  parseDebugMode,
} from "./mode";
import type {
  DebugCorrectionPayload,
  DebugOverlaySample,
  DebugSeedPayload,
  DebugStartOutlierPayload,
} from "./types";
import type { DebugOverlayHandle } from "./overlay";

interface RuntimeDebugManagerOptions {
  window?: Window & typeof globalThis;
  logger?: StructuredLogger;
  loadOverlay?: () => Promise<DebugOverlayHandle>;
  console?: Pick<Console, "warn">;
}

type ModeSource = "init" | "query" | "storage" | "api";

const STORAGE_KEY = "tt_debug";

function storageValueForMode(mode: DebugMode): string {
  switch (mode) {
    case DEBUG_ALL:
      return "1";
    case DEBUG_OVERLAY_BIT:
      return "overlay";
    case DEBUG_LOGS_BIT:
      return "logs";
    default:
      return "0";
  }
}

declare global {
  interface Window {
    teaTimerDebug?: {
      enable(mode?: string): void;
      disable(): void;
      toggle(mode?: string): void;
      mode(): "off" | "overlay" | "logs" | "all";
    };
  }
}

export class RuntimeDebugManager {
  private readonly window?: Window & typeof globalThis;

  private readonly logger: StructuredLogger;

  private readonly loadOverlay: () => Promise<DebugOverlayHandle>;

  private readonly console: Pick<Console, "warn">;

  private overlayHandle?: DebugOverlayHandle;

  private overlayPromise?: Promise<DebugOverlayHandle | undefined>;

  private mode: DebugMode = 0;

  private lastSample: DebugOverlaySample | undefined;

  private readonly handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) {
      return;
    }

    const next = parseDebugMode(event.newValue ?? undefined);
    this.setModeInternal(next, "storage", { persist: false });
  };

  constructor(options?: RuntimeDebugManagerOptions) {
    this.window = options?.window ?? (typeof window !== "undefined" ? window : undefined);
    this.logger = options?.logger ?? new StructuredLogger();
    this.console = options?.console ?? console;
    this.loadOverlay =
      options?.loadOverlay ?? (() => import("./overlay").then((module) => module.createDebugOverlay()));

    this.initializeFromEnvironment();
    this.installGlobalApi();
    this.installStorageListener();
  }

  public enable(mode?: string): void {
    const parsed = parseDebugMode(mode ?? "1");
    const normalized: DebugMode = parsed === 0 ? DEBUG_ALL : parsed;
    this.setModeInternal(normalized, "api", { persist: true });
  }

  public disable(): void {
    this.setModeInternal(0, "api", { persist: true });
  }

  public toggle(mode?: string): void {
    if (this.mode === 0) {
      this.enable(mode);
    } else {
      this.disable();
    }
  }

  public getModeString(): "off" | "overlay" | "logs" | "all" {
    return debugModeToString(this.mode);
  }

  public reportSeed(payload: DebugSeedPayload): void {
    this.lastSample = { ...this.lastSample, ...payload };
    if (modeIncludesLogs(this.mode)) {
      this.logger.logSeed(payload);
    }

    if (modeIncludesOverlay(this.mode)) {
      void this.ensureOverlay().then((overlay) => {
        if (overlay && this.lastSample) {
          overlay.update(this.lastSample);
        }
      });
    }
  }

  public reportTick(payload: DebugOverlaySample): void {
    this.lastSample = { ...this.lastSample, ...payload };
    if (!modeIncludesOverlay(this.mode)) {
      return;
    }

    void this.ensureOverlay().then((overlay) => {
      if (overlay && this.lastSample) {
        overlay.update(this.lastSample);
      }
    });
  }

  public reportServerCorrection(payload: DebugCorrectionPayload): void {
    if (!modeIncludesLogs(this.mode)) {
      return;
    }

    this.logger.logCorrection(payload);
  }

  public reportStartOutlier(payload: DebugStartOutlierPayload): void {
    const logPayload = {
      evt: "start_outlier" as const,
      requestedDurationS: payload.requestedDurationS,
      firstComputedS: payload.firstComputedS,
      deltaS: payload.deltaS,
      intentTsIso: payload.intentTsIso,
      nowMs: payload.nowMs,
      entityId: payload.entityId,
    };

    this.console.warn?.("[ha-tea-timer]", logPayload);

    if (!modeIncludesLogs(this.mode)) {
      return;
    }

    this.logger.logStartOutlier(payload);
  }

  private initializeFromEnvironment(): void {
    if (!this.window) {
      return;
    }

    const location = this.window.location;
    let applied = false;
    if (location) {
      try {
        const params = new URLSearchParams(location.search ?? "");
        if (params.has(STORAGE_KEY)) {
          const raw = params.get(STORAGE_KEY);
          const parsed = parseDebugMode(raw ?? "1");
          this.setModeInternal(parsed, "query", { persist: true });
          applied = true;
        }
      } catch {
        // ignore malformed location
      }
    }

    if (applied) {
      return;
    }

    const storage = this.getLocalStorage();
    if (!storage) {
      return;
    }

    try {
      const stored = storage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const parsed = parseDebugMode(stored);
        this.setModeInternal(parsed, "init", { persist: false });
      }
    } catch {
      // ignore storage errors
    }
  }

  private installGlobalApi(): void {
    if (!this.window) {
      return;
    }

    const api = {
      enable: (mode?: string) => this.enable(mode),
      disable: () => this.disable(),
      toggle: (mode?: string) => this.toggle(mode),
      mode: () => this.getModeString(),
    } as const;

    this.window.teaTimerDebug = {
      ...(this.window.teaTimerDebug ?? {}),
      ...api,
    };
  }

  private installStorageListener(): void {
    if (!this.window?.addEventListener) {
      return;
    }

    this.window.addEventListener("storage", this.handleStorageEvent);
  }

  private getLocalStorage(): Storage | undefined {
    if (!this.window) {
      return undefined;
    }

    try {
      return this.window.localStorage;
    } catch {
      return undefined;
    }
  }

  private setModeInternal(mode: DebugMode, _source: ModeSource, options: { persist: boolean }): void {
    if (mode === this.mode) {
      if (options.persist) {
        this.persistMode(mode);
      }
      return;
    }

    this.mode = mode;

    if (modeIncludesOverlay(this.mode)) {
      void this.ensureOverlay();
    } else {
      this.teardownOverlay();
    }

    if (options.persist) {
      this.persistMode(mode);
    }
  }

  private async ensureOverlay(): Promise<DebugOverlayHandle | undefined> {
    if (!modeIncludesOverlay(this.mode)) {
      return undefined;
    }

    if (this.overlayHandle) {
      return this.overlayHandle;
    }

    if (!this.overlayPromise) {
      this.overlayPromise = this.loadOverlay()
        .then((overlay) => {
          if (!modeIncludesOverlay(this.mode)) {
            overlay.destroy();
            return undefined;
          }
          this.overlayHandle = overlay;
          if (this.lastSample) {
            overlay.update(this.lastSample);
          }
          return overlay;
        })
        .catch((error) => {
          this.console.warn?.("ha-tea-timer debug: unable to load overlay", error);
          return undefined;
        })
        .finally(() => {
          this.overlayPromise = undefined;
        });
    }

    await this.overlayPromise;
    return this.overlayHandle;
  }

  private teardownOverlay(): void {
    if (this.overlayHandle) {
      this.overlayHandle.destroy();
      this.overlayHandle = undefined;
    }
  }

  private persistMode(mode: DebugMode): void {
    const storage = this.getLocalStorage();
    if (!storage) {
      return;
    }

    try {
      if (mode === 0) {
        storage.removeItem(STORAGE_KEY);
      } else {
        storage.setItem(STORAGE_KEY, storageValueForMode(mode));
      }
    } catch {
      // ignore persistence errors
    }
  }
}
