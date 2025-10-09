import type {
  DebugCorrectionPayload,
  DebugSeedPayload,
  DebugStartOutlierPayload,
} from "./types";

function anonymizeEntityId(entityId: string | undefined): string | undefined {
  if (!entityId) {
    return undefined;
  }

  const [domain, objectId] = entityId.split(".", 2);
  if (!objectId) {
    return domain ?? entityId;
  }

  if (objectId.length <= 3) {
    return `${domain}.${objectId[0] ?? "*"}**`;
  }

  const prefix = objectId.slice(0, 2);
  const suffix = objectId.slice(-1);
  return `${domain}.${prefix}…${suffix}`;
}

export class StructuredLogger {
  private readonly console: Pick<Console, "info" | "warn">;

  constructor(targetConsole: Pick<Console, "info" | "warn"> = console) {
    this.console = targetConsole;
  }

  public logSeed(payload: DebugSeedPayload): void {
    const tsIso = new Date().toISOString();
    const anonymizedEntity = anonymizeEntityId(payload.entityId);
    this.console.info(
      "[ha-tea-timer][debug]",
      {
        evt: "seed",
        ts_iso: tsIso,
        seedSource: payload.seedSource,
        serverRemaining: payload.serverRemaining,
        estimatedRemaining: payload.estimatedRemaining,
        baselineEndMs: payload.baselineEndMs,
        lastServerUpdate: payload.lastServerUpdate,
        entityId: anonymizedEntity,
      },
    );
  }

  public logCorrection(payload: DebugCorrectionPayload): void {
    const tsIso = new Date().toISOString();
    const anonymizedEntity = anonymizeEntityId(payload.entityId);
    this.console.info(
      "[ha-tea-timer][debug]",
      {
        evt: "server_correction",
        ts_iso: tsIso,
        delta_ms: Math.round(payload.deltaMs),
        serverRemaining: payload.serverRemaining,
        baselineEndMs: payload.baselineEndMs,
        lastServerUpdate: payload.lastServerUpdate,
        entityId: anonymizedEntity,
      },
    );
  }

  public logStartOutlier(payload: DebugStartOutlierPayload): void {
    const tsIso = new Date().toISOString();
    const anonymizedEntity = anonymizeEntityId(payload.entityId);
    this.console.warn(
      "[ha-tea-timer][debug]",
      {
        evt: "start_outlier",
        ts_iso: tsIso,
        requestedDurationS: payload.requestedDurationS,
        firstComputedS: payload.firstComputedS,
        deltaS: payload.deltaS,
        intentTsIso: payload.intentTsIso,
        nowMs: payload.nowMs,
        entityId: anonymizedEntity,
      },
    );
  }
}
