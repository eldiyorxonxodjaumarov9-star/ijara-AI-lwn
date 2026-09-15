#!/usr/bin/env python3
"""Hermes runtime health — no secrets in output."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request


def check() -> dict:
    hermes_bin = shutil.which("hermes")
    version = None
    if hermes_bin:
        try:
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
            req = urllib.request.Request(f"{base}/api/internal/agent/v1/health", method="GET")
            with urllib.request.urlopen(req, timeout=10) as resp:
                arenda_ok = 200 <= resp.status < 300
        except (urllib.error.URLError, TimeoutError, ValueError):
            arenda_ok = False

    expected = (os.environ.get("HERMES_EXPECTED_VERSION") or "").strip()
    version_ok = not expected or bool(version and expected in version)
    cron_active = False
    if hermes_bin:
        try:
            cron_out = subprocess.check_output(
                [hermes_bin, "cron", "list"], text=True, stderr=subprocess.STDOUT, timeout=15
            )
            cron_active = "arenda-ai-daily-manager" in cron_out
        except Exception:
            cron_active = False

    hermes_home = os.path.expanduser(os.environ.get("HERMES_HOME", "~/.hermes"))
    portal_auth = any(
        os.path.isfile(os.path.join(hermes_home, name))
        for name in ("auth.json", "portal_auth.json")
    )
    forbidden = {
        "DATABASE_URL": bool(os.environ.get("DATABASE_URL")),
        "TELEGRAM_BOT_TOKEN": bool(os.environ.get("TELEGRAM_BOT_TOKEN")),
        "TTLOCK": any(
            name.startswith("TTLOCK") and bool(os.environ.get(name)) for name in os.environ
        ),
    }
    return {
        "service": "hermes-arenda-ai",
        "hermesVersion": version,
        "providerConfigured": bool(
            os.environ.get("NOUS_API_KEY")
            or os.environ.get("OPENROUTER_API_KEY")
            or portal_auth
        ),
        "arendaApiReachable": arenda_ok,
        "versionMatchesExpected": version_ok,
        "schedulerActive": cron_active,
        "dryRun": os.environ.get("HERMES_DRY_RUN", "true").lower()
        in ("1", "true", "yes"),
        "forbiddenEnvPresent": forbidden,
    }


def main() -> int:
    payload = check()
    print(json.dumps(payload, ensure_ascii=False))
    forbidden = payload["forbiddenEnvPresent"]
    if any(forbidden.values()):
        print("ERROR: forbidden secrets present in Hermes env", file=sys.stderr)
        return 2
    healthy = bool(
        payload.get("hermesVersion")
        and payload.get("versionMatchesExpected")
        and payload.get("providerConfigured")
        and payload.get("arendaApiReachable")
        and payload.get("schedulerActive")
    )
    return 0 if healthy else 1


if __name__ == "__main__":
    raise SystemExit(main())
