const TAU = Math.PI * 2;

export interface DurationBounds {
  min: number;
  max: number;
  step: number;
}

export function clampDurationSeconds(value: number, bounds: DurationBounds): number {
  if (!Number.isFinite(value)) {
    return bounds.min;
  }

  return Math.min(bounds.max, Math.max(bounds.min, value));
}

export function roundDurationSeconds(value: number, stepSeconds: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const safeStep = stepSeconds > 0 ? stepSeconds : 1;
  return Math.round(value / safeStep) * safeStep;
}

export function normalizeDurationSeconds(value: number, bounds: DurationBounds): number {
  const rounded = roundDurationSeconds(value, bounds.step);
  return clampDurationSeconds(rounded, bounds);
}

export function durationToAngleRadians(value: number, bounds: DurationBounds): number {
  if (bounds.max <= bounds.min) {
    return 0;
  }

  const clamped = clampDurationSeconds(value, bounds);
  const span = bounds.max - bounds.min;
  const normalized = span === 0 ? 0 : (clamped - bounds.min) / span;
  return normalized * TAU;
}

export function formatDurationSeconds(durationSeconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationSeconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
