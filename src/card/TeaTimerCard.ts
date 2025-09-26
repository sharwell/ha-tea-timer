import { html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { baseStyles } from "../styles/base";
import { cardStyles } from "../styles/card";
import { parseTeaTimerConfig, TeaTimerConfig } from "../model/config";
import { createTeaTimerViewModel, TeaTimerViewModel } from "../view/TeaTimerViewModel";
import { STRINGS } from "../strings";
import type { HomeAssistant, LovelaceCard } from "../types/home-assistant";
import { TimerStateController } from "../state/TimerStateController";
import type { TimerViewState, TimerStatus } from "../state/TimerStateMachine";
import { formatDurationSeconds } from "../model/duration";

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
  private _ariaAnnouncement = "";

  private _lastAnnouncedStatus?: TimerStatus;

  private readonly _timerStateController: TimerStateController;

  constructor() {
    super();
    this._timerStateController = new TimerStateController(this, {
      finishedOverlayMs: 5000,
      onStateChanged: (state) => {
        this._timerState = state;
        this._handleAriaAnnouncement(state);
      },
    });
    this._timerState = this._timerStateController.state;
  }

  public setConfig(config: unknown): void {
    const result = parseTeaTimerConfig(config);
    this._errors = result.errors;
    this._config = result.config ?? undefined;
    this._viewModel = this._config ? createTeaTimerViewModel(this._config) : undefined;
    this._timerStateController.setEntityId(this._config?.entity);
    this.requestUpdate();
  }

  // eslint-disable-next-line class-methods-use-this
  public getCardSize(): number {
    return 4;
  }

  protected render() {
    return html`
      ${this._renderErrors()}
      <section class="card" data-instance-id=${this._config?.cardInstanceId ?? "unconfigured"}>
        ${this._renderHeader()}
        ${this._renderStatusPill()}
        ${this._renderDial()}
        ${this._renderPresets()}
        <div class="sr-only" aria-live="polite">${this._ariaAnnouncement}</div>
        <p class="note">${STRINGS.draftNote}</p>
        <a class="help" href=${STRINGS.gettingStartedUrl} target="_blank" rel="noreferrer">
          ${STRINGS.gettingStartedLabel}
        </a>
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
    const primary = this._getPrimaryDialLabel(state);
    const secondary = this._getSecondaryDialLabel(state);
    const estimation = this._getEstimationNotice(state);

    return html`
      <div class="dial" data-status=${status} aria-hidden="true">
        <span class="dial-primary">${primary}</span>
        <span class="dial-secondary">${secondary}</span>
      </div>
      ${estimation ? html`<p class="estimation" role="note">${estimation}</p>` : nothing}
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

  private _renderStatusPill() {
    const state = this._timerState ?? this._timerStateController.state;
    const label = this._getStatusLabel(state.status);
    return html`<span class="status-pill status-${state.status}" aria-hidden="true">${label}</span>`;
  }

  private _getPrimaryDialLabel(state: TimerViewState): string {
    if (state.status === "finished") {
      return STRINGS.timerFinished;
    }

    if (state.status === "running") {
      if (state.remainingSeconds !== undefined) {
        return formatDurationSeconds(state.remainingSeconds);
      }
      return STRINGS.timeUnknown;
    }

    if (state.status === "idle") {
      if (state.remainingSeconds !== undefined) {
        return formatDurationSeconds(state.remainingSeconds);
      }
      if (state.durationSeconds !== undefined) {
        return formatDurationSeconds(state.durationSeconds);
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
}

declare global {
  interface HTMLElementTagNameMap {
    "tea-timer-card": TeaTimerCard;
  }
}
