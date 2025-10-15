import { expect, test } from "@playwright/test";
import { readRemainingSeconds, startRun } from "./helpers";

test.describe("multi-device", () => {
  test("contexts stay within 0.5s", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    try {
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();

      await pageA.goto("/");
      await pageB.goto("/");

      await startRun(pageA, 120);

      await expect
        .poll(async () => {
          const [remainingA, remainingB] = await Promise.all([
            readRemainingSeconds(pageA),
            readRemainingSeconds(pageB),
          ]);
          if (typeof remainingA !== "number" || typeof remainingB !== "number") {
            return Number.POSITIVE_INFINITY;
          }
          return Math.abs(remainingA - remainingB);
        }, { timeout: 2000 })
        .toBeLessThanOrEqual(0.5);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
