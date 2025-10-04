import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIST_DIR = path.join(ROOT_DIR, "dist");

async function main() {
  let entries;
  try {
    entries = await fs.readdir(DIST_DIR);
  } catch (error) {
    throw new Error(`Failed to read dist directory at ${DIST_DIR}: ${error.message}`);
  }

  if (!entries.includes("tea-timer-card.js")) {
    throw new Error("Expected dist/tea-timer-card.js to be present after the build.");
  }

  const hashedBundles = entries.filter((name) => /^tea-timer-card\.[^.]+\.js$/.test(name));
  if (hashedBundles.length === 0) {
    throw new Error("Expected at least one fingerprinted bundle matching dist/tea-timer-card.<hash>.js.");
  }

  for (const bundle of hashedBundles) {
    const mapName = `${bundle}.map`;
    if (!entries.includes(mapName)) {
      throw new Error(`Expected source map ${mapName} for bundle ${bundle}.`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
