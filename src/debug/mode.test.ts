import { describe, expect, it } from "vitest";
import {
  DEBUG_ALL,
  DEBUG_LOGS_BIT,
  DEBUG_OVERLAY_BIT,
  debugModeToString,
  modeIncludesLogs,
  modeIncludesOverlay,
  parseDebugMode,
} from "./mode";

describe("parseDebugMode", () => {
  it("parses overlay + logs", () => {
    const mode = parseDebugMode("1");
    expect(mode & DEBUG_OVERLAY_BIT).toBe(DEBUG_OVERLAY_BIT);
    expect(mode & DEBUG_LOGS_BIT).toBe(DEBUG_LOGS_BIT);
  });

  it("parses overlay only", () => {
    const mode = parseDebugMode("overlay");
    expect(modeIncludesOverlay(mode)).toBe(true);
    expect(modeIncludesLogs(mode)).toBe(false);
  });

  it("parses logs only", () => {
    const mode = parseDebugMode("logs");
    expect(modeIncludesOverlay(mode)).toBe(false);
    expect(modeIncludesLogs(mode)).toBe(true);
  });

  it("parses disabled values", () => {
    expect(parseDebugMode("0")).toBe(0);
    expect(parseDebugMode(undefined)).toBe(0);
    expect(parseDebugMode(null)).toBe(0);
  });
});

describe("debugModeToString", () => {
  it("returns all for overlay+logs", () => {
    expect(debugModeToString(DEBUG_ALL)).toBe("all");
  });

  it("returns overlay", () => {
    expect(debugModeToString(DEBUG_OVERLAY_BIT)).toBe("overlay");
  });

  it("returns logs", () => {
    expect(debugModeToString(DEBUG_LOGS_BIT)).toBe("logs");
  });

  it("returns off", () => {
    expect(debugModeToString(0)).toBe("off");
  });
});
