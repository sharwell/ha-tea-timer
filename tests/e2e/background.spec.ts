import { expect, test } from "@playwright/test";
import { captureRemainingSequence, startRun } from "./helpers";

test.describe("background resume", () => {
  test("does not tick upward after returning to foreground", async ({ context, page }) => {
    await page.goto("/");
    await startRun(page, 240);

    const preBlurHandle = await page.waitForFunction(() => window.demo?.readRemainingSeconds?.());
    const preBlur = Number(await preBlurHandle.jsonValue());

    const secondary = await context.newPage();
    await secondary.goto("/");

    await secondary.bringToFront();
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("hidden");

    await secondary.waitForTimeout(3100);

    await page.bringToFront();
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe("visible");

    const resumedValues = await captureRemainingSequence(page, { durationMs: 2000, maxSamples: 6 });

    expect(resumedValues.length).toBeGreaterThan(0);
    expect(resumedValues[0]).toBeLessThanOrEqual(preBlur);
    for (let index = 1; index < resumedValues.length; index += 1) {
      expect(resumedValues[index]).toBeLessThanOrEqual(resumedValues[index - 1]);
    }

    await secondary.close();
  });
});
