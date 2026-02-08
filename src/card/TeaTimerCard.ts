import { html, LitElement, nothing } from "lit";
import { classMap } from "lit/directives/class-map.js";
import { createRef, ref } from "lit/directives/ref.js";
import { property, query, state } from "lit/decorators.js";
import { baseStyles } from "../styles/base";
import { cardStyles } from "../styles/card";
import { parseTeaTimerConfig, TeaTimerCardConfig, TeaTimerConfig } from "../model/config";
import {
  applyPresetSelection,
  applyQueuedPreset,
  clearPendingAction,
  clearQueuedPreset,
  createTeaTimerViewModel,
  CUSTOM_PRESET_ID,
  getPresetById,
  PendingTimerAction,
  queuePresetSelection,
  setPendingAction,
  setViewModelError,
  TeaTimerViewModel,
  updateDialSelection,
} from "../view/TeaTimerViewModel";
import { STRINGS } from "../strings";
import type { HomeAssistant, LovelaceCard } from "../types/home-assistant";
import {
  TimerStateController,
  type TimerViewState,
  type TimerUiState,
} from "../state/TimerStateController";
import {
  formatDurationSeconds,
  formatDurationSpeech,
  normalizeDurationSeconds,
} from "../model/duration";
import "../dial/TeaTimerDial";
import type { TeaTimerDial } from "../dial/TeaTimerDial";
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
import { TimerAnnouncer } from "./TimerAnnouncer";
import {
  reportDebugSeed,
  reportDebugTick,
  reportServerCorrection,
  reportStartOutlier,
  type DebugSeedSource,
} from "../debug";
import {
  displaySeconds as monotonicDisplaySeconds,
  nowMs as monotonicNow,
  remainingMs as monotonicRemainingMs,
  seedBaseline as seedMonotonicBaseline,
  type MonotonicCountdownState,
  VISUAL_CORRECTION_THRESHOLD_MS,
} from "../time/monotonic";

const PROGRESS_FRAME_INTERVAL_MS = 250;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const EXTEND_COALESCE_DELAY_MS = 200;
const START_FIRST_RENDER_TOLERANCE_S = 0.25;
const START_OUTLIER_MAX_SECONDS = 6 * 60 * 60;

interface PendingStartSeed {
  requestedSeconds: number;
  monotonicSeedMs: number;
  baselineEndMonotonicMs: number;
  intentWallMs: number;
  intentIso: string;
  kind: "start" | "restart";
  localSeedApplied: boolean;
  warningIssued: boolean;
}

interface StartClampState {
  requestedSeconds: number;
  intentIso: string;
  firstComputedSeconds: number;
  deltaSeconds: number;
  nowMs: number;
  remainingFrames: number;
}

type TimerUiErrorReason = Extract<TimerUiState, { kind: "Error" }>["reason"];
type EntityErrorInfo = { message: string; entityId?: string };

export class TeaTimerCard extends LitElement implements LovelaceCard {
  static styles = [baseStyles, cardStyles];

  public static async getConfigElement() {
    await import("../editor/tea-timer-card-editor");
    return document.createElement("tea-timer-card-editor");
  }

  public static getStubConfig(): TeaTimerCardConfig {
    return {
      type: "custom:tea-timer-card",
      title: "Tea Timer",
      entity: "timer.example_tea",
      presets: [
        { label: "Green", durationSeconds: 120 },
        { label: "Black", durationSeconds: 240 },
        { label: "Herbal", durationSeconds: 300 },
      ],
    };
  }

  public static assertConfig(config: TeaTimerCardConfig): void {
    const { errors } = parseTeaTimerConfig(config);
    if (errors.length) {
      throw new Error(errors.join("\n"));
    }
  }

  private _hass?: HomeAssistant;

  @property({ attribute: false })
  public get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  public set hass(value: HomeAssistant | undefined) {
    const oldValue = this._hass;
    this._hass = value;
    this._timerStateController.setHass(value);
    this._evaluatePauseCapability();
    this.requestUpdate("hass", oldValue);
  }

  @state()
  private _config?: TeaTimerConfig;

  @state()
  private _viewModel?: TeaTimerViewModel;

  @state()
  private _errors: string[] = [];

  @state()
  private _timerState: TimerViewState;

  @state()
  private _dialTooltipVisible = false;

  @state()
  private _ariaAnnouncement = "";

  @state()
  private _displayDurationSeconds?: number;

  @state()
  private _confirmRestartVisible = false;

  @state()
  private _extendPendingSeconds = 0;

  @state()
  private _extendAccumulatedSeconds = 0;

  @state()
  private _pauseResumeInFlight: "pause" | "resume" | undefined = undefined;

  @query("tea-timer-dial")
  private _dialElement?: TeaTimerDial;

  private readonly _timerStateController: TimerStateController;

  private readonly _announcer = new TimerAnnouncer(STRINGS);

  private _announcementToggle = false;

  private _previousTimerState?: TimerViewState;

  private _dialTooltipTimer?: number;

  private _errorTimer?: number;
  private _confirmRestartDuration?: number;
  private _lastPointerPresetId?: number;
  private _lastKeyboardPresetId?: number;

  private readonly _primaryLabelRef = createRef<HTMLSpanElement>();

  private _serverRemainingSeconds?: number;
  private _lastServerSyncMonotonicMs?: number;

  private _pendingStartSeed?: PendingStartSeed;

  private _startClamp?: StartClampState;

  private _debugSeedSource?: DebugSeedSource;

  private _debugHasSeededBaseline = false;

  private _debugPendingSeedSource?: DebugSeedSource;

  private _applyDialRaf?: number;
  private _dialResizeObserver?: ResizeObserver;
  private _lastDialSignature?: string;
  private _lastDialElement?: TeaTimerDial;

  private _progressAnimationHandle?: number;

  private _countdownAnimationHandle?: number;

  private _lastProgressUpdateMs?: number;

  private _prefersReducedMotion = false;

  private _reducedMotionMedia?: MediaQueryList;

  private _onReducedMotionChange?: (event: MediaQueryListEvent) => void;

  private _extendRunGeneration?: number;

  private _extendRunTotalSeconds?: number;

  private _extendServicePromise?: Promise<void>;

  private readonly _monotonicCountdown: MonotonicCountdownState = {};

  private _extendInFlightSeconds = 0;

  private _extendBatchBaseRemaining?: number;

  private _extendPendingRestartGeneration?: number;

  private _extendCoalesceTimer?: number;

  private _pauseCapability: "native" | "compat" | "unsupported" = "unsupported";

  private _pauseHelperEntityId?: string;

  constructor() {
    super();
    this._timerStateController = new TimerStateController(this, {
      finishedOverlayMs: 5000,
      onStateChanged: (state) => {
        this._handleTimerStateChanged(state);
      },
    });
    this._timerState = this._timerStateController.state;
    this._previousTimerState = this._timerState;
  }

  public setConfig(config: unknown): void {
    const result = parseTeaTimerConfig(config);
    this._errors = result.errors;
    this._config = result.config ?? undefined;
    this._confirmRestartVisible = false;
    this._confirmRestartDuration = undefined;
    this._clearErrorTimer();
    this._resetExtendTracking();
    this._extendServicePromise = undefined;
    this._timerStateController.setClockSkewEstimatorEnabled(
      this._config?.clockSkewEstimatorEnabled ?? true,
    );
    this._timerStateController.setFinishedOverlayMs(
      this._config?.finishedAutoIdleMs ?? 5000,
    );
    const state = this._timerState ?? this._timerStateController.state;
    if (this._config) {
      this._viewModel = createTeaTimerViewModel(this._config, state);
    } else {
      this._viewModel = undefined;
    }
    this._updateRunningTickState(state, this._previousTimerState);
    this._syncDisplayDuration(state);
    this._previousTimerState = state;
    this._timerStateController.setEntityId(this._config?.entity);
    this._pauseHelperEntityId = this._derivePauseHelperEntityId(this._config?.entity);
    this._timerStateController.setPauseHelperEntityId(this._pauseHelperEntityId);
    this._evaluatePauseCapability();
    this.requestUpdate();
  }

  // eslint-disable-next-line class-methods-use-this
  public getCardSize(): number {
    return 4;
  }

  protected render() {
    const pendingAction = this._viewModel?.ui.pendingAction ?? "none";
    const state = this._timerState ?? this._timerStateController.state;
    const entityErrorInfo = state ? this._getEntityErrorInfo(state.uiState) : undefined;
    const showInteractive = !!state && !entityErrorInfo;
    const hasPending = pendingAction !== "none" || !!state?.inFlightAction;
    return html`
      ${this._renderErrors()}
      <section
        class="card"
        data-instance-id=${this._config?.cardInstanceId ?? "unconfigured"}
        aria-busy=${hasPending ? "true" : "false"}
        @click=${this._onCardClick}
      >
        ${this._renderHeader()}
        ${showInteractive ? this._renderSubtitle() : nothing}
        ${state ? this._renderStatusPill(state) : nothing}
        ${state ? this._renderStateBanner(state) : nothing}
        ${entityErrorInfo ? this._renderEntityError(entityErrorInfo) : nothing}
        ${showInteractive
          ? html`
              <div class="interaction">
                ${this._renderPresets(state)}
                ${this._renderDial(state)}
                ${this._renderExtendControls(state)}
                ${this._renderPauseResumeControls(state)}
              </div>
              ${this._renderPrimaryAction(state)}
            `
          : !state
            ? html`
                <div class="interaction">
                  ${this._renderPresets(undefined)}
                  ${this._renderDial(undefined)}
                </div>
              `
            : nothing}
        <div class="sr-only" role="status" aria-live="polite">${this._ariaAnnouncement}</div>
        ${this._renderPendingOverlay(state)}
        ${this._confirmRestartVisible ? this._renderRestartConfirm() : nothing}
        ${this._renderToast()}
      </section>
    `;
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this._attachReducedMotionListener();
  }

  protected override firstUpdated(): void {
    const dialWrapper = this.renderRoot?.querySelector<HTMLElement>(".dial-wrapper");
    if (dialWrapper && "ResizeObserver" in window) {
      this._dialResizeObserver = new ResizeObserver(() => {
        this._lastDialSignature = undefined;
        this._scheduleApplyDialDisplay("resize");
      });
      this._dialResizeObserver.observe(dialWrapper);
    }

    this._scheduleApplyDialDisplay("first-updated");
  }

  private _announce(message: string | undefined): void {
    if (!message) {
      return;
    }

    this._announcementToggle = !this._announcementToggle;
    const suffix = this._announcementToggle ? "" : "\u200B";
    this._ariaAnnouncement = `${message}${suffix}`;
  }

  private _renderErrors() {
    if (!this._errors.length) {
      return nothing;
    }

    return html`
      <ul class="errors" role="alert">
        ${this._errors.map((error) => html`<li>${error}</li>`) }
      </ul>
    `;
  }

  private _renderHeader() {
    const title = this._viewModel?.ui.title ?? STRINGS.cardTitleFallback;
    const entityLabel = this._viewModel?.ui.entityLabel ?? STRINGS.emptyState;

    return html`
      <header class="header">
        <h2 class="title">${title}</h2>
        <span class="entity">${entityLabel}</span>
      </header>
    `;
  }

  private _renderSubtitle() {
    if (!this._viewModel) {
      return nothing;
    }

    const queuedId = this._viewModel.ui.queuedPresetId;
    if (typeof queuedId !== "number") {
      return nothing;
    }

    const preset = this._viewModel.ui.presets.find((item) => item.id === queuedId);
    if (!preset) {
      return nothing;
    }

    const label = STRINGS.presetsQueuedLabel(preset.label, preset.durationLabel);
    return html`<p class="subtitle" role="note">${label}</p>`;
  }

  private _renderDial(state?: TimerViewState) {
    const resolvedState = state ?? this._timerState ?? this._timerStateController.state;
    const status = resolvedState.status;
    const dial = this._viewModel?.dial;
    const bounds = dial?.bounds ?? { min: 0, max: 0, step: 1 };
    const displaySeconds =
      this._displayDurationSeconds ?? dial?.selectedDurationSeconds ?? bounds.min;
    const dialValueText = formatDurationSeconds(displaySeconds);
    const secondary = this._getSecondaryDialLabel(resolvedState);
    const estimation = this._getEstimationNotice(resolvedState);
    const interactive = (dial?.isInteractive ?? false) && this._canInteract(resolvedState);

    return html`
      <div class="dial-wrapper">
        <tea-timer-dial
          .value=${displaySeconds}
          .bounds=${bounds}
          .interactive=${interactive}
          .status=${status}
          .ariaLabel=${dial?.aria.label ?? STRINGS.dialLabel}
          .valueText=${dialValueText}
          @dial-input=${this._onDialInput}
          @dial-blocked=${this._onDialBlocked}
        >
          <span
            slot="primary"
            data-role="dial-primary"
            ${ref(this._primaryLabelRef)}
          ></span>
          <span slot="secondary">${secondary}</span>
        </tea-timer-dial>
        ${estimation ? html`<p class="estimation" role="note">${estimation}</p>` : nothing}
        ${this._dialTooltipVisible
          ? html`<div class="dial-tooltip" role="status">${STRINGS.dialBlockedTooltip}</div>`
          : nothing}
      </div>
    `;
  }

  private _renderExtendControls(state: TimerViewState) {
    if (!this._viewModel || !this._config) {
      return nothing;
    }

    if (!this._viewModel.ui.showExtendButton) {
      return nothing;
    }

    if (state.status !== "running" && state.status !== "paused") {
      return html`<div class="extend-controls" data-placeholder="true" aria-hidden="true"></div>`;
    }

    const pendingAction = this._viewModel.ui.pendingAction;
    const connectionOk = state.connectionStatus === "connected";
    const hassReady = !!this._hass && !!this._config.entity;
    const hasError = this._isEntityUiError(state.uiState) || this._isUiError(state.uiState, "ServiceFailure");
    const disabled = pendingAction !== "none" || !connectionOk || !hassReady || hasError;
    const busy = this._extendInFlightSeconds > 0 || this._extendServicePromise !== undefined;
    const incrementLabel = this._viewModel.ui.extendIncrementLabel;
    const ariaLabel = STRINGS.extendButtonAriaLabel(
      formatDurationSpeech(this._viewModel.ui.extendIncrementSeconds, STRINGS.durationSpeech),
    );

    return html`
      <div
        class="extend-controls"
        data-busy=${busy ? "true" : "false"}
        data-placeholder="false"
        aria-busy=${busy ? "true" : "false"}
      >
        <button
          type="button"
          class="extend-button"
          aria-label=${ariaLabel}
          ?disabled=${disabled}
          @click=${this._onExtendClick}
        >
          ${incrementLabel}
        </button>
      </div>
    `;
  }

  private _renderPauseResumeControls(state: TimerViewState) {
    if (!this._shouldRenderPauseResume(state)) {
      return nothing;
    }

    if (state.status !== "running" && state.status !== "paused") {
      return html`<div class="pause-resume-controls" data-placeholder="true" aria-hidden="true"></div>`;
    }

    const isPaused = state.status === "paused";
    const label = isPaused ? STRINGS.resumeButtonLabel : STRINGS.pauseButtonLabel;
    const ariaLabel = isPaused ? STRINGS.resumeButtonAriaLabel : STRINGS.pauseButtonAriaLabel;
    const disabled = this._isPauseResumeDisabled(state);
    const busy = this._pauseResumeInFlight !== undefined;

    return html`
      <div
        class="pause-resume-controls"
        data-busy=${busy ? "true" : "false"}
        data-placeholder="false"
        aria-busy=${busy ? "true" : "false"}
      >
        <button
          type="button"
          class="pause-resume-button"
          aria-label=${ariaLabel}
          ?disabled=${disabled}
          @click=${this._onPauseResumeClick}
        >
          ${label}
        </button>
      </div>
    `;
  }

  private _shouldRenderPauseResume(state: TimerViewState): boolean {
    if (!this._viewModel?.ui.showPauseResumeButton) {
      return false;
    }

    if (this._pauseCapability === "unsupported") {
      return false;
    }

    return state.status === "running" || state.status === "paused" || state.status === "idle";
  }

  private _isPauseResumeDisabled(state: TimerViewState): boolean {
    if (!this._config?.entity || !this._hass) {
      return true;
    }

    if (this._pauseCapability === "unsupported") {
      return true;
    }

    if (this._pauseResumeInFlight !== undefined) {
      return true;
    }

    if (state.connectionStatus !== "connected") {
      return true;
    }

    if (this._isEntityUiError(state.uiState)) {
      return true;
    }

    const remaining = this._getPauseRemainingSeconds(state);
    if (remaining === undefined) {
      return true;
    }

    if (state.status === "paused" && remaining <= 0) {
      return true;
    }

    return false;
  }

  private readonly _onPauseResumeClick = (event: Event) => {
    event.stopPropagation();
    void this._handlePauseResume();
  };

  private async _handlePauseResume(): Promise<void> {
    const state = this._timerState ?? this._timerStateController.state;
    if (!state || (state.status !== "running" && state.status !== "paused")) {
      return;
    }

    if (!this._config?.entity || !this._hass) {
      return;
    }

    if (this._pauseCapability === "unsupported") {
      return;
    }

    const action: "pause" | "resume" = state.status === "running" ? "pause" : "resume";
    if (this._pauseResumeInFlight) {
      return;
    }

    this._pauseResumeInFlight = action;

    try {
      if (action === "pause") {
        await this._performPause(state);
      } else {
        await this._performResume(state);
      }
    } catch (error) {
      this._handlePauseResumeFailure(action, error);
    } finally {
      this._pauseResumeInFlight = undefined;
    }
  }

  private async _performPause(state: TimerViewState): Promise<void> {
    if (!this._config?.entity || !this._hass) {
      throw new Error("unsupported");
    }

    if (this._pauseCapability === "native") {
      await pauseTimer(this._hass, this._config.entity);
      return;
    }

    if (this._pauseCapability !== "compat" || !this._pauseHelperEntityId) {
      throw new Error("unsupported");
    }

    const helperState = this._hass.states?.[this._pauseHelperEntityId];
    if (!helperState) {
      throw new Error("helper-missing");
    }

    const remaining = this._getPauseRemainingSeconds(state);
    if (remaining === undefined) {
      throw new Error("remaining-unknown");
    }

    await this._hass.callService("input_text", "set_value", {
      entity_id: this._pauseHelperEntityId,
      value: Math.max(0, Math.round(remaining)),
    });

    await cancelTimer(this._hass, this._config.entity);
  }

  private async _performResume(state: TimerViewState): Promise<void> {
    if (!this._config?.entity || !this._hass) {
      throw new Error("unsupported");
    }

    const previousPendingSeed = this._debugPendingSeedSource;
    this._debugPendingSeedSource = "resume";

    if (this._pauseCapability === "native") {
      try {
        await resumeTimer(this._hass, this._config.entity);
        return;
      } catch (error) {
        this._debugPendingSeedSource = previousPendingSeed;
        throw error;
      }
    }

    if (this._pauseCapability !== "compat" || !this._pauseHelperEntityId) {
      this._debugPendingSeedSource = previousPendingSeed;
      throw new Error("unsupported");
    }

    const helperState = this._hass.states?.[this._pauseHelperEntityId];
    if (!helperState) {
      this._debugPendingSeedSource = previousPendingSeed;
      throw new Error("helper-missing");
    }

    const remaining = this._getPauseRemainingSeconds(state);
    if (remaining === undefined || remaining <= 0) {
      this._debugPendingSeedSource = previousPendingSeed;
      throw new Error("remaining-unknown");
    }

    try {
      await startTimer(this._hass, this._config.entity, Math.max(1, Math.round(remaining)));
      await this._hass.callService("input_text", "set_value", {
        entity_id: this._pauseHelperEntityId,
        value: "",
      });
    } catch (error) {
      this._debugPendingSeedSource = previousPendingSeed;
      throw error;
    }
  }

  private _handlePauseResumeFailure(action: "pause" | "resume", error: unknown): void {
    if (!this._viewModel) {
      return;
    }

    let message = action === "pause" ? STRINGS.toastPauseFailed : STRINGS.toastResumeFailed;
    if (error instanceof Error) {
      if (error.message === "helper-missing") {
        message = STRINGS.toastPauseHelperMissing;
      } else if (error.message === "remaining-unknown") {
        message = STRINGS.toastPauseRemainingUnknown;
      }
    }

    this._viewModel = setViewModelError(this._viewModel, {
      message,
      code: action === "pause" ? "pause-failed" : "resume-failed",
    });
    this._scheduleErrorClear();
  }

  private _getPauseRemainingSeconds(state: TimerViewState): number | undefined {
    if (state.status === "running") {
      if (state.remainingSeconds !== undefined) {
        return Math.max(0, Math.floor(state.remainingSeconds));
      }

      const effective = this._getEffectiveDisplayRemaining(state);
      if (effective !== undefined) {
        return Math.max(0, Math.floor(effective));
      }

      return undefined;
    }

    if (state.status === "paused") {
      if (state.remainingSeconds !== undefined) {
        return Math.max(0, Math.floor(state.remainingSeconds));
      }

      const helperValue = this._getPauseHelperRemainingFromHass();
      if (helperValue !== undefined) {
        return helperValue;
      }
    }

    return undefined;
  }

  private _getPauseHelperRemainingFromHass(): number | undefined {
    if (!this._pauseHelperEntityId) {
      return undefined;
    }

    const helper = this._hass?.states?.[this._pauseHelperEntityId];
    if (!helper) {
      return undefined;
    }

    const raw = helper.state;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return Math.max(0, Math.round(raw));
    }

    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) {
        return undefined;
      }

      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        return undefined;
      }

      return Math.max(0, Math.round(parsed));
    }

    return undefined;
  }

  private _renderPresets(state?: TimerViewState) {
    if (!this._viewModel) {
      return html`<div class="empty-state">${STRINGS.emptyState}</div>`;
    }

    if (!this._viewModel.ui.hasPresets) {
      return html`<div class="empty-state">${STRINGS.presetsMissing}</div>`;
    }

    const canInteract = state ? this._canInteract(state) : false;
    const presetsDisabled = !canInteract || this._viewModel.ui.pendingAction !== "none";
    const selectedId = this._viewModel.ui.selectedPresetId;
    const queuedId = this._viewModel.ui.queuedPresetId;
    const isCustom = this._viewModel.ui.isCustomDuration;

    return html`
      <div class="presets-section">
        <div class="presets" role="group" aria-label=${STRINGS.presetsGroupLabel}>
          ${this._viewModel.ui.presets.map((preset) => {
            const isSelected = !isCustom && selectedId === preset.id;
            const isQueued = queuedId === preset.id;
            const classNames = [
              "preset-chip",
              isSelected ? "preset-selected" : "",
              isQueued ? "preset-queued" : "",
            ]
              .filter((name) => name)
              .join(" ");
            const ariaPressed = isSelected ? "true" : "false";
            const ariaLabel = `${preset.label} ${preset.durationLabel}`;
            return html`
              <button
                type="button"
                class=${classNames}
                role="button"
                aria-pressed=${ariaPressed}
                aria-disabled=${presetsDisabled ? "true" : "false"}
                ?disabled=${presetsDisabled}
                aria-label=${ariaLabel}
                data-selected=${isSelected ? "true" : "false"}
                data-queued=${isQueued ? "true" : "false"}
                @pointerdown=${(event: PointerEvent) =>
                  this._onPresetPointerDown(event, preset.id)}
                @keydown=${(event: KeyboardEvent) => this._onPresetKeyDown(event, preset.id)}
                @click=${(event: MouseEvent) => this._onPresetClick(event, preset.id)}
              >
                <span class="preset-label">${preset.label}</span>
                <span class="preset-duration">${preset.durationLabel}</span>
              </button>
            `;
          })}
        </div>
        <span
          class=${classMap({
            "preset-custom": true,
            "preset-custom-hidden": !isCustom,
          })}
          role="note"
          aria-hidden=${isCustom ? nothing : "true"}
        >
          ${STRINGS.presetsCustomLabel}
        </span>
      </div>
    `;
  }

  private _renderPrimaryAction(state: TimerViewState) {
    const info = this._getPrimaryActionInfo(state);
    const disabled = this._isActionDisabled(state);
    const ariaDisabled = disabled ? "true" : "false";

    return html`
      <button
        type="button"
        class="primary-action"
        data-action=${info.action}
        data-queued=${info.queued ? "true" : "false"}
        aria-label=${info.ariaLabel}
        aria-disabled=${ariaDisabled}
        ?disabled=${disabled}
        @click=${this._onPrimaryButtonClick}
      >
        <span class="primary-action-label">${info.label}</span>
        <span class="primary-action-duration">${info.durationLabel}</span>
      </button>
    `;
  }

  private _getPrimaryActionInfo(state: TimerViewState) {
    const action = state.status === "running" || state.status === "paused" ? "restart" : "start";
    const durationSeconds = this._getActionDuration();
    const durationLabel = formatDurationSeconds(durationSeconds);
    const durationSpeech = formatDurationSpeech(durationSeconds, STRINGS.durationSpeech);
    const label = action === "start" ? STRINGS.primaryActionStart : STRINGS.primaryActionRestart;

    if (!this._viewModel) {
      const ariaLabel =
        action === "start"
          ? STRINGS.primaryActionStartLabel(durationSpeech)
          : STRINGS.primaryActionRestartLabel(durationSpeech);
      return {
        action,
        ariaLabel,
        durationLabel,
        durationSpeech,
        durationSeconds,
        label,
        queued: false,
        presetId: undefined as number | typeof CUSTOM_PRESET_ID | undefined,
        isCustom: false,
        presetLabel: undefined as string | undefined,
      };
    }

    let presetLabel: string | undefined;
    let presetId: number | typeof CUSTOM_PRESET_ID | undefined = undefined;
    let isCustom = false;
    let queued = false;

    const queuedId = this._viewModel.ui.queuedPresetId;
    if (state.status === "running") {
      if (typeof queuedId === "number") {
        const queuedPreset = getPresetById(this._viewModel, queuedId);
        if (queuedPreset) {
          presetLabel = queuedPreset.label;
          presetId = queuedPreset.id;
          queued = true;
        }
      } else if (queuedId === CUSTOM_PRESET_ID) {
        presetId = CUSTOM_PRESET_ID;
        queued = true;
        isCustom = true;
      }
    }

    if (!presetLabel) {
      const selectedId = this._viewModel.ui.selectedPresetId;
      if (typeof selectedId === "number") {
        const preset = getPresetById(this._viewModel, selectedId);
        if (preset) {
          presetLabel = preset.label;
          presetId = preset.id;
        }
      } else if (selectedId === CUSTOM_PRESET_ID || this._viewModel.ui.isCustomDuration) {
        presetId = CUSTOM_PRESET_ID;
        isCustom = true;
      }
    }

    const ariaLabel =
      action === "start"
        ? STRINGS.primaryActionStartLabel(durationSpeech, presetLabel, queued)
        : STRINGS.primaryActionRestartLabel(durationSpeech, presetLabel, queued);

    return {
      action,
      ariaLabel,
      durationLabel,
      durationSpeech,
      durationSeconds,
      label,
      queued,
      presetId,
      isCustom,
      presetLabel,
    };
  }

  private _resolveRunDurationSeconds(state: TimerViewState): number {
    const candidates = [
      state.durationSeconds,
      state.remainingSeconds,
      this._displayDurationSeconds,
      this._viewModel?.pendingDurationSeconds,
      this._viewModel?.selectedDurationSeconds,
    ];

    for (const candidate of candidates) {
      if (candidate !== undefined) {
        return Math.max(0, Math.floor(candidate));
      }
    }

    return this._getActionDuration();
  }

  private _onPresetClick(event: MouseEvent, presetId: number) {
    event.stopPropagation();
    if (event.detail > 0 && this._lastPointerPresetId === presetId) {
      event.preventDefault();
      this._lastPointerPresetId = undefined;
      return;
    }

    if (event.detail === 0 && this._lastKeyboardPresetId === presetId) {
      event.preventDefault();
      this._lastKeyboardPresetId = undefined;
      return;
    }

    this._lastPointerPresetId = undefined;
    this._lastKeyboardPresetId = undefined;
    if (!this._viewModel) {
      return;
    }

    const state = this._timerState ?? this._timerStateController.state;

    if (state.status === "running") {
      if (this._viewModel.ui.queuedPresetId === presetId) {
        this._viewModel = clearQueuedPreset(this._viewModel);
        this._announceQueuedPresetUpdate();
        return;
      }

      if (
        this._viewModel.ui.selectedPresetId === presetId &&
        this._viewModel.ui.queuedPresetId === undefined
      ) {
        this._viewModel = clearQueuedPreset(this._viewModel);
        this._announceQueuedPresetUpdate();
        return;
      }

      this._viewModel = queuePresetSelection(this._viewModel, presetId);
      this._announceQueuedPresetUpdate();
      return;
    }

    this._viewModel = applyPresetSelection(this._viewModel, presetId);
    this._setDisplayDurationSeconds(this._viewModel.selectedDurationSeconds);
  }

  private _onPresetPointerDown(event: PointerEvent, presetId: number) {
    if (event.button !== undefined && event.button !== 0 && event.pointerType !== "touch") {
      return;
    }

    if (event.isPrimary === false) {
      return;
    }

    const state = this._timerState ?? this._timerStateController.state;
    if (!this._canInteract(state) || this._viewModel?.ui.pendingAction !== "none") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget as HTMLButtonElement | null;
    target?.focus();

    this._lastPointerPresetId = presetId;
    this._lastKeyboardPresetId = undefined;
    this._activatePreset(presetId);
  }

  private _onPresetKeyDown(event: KeyboardEvent, presetId: number) {
    if (event.key !== " " && event.key !== "Spacebar" && event.key !== "Enter") {
      return;
    }

    const state = this._timerState ?? this._timerStateController.state;
    if (!this._canInteract(state) || this._viewModel?.ui.pendingAction !== "none") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this._lastPointerPresetId = undefined;
    this._lastKeyboardPresetId = presetId;
    this._activatePreset(presetId);
  }

  private _activatePreset(presetId: number) {
    if (!this._viewModel) {
      return;
    }

    const state = this._timerState ?? this._timerStateController.state;

    if (!this._canInteract(state)) {
      return;
    }

    if (state.status === "running") {
      if (this._viewModel.ui.queuedPresetId === presetId) {
        this._viewModel = clearQueuedPreset(this._viewModel);
        this._announceQueuedPresetUpdate();
        return;
      }

      if (
        this._viewModel.ui.selectedPresetId === presetId &&
        this._viewModel.ui.queuedPresetId === undefined
      ) {
        this._viewModel = clearQueuedPreset(this._viewModel);
        this._announceQueuedPresetUpdate();
        return;
      }

      this._viewModel = queuePresetSelection(this._viewModel, presetId);
      this._announceQueuedPresetUpdate();
      return;
    }

    this._viewModel = applyPresetSelection(this._viewModel, presetId);
    this._setDisplayDurationSeconds(this._viewModel.selectedDurationSeconds);
  }

  private _applyQueuedPresetSelection() {
    if (!this._viewModel) {
      return;
    }

    if (this._viewModel.ui.queuedPresetId !== undefined) {
      this._viewModel = applyQueuedPreset(this._viewModel);
      this._announceQueuedPresetUpdate();
    }
  }

  private _renderPendingOverlay(state?: TimerViewState) {
    const pendingAction = this._viewModel?.ui.pendingAction ?? "none";
    const overlayAction = pendingAction !== "none" ? pendingAction : state?.inFlightAction?.kind ?? "none";
    if (overlayAction === "none") {
      return nothing;
    }

    const label = overlayAction === "start" ? STRINGS.pendingStartLabel : STRINGS.pendingRestartLabel;
    return html`
      <div class="action-overlay" role="status" aria-live="polite">
        <span class="spinner" aria-hidden="true"></span>
        <span>${label}</span>
      </div>
    `;
  }

  private _renderRestartConfirm() {
    const durationSeconds = this._confirmRestartDuration ?? this._getActionDuration();
    const durationLabel = formatDurationSeconds(durationSeconds);
    const message = STRINGS.restartConfirmMessage(durationLabel);
    return html`
      <div
        class="confirm-overlay"
        role="dialog"
        aria-modal="true"
        aria-label=${message}
        @click=${this._onConfirmOverlayClick}
      >
        <div class="confirm-surface" role="document" @click=${this._stopPropagation}>
          <p class="confirm-message">${message}</p>
          <div class="confirm-actions">
            <button type="button" class="confirm-primary" @click=${this._onConfirmRestart}>
              ${STRINGS.restartConfirmConfirm}
            </button>
            <button type="button" class="confirm-secondary" @click=${this._onCancelRestart}>
              ${STRINGS.restartConfirmCancel}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private _renderToast() {
    const error = this._viewModel?.ui.error;
    if (!error?.message) {
      return nothing;
    }

    const isUnavailable = error.code === "entity-unavailable";
    const tone = isUnavailable ? "info" : "error";
    const role = isUnavailable ? "alert" : "status";
    const ariaLive = isUnavailable ? "assertive" : "polite";
    return html`
      <div class="toast toast-${tone}" role=${role} aria-live=${ariaLive}>
        ${error.message}
      </div>
    `;
  }

  private _renderEntityError(info: EntityErrorInfo) {
    return html`
      <div class="entity-error" role="alert" aria-live="assertive">
        <p class="entity-error-message">${info.message}</p>
      </div>
    `;
  }

  private _renderStatusPill(state: TimerViewState) {
    const label = this._getStatusLabel(state);
    const className = this._getStatusClass(state);
    return html`<span class=${className} aria-hidden="true">${label}</span>`;
  }

  private _renderStateBanner(state: TimerViewState) {
    const banner = this._getUiStateBanner(state);
    if (!banner) {
      return nothing;
    }

    const { message, tone, live, role } = banner;
    return html`
      <div class="state-banner state-banner-${tone}" role=${role} aria-live=${live}>
        ${message}
      </div>
    `;
  }

  private _getUiStateBanner(
    state: TimerViewState,
  ): { message: string; tone: "info" | "warn" | "error"; live: "polite" | "assertive"; role: "status" | "alert" } | null {
    const uiState = state.uiState;
    if (this._isUiError(uiState, "Disconnected")) {
      const message =
        state.connectionStatus === "reconnecting"
          ? STRINGS.disconnectedReconnectingMessage
          : STRINGS.disconnectedMessage;
      return { message, tone: "warn", live: "polite", role: "status" };
    }

    if (this._isUiError(uiState, "ServiceFailure")) {
      const message = uiState.detail ?? STRINGS.serviceFailureMessage;
      return { message, tone: "error", live: "polite", role: "status" };
    }

    return null;
  }

  private _getEntityErrorInfo(uiState: TimerUiState): EntityErrorInfo | undefined {
    if (!this._isUiError(uiState)) {
      return undefined;
    }

    switch (uiState.reason) {
      case "EntityConfigMissing":
        return { message: STRINGS.entityErrorMissing };
      case "EntityWrongDomain":
        return { message: STRINGS.entityErrorInvalid(uiState.detail) };
      case "EntityNotFound":
        return { message: STRINGS.entityErrorInvalid(uiState.detail) };
      case "EntityUnavailable":
        return { message: STRINGS.entityErrorUnavailable(uiState.detail) };
      default:
        return undefined;
    }
  }

  private readonly _onExtendClick = (event: Event) => {
    event.stopPropagation();
    this._handleExtendAction();
  };

  private readonly _onPrimaryButtonClick = (event: Event) => {
    event.stopPropagation();
    this._handlePrimaryAction();
  };

  private readonly _onCardClick = (event: MouseEvent) => {
    if (event.defaultPrevented || this._confirmRestartVisible) {
      return;
    }

    if (this._shouldIgnoreCardClick(event)) {
      return;
    }

    const state = this._timerState ?? this._timerStateController.state;
    if (!state || state.status !== "idle") {
      return;
    }

    if (!this._viewModel?.ui.cardBodyTapStart) {
      return;
    }

    this._handlePrimaryAction();
  };

  private _shouldIgnoreCardClick(event: MouseEvent): boolean {
    const path = event.composedPath();
    for (const node of path) {
      if (!(node instanceof HTMLElement)) {
        continue;
      }

      if (node === this) {
        break;
      }

      const tagName = node.tagName.toLowerCase();
      if (tagName === "a" || tagName === "button") {
        return true;
      }

      const role = node.getAttribute("role");
      if (role === "button") {
        return true;
      }
    }

    return false;
  }

  private _handlePrimaryAction(): void {
    if (!this._viewModel || !this._config?.entity) {
      return;
    }

    if (!this._hass) {
      return;
    }

    if (this._viewModel.ui.pendingAction !== "none") {
      return;
    }

    const state = this._timerState ?? this._timerStateController.state;
    if (!state) {
      return;
    }

    if (!this._canInteract(state)) {
      if (this._isUiError(state.uiState, "EntityUnavailable")) {
        this._showEntityUnavailableToast();
      }
      return;
    }

    const durationSeconds = this._getActionDuration();

    if (state.status === "running" || state.status === "paused") {
      if (this._viewModel.ui.confirmRestart) {
        this._confirmRestartDuration = durationSeconds;
        this._confirmRestartVisible = true;
        return;
      }

      this._applyQueuedPresetSelection();
      void this._restartTimerAction(durationSeconds);
      return;
    }

    void this._startTimerAction(durationSeconds);
  }

  private _handleExtendAction(): void {
    if (!this._viewModel || !this._config?.entity || !this._hass) {
      return;
    }

    if (!this._viewModel.ui.showExtendButton) {
      return;
    }

    const state = this._timerState ?? this._timerStateController.state;
    if (!state || (state.status !== "running" && state.status !== "paused")) {
      return;
    }

    if (this._viewModel.ui.pendingAction !== "none") {
      return;
    }

    if (state.connectionStatus !== "connected") {
      return;
    }

    if (this._isUiError(state.uiState, "EntityUnavailable")) {
      this._showEntityUnavailableToast();
      return;
    }

    const increment = Math.max(1, Math.floor(this._viewModel.ui.extendIncrementSeconds));
    if (increment <= 0) {
      return;
    }

    const allowance = this._getExtendAllowance();
    if (allowance !== undefined && allowance < increment) {
      this._announce(STRINGS.ariaExtendCapReached);
      return;
    }

    if (state.status === "paused") {
      void this._extendWhilePaused(increment, state);
      return;
    }

    this._ensureExtendRunInitialized(state);
    this._queueExtend(increment, state);
  }

  private _getActionDuration(): number {
    if (!this._viewModel || !this._config) {
      return 0;
    }

    const selected =
      this._viewModel.pendingDurationSeconds ??
      this._viewModel.selectedDurationSeconds ??
      this._viewModel.dial.selectedDurationSeconds;
    return normalizeDurationSeconds(selected, this._config.dialBounds);
  }

  private _seedStartBaseline(kind: "start" | "restart", requestedSeconds: number): void {
    if (!Number.isFinite(requestedSeconds)) {
      this._pendingStartSeed = undefined;
      this._startClamp = undefined;
      return;
    }

    const normalized = Math.max(0, requestedSeconds);
    const monotonicSeed = this._monotonicNow();
    const wallNow = Date.now();
    const baselineEndMonotonicMs = monotonicSeed + normalized * 1000;

    this._pendingStartSeed = {
      requestedSeconds: normalized,
      monotonicSeedMs: monotonicSeed,
      baselineEndMonotonicMs,
      intentWallMs: wallNow,
      intentIso: new Date(wallNow).toISOString(),
      kind,
      localSeedApplied: false,
      warningIssued: false,
    };
    this._startClamp = undefined;
  }

  private _prepareStartBaseline(state: TimerViewState, previousState: TimerViewState | undefined): void {
    const pending = this._pendingStartSeed;
    if (!pending || state.status !== "running") {
      return;
    }

    if (pending.localSeedApplied) {
      return;
    }

    if (
      this._monotonicCountdown.baselineEndMs !== undefined &&
      this._lastServerSyncMonotonicMs !== undefined &&
      this._serverRemainingSeconds !== undefined
    ) {
      return;
    }

    this._serverRemainingSeconds = pending.requestedSeconds;
    this._lastServerSyncMonotonicMs = pending.monotonicSeedMs;
    seedMonotonicBaseline(this._monotonicCountdown, pending.baselineEndMonotonicMs, {
      allowIncrease: true,
    });
    this._startClamp = {
      requestedSeconds: pending.requestedSeconds,
      intentIso: pending.intentIso,
      firstComputedSeconds: pending.requestedSeconds,
      deltaSeconds: 0,
      nowMs: pending.intentWallMs,
      remainingFrames: 2,
    };
    pending.localSeedApplied = true;
    const displaySeconds = Math.max(0, Math.floor(pending.requestedSeconds));
    this._debugHandleSeed(state, previousState, "start", displaySeconds, pending.requestedSeconds);
  }

  private _evaluateStartOutlier(
    state: TimerViewState,
    _previousState: TimerViewState | undefined,
    candidateRemaining: number | undefined,
    baselineEnd: number | undefined,
    seedStartMonotonic: number | undefined,
  ): void {
    const pending = this._pendingStartSeed;
    if (!pending || state.status !== "running") {
      return;
    }

    if (candidateRemaining === undefined || baselineEnd === undefined || seedStartMonotonic === undefined) {
      return;
    }

    const firstComputed = Number.isFinite(candidateRemaining) ? candidateRemaining : Number.NaN;
    if (!Number.isFinite(firstComputed)) {
      this._pendingStartSeed = undefined;
      return;
    }

    const requested = pending.requestedSeconds;
    const delta = firstComputed - requested;
    const isNegative = firstComputed < 0;
    const isHuge = firstComputed > START_OUTLIER_MAX_SECONDS;
    const isOutlier = isNegative || isHuge || Math.abs(delta) > START_FIRST_RENDER_TOLERANCE_S;

    if (isOutlier) {
      const nowMs = Date.now();
      this._startClamp = {
        requestedSeconds: requested,
        intentIso: pending.intentIso,
        firstComputedSeconds: firstComputed,
        deltaSeconds: delta,
        nowMs,
        remainingFrames: 2,
      };
      if (!pending.warningIssued) {
        this._emitStartOutlierWarning({
          requestedSeconds: requested,
          firstComputedSeconds: firstComputed,
          deltaSeconds: delta,
          intentIso: pending.intentIso,
          nowMs,
          entityId: state.entityId ?? this._config?.entity,
        });
        pending.warningIssued = true;
      }
    } else {
      this._startClamp = undefined;
    }

    this._pendingStartSeed = undefined;
  }

  private _applyStartClamp(state: TimerViewState, candidate: number): number {
    const clamp = this._startClamp;
    if (!clamp || state.status !== "running") {
      if (clamp && state.status !== "running") {
        this._startClamp = undefined;
      }
      return candidate;
    }

    const clamped = Math.max(0, Math.floor(clamp.requestedSeconds));
    if (clamp.remainingFrames > 0) {
      clamp.remainingFrames -= 1;
      return clamped;
    }

    this._startClamp = undefined;
    return candidate;
  }

  private _emitStartOutlierWarning(payload: {
    requestedSeconds: number;
    firstComputedSeconds: number;
    deltaSeconds: number;
    intentIso: string;
    nowMs: number;
    entityId?: string;
  }): void {
    reportStartOutlier({
      requestedDurationS: payload.requestedSeconds,
      firstComputedS: payload.firstComputedSeconds,
      deltaS: payload.deltaSeconds,
      intentTsIso: payload.intentIso,
      nowMs: payload.nowMs,
      entityId: payload.entityId,
    });
  }

  private async _startTimerAction(durationSeconds: number): Promise<void> {
    if (!this._viewModel || !this._config?.entity || !this._hass) {
      return;
    }

    if (this._viewModel.ui.pendingAction !== "none") {
      return;
    }

    const registered = this._timerStateController.registerLocalAction("start");
    if (!registered) {
      return;
    }

    this._seedStartBaseline("start", durationSeconds);
    const previousPendingSeed = this._debugPendingSeedSource;
    this._debugPendingSeedSource = "start";
    this._viewModel = setViewModelError(this._viewModel, undefined);
    this._clearErrorTimer();
    this._viewModel = setPendingAction(this._viewModel, "start", registered.ts);
    this._announceAction("start", durationSeconds);

    try {
      await startTimer(this._hass, this._config.entity, durationSeconds);
    } catch {
      this._pendingStartSeed = undefined;
      this._startClamp = undefined;
      this._debugPendingSeedSource = previousPendingSeed;
      this._timerStateController.reportActionFailure(registered.gen, STRINGS.toastStartFailed);
      this._viewModel = clearPendingAction(this._viewModel);
      this._viewModel = setViewModelError(this._viewModel, {
        message: STRINGS.toastStartFailed,
        code: "start-failed",
      });
      this._scheduleErrorClear();
    }
  }

  private async _restartTimerAction(durationSeconds: number): Promise<void> {
    if (!this._viewModel || !this._config?.entity || !this._hass) {
      return;
    }

    if (this._viewModel.ui.pendingAction !== "none") {
      return;
    }

    this._confirmRestartVisible = false;
    this._confirmRestartDuration = undefined;
    this._viewModel = setViewModelError(this._viewModel, undefined);
    this._clearErrorTimer();
    const registered = this._timerStateController.registerLocalAction("restart");
    if (!registered) {
      return;
    }

    this._seedStartBaseline("restart", durationSeconds);
    const previousPendingSeed = this._debugPendingSeedSource;
    this._debugPendingSeedSource = "start";
    this._viewModel = setPendingAction(this._viewModel, "restart", registered.ts);
    this._announceAction("restart", durationSeconds);

    try {
      await restartTimer(this._hass, this._config.entity, durationSeconds);
    } catch {
      this._pendingStartSeed = undefined;
      this._startClamp = undefined;
      this._debugPendingSeedSource = previousPendingSeed;
      this._timerStateController.reportActionFailure(registered.gen, STRINGS.toastRestartFailed);
      this._viewModel = clearPendingAction(this._viewModel);
      this._viewModel = setViewModelError(this._viewModel, {
        message: STRINGS.toastRestartFailed,
        code: "restart-failed",
      });
      this._scheduleErrorClear();
    }
  }

  private _announceAction(action: PendingTimerAction, durationSeconds: number): void {
    if (action === "none") {
      return;
    }

    this._announcer.beginRun(durationSeconds);
    const message = this._announcer.announceAction({ action, durationSeconds });
    this._announce(message);
  }

  private _getExtendAllowance(): number | undefined {
    if (!this._viewModel) {
      return undefined;
    }

    const limit = this._viewModel.ui.maxExtendSeconds;
    if (limit === undefined) {
      return undefined;
    }

    return Math.max(0, limit - this._extendAccumulatedSeconds);
  }

  private _ensureExtendRunInitialized(state: TimerViewState): void {
    if (state.status !== "running") {
      return;
    }

    if (this._extendRunGeneration === undefined) {
      this._extendRunGeneration = state.actionGeneration;
    }

    if (this._extendRunTotalSeconds === undefined) {
      this._extendRunTotalSeconds = this._resolveRunDurationSeconds(state);
    }
  }

  private _queueExtend(increment: number, state: TimerViewState): void {
    const baseline = this._getEffectiveDisplayRemaining(state) ?? this._resolveRunDurationSeconds(state) ?? 0;

    if (this._extendPendingSeconds === 0) {
      this._extendBatchBaseRemaining = baseline;
    }

    const nextRemaining = baseline + increment;
    this._extendPendingSeconds += increment;
    this._extendAccumulatedSeconds += increment;

    const totalBase = this._extendRunTotalSeconds ?? this._resolveRunDurationSeconds(state) ?? 0;
    this._extendRunTotalSeconds = totalBase + increment;

    const nowMonotonic = this._monotonicNow();
    const remainingSeconds = Math.max(0, nextRemaining);
    this._serverRemainingSeconds = Math.max(0, Math.floor(remainingSeconds));
    this._lastServerSyncMonotonicMs = nowMonotonic;
    seedMonotonicBaseline(this._monotonicCountdown, nowMonotonic + remainingSeconds * 1000, {
      allowIncrease: true,
    });
    this._setDisplayDurationSeconds(Math.max(0, Math.floor(remainingSeconds)));
    this._announceExtend(increment, nextRemaining);
    this._startCountdownAnimation();

    if (this._extendCoalesceTimer !== undefined) {
      clearTimeout(this._extendCoalesceTimer);
    }

    this._extendCoalesceTimer = window.setTimeout(() => {
      this._extendCoalesceTimer = undefined;
      this._flushExtendQueue();
    }, EXTEND_COALESCE_DELAY_MS);
  }

  private _flushExtendQueue(): void {
    if (this._extendServicePromise) {
      return;
    }

    if (!this._config?.entity || !this._hass) {
      this._extendPendingSeconds = 0;
      return;
    }

    const seconds = this._extendPendingSeconds;
    if (seconds <= 0) {
      return;
    }

    this._extendPendingSeconds = 0;
    const batchBase = this._extendBatchBaseRemaining;
    this._extendBatchBaseRemaining = undefined;
    this._extendInFlightSeconds = seconds;

    this._extendServicePromise = this._performExtend(seconds, batchBase)
      .catch(() => {
        this._handleExtendFailure(seconds);
      })
      .finally(() => {
        this._extendInFlightSeconds = 0;
        this._extendServicePromise = undefined;
        if (this._extendPendingSeconds > 0) {
          this._flushExtendQueue();
        }
      });
  }

  private async _extendWhilePaused(increment: number, state: TimerViewState): Promise<void> {
    if (!this._config?.entity || !this._hass) {
      return;
    }

    const remaining = this._getPauseRemainingSeconds(state);
    if (remaining === undefined) {
      if (this._viewModel) {
        this._viewModel = setViewModelError(this._viewModel, {
          message: STRINGS.toastPauseRemainingUnknown,
          code: "extend-failed",
        });
        this._scheduleErrorClear();
      }
      return;
    }

    const next = Math.max(0, Math.floor(remaining + increment));

    if (this._pauseCapability === "native") {
      try {
        await changeTimer(this._hass, this._config.entity, increment);
        return;
      } catch (error) {
        if (this._viewModel) {
          this._viewModel = setViewModelError(this._viewModel, {
            message: STRINGS.toastExtendFailed,
            code: "extend-failed",
          });
          this._scheduleErrorClear();
        }
      }
      return;
    }

    if (this._pauseCapability !== "compat" || !this._pauseHelperEntityId) {
      if (this._viewModel) {
        this._viewModel = setViewModelError(this._viewModel, {
          message: STRINGS.toastExtendFailed,
          code: "extend-failed",
        });
        this._scheduleErrorClear();
      }
      return;
    }

    try {
      await this._hass.callService("input_text", "set_value", {
        entity_id: this._pauseHelperEntityId,
        value: next,
      });
      this._serverRemainingSeconds = next;
      this._lastServerSyncMonotonicMs = undefined;
      seedMonotonicBaseline(this._monotonicCountdown, undefined);
      this._setDisplayDurationSeconds(next);
      this._announceExtend(increment, next);
    } catch (error) {
      if (this._viewModel) {
        this._viewModel = setViewModelError(this._viewModel, {
          message: STRINGS.toastExtendFailed,
          code: "extend-failed",
        });
        this._scheduleErrorClear();
      }
    }
  }

  private async _performExtend(seconds: number, batchBaseRemaining?: number): Promise<void> {
    if (!this._config?.entity || !this._hass) {
      return;
    }

    const state = this._timerState ?? this._timerStateController.state;
    if (!state || state.status !== "running") {
      return;
    }

    const baseline =
      batchBaseRemaining !== undefined
        ? batchBaseRemaining
        : Math.max(0, (this._getEffectiveDisplayRemaining(state) ?? 0) - seconds);
    const targetRemaining = Math.max(0, baseline + seconds);

    const durationLimit = state.durationSeconds ?? this._extendRunTotalSeconds;
    const canUseChange = supportsTimerChange(this._hass) && durationLimit !== undefined && targetRemaining <= durationLimit;

    if (canUseChange) {
      try {
        await changeTimer(this._hass, this._config.entity, seconds);
        return;
      } catch {
        // Fallback to restart semantics if timer.change is unsupported or fails.
      }
    }

    const newDuration = Math.max(1, Math.round(targetRemaining));
    this._extendPendingRestartGeneration = (state.actionGeneration ?? 0) + 1;
    await restartTimer(this._hass, this._config.entity, newDuration);
  }

  private _handleExtendFailure(seconds: number): void {
    this._extendAccumulatedSeconds = Math.max(0, this._extendAccumulatedSeconds - seconds);
    if (this._extendRunTotalSeconds !== undefined) {
      const next = this._extendRunTotalSeconds - seconds;
      this._extendRunTotalSeconds = next > 0 ? next : undefined;
    }
    this._extendBatchBaseRemaining = undefined;
    this._extendPendingRestartGeneration = undefined;
    this._serverRemainingSeconds = undefined;
    this._lastServerSyncMonotonicMs = undefined;
    seedMonotonicBaseline(this._monotonicCountdown, undefined);
    if (this._extendCoalesceTimer !== undefined) {
      clearTimeout(this._extendCoalesceTimer);
      this._extendCoalesceTimer = undefined;
    }

    if (this._viewModel) {
      this._viewModel = setViewModelError(this._viewModel, {
        message: STRINGS.toastExtendFailed,
        code: "extend-failed",
      });
      this._scheduleErrorClear();
    }
  }

  private _announceExtend(incrementSeconds: number, remainingSeconds: number): void {
    const durationSpeech = formatDurationSpeech(incrementSeconds, STRINGS.durationSpeech);
    const remainingLabel = formatDurationSeconds(Math.max(0, Math.floor(remainingSeconds)));
    this._announce(STRINGS.ariaExtendAdded(durationSpeech, remainingLabel));
  }

  private _getEffectiveDisplayRemaining(state: TimerViewState): number | undefined {
    if (state.status !== "running") {
      return this._displayDurationSeconds ?? state.remainingSeconds;
    }

    if (this._monotonicCountdown.baselineEndMs !== undefined) {
      const remaining = monotonicRemainingMs(this._monotonicCountdown);
      if (remaining !== undefined) {
        return Math.floor(remaining / 1000);
      }
    }

    if (this._displayDurationSeconds !== undefined) {
      return this._displayDurationSeconds;
    }

    if (state.remainingSeconds !== undefined) {
      return state.remainingSeconds;
    }

    return this._resolveRunDurationSeconds(state);
  }

  private _updateExtendTracking(state: TimerViewState, previousState?: TimerViewState): void {
    if (!this._viewModel?.ui.showExtendButton) {
      if (state.status !== "running") {
        this._resetExtendTracking();
      }
      return;
    }

    if (state.status !== "running") {
      if (previousState?.status === "running" && (this._extendPendingSeconds > 0 || this._extendInFlightSeconds > 0)) {
        this._announce(STRINGS.ariaExtendRaceLost);
      }
      this._resetExtendTracking();
      return;
    }

    if (this._extendRunGeneration === undefined) {
      this._extendRunGeneration = state.actionGeneration;
      this._extendRunTotalSeconds = this._resolveRunDurationSeconds(state);
      this._extendPendingSeconds = 0;
      this._extendAccumulatedSeconds = 0;
      this._extendBatchBaseRemaining = undefined;
      return;
    }

    if (state.actionGeneration !== this._extendRunGeneration) {
      if (
        this._extendPendingRestartGeneration !== undefined &&
        state.actionGeneration === this._extendPendingRestartGeneration
      ) {
        this._extendRunGeneration = state.actionGeneration;
        this._extendPendingRestartGeneration = undefined;
      } else {
        this._extendRunGeneration = state.actionGeneration;
        this._extendRunTotalSeconds = this._resolveRunDurationSeconds(state);
        this._extendPendingSeconds = 0;
        this._extendAccumulatedSeconds = 0;
        this._extendBatchBaseRemaining = undefined;
      }
    }

    if (state.durationSeconds !== undefined) {
      if (this._extendRunTotalSeconds === undefined || state.durationSeconds > this._extendRunTotalSeconds) {
        this._extendRunTotalSeconds = state.durationSeconds;
      }
    }
  }

  private _resetExtendTracking(): void {
    if (this._extendPendingSeconds !== 0) {
      this._extendPendingSeconds = 0;
    }
    if (this._extendAccumulatedSeconds !== 0) {
      this._extendAccumulatedSeconds = 0;
    }
    this._extendRunGeneration = undefined;
    this._extendRunTotalSeconds = undefined;
    this._extendPendingRestartGeneration = undefined;
    this._extendBatchBaseRemaining = undefined;
    this._extendInFlightSeconds = 0;
    if (this._extendCoalesceTimer !== undefined) {
      clearTimeout(this._extendCoalesceTimer);
      this._extendCoalesceTimer = undefined;
    }
  }

  private _showEntityUnavailableToast(): void {
    if (!this._viewModel || !this._config?.entity) {
      return;
    }

    this._viewModel = setViewModelError(this._viewModel, {
      message: STRINGS.toastEntityUnavailable(this._config.entity),
      code: "entity-unavailable",
    });
    this._scheduleErrorClear();
  }

  private readonly _onConfirmOverlayClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (event.target === event.currentTarget) {
      this._onCancelRestart();
    }
  };

  private readonly _stopPropagation = (event: Event) => {
    event.stopPropagation();
  };

  private readonly _onConfirmRestart = () => {
    if (this._confirmRestartDuration === undefined) {
      this._confirmRestartVisible = false;
      return;
    }

    this._applyQueuedPresetSelection();
    void this._restartTimerAction(this._confirmRestartDuration);
  };

  private readonly _onCancelRestart = () => {
    this._confirmRestartVisible = false;
    this._confirmRestartDuration = undefined;
  };

  private _scheduleErrorClear(): void {
    this._clearErrorTimer();
    if (!this._viewModel?.ui.error) {
      return;
    }

    this._errorTimer = window.setTimeout(() => {
      if (this._viewModel) {
        this._viewModel = setViewModelError(this._viewModel, undefined);
      }
      this._errorTimer = undefined;
    }, 4000);
  }

  private _clearErrorTimer(): void {
    if (this._errorTimer !== undefined) {
      clearTimeout(this._errorTimer);
      this._errorTimer = undefined;
    }
  }

  private _getPrimaryDialLabel(state: TimerViewState, displaySeconds?: number): string {
    if (state.status === "finished") {
      return STRINGS.timerFinished;
    }

    if (state.status === "running" || state.status === "paused") {
      const seconds =
        displaySeconds ??
        this._displayDurationSeconds ??
        state.remainingSeconds ??
        state.durationSeconds;
      if (seconds !== undefined) {
        return formatDurationSeconds(seconds);
      }
      return STRINGS.timeUnknown;
    }

    if (state.status === "idle") {
      const seconds = displaySeconds ?? this._displayDurationSeconds ?? state.durationSeconds;
      if (seconds !== undefined) {
        return formatDurationSeconds(seconds);
      }
      return STRINGS.timeUnknown;
    }

    return STRINGS.timerUnavailable;
  }

  private _getSecondaryDialLabel(state: TimerViewState): string {
    const uiState = state.uiState;
    if (this._isEntityUiError(uiState)) {
      const entity = state.entityId ?? this._config?.entity;
      if (uiState.reason === "EntityUnavailable" && entity) {
        return STRINGS.entityUnavailableWithId(entity);
      }
      return STRINGS.statusUnavailable;
    }

    if (this._isUiError(uiState, "Disconnected")) {
      return state.connectionStatus === "reconnecting"
        ? STRINGS.statusReconnecting
        : STRINGS.statusDisconnected;
    }

    if (this._isUiError(uiState, "ServiceFailure")) {
      return STRINGS.statusError;
    }

    return this._getStatusLabel(state);
  }

  private _getStatusLabel(state: TimerViewState): string {
    const uiState = state.uiState;
    if (uiState === "Idle") {
      return STRINGS.statusIdle;
    }
    if (uiState === "Running") {
      return STRINGS.statusRunning;
    }
    if (uiState === "Paused") {
      return STRINGS.statusPaused;
    }
    if (typeof uiState === "object") {
      if (uiState.kind === "FinishedTransient") {
        return STRINGS.statusFinished;
      }
      switch (uiState.reason) {
        case "Disconnected":
          return state.connectionStatus === "reconnecting"
            ? STRINGS.statusReconnecting
            : STRINGS.statusDisconnected;
        case "EntityConfigMissing":
        case "EntityWrongDomain":
        case "EntityNotFound":
        case "EntityUnavailable":
          return STRINGS.statusUnavailable;
        case "ServiceFailure":
          return STRINGS.statusError;
        default:
          break;
      }
    }

    switch (state.status) {
      case "idle":
        return STRINGS.statusIdle;
      case "running":
        return STRINGS.statusRunning;
      case "paused":
        return STRINGS.statusPaused;
      case "finished":
        return STRINGS.statusFinished;
      default:
        return STRINGS.statusUnavailable;
    }
  }

  private _getStatusClass(state: TimerViewState): string {
    const uiState = state.uiState;
    if (uiState === "Running") {
      return "status-pill status-running";
    }
    if (uiState === "Paused") {
      return "status-pill status-paused";
    }
    if (uiState === "Idle") {
      return "status-pill status-idle";
    }
    if (typeof uiState === "object") {
      if (uiState.kind === "FinishedTransient") {
        return "status-pill status-finished";
      }
      if (uiState.reason === "Disconnected") {
        return "status-pill status-disconnected";
      }
      if (
        uiState.reason === "EntityUnavailable" ||
        uiState.reason === "EntityConfigMissing" ||
        uiState.reason === "EntityWrongDomain" ||
        uiState.reason === "EntityNotFound"
      ) {
        return "status-pill status-unavailable";
      }
      if (uiState.reason === "ServiceFailure") {
        return "status-pill status-error";
      }
    }

    switch (state.status) {
      case "running":
        return "status-pill status-running";
      case "paused":
        return "status-pill status-paused";
      case "finished":
        return "status-pill status-finished";
      case "idle":
        return "status-pill status-idle";
      default:
        return "status-pill status-unavailable";
    }
  }

  private _isUiError(
    uiState: TimerUiState,
    reason?: TimerUiErrorReason,
  ): uiState is Extract<TimerUiState, { kind: "Error" }> {
    if (typeof uiState !== "object" || uiState.kind !== "Error") {
      return false;
    }

    if (!reason) {
      return true;
    }

    return uiState.reason === reason;
  }

  private _isEntityUiError(
    uiState: TimerUiState,
  ): uiState is Extract<TimerUiState, { kind: "Error" }> {
    if (!this._isUiError(uiState)) {
      return false;
    }

    switch (uiState.reason) {
      case "EntityConfigMissing":
      case "EntityWrongDomain":
      case "EntityNotFound":
      case "EntityUnavailable":
        return true;
      default:
        return false;
    }
  }

  private _canInteract(state: TimerViewState | undefined): boolean {
    if (!state) {
      return false;
    }

    if (state.connectionStatus !== "connected") {
      return false;
    }

    if (this._isEntityUiError(state.uiState)) {
      return false;
    }

    return true;
  }

  private _isActionDisabled(state: TimerViewState): boolean {
    if (!this._viewModel) {
      return true;
    }

    if (this._viewModel.ui.pendingAction !== "none") {
      return true;
    }

    if (!this._canInteract(state)) {
      return true;
    }

    return false;
  }

  private _getEstimationNotice(state: TimerViewState): string | null {
    if (!state.remainingIsEstimated) {
      return null;
    }

    if ((state.estimationDriftSeconds ?? 0) <= 2) {
      return null;
    }

    return STRINGS.remainingEstimateNotice;
  }

  private _handleAnnouncements(
    state: TimerViewState,
    previousState: TimerViewState | undefined,
    previousViewModel: TeaTimerViewModel | undefined,
  ) {
    if (!this._viewModel) {
      this._announcer.reset();
      return;
    }

    const statusChanged = state.status !== previousState?.status;

    if (statusChanged) {
      switch (state.status) {
        case "running": {
          const wasPaused = previousState?.status === "paused";
          const previousAction = previousViewModel?.ui.pendingAction ?? "none";
          const durationSeconds = this._resolveRunDurationSeconds(state);
          const initialSeconds = state.remainingSeconds ?? durationSeconds;
          this._announcer.beginRun(initialSeconds);
          if (wasPaused) {
            this._announce(STRINGS.ariaResumedAnnouncement);
          } else if (previousAction !== "start" && previousAction !== "restart") {
            const message = this._announcer.announceAction({
              action: "start",
              durationSeconds,
            });
            this._announce(message);
          }
          break;
        }
        case "paused": {
          this._announce(STRINGS.ariaPausedAnnouncement);
          break;
        }
        case "finished": {
          const durationSeconds = this._resolveRunDurationSeconds(state);
          const message = this._announcer.announceFinished(durationSeconds);
          this._announcer.endRun();
          this._announce(message);
          break;
        }
        case "idle": {
          this._announcer.endRun();
          this._announce(STRINGS.ariaIdle);
          break;
        }
        case "unavailable":
        default: {
          this._announcer.endRun();
          this._announce(STRINGS.ariaUnavailable);
          break;
        }
      }
    }

    if (state.status === "running") {
      const queuedId = this._viewModel.ui.queuedPresetId;
      const announcement = this._announcer.announceQueuedPreset({
        id: typeof queuedId === "number" ? queuedId : queuedId === CUSTOM_PRESET_ID ? "custom" : undefined,
        label:
          typeof queuedId === "number"
            ? getPresetById(this._viewModel, queuedId)?.label
            : undefined,
        durationSeconds: this._viewModel.pendingDurationSeconds,
        isCustom: queuedId === CUSTOM_PRESET_ID || this._viewModel.ui.isCustomDuration,
      });
      if (announcement) {
        this._announce(announcement);
      }
    } else if (previousViewModel?.ui.queuedPresetId !== undefined) {
      this._announcer.announceQueuedPreset({ id: undefined, durationSeconds: 0, isCustom: false });
    }
  }

  private _announceQueuedPresetUpdate(): void {
    const state = this._timerState ?? this._timerStateController.state;
    if (!state || state.status !== "running" || !this._viewModel) {
      return;
    }

    const queuedId = this._viewModel.ui.queuedPresetId;
    const announcement = this._announcer.announceQueuedPreset({
      id: typeof queuedId === "number" ? queuedId : queuedId === CUSTOM_PRESET_ID ? "custom" : undefined,
      label:
        typeof queuedId === "number"
          ? getPresetById(this._viewModel, queuedId)?.label
          : undefined,
      durationSeconds: this._viewModel.pendingDurationSeconds,
      isCustom: queuedId === CUSTOM_PRESET_ID,
    });

    if (announcement) {
      this._announce(announcement);
    }
  }

  private _handleTimerStateChanged(state: TimerViewState) {
    const previousState = this._previousTimerState;
    const previousViewModel = this._viewModel;
    this._evaluatePauseCapability();
    if (this._confirmRestartVisible && state.status !== "running") {
      this._confirmRestartVisible = false;
      this._confirmRestartDuration = undefined;
    }
    this._timerState = state;
    this._updateExtendTracking(state, previousState);
    if (this._config) {
      this._viewModel = createTeaTimerViewModel(this._config, state, {
        previousState,
        previousViewModel,
      });
    }

    if (this._viewModel) {
      const inFlight = state.inFlightAction?.kind ?? "none";
      const currentPending = this._viewModel.ui.pendingAction ?? "none";
      if (inFlight !== "none") {
        if (currentPending !== inFlight) {
          this._viewModel = setPendingAction(
            this._viewModel,
            inFlight,
            state.inFlightAction?.ts ?? Date.now(),
          );
        }
      } else if (currentPending !== "none") {
        this._viewModel = clearPendingAction(this._viewModel);
      }

      if (previousViewModel?.ui.error) {
        this._viewModel = setViewModelError(this._viewModel, undefined);
        this._clearErrorTimer();
      }

      if (
        previousViewModel?.ui.queuedPresetId !== undefined &&
        previousState?.status === "running" &&
        state.status !== "running" &&
        this._viewModel.ui.queuedPresetId !== undefined
      ) {
        this._viewModel = applyQueuedPreset(this._viewModel);
      }
    }

    this._handleAnnouncements(state, previousState, previousViewModel);
    this._updateRunningTickState(state, previousState);
    this._previousTimerState = state;
    this._syncDisplayDuration(state);
    this._scheduleApplyDialDisplay("state-change");
  }

  private readonly _onDialInput = (event: CustomEvent<{ value: number }>) => {
    event.stopPropagation();
    if (!this._viewModel) {
      return;
    }

    const bounds =
      this._viewModel.dial?.bounds ??
      this._config?.dialBounds ??
      { min: 0, max: 0, step: 1 };
    const value = normalizeDurationSeconds(event.detail.value, bounds);
    const state = this._timerState ?? this._timerStateController.state;

    if (!this._canInteract(state) || this._viewModel.ui.pendingAction !== "none") {
      return;
    }

    this._setDisplayDurationSeconds(value);
    this._viewModel = updateDialSelection(this._viewModel, value);
    this._scheduleApplyDialDisplay("dial-input");
  };

  private readonly _onDialBlocked = (event: Event) => {
    event.stopPropagation();
    this._dialTooltipVisible = true;
    this._clearDialTooltipTimer();
    this._dialTooltipTimer = window.setTimeout(() => {
      this._dialTooltipVisible = false;
      this._dialTooltipTimer = undefined;
    }, 1800);
  };

  private _clearDialTooltipTimer() {
    if (this._dialTooltipTimer !== undefined) {
      clearTimeout(this._dialTooltipTimer);
      this._dialTooltipTimer = undefined;
    }
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    this._clearDialTooltipTimer();
    this._clearErrorTimer();
    this._stopCountdownAnimation();
    this._cancelProgressAnimation();
    this._detachReducedMotionListener();
    this._lastProgressUpdateMs = undefined;
    this._announcer.reset();
    this._resetExtendTracking();
    this._extendServicePromise = undefined;
    if (this._applyDialRaf !== undefined) {
      cancelAnimationFrame(this._applyDialRaf);
      this._applyDialRaf = undefined;
    }
    this._dialResizeObserver?.disconnect();
    this._dialResizeObserver = undefined;
    this._lastDialSignature = undefined;
    this._lastDialElement = undefined;
  }

  private _syncDisplayDuration(state: TimerViewState) {
    const viewModel = this._viewModel;

    if (!viewModel) {
      if (this._displayDurationSeconds !== undefined) {
        this._displayDurationSeconds = undefined;
      }
      return;
    }

    let next: number | undefined;

    switch (state.status) {
      case "running":
        if (state.connectionStatus !== "connected") {
          return;
        }
        this._applyRunningDisplay(state);
        return;
      case "paused":
        next =
          state.remainingSeconds ??
          this._displayDurationSeconds ??
          viewModel.dial.selectedDurationSeconds ??
          viewModel.pendingDurationSeconds;
        break;
      case "finished": {
        const selected =
          viewModel.selectedDurationSeconds ??
          viewModel.dial.selectedDurationSeconds ??
          this._displayDurationSeconds;
        next = selected ?? state.remainingSeconds ?? state.durationSeconds;
        break;
      }
      case "idle":
        next = viewModel.dial.selectedDurationSeconds;
        break;
      default:
        next = viewModel.dial.selectedDurationSeconds;
        break;
    }

    this._setDisplayDurationSeconds(next);
  }

  protected updated(changed: Map<string, unknown>) {
    super.updated(changed);
    this._scheduleApplyDialDisplay("updated");
  }

  private _scheduleApplyDialDisplay(_reason: string): void {
    if (this._applyDialRaf !== undefined) {
      return;
    }

    this._applyDialRaf = window.requestAnimationFrame(() => {
      this._applyDialRaf = undefined;
      const state = this._timerState ?? this._timerStateController.state;
      if (!state) {
        return;
      }
      this._applyDialDisplay(state, this._displayDurationSeconds);
    });
  }

  private _setDisplayDurationSeconds(next: number | undefined) {
    if (this._displayDurationSeconds === next) {
      this._scheduleApplyDialDisplay("display-unchanged");
      return;
    }

    this._displayDurationSeconds = next;
    this._lastDialSignature = undefined;
    this._scheduleApplyDialDisplay("display-changed");
  }

  private _applyDialDisplay(state: TimerViewState, displaySeconds?: number) {
    const resolvedSeconds = displaySeconds ?? this._displayDurationSeconds;
    const label = this._primaryLabelRef.value;
    if (label) {
      const text = this._getPrimaryDialLabel(state, resolvedSeconds);
      if (label.textContent !== text) {
        label.textContent = text;
      }
    }

    const dialElement = this._resolveDialElement();

    if (dialElement && resolvedSeconds === undefined) {
      this._syncDialProgress(dialElement, state);
    }

    if (resolvedSeconds === undefined) {
      this._updateProgressAnimationState(state);
      return;
    }

    if (dialElement) {
      if (dialElement !== this._lastDialElement) {
        this._lastDialElement = dialElement;
        this._lastDialSignature = undefined;
      }

      const signature = `${resolvedSeconds}|${state.status}|${dialElement.clientWidth}x${dialElement.clientHeight}`;
      if (this._lastDialSignature === signature) {
        return;
      }
      this._lastDialSignature = signature;
      if (dialElement.value !== resolvedSeconds) {
        dialElement.value = resolvedSeconds;
      }
      dialElement.valueText = formatDurationSeconds(resolvedSeconds);
      this._syncDialHandleTransform(dialElement, resolvedSeconds);
      this._syncDialProgress(dialElement, state, resolvedSeconds);
      this._updateProgressAnimationState(state);
      return;
    }

    this._lastDialElement = undefined;
    this._scheduleApplyDialDisplay("await-dial");
    this._updateProgressAnimationState(state);
  }

  private _updateRunningTickState(state: TimerViewState, previousState?: TimerViewState): void {
    if (state.connectionStatus !== "connected") {
      this._stopCountdownAnimation();
      this._serverRemainingSeconds = undefined;
      this._lastServerSyncMonotonicMs = undefined;
      seedMonotonicBaseline(this._monotonicCountdown, undefined);
      this._pendingStartSeed = undefined;
      this._startClamp = undefined;
      this._updateProgressAnimationState(state);
      this._debugPublishTick(state);
      return;
    }

    if (state.status === "paused") {
      this._stopCountdownAnimation();
      let candidate: number | undefined;
      if (state.remainingSeconds !== undefined) {
        candidate = Math.max(0, Math.floor(state.remainingSeconds));
        this._serverRemainingSeconds = candidate;
        this._lastServerSyncMonotonicMs = undefined;
        seedMonotonicBaseline(this._monotonicCountdown, undefined);
        this._setDisplayDurationSeconds(candidate);
      }
      this._pendingStartSeed = undefined;
      this._startClamp = undefined;
      this._updateProgressAnimationState(state);
      this._debugPublishTick(state, candidate ?? this._displayDurationSeconds);
      return;
    }

    if (state.status !== "running") {
      this._stopCountdownAnimation();
      this._serverRemainingSeconds = undefined;
      this._lastServerSyncMonotonicMs = undefined;
      seedMonotonicBaseline(this._monotonicCountdown, undefined);
      this._pendingStartSeed = undefined;
      this._startClamp = undefined;
      this._updateProgressAnimationState(state);
      this._debugPublishTick(state);
      return;
    }

    this._prepareStartBaseline(state, previousState);
    const nowMonotonic = this._monotonicNow();
    const candidateRemaining =
      state.serverRemainingSecAtT0 ??
      (state.remainingSeconds !== undefined ? Math.max(0, state.remainingSeconds) : undefined);

    if (candidateRemaining !== undefined) {
      const candidateInt = Math.max(0, Math.floor(candidateRemaining));
      const baselineEnd =
        state.baselineEndMs ??
        (state.clientMonotonicT0 !== undefined
          ? state.clientMonotonicT0 + candidateRemaining * 1000
          : undefined);

      const seedStartMonotonic =
        state.clientMonotonicT0 ?? (baselineEnd !== undefined ? baselineEnd - candidateRemaining * 1000 : undefined);

      this._evaluateStartOutlier(
        state,
        previousState,
        candidateRemaining,
        baselineEnd,
        seedStartMonotonic,
      );

      if (baselineEnd !== undefined && seedStartMonotonic !== undefined) {
        const previousBaseline = this._monotonicCountdown.baselineEndMs;
        const hasBaseline = previousBaseline !== undefined;
        const looksLikeDurationEcho =
          hasBaseline &&
          state.durationSeconds !== undefined &&
          candidateInt === Math.floor(state.durationSeconds) &&
          Math.floor(this._serverRemainingSeconds ?? 0) === candidateInt;

        if (!looksLikeDurationEcho) {
          if (this._serverRemainingSeconds !== undefined && this._lastServerSyncMonotonicMs !== undefined) {
            const elapsedSeconds = Math.floor(
              Math.max(0, nowMonotonic - this._lastServerSyncMonotonicMs) / 1000,
            );
            const predicted = Math.max(0, Math.floor(this._serverRemainingSeconds) - elapsedSeconds);
            const deltaMs = (candidateInt - predicted) * 1000;
            if (Math.abs(deltaMs) > 750) {
              reportServerCorrection({
                deltaMs,
                serverRemaining: candidateInt,
                baselineEndMs: this._monotonicToWall(baselineEnd),
                lastServerUpdate: this._debugFormatTimestamp(state.lastChangedTs),
                entityId: state.entityId ?? this._config?.entity,
              });
            }
          }

          this._serverRemainingSeconds = candidateRemaining;
          this._lastServerSyncMonotonicMs = seedStartMonotonic;
          const baselineDeltaMs = previousBaseline !== undefined ? baselineEnd - previousBaseline : undefined;
          const isMaterialChange = previousState?.status !== "running" || !this._debugHasSeededBaseline;
          // Corrections above 0.75s remain logged for #53, but the display only
          // jumps upward for material changes or larger corrections per #56.
          const allowIncrease =
            isMaterialChange ||
            baselineDeltaMs === undefined ||
            baselineDeltaMs <= 0 ||
            baselineDeltaMs >= VISUAL_CORRECTION_THRESHOLD_MS;

          seedMonotonicBaseline(this._monotonicCountdown, baselineEnd, { allowIncrease });
          this._debugHandleSeed(state, previousState, "server", candidateInt, candidateRemaining);
        }
      }
    }

    const display = this._applyRunningDisplay(state, nowMonotonic);

    if (
      display !== undefined &&
      display > 0 &&
      (this._serverRemainingSeconds === undefined || this._lastServerSyncMonotonicMs === undefined)
    ) {
      const clamped = Math.max(0, display);
      this._serverRemainingSeconds = clamped;
      this._lastServerSyncMonotonicMs = nowMonotonic;
      seedMonotonicBaseline(this._monotonicCountdown, nowMonotonic + clamped * 1000, { allowIncrease: true });
      this._debugHandleSeed(state, previousState, "fallback", Math.floor(clamped), display);
    }

    this._debugPublishTick(state, display);

    if (display !== undefined && display > 0) {
      this._startCountdownAnimation();
    } else {
      this._stopCountdownAnimation();
    }

    this._updateProgressAnimationState(state);
  }

  private _debugHandleSeed(
    state: TimerViewState,
    previousState: TimerViewState | undefined,
    kind: "server" | "fallback" | "start",
    serverRemaining: number,
    estimatedRemaining?: number,
  ): void {
    const seedSource = this._debugDetermineSeedSource(state, previousState, kind);
    this._debugSeedSource = seedSource;
    this._debugHasSeededBaseline = true;
    const baselineEndMs =
      this._monotonicCountdown.baselineEndMs !== undefined
        ? this._monotonicToWall(this._monotonicCountdown.baselineEndMs)
        : undefined;
    const lastServerUpdate = this._debugFormatTimestamp(state.lastChangedTs);
    const entityId = state.entityId ?? this._config?.entity;
    const payload = {
      seedSource,
      serverRemaining,
      estimatedRemaining: estimatedRemaining ?? this._displayDurationSeconds,
      baselineEndMs,
      lastServerUpdate,
      entityId,
    } as const;
    reportDebugSeed(payload);
    reportDebugTick(payload);
  }

  private _debugPublishTick(state: TimerViewState, estimatedRemaining?: number): void {
    const serverRemaining = this._serverRemainingSeconds;
    const baselineEndMs =
      serverRemaining !== undefined && this._monotonicCountdown.baselineEndMs !== undefined
        ? this._monotonicToWall(this._monotonicCountdown.baselineEndMs)
        : undefined;
    const lastServerUpdate = this._debugFormatTimestamp(state.lastChangedTs);
    const entityId = state.entityId ?? this._config?.entity;
    reportDebugTick({
      seedSource: this._debugSeedSource,
      serverRemaining,
      estimatedRemaining: estimatedRemaining ?? this._displayDurationSeconds,
      baselineEndMs,
      lastServerUpdate,
      entityId,
    });
  }

  private _debugDetermineSeedSource(
    state: TimerViewState,
    previousState: TimerViewState | undefined,
    kind: "server" | "fallback" | "start",
  ): DebugSeedSource {
    if (this._debugPendingSeedSource) {
      const pending = this._debugPendingSeedSource;
      this._debugPendingSeedSource = undefined;
      return pending;
    }

    if (kind === "start") {
      return "start";
    }

    if (kind === "server" && state.remainingIsEstimated) {
      return "estimated_last_changed";
    }

    if (previousState?.status === "paused" && state.status === "running") {
      return "resume";
    }

    if (!this._debugHasSeededBaseline) {
      return "reload";
    }

    return "server_remaining";
  }

  private _debugFormatTimestamp(value: number | undefined): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    const date = new Date(value);
    const time = date.getTime();
    if (!Number.isFinite(time)) {
      return undefined;
    }

    return date.toISOString();
  }

  private _applyRunningDisplay(state: TimerViewState, now = this._monotonicNow()): number | undefined {
    if (state.status !== "running") {
      this._startClamp = undefined;
      return undefined;
    }

    let displaySeconds = monotonicDisplaySeconds(this._monotonicCountdown, now);

    if (displaySeconds === undefined) {
      // Seed from the most reliable available source when Home Assistant omits
      // `remaining` while the timer is running.
      const fallback =
        state.durationSeconds ??
        this._viewModel?.dial.selectedDurationSeconds ??
        this._viewModel?.pendingDurationSeconds ??
        this._displayDurationSeconds;
      if (fallback === undefined) {
        return undefined;
      }
      displaySeconds = Math.max(0, Math.floor(fallback));
    }

    const effectiveDisplay = this._applyStartClamp(state, displaySeconds);
    this._setDisplayDurationSeconds(effectiveDisplay);
    const announcement = this._announcer.announceRunning(effectiveDisplay);
    if (announcement) {
      this._announce(announcement);
    }
    return effectiveDisplay;
  }

  private _startCountdownAnimation(): void {
    if (this._countdownAnimationHandle !== undefined) {
      return;
    }

    this._countdownAnimationHandle = window.requestAnimationFrame(this._handleCountdownFrame);
  }

  private _stopCountdownAnimation(): void {
    if (this._countdownAnimationHandle !== undefined) {
      window.cancelAnimationFrame(this._countdownAnimationHandle);
      this._countdownAnimationHandle = undefined;
    }
  }

  private readonly _handleCountdownFrame = () => {
    this._countdownAnimationHandle = undefined;
    const state = this._timerState ?? this._timerStateController.state;
    if (!state || state.status !== "running") {
      this._stopCountdownAnimation();
      return;
    }

    const display = this._applyRunningDisplay(state);
    if (display !== undefined && display > 0) {
      this._startCountdownAnimation();
    } else {
      this._stopCountdownAnimation();
    }
  };

  private _syncDialProgress(
    dialElement: TeaTimerDial | undefined,
    state: TimerViewState,
    displaySeconds?: number,
    now = this._monotonicNow(),
  ): void {
    if (!dialElement) {
      return;
    }

    const fraction = this._computeProgressFraction(state, now, displaySeconds);
    if (fraction === undefined) {
      return;
    }

    dialElement.setProgressFraction(fraction);
    this._lastProgressUpdateMs = this._monotonicToWall(now);
  }

  private _computeProgressFraction(
    state: TimerViewState,
    now: number,
    displaySeconds?: number,
  ): number | undefined {
    if (state.status === "finished") {
      return 0;
    }

    if (state.status !== "running" && state.status !== "paused") {
      return 0;
    }

    let totalDuration =
      state.durationSeconds ??
      this._viewModel?.pendingDurationSeconds ??
      this._viewModel?.dial.selectedDurationSeconds;

    if (this._extendRunTotalSeconds !== undefined) {
      totalDuration = this._extendRunTotalSeconds;
    }

    if (totalDuration === undefined || totalDuration <= 0 || !Number.isFinite(totalDuration)) {
      return 0;
    }

    let remaining: number | undefined;
    if (
      state.status === "running" &&
      this._serverRemainingSeconds !== undefined &&
      this._lastServerSyncMonotonicMs !== undefined
    ) {
      const elapsedSeconds = Math.max(0, now - this._lastServerSyncMonotonicMs) / 1000;
      remaining = this._serverRemainingSeconds - elapsedSeconds;
    } else if (displaySeconds !== undefined) {
      remaining = displaySeconds;
    } else if (this._displayDurationSeconds !== undefined) {
      remaining = this._displayDurationSeconds;
    } else if (state.remainingSeconds !== undefined) {
      remaining = state.remainingSeconds;
    }

    if (remaining === undefined || !Number.isFinite(remaining)) {
      return undefined;
    }

    const clampedRemaining = Math.max(0, remaining);
    const fraction = clampedRemaining / totalDuration;
    if (!Number.isFinite(fraction)) {
      return 0;
    }

    return Math.min(1, Math.max(0, fraction));
  }

  private _monotonicNow(): number {
    return monotonicNow();
  }

  private _monotonicToWall(monotonicMs: number): number {
    return Date.now() - this._monotonicNow() + monotonicMs;
  }

  private _updateProgressAnimationState(state: TimerViewState): void {
    const dialElement = this._resolveDialElement();
    if (this._shouldContinueProgressAnimation(state, dialElement)) {
      this._startProgressAnimation();
    } else {
      this._cancelProgressAnimation();
    }
  }

  private _shouldContinueProgressAnimation(
    state: TimerViewState | undefined,
    dialElement: TeaTimerDial | undefined,
  ): boolean {
    return (
      !!state &&
      state.status === "running" &&
      !this._prefersReducedMotion &&
      dialElement !== undefined &&
      this._serverRemainingSeconds !== undefined &&
      this._lastServerSyncMonotonicMs !== undefined
    );
  }

  private _startProgressAnimation(): void {
    if (this._progressAnimationHandle !== undefined) {
      return;
    }

    this._progressAnimationHandle = window.requestAnimationFrame(this._handleProgressAnimationFrame);
  }

  private readonly _handleProgressAnimationFrame = () => {
    this._progressAnimationHandle = undefined;
    const state = this._timerState ?? this._timerStateController.state;
    const dialElement = this._resolveDialElement();

    if (!this._shouldContinueProgressAnimation(state, dialElement)) {
      this._cancelProgressAnimation();
      return;
    }

    const nowWall = Date.now();
    const nowMonotonic = this._monotonicNow();
    if (
      this._lastProgressUpdateMs === undefined ||
      nowWall - this._lastProgressUpdateMs >= PROGRESS_FRAME_INTERVAL_MS
    ) {
      if (state && dialElement) {
        this._syncDialProgress(dialElement, state, undefined, nowMonotonic);
      }
    }

    if (this._shouldContinueProgressAnimation(state, dialElement)) {
      this._progressAnimationHandle = window.requestAnimationFrame(this._handleProgressAnimationFrame);
    }
  };

  private _cancelProgressAnimation(): void {
    if (this._progressAnimationHandle !== undefined) {
      cancelAnimationFrame(this._progressAnimationHandle);
      this._progressAnimationHandle = undefined;
    }
  }

  private _attachReducedMotionListener(): void {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      this._prefersReducedMotion = false;
      return;
    }

    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    this._reducedMotionMedia = media;
    this._prefersReducedMotion = media.matches;

    const handler = (event: MediaQueryListEvent) => {
      this._prefersReducedMotion = event.matches;
      const state = this._timerState ?? this._timerStateController.state;
      const dialElement = this._resolveDialElement();
      if (state && dialElement) {
        this._syncDialProgress(dialElement, state);
      }
      if (event.matches) {
        this._cancelProgressAnimation();
      } else if (state) {
        this._updateProgressAnimationState(state);
      }
    };

    this._onReducedMotionChange = handler;

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handler);
    } else if (typeof media.addListener === "function") {
      media.addListener(handler);
    }

    const state = this._timerState ?? this._timerStateController.state;
    if (state) {
      const dialElement = this._resolveDialElement();
      if (dialElement) {
        this._syncDialProgress(dialElement, state);
      }
      if (!media.matches) {
        this._updateProgressAnimationState(state);
      }
    }
  }

  private _detachReducedMotionListener(): void {
    const media = this._reducedMotionMedia;
    const handler = this._onReducedMotionChange;
    if (media && handler) {
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", handler);
      } else if (typeof media.removeListener === "function") {
        media.removeListener(handler);
      }
    }

    this._reducedMotionMedia = undefined;
    this._onReducedMotionChange = undefined;
  }

  private _derivePauseHelperEntityId(entityId: string | undefined): string | undefined {
    if (!entityId) {
      return undefined;
    }

    const parts = entityId.split(".");
    if (parts.length !== 2) {
      return undefined;
    }

    const slug = parts[1]?.trim();
    if (!slug) {
      return undefined;
    }

    return `input_text.${slug}_paused_remaining`;
  }

  private _evaluatePauseCapability(): void {
    if (!this._viewModel?.ui.showPauseResumeButton || !this._config?.entity) {
      this._pauseCapability = "unsupported";
      return;
    }

    if (supportsTimerPause(this._hass)) {
      this._pauseCapability = "native";
      return;
    }

    if (this._pauseHelperEntityId) {
      this._pauseCapability = "compat";
      return;
    }

    this._pauseCapability = "unsupported";
  }

  private _resolveDialElement(): TeaTimerDial | undefined {
    const dialElement = this._dialElement;
    if (dialElement) {
      const node = dialElement as unknown as Partial<Node>;
      if (!("isConnected" in node) || node.isConnected) {
        return dialElement;
      }
    }

    const queried = this.renderRoot?.querySelector<TeaTimerDial>("tea-timer-dial");
    if (queried) {
      const node = queried as unknown as Partial<Node>;
      if (!("isConnected" in node) || node.isConnected) {
        return queried;
      }
    }

    return undefined;
  }

  private _syncDialHandleTransform(dialElement: TeaTimerDial, seconds: number) {
    const handle = dialElement.shadowRoot?.querySelector<HTMLElement>(".dial-handle");
    if (!handle) {
      return;
    }

    const bounds =
      dialElement.bounds ??
      this._viewModel?.dial.bounds ??
      this._config?.dialBounds ??
      ({ min: 0, max: 0, step: 1 } as const);

    const span = bounds.max - bounds.min;
    let normalized = 0;
    if (span > 0) {
      const clamped = Math.min(bounds.max, Math.max(bounds.min, seconds));
      normalized = (clamped - bounds.min) / span;
    }

    const angle = normalized * 360;
    const transform = `rotate(${angle}deg)`;
    if (handle.style.transform !== transform) {
      handle.style.transform = transform;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tea-timer-card": TeaTimerCard;
  }
}
