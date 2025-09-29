import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, nothing } from "lit";
import type { TemplateResult } from "lit";
import { TeaTimerCard } from "./TeaTimerCard";
import type { TimerViewState } from "../state/TimerStateMachine";
import { formatDurationSeconds } from "../model/duration";
import type { DurationBounds } from "../model/duration";
import { STRINGS } from "../strings";
import type { HomeAssistant } from "../types/home-assistant";
import { restartTimer, startTimer } from "../ha/services/timer";
import type { TeaTimerDial } from "../dial/TeaTimerDial";

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

    const before = getDisplayDuration(card);
    expect(before).toBe(120);

    triggerDialInput(card, 150);

    const after = getDisplayDuration(card);
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

    const display = getDisplayDuration(card);
    expect(display).toBe(180);
  });

  it("ticks the running display once per second while counting down", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    try {
      const card = createCard();
      card.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle" });

      const runningState: TimerViewState = {
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
      _dialElement?: { value: number; valueText: string; shadowRoot: null };
    };

    const dialElement = { value: 0, valueText: "", shadowRoot: null };
    internals._dialElement = dialElement;

    pointerSelectPreset(card, 1);

    expect(internals._viewModel?.ui.selectedPresetId).toBe(1);
    expect(internals._displayDurationSeconds).toBe(240);
    expect(dialElement.value).toBe(240);
    expect(dialElement.valueText).toBe(formatDurationSeconds(240));
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
      shadowRoot: {
        querySelector: (selector: string) => (selector === ".dial-handle" ? handle : null),
      },
    } as unknown as TeaTimerDial;

    internals._dialElement = dialElement;

    pointerSelectPreset(card, 1);

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
      _dialElement?: { value: number; valueText: string; shadowRoot: null };
    };

    const dialElement = { value: 0, valueText: "", shadowRoot: null };
    internals._dialElement = dialElement;

    keyboardActivatePreset(card, 1, "Enter");

    expect(internals._viewModel?.ui.selectedPresetId).toBe(1);
    expect(internals._displayDurationSeconds).toBe(240);
    expect(dialElement.value).toBe(240);

    keyboardActivatePreset(card, 0, " ");

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
