import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { render, nothing } from "lit";
import type { TemplateResult } from "lit";
import { TeaTimerCard } from "./TeaTimerCard";
import type { TimerViewState as MachineTimerViewState } from "../state/TimerStateMachine";
import {
  TimerStateController,
  type TimerViewState as ControllerTimerViewState,
  type TimerUiState,
} from "../state/TimerStateController";
type TimerViewState = MachineTimerViewState;
import { formatDurationSeconds, formatDurationSpeech } from "../model/duration";
import type { DurationBounds } from "../model/duration";
import { STRINGS } from "../strings";
import type { HomeAssistant } from "../types/home-assistant";
import {
  cancelTimer,
  changeTimer,
  pauseTimer,
  restartTimer,
  resumeTimer,
  startTimer,
  supportsTimerChange,
  supportsTimerPause,
} from "../ha/services/timer";
import type { TeaTimerDial } from "../dial/TeaTimerDial";

vi.mock("../ha/services/timer", () => ({
  startTimer: vi.fn(),
  restartTimer: vi.fn(),
  changeTimer: vi.fn(),
  pauseTimer: vi.fn(),
  resumeTimer: vi.fn(),
  cancelTimer: vi.fn(),
  supportsTimerChange: vi.fn().mockReturnValue(false),
  supportsTimerPause: vi.fn().mockReturnValue(true),
}));

type MockedFn = ReturnType<typeof vi.fn>;

const startTimerMock = startTimer as unknown as MockedFn;
const restartTimerMock = restartTimer as unknown as MockedFn;
const changeTimerMock = changeTimer as unknown as MockedFn;
const supportsTimerChangeMock = supportsTimerChange as unknown as MockedFn;
const pauseTimerMock = pauseTimer as unknown as MockedFn;
const resumeTimerMock = resumeTimer as unknown as MockedFn;
const cancelTimerMock = cancelTimer as unknown as MockedFn;
const supportsTimerPauseMock = supportsTimerPause as unknown as MockedFn;

if (typeof window !== "undefined") {
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback: FrameRequestCallback): number =>
      window.setTimeout(() => callback(performance.now()), 16);
  }
  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = (handle: number): void => {
      clearTimeout(handle);
    };
  }
  (window as unknown as { litDisableWarning?: Record<string, boolean> }).litDisableWarning ??= {};
  (window as unknown as { litDisableWarning: Record<string, boolean> }).litDisableWarning.DEV_MODE = true;
}

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

  function deriveUiState(status: MachineTimerViewState["status"]): TimerUiState {
    switch (status) {
      case "running":
        return "Running";
      case "paused":
        return "Paused";
      case "idle":
        return "Idle";
      case "finished":
        return { kind: "FinishedTransient", untilTs: Date.now() + 5000 };
      default:
        return { kind: "Error", reason: "EntityUnavailable" };
    }
  }

  function toControllerState(
    card: TeaTimerCard,
    state: MachineTimerViewState,
    overrides: Partial<ControllerTimerViewState> = {},
  ): ControllerTimerViewState {
    const entity = overrides.entityId ?? (card as unknown as { _config?: { entity?: string } })._config?.entity;

    return {
      ...state,
      ...overrides,
      connectionStatus: overrides.connectionStatus ?? "connected",
      uiState: overrides.uiState ?? deriveUiState((overrides.status ?? state.status) as MachineTimerViewState["status"]),
      inFlightAction: overrides.inFlightAction,
      serverRemainingSecAtT0: overrides.serverRemainingSecAtT0,
      clientMonotonicT0: overrides.clientMonotonicT0,
      actionGeneration: overrides.actionGeneration ?? 0,
      entityId: entity,
    };
  }

  function setTimerState(
    card: TeaTimerCard,
    state: MachineTimerViewState,
    overrides: Partial<ControllerTimerViewState> = {},
  ) {
    const internals = TeaTimerCard.prototype as unknown as {
      _handleTimerStateChanged(this: TeaTimerCard, next: ControllerTimerViewState): void;
    };
    internals._handleTimerStateChanged.call(card, toControllerState(card, state, overrides));
  }

  function getDisplayDuration(card: TeaTimerCard): number | undefined {
    return (card as unknown as { _displayDurationSeconds?: number })._displayDurationSeconds;
  }

  function triggerDialInput(card: TeaTimerCard, value: number) {
    const handler = card as unknown as {
      _onDialInput(event: CustomEvent<{ value: number }>): void;
    };
    handler._onDialInput(new CustomEvent("dial-input", { detail: { value } }));
  }

  function pointerSelectPreset(card: TeaTimerCard, presetId: number) {
    const handler = card as unknown as {
      _onPresetPointerDown(event: PointerEvent, presetId: number): void;
    };
    const target = document.createElement("button");
    target.focus = vi.fn();
    const event = {
      button: 0,
      pointerType: "mouse",
      isPrimary: true,
      currentTarget: target,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as PointerEvent;
    handler._onPresetPointerDown(event, presetId);
  }

  function keyboardActivatePreset(card: TeaTimerCard, presetId: number, key: " " | "Enter") {
    const handler = card as unknown as {
      _onPresetKeyDown(event: KeyboardEvent, presetId: number): void;
    };
    handler._onPresetKeyDown(
      {
        key,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as KeyboardEvent,
      presetId,
    );
  }

  function setDialElement(card: TeaTimerCard, dialElement: unknown) {
    Object.defineProperty(card, "_dialElement", {
      configurable: true,
      value: dialElement,
    });
  }

  function invokePrimaryAction(card: TeaTimerCard) {
    const handler = card as unknown as { _handlePrimaryAction(): void };
    handler._handlePrimaryAction();
  }

  function createHass(): HomeAssistant {
    return {
      locale: { language: "en" },
      states: {},
      services: {},
      callService: vi.fn().mockResolvedValue(undefined),
    } as unknown as HomeAssistant;
  }

  function triggerExtend(card: TeaTimerCard) {
    const handler = card as unknown as { _handleExtendAction(): void };
    handler._handleExtendAction();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    supportsTimerPauseMock.mockReturnValue(true);
    supportsTimerChangeMock.mockReturnValue(false);
  });

  afterEach(() => {
    document.querySelectorAll(tagName).forEach((el) => el.remove());
  });

  it("can disable the clock skew estimator via config", () => {
    const spy = vi.spyOn(TimerStateController.prototype, "setClockSkewEstimatorEnabled");
    const card = createCard();

    spy.mockClear();
    card.setConfig({ entity: "timer.test", presets: [], disableClockSkewEstimator: true });
    expect(spy).toHaveBeenCalledWith(false);

    spy.mockClear();
    card.setConfig({ entity: "timer.test", presets: [] });
    expect(spy).toHaveBeenCalledWith(true);

    spy.mockRestore();
  });

  it("tracks the displayed duration immediately after dial input", () => {
    const card = createCard();
    card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });

    const idleState: MachineTimerViewState = {
      status: "idle",
      durationSeconds: 120,
      remainingSeconds: 120,
    };

    setTimerState(card, idleState);

    const before = getDisplayDuration(card);
    expect(before).toBe(120);

    triggerDialInput(card, 150);

    const after = getDisplayDuration(card);
    expect(after).toBe(150);
  });

  it("updates the dial value text immediately when idle input occurs", () => {
    const card = createCard();
    card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });

    const idleState: MachineTimerViewState = {
      status: "idle",
      durationSeconds: 180,
      remainingSeconds: 180,
    };

    setTimerState(card, idleState);

    const dialElement = {
      valueText: "",
      shadowRoot: null,
      setProgressFraction: vi.fn(),
    };

    setDialElement(card, dialElement);

    triggerDialInput(card, 210);
    const apply = card as unknown as {
      _applyDialDisplay(state: TimerViewState, displaySeconds?: number): void;
      _timerState?: TimerViewState;
      _timerStateController: { state: TimerViewState };
      _displayDurationSeconds?: number;
    };
    const state = apply._timerState ?? apply._timerStateController.state;
    apply._applyDialDisplay(state, apply._displayDurationSeconds);

    expect(dialElement.valueText).toBe(formatDurationSeconds(210));
  });

  it("synchronizes the displayed duration with running timer updates", () => {
    const card = createCard();
    card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });

    const runningState: MachineTimerViewState = {
      status: "running",
      durationSeconds: 300,
      remainingSeconds: 180,
    };

    setTimerState(card, runningState);

    const display = getDisplayDuration(card);
    expect(display).toBe(180);
  });

  it("ticks the running display once per second while counting down", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    try {
      const card = createCard();
      card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });

      const runningState: MachineTimerViewState = {
        status: "running",
        durationSeconds: 600,
        remainingSeconds: 125,
      };

      setTimerState(card, runningState);

      expect(getDisplayDuration(card)).toBe(125);

      vi.advanceTimersByTime(1000);
      expect(getDisplayDuration(card)).toBe(124);

      vi.advanceTimersByTime(1000);
      expect(getDisplayDuration(card)).toBe(123);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("continues ticking when Home Assistant omits remaining seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    try {
      const card = createCard();
      card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });

      const idleState: TimerViewState = {
        status: "idle",
        durationSeconds: 180,
        remainingSeconds: 180,
      };

      setTimerState(card, idleState);

      const runningState: TimerViewState = {
        status: "running",
        durationSeconds: 180,
      };

      setTimerState(card, runningState);

      expect(getDisplayDuration(card)).toBe(180);

      vi.advanceTimersByTime(1000);
      expect(getDisplayDuration(card)).toBe(179);

      vi.advanceTimersByTime(1000);
      expect(getDisplayDuration(card)).toBe(178);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("starts ticking immediately when the first running state omits remaining", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    try {
      const card = createCard();
      card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });

      const runningState: TimerViewState = {
        status: "running",
        durationSeconds: 240,
      };

      setTimerState(card, runningState);

      expect(getDisplayDuration(card)).toBe(240);

      vi.advanceTimersByTime(1000);
      expect(getDisplayDuration(card)).toBe(239);

      vi.advanceTimersByTime(1000);
      expect(getDisplayDuration(card)).toBe(238);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("continues ticking when running updates arrive more than once per second", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    try {
      const card = createCard();
      card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });

      const runningState: TimerViewState = {
        status: "running",
        durationSeconds: 180,
      };

      setTimerState(card, runningState);

      expect(getDisplayDuration(card)).toBe(180);

      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(50);
        setTimerState(card, runningState);
      }

      vi.advanceTimersByTime(1000);

      expect(getDisplayDuration(card)).toBe(179);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("ignores duration echo updates while running", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    try {
      const card = createCard();
      card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });

      const runningState: TimerViewState = {
        status: "running",
        durationSeconds: 180,
      };

      setTimerState(card, runningState);

      vi.advanceTimersByTime(1000);
      expect(getDisplayDuration(card)).toBe(179);

      const echoState: TimerViewState = {
        status: "running",
        durationSeconds: 180,
        remainingSeconds: 180,
      };

      setTimerState(card, echoState);

      expect(getDisplayDuration(card)).toBe(179);

      vi.advanceTimersByTime(1000);
      expect(getDisplayDuration(card)).toBe(178);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("seeds running ticks before hydrating the display", () => {
    const card = createCard();
    card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });

    const syncSpy = vi.spyOn(
      card as unknown as { _syncDisplayDuration(state: ControllerTimerViewState): void },
      "_syncDisplayDuration",
    );
    const updateSpy = vi.spyOn(
      card as unknown as { _updateRunningTickState(state: ControllerTimerViewState): void },
      "_updateRunningTickState",
    );

    try {
      const runningState: TimerViewState = {
        status: "running",
        durationSeconds: 150,
      };

      setTimerState(card, runningState);

      const expectedState = toControllerState(card, runningState);
      expect(syncSpy).toHaveBeenCalledWith(expectedState);
      expect(updateSpy).toHaveBeenCalledWith(expectedState);
      expect(updateSpy.mock.invocationCallOrder[0]).toBeLessThan(syncSpy.mock.invocationCallOrder[0]);
    } finally {
      syncSpy.mockRestore();
      updateSpy.mockRestore();
    }
  });

  it("resynchronizes the running display when the server sends updates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    try {
      const card = createCard();
      card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });

      const runningState: TimerViewState = {
        status: "running",
        durationSeconds: 300,
        remainingSeconds: 200,
      };

      setTimerState(card, runningState);
      expect(getDisplayDuration(card)).toBe(200);

      vi.advanceTimersByTime(5000);
      expect(getDisplayDuration(card)).toBe(195);

      const resyncedState: TimerViewState = {
        status: "running",
        durationSeconds: 300,
        remainingSeconds: 160,
      };

      setTimerState(card, resyncedState);
      expect(getDisplayDuration(card)).toBe(160);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("computes the progress fraction from the remaining time", () => {
    const card = createCard();
    card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });

    const internals = card as unknown as {
      _computeProgressFraction(
        state: MachineTimerViewState,
        now: number,
        displaySeconds?: number,
      ): number | undefined;
      _serverRemainingSeconds?: number;
      _lastServerSyncMs?: number;
    };

    const start = Date.now();
    internals._serverRemainingSeconds = 300;
    internals._lastServerSyncMs = start;

    const running: MachineTimerViewState = { status: "running", durationSeconds: 300 };

    const initial = internals._computeProgressFraction(running, start);
    expect(initial).toBeCloseTo(1, 5);

    const halfway = start + 150_000;
    const midway = internals._computeProgressFraction(running, halfway);
    expect(midway).toBeCloseTo(0.5, 2);

    const finished: MachineTimerViewState = { status: "finished" };
    expect(internals._computeProgressFraction(finished, halfway)).toBe(0);
  });

  it("applies elapsed time after long pauses in ticking", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    try {
      const card = createCard();
      card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });

      const runningState: TimerViewState = {
        status: "running",
        durationSeconds: 120,
        remainingSeconds: 90,
      };

      setTimerState(card, runningState);
      expect(getDisplayDuration(card)).toBe(90);

      vi.advanceTimersByTime(10000);
      expect(getDisplayDuration(card)).toBe(80);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("shows the finished label immediately when the timer completes", () => {
    const card = createCard();
    card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });

    const finishedState: TimerViewState = {
      status: "finished",
      durationSeconds: 240,
      remainingSeconds: 0,
    };

    setTimerState(card, finishedState);

    const internals = card as unknown as {
      _getPrimaryDialLabel(state: TimerViewState, displaySeconds?: number): string;
    };

    expect(internals._getPrimaryDialLabel(finishedState, 0)).toBe(STRINGS.timerFinished);
  });

  it("prefers the running display over server remaining when formatting the primary label", () => {
    const card = createCard();
    card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });

    const runningState: TimerViewState = {
      status: "running",
      durationSeconds: 180,
      remainingSeconds: 180,
    };

    const internals = card as unknown as {
      _getPrimaryDialLabel(state: TimerViewState, displaySeconds?: number): string;
      _displayDurationSeconds?: number;
    };

    internals._displayDurationSeconds = 179;

    expect(internals._getPrimaryDialLabel(runningState, 179)).toBe(formatDurationSeconds(179));
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

  it("selects the configured default preset on load", () => {
    const card = createCard();
    card.setConfig({
      type: "custom:tea-timer-card",
      entity: "timer.kettle",
      presets: [
        { label: "Green", durationSeconds: 120 },
        { label: "Black", durationSeconds: 240 },
      ],
      defaultPreset: "Black",
    });

    setTimerState(card, { status: "idle" });

    const internals = card as unknown as {
      _viewModel?: { ui: { selectedPresetId?: unknown }; pendingDurationSeconds: number };
    };

    expect(internals._viewModel?.ui.selectedPresetId).toBe(1);
    expect(internals._viewModel?.pendingDurationSeconds).toBe(240);
  });

  it("uses timer.change when supported and within the original duration", async () => {
    vi.useFakeTimers();

    try {
      const card = createCard();
      card.setConfig({ type: "custom:tea-timer-card", entity: "timer.tea", plusButtonIncrementS: 30 });
      const hass = createHass();
      hass.services = { timer: { change: {} } };
      card.hass = hass;

      const runningState: TimerViewState = {
        status: "running",
        durationSeconds: 300,
        remainingSeconds: 200,
      };

      supportsTimerChangeMock.mockReturnValue(true);
      changeTimerMock.mockResolvedValue(undefined);

      setTimerState(card, runningState);

      triggerExtend(card);

      await vi.runAllTimersAsync();

      expect(changeTimerMock).toHaveBeenCalledWith(card.hass, "timer.tea", 30);
      expect(restartTimer).not.toHaveBeenCalled();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("announces extend additions with the updated remaining time", async () => {
    vi.useFakeTimers();

    try {
      const card = createCard();
      card.setConfig({ type: "custom:tea-timer-card", entity: "timer.tea" });
      const hass = createHass();
      card.hass = hass;

      const runningState: TimerViewState = {
        status: "running",
        durationSeconds: 240,
        remainingSeconds: 120,
      };

      supportsTimerChangeMock.mockReturnValue(false);
      restartTimerMock.mockResolvedValue(undefined);

      setTimerState(card, runningState);

      triggerExtend(card);

      const internals = card as unknown as {
        _ariaAnnouncement: string;
        _displayDurationSeconds?: number;
      };

        const expected = STRINGS.ariaExtendAdded(
          formatDurationSpeech(60, STRINGS.durationSpeech),
          formatDurationSeconds(180),
        );
        const actual = internals._ariaAnnouncement.replace(/\u200B/g, "");
        expect(actual).toBe(expected);
      expect(internals._displayDurationSeconds).toBe(180);

      await vi.runAllTimersAsync();

      expect(restartTimer).toHaveBeenCalledWith(card.hass, "timer.tea", 180);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("falls back to restart when timer.change would exceed the cap", async () => {
    vi.useFakeTimers();

    try {
      const card = createCard();
      card.setConfig({ type: "custom:tea-timer-card", entity: "timer.tea", plusButtonIncrementS: 60 });
      const hass = createHass();
      hass.services = { timer: { change: {} } };
      card.hass = hass;

      const runningState: TimerViewState = {
        status: "running",
        durationSeconds: 300,
        remainingSeconds: 290,
      };

      supportsTimerChangeMock.mockReturnValue(true);
      restartTimerMock.mockResolvedValue(undefined);

      setTimerState(card, runningState);

      triggerExtend(card);

      await vi.runAllTimersAsync();

      expect(restartTimer).toHaveBeenCalledWith(card.hass, "timer.tea", 350);
      expect(changeTimer).not.toHaveBeenCalled();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("coalesces rapid extend taps into a single restart", async () => {
    vi.useFakeTimers();

    try {
      const card = createCard();
      card.setConfig({ type: "custom:tea-timer-card", entity: "timer.tea" });
      const hass = createHass();
      card.hass = hass;

      const runningState: TimerViewState = {
        status: "running",
        durationSeconds: 300,
        remainingSeconds: 150,
      };

      supportsTimerChangeMock.mockReturnValue(false);
      restartTimerMock.mockResolvedValue(undefined);

      setTimerState(card, runningState);

      triggerExtend(card);
      triggerExtend(card);
      triggerExtend(card);

      await vi.runAllTimersAsync();

      expect(restartTimer).toHaveBeenCalledTimes(1);
      expect(restartTimer).toHaveBeenCalledWith(card.hass, "timer.tea", 330);
      expect(changeTimer).not.toHaveBeenCalled();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("respects the maxExtendS cap and announces the limit", async () => {
    vi.useFakeTimers();

    try {
      const card = createCard();
      card.setConfig({
        type: "custom:tea-timer-card",
        entity: "timer.tea",
        plusButtonIncrementS: 60,
        maxExtendS: 60,
      });
      const hass = createHass();
      hass.services = { timer: { change: {} } };
      card.hass = hass;

      const runningState: TimerViewState = {
        status: "running",
        durationSeconds: 300,
        remainingSeconds: 180,
      };

      supportsTimerChangeMock.mockReturnValue(true);
      changeTimerMock.mockResolvedValue(undefined);

      setTimerState(card, runningState);

      triggerExtend(card);
      await vi.runAllTimersAsync();

      expect(changeTimer).toHaveBeenCalledTimes(1);

      triggerExtend(card);
      await Promise.resolve();

      expect(changeTimer).toHaveBeenCalledTimes(1);
      const internals = card as unknown as { _ariaAnnouncement: string; _extendAccumulatedSeconds: number };
      expect(internals._ariaAnnouncement).toContain(STRINGS.ariaExtendCapReached);
      expect(internals._extendAccumulatedSeconds).toBe(60);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("announces when the timer finishes before an extend is delivered", async () => {
    vi.useFakeTimers();

    let announceSpy: MockInstance<[message: string], void> | undefined;
    try {
      const card = createCard();
      card.setConfig({ type: "custom:tea-timer-card", entity: "timer.tea" });
      const hass = createHass();
      card.hass = hass;

      const runningState: TimerViewState = {
        status: "running",
        durationSeconds: 180,
        remainingSeconds: 5,
      };

      supportsTimerChangeMock.mockReturnValue(false);
      restartTimerMock.mockResolvedValue(undefined);

      setTimerState(card, runningState);

      announceSpy = vi.spyOn(card as unknown as { _announce(message: string): void }, "_announce");

      triggerExtend(card);

      const finishedState: TimerViewState = {
        status: "finished",
        durationSeconds: 180,
        remainingSeconds: 0,
      };

      setTimerState(card, finishedState);

      const announceCalls = announceSpy?.mock.calls ?? [];
      const raceAnnounced = announceCalls.some((args) => args[0] === STRINGS.ariaExtendRaceLost);
      expect(raceAnnounced).toBe(true);
      expect(restartTimer).not.toHaveBeenCalled();
      expect(changeTimer).not.toHaveBeenCalled();

      await vi.runAllTimersAsync();
    } finally {
      announceSpy?.mockRestore();
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("highlights presets and syncs the dial on pointer activation", () => {
    const card = createCard();
    card.setConfig({
      type: "custom:tea-timer-card",
      entity: "timer.kettle",
      presets: [
        { label: "Green", durationSeconds: 120 },
        { label: "Black", durationSeconds: 240 },
      ],
    });

    const idleState: TimerViewState = {
      status: "idle",
      durationSeconds: 120,
      remainingSeconds: 120,
    };

    setTimerState(card, idleState);

    const internals = card as unknown as {
      _viewModel?: { ui: { selectedPresetId?: unknown } };
      _displayDurationSeconds?: number;
      _dialElement?: { value: number; valueText: string; shadowRoot: null; setProgressFraction: (fraction: number) => void };
    };

    const dialElement = { value: 0, valueText: "", shadowRoot: null, setProgressFraction: vi.fn() };
    setDialElement(card, dialElement);

    pointerSelectPreset(card, 1);
    const apply = card as unknown as {
      _applyDialDisplay(state: TimerViewState, displaySeconds?: number): void;
      _timerState?: TimerViewState;
      _timerStateController: { state: TimerViewState };
      _displayDurationSeconds?: number;
    };
    const state = apply._timerState ?? apply._timerStateController.state;
    apply._applyDialDisplay(state, apply._displayDurationSeconds);

    expect(internals._viewModel?.ui.selectedPresetId).toBe(1);
    expect(internals._displayDurationSeconds).toBe(240);
    expect(dialElement.value).toBe(240);
    expect(dialElement.valueText).toBe(formatDurationSeconds(240));

    const finishedState: TimerViewState = {
      status: "finished",
      durationSeconds: 240,
      remainingSeconds: 0,
    };

    setTimerState(card, finishedState);

    const finished = apply._timerState ?? apply._timerStateController.state;
    apply._applyDialDisplay(finished, apply._displayDurationSeconds);

    expect(internals._viewModel?.ui.selectedPresetId).toBe(1);
    expect(dialElement.value).toBe(240);
  });

  it("rotates the dial handle to match preset selection", () => {
    const card = createCard();
    card.setConfig({
      type: "custom:tea-timer-card",
      entity: "timer.kettle",
      presets: [
        { label: "Green", durationSeconds: 120 },
        { label: "Black", durationSeconds: 240 },
      ],
    });

    const idleState: TimerViewState = {
      status: "idle",
      durationSeconds: 120,
      remainingSeconds: 120,
    };

    setTimerState(card, idleState);

    const internals = card as unknown as {
      _config?: { dialBounds: DurationBounds };
      _dialElement?: TeaTimerDial;
    };

    const handle = document.createElement("div");
    const dialBounds = internals._config?.dialBounds ?? { min: 0, max: 0, step: 1 };
    const dialElement = {
      value: 0,
      valueText: "",
      bounds: dialBounds,
      setProgressFraction: vi.fn(),
      shadowRoot: {
        querySelector: (selector: string) => (selector === ".dial-handle" ? handle : null),
      },
    } as unknown as TeaTimerDial;

    setDialElement(card, dialElement);

    pointerSelectPreset(card, 1);
    const apply = card as unknown as {
      _applyDialDisplay(state: TimerViewState, displaySeconds?: number): void;
      _timerState?: TimerViewState;
      _timerStateController: { state: TimerViewState };
      _displayDurationSeconds?: number;
    };
    const state = apply._timerState ?? apply._timerStateController.state;
    apply._applyDialDisplay(state, apply._displayDurationSeconds);

    const span = dialBounds.max - dialBounds.min;
    const clamped = Math.min(dialBounds.max, Math.max(dialBounds.min, 240));
    const normalized = span > 0 ? (clamped - dialBounds.min) / span : 0;
    const expectedAngle = normalized * 360;

    expect(handle.style.transform).toBe(`rotate(${expectedAngle}deg)`);
  });

  it("activates presets via keyboard without delay", () => {
    const card = createCard();
    card.setConfig({
      type: "custom:tea-timer-card",
      entity: "timer.kettle",
      presets: [
        { label: "Green", durationSeconds: 120 },
        { label: "Black", durationSeconds: 240 },
      ],
    });

    const idleState: TimerViewState = {
      status: "idle",
      durationSeconds: 120,
      remainingSeconds: 120,
    };

    setTimerState(card, idleState);

    const internals = card as unknown as {
      _viewModel?: { ui: { selectedPresetId?: unknown } };
      _displayDurationSeconds?: number;
      _dialElement?: { value: number; valueText: string; shadowRoot: null; setProgressFraction: (fraction: number) => void };
    };

    const dialElement = { value: 0, valueText: "", shadowRoot: null, setProgressFraction: vi.fn() };
    setDialElement(card, dialElement);

    keyboardActivatePreset(card, 1, "Enter");
    const apply = card as unknown as {
      _applyDialDisplay(state: TimerViewState, displaySeconds?: number): void;
      _timerState?: TimerViewState;
      _timerStateController: { state: TimerViewState };
      _displayDurationSeconds?: number;
    };
    const state = apply._timerState ?? apply._timerStateController.state;
    apply._applyDialDisplay(state, apply._displayDurationSeconds);

    expect(internals._viewModel?.ui.selectedPresetId).toBe(1);
    expect(internals._displayDurationSeconds).toBe(240);
    expect(dialElement.value).toBe(240);

    keyboardActivatePreset(card, 0, " ");
    const updatedState = apply._timerState ?? apply._timerStateController.state;
    apply._applyDialDisplay(updatedState, apply._displayDurationSeconds);

    expect(internals._viewModel?.ui.selectedPresetId).toBe(0);
    expect(internals._displayDurationSeconds).toBe(120);
    expect(dialElement.value).toBe(120);
  });

  it("queues presets while running and surfaces next message", () => {
    const card = createCard();
    card.setConfig({
      type: "custom:tea-timer-card",
      entity: "timer.kettle",
      presets: [
        { label: "Green", durationSeconds: 120 },
        { label: "Black", durationSeconds: 240 },
      ],
    });

    const runningState: TimerViewState = {
      status: "running",
      durationSeconds: 240,
      remainingSeconds: 180,
    };
    setTimerState(card, runningState);

    pointerSelectPreset(card, 0);

    const internals = card as unknown as {
      _viewModel?: { ui: { queuedPresetId?: unknown }; pendingDurationSeconds: number };
    };
    expect(internals._viewModel?.ui.queuedPresetId).toBe(0);
    expect(internals._viewModel?.pendingDurationSeconds).toBe(120);
    const subtitleTemplate = (card as unknown as { _renderSubtitle(): unknown })._renderSubtitle();
    const container = document.createElement("div");
    if (subtitleTemplate && subtitleTemplate !== nothing) {
      render(subtitleTemplate as TemplateResult, container);
    }
    expect(container.textContent).toContain("Next");
  });

  it("restarts with queued preset and clears the queue", async () => {
    const card = createCard();
    card.setConfig({
      type: "custom:tea-timer-card",
      entity: "timer.kettle",
      presets: [
        { label: "Green", durationSeconds: 120 },
        { label: "Black", durationSeconds: 240 },
      ],
    });
    card.hass = createHass();

    const runningState: TimerViewState = {
      status: "running",
      durationSeconds: 240,
      remainingSeconds: 120,
    };
    setTimerState(card, runningState);

    pointerSelectPreset(card, 0);

    invokePrimaryAction(card);

    await Promise.resolve();

    expect(restartTimer).toHaveBeenCalledWith(card.hass, "timer.kettle", 120);
    const internals = card as unknown as {
      _viewModel?: { ui: { queuedPresetId?: unknown; selectedPresetId?: unknown } };
    };
    expect(internals._viewModel?.ui.queuedPresetId).toBeUndefined();
    expect(internals._viewModel?.ui.selectedPresetId).toBe(0);
  });

  it("applies queued presets when the timer returns to idle", () => {
    const card = createCard();
    card.setConfig({
      type: "custom:tea-timer-card",
      entity: "timer.kettle",
      presets: [
        { label: "Green", durationSeconds: 120 },
        { label: "Black", durationSeconds: 240 },
      ],
    });

    const runningState: TimerViewState = {
      status: "running",
      durationSeconds: 240,
      remainingSeconds: 60,
    };
    setTimerState(card, runningState);
    pointerSelectPreset(card, 0);

    const idleState: TimerViewState = {
      status: "idle",
      durationSeconds: 180,
      remainingSeconds: 180,
    };
    setTimerState(card, idleState);

    const internals = card as unknown as {
      _viewModel?: { ui: { queuedPresetId?: unknown; selectedPresetId?: unknown } };
    };
    expect(internals._viewModel?.ui.queuedPresetId).toBeUndefined();
    expect(internals._viewModel?.ui.selectedPresetId).toBe(0);
  });

  it("shows custom preset indicator after dial adjustment", () => {
    const card = createCard();
    card.setConfig({
      type: "custom:tea-timer-card",
      entity: "timer.kettle",
      presets: [
        { label: "Green", durationSeconds: 120 },
        { label: "Black", durationSeconds: 240 },
      ],
    });

    const idleState: TimerViewState = {
      status: "idle",
      durationSeconds: 120,
      remainingSeconds: 120,
    };
    setTimerState(card, idleState);

    triggerDialInput(card, 195);

    const internals = card as unknown as { _viewModel?: { ui: { selectedPresetId?: unknown } } };
    expect(internals._viewModel?.ui.selectedPresetId).toBe("custom");
    const presetsTemplate = (card as unknown as { _renderPresets(): unknown })._renderPresets();
    const container = document.createElement("div");
    render(presetsTemplate as TemplateResult, container);
    const customLabel = container.querySelector(".preset-custom");
    expect(customLabel?.textContent).toBe(STRINGS.presetsCustomLabel);
  });

  it("highlights the preset when the dial snaps to a preset duration", () => {
    const card = createCard();
    card.setConfig({
      type: "custom:tea-timer-card",
      entity: "timer.kettle",
      presets: [
        { label: "Green", durationSeconds: 120 },
        { label: "Black", durationSeconds: 240 },
      ],
    });

    const idleState: TimerViewState = {
      status: "idle",
      durationSeconds: 120,
      remainingSeconds: 120,
    };

    setTimerState(card, idleState);

    triggerDialInput(card, 240);

    const internals = card as unknown as { _viewModel?: { ui: { selectedPresetId?: unknown } } };
    expect(internals._viewModel?.ui.selectedPresetId).toBe(1);
  });

  it("keeps the latest preset after rapid pointer selections", () => {
    const card = createCard();
    card.setConfig({
      type: "custom:tea-timer-card",
      entity: "timer.kettle",
      presets: [
        { label: "Green", durationSeconds: 120 },
        { label: "Black", durationSeconds: 240 },
        { label: "Oolong", durationSeconds: 300 },
      ],
    });

    const idleState: TimerViewState = {
      status: "idle",
      durationSeconds: 120,
      remainingSeconds: 120,
    };

    setTimerState(card, idleState);

    pointerSelectPreset(card, 0);
    pointerSelectPreset(card, 1);
    pointerSelectPreset(card, 2);

    const internals = card as unknown as {
      _viewModel?: { ui: { selectedPresetId?: unknown } };
      _displayDurationSeconds?: number;
    };

    expect(internals._viewModel?.ui.selectedPresetId).toBe(2);
    expect(internals._displayDurationSeconds).toBe(300);
  });

  it("does not desync the dial when queuing presets while running", () => {
    const card = createCard();
    card.setConfig({
      type: "custom:tea-timer-card",
      entity: "timer.kettle",
      presets: [
        { label: "Green", durationSeconds: 120 },
        { label: "Black", durationSeconds: 240 },
      ],
    });

    const runningState: TimerViewState = {
      status: "running",
      durationSeconds: 240,
      remainingSeconds: 200,
    };

    setTimerState(card, runningState);

    const internals = card as unknown as {
      _displayDurationSeconds?: number;
      _viewModel?: { ui: { queuedPresetId?: unknown } };
    };

    const beforeDisplay = internals._displayDurationSeconds;

    pointerSelectPreset(card, 0);

    expect(internals._viewModel?.ui.queuedPresetId).toBe(0);
    expect(internals._displayDurationSeconds).toBe(beforeDisplay);
  });

  it("renders a helpful message when presets are missing", () => {
    const card = createCard();
    card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle", presets: [] });
    setTimerState(card, { status: "idle" });

    const presetsTemplate = (card as unknown as { _renderPresets(): unknown })._renderPresets();
    const container = document.createElement("div");
    render(presetsTemplate as TemplateResult, container);
    const emptyState = container.querySelector(".empty-state");
    expect(emptyState?.textContent).toBe(STRINGS.presetsMissing);
  });

  it("renders support links for setup and automations", () => {
    const card = createCard();
    card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });
    setTimerState(card, { status: "idle" });

    const linksTemplate = (card as unknown as { _renderSupportLinks(): TemplateResult })._renderSupportLinks();
    const container = document.createElement("div");
    render(linksTemplate, container);
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>(".links .help"));
    expect(links.length).toBe(2);
    const labels = links.map((link) => link.textContent?.trim());
    expect(labels).toEqual([STRINGS.gettingStartedLabel, STRINGS.finishAutomationLabel]);
  });

  it("pauses via helper when native pause is unavailable", async () => {
    const card = createCard();
    document.body.appendChild(card);
    const hass = createHass();
    hass.states["input_text.kettle_paused_remaining"] = { state: "0" } as unknown as HomeAssistant["states"][string];
    card.hass = hass;
    supportsTimerPauseMock.mockReturnValue(false);
    card.setConfig({ entity: "timer.kettle", presets: [] });

    setTimerState(card, { status: "running", remainingSeconds: 45 });
    await card.updateComplete;

    const button = card.shadowRoot?.querySelector<HTMLButtonElement>(".pause-resume-button");
    expect(button).toBeTruthy();
    const internalsBefore = card as unknown as { _pauseCapability?: string };
    expect(internalsBefore._pauseCapability).toBe("compat");
    button?.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const callService = hass.callService as MockedFn;
    expect(callService).toHaveBeenCalledWith("input_text", "set_value", {
      entity_id: "input_text.kettle_paused_remaining",
      value: 45,
    });
    expect(cancelTimerMock).toHaveBeenCalledWith(hass, "timer.kettle");
  });

  it("resumes from helper value when native pause is unavailable", async () => {
    const card = createCard();
    document.body.appendChild(card);
    const hass = createHass();
    hass.states["input_text.kettle_paused_remaining"] = { state: "30" } as unknown as HomeAssistant["states"][string];
    card.hass = hass;
    supportsTimerPauseMock.mockReturnValue(false);
    card.setConfig({ entity: "timer.kettle", presets: [] });

    setTimerState(card, { status: "paused", remainingSeconds: 30 });
    await card.updateComplete;

    const button = card.shadowRoot?.querySelector<HTMLButtonElement>(".pause-resume-button");
    expect(button).toBeTruthy();
    const internalsBefore = card as unknown as { _pauseCapability?: string };
    expect(internalsBefore._pauseCapability).toBe("compat");
    button?.click();
    await Promise.resolve();

    expect(startTimerMock).toHaveBeenCalledWith(hass, "timer.kettle", 30);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const callService = hass.callService as MockedFn;
    expect(callService).toHaveBeenCalledWith("input_text", "set_value", {
      entity_id: "input_text.kettle_paused_remaining",
      value: "",
    });
  });

  it("renders pause and resume controls in native mode", async () => {
    const card = createCard();
    document.body.appendChild(card);
    const hass = createHass();
    card.hass = hass;
    card.setConfig({ entity: "timer.kettle", presets: [] });

    setTimerState(card, { status: "running", remainingSeconds: 120 });
    await card.updateComplete;

    let button = card.shadowRoot?.querySelector<HTMLButtonElement>(".pause-resume-button");
    expect(button?.textContent?.trim()).toBe(STRINGS.pauseButtonLabel);
    button?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(pauseTimerMock).toHaveBeenCalledWith(hass, "timer.kettle");

    setTimerState(card, { status: "paused", remainingSeconds: 80 });
    await card.updateComplete;
    button = card.shadowRoot?.querySelector<HTMLButtonElement>(".pause-resume-button");
    expect(button?.textContent?.trim()).toBe(STRINGS.resumeButtonLabel);
    button?.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(resumeTimerMock).toHaveBeenCalledWith(hass, "timer.kettle");
  });

  it("extends a paused timer via changeTimer when pause support is native", async () => {
    const card = createCard();
    const hass = createHass();
    card.hass = hass;
    card.setConfig({ entity: "timer.kettle", presets: [] });

    const pausedState: TimerViewState = {
      status: "paused",
      durationSeconds: 240,
      remainingSeconds: 120,
    };
    changeTimerMock.mockResolvedValue(undefined);

    setTimerState(card, pausedState);
    const internalsBefore = card as unknown as { _pauseCapability?: string };
    expect(internalsBefore._pauseCapability).toBe("native");
    const handler = card as unknown as {
      _extendWhilePaused(increment: number, state: TimerViewState): Promise<void>;
    };

    await handler._extendWhilePaused(60, pausedState);

    expect(changeTimerMock).toHaveBeenCalledWith(hass, "timer.kettle", 60);
  });

  it("surfaces extend failures when native paused extend calls fail", async () => {
    const card = createCard();
    const hass = createHass();
    card.hass = hass;
    card.setConfig({ entity: "timer.kettle", presets: [] });

    const pausedState: TimerViewState = {
      status: "paused",
      durationSeconds: 300,
      remainingSeconds: 90,
    };
    changeTimerMock.mockRejectedValueOnce(new Error("nope"));

    setTimerState(card, pausedState);
    const handler = card as unknown as {
      _extendWhilePaused(increment: number, state: TimerViewState): Promise<void>;
    };

    await handler._extendWhilePaused(60, pausedState);

    expect(changeTimerMock).toHaveBeenCalledWith(hass, "timer.kettle", 60);
    const internals = card as unknown as { _viewModel?: { ui: { error?: { message?: string } } } };
    expect(internals._viewModel?.ui.error?.message).toBe(STRINGS.toastExtendFailed);
  });

  it("extends a paused timer by updating the helper in compatibility mode", async () => {
    const card = createCard();
    const hass = createHass();
    hass.states["input_text.kettle_paused_remaining"] = { state: "120" } as unknown as HomeAssistant["states"][string];
    card.hass = hass;
    supportsTimerPauseMock.mockReturnValue(false);
    card.setConfig({ entity: "timer.kettle", presets: [] });

    const pausedState: TimerViewState = {
      status: "paused",
      durationSeconds: 240,
      remainingSeconds: 120,
    };

    setTimerState(card, pausedState);
    const internalsBefore = card as unknown as { _pauseCapability?: string };
    expect(internalsBefore._pauseCapability).toBe("compat");
    const handler = card as unknown as {
      _extendWhilePaused(increment: number, state: TimerViewState): Promise<void>;
    };

    await handler._extendWhilePaused(60, pausedState);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const callService = hass.callService as MockedFn;
    expect(callService).toHaveBeenCalledWith("input_text", "set_value", {
      entity_id: "input_text.kettle_paused_remaining",
      value: 180,
    });
    const internals = card as unknown as { _displayDurationSeconds?: number };
    expect(internals._displayDurationSeconds).toBe(180);
  });

  it("announces when paused remaining is unknown in compatibility mode", async () => {
    const card = createCard();
    const hass = createHass();
    card.hass = hass;
    supportsTimerPauseMock.mockReturnValue(false);
    card.setConfig({ entity: "timer.kettle", presets: [] });

    const pausedState: TimerViewState = {
      status: "paused",
    };

    setTimerState(card, pausedState);
    const handler = card as unknown as {
      _extendWhilePaused(increment: number, state: TimerViewState): Promise<void>;
    };
    await handler._extendWhilePaused(60, pausedState);

    const internals = card as unknown as { _viewModel?: { ui: { error?: { message?: string } } } };
    expect(internals._viewModel?.ui.error?.message).toBe(STRINGS.toastPauseRemainingUnknown);
  });

  it("surfaces helper update failures while paused in compatibility mode", async () => {
    const card = createCard();
    const hass = createHass();
    hass.callService = vi.fn().mockRejectedValueOnce(new Error("boom"));
    hass.states["input_text.kettle_paused_remaining"] = { state: "45" } as unknown as HomeAssistant["states"][string];
    card.hass = hass;
    supportsTimerPauseMock.mockReturnValue(false);
    card.setConfig({ entity: "timer.kettle", presets: [] });

    const pausedState: TimerViewState = {
      status: "paused",
      remainingSeconds: 45,
    };

    setTimerState(card, pausedState);
    const handler = card as unknown as {
      _extendWhilePaused(increment: number, state: TimerViewState): Promise<void>;
    };
    await handler._extendWhilePaused(60, pausedState);

    const internals = card as unknown as { _viewModel?: { ui: { error?: { message?: string } } } };
    expect(internals._viewModel?.ui.error?.message).toBe(STRINGS.toastExtendFailed);
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
