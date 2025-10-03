#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
OUTPUT_FILE="${ROOT_DIR}/checksums.txt"

if [[ ! -d "${DIST_DIR}" ]]; then
  echo "dist directory not found. Run 'npm run build' before generating checksums." >&2
  exit 1
fi

cd "${DIST_DIR}"

mapfile -t FILES < <(python3 - <<'PY'
import os

files = sorted(
    name
    for name in os.listdir('.')
    if os.path.isfile(name)
)

for name in files:
    print(name)
PY
)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No files found in dist to checksum." >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${FILES[@]}" > "${OUTPUT_FILE}"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "${FILES[@]}" > "${OUTPUT_FILE}"
else
  echo "Neither sha256sum nor shasum is available to generate checksums." >&2
  exit 1
fi

echo "Wrote SHA-256 checksums to ${OUTPUT_FILE}" >&2
