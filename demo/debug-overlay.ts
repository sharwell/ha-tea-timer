import type { TimerViewState } from "../src/state/TimerStateController";

const REFRESH_INTERVAL_MS = 250;
const HISTORY_LIMIT = 360;

type InternalTeaTimerCard = HTMLElement & {
  _timerStateController?: { state: TimerViewState };
  _getEffectiveDisplayRemaining?: (state: TimerViewState) => number | undefined;
  _displayDurationSeconds?: number;
  _timerState?: TimerViewState;
};

interface DebugSample {
  timestamp: string;
  connectionStatus: string;
  wsConnected: boolean;
  entityState?: string;
  serverRemainingS?: number;
  clientRemainingS?: number;
  lastServerUpdateTs?: string;
  tickDeltaMs?: number;
  jitter95pMs?: number;
  backTickCount: number;
  stutterCount: number;
}

type HaTeaTimerDebug = {
  getSamples(): readonly DebugSample[];
  clear(): void;
  dump(): DebugSample[];
  metrics(): {
    backTicks: number;
    stutters: number;
    jitter95pMs: number | undefined;
    lastTickMs: number | undefined;
  };
};

declare global {
  interface Window {
    haTeaTimerDebug?: HaTeaTimerDebug;
  }
}

const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
const isVitest = Boolean((globalThis as { __VITEST__?: boolean }).__VITEST__);

if (isBrowser && !isVitest) {
  bootstrap();
} else if (isBrowser) {
  window.haTeaTimerDebug =
    window.haTeaTimerDebug ??
    ({
      getSamples: () => [],
      clear: () => undefined,
      dump: () => [],
      metrics: () => ({ backTicks: 0, stutters: 0, jitter95pMs: undefined, lastTickMs: undefined }),
    } satisfies HaTeaTimerDebug);
}

function bootstrap(): void {
  const root = document.createElement("aside");
  root.id = "tea-timer-debug-overlay";
  root.style.position = "fixed";
  root.style.top = "16px";
  root.style.right = "16px";
  root.style.zIndex = "9999";
  root.style.fontFamily =
    'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  root.style.fontSize = "12px";
  root.style.background = "rgba(17, 24, 39, 0.86)";
  root.style.color = "#f8fafc";
  root.style.padding = "12px 16px";
  root.style.borderRadius = "8px";
  root.style.minWidth = "260px";
  root.style.pointerEvents = "none";
  root.style.boxShadow = "0 10px 30px rgba(15, 23, 42, 0.45)";

  const header = document.createElement("header");
  header.textContent = "Tea Timer Debug";
  header.style.fontSize = "13px";
  header.style.fontWeight = "600";
  header.style.marginBottom = "8px";
  root.append(header);

  const content = document.createElement("dl");
  content.style.display = "grid";
  content.style.gridTemplateColumns = "auto 1fr";
  content.style.columnGap = "12px";
  content.style.rowGap = "6px";
  root.append(content);

  document.body.append(root);

  const samples: DebugSample[] = [];
  const tickIntervals: number[] = [];

  let backTickCount = 0;
  let stutterCount = 0;
  let lastClientRemaining: number | undefined;
  let lastTickTimestamp: number | undefined;
  let lastTickDelta: number | undefined;

  function percentile95(values: readonly number[]): number | undefined {
    if (!values.length) {
      return undefined;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const rank = 0.95 * (sorted.length - 1);
    const lowerIndex = Math.floor(rank);
    const upperIndex = Math.ceil(rank);
    if (lowerIndex === upperIndex) {
      return sorted[lowerIndex];
    }
    const fraction = rank - lowerIndex;
    return sorted[lowerIndex] + fraction * (sorted[upperIndex] - sorted[lowerIndex]);
  }

  function setField(label: string, value: string): void {
    const dt = document.createElement("dt");
    dt.textContent = label;
    dt.style.opacity = "0.72";
    const dd = document.createElement("dd");
    dd.textContent = value;
    dd.style.margin = "0";
    content.append(dt, dd);
  }

  function formatNumber(value: number | undefined): string {
    if (value === undefined || Number.isNaN(value)) {
      return "—";
    }
    return value.toFixed(0);
  }

  function computeServerRemaining(state: TimerViewState | undefined): number | undefined {
    const base = state?.serverRemainingSecAtT0;
    if (typeof base !== "number") {
      return undefined;
    }

    const t0 = state?.clientMonotonicT0;
    if (typeof t0 === "number") {
      const elapsedMs = Math.max(0, performance.now() - t0);
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      return Math.max(0, base - elapsedSeconds);
    }

    return base;
  }

  function computeClientRemaining(
    card: InternalTeaTimerCard | undefined,
    state: TimerViewState | undefined,
  ): number | undefined {
    if (!card || !state) {
      return undefined;
    }

    const resolver = card._getEffectiveDisplayRemaining as
      | ((candidate: TimerViewState) => number | undefined)
      | undefined;
    if (typeof resolver === "function") {
      try {
        const resolved = resolver.call(card, state);
        if (typeof resolved === "number") {
          return resolved;
        }
      } catch (error) {
        const reason = error instanceof Error ? error : new Error(String(error));
        console.warn(
          "ha-tea-timer debug overlay: unable to call _getEffectiveDisplayRemaining",
          reason,
        );
      }
    }

    const display = card._displayDurationSeconds;
    if (typeof display === "number") {
      return display;
    }

    const timerState = (card._timerState ?? state) as TimerViewState | undefined;
    if (timerState && typeof timerState.remainingSeconds === "number") {
      return timerState.remainingSeconds;
    }

    return undefined;
  }

  function getCard(): InternalTeaTimerCard | undefined {
    const element = document.querySelector<HTMLElement>("tea-timer-card");
    return element ? (element as InternalTeaTimerCard) : undefined;
  }

  function updateTickMetrics(clientRemaining: number | undefined, now: number): void {
    if (clientRemaining === undefined || Number.isNaN(clientRemaining)) {
      return;
    }

    if (lastClientRemaining === undefined) {
      lastClientRemaining = clientRemaining;
      lastTickTimestamp = now;
      return;
    }

    if (clientRemaining === lastClientRemaining) {
      return;
    }

    if (clientRemaining > lastClientRemaining) {
      backTickCount += 1;
      lastClientRemaining = clientRemaining;
      lastTickTimestamp = now;
      lastTickDelta = undefined;
      return;
    }

    const interval = lastTickTimestamp !== undefined ? now - lastTickTimestamp : undefined;
    lastClientRemaining = clientRemaining;
    lastTickTimestamp = now;

    if (interval === undefined) {
      return;
    }

    lastTickDelta = interval;
    tickIntervals.push(interval);
    if (tickIntervals.length > HISTORY_LIMIT) {
      tickIntervals.shift();
    }

    if (interval < 800 || interval > 1200) {
      stutterCount += 1;
    }
  }

  function updateOverlay(): void {
    content.replaceChildren();

    const card = getCard();
    const controller = card?._timerStateController as { state: TimerViewState } | undefined;
    const state: TimerViewState | undefined = controller?.state;

    const connectionStatus = state?.connectionStatus ?? "disconnected";
    const wsConnected = connectionStatus === "connected";
    const entityStatus = state?.status ? String(state.status) : undefined;
    const uiState = state?.uiState ? (typeof state.uiState === "string" ? state.uiState : state.uiState.kind) : undefined;
    const entityState = entityStatus && uiState ? `${entityStatus} (${uiState})` : entityStatus ?? uiState;

    const serverRemaining = computeServerRemaining(state);
    const clientRemaining = computeClientRemaining(card, state);

    updateTickMetrics(clientRemaining, performance.now());

    const jitter95 = percentile95(tickIntervals);

    const lastServerUpdate =
      typeof state?.lastChangedTs === "number" ? new Date(state.lastChangedTs).toISOString() : undefined;

    const sample: DebugSample = {
      timestamp: new Date().toISOString(),
      connectionStatus,
      wsConnected,
      entityState,
      serverRemainingS: typeof serverRemaining === "number" ? Math.max(0, Math.floor(serverRemaining)) : undefined,
      clientRemainingS:
        typeof clientRemaining === "number" ? Math.max(0, Math.round(clientRemaining)) : undefined,
      lastServerUpdateTs: lastServerUpdate,
      tickDeltaMs: lastTickDelta !== undefined ? Math.round(lastTickDelta) : undefined,
      jitter95pMs: jitter95 !== undefined ? Math.round(jitter95) : undefined,
      backTickCount,
      stutterCount,
    };

    samples.push(sample);
    if (samples.length > HISTORY_LIMIT) {
      samples.shift();
    }

    setField("nowTs", sample.timestamp);
    setField("wsConnected", wsConnected ? "true" : "false");
    setField("connection", connectionStatus);
    setField("entityState", entityState ?? "—");
    setField("serverRemainingS", formatNumber(sample.serverRemainingS));
    setField("clientRemainingS", formatNumber(sample.clientRemainingS));
    setField("lastServerUpdateTs", lastServerUpdate ?? "—");
    setField("tickDeltaMs", sample.tickDeltaMs !== undefined ? `${sample.tickDeltaMs}` : "—");
    setField("jitter95pMs", sample.jitter95pMs !== undefined ? `${sample.jitter95pMs}` : "—");
    setField("backTicks", `${backTickCount}`);
    setField("stutters", `${stutterCount}`);
  }

  function loop(): void {
    updateOverlay();
    window.setTimeout(loop, REFRESH_INTERVAL_MS);
  }

  loop();

  window.haTeaTimerDebug = {
    getSamples: () => samples,
    clear: () => {
      samples.length = 0;
      tickIntervals.length = 0;
      backTickCount = 0;
      stutterCount = 0;
      lastClientRemaining = undefined;
      lastTickTimestamp = undefined;
      lastTickDelta = undefined;
    },
    dump: () => {
      const copy = [...samples];
      console.table(copy);
      return copy;
    },
    metrics: () => ({
      backTicks: backTickCount,
      stutters: stutterCount,
      jitter95pMs: percentile95(tickIntervals),
      lastTickMs: lastTickDelta,
    }),
  } satisfies HaTeaTimerDebug;
}

export {};
