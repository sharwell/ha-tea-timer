export interface QuantizerPolicy {
  /**
   * Amount of hysteresis applied near second boundaries. Higher values delay
   * transitions to the next integer second and absorb small upward corrections
   * that would otherwise momentarily raise the display.
   */
  hysteresisMs: number;
}

export const DEFAULT_QUANTIZER_POLICY: QuantizerPolicy = {
  hysteresisMs: 150,
};

export function quantizeDisplaySeconds(
  remainingMs: number,
  prevDisplaySeconds: number | undefined,
  policy: QuantizerPolicy = DEFAULT_QUANTIZER_POLICY,
): number {
  const biased = remainingMs - policy.hysteresisMs;
  const quantized = Math.max(0, Math.ceil(biased / 1000));

  if (prevDisplaySeconds !== undefined && quantized > prevDisplaySeconds) {
    return prevDisplaySeconds;
  }

  return quantized;
}
