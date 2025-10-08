import { RuntimeDebugManager } from "./manager";
import type { DebugCorrectionPayload, DebugOverlaySample, DebugSeedPayload } from "./types";

const manager = new RuntimeDebugManager();

export type { DebugSeedSource } from "./types";

export function reportDebugSeed(payload: DebugSeedPayload): void {
  manager.reportSeed(payload);
}

export function reportDebugTick(payload: DebugOverlaySample): void {
  manager.reportTick(payload);
}

export function reportServerCorrection(payload: DebugCorrectionPayload): void {
  manager.reportServerCorrection(payload);
}

export function enableTeaTimerDebug(mode?: string): void {
  manager.enable(mode);
}

export function disableTeaTimerDebug(): void {
  manager.disable();
}

export function toggleTeaTimerDebug(mode?: string): void {
  manager.toggle(mode);
}

export function getTeaTimerDebugMode(): "off" | "overlay" | "logs" | "all" {
  return manager.getModeString();
}
