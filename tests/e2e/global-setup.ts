import { execSync } from "node:child_process";
import type { FullConfig } from "@playwright/test";

function globalSetup(_config: FullConfig): void {
  if (process.env.PLAYWRIGHT_SKIP_BUILD === "1") {
    return;
  }
  execSync("npm run build", { stdio: "inherit" });
}

export default globalSetup;
