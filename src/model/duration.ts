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
  const { hours, minutes, seconds } = splitDurationSeconds(durationSeconds);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export interface DurationSpeechStrings {
  hour: (value: number) => string;
  minute: (value: number) => string;
  second: (value: number) => string;
  list: (parts: string[]) => string;
}

export function splitDurationSeconds(durationSeconds: number): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  const totalSeconds = Math.max(0, Math.floor(durationSeconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds };
}

export function formatDurationSpeech(
  durationSeconds: number,
  strings: DurationSpeechStrings,
): string {
  const { hours, minutes, seconds } = splitDurationSeconds(durationSeconds);
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(strings.hour(hours));
  }

  if (minutes > 0) {
    parts.push(strings.minute(minutes));
  }

  if (seconds > 0 || parts.length === 0) {
    parts.push(strings.second(seconds));
  }

  return strings.list(parts);
}
