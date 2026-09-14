#!/usr/bin/env python3
"""Hermes runtime health — no secrets in output."""
from __future__ import annotations

import json
import os
import shutil
import sys
import time
import urllib.error
import urllib.request


def check() -> dict:
    hermes_bin = shutil.which("hermes")
    version = None
    if hermes_bin:
        try:
            import subprocess

            out = subprocess.check_output(
                [hermes_bin, "--version"], text=True, stderr=subprocess.STDOUT, timeout=15
            )
            version = out.strip().splitlines()[0][:120]
        except Exception:
            version = "installed-unknown"

    base = (os.environ.get("HERMES_ARENDA_API_BASE_URL") or "").rstrip("/")
    arenda_ok = False
    if base:
        try:
            req = urllib.request.Request(
                f"{base}/api/internal/agent/v1/health", method="GET"
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                arenda_ok = 200 <= resp.status < 300
        except (urllib.error.URLError, TimeoutError, ValueError):
            arenda_ok = False

    return {
        "service": "hermes-arenda-ai",
        "hermesVersion": version,
        "providerConfigured": bool(
            os.environ.get("NOUS_API_KEY")
            or os.environ.get("OPENROUTER_API_KEY")
            or (os.path.expanduser("~/.hermes") and os.path.isdir(os.path.expanduser("~/.hermes")))
        ),
        "providerReachable": None,  # requires authenticated doctor
        "arendaApiReachable": arenda_ok,
        "lastSuccessfulRun": None,
        "lastFailedRun": None,
        "schedulerActive": False,
        "dryRun": os.environ.get("HERMES_DRY_RUN", "true").lower() in ("1", "true", "yes"),
        "forbiddenEnvPresent": {
            "DATABASE_URL": bool(os.environ.get("DATABASE_URL")),
            "TELEGRAM_BOT_TOKEN": bool(os.environ.get("TELEGRAM_BOT_TOKEN")),
            "TTLOCK": any(k.startswith("TTLOCK") for k in os.environ),
        },
    }


def main() -> int:
    loop = "--loop" in sys.argv
    while True:
        payload = check()
        print(json.dumps(payload, ensure_ascii=False))
        forbidden = payload["forbiddenEnvPresent"]
        if any(forbidden.values()):
            print("ERROR: forbidden secrets present in Hermes env", file=sys.stderr)
            if not loop:
                return 2
        if not loop:
            return 0 if payload.get("hermesVersion") or payload.get("arendaApiReachable") else 1
        time.sleep(60)


if __name__ == "__main__":
    raise SystemExit(main())
