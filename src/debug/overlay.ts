import type { DebugOverlaySample } from "./types";

export interface DebugOverlayHandle {
  update(sample: DebugOverlaySample): void;
  destroy(): void;
}

const MIN_UPDATE_INTERVAL_MS = 1000;

const FONT_STACK =
  'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const FIELD_LABELS: ReadonlyArray<{ key: keyof DebugOverlaySample | "nowMs" | "clockSkewMs"; label: string }> = [
  { key: "seedSource", label: "seedSource" },
  { key: "serverRemaining", label: "serverRemaining" },
  { key: "estimatedRemaining", label: "estimatedRemaining" },
  { key: "baselineEndMs", label: "baselineEndMs" },
  { key: "nowMs", label: "nowMs" },
  { key: "clockSkewMs", label: "clockSkewMs" },
  { key: "lastServerUpdate", label: "lastServerUpdate" },
];

export function createDebugOverlay(): DebugOverlayHandle {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      update: () => undefined,
      destroy: () => undefined,
    };
  }

  const container = document.createElement("aside");
  container.setAttribute("aria-live", "off");
  container.setAttribute("aria-hidden", "true");
  container.style.position = "fixed";
  container.style.bottom = "16px";
  container.style.right = "16px";
  container.style.zIndex = "2147483647";
  container.style.fontFamily = FONT_STACK;
  container.style.fontSize = "12px";
  container.style.lineHeight = "1.35";
  container.style.background = "rgba(15, 23, 42, 0.86)";
  container.style.color = "#e2e8f0";
  container.style.padding = "10px 14px";
  container.style.borderRadius = "8px";
  container.style.pointerEvents = "none";
  container.style.boxShadow = "0 12px 32px rgba(15, 23, 42, 0.45)";
  container.style.minWidth = "240px";
  container.style.maxWidth = "320px";
  container.style.letterSpacing = "0";

  const title = document.createElement("header");
  title.textContent = "Tea Timer Diagnostics";
  title.style.fontSize = "12px";
  title.style.fontWeight = "600";
  title.style.marginBottom = "6px";
  container.append(title);

  const grid = document.createElement("dl");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "auto 1fr";
  grid.style.gap = "4px 12px";
  grid.style.margin = "0";
  container.append(grid);

  const fields = new Map<string, HTMLElement>();
  FIELD_LABELS.forEach(({ key, label }) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    dt.style.opacity = "0.7";
    dt.style.margin = "0";
    dt.style.fontWeight = "500";
    const dd = document.createElement("dd");
    dd.textContent = "—";
    dd.style.margin = "0";
    dd.style.fontVariantNumeric = "tabular-nums";
    grid.append(dt, dd);
    fields.set(key, dd);
  });

  document.body.append(container);

  const overlayStartWallClock = Date.now();
  const performanceNow =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? () => performance.now()
      : () => Date.now();
  const overlayStartNow = performanceNow();

  let latestSample: DebugOverlaySample | undefined;
  let lastRenderNow: number | undefined;
  let pendingTimer: number | undefined;

  const updateField = (key: string, value: string) => {
    const element = fields.get(key);
    if (!element) {
      return;
    }
    if (element.textContent !== value) {
      element.textContent = value;
    }
  };

  const formatSeconds = (value: number | undefined): string => {
    if (value === undefined || Number.isNaN(value)) {
      return "—";
    }
    if (!Number.isFinite(value)) {
      return "∞";
    }
    const abs = Math.abs(value);
    const decimals = abs % 1 === 0 ? 0 : abs < 10 ? 1 : 0;
    return value.toFixed(decimals);
  };

  const formatNumber = (value: number | undefined): string => {
    if (value === undefined || Number.isNaN(value)) {
      return "—";
    }
    return Math.round(value).toString();
  };

  const computeClockSkew = (nowSample: number): number => {
    const expectedWallClock = overlayStartWallClock + (nowSample - overlayStartNow);
    return Date.now() - expectedWallClock;
  };

  const render = (nowSample: number) => {
    lastRenderNow = nowSample;
    const sample = latestSample ?? {};
    updateField("seedSource", sample.seedSource ?? "—");
    updateField("serverRemaining", formatSeconds(sample.serverRemaining));
    updateField("estimatedRemaining", formatSeconds(sample.estimatedRemaining));
    updateField("baselineEndMs", sample.baselineEndMs !== undefined ? Math.round(sample.baselineEndMs).toString() : "—");
    updateField("nowMs", formatNumber(nowSample));
    updateField("clockSkewMs", formatNumber(computeClockSkew(nowSample)));
    updateField("lastServerUpdate", sample.lastServerUpdate ?? "—");
  };

  const scheduleRender = () => {
    if (pendingTimer !== undefined) {
      return;
    }

    const nowSample = performanceNow();
    if (lastRenderNow === undefined || nowSample - lastRenderNow >= MIN_UPDATE_INTERVAL_MS) {
      render(nowSample);
      return;
    }

    const delay = Math.max(0, MIN_UPDATE_INTERVAL_MS - (nowSample - lastRenderNow));
    pendingTimer = window.setTimeout(() => {
      pendingTimer = undefined;
      render(performanceNow());
    }, delay);
  };

  return {
    update(sample: DebugOverlaySample) {
      latestSample = { ...latestSample, ...sample };
      scheduleRender();
    },
    destroy() {
      if (pendingTimer !== undefined) {
        clearTimeout(pendingTimer);
        pendingTimer = undefined;
      }
      container.remove();
    },
  };
}
