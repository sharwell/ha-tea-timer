import { TeaTimerCard } from "./card/TeaTimerCard";

declare global {
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description: string;
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
    name: "Tea Timer Card",
    description: "Preview of the Tea Timer Card placeholder UI.",
  });
}

export { TeaTimerCard };
export type { TeaTimerCardConfig } from "./model/config";
