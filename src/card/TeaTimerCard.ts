import { html, LitElement, nothing } from "lit";
import { property, query, state } from "lit/decorators.js";
import { baseStyles } from "../styles/base";
import { cardStyles } from "../styles/card";
import { parseTeaTimerConfig, TeaTimerConfig } from "../model/config";
import {
  clearPendingAction,
  createTeaTimerViewModel,
  PendingTimerAction,
  setPendingAction,
  setViewModelError,
  TeaTimerViewModel,
  updateDialSelection,
} from "../view/TeaTimerViewModel";
import { STRINGS } from "../strings";
import type { HomeAssistant, LovelaceCard } from "../types/home-assistant";
import { TimerStateController } from "../state/TimerStateController";
import type { TimerViewState, TimerStatus } from "../state/TimerStateMachine";
import { formatDurationSeconds, normalizeDurationSeconds } from "../model/duration";
import "../dial/TeaTimerDial";
import type { TeaTimerDial } from "../dial/TeaTimerDial";
import { restartTimer, startTimer } from "../ha/services/timer";

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

  private _lastAnnouncedStatus?: TimerStatus;

  private readonly _timerStateController: TimerStateController;

  private _previousTimerState?: TimerViewState;

  private _dialTooltipTimer?: number;

  private _awaitingDialElementSync = false;
  private _errorTimer?: number;
  private _confirmRestartDuration?: number;

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
    const state = this._timerStateController.state;
    if (this._config) {
      this._viewModel = createTeaTimerViewModel(this._config, state);
    } else {
      this._viewModel = undefined;
    }
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
    return html`
      ${this._renderErrors()}
      <section
        class="card"
        data-instance-id=${this._config?.cardInstanceId ?? "unconfigured"}
        aria-busy=${pendingAction !== "none" ? "true" : "false"}
        @click=${this._onCardClick}
      >
        ${this._renderHeader()}
        ${this._renderStatusPill()}
        ${this._renderDial()}
        ${this._renderPresets()}
        <div class="sr-only" aria-live="polite">${this._ariaAnnouncement}</div>
        <p class="note">${STRINGS.draftNote}</p>
        <a class="help" href=${STRINGS.gettingStartedUrl} target="_blank" rel="noreferrer">
          ${STRINGS.gettingStartedLabel}
        </a>
        ${this._renderPendingOverlay()}
        ${this._confirmRestartVisible ? this._renderRestartConfirm() : nothing}
        ${this._renderToast()}
      </section>
    `;
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

  private _renderDial() {
    const state = this._timerState ?? this._timerStateController.state;
    const status = state.status;
    const dial = this._viewModel?.dial;
    const bounds = dial?.bounds ?? { min: 0, max: 0, step: 1 };
    const displaySeconds =
      this._displayDurationSeconds ?? dial?.selectedDurationSeconds ?? bounds.min;
    const dialValueText = formatDurationSeconds(displaySeconds);
    const primary = this._getPrimaryDialLabel(state, displaySeconds);
    const secondary = this._getSecondaryDialLabel(state);
    const estimation = this._getEstimationNotice(state);

    return html`
      <div class="dial-wrapper">
        <tea-timer-dial
          .value=${displaySeconds}
          .bounds=${bounds}
          .interactive=${dial?.isInteractive ?? false}
          .status=${status}
          .ariaLabel=${dial?.aria.label ?? STRINGS.dialLabel}
          .valueText=${dialValueText}
          @dial-input=${this._onDialInput}
          @dial-blocked=${this._onDialBlocked}
        >
          <span slot="primary" data-role="dial-primary">${primary}</span>
          <span slot="secondary">${secondary}</span>
        </tea-timer-dial>
        ${estimation ? html`<p class="estimation" role="note">${estimation}</p>` : nothing}
        ${this._dialTooltipVisible
          ? html`<div class="dial-tooltip" role="status">${STRINGS.dialBlockedTooltip}</div>`
          : nothing}
      </div>
    `;
  }

  private _renderPresets() {
    if (!this._viewModel || !this._viewModel.ui.hasPresets) {
      return html`<div class="empty-state">${STRINGS.emptyState}</div>`;
    }

    return html`
      <div class="presets" role="group" aria-label=${STRINGS.presetsGroupLabel}>
        ${this._viewModel.ui.presets.map(
          (preset) => html`
            <button
              class="preset-chip"
              type="button"
              role="button"
              disabled
              aria-disabled="true"
            >
              <span>${preset.label}</span>
              <span>${preset.durationLabel}</span>
            </button>
          `,
        )}
      </div>
    `;
  }

  private _renderPendingOverlay() {
    const action = this._viewModel?.ui.pendingAction ?? "none";
    if (action === "none") {
      return nothing;
    }

    const label = action === "start" ? STRINGS.pendingStartLabel : STRINGS.pendingRestartLabel;
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

    const tone = error.code === "entity-unavailable" ? "info" : "error";
    return html`
      <div class="toast toast-${tone}" role="status" aria-live="polite">
        ${error.message}
      </div>
    `;
  }

  private _renderStatusPill() {
    const state = this._timerState ?? this._timerStateController.state;
    const label = this._getStatusLabel(state.status);
    return html`<span class="status-pill status-${state.status}" aria-hidden="true">${label}</span>`;
  }

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

    if (state.status === "unavailable") {
      this._showEntityUnavailableToast();
      return;
    }

    const durationSeconds = this._getActionDuration();

    if (state.status === "running") {
      if (this._viewModel.ui.confirmRestart) {
        this._confirmRestartDuration = durationSeconds;
        this._confirmRestartVisible = true;
        return;
      }

      void this._restartTimerAction(durationSeconds);
      return;
    }

    void this._startTimerAction(durationSeconds);
  }

  private _getActionDuration(): number {
    if (!this._viewModel || !this._config) {
      return 0;
    }

    const selected = this._viewModel.selectedDurationSeconds ?? this._viewModel.dial.selectedDurationSeconds;
    return normalizeDurationSeconds(selected, this._config.dialBounds);
  }

  private async _startTimerAction(durationSeconds: number): Promise<void> {
    if (!this._viewModel || !this._config?.entity || !this._hass) {
      return;
    }

    if (this._viewModel.ui.pendingAction !== "none") {
      return;
    }

    this._viewModel = setViewModelError(this._viewModel, undefined);
    this._clearErrorTimer();
    this._viewModel = setPendingAction(this._viewModel, "start", Date.now());
    this._announceAction("start", durationSeconds);

    try {
      await startTimer(this._hass, this._config.entity, durationSeconds);
    } catch {
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
    this._viewModel = setPendingAction(this._viewModel, "restart", Date.now());
    this._announceAction("restart", durationSeconds);

    try {
      await restartTimer(this._hass, this._config.entity, durationSeconds);
    } catch {
      this._viewModel = clearPendingAction(this._viewModel);
      this._viewModel = setViewModelError(this._viewModel, {
        message: STRINGS.toastRestartFailed,
        code: "restart-failed",
      });
      this._scheduleErrorClear();
    }
  }

  private _announceAction(action: PendingTimerAction, durationSeconds: number): void {
    const durationLabel = formatDurationSeconds(durationSeconds);
    if (action === "start") {
      this._ariaAnnouncement = STRINGS.ariaStarting(durationLabel);
    } else if (action === "restart") {
      this._ariaAnnouncement = STRINGS.ariaRestarting(durationLabel);
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
      if (state.remainingSeconds !== undefined) {
        return formatDurationSeconds(state.remainingSeconds);
      }
      if (displaySeconds !== undefined) {
        return formatDurationSeconds(displaySeconds);
      }
      return STRINGS.timeUnknown;
    }

    if (state.status === "idle") {
      if (displaySeconds !== undefined) {
        return formatDurationSeconds(displaySeconds);
      }
      return STRINGS.timeUnknown;
    }

    return STRINGS.timerUnavailable;
  }

  private _getSecondaryDialLabel(state: TimerViewState): string {
    if (state.status === "finished") {
      return this._getStatusLabel("finished");
    }

    if (state.status === "running") {
      return this._getStatusLabel("running");
    }

    if (state.status === "idle") {
      return this._getStatusLabel("idle");
    }

    const entity = this._config?.entity;
    return entity ? STRINGS.entityUnavailableWithId(entity) : this._getStatusLabel("unavailable");
  }

  private _getStatusLabel(status: TimerStatus): string {
    switch (status) {
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

  private _getEstimationNotice(state: TimerViewState): string | null {
    if (!state.remainingIsEstimated) {
      return null;
    }

    if ((state.estimationDriftSeconds ?? 0) <= 2) {
      return null;
    }

    return STRINGS.remainingEstimateNotice;
  }

  private _handleAriaAnnouncement(state: TimerViewState) {
    if (state.status === this._lastAnnouncedStatus) {
      return;
    }

    this._lastAnnouncedStatus = state.status;

    switch (state.status) {
      case "running":
        this._ariaAnnouncement = STRINGS.ariaRunning;
        break;
      case "finished":
        this._ariaAnnouncement = STRINGS.ariaFinished;
        break;
      case "idle":
        this._ariaAnnouncement = STRINGS.ariaIdle;
        break;
      default:
        this._ariaAnnouncement = STRINGS.ariaUnavailable;
        break;
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
      const pending = previousViewModel?.ui.pendingAction ?? "none";
      if (pending !== "none") {
        if (
          state.status === "running" ||
          state.status === "unavailable" ||
          state.status === "finished"
        ) {
          this._viewModel = clearPendingAction(this._viewModel);
        } else if (state.status === "idle" && previousState?.status === "running") {
          this._viewModel = clearPendingAction(this._viewModel);
        }
      }

      if (previousViewModel?.ui.error) {
        this._viewModel = setViewModelError(this._viewModel, undefined);
        this._clearErrorTimer();
      }
    }

    this._handleAriaAnnouncement(state);
    this._previousTimerState = state;
    this._syncDisplayDuration(state);
  }

  private readonly _onDialInput = (event: CustomEvent<{ value: number }>) => {
    event.stopPropagation();
    if (!this._viewModel) {
      return;
    }

    const value = event.detail.value;
    const state = this._timerState ?? this._timerStateController.state;

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
        next = state.remainingSeconds ?? viewModel.dial.selectedDurationSeconds;
        break;
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

  private _setDisplayDurationSeconds(
    next: number | undefined,
    state: TimerViewState = this._timerState ?? this._timerStateController.state,
  ) {
    if (this._displayDurationSeconds === next) {
      if (state) {
        this._applyDialDisplay(next);
      }
      return;
    }

    this._displayDurationSeconds = next;
    if (state) {
      this._applyDialDisplay(next);
    }
  }

  private _applyDialDisplay(displaySeconds?: number) {
    if (displaySeconds === undefined) {
      return;
    }

    const dialElement = this._resolveDialElement();
    if (dialElement) {
      dialElement.valueText = formatDurationSeconds(displaySeconds);
      return;
    }

    if (this._awaitingDialElementSync) {
      return;
    }

    this._awaitingDialElementSync = true;
    void this.updateComplete.then(() => {
      this._awaitingDialElementSync = false;
      this._applyDialDisplay(this._displayDurationSeconds);
    });
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
}

declare global {
  interface HTMLElementTagNameMap {
    "tea-timer-card": TeaTimerCard;
  }
}
