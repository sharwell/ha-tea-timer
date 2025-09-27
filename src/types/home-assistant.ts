export interface LovelaceCard {
  setConfig(config: unknown): void;
  getCardSize(): number | Promise<number>;
}

export interface LovelaceCardEditor {
  setConfig(config: unknown): void;
  connectedCallback?(): void;
  disconnectedCallback?(): void;
}

export interface HassEntityAttributes {
  friendly_name?: string;
  duration?: string | number;
  remaining?: string | number;
  [key: string]: unknown;
}

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: HassEntityAttributes;
  last_changed: string;
  last_updated: string;
}

export interface HassStateChangedEvent {
  entity_id: string;
  new_state: HassEntity | null;
  old_state: HassEntity | null;
}

export interface HassTimerFinishedEvent {
  entity_id: string;
  name?: string;
}

export interface HassEventMessage<T> {
  event_type: string;
  data: T;
}

export type HassUnsubscribe = () => void | Promise<void>;

export interface HassConnection {
  subscribeMessage<T>(callback: (message: T) => void, message: Record<string, unknown>): Promise<HassUnsubscribe>;
}

export interface HomeAssistant {
  locale: {
    language: string;
  };
  states: Record<string, HassEntity | undefined>;
  connection?: HassConnection;
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown>;
}

export type LovelaceCardConstructor = new () => LovelaceCard & HTMLElement;
