export interface LovelaceCard {
  setConfig(config: unknown): void;
  getCardSize(): number | Promise<number>;
}

export interface LovelaceCardEditor {
  setConfig(config: unknown): void;
  connectedCallback?(): void;
  disconnectedCallback?(): void;
}

export interface HomeAssistant {
  locale: {
    language: string;
  };
}

export type LovelaceCardConstructor = new () => LovelaceCard & HTMLElement;
