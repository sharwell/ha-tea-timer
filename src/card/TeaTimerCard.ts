import { html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { baseStyles } from "../styles/base";
import { cardStyles } from "../styles/card";
import { parseTeaTimerConfig, TeaTimerConfig } from "../model/config";
import { createTeaTimerViewModel, TeaTimerViewModel } from "../view/TeaTimerViewModel";
import { STRINGS } from "../strings";
import type { LovelaceCard } from "../types/home-assistant";

export class TeaTimerCard extends LitElement implements LovelaceCard {
  static styles = [baseStyles, cardStyles];

  @property({ attribute: false })
  public hass?: unknown;

  @state()
  private _config?: TeaTimerConfig;

  @state()
  private _viewModel?: TeaTimerViewModel;

  @state()
  private _errors: string[] = [];

  public setConfig(config: unknown): void {
    const result = parseTeaTimerConfig(config);
    this._errors = result.errors;
    this._config = result.config ?? undefined;
    this._viewModel = this._config ? createTeaTimerViewModel(this._config) : undefined;
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
        ${this._renderDial()}
        ${this._renderPresets()}
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
    return html`<div class="dial" aria-hidden="true">00:00</div>`;
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
}

declare global {
  interface HTMLElementTagNameMap {
    "tea-timer-card": TeaTimerCard;
  }
}
