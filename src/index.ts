import { TeaTimerCard } from "./card/TeaTimerCard";

declare global {
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description: string;
      documentationURL?: string;
    }>;
  }
}

if (!customElements.get("tea-timer-card")) {
  customElements.define("tea-timer-card", TeaTimerCard);
}

window.customCards = window.customCards ?? [];
if (!window.customCards.some((card) => card.type === "tea-timer-card")) {
  window.customCards.push({
    type: "tea-timer-card",
    name: "Tea Timer",
    description: "Circular timer dial tailored for tea brewing presets.",
    documentationURL: "https://github.com/sharwell/ha-tea-timer/blob/main/docs/visual-editor.md",
  });
}

export { TeaTimerCard };
export type { TeaTimerCardConfig } from "./model/config";
