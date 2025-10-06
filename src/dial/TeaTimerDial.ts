import { css, html, LitElement, nothing, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";
import { DurationBounds, normalizeDurationSeconds } from "../model/duration";
import type { TimerStatus } from "../state/TimerStateMachine";
import { DialGestureTracker } from "./DialGestureTracker";

const TAU = Math.PI * 2;
const KEY_STEP_SECONDS = 30;
const PROGRESS_VIEWBOX_SIZE = 100;
const PROGRESS_STROKE = 6;
const PROGRESS_RADIUS = PROGRESS_VIEWBOX_SIZE / 2 - PROGRESS_STROKE / 2;
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS;
const PROGRESS_CIRCUMFERENCE_TEXT = PROGRESS_CIRCUMFERENCE.toFixed(3);

const POINTER_DRAG_SLOP_PX = 8;

@customElement("tea-timer-dial")
export class TeaTimerDial extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      justify-content: center;
      color: var(--primary-text-color, #1f2933);
    }

    .dial-root {
      position: relative;
      width: 184px;
      height: 184px;
      border-radius: 50%;
      --dial-border-color: var(--divider-color, rgba(0, 0, 0, 0.12));
      --dial-track-color: var(--divider-color, rgba(0, 0, 0, 0.16));
      --dial-progress-color: var(--info-color, rgba(0, 122, 255, 0.85));
      border: 3px solid var(--dial-border-color);
      display: grid;
      place-items: center;
      text-align: center;
      color: var(--secondary-text-color, #52606d);
      padding: 16px;
      gap: 4px;
      touch-action: none;
      outline: none;
      background: var(--mdc-theme-surface, var(--ha-card-background, #fff));
      transition: border-color 160ms ease, background 160ms ease;
    }

    .dial-root:focus-visible {
      box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.28);
    }

    .dial-root[data-status="finished"] {
      --dial-border-color: var(--success-color, rgba(73, 190, 125, 0.6));
      --dial-track-color: rgba(73, 190, 125, 0.22);
      --dial-progress-color: var(--success-color, rgba(73, 190, 125, 0.9));
      background: rgba(73, 190, 125, 0.08);
      color: var(--primary-text-color, #1f2933);
    }

    .dial-root[data-status="running"] {
      --dial-border-color: var(--info-color, rgba(0, 122, 255, 0.4));
      --dial-track-color: rgba(0, 122, 255, 0.22);
      --dial-progress-color: var(--info-color, rgba(0, 122, 255, 0.9));
      background: rgba(0, 122, 255, 0.05);
      color: var(--primary-text-color, #1f2933);
    }

    .dial-root[data-status="paused"] {
      --dial-border-color: rgba(250, 204, 21, 0.5);
      --dial-track-color: rgba(250, 204, 21, 0.24);
      --dial-progress-color: rgba(250, 204, 21, 0.8);
      background: rgba(250, 204, 21, 0.08);
      color: var(--primary-text-color, #1f2933);
    }

    .dial-root[data-status="unavailable"] {
      opacity: 0.6;
    }

    .dial-track {
      position: absolute;
      inset: 10px;
      border-radius: 50%;
      border: 2px solid var(--dial-track-color);
      opacity: 0.7;
    }

    .dial-progress-ring {
      position: absolute;
      inset: 10px;
      pointer-events: none;
    }

    .dial-progress-track {
      fill: none;
      stroke: var(--dial-track-color);
      stroke-width: ${unsafeCSS(PROGRESS_STROKE)};
      stroke-linecap: round;
      opacity: 0.4;
      transition: stroke 160ms ease;
    }

    .dial-progress-arc {
      fill: none;
      stroke: var(--dial-progress-color);
      stroke-width: ${unsafeCSS(PROGRESS_STROKE)};
      stroke-linecap: round;
      transform: rotate(-90deg);
      transform-origin: 50% 50%;
      stroke-dasharray: ${unsafeCSS(PROGRESS_CIRCUMFERENCE_TEXT)};
      stroke-dashoffset: ${unsafeCSS(PROGRESS_CIRCUMFERENCE_TEXT)};
      transition: stroke 160ms ease, stroke-dashoffset 480ms cubic-bezier(0.33, 1, 0.68, 1);
      opacity: 0.9;
    }

    .dial-handle {
      position: absolute;
      inset: 0;
      pointer-events: none;
      transform: rotate(0deg);
      opacity: 1;
      visibility: visible;
      transition: transform 80ms ease-out, opacity 160ms ease;
      color: var(--dial-handle-color, var(--primary-color, #1f2933));
    }

    .dial-root[data-pointer="true"] .dial-handle {
      transition: none;
    }

    .dial-root.is-running .dial-handle,
    .dial-root.is-paused .dial-handle {
      opacity: 0;
      visibility: hidden;
    }

    .dial-handle-dot {
      position: absolute;
      top: 8px;
      left: calc(50% - 10px);
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: currentColor;
      border: 2px solid var(
        --dial-handle-ring-color,
        var(--mdc-theme-surface, var(--ha-card-background, #fff))
      );
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
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

      .dial-progress-arc {
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

  private progressFraction = 0;

  private pendingProgressSync = false;

  private pointerStartX: number | undefined;

  private pointerStartY: number | undefined;

  private pointerDragExceededSlop = false;

  private suppressNextClick = false;

  private readonly pointerMoveHandler = (event: PointerEvent) => this.handlePointerMove(event);

  private readonly pointerEndHandler = (event: PointerEvent) => this.handlePointerEnd(event);

  private readonly rootPointerDownHandler = (event: PointerEvent) => this.handlePointerDown(event);

  private readonly rootClickHandler = (event: MouseEvent) => this.handleRootClick(event);

  private readonly rootKeyDownHandler = (event: KeyboardEvent) => this.handleKeyDown(event);

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has("value") || changed.has("bounds")) {
      this.syncNormalizedFromValue();
    }

    if (this.pendingProgressSync) {
      this.pendingProgressSync = !this.syncProgressElement();
    }
  }

  protected render() {
    const normalized = this.pointerActive
      ? this.normalizedValue
      : this.valueToNormalized(this.value);
    const baseAngle = normalized * TAU;
    const angleDegrees = (baseAngle * 180) / Math.PI;
    const fraction = this.progressFraction;
    const dashOffset = PROGRESS_CIRCUMFERENCE * (1 - fraction);
    const ariaReadonly = this.interactive ? "false" : "true";

    const status = this.status;
    let rootClass = "dial-root";
    if (status === "running") {
      rootClass += " is-running";
    } else if (status === "paused") {
      rootClass += " is-paused";
    }
    const tabIndex = this.interactive ? 0 : -1;
    const ariaDisabled = this.interactive ? "false" : "true";

    return html`
      <div
        class=${rootClass}
        role="slider"
        .tabIndex=${tabIndex}
        data-status=${this.status}
        data-pointer=${this.pointerActive ? "true" : "false"}
        aria-label=${this.ariaLabel || nothing}
        aria-readonly=${ariaReadonly}
        aria-disabled=${ariaDisabled}
        aria-valuemin=${this.bounds.min}
        aria-valuemax=${this.bounds.max}
        aria-valuenow=${Math.round(this.value)}
        aria-valuetext=${this.valueText || nothing}
        @pointerdown=${this.rootPointerDownHandler}
        @click=${this.rootClickHandler}
        @keydown=${this.rootKeyDownHandler}
      >
        <div class="dial-track"></div>
        <svg
          class="dial-progress-ring"
          viewBox=${`0 0 ${PROGRESS_VIEWBOX_SIZE} ${PROGRESS_VIEWBOX_SIZE}`}
          aria-hidden="true"
        >
          <circle
            class="dial-progress-track"
            cx=${PROGRESS_VIEWBOX_SIZE / 2}
            cy=${PROGRESS_VIEWBOX_SIZE / 2}
            r=${PROGRESS_RADIUS}
          ></circle>
          <circle
            class="dial-progress-arc"
            cx=${PROGRESS_VIEWBOX_SIZE / 2}
            cy=${PROGRESS_VIEWBOX_SIZE / 2}
            r=${PROGRESS_RADIUS}
            stroke-dashoffset=${dashOffset.toFixed(3)}
          ></circle>
        </svg>
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

    this.pointerStartX = Number.isFinite(event.clientX) ? event.clientX : undefined;
    this.pointerStartY = Number.isFinite(event.clientY) ? event.clientY : undefined;
    this.pointerDragExceededSlop = false;
    this.suppressNextClick = false;

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

    if (
      !this.pointerDragExceededSlop &&
      this.pointerStartX !== undefined &&
      this.pointerStartY !== undefined &&
      Number.isFinite(event.clientX) &&
      Number.isFinite(event.clientY)
    ) {
      const dx = event.clientX - this.pointerStartX;
      const dy = event.clientY - this.pointerStartY;
      if (Math.hypot(dx, dy) >= POINTER_DRAG_SLOP_PX) {
        this.pointerDragExceededSlop = true;
        this.suppressNextClick = true;
      }
    }

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

    const dragged = this.pointerDragExceededSlop;
    this.pointerStartX = undefined;
    this.pointerStartY = undefined;
    this.pointerDragExceededSlop = false;
    if (!dragged) {
      this.suppressNextClick = false;
    }

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

  private handleRootClick(event: MouseEvent): void {
    if (!this.suppressNextClick) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.suppressNextClick = false;
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

  public setProgressFraction(fraction: number): void {
    const clamped = Math.min(1, Math.max(0, fraction));
    if (Math.abs(this.progressFraction - clamped) <= 1e-4) {
      return;
    }

    this.progressFraction = clamped;
    if (!this.syncProgressElement()) {
      this.pendingProgressSync = true;
      this.requestUpdate();
    }
  }

  private syncProgressElement(): boolean {
    const arc = this.shadowRoot?.querySelector<SVGCircleElement>(".dial-progress-arc");
    if (!arc) {
      return false;
    }

    const offset = PROGRESS_CIRCUMFERENCE * (1 - this.progressFraction);
    const offsetText = offset.toFixed(3);
    if (arc.style.strokeDashoffset !== offsetText) {
      arc.style.strokeDashoffset = offsetText;
    }
    return true;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tea-timer-dial": TeaTimerDial;
  }
}
