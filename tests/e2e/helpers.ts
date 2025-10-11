import type { Page } from "@playwright/test";

declare global {
  interface Window {
    demo?: {
      reset?: () => void;
      startRun?: (seconds: number) => boolean;
      start?: () => boolean;
      selectDuration?: (seconds: number) => boolean;
      readRemainingSeconds?: () => number | undefined;
      getPrimaryActionKind?: () => string | undefined;
      captureRemainingSequence?: (options?: {
        durationMs?: number;
        maxSamples?: number;
      }) => Promise<number[]> | number[];
    };
  }
}

export async function resetDemo(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.demo?.reset?.();
  });
}

export async function startRun(page: Page, seconds: number): Promise<void> {
  await resetDemo(page);
  const started = await page.evaluate((duration) => {
    return window.demo?.startRun?.(duration) ?? false;
  }, seconds);
  if (!started) {
    throw new Error("failed to start demo run");
  }
  await page.waitForFunction(() => window.demo?.getPrimaryActionKind?.() === "restart");
}

export async function readRemainingSeconds(page: Page): Promise<number | undefined> {
  return page.evaluate(() => window.demo?.readRemainingSeconds?.());
}

export async function waitForRemainingSample(
  page: Page,
): Promise<{ remaining: number; timestamp: number }> {
  const handle = await page.waitForFunction<{ remaining: number; timestamp: number } | null>(() => {
    const remaining = window.demo?.readRemainingSeconds?.();
    const action = window.demo?.getPrimaryActionKind?.();
    if (typeof remaining === "number" && action === "restart") {
      return { remaining, timestamp: performance.now() };
    }
    return null;
  });
  const result = await handle.jsonValue();
  if (!result) {
    throw new Error("remaining sample unavailable");
  }
  return result;
}

export async function captureRemainingSequence(
  page: Page,
  options: { durationMs?: number; maxSamples?: number } = {},
): Promise<number[]> {
  return page.evaluate((settings) => {
    return window.demo?.captureRemainingSequence?.(settings) ?? [];
  }, options);
}
