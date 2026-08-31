#!/usr/bin/env bash
# Delegates to the Node sync script which handles old.json + diff.json (UUID) generation.
# Keeps the globs narrow: only new.json triggers rotation; old/diff are derived.
# Usage: rotate-offerings.sh <before-sha>
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Prefer tsx if available, fallback to npx
if command -v pnpm >/dev/null 2>&1; then
  pnpm --filter @workspace/registry sync -- "${1:-}" 2>&1 || node --loader tsx "$SCRIPT_DIR/sync-offerings.ts" "${1:-}"
else
  npx tsx "$SCRIPT_DIR/sync-offerings.ts" "${1:-}"
fi
