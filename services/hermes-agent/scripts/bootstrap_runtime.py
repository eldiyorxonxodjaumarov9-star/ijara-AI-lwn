#!/usr/bin/env python3
"""Idempotently install Arenda skills and the official Hermes cron job."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml


HOME = Path(os.environ.get("HERMES_HOME", "/opt/data"))
SOURCE = Path(os.environ.get("HERMES_BUNDLE_ROOT", "/opt/hermes-arenda"))
HERMES_BIN = os.environ.get("HERMES_BIN", "hermes")
JOB_NAME = "arenda-ai-daily-manager"


def daily_schedule() -> tuple[str, str, int]:
    timezone_name = os.environ.get("HERMES_DAILY_REPORT_TIMEZONE", "Asia/Tashkent")
    hour = int(os.environ.get("HERMES_DAILY_REPORT_HOUR", "8"))
    if not 0 <= hour <= 23:
        raise SystemExit("HERMES_DAILY_REPORT_HOUR must be between 0 and 23")
    try:
        local_zone = ZoneInfo(timezone_name)
    except Exception as exc:
        raise SystemExit(f"Invalid HERMES_DAILY_REPORT_TIMEZONE: {timezone_name}") from exc
    local_time = datetime.now(local_zone).replace(hour=hour, minute=0, second=0, microsecond=0)
    utc_hour = local_time.astimezone(timezone.utc).hour
    return f"0 {utc_hour} * * *", timezone_name, hour


def main() -> int:
    forbidden = [
        name
        for name in os.environ
        if (
            name in {"DATABASE_URL", "TELEGRAM_BOT_TOKEN"}
            or name.startswith("TTLOCK")
        )
        and os.getenv(name)
    ]
    if forbidden:
        raise SystemExit(
            "Forbidden secrets present in Hermes runtime: " + ", ".join(sorted(forbidden))
        )

    (HOME / "skills").mkdir(parents=True, exist_ok=True)
    (HOME / "scripts").mkdir(parents=True, exist_ok=True)
    for skill in (SOURCE / "skills").iterdir():
        if skill.is_dir():
            target = HOME / "skills" / skill.name
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(skill, target)
    shutil.copy2(SOURCE / "scripts" / "arenda_runner.py", HOME / "scripts" / "arenda_runner.py")

    config_path = HOME / "config.yaml"
    config = yaml.safe_load(config_path.read_text(encoding="utf-8")) if config_path.exists() else {}
    config = config or {}
    config.setdefault("platform_toolsets", {})["cli"] = []
    config.setdefault("memory", {})["memory_enabled"] = True
    config_path.write_text(yaml.safe_dump(config, sort_keys=False), encoding="utf-8")

    schedule, timezone_name, local_hour = daily_schedule()
    listed = subprocess.run(
        [HERMES_BIN, "cron", "list"], capture_output=True, text=True, check=False
    )
    if JOB_NAME not in (listed.stdout + listed.stderr):
        created = subprocess.run(
            [
                HERMES_BIN,
                "cron",
                "create",
                schedule,
                "--name",
                JOB_NAME,
                "--no-agent",
                "--script",
                "arenda_runner.py",
                "--deliver",
                "local",
                "--failure-deliver",
                "local",
            ],
            text=True,
            check=False,
        )
        if created.returncode != 0:
            return created.returncode

    print(
        json.dumps(
            {
                "status": "ready",
                "job": JOB_NAME,
                "scheduleUtc": schedule,
                "timezone": timezone_name,
                "localHour": local_hour,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
