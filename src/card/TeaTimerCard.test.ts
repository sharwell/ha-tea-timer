import { describe, expect, it } from "vitest";
import { TeaTimerCard } from "./TeaTimerCard";
import type { TimerViewState } from "../state/TimerStateMachine";

describe("TeaTimerCard", () => {
  const tagName = "tea-timer-card";

  if (!customElements.get(tagName)) {
    customElements.define(tagName, TeaTimerCard);
  }

  function createCard(): TeaTimerCard {
    return document.createElement(tagName) as TeaTimerCard;
  }

  function setTimerState(card: TeaTimerCard, state: TimerViewState) {
    const internals = TeaTimerCard.prototype as unknown as {
      _handleTimerStateChanged(this: TeaTimerCard, next: TimerViewState): void;
    };
    internals._handleTimerStateChanged.call(card, state);
  }

  function triggerDialInput(card: TeaTimerCard, value: number) {
    const handler = card as unknown as {
      _onDialInput(event: CustomEvent<{ value: number }>): void;
    };
    handler._onDialInput(new CustomEvent("dial-input", { detail: { value } }));
  }

  it("tracks the displayed duration immediately after dial input", () => {
    const card = createCard();
    card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });

    const idleState: TimerViewState = {
      status: "idle",
      durationSeconds: 120,
      remainingSeconds: 120,
    };

    setTimerState(card, idleState);

    const before = (card as unknown as { _displayDurationSeconds?: number })._displayDurationSeconds;
    expect(before).toBe(120);

    triggerDialInput(card, 150);

    const after = (card as unknown as { _displayDurationSeconds?: number })._displayDurationSeconds;
    expect(after).toBe(150);
  });

  it("synchronizes the displayed duration with running timer updates", () => {
    const card = createCard();
    card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });

    const runningState: TimerViewState = {
      status: "running",
      durationSeconds: 300,
      remainingSeconds: 180,
    };

    setTimerState(card, runningState);

    const display = (card as unknown as { _displayDurationSeconds?: number })._displayDurationSeconds;
    expect(display).toBe(180);
  });
});
