export type LayoutDensitySetting = "auto" | "compact" | "regular";

export type ResolvedLayoutDensity = "compact" | "regular";

export interface LayoutComputationInput {
  width: number;
  height: number;
  density: LayoutDensitySetting;
}

export interface LayoutComputationResult {
  density: ResolvedLayoutDensity;
  dialDiameter: number;
  dialTrackWidth: number;
  showHeaderTime: boolean;
}

const MIN_DIAL = 140;
const MAX_DIAL = 320;
const DEFAULT_PADDING = 16;
const COMPACT_FACTOR = 0.92;
const REGULAR_TRACK_WIDTH = 6;
const COMPACT_TRACK_REDUCTION = 2;

export function resolveLayoutDensity(
  width: number,
  height: number,
  density: LayoutDensitySetting,
): ResolvedLayoutDensity {
  if (density === "compact") {
    return "compact";
  }

  if (density === "regular") {
    return "regular";
  }

  if (width < 260) {
    return "compact";
  }

  if (width >= 360) {
    return "regular";
  }

  // Medium breakpoint: prefer compact, allow regular if height is ample.
  if (height >= 360) {
    return "regular";
  }

  return "compact";
}

export function computeDialDiameter(width: number, density: ResolvedLayoutDensity): number {
  const candidate = (width - 2 * DEFAULT_PADDING) * 0.86;
  const clamped = Math.min(MAX_DIAL, Math.max(MIN_DIAL, candidate));
  if (density === "compact") {
    return Math.round(clamped * COMPACT_FACTOR);
  }

  return Math.round(clamped);
}

export function computeDialTrackWidth(density: ResolvedLayoutDensity): number {
  const reduction = density === "compact" ? COMPACT_TRACK_REDUCTION : 0;
  return Math.max(2, REGULAR_TRACK_WIDTH - reduction);
}

export function computeLayout(
  input: LayoutComputationInput,
): LayoutComputationResult {
  const density = resolveLayoutDensity(input.width, input.height, input.density);
  const dialDiameter = computeDialDiameter(input.width, density);
  const dialTrackWidth = computeDialTrackWidth(density);
  const showHeaderTime = density === "compact" && dialDiameter < 160;

  return {
    density,
    dialDiameter,
    dialTrackWidth,
    showHeaderTime,
  };
}
