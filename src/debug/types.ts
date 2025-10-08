export type DebugSeedSource =
  | "server_remaining"
  | "estimated_last_changed"
  | "resume"
  | "reload"
  | "start";

export interface DebugSnapshotBase {
  seedSource?: DebugSeedSource;
  serverRemaining?: number;
  estimatedRemaining?: number;
  baselineEndMs?: number;
  lastServerUpdate?: string;
  entityId?: string;
}

export interface DebugSeedPayload extends DebugSnapshotBase {
  seedSource: DebugSeedSource;
}

export interface DebugCorrectionPayload {
  deltaMs: number;
  serverRemaining?: number;
  baselineEndMs?: number;
  lastServerUpdate?: string;
  entityId?: string;
}

export interface DebugOverlaySample extends DebugSnapshotBase {}
