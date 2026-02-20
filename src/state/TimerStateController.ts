import { ReactiveController, ReactiveControllerHost } from "lit";
import {
  subscribeEntityStateChanges,
  subscribeTimerFinished,
  subscribeTimerStateChanges,
} from "../ha-integration/timerSubscriptions";
import type {
  HassConnection,
  HassEntity,
  HassUnsubscribe,
  HomeAssistant,
} from "../types/home-assistant";
import { TimerStateMachine, TimerViewState as TimerEntityState } from "./TimerStateMachine";
import { ClockSkewEstimator, boundLocalClockBaseline } from "../time/skew";

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

export type TimerUiState =
  | "Idle"
  | "Running"
  | "Paused"
  | { kind: "FinishedTransient"; untilTs: number }
  | {
      kind: "Error";
      reason:
        | "Disconnected"
        | "EntityConfigMissing"
        | "EntityWrongDomain"
        | "EntityNotFound"
        | "EntityUnavailable"
        | "ServiceFailure";
      detail?: string;
    };

export interface InFlightAction {
  kind: "start" | "restart";
  gen: number;
  ts: number;
}

export type TimerViewState = TimerEntityState & {
  connectionStatus: ConnectionStatus;
  uiState: TimerUiState;
  inFlightAction?: InFlightAction;
  serverRemainingSecAtT0?: number;
  clientMonotonicT0?: number;
  baselineEndMs?: number;
  actionGeneration: number;
  entityId?: string;
};

export interface TimerStateControllerOptions {
  finishedOverlayMs?: number;
  onStateChanged?: (state: TimerViewState) => void;
  now?: () => number;
  monotonicNow?: () => number;
  clockSkewEstimatorEnabled?: boolean;
}

const FINISH_FALLBACK_MAX_REMAINING_SECONDS = 1;

interface ConnectionMonitor {
  connection: HassConnection;
  cleanup(): void;
}

function isWebSocketLike(socket: unknown): socket is {
  addEventListener: (type: string, handler: (event: Event) => void) => void;
  removeEventListener: (type: string, handler: (event: Event) => void) => void;
  readyState?: number;
} {
  if (!socket || typeof socket !== "object") {
    return false;
  }

  const candidate = socket as Partial<WebSocket> & Record<string, unknown>;
  return (
    typeof candidate.addEventListener === "function" &&
    typeof candidate.removeEventListener === "function"
  );
}

export class TimerStateController implements ReactiveController {
  private readonly host: ReactiveControllerHost;

  private readonly options: TimerStateControllerOptions;

  private hass?: HomeAssistant;

  private entityId?: string;

  private readonly stateMachine: TimerStateMachine;

  private readonly monotonicNow: () => number;

  private connectionStatus: ConnectionStatus = "disconnected";

  private connectionMonitor?: ConnectionMonitor;

  private connected = false;

  private overlayTimer?: ReturnType<typeof setTimeout>;

  private unsubscribers: HassUnsubscribe[] = [];

  private subscriptionToken = 0;

  private actionGeneration = 0;

  private inFlightAction?: InFlightAction;

  private serviceErrorDetail?: string;

  private serviceErrorTimer?: ReturnType<typeof setTimeout>;

  private serverRemainingSecAtT0?: number;

  private clientMonotonicT0?: number;

  private baselineEndMs?: number;

  private previousEntityState?: TimerEntityState;

  private currentState: TimerViewState;

  private readonly clockSkew: ClockSkewEstimator;

  private clockSkewEstimatorEnabled: boolean;

  private pauseHelperEntityId?: string;

  private pauseHelperRemainingSeconds?: number;

  private pauseHelperUnsubscribe?: HassUnsubscribe;

  constructor(host: ReactiveControllerHost, options?: TimerStateControllerOptions) {
    this.host = host;
    this.options = options ?? {};
    const finishedOverlayMs = this.options.finishedOverlayMs ?? 5000;
    const monotonicNow = this.options.monotonicNow ?? (() =>
      (typeof performance !== "undefined" ? performance.now() : Date.now()));
    this.stateMachine = new TimerStateMachine({
      finishedOverlayMs,
      now: this.options.now,
    });
    this.monotonicNow = monotonicNow;
    this.clockSkew = new ClockSkewEstimator({ monotonicNow });

    this.clockSkewEstimatorEnabled =
      this.options.clockSkewEstimatorEnabled !== undefined ? this.options.clockSkewEstimatorEnabled : true;

    this.previousEntityState = this.stateMachine.state;
    this.currentState = this.composeState(this.stateMachine.state);

    host.addController(this);
  }

  public get state(): TimerViewState {
    return this.currentState;
  }

  public setEntityId(entityId: string | undefined): void {
    const normalized = entityId?.trim().toLowerCase() || undefined;
    if (this.entityId === normalized) {
      return;
    }

    this.entityId = normalized;
    this.refreshEntityState();
    void this.refreshSubscriptions();
  }

  public setPauseHelperEntityId(entityId: string | undefined): void {
    const normalized = entityId?.trim().toLowerCase() || undefined;
    if (this.pauseHelperEntityId === normalized) {
      return;
    }

    this.pauseHelperEntityId = normalized;
    this.pauseHelperRemainingSeconds = undefined;
    this.refreshPauseHelperFromHass();
    void this.refreshSubscriptions();
  }

  public setFinishedOverlayMs(value: number | undefined): void {
    if (value === undefined) {
      return;
    }

    this.stateMachine.setFinishedOverlayMs(value);
    const now = this.getCurrentTime();
    this.applyEntityState(
      this.stateMachine.handleTimeAdvance(now, { serverNow: this.getServerNow(now) }),
    );
  }

  public setHass(hass: HomeAssistant | undefined): void {
    const previousConnection = this.hass?.connection;
    this.hass = hass;
    this.setupConnectionMonitor(hass?.connection);

    this.refreshEntityState();

    if (this.connected && previousConnection !== this.hass?.connection) {
      void this.refreshSubscriptions();
    }
  }

  public registerLocalAction(kind: "start" | "restart"): InFlightAction | undefined {
    if (this.inFlightAction) {
      return undefined;
    }

    const gen = this.actionGeneration + 1;
    const action: InFlightAction = { kind, gen, ts: this.getCurrentTime() };
    this.inFlightAction = action;
    this.clearServiceError();
    this.composeState(this.previousEntityState ?? this.stateMachine.state);
    this.emitCurrentState();
    return action;
  }

  public reportActionFailure(gen: number, detail?: string): void {
    if (!this.inFlightAction || this.inFlightAction.gen !== gen) {
      return;
    }

    this.inFlightAction = undefined;
    this.serviceErrorDetail = detail;
    this.scheduleServiceErrorClear();
    this.composeState(this.previousEntityState ?? this.stateMachine.state);
    this.emitCurrentState();
  }

  public clearInFlightAction(gen: number): void {
    if (!this.inFlightAction || this.inFlightAction.gen !== gen) {
      return;
    }

    this.inFlightAction = undefined;
    this.composeState(this.previousEntityState ?? this.stateMachine.state);
    this.emitCurrentState();
  }

  public setClockSkewEstimatorEnabled(enabled: boolean): void {
    const next = enabled !== false;
    if (this.clockSkewEstimatorEnabled === next) {
      return;
    }

    this.clockSkewEstimatorEnabled = next;
    this.clockSkew.reset();
    this.refreshEntityState();
  }

  public clearServiceError(): void {
    if (!this.serviceErrorDetail) {
      return;
    }

    this.serviceErrorDetail = undefined;
    if (this.serviceErrorTimer) {
      clearTimeout(this.serviceErrorTimer);
      this.serviceErrorTimer = undefined;
    }
    this.composeState(this.previousEntityState ?? this.stateMachine.state);
    this.emitCurrentState();
  }

  public hostConnected(): void {
    this.connected = true;
    void this.refreshSubscriptions();
  }

  public hostDisconnected(): void {
    this.connected = false;
    this.clearOverlayTimer();
    this.cleanupSubscriptions();
    this.teardownConnectionMonitor();
  }

  private scheduleServiceErrorClear(): void {
    if (!this.serviceErrorDetail) {
      return;
    }

    if (this.serviceErrorTimer) {
      clearTimeout(this.serviceErrorTimer);
    }

    this.serviceErrorTimer = setTimeout(() => {
      this.serviceErrorTimer = undefined;
      this.clearServiceError();
    }, 4000);
  }

  private refreshEntityState(): void {
    if (!this.entityId) {
      this.applyEntityState(this.stateMachine.clear());
      return;
    }

    const entity = this.getEntityFromHass();
    const now = this.getCurrentTime();
    this.ingestServerTimestamps(entity, now);
    this.refreshPauseHelperFromHass();
    this.applyEntityState(this.stateMachine.updateFromEntity(entity, now, { serverNow: this.getServerNow(now) }));
  }

  private async refreshSubscriptions(): Promise<void> {
    const token = ++this.subscriptionToken;
    this.clearOverlayTimer();
    this.cleanupSubscriptions();

    if (!this.entityId || !this.hass) {
      this.applyEntityState(this.stateMachine.clear());
      return;
    }

    const entity = this.getEntityFromHass();
    const now = this.getCurrentTime();
    this.ingestServerTimestamps(entity, now);
    this.applyEntityState(this.stateMachine.updateFromEntity(entity, now, { serverNow: this.getServerNow(now) }));

    if (!this.connected) {
      return;
    }

    try {
      const unsubState = await subscribeTimerStateChanges(
        this.hass.connection,
        this.entityId,
        (updatedEntity, event) => {
          const now = this.getCurrentTime();
          if (this.clockSkewEstimatorEnabled && event?.time_fired) {
            this.clockSkew.estimateFromServerStamp(event.time_fired, now);
          }
          this.ingestServerTimestamps(updatedEntity, now);
          this.refreshPauseHelperFromHass();
          this.applyEntityState(
            this.stateMachine.updateFromEntity(updatedEntity, now, { serverNow: this.getServerNow(now) }),
          );
        },
      );

      if (token !== this.subscriptionToken) {
        await unsubState();
        return;
      }

      this.unsubscribers.push(unsubState);
    } catch {
      // Swallow subscription errors; UI will continue to rely on hass updates.
    }

    try {
      const unsubFinished = await subscribeTimerFinished(this.hass.connection, this.entityId, (event) => {
        const now = this.getCurrentTime();
        if (this.clockSkewEstimatorEnabled && event?.time_fired) {
          this.clockSkew.estimateFromServerStamp(event.time_fired, now);
        }
        if (this.shouldIgnoreFinish(now)) {
          return;
        }
        this.applyEntityState(
          this.stateMachine.markFinished(now, { serverNow: this.getServerNow(now) }),
        );
      });

      if (token !== this.subscriptionToken) {
        await unsubFinished();
        return;
      }

      this.unsubscribers.push(unsubFinished);
    } catch {
      // Ignore errors from finished subscription for resilience.
    }

    if (this.pauseHelperEntityId) {
      try {
        const unsubPauseHelper = await subscribeEntityStateChanges(
          this.hass.connection,
          this.pauseHelperEntityId,
          (entity) => {
            this.handlePauseHelperUpdate(entity);
          },
        );

        if (token !== this.subscriptionToken) {
          await unsubPauseHelper();
          return;
        }

        this.pauseHelperUnsubscribe = unsubPauseHelper;
      } catch {
        this.pauseHelperUnsubscribe = undefined;
      }
    }
  }

  private shouldIgnoreFinish(eventTime: number): boolean {
    if (!this.inFlightAction) {
      return false;
    }

    return eventTime < this.inFlightAction.ts;
  }

  private getEntityFromHass(): HassEntity | undefined {
    if (!this.hass || !this.entityId) {
      return undefined;
    }

    return this.hass.states?.[this.entityId];
  }

  private handlePauseHelperUpdate(entity: HassEntity | undefined): void {
    const value = this.parsePauseHelperValue(entity);
    this.setPauseHelperRemainingSeconds(value);
  }

  private refreshPauseHelperFromHass(): void {
    if (!this.pauseHelperEntityId || !this.hass) {
      this.pauseHelperRemainingSeconds = undefined;
      return;
    }

    const helper = this.hass.states?.[this.pauseHelperEntityId];
    const value = this.parsePauseHelperValue(helper);
    this.pauseHelperRemainingSeconds = value !== undefined && Number.isFinite(value)
      ? Math.max(0, Math.round(value))
      : undefined;
  }

  private parsePauseHelperValue(entity: HassEntity | undefined): number | undefined {
    if (!entity) {
      return undefined;
    }

    const raw = entity.state;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw >= 0 ? Math.round(raw) : undefined;
    }

    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) {
        return undefined;
      }

      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return undefined;
      }

      return Math.round(parsed);
    }

    return undefined;
  }

  private setPauseHelperRemainingSeconds(value: number | undefined): void {
    const normalized = value !== undefined && Number.isFinite(value) ? Math.max(0, Math.round(value)) : undefined;
    if (this.pauseHelperRemainingSeconds === normalized) {
      return;
    }

    this.pauseHelperRemainingSeconds = normalized;
    this.applyEntityState(this.stateMachine.state);
  }

  private applyPauseHelper(state: TimerEntityState): TimerEntityState {
    if (!this.pauseHelperEntityId) {
      return state;
    }

    const remaining = this.pauseHelperRemainingSeconds;
    if (remaining === undefined || remaining <= 0) {
      return state;
    }

    if (state.status === "running" || state.status === "finished" || state.status === "unavailable") {
      return state;
    }

    return {
      ...state,
      status: "paused",
      remainingSeconds: remaining,
      durationSeconds: state.durationSeconds ?? remaining,
      remainingIsEstimated: false,
      estimationDriftSeconds: undefined,
    };
  }

  private applyEntityState(state: TimerEntityState): void {
    const transformed = this.applyPauseHelper(state);
    const previous = this.previousEntityState;
    let nextState = transformed;
    if (this.shouldApplyFinishFallback(previous, transformed)) {
      const now = this.getCurrentTime();
      nextState = this.stateMachine.markFinished(now, { serverNow: this.getServerNow(now) });
    }

    this.previousEntityState = nextState;
    this.updateActionGeneration(nextState, previous);
    this.composeState(nextState);
    this.emitCurrentState();
    this.scheduleOverlayTimer();
  }

  private shouldApplyFinishFallback(
    previous: TimerEntityState | undefined,
    next: TimerEntityState,
  ): boolean {
    if (previous?.status !== "running" || next.status !== "idle") {
      return false;
    }

    if (this.connectionStatus !== "connected") {
      return false;
    }

    if (this.inFlightAction) {
      return false;
    }

    if (this.stateMachine.getOverlayDeadline() !== undefined) {
      return false;
    }

    let projectedRemaining: number | undefined;
    if (this.serverRemainingSecAtT0 !== undefined && this.clientMonotonicT0 !== undefined) {
      const elapsedSeconds = Math.max(0, this.monotonicNow() - this.clientMonotonicT0) / 1000;
      projectedRemaining = Math.max(0, this.serverRemainingSecAtT0 - elapsedSeconds);
    }

    if (projectedRemaining === undefined && previous.remainingSeconds !== undefined) {
      projectedRemaining = Math.max(0, previous.remainingSeconds);
    }

    if (projectedRemaining === undefined) {
      return false;
    }

    return projectedRemaining <= FINISH_FALLBACK_MAX_REMAINING_SECONDS;
  }

  private updateActionGeneration(state: TimerEntityState, previous: TimerEntityState | undefined): void {
    const wasRunning = previous?.status === "running";
    const isRunning = state.status === "running";

    if (isRunning && (!wasRunning || previous?.lastChangedTs !== state.lastChangedTs)) {
      this.actionGeneration = Math.max(this.actionGeneration + 1, this.inFlightAction?.gen ?? this.actionGeneration + 1);
      this.inFlightAction = undefined;
    }

    if (!isRunning && this.inFlightAction && state.status !== "finished") {
      // Action did not transition to running; treat as cleared so UI can recover.
      this.inFlightAction = undefined;
    }
  }

  private composeState(entityState: TimerEntityState): TimerViewState {
    const connectionStatus = this.computeConnectionStatus();
    const now = this.getCurrentTime();

    let uiState: TimerUiState;
    if (connectionStatus !== "connected") {
      uiState = { kind: "Error", reason: "Disconnected" };
    } else {
      const entityError = this.computeEntityError(entityState);
      if (entityError) {
        uiState = entityError;
      } else if (this.serviceErrorDetail) {
        uiState = { kind: "Error", reason: "ServiceFailure", detail: this.serviceErrorDetail };
      } else if (entityState.status === "finished") {
      const until = entityState.finishedUntilTs ?? now;
      uiState = { kind: "FinishedTransient", untilTs: until };
    } else if (entityState.status === "running") {
      uiState = "Running";
    } else if (entityState.status === "paused") {
      uiState = "Paused";
    } else {
      uiState = "Idle";
    }
    }

    let serverRemainingSecAtT0 = this.serverRemainingSecAtT0;
    let clientMonotonicT0 = this.clientMonotonicT0;
    let baselineEndMs = this.baselineEndMs;

    if (connectionStatus !== "connected") {
      clientMonotonicT0 = undefined;
      baselineEndMs = undefined;
    } else if (entityState.status === "running") {
      const seed = this.seedRunningBaseline(entityState, now);
      if (seed) {
        serverRemainingSecAtT0 = seed.remainingSeconds;
        clientMonotonicT0 = seed.monotonicT0;
        baselineEndMs = seed.baselineEndMs;
      }
    } else if (entityState.status === "paused") {
      if (entityState.remainingSeconds !== undefined) {
        serverRemainingSecAtT0 = Math.max(0, Math.floor(entityState.remainingSeconds));
      } else {
        serverRemainingSecAtT0 = undefined;
      }
      clientMonotonicT0 = undefined;
      baselineEndMs = undefined;
    } else {
      serverRemainingSecAtT0 = undefined;
      clientMonotonicT0 = undefined;
      baselineEndMs = undefined;
    }

    this.serverRemainingSecAtT0 = serverRemainingSecAtT0;
    this.clientMonotonicT0 = clientMonotonicT0;
    this.baselineEndMs = baselineEndMs;

    this.currentState = {
      ...entityState,
      connectionStatus,
      uiState,
      inFlightAction: this.inFlightAction,
      serverRemainingSecAtT0,
      clientMonotonicT0,
      baselineEndMs,
      actionGeneration: this.actionGeneration,
      entityId: this.entityId,
    };

    return this.currentState;
  }

  private seedRunningBaseline(
    entityState: TimerEntityState,
    wallNow: number,
  ):
    | {
        remainingSeconds: number;
        monotonicT0: number;
        baselineEndMs: number;
      }
    | undefined {
    let remainingSeconds = entityState.remainingSeconds;
    let derivedFromLastChanged = false;

    if (remainingSeconds === undefined) {
      const durationSeconds = entityState.durationSeconds;
      const lastChanged = entityState.lastChangedTs;
      if (durationSeconds !== undefined && lastChanged !== undefined) {
        const elapsedMs = this.clockSkewEstimatorEnabled
          ? this.clockSkew.elapsedSince(lastChanged, wallNow)
          : Math.max(0, wallNow - lastChanged);
        const elapsedSeconds = elapsedMs / 1000;
        const computed = durationSeconds - elapsedSeconds;
        const clamped = Math.min(durationSeconds, Math.max(0, computed));
        remainingSeconds = clamped;
        derivedFromLastChanged = true;
      }
    }

    if (remainingSeconds === undefined) {
      return undefined;
    }

    const durationLimit = entityState.durationSeconds;
    if (durationLimit !== undefined) {
      const maxRemaining = Math.max(0, durationLimit);
      remainingSeconds = Math.min(maxRemaining, Math.max(0, remainingSeconds));
    } else {
      remainingSeconds = Math.max(0, remainingSeconds);
    }

    if (
      derivedFromLastChanged &&
      !this.clockSkewEstimatorEnabled &&
      remainingSeconds > 0 &&
      this.serverRemainingSecAtT0 !== undefined
    ) {
      remainingSeconds = boundLocalClockBaseline(
        remainingSeconds,
        this.serverRemainingSecAtT0,
      );
    }

    const monotonicT0 = this.monotonicNow();
    return {
      remainingSeconds,
      monotonicT0,
      baselineEndMs: monotonicT0 + remainingSeconds * 1000,
    };
  }

  private computeEntityError(
    entityState: TimerEntityState,
  ): Extract<TimerUiState, { kind: "Error" }> | undefined {
    if (!this.entityId) {
      return { kind: "Error", reason: "EntityConfigMissing" };
    }

    const entityId = this.entityId;
    const [domain] = entityId.split(".");
    if (domain !== "timer") {
      return { kind: "Error", reason: "EntityWrongDomain", detail: entityId };
    }

    const entity = this.hass?.states?.[entityId];
    if (!entity) {
      return { kind: "Error", reason: "EntityNotFound", detail: entityId };
    }

    if (entityState.status === "unavailable") {
      return { kind: "Error", reason: "EntityUnavailable", detail: entityId };
    }

    return undefined;
  }

  private computeConnectionStatus(): ConnectionStatus {
    if (!this.hass?.connection) {
      this.connectionStatus = "disconnected";
      return this.connectionStatus;
    }

    return this.connectionStatus;
  }

  private emitCurrentState(): void {
    this.options.onStateChanged?.(this.currentState);
    this.host.requestUpdate();
  }

  private scheduleOverlayTimer(): void {
    this.clearOverlayTimer();
    const deadline = this.stateMachine.getOverlayDeadline();
    if (deadline === undefined) {
      return;
    }

    const delay = deadline - this.getCurrentTime();

    if (delay <= 0) {
      const now = this.getCurrentTime();
      this.applyEntityState(
        this.stateMachine.handleTimeAdvance(now, { serverNow: this.getServerNow(now) }),
      );
      return;
    }

    this.overlayTimer = setTimeout(() => {
      this.overlayTimer = undefined;
      const now = this.getCurrentTime();
      this.applyEntityState(
        this.stateMachine.handleTimeAdvance(now, { serverNow: this.getServerNow(now) }),
      );
    }, delay);
  }

  private clearOverlayTimer(): void {
    if (this.overlayTimer !== undefined) {
      clearTimeout(this.overlayTimer);
      this.overlayTimer = undefined;
    }
  }

  private cleanupSubscriptions(): void {
    if (!this.unsubscribers.length) {
      return;
    }

    const subscriptions = [...this.unsubscribers];
    this.unsubscribers.length = 0;

    subscriptions.forEach((unsubscribe) => {
      try {
        const result = unsubscribe();
        if (result instanceof Promise) {
          void result.catch(() => undefined);
        }
      } catch {
        // ignore cleanup errors
      }
    });

    if (this.pauseHelperUnsubscribe) {
      try {
        const result = this.pauseHelperUnsubscribe();
        if (result instanceof Promise) {
          void result.catch(() => undefined);
        }
      } catch {
        // ignore cleanup errors
      }
      this.pauseHelperUnsubscribe = undefined;
    }
  }

  private getCurrentTime(): number {
    return this.options.now ? this.options.now() : Date.now();
  }

  private getServerNow(now: number): number | undefined {
    if (!this.clockSkewEstimatorEnabled) {
      return undefined;
    }

    return this.clockSkew.serverNowMs(now);
  }

  private ingestServerTimestamps(entity: HassEntity | undefined, localNow: number): void {
    if (!this.clockSkewEstimatorEnabled || !entity) {
      return;
    }

    if (entity.last_changed) {
      this.clockSkew.estimateFromServerStamp(entity.last_changed, localNow);
    }

    if (entity.last_updated && entity.last_updated !== entity.last_changed) {
      this.clockSkew.estimateFromServerStamp(entity.last_updated, localNow);
    }
  }

  private setupConnectionMonitor(connection: HassConnection | undefined): void {
    if (this.connectionMonitor?.connection === connection) {
      return;
    }

    this.teardownConnectionMonitor();

    if (!connection) {
      this.connectionStatus = "disconnected";
      this.composeState(this.previousEntityState ?? this.stateMachine.state);
      this.emitCurrentState();
      return;
    }

    const socket = (connection as unknown as { socket?: unknown }).socket;
    if (!isWebSocketLike(socket)) {
      this.connectionStatus = "connected";
      this.connectionMonitor = {
        connection,
        cleanup: () => {},
      };
      this.composeState(this.previousEntityState ?? this.stateMachine.state);
      this.emitCurrentState();
      return;
    }

    const handleOpen = () => {
      this.connectionStatus = "connected";
      this.composeState(this.previousEntityState ?? this.stateMachine.state);
      this.emitCurrentState();
      void this.refreshSubscriptions();
    };
    const handleClose = () => {
      this.connectionStatus = "reconnecting";
      this.composeState(this.previousEntityState ?? this.stateMachine.state);
      this.emitCurrentState();
    };
    const handleError = () => {
      this.connectionStatus = "reconnecting";
      this.composeState(this.previousEntityState ?? this.stateMachine.state);
      this.emitCurrentState();
    };

    socket.addEventListener("open", handleOpen);
    socket.addEventListener("close", handleClose);
    socket.addEventListener("error", handleError);

    this.connectionMonitor = {
      connection,
      cleanup: () => {
        socket.removeEventListener("open", handleOpen);
        socket.removeEventListener("close", handleClose);
        socket.removeEventListener("error", handleError);
      },
    };

    const openState = typeof WebSocket !== "undefined" ? WebSocket.OPEN : 1;
    const readyState = typeof socket.readyState === "number" ? socket.readyState : openState;
    if (readyState === openState) {
      this.connectionStatus = "connected";
    } else {
      this.connectionStatus = "reconnecting";
    }
    this.composeState(this.previousEntityState ?? this.stateMachine.state);
    this.emitCurrentState();
  }

  private teardownConnectionMonitor(): void {
    if (!this.connectionMonitor) {
      return;
    }

    try {
      this.connectionMonitor.cleanup();
    } catch {
      // ignore cleanup errors
    }

    this.connectionMonitor = undefined;
    this.connectionStatus = "disconnected";
    this.composeState(this.previousEntityState ?? this.stateMachine.state);
    this.emitCurrentState();
  }
}

export type TimerStatus = TimerEntityState["status"];
