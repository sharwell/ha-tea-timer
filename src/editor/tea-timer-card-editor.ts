import { css, html, LitElement, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { TeaTimerCardConfig } from "../model/config";
import type { HomeAssistant, LovelaceCardEditor } from "../types/home-assistant";
import {
  ADVANCED_FORM_SCHEMA,
  BASE_FORM_SCHEMA,
  PRESET_FORM_SCHEMA,
  createConfigFromEditorFormData,
  createEditorFormData,
  type HaFormSchema,
  type TeaTimerEditorAdvancedFormData,
  type TeaTimerEditorBaseFormData,
  type TeaTimerEditorFormData,
  type TeaTimerEditorPresetFormData,
} from "./config-form";

const LABELS: Record<string, string> = {
  title: "Title",
  entity: "Timer entity",
  defaultPreset: "Default preset",
  label: "Label",
  duration: "Duration",
  minDurationSeconds: "Minimum duration (seconds)",
  maxDurationSeconds: "Maximum duration (seconds)",
  stepSeconds: "Dial step (seconds)",
  confirmRestart: "Confirm before restarting",
  finishedAutoIdleMs: "Finished overlay auto-hide (ms)",
  disableClockSkewEstimator: "Disable clock skew estimator",
};

const HELPERS: Record<string, string> = {
  defaultPreset: "Optional label or index applied when the card loads.",
  confirmRestart: "Ask for confirmation when resuming a completed brew.",
  disableClockSkewEstimator: "Bypass network clock drift smoothing (advanced).",
  minDurationSeconds: "Lower bound for the dial when dragging presets.",
  maxDurationSeconds: "Upper bound for the dial when dragging presets.",
  stepSeconds: "Dial increments when adjusting custom times.",
  finishedAutoIdleMs: "Delay before returning to idle after the finished overlay appears.",
};

@customElement("tea-timer-card-editor")
export class TeaTimerCardEditor
  extends LitElement
  implements LovelaceCardEditor
{
  public static styles = css`
    :host {
      display: block;
      color: var(--primary-text-color);
    }

    h2 {
      font-size: 1rem;
      font-weight: 600;
      margin: 16px 0 8px;
    }

    .presets {
      margin-top: 16px;
    }

    .preset-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 16px;
    }

    .preset-row ha-form {
      flex: 1;
    }

    .preset-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    button {
      font: inherit;
      padding: 6px 12px;
      border-radius: 4px;
      border: 1px solid var(--divider-color, #bdbdbd);
      background: var(--card-background-color, #fff);
      color: inherit;
      cursor: pointer;
    }

    button:hover,
    button:focus {
      background: var(--secondary-background-color, #f7f7f7);
    }

    button:focus {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }

    .preset-empty {
      color: var(--secondary-text-color);
      font-size: 0.9rem;
      margin-bottom: 8px;
    }

    details {
      margin-top: 16px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 8px;
      padding: 8px 12px;
      background: var(--card-background-color, #fff);
    }

    summary {
      cursor: pointer;
      font-weight: 600;
      list-style: none;
    }

    summary::-webkit-details-marker {
      display: none;
    }

    .advanced-content {
      margin-top: 12px;
    }
  `;

  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: TeaTimerCardConfig & Record<string, unknown>;

  @state() private _formData: TeaTimerEditorFormData = {
    base: {},
    presets: [{}],
    advanced: {},
  };

  private _defaultPresetWasNumber = false;

  public setConfig(config: TeaTimerCardConfig & Record<string, unknown>): void {
    this._config = { ...config };
    this._defaultPresetWasNumber = typeof config.defaultPreset === "number";
    const data = createEditorFormData(config);
    this._formData = {
      base: { ...data.base },
      presets: data.presets.map((preset) => ({ ...preset })),
      advanced: { ...data.advanced },
    };
  }

  public render() {
    if (!this._config) {
      return nothing;
    }

    return html`
      <ha-form
        .data=${this._formData.base}
        .schema=${BASE_FORM_SCHEMA}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._handleBaseChanged}
      ></ha-form>

      <section class="presets">
        <h2>Presets</h2>
        ${this._formData.presets.length
          ? this._formData.presets.map((preset, index) => this._renderPresetRow(preset, index))
          : html`<p class="preset-empty">No presets configured.</p>`}
        <button type="button" @click=${this._handleAddPreset}>Add preset</button>
      </section>

      <details>
        <summary>Advanced options</summary>
        <div class="advanced-content">
          <ha-form
            .data=${this._formData.advanced}
            .schema=${ADVANCED_FORM_SCHEMA}
            .computeLabel=${this._computeLabel}
            .computeHelper=${this._computeHelper}
            @value-changed=${this._handleAdvancedChanged}
          ></ha-form>
        </div>
      </details>
    `;
  }

  private _renderPresetRow(preset: TeaTimerEditorPresetFormData, index: number) {
    return html`
      <div class="preset-row">
        <ha-form
          .data=${preset}
          .schema=${PRESET_FORM_SCHEMA}
          .computeLabel=${this._computeLabel}
          .computeHelper=${this._computeHelper}
          @value-changed=${(event: CustomEvent<{ value: TeaTimerEditorPresetFormData }>) =>
            this._handlePresetChanged(index, event)}
        ></ha-form>
        <div class="preset-actions">
          <button type="button" @click=${() => this._handleRemovePreset(index)} aria-label="Remove preset">
            Remove
          </button>
        </div>
      </div>
    `;
  }

  private readonly _computeLabel = (schema: HaFormSchema): string => LABELS[schema.name] ?? schema.name;

  private readonly _computeHelper = (schema: HaFormSchema): string | undefined => HELPERS[schema.name];

  private _handleBaseChanged = (event: CustomEvent<{ value: TeaTimerEditorBaseFormData }>) => {
    event.stopPropagation();
    this._updateForm({ base: { ...event.detail.value } });
  };

  private _handleAdvancedChanged = (event: CustomEvent<{ value: TeaTimerEditorAdvancedFormData }>) => {
    event.stopPropagation();
    this._updateForm({ advanced: { ...event.detail.value } });
  };

  private _handlePresetChanged(index: number, event: CustomEvent<{ value: TeaTimerEditorPresetFormData }>) {
    event.stopPropagation();
    const presets = this._formData.presets.map((preset, presetIndex) =>
      presetIndex === index ? { ...event.detail.value } : preset,
    );
    this._updateForm({ presets });
  }

  private _handleAddPreset = () => {
    const presets = [...this._formData.presets, {}];
    this._updateForm({ presets });
  };

  private _handleRemovePreset(index: number) {
    const presets = this._formData.presets.filter((_, presetIndex) => presetIndex !== index);
    if (!presets.length) {
      presets.push({});
    }
    this._updateForm({ presets });
  }

  private _updateForm(update: Partial<TeaTimerEditorFormData>) {
    if (!this._config) {
      return;
    }

    const nextFormData: TeaTimerEditorFormData = {
      base: update.base ? { ...update.base } : { ...this._formData.base },
      presets: update.presets ? update.presets.map((preset) => ({ ...preset })) : this._formData.presets.map((preset) => ({ ...preset })),
      advanced: update.advanced ? { ...update.advanced } : { ...this._formData.advanced },
    };

    this._formData = nextFormData;
    const updatedConfig = createConfigFromEditorFormData(nextFormData, this._config, {
      defaultPresetWasNumber: this._defaultPresetWasNumber,
    });
    this._config = updatedConfig;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: updatedConfig },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tea-timer-card-editor": TeaTimerCardEditor;
  }
}
