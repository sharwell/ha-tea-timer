const MODE_ATTRIBUTE = "data-debug-mode";
const LOG_PREFIX = "[ha-tea-timer][debug]";
const MAX_DEBUG_ENTRIES = 20;

export {};

type DebugModeString = "off" | "overlay" | "logs" | "all";

type TeaTimerDebugApi = {
  enable(mode?: string): void;
  disable(): void;
  toggle(mode?: string): void;
  mode(): DebugModeString;
};

declare global {
  interface Window {
    teaTimerDebug?: TeaTimerDebugApi;
  }
}

const ready = () =>
  new Promise<void>((resolve) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
    } else {
      resolve();
    }
  });

function escapeHtml(input: string): string {
  return input.replace(/[&<>"]|'/g, (match) => {
    switch (match) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return match;
    }
  });
}

function formatPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

await ready();

const debugButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(`[${MODE_ATTRIBUTE}]`));
const modeOutput = document.getElementById("debug-mode-status") as HTMLOutputElement | null;
const logList = document.getElementById("debug-log-list");
const clearLogsButton = document.getElementById("clear-debug-logs");
const captureToggle = document.getElementById("toggle-debug-capture");

const originalConsoleInfo = console.info;
const boundOriginalConsoleInfo = originalConsoleInfo.bind(console);

let captureEnabled = false;

const handleConsoleInfo = (...args: readonly unknown[]): void => {
  const forwardedArgs = [...args] as unknown[];
  boundOriginalConsoleInfo(...forwardedArgs);

  if (!captureEnabled || !logList) {
    return;
  }

  const [prefix, payload] = args;
  if (prefix !== LOG_PREFIX) {
    return;
  }

  const entry = document.createElement("li");
  entry.innerHTML = `<code>${escapeHtml(formatPayload(payload))}</code>`;
  logList.append(entry);

  while (logList.childElementCount > MAX_DEBUG_ENTRIES) {
    logList.firstElementChild?.remove();
  }

  logList.hidden = false;
};

function setCaptureEnabled(next: boolean): void {
  if (next === captureEnabled) {
    return;
  }

  captureEnabled = next;

  if (captureEnabled) {
    console.info = handleConsoleInfo as typeof console.info;
  } else {
    console.info = originalConsoleInfo;
    if (logList) {
      logList.innerHTML = "";
      logList.hidden = true;
    }
  }

  if (captureToggle instanceof HTMLInputElement && captureToggle.checked !== next) {
    captureToggle.checked = next;
  }
}

function updateModeStatus(): void {
  if (!modeOutput) {
    return;
  }

  const api = window.teaTimerDebug;
  const mode = api ? api.mode() : "off";
  modeOutput.value = mode;
}

debugButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const api = window.teaTimerDebug;
    if (!api) {
      return;
    }

    const mode = button.getAttribute(MODE_ATTRIBUTE);
    if (mode === "0") {
      api.disable();
    } else if (mode) {
      api.enable(mode);
    }
    updateModeStatus();
  });
});

clearLogsButton?.addEventListener("click", () => {
  if (!logList) {
    return;
  }
  logList.innerHTML = "";
  logList.hidden = true;
});

if (captureToggle instanceof HTMLInputElement) {
  captureToggle.addEventListener("change", () => {
    setCaptureEnabled(captureToggle.checked);
  });
}

setCaptureEnabled(captureToggle instanceof HTMLInputElement ? captureToggle.checked : true);

window.addEventListener("pagehide", () => {
  setCaptureEnabled(false);
});

window.addEventListener("storage", (event) => {
  if (event.key !== "tt_debug") {
    return;
  }
  updateModeStatus();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    updateModeStatus();
  }
});

updateModeStatus();
