import { execSync } from "node:child_process";
import type { FullConfig } from "@playwright/test";

async function globalSetup(_config: FullConfig) {
  if (process.env.PLAYWRIGHT_SKIP_BUILD === "1") {
    return;
  }
  execSync("npm run build", { stdio: "inherit" });
}

export default globalSetup;
