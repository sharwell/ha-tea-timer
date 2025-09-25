import { ReactiveController, ReactiveControllerHost } from "lit";
import {
  subscribeTimerFinished,
  subscribeTimerStateChanges,
} from "../ha-integration/timerSubscriptions";
import type { HomeAssistant, HassEntity, HassUnsubscribe } from "../types/home-assistant";
import { TimerStateMachine, TimerViewState } from "./TimerStateMachine";

export interface TimerStateControllerOptions {
  finishedOverlayMs?: number;
  onStateChanged?: (state: TimerViewState) => void;
  now?: () => number;
}

export class TimerStateController implements ReactiveController {
  private readonly host: ReactiveControllerHost;

  private readonly options: TimerStateControllerOptions;

  private hass?: HomeAssistant;

  private entityId?: string;

  private readonly stateMachine: TimerStateMachine;

  private connected = false;

  private overlayTimer?: ReturnType<typeof setTimeout>;

  private unsubscribers: HassUnsubscribe[] = [];

  private subscriptionToken = 0;

  constructor(host: ReactiveControllerHost, options?: TimerStateControllerOptions) {
    this.host = host;
    this.options = options ?? {};
    const finishedOverlayMs = this.options.finishedOverlayMs ?? 5000;
    this.stateMachine = new TimerStateMachine({
      finishedOverlayMs,
      now: this.options.now,
    });

    host.addController(this);
  }

  public get state(): TimerViewState {
    return this.stateMachine.state;
  }

  public setEntityId(entityId: string | undefined): void {
    const normalized = entityId?.trim().toLowerCase() || undefined;
    if (this.entityId === normalized) {
      return;
    }

    this.entityId = normalized;
    void this.refreshSubscriptions();
  }

  public setHass(hass: HomeAssistant | undefined): void {
    const previousConnection = this.hass?.connection;
    this.hass = hass;

    if (!this.entityId) {
      this.emit(this.stateMachine.clear());
      return;
    }

    const entity = this.getEntityFromHass();
    this.emit(this.stateMachine.updateFromEntity(entity, this.getCurrentTime()));

    if (this.connected && previousConnection !== this.hass?.connection) {
      void this.refreshSubscriptions();
    }
  }

  public hostConnected(): void {
    this.connected = true;
    void this.refreshSubscriptions();
  }

  public hostDisconnected(): void {
    this.connected = false;
    this.clearOverlayTimer();
    this.cleanupSubscriptions();
  }

  private async refreshSubscriptions(): Promise<void> {
    const token = ++this.subscriptionToken;
    this.clearOverlayTimer();
    this.cleanupSubscriptions();

    if (!this.entityId || !this.hass) {
      this.emit(this.stateMachine.clear());
      return;
    }

    const entity = this.getEntityFromHass();
    this.emit(this.stateMachine.updateFromEntity(entity, this.getCurrentTime()));

    if (!this.connected) {
      return;
    }

    try {
      const unsubState = await subscribeTimerStateChanges(this.hass.connection, this.entityId, (updatedEntity) => {
        this.emit(this.stateMachine.updateFromEntity(updatedEntity, this.getCurrentTime()));
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
        this.emit(this.stateMachine.markFinished(this.getCurrentTime()));
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

  private getEntityFromHass(): HassEntity | undefined {
    if (!this.hass || !this.entityId) {
      return undefined;
    }

    return this.hass.states?.[this.entityId];
  }

  private emit(state: TimerViewState): void {
    this.options.onStateChanged?.(state);
    this.host.requestUpdate();
    this.scheduleOverlayTimer();
  }

  private scheduleOverlayTimer(): void {
    this.clearOverlayTimer();
    const deadline = this.stateMachine.getOverlayDeadline();
    if (deadline === undefined) {
      return;
    }

    const delay = deadline - this.getCurrentTime();

    if (delay <= 0) {
      this.emit(this.stateMachine.handleTimeAdvance(this.getCurrentTime()));
      return;
    }

    this.overlayTimer = setTimeout(() => {
      this.overlayTimer = undefined;
      this.emit(this.stateMachine.handleTimeAdvance(this.getCurrentTime()));
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
}
