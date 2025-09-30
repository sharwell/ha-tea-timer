import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { DurationBounds, normalizeDurationSeconds } from "../model/duration";
import type { TimerStatus } from "../state/TimerStateMachine";
import { DialGestureTracker } from "./DialGestureTracker";

const TAU = Math.PI * 2;
const KEY_STEP_SECONDS = 30;

@customElement("tea-timer-dial")
export class TeaTimerDial extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      justify-content: center;
    }

    .dial-root {
      position: relative;
      width: 184px;
      height: 184px;
      border-radius: 50%;
      border: 3px solid var(--divider-color, rgba(0, 0, 0, 0.12));
      display: grid;
      place-items: center;
      text-align: center;
      color: var(--secondary-text-color, #52606d);
      padding: 16px;
      gap: 4px;
      touch-action: none;
      outline: none;
      background: var(--ha-card-background, #fff);
      transition: border-color 120ms ease, background 120ms ease;
    }

    .dial-root:focus-visible {
      box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.28);
    }

    .dial-root[data-status="finished"] {
      border-color: var(--success-color, rgba(73, 190, 125, 0.6));
      background: rgba(73, 190, 125, 0.08);
      color: var(--primary-text-color, #1f2933);
    }

    .dial-root[data-status="running"] {
      border-color: var(--info-color, rgba(0, 122, 255, 0.4));
      background: rgba(0, 122, 255, 0.05);
      color: var(--primary-text-color, #1f2933);
    }

    .dial-root[data-status="unavailable"] {
      opacity: 0.6;
    }

    .dial-track {
      position: absolute;
      inset: 10px;
      border-radius: 50%;
      border: 2px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    }

    .dial-progress {
      position: absolute;
      inset: 10px;
      border-radius: 50%;
      background: conic-gradient(
        var(--info-color, rgba(0, 122, 255, 0.4)) 0deg,
        rgba(0, 0, 0, 0.05) 0deg
      );
      opacity: 0.2;
    }

    .dial-handle {
      position: absolute;
      inset: 0;
      pointer-events: none;
      transform: rotate(0deg);
      transition: transform 80ms ease-out;
    }

    .dial-root[data-pointer="true"] .dial-handle {
      transition: none;
    }

    .dial-handle-dot {
      position: absolute;
      top: 8px;
      left: calc(50% - 10px);
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--primary-color, #1f2933);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    }

    .dial-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      pointer-events: none;
    }

    ::slotted([slot="primary"]) {
      font-size: 1.8rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    ::slotted([slot="secondary"]) {
      font-size: 0.95rem;
      color: var(--secondary-text-color, #52606d);
    }

    @media (prefers-reduced-motion: reduce) {
      .dial-root,
      .dial-handle {
        transition: none !important;
      }
    }
  `;

  @property({ type: Number })
  public value = 0;

  @property({ attribute: false })
  public bounds: DurationBounds = { min: 0, max: 0, step: 1 };

  @property({ type: Boolean, reflect: true })
  public interactive = false;

  @property({ type: String })
  public status: TimerStatus = "idle";

  @property({ type: String })
  public ariaLabel = "";

  @property({ type: String })
  public valueText = "";

  private pointerActive = false;

  private readonly gestureTracker = new DialGestureTracker(0);

  private normalizedValue = 0;

  private skipTrackerSync = false;

  private readonly pointerMoveHandler = (event: PointerEvent) => this.handlePointerMove(event);

  private readonly pointerEndHandler = (event: PointerEvent) => this.handlePointerEnd(event);

  private readonly rootPointerDownHandler = (event: PointerEvent) => this.handlePointerDown(event);

  private readonly rootKeyDownHandler = (event: KeyboardEvent) => this.handleKeyDown(event);

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has("value") || changed.has("bounds")) {
      this.syncNormalizedFromValue();
    }
  }

  protected render() {
    const normalized = this.pointerActive
      ? this.normalizedValue
      : this.valueToNormalized(this.value);
    const baseAngle = normalized * TAU;
    const angleDegrees = (baseAngle * 180) / Math.PI;
    const ariaReadonly = this.interactive ? "false" : "true";

    return html`
      <div
        class="dial-root"
        role="slider"
        tabindex="0"
        data-status=${this.status}
        data-pointer=${this.pointerActive ? "true" : "false"}
        aria-label=${this.ariaLabel || nothing}
        aria-readonly=${ariaReadonly}
        aria-valuemin=${this.bounds.min}
        aria-valuemax=${this.bounds.max}
        aria-valuenow=${Math.round(this.value)}
        aria-valuetext=${this.valueText || nothing}
        @pointerdown=${this.rootPointerDownHandler}
        @keydown=${this.rootKeyDownHandler}
      >
        <div class="dial-track"></div>
        <div class="dial-progress" aria-hidden="true"></div>
        <div class="dial-handle" style=${`transform: rotate(${angleDegrees}deg);`} aria-hidden="true">
          <div class="dial-handle-dot"></div>
        </div>
        <div class="dial-content">
          <slot name="primary"></slot>
          <slot name="secondary"></slot>
        </div>
      </div>
    `;
  }

  private handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }

    if (!this.interactive) {
      this.notifyBlocked();
      return;
    }

    const target = event.currentTarget as HTMLElement | null;
    if (!target) {
      return;
    }

    event.preventDefault();
    target.setPointerCapture(event.pointerId);
    target.addEventListener("pointermove", this.pointerMoveHandler);
    target.addEventListener("pointerup", this.pointerEndHandler);
    target.addEventListener("pointercancel", this.pointerEndHandler);

    this.setPointerActive(true);
    this.gestureTracker.setNormalized(this.normalizedValue);

    const raw = this.getRawNormalized(event, target);
    const normalized = this.gestureTracker.jumpToRaw(raw);
    this.setNormalizedValue(normalized);
    this.emitValueFromNormalized(normalized);
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.pointerActive) {
      return;
    }

    const target = event.currentTarget as HTMLElement | null;
    if (!target) {
      return;
    }

    event.preventDefault();
    const raw = this.getRawNormalized(event, target);
    const normalized = this.gestureTracker.updateFromRaw(raw);
    this.setNormalizedValue(normalized);
    this.emitValueFromNormalized(normalized);
  }

  private handlePointerEnd(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement | null;
    if (target) {
      target.removeEventListener("pointermove", this.pointerMoveHandler);
      target.removeEventListener("pointerup", this.pointerEndHandler);
      target.removeEventListener("pointercancel", this.pointerEndHandler);
      if (target.hasPointerCapture(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
      }
    }

    this.setPointerActive(false);
    this.gestureTracker.setNormalized(this.normalizedValue);

    const finalValue = normalizeDurationSeconds(
      this.normalizedToValue(this.normalizedValue),
      this.bounds,
    );
    this.dispatchInput(finalValue);

    this.dispatchEvent(
      new CustomEvent("dial-change-end", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const { key } = event;
    let delta = 0;

    const isRtl = this.getEffectiveDirection() === "rtl";

    switch (key) {
      case "ArrowLeft":
        delta = isRtl ? this.bounds.step : -this.bounds.step;
        break;
      case "ArrowRight":
        delta = isRtl ? -this.bounds.step : this.bounds.step;
        break;
      case "ArrowDown":
        delta = -this.bounds.step;
        break;
      case "ArrowUp":
        delta = this.bounds.step;
        break;
      case "PageDown":
        delta = -KEY_STEP_SECONDS;
        break;
      case "PageUp":
        delta = KEY_STEP_SECONDS;
        break;
      default:
        return;
    }

    event.preventDefault();

    if (!this.interactive) {
      this.notifyBlocked();
      return;
    }

    const nextValue = normalizeDurationSeconds(this.value + delta, this.bounds);
    if (nextValue === this.value) {
      return;
    }

    this.value = nextValue;
    this.syncNormalizedFromValue();
    this.dispatchInput(nextValue);
  }

  private notifyBlocked(): void {
    this.dispatchEvent(
      new CustomEvent("dial-blocked", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private emitValueFromNormalized(normalized: number): void {
    const value = normalizeDurationSeconds(this.normalizedToValue(normalized), this.bounds);
    if (value === this.value) {
      return;
    }

    this.skipTrackerSync = true;
    this.value = value;
    this.dispatchInput(value);
  }

  private dispatchInput(value: number): void {
    this.dispatchEvent(
      new CustomEvent("dial-input", {
        detail: { value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private getEffectiveDirection(): "ltr" | "rtl" {
    const dirAttr = (this as HTMLElement).dir;
    if (dirAttr === "rtl" || dirAttr === "ltr") {
      return dirAttr;
    }

    const computed = getComputedStyle(this).direction;
    return computed === "rtl" ? "rtl" : "ltr";
  }

  private getRawNormalized(event: PointerEvent, element: HTMLElement): number {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const angle = Math.atan2(dy, dx) + Math.PI / 2;
    const normalized = (angle / TAU) % 1;
    return normalized < 0 ? normalized + 1 : normalized;
  }

  private normalizedToValue(normalized: number): number {
    const span = this.bounds.max - this.bounds.min;
    if (span <= 0) {
      return this.bounds.min;
    }

    return this.bounds.min + normalized * span;
  }

  private valueToNormalized(value: number): number {
    const span = this.bounds.max - this.bounds.min;
    if (span <= 0) {
      return 0;
    }

    const normalized = (value - this.bounds.min) / span;
    return Math.min(1, Math.max(0, normalized));
  }

  private syncNormalizedFromValue(): void {
    const normalized = this.valueToNormalized(this.value);
    this.setNormalizedValue(normalized);

    if (this.pointerActive) {
      if (!this.skipTrackerSync) {
        this.gestureTracker.synchronize(normalized);
      }
    } else {
      this.gestureTracker.setNormalized(normalized);
    }

    this.skipTrackerSync = false;
  }

  private setPointerActive(active: boolean): void {
    if (this.pointerActive === active) {
      return;
    }

    this.pointerActive = active;
    this.requestUpdate();
  }

  private setNormalizedValue(normalized: number): void {
    if (Math.abs(this.normalizedValue - normalized) <= 1e-6) {
      return;
    }

    this.normalizedValue = normalized;
    this.requestUpdate();
  }

}

declare global {
  interface HTMLElementTagNameMap {
    "tea-timer-dial": TeaTimerDial;
  }
}
