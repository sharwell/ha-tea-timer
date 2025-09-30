import { ReactiveController, ReactiveControllerHost } from "lit";
import {
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

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

export type TimerUiState =
  | "Idle"
  | "Running"
  | { kind: "FinishedTransient"; untilTs: number }
  | { kind: "Error"; reason: "Disconnected" | "EntityUnavailable" | "ServiceFailure"; detail?: string };

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
  actionGeneration: number;
  entityId?: string;
};

export interface TimerStateControllerOptions {
  finishedOverlayMs?: number;
  onStateChanged?: (state: TimerViewState) => void;
  now?: () => number;
  monotonicNow?: () => number;
}

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

  private previousEntityState?: TimerEntityState;

  private currentState: TimerViewState;

  constructor(host: ReactiveControllerHost, options?: TimerStateControllerOptions) {
    this.host = host;
    this.options = options ?? {};
    const finishedOverlayMs = this.options.finishedOverlayMs ?? 5000;
    this.stateMachine = new TimerStateMachine({
      finishedOverlayMs,
      now: this.options.now,
    });
    this.monotonicNow = this.options.monotonicNow ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));

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

  public setFinishedOverlayMs(value: number | undefined): void {
    if (value === undefined) {
      return;
    }

    this.stateMachine.setFinishedOverlayMs(value);
    this.applyEntityState(this.stateMachine.handleTimeAdvance(this.getCurrentTime()));
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
    this.applyEntityState(this.stateMachine.updateFromEntity(entity, this.getCurrentTime()));
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
    this.applyEntityState(this.stateMachine.updateFromEntity(entity, this.getCurrentTime()));

    if (!this.connected) {
      return;
    }

    try {
      const unsubState = await subscribeTimerStateChanges(this.hass.connection, this.entityId, (updatedEntity) => {
        this.applyEntityState(this.stateMachine.updateFromEntity(updatedEntity, this.getCurrentTime()));
      });

      if (token !== this.subscriptionToken) {
        await unsubState();
        return;
      }

      this.unsubscribers.push(unsubState);
    } catch {
      // Swallow subscription errors; UI will continue to rely on hass updates.
    }

    try {
      const unsubFinished = await subscribeTimerFinished(this.hass.connection, this.entityId, () => {
        const now = this.getCurrentTime();
        if (this.shouldIgnoreFinish(now)) {
          return;
        }
        this.applyEntityState(this.stateMachine.markFinished(now));
      });

      if (token !== this.subscriptionToken) {
        await unsubFinished();
        return;
      }

      this.unsubscribers.push(unsubFinished);
    } catch {
      // Ignore errors from finished subscription for resilience.
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

  private applyEntityState(state: TimerEntityState): void {
    const previous = this.previousEntityState;
    this.previousEntityState = state;
    this.updateActionGeneration(state, previous);
    this.composeState(state);
    this.emitCurrentState();
    this.scheduleOverlayTimer();
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
    } else if (this.serviceErrorDetail) {
      uiState = { kind: "Error", reason: "ServiceFailure", detail: this.serviceErrorDetail };
    } else if (entityState.status === "unavailable") {
      uiState = {
        kind: "Error",
        reason: "EntityUnavailable",
        detail: this.entityId,
      };
    } else if (entityState.status === "finished") {
      const until = entityState.finishedUntilTs ?? now;
      uiState = { kind: "FinishedTransient", untilTs: until };
    } else if (entityState.status === "running") {
      uiState = "Running";
    } else {
      uiState = "Idle";
    }

    let serverRemainingSecAtT0 = this.serverRemainingSecAtT0;
    let clientMonotonicT0 = this.clientMonotonicT0;

    if (connectionStatus !== "connected") {
      clientMonotonicT0 = undefined;
    } else if (entityState.status === "running") {
      if (entityState.remainingSeconds !== undefined) {
        serverRemainingSecAtT0 = Math.max(0, Math.floor(entityState.remainingSeconds));
        clientMonotonicT0 = this.monotonicNow();
      } else if (serverRemainingSecAtT0 === undefined) {
        const fallback = entityState.durationSeconds;
        if (fallback !== undefined) {
          serverRemainingSecAtT0 = Math.max(0, Math.floor(fallback));
          clientMonotonicT0 = this.monotonicNow();
        }
      }
    } else {
      serverRemainingSecAtT0 = undefined;
      clientMonotonicT0 = undefined;
    }

    this.serverRemainingSecAtT0 = serverRemainingSecAtT0;
    this.clientMonotonicT0 = clientMonotonicT0;

    this.currentState = {
      ...entityState,
      connectionStatus,
      uiState,
      inFlightAction: this.inFlightAction,
      serverRemainingSecAtT0,
      clientMonotonicT0,
      actionGeneration: this.actionGeneration,
      entityId: this.entityId,
    };

    return this.currentState;
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
      this.applyEntityState(this.stateMachine.handleTimeAdvance(this.getCurrentTime()));
      return;
    }

    this.overlayTimer = setTimeout(() => {
      this.overlayTimer = undefined;
      this.applyEntityState(this.stateMachine.handleTimeAdvance(this.getCurrentTime()));
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
  }

  private getCurrentTime(): number {
    return this.options.now ? this.options.now() : Date.now();
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
