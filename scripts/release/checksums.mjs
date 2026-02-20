import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const OUTPUT_FILE = path.join(ROOT_DIR, "checksums.txt");

async function main() {
  let entries;
  try {
    entries = await fs.readdir(DIST_DIR, { withFileTypes: true });
  } catch (error) {
    throw new Error(
      `dist directory not found at ${DIST_DIR}. Run 'npm run build' before generating checksums.`,
    );
  }

  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (files.length === 0) {
    throw new Error("No files found in dist to checksum.");
  }

  const lines = [];
  for (const file of files) {
    const content = await fs.readFile(path.join(DIST_DIR, file));
    const digest = createHash("sha256").update(content).digest("hex");
    lines.push(`${digest}  ${file}`);
  }

  await fs.writeFile(OUTPUT_FILE, `${lines.join("\n")}\n`, "utf8");
  console.error(`Wrote SHA-256 checksums to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
