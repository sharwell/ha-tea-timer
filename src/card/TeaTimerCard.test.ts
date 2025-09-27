import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeaTimerCard } from "./TeaTimerCard";
import type { TimerViewState } from "../state/TimerStateMachine";
import { formatDurationSeconds } from "../model/duration";
import type { HomeAssistant } from "../types/home-assistant";
import { restartTimer, startTimer } from "../ha/services/timer";

vi.mock("../ha/services/timer", () => ({
  startTimer: vi.fn(),
  restartTimer: vi.fn(),
}));

type MockedFn = ReturnType<typeof vi.fn>;

const startTimerMock = startTimer as unknown as MockedFn;

describe("TeaTimerCard", () => {
  const tagName = "tea-timer-card";

  if (!customElements.get(tagName)) {
    customElements.define(tagName, TeaTimerCard);
  }

  function createCard(): TeaTimerCard {
    const element = document.createElement(tagName);
    if (!(element instanceof TeaTimerCard)) {
      throw new Error("failed to create tea timer card element");
    }
    return element;
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

  function invokePrimaryAction(card: TeaTimerCard) {
    const handler = card as unknown as { _handlePrimaryAction(): void };
    handler._handlePrimaryAction();
  }

  function createHass(): HomeAssistant {
    return {
      locale: { language: "en" },
      states: {},
      callService: vi.fn().mockResolvedValue(undefined),
    } as unknown as HomeAssistant;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.querySelectorAll(tagName).forEach((el) => el.remove());
  });

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

  it("updates the dial value text immediately when idle input occurs", () => {
    const card = createCard();
    card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });

    const idleState: TimerViewState = {
      status: "idle",
      durationSeconds: 180,
      remainingSeconds: 180,
    };

    setTimerState(card, idleState);

    const internals = card as unknown as {
      _dialElement?: {
        valueText: string;
        shadowRoot: null;
      };
    };

    const dialElement = {
      valueText: "",
      shadowRoot: null,
    };

    internals._dialElement = dialElement;

    triggerDialInput(card, 210);

    expect(dialElement.valueText).toBe(formatDurationSeconds(210));
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

  it("starts the timer when tapping the card from idle", async () => {
    const card = createCard();
    card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });
    card.hass = createHass();

    const idleState: TimerViewState = {
      status: "idle",
      durationSeconds: 180,
      remainingSeconds: 180,
    };

    setTimerState(card, idleState);

    invokePrimaryAction(card);

    await Promise.resolve();
    await Promise.resolve();

    expect(startTimer).toHaveBeenCalledWith(card.hass, "timer.kettle", 180);
    const internals = card as unknown as { _viewModel?: { ui: { pendingAction: string } } };
    expect(internals._viewModel?.ui.pendingAction).toBe("start");
  });

  it("restarts the timer when tapping while running", async () => {
    const card = createCard();
    card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });
    card.hass = createHass();

    const runningState: TimerViewState = {
      status: "running",
      durationSeconds: 240,
      remainingSeconds: 120,
    };

    setTimerState(card, runningState);

    invokePrimaryAction(card);

    await Promise.resolve();

    expect(restartTimer).toHaveBeenCalledWith(card.hass, "timer.kettle", 240);
    const internals = card as unknown as { _viewModel?: { ui: { pendingAction: string } } };
    expect(internals._viewModel?.ui.pendingAction).toBe("restart");
  });

  it("requires confirmation before restarting when confirmRestart is true", async () => {
    const card = createCard();
    card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle", confirmRestart: true });
    card.hass = createHass();

    const runningState: TimerViewState = {
      status: "running",
      durationSeconds: 120,
      remainingSeconds: 60,
    };

    setTimerState(card, runningState);

    invokePrimaryAction(card);

    const internals = card as unknown as {
      _confirmRestartVisible: boolean;
      _onConfirmRestart(): void;
    };

    expect(restartTimer).not.toHaveBeenCalled();
    expect(internals._confirmRestartVisible).toBe(true);

    internals._onConfirmRestart();

    await Promise.resolve();

    expect(restartTimer).toHaveBeenCalledWith(card.hass, "timer.kettle", 120);
  });

  it("ignores repeated taps while an action is pending", async () => {
    const card = createCard();
    card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });
    card.hass = createHass();

    const idleState: TimerViewState = {
      status: "idle",
      durationSeconds: 200,
      remainingSeconds: 200,
    };

    setTimerState(card, idleState);

    let resolveStart: () => void = () => {};
    const startPromise = new Promise<void>((resolve) => {
      resolveStart = resolve;
    });
    startTimerMock.mockReturnValueOnce(startPromise);

    invokePrimaryAction(card);
    invokePrimaryAction(card);

    expect(startTimer).toHaveBeenCalledTimes(1);
    resolveStart();
    await startPromise;
  });

  it("shows an error toast when the service call fails", async () => {
    const card = createCard();
    card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });
    card.hass = createHass();

    const idleState: TimerViewState = {
      status: "idle",
      durationSeconds: 90,
      remainingSeconds: 90,
    };

    setTimerState(card, idleState);

    startTimerMock.mockRejectedValueOnce(new Error("boom"));

    invokePrimaryAction(card);

    const startCall = startTimerMock.mock.results[0]?.value as Promise<unknown> | undefined;
    if (startCall) {
      await startCall.catch(() => undefined);
    }

    await Promise.resolve();

    const internals = card as unknown as {
      _viewModel?: { ui: { pendingAction: string; error?: { message: string } } };
    };
    expect(internals._viewModel?.ui.pendingAction).toBe("none");
    expect(internals._viewModel?.ui.error?.message).toContain("Couldn't start the timer");
  });

  it("announces entity unavailable when tapped", async () => {
    const card = createCard();
    card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });
    card.hass = createHass();

    const unavailable: TimerViewState = {
      status: "unavailable",
    };

    setTimerState(card, unavailable);

    invokePrimaryAction(card);

    await Promise.resolve();

    expect(startTimer).not.toHaveBeenCalled();
    expect(restartTimer).not.toHaveBeenCalled();
    const internals = card as unknown as {
      _viewModel?: { ui: { error?: { message: string } } };
    };
    expect(internals._viewModel?.ui.error?.message).toContain("unavailable");
  });

  it("clamps the duration before calling Home Assistant", async () => {
    const card = createCard();
    card.setConfig({
      type: "custom:tea-timer-card",
      entity: "timer.kettle",
      minDurationSeconds: 60,
      maxDurationSeconds: 600,
      stepSeconds: 15,
    });
    card.hass = createHass();

    const idleState: TimerViewState = {
      status: "idle",
      durationSeconds: 120,
      remainingSeconds: 120,
    };

    setTimerState(card, idleState);

    triggerDialInput(card, 183);

    invokePrimaryAction(card);

    await Promise.resolve();

    expect(startTimer).toHaveBeenCalledWith(card.hass, "timer.kettle", 180);
  });

  it("clears the pending action when Home Assistant reports running", async () => {
    const card = createCard();
    card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });
    card.hass = createHass();

    const idleState: TimerViewState = {
      status: "idle",
      durationSeconds: 150,
      remainingSeconds: 150,
    };

    setTimerState(card, idleState);

    invokePrimaryAction(card);

    await Promise.resolve();

    const internalsBefore = card as unknown as { _viewModel?: { ui: { pendingAction: string } } };
    expect(internalsBefore._viewModel?.ui.pendingAction).toBe("start");

    const runningState: TimerViewState = {
      status: "running",
      durationSeconds: 150,
      remainingSeconds: 150,
    };

    setTimerState(card, runningState);

    const internalsAfter = card as unknown as { _viewModel?: { ui: { pendingAction: string } } };
    expect(internalsAfter._viewModel?.ui.pendingAction).toBe("none");
  });
});
