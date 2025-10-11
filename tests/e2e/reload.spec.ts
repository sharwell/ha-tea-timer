import { expect, test } from "@playwright/test";
import { startRun, waitForRemainingSample } from "./helpers";

test.describe("reload", () => {
  test("restores running timer within ±0.5s", async ({ page }) => {
    await page.goto("/");
    await startRun(page, 240);

    const { remaining: r0, timestamp: t0 } = await waitForRemainingSample(page);

    await page.reload();

    const handle = await page.waitForFunction<{ remaining: number; timestamp: number } | null>(() => {
      const remaining = window.demo?.readRemainingSeconds?.();
      if (typeof remaining === "number") {
        return { remaining, timestamp: performance.now() };
      }
      return null;
    });
    const result = await handle.jsonValue();
    if (!result) {
      throw new Error("remaining sample after reload unavailable");
    }
    const { remaining: r1, timestamp: t1 } = result;

    const expected = r0 - (t1 - t0) / 1000;
    expect(Math.abs(r1 - expected)).toBeLessThanOrEqual(0.5);
  });
});
