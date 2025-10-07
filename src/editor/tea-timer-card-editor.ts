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
  confirmRestart: "Ask for confirmation when resuming a completed brew.",
  disableClockSkewEstimator: "Bypass network clock drift smoothing (advanced).",
  minDurationSeconds: "Lower bound for the dial when dragging presets. Defaults to 15 seconds.",
  maxDurationSeconds: "Upper bound for the dial when dragging presets. Defaults to 1200 seconds.",
  stepSeconds: "Dial increments when adjusting custom times. Defaults to 5 seconds.",
  finishedAutoIdleMs: "Delay before returning to idle after the finished overlay appears. Defaults to 5000 ms.",
};

const DOCUMENTATION_LINKS = [
  {
    label: "Quick start guide",
    href: "https://github.com/sharwell/ha-tea-timer/blob/main/docs/getting-started.md",
    ariaLabel: "Open the quick start guide in a new tab",
  },
  {
    label: "Automate on timer.finished",
    href: "https://github.com/sharwell/ha-tea-timer/blob/main/docs/automations/finished.md",
    ariaLabel: "Open the automate on timer.finished guide in a new tab",
  },
] as const;

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

    .default-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.9rem;
    }

    .default-toggle input[type="checkbox"] {
      width: 16px;
      height: 16px;
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

    .editor-help {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--divider-color, #bdbdbd);
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 0.9rem;
    }

    .editor-help-links {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .editor-help a {
      color: var(--primary-color);
    }
  `;

  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: TeaTimerCardConfig & Record<string, unknown>;

  @state() private _formData: TeaTimerEditorFormData = {
    base: {},
    presets: [{}],
    advanced: {},
    defaultPreset: {},
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
      defaultPreset: { ...data.defaultPreset },
    };
  }

  public render() {
    if (!this._config) {
      return nothing;
    }

    return html`
      <ha-form
        .hass=${this.hass}
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
            .hass=${this.hass}
            .data=${this._formData.advanced}
            .schema=${ADVANCED_FORM_SCHEMA}
            .computeLabel=${this._computeLabel}
            .computeHelper=${this._computeHelper}
            @value-changed=${this._handleAdvancedChanged}
          ></ha-form>
        </div>
      </details>

      <footer class="editor-help">
        <span id="documentation-links-heading">Documentation</span>
        <div class="editor-help-links" aria-labelledby="documentation-links-heading">
          ${DOCUMENTATION_LINKS.map(
            (link) => html`
              <a
                href=${link.href}
                target="_blank"
                rel="noreferrer"
                aria-label="${link.ariaLabel} (opens in new tab)"
              >
                ${link.label}
              </a>
            `,
          )}
        </div>
      </footer>
    `;
  }

  private _renderPresetRow(preset: TeaTimerEditorPresetFormData, index: number) {
    return html`
      <div class="preset-row">
        <ha-form
          .hass=${this.hass}
          .data=${preset}
          .schema=${PRESET_FORM_SCHEMA}
          .computeLabel=${this._computeLabel}
          .computeHelper=${this._computeHelper}
          @value-changed=${(event: CustomEvent<{ value: TeaTimerEditorPresetFormData }>) =>
            this._handlePresetChanged(index, event)}
        ></ha-form>
        <div class="preset-actions">
          <label class="default-toggle">
            <input
              type="checkbox"
              .checked=${this._formData.defaultPreset.index === index}
              @change=${(event: Event) => this._handleDefaultPresetToggle(index, event)}
              aria-label="Toggle default preset"
            />
            Default preset
          </label>
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
    this._updateForm({ base: { ...this._formData.base, ...event.detail.value } });
  };

  private _handleAdvancedChanged = (event: CustomEvent<{ value: TeaTimerEditorAdvancedFormData }>) => {
    event.stopPropagation();
    this._updateForm({ advanced: { ...event.detail.value } });
  };

  private _handlePresetChanged(index: number, event: CustomEvent<{ value: TeaTimerEditorPresetFormData }>) {
    event.stopPropagation();
    const presets = this._formData.presets.map((preset, presetIndex) =>
      presetIndex === index ? { ...event.detail.value } : { ...preset },
    );

    const updates: Partial<TeaTimerEditorFormData> = { presets };

    if (this._formData.defaultPreset.index === index) {
      const value = this._computeDefaultPresetValue(presets[index], index);
      this._defaultPresetWasNumber = typeof value === "number";
      updates.defaultPreset = { value, index };
    }

    this._updateForm(updates);
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
    const defaultPreset = this._recomputeDefaultPreset(presets, index);
    const updates: Partial<TeaTimerEditorFormData> = { presets };
    if (defaultPreset.index !== undefined) {
      updates.defaultPreset = defaultPreset;
    } else if (this._formData.defaultPreset.index !== undefined) {
      updates.defaultPreset = {};
    }
    this._updateForm(updates);
  }

  private _handleDefaultPresetToggle(index: number, event: Event) {
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }

    const updates: Partial<TeaTimerEditorFormData> = {};
    if (input.checked) {
      const preset = this._formData.presets[index];
      const value = this._computeDefaultPresetValue(preset, index);
      this._defaultPresetWasNumber = typeof value === "number";
      updates.defaultPreset = { value, index };
    } else {
      this._defaultPresetWasNumber = false;
      updates.defaultPreset = {};
    }

    this._updateForm(updates);
  }

  private _computeDefaultPresetValue(preset: TeaTimerEditorPresetFormData, index: number): string | number {
    if (this._defaultPresetWasNumber) {
      return index;
    }

    const label = typeof preset.label === "string" ? preset.label.trim() : "";
    if (label.length) {
      return label;
    }

    return index;
  }

  private _recomputeDefaultPreset(
    presets: TeaTimerEditorPresetFormData[],
    removedIndex?: number,
  ): TeaTimerEditorFormData["defaultPreset"] {
    const current = this._formData.defaultPreset;
    if (current.value === undefined) {
      this._defaultPresetWasNumber = false;
      return {};
    }

    if (typeof current.value === "number") {
      if (removedIndex !== undefined) {
        if (current.value === removedIndex) {
          this._defaultPresetWasNumber = false;
          return {};
        }
        const adjusted = current.value > removedIndex ? current.value - 1 : current.value;
        if (adjusted < 0 || adjusted >= presets.length) {
          this._defaultPresetWasNumber = false;
          return {};
        }
        this._defaultPresetWasNumber = true;
        return { value: adjusted, index: adjusted };
      }

      if (current.value < 0 || current.value >= presets.length) {
        this._defaultPresetWasNumber = false;
        return {};
      }
      this._defaultPresetWasNumber = true;
      return { value: current.value, index: current.value };
    }

    const matchedIndex = presets.findIndex((preset) => preset.label === current.value);
    if (matchedIndex >= 0) {
      this._defaultPresetWasNumber = false;
      return { value: current.value, index: matchedIndex };
    }

    this._defaultPresetWasNumber = false;
    return {};
  }

  private _updateForm(update: Partial<TeaTimerEditorFormData>) {
    if (!this._config) {
      return;
    }

    const nextFormData: TeaTimerEditorFormData = {
      base: update.base ? { ...update.base } : { ...this._formData.base },
      presets: update.presets
        ? update.presets.map((preset) => ({ ...preset }))
        : this._formData.presets.map((preset) => ({ ...preset })),
      advanced: update.advanced ? { ...update.advanced } : { ...this._formData.advanced },
      defaultPreset: update.defaultPreset ? { ...update.defaultPreset } : { ...this._formData.defaultPreset },
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
