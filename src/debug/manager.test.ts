import { describe, expect, it, vi } from "vitest";
import { StructuredLogger } from "./logger";
import { RuntimeDebugManager } from "./manager";
import type { DebugOverlayHandle } from "./overlay";

type FakeWindowOptions = {
  search?: string;
};

function createFakeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  } satisfies Storage;
}

function createFakeWindow(options?: FakeWindowOptions) {
  const storage = createFakeStorage();
  const listeners = new Map<string, Array<(event: StorageEvent) => void>>();

  return {
    location: ({ search: options?.search ?? "" } as unknown) as Location,
    localStorage: storage,
    addEventListener: (event: string, handler: EventListenerOrEventListenerObject) => {
      if (event !== "storage") {
        return;
      }
      const entry = listeners.get(event) ?? [];
      entry.push(handler as (event: StorageEvent) => void);
      listeners.set(event, entry);
    },
    removeEventListener: () => undefined,
    dispatchStorage(event: StorageEvent) {
      listeners.get("storage")?.forEach((handler) => handler(event));
    },
  } as unknown as (Window & typeof globalThis & { dispatchStorage(event: StorageEvent): void });
}

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("RuntimeDebugManager", () => {
  it("only logs when logs mode is enabled", () => {
    const infoSpy = vi.fn();
    const logger = new StructuredLogger({ info: infoSpy, warn: vi.fn() } as Pick<Console, "info" | "warn">);
    const loadOverlay = vi.fn<[], Promise<DebugOverlayHandle>>().mockResolvedValue({
      update: vi.fn(),
      destroy: vi.fn(),
    });
    const fakeWindow = createFakeWindow();
    const manager = new RuntimeDebugManager({
      window: fakeWindow,
      logger,
      loadOverlay,
      console: { warn: vi.fn() },
    });

    manager.reportSeed({
      seedSource: "server_remaining",
      serverRemaining: 120,
      estimatedRemaining: 120,
      baselineEndMs: Date.now() + 120_000,
      lastServerUpdate: new Date().toISOString(),
    });

    expect(infoSpy).not.toHaveBeenCalled();

    manager.enable("logs");

    manager.reportSeed({
      seedSource: "server_remaining",
      serverRemaining: 60,
      estimatedRemaining: 60,
      baselineEndMs: Date.now() + 60_000,
      lastServerUpdate: new Date().toISOString(),
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it("loads overlay lazily", async () => {
    const infoSpy = vi.fn();
    const logger = new StructuredLogger({ info: infoSpy, warn: vi.fn() } as Pick<Console, "info" | "warn">);
    const destroySpy = vi.fn();
    const overlayHandle: DebugOverlayHandle = { update: vi.fn(), destroy: destroySpy };
    let resolveOverlay: ((value: DebugOverlayHandle) => void) | undefined;
    const loadOverlay = vi
      .fn<[], Promise<DebugOverlayHandle>>()
      .mockImplementation(
        () =>
          new Promise<DebugOverlayHandle>((resolve) => {
            resolveOverlay = resolve;
          }),
      );
    const fakeWindow = createFakeWindow();
    const manager = new RuntimeDebugManager({
      window: fakeWindow,
      logger,
      loadOverlay,
      console: { warn: vi.fn() },
    });

    expect(loadOverlay).not.toHaveBeenCalled();

    manager.enable("logs");
    expect(loadOverlay).not.toHaveBeenCalled();

    manager.enable("overlay");
    expect(loadOverlay).toHaveBeenCalledTimes(1);

    manager.disable();
    resolveOverlay?.(overlayHandle);
    await flushMicrotasks();
    expect(destroySpy).toHaveBeenCalled();
  });

  it("merges overlay samples when overlay mode is active", async () => {
    const logger = new StructuredLogger({ info: vi.fn(), warn: vi.fn() } as Pick<Console, "info" | "warn">);
    const updateSpy = vi.fn();
    const overlayHandle: DebugOverlayHandle = { update: updateSpy, destroy: vi.fn() };
    const loadOverlay = vi.fn<[], Promise<DebugOverlayHandle>>().mockResolvedValue(overlayHandle);
    const fakeWindow = createFakeWindow();
    const manager = new RuntimeDebugManager({
      window: fakeWindow,
      logger,
      loadOverlay,
      console: { warn: vi.fn() },
    });

    manager.enable("overlay");
    await flushMicrotasks();
    expect(loadOverlay).toHaveBeenCalledTimes(1);

    const seedPayload = {
      seedSource: "reload" as const,
      serverRemaining: 90,
      estimatedRemaining: 90,
      baselineEndMs: 1_234_000,
      lastServerUpdate: "2024-01-01T00:00:00.000Z",
    };
    manager.reportSeed(seedPayload);
    await flushMicrotasks();

    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenLastCalledWith(seedPayload);

    manager.reportTick({ estimatedRemaining: 89, baselineEndMs: 1_235_000 });
    await flushMicrotasks();

    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(updateSpy).toHaveBeenLastCalledWith({
      seedSource: "reload",
      serverRemaining: 90,
      estimatedRemaining: 89,
      baselineEndMs: 1_235_000,
      lastServerUpdate: "2024-01-01T00:00:00.000Z",
    });
  });

  it("logs start outlier warnings via console and debug logger", () => {
    const warnSpy = vi.fn();
    const logStartOutlierSpy = vi.fn();
    const logger = {
      logSeed: vi.fn(),
      logCorrection: vi.fn(),
      logStartOutlier: logStartOutlierSpy,
    } as unknown as StructuredLogger;

    const manager = new RuntimeDebugManager({ logger, console: { warn: warnSpy } });

    const payload = {
      requestedDurationS: 240,
      firstComputedS: 7200,
      deltaS: 6960,
      intentTsIso: "2024-01-01T00:00:00.000Z",
      nowMs: 123,
      entityId: "timer.test",
    };

    manager.reportStartOutlier(payload);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("[ha-tea-timer]", {
      evt: "start_outlier",
      requestedDurationS: 240,
      firstComputedS: 7200,
      deltaS: 6960,
      intentTsIso: "2024-01-01T00:00:00.000Z",
      nowMs: 123,
      entityId: "timer.test",
    });
    expect(logStartOutlierSpy).not.toHaveBeenCalled();

    manager.enable("logs");
    manager.reportStartOutlier(payload);
    expect(logStartOutlierSpy).toHaveBeenCalledTimes(1);
    expect(logStartOutlierSpy).toHaveBeenLastCalledWith(payload);
  });
});
