import { html, LitElement, nothing } from "lit";
import { createRef, ref } from "lit/directives/ref.js";
import { property, query, state } from "lit/decorators.js";
import { baseStyles } from "../styles/base";
import { cardStyles } from "../styles/card";
import { parseTeaTimerConfig, TeaTimerConfig } from "../model/config";
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
import { restartTimer, startTimer } from "../ha/services/timer";
import { TimerAnnouncer } from "./TimerAnnouncer";

type TimerUiErrorReason = Extract<TimerUiState, { kind: "Error" }>["reason"];

export class TeaTimerCard extends LitElement implements LovelaceCard {
  static styles = [baseStyles, cardStyles];

  private _hass?: HomeAssistant;

  @property({ attribute: false })
  public get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  public set hass(value: HomeAssistant | undefined) {
    const oldValue = this._hass;
    this._hass = value;
    this._timerStateController.setHass(value);
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

  @query("tea-timer-dial")
  private _dialElement?: TeaTimerDial;

  private readonly _timerStateController: TimerStateController;

  private readonly _announcer = new TimerAnnouncer(STRINGS);

  private _announcementToggle = false;

  private _previousTimerState?: TimerViewState;

  private _dialTooltipTimer?: number;

  private _awaitingDialElementSync = false;
  private _errorTimer?: number;
  private _confirmRestartDuration?: number;
  private _lastPointerPresetId?: number;
  private _lastKeyboardPresetId?: number;

  private readonly _primaryLabelRef = createRef<HTMLSpanElement>();

  private _runningTickTimer?: number;
  private _nextRunningTickDueMs?: number;

  private _serverRemainingSeconds?: number;

  private _lastServerSyncMs?: number;

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
    this._timerStateController.setFinishedOverlayMs(
      this._config?.finishedAutoIdleMs ?? 5000,
    );
    const state = this._timerState ?? this._timerStateController.state;
    if (this._config) {
      this._viewModel = createTeaTimerViewModel(this._config, state);
    } else {
      this._viewModel = undefined;
    }
    this._updateRunningTickState(state);
    this._syncDisplayDuration(state);
    this._previousTimerState = state;
    this._timerStateController.setEntityId(this._config?.entity);
    this.requestUpdate();
  }

  // eslint-disable-next-line class-methods-use-this
  public getCardSize(): number {
    return 4;
  }

  protected render() {
    const pendingAction = this._viewModel?.ui.pendingAction ?? "none";
    const state = this._timerState ?? this._timerStateController.state;
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
        ${this._renderSubtitle()}
        ${state ? this._renderStatusPill(state) : nothing}
        ${state ? this._renderStateBanner(state) : nothing}
        <div class="interaction">
          ${state ? this._renderPresets(state) : this._renderPresets(undefined)}
          ${state ? this._renderDial(state) : this._renderDial(undefined)}
        </div>
        ${state ? this._renderPrimaryAction(state) : nothing}
        <div class="sr-only" role="status" aria-live="polite">${this._ariaAnnouncement}</div>
        <p class="note">${STRINGS.draftNote}</p>
        ${this._renderSupportLinks()}
        ${this._renderPendingOverlay(state)}
        ${this._confirmRestartVisible ? this._renderRestartConfirm() : nothing}
        ${this._renderToast()}
      </section>
    `;
  }

  private _renderSupportLinks() {
    return html`
      <div class="links">
        <a class="help" href=${STRINGS.gettingStartedUrl} target="_blank" rel="noreferrer">
          ${STRINGS.gettingStartedLabel}
        </a>
        <a class="help" href=${STRINGS.finishAutomationUrl} target="_blank" rel="noreferrer">
          ${STRINGS.finishAutomationLabel}
        </a>
      </div>
    `;
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
      ${isCustom
        ? html`<span class="preset-custom" role="note">${STRINGS.presetsCustomLabel}</span>`
        : nothing}
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
    const action = state.status === "running" ? "restart" : "start";
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
    this._setDisplayDurationSeconds(this._viewModel.selectedDurationSeconds, state);
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
    this._setDisplayDurationSeconds(this._viewModel.selectedDurationSeconds, state);
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

    if (this._isUiError(uiState, "EntityUnavailable")) {
      const entity = state.entityId ?? this._config?.entity;
      if (!entity) {
        return {
          message: STRINGS.missingEntity,
          tone: "error",
          live: "assertive",
          role: "alert",
        };
      }

      return {
        message: STRINGS.entityUnavailableBanner(entity),
        tone: "error",
        live: "assertive",
        role: "alert",
      };
    }

    if (this._isUiError(uiState, "ServiceFailure")) {
      const message = uiState.detail ?? STRINGS.serviceFailureMessage;
      return { message, tone: "error", live: "polite", role: "status" };
    }

    return null;
  }

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

    if (state.status === "running") {
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

    this._viewModel = setViewModelError(this._viewModel, undefined);
    this._clearErrorTimer();
    this._viewModel = setPendingAction(this._viewModel, "start", registered.ts);
    this._announceAction("start", durationSeconds);

    try {
      await startTimer(this._hass, this._config.entity, durationSeconds);
    } catch {
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

    this._viewModel = setPendingAction(this._viewModel, "restart", registered.ts);
    this._announceAction("restart", durationSeconds);

    try {
      await restartTimer(this._hass, this._config.entity, durationSeconds);
    } catch {
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

    if (state.status === "running") {
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
    if (this._isUiError(uiState, "EntityUnavailable")) {
      const entity = state.entityId ?? this._config?.entity;
      return entity ? STRINGS.entityUnavailableWithId(entity) : STRINGS.statusUnavailable;
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
    if (typeof uiState === "object") {
      if (uiState.kind === "FinishedTransient") {
        return STRINGS.statusFinished;
      }
      switch (uiState.reason) {
        case "Disconnected":
          return state.connectionStatus === "reconnecting"
            ? STRINGS.statusReconnecting
            : STRINGS.statusDisconnected;
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
      if (uiState.reason === "EntityUnavailable") {
        return "status-pill status-unavailable";
      }
      if (uiState.reason === "ServiceFailure") {
        return "status-pill status-error";
      }
    }

    switch (state.status) {
      case "running":
        return "status-pill status-running";
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

  private _canInteract(state: TimerViewState | undefined): boolean {
    if (!state) {
      return false;
    }

    if (state.connectionStatus !== "connected") {
      return false;
    }

    if (this._isUiError(state.uiState, "EntityUnavailable")) {
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
          const previousAction = previousViewModel?.ui.pendingAction ?? "none";
          const durationSeconds = this._resolveRunDurationSeconds(state);
          this._announcer.beginRun(durationSeconds);
          if (previousAction !== "start" && previousAction !== "restart") {
            const message = this._announcer.announceAction({
              action: "start",
              durationSeconds,
            });
            this._announce(message);
          }
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
    if (this._confirmRestartVisible && state.status !== "running") {
      this._confirmRestartVisible = false;
      this._confirmRestartDuration = undefined;
    }
    this._timerState = state;
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
    this._previousTimerState = state;
    this._updateRunningTickState(state);
    this._syncDisplayDuration(state);
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

    this._setDisplayDurationSeconds(value, state);
    this._viewModel = updateDialSelection(this._viewModel, value);
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
    this._cancelRunningTick();
    this._announcer.reset();
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
      case "finished":
        next = state.remainingSeconds ?? state.durationSeconds ?? viewModel.dial.selectedDurationSeconds;
        break;
      case "idle":
        next = viewModel.dial.selectedDurationSeconds;
        break;
      default:
        next = viewModel.dial.selectedDurationSeconds;
        break;
    }

    this._setDisplayDurationSeconds(next, state);
  }

  protected updated(changed: Map<string, unknown>) {
    super.updated(changed);
    const state = this._timerState ?? this._timerStateController.state;
    this._applyDialDisplay(state, this._displayDurationSeconds);
  }

  private _setDisplayDurationSeconds(
    next: number | undefined,
    state: TimerViewState = this._timerState ?? this._timerStateController.state,
  ) {
    if (this._displayDurationSeconds === next) {
      if (state) {
        this._applyDialDisplay(state, next);
      }
      return;
    }

    this._displayDurationSeconds = next;
    if (state) {
      this._applyDialDisplay(state, next);
    }
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

    if (resolvedSeconds === undefined) {
      return;
    }

    const dialElement = this._resolveDialElement();
    if (dialElement) {
      if (dialElement.value !== resolvedSeconds) {
        dialElement.value = resolvedSeconds;
      }
      dialElement.valueText = formatDurationSeconds(resolvedSeconds);
      this._syncDialHandleTransform(dialElement, resolvedSeconds);
      return;
    }

    if (this._awaitingDialElementSync) {
      return;
    }

    this._awaitingDialElementSync = true;
    void this.updateComplete.then(() => {
      this._awaitingDialElementSync = false;
      const nextState = this._timerState ?? this._timerStateController.state;
      if (nextState) {
        this._applyDialDisplay(nextState, this._displayDurationSeconds);
      }
    });
  }

  private _updateRunningTickState(state: TimerViewState): void {
    if (state.connectionStatus !== "connected") {
      this._cancelRunningTick();
      return;
    }

    if (state.status !== "running") {
      this._cancelRunningTick();
      this._serverRemainingSeconds = undefined;
      this._lastServerSyncMs = undefined;
      return;
    }

    if (state.remainingSeconds !== undefined) {
      const candidate = Math.max(0, Math.floor(state.remainingSeconds));
      const hasBaseline = this._serverRemainingSeconds !== undefined;
      const looksLikeDurationEcho =
        hasBaseline &&
        state.durationSeconds !== undefined &&
        candidate === state.durationSeconds &&
        candidate === this._serverRemainingSeconds;

      if (!looksLikeDurationEcho) {
        this._serverRemainingSeconds = candidate;
        this._lastServerSyncMs = Date.now();
      }
    }

    const display = this._applyRunningDisplay(state);

    if (
      display !== undefined &&
      display > 0 &&
      (this._serverRemainingSeconds === undefined || this._lastServerSyncMs === undefined)
    ) {
      this._serverRemainingSeconds = Math.max(0, Math.floor(display));
      this._lastServerSyncMs = Date.now();
    }

    if (display !== undefined && display > 0) {
      this._scheduleRunningTick();
    } else {
      this._cancelRunningTick();
    }
  }

  private _applyRunningDisplay(state: TimerViewState): number | undefined {
    if (state.status !== "running") {
      return undefined;
    }

    const baseline = this._serverRemainingSeconds;
    const syncTs = this._lastServerSyncMs;

    if (baseline === undefined || syncTs === undefined) {
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
      const clamped = Math.max(0, Math.floor(fallback));
      this._setDisplayDurationSeconds(clamped, state);
      const announcement = this._announcer.announceRunning(clamped);
      if (announcement) {
        this._announce(announcement);
      }
      return clamped;
    }

    const elapsedMs = Math.max(0, Date.now() - syncTs);
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const displaySeconds = Math.max(0, Math.floor(baseline) - elapsedSeconds);
    this._setDisplayDurationSeconds(displaySeconds, state);
    const announcement = this._announcer.announceRunning(displaySeconds);
    if (announcement) {
      this._announce(announcement);
    }
    return displaySeconds;
  }

  private _scheduleRunningTick(): void {
    const state = this._timerState ?? this._timerStateController.state;
    if (!state || state.status !== "running") {
      this._cancelRunningTick();
      return;
    }

    if (
      this._serverRemainingSeconds === undefined ||
      this._serverRemainingSeconds <= 0 ||
      this._lastServerSyncMs === undefined
    ) {
      this._cancelRunningTick();
      return;
    }

    const now = Date.now();
    const elapsedMs = Math.max(0, now - this._lastServerSyncMs);
    const remainder = elapsedMs % 1000;
    const baseDelay = remainder === 0 ? 1000 : 1000 - remainder;
    const delay = Math.max(16, baseDelay);
    const dueMs = now + delay;

    if (
      this._runningTickTimer !== undefined &&
      this._nextRunningTickDueMs !== undefined &&
      this._nextRunningTickDueMs <= dueMs + 4
    ) {
      return;
    }

    this._cancelRunningTick();
    this._nextRunningTickDueMs = dueMs;

    this._runningTickTimer = window.setTimeout(() => {
      this._runningTickTimer = undefined;
      this._nextRunningTickDueMs = undefined;
      const nextState = this._timerState ?? this._timerStateController.state;
      if (!nextState || nextState.status !== "running") {
        return;
      }
      const display = this._applyRunningDisplay(nextState);
      if (display !== undefined && display > 0) {
        this._scheduleRunningTick();
      }
    }, delay);
  }

  private _cancelRunningTick(): void {
    if (this._runningTickTimer !== undefined) {
      clearTimeout(this._runningTickTimer);
      this._runningTickTimer = undefined;
    }
    this._nextRunningTickDueMs = undefined;
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
