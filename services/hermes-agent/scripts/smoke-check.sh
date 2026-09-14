#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "=== Hermes smoke ==="
if command -v hermes >/dev/null 2>&1; then
  hermes --version || true
  hermes doctor || true
else
  echo "BLOCKER: hermes CLI not on PATH — run official installer"
fi
if [[ -n "${DATABASE_URL:-}" ]]; then echo "FAIL: DATABASE_URL set"; exit 2; fi
if [[ -n "${TELEGRAM_BOT_TOKEN:-}" ]]; then echo "FAIL: TELEGRAM_BOT_TOKEN set"; exit 2; fi
test -f "$ROOT/fixtures/daily-snapshot.mock.json"
ls "$ROOT/skills"
echo "OK"
