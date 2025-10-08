export const DEBUG_OFF = 0 as const;
export const DEBUG_OVERLAY_BIT = 1 as const;
export const DEBUG_LOGS_BIT = 2 as const;
export const DEBUG_ALL = 3 as const;
export type DebugMode = typeof DEBUG_OFF | typeof DEBUG_OVERLAY_BIT | typeof DEBUG_LOGS_BIT | typeof DEBUG_ALL;

type DebugModeInput = string | null | undefined;

export function parseDebugMode(value: DebugModeInput): DebugMode {
  if (value === null || value === undefined) {
    return DEBUG_OFF;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized || normalized === "0" || normalized === "off" || normalized === "false") {
    return DEBUG_OFF;
  }

  if (normalized === "1" || normalized === "all" || normalized === "both") {
    return DEBUG_ALL;
  }

  if (normalized === "overlay" || normalized === "ui" || normalized === "panel") {
    return DEBUG_OVERLAY_BIT;
  }

  if (normalized === "logs" || normalized === "log") {
    return DEBUG_LOGS_BIT;
  }

  return DEBUG_OFF;
}

export function modeIncludesOverlay(mode: DebugMode): boolean {
  return (mode & DEBUG_OVERLAY_BIT) === DEBUG_OVERLAY_BIT;
}

export function modeIncludesLogs(mode: DebugMode): boolean {
  return (mode & DEBUG_LOGS_BIT) === DEBUG_LOGS_BIT;
}

export function debugModeToString(mode: DebugMode): "off" | "overlay" | "logs" | "all" {
  const overlay = modeIncludesOverlay(mode);
  const logs = modeIncludesLogs(mode);
  if (overlay && logs) {
    return "all";
  }
  if (overlay) {
    return "overlay";
  }
  if (logs) {
    return "logs";
  }
  return "off";
}
