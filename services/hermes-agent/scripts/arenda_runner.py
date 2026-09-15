#!/usr/bin/env python3
"""Run Arenda AI's scoped Hermes employee team once."""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import tempfile
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


MANAGER_SCOPES = [
    "agent:runs:create",
    "agent:delegate",
    "reports:compose",
    "notifications:telegram",
]
PAYMENT_SCOPES = ["payments:read", "debts:read"]
ANALYST_SCOPES = ["analytics:read", "expenses:read", "rooms:read"]
FORBIDDEN_ENV = ("DATABASE_URL", "TELEGRAM_BOT_TOKEN")


class RunnerError(RuntimeError):
    pass


def _flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    return default if raw is None else raw.strip().lower() in {"1", "true", "yes", "on"}


def assert_safe_environment() -> None:
    present = [name for name in FORBIDDEN_ENV if os.getenv(name)]
    present.extend(
        name for name in os.environ if name.startswith("TTLOCK") and os.getenv(name)
    )
    if present:
        raise RunnerError("Forbidden Hermes environment variables: " + ", ".join(sorted(present)))


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost: float | None = None
    model: str | None = None
    provider: str | None = None


class AgentApi:
    def __init__(self, base_url: str, client_id: str, client_secret: str, timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.client_id = client_id
        self.client_secret = client_secret
        self.timeout = timeout

    def request(
        self,
        method: str,
        path: str,
        *,
        token: str | None = None,
        body: dict[str, Any] | None = None,
        trace_id: str | None = None,
        run_id: str | None = None,
    ) -> Any:
        headers = {"Accept": "application/json", "User-Agent": "hermes-arenda-ai/1.0"}
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if trace_id:
            headers["X-Trace-Id"] = trace_id
        if run_id:
            headers["X-Run-Id"] = run_id
        req = urllib.request.Request(self.base_url + path, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")[:1000]
            try:
                message = json.loads(raw).get("message", raw)
            except json.JSONDecodeError:
                message = raw
            raise RunnerError(f"Agent API {method} {path} returned {exc.code}: {message}") from exc
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise RunnerError(f"Agent API {method} {path} failed: {exc}") from exc
        if not payload.get("success"):
            raise RunnerError(f"Agent API {method} {path} rejected the request")
        return payload.get("data")

    def token(self, scopes: list[str]) -> str:
        data = self.request(
            "POST",
            "/api/internal/agent/v1/auth/token",
            body={
                "clientId": self.client_id,
                "clientSecret": self.client_secret,
                "scopes": scopes,
            },
        )
        missing = set(scopes) - set(data.get("scopes") or [])
        if missing:
            raise RunnerError("Agent API did not grant required scopes: " + ", ".join(sorted(missing)))
        token = data.get("accessToken")
        if not isinstance(token, str) or not token:
            raise RunnerError("Agent API returned no access token")
        return token


def _compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _safe_payment_context(due: dict[str, Any], overdue: dict[str, Any]) -> dict[str, Any]:
    items = overdue.get("items") or []
    days = [int(item.get("overdueDays") or 0) for item in items if isinstance(item, dict)]
    return {
        "date": overdue.get("date") or due.get("date"),
        "timezone": overdue.get("timezone") or due.get("timezone"),
        "dueTodayCount": int(due.get("dueTodayCount") or 0),
        "overdueCount": int(overdue.get("overdueCount") or 0),
        "totalDebt": float(overdue.get("totalDebt") or 0),
        "maximumOverdueDays": max(days, default=0),
    }


def _safe_analytics_context(data: dict[str, Any]) -> dict[str, Any]:
    return {
        "date": data.get("date"),
        "timezone": data.get("timezone"),
        "occupancy": data.get("occupancy"),
        "comparison": data.get("comparison"),
        "expenseHighlights": (data.get("expenseHighlights") or [])[:5],
    }


def run_hermes(role: str, skill: str, context: dict[str, Any]) -> tuple[str, Usage]:
    hermes_bin = os.getenv("HERMES_BIN", "hermes")
    timeout = max(30, min(600, int(os.getenv("HERMES_RUN_TIMEOUT_SECONDS", "180"))))
    model = os.getenv("HERMES_MODEL", "").strip()
    provider = os.getenv("HERMES_PROVIDER", "").strip()
    reasoning = os.getenv("HERMES_REASONING", "low").strip()
    prompt = (
        f"Siz Arenda AI tizimidagi {role} agentsiz. "
        "Faqat server hisoblagan JSON asosida ishlang. Hech qanday raqam, mijoz, sabab "
        "yoki holat o'ylab topmang. Tool ishlatmang va tashqi amal bajarmang. "
        "O'zbek tilida juda qisqa javob bering.\n\n"
        f"SERVER_JSON={_compact_json(context)}"
    )
    with tempfile.TemporaryDirectory(prefix="hermes-arenda-usage-") as tmp:
        usage_path = Path(tmp) / "usage.json"
        command = [hermes_bin, "-z", prompt, "--usage-file", str(usage_path), "--skills", skill]
        if model:
            command.extend(["--model", model])
        if provider and model:
            command.extend(["--provider", provider])
        if reasoning:
            command.extend(["--reasoning", reasoning])
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout,
            env={**os.environ, "HERMES_YOLO_MODE": "1", "HERMES_ACCEPT_HOOKS": "1"},
            check=False,
        )
        if completed.returncode != 0:
            detail = (completed.stderr or "Hermes returned no error text").strip()[:800]
            raise RunnerError(f"{role} Hermes run failed ({completed.returncode}): {detail}")
        output = completed.stdout.strip()
        if not output:
            raise RunnerError(f"{role} Hermes run returned an empty response")
        raw: dict[str, Any] = {}
        if usage_path.exists():
            try:
                raw = json.loads(usage_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                pass
        usage = Usage(
            input_tokens=int(raw.get("input_tokens") or 0),
            output_tokens=int(raw.get("output_tokens") or 0),
            estimated_cost=(
                float(raw["estimated_cost_usd"])
                if raw.get("estimated_cost_usd") is not None
                else None
            ),
            model=str(raw.get("model") or model or "") or None,
            provider=str(raw.get("provider") or provider or "") or None,
        )
        return output[:4000], usage


def extract_recommendations(text: str) -> list[str]:
    candidate = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", candidate, re.DOTALL | re.IGNORECASE)
    if fenced:
        candidate = fenced.group(1)
    else:
        start, end = candidate.find("{"), candidate.rfind("}")
        if start >= 0 and end > start:
            candidate = candidate[start : end + 1]
    try:
        payload = json.loads(candidate)
        values = payload.get("recommendations") if isinstance(payload, dict) else None
    except json.JSONDecodeError:
        values = None
    if not isinstance(values, list):
        values = [
            line.lstrip("-• ").strip()
            for line in text.splitlines()
            if line.strip().startswith(("-", "•"))
        ]
    clean: list[str] = []
    for item in values:
        if isinstance(item, str):
            value = " ".join(item.split()).strip()[:300]
            if value and value not in clean:
                clean.append(value)
    return clean[:5]


def _usage_patch(usage: Usage) -> dict[str, Any]:
    result: dict[str, Any] = {
        "modelProvider": usage.provider,
        "model": usage.model,
        "inputTokens": usage.input_tokens,
        "outputTokens": usage.output_tokens,
    }
    if usage.estimated_cost is not None and usage.estimated_cost >= 0:
        result["estimatedCost"] = usage.estimated_cost
    return {key: value for key, value in result.items() if value is not None}


def _merge_usage(total: Usage, current: Usage) -> None:
    total.input_tokens += current.input_tokens
    total.output_tokens += current.output_tokens
    if current.estimated_cost is not None:
        total.estimated_cost = (total.estimated_cost or 0) + current.estimated_cost
    total.model = current.model or total.model
    total.provider = current.provider or total.provider


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _patch_run(api: AgentApi, token: str, trace: str, run_id: str, body: dict[str, Any]) -> None:
    api.request("PATCH", f"/api/internal/agent/v1/runs/{run_id}", token=token, trace_id=trace, body=body)


def execute(dry_run_override: bool | None = None) -> dict[str, Any]:
    assert_safe_environment()
    base = os.getenv("HERMES_ARENDA_API_BASE_URL", "").strip()
    client_id = os.getenv("HERMES_ARENDA_CLIENT_ID", "").strip()
    client_secret = os.getenv("HERMES_ARENDA_CLIENT_SECRET", "").strip()
    if not (base and client_id and client_secret):
        raise RunnerError("HERMES_ARENDA_API_BASE_URL/CLIENT_ID/CLIENT_SECRET are required")

    api = AgentApi(base, client_id, client_secret)
    trace_id = str(uuid.uuid4())
    today = datetime.now(ZoneInfo("Asia/Tashkent")).strftime("%Y-%m-%d")
    manager_token = api.token(MANAGER_SCOPES)
    health = api.request("GET", "/api/internal/agent/v1/health", token=manager_token, trace_id=trace_id)
    settings = health.get("agents") or {}
    if not (health.get("killSwitch") or {}).get("masterEnabled"):
        return {"status": "skipped", "code": "MASTER_DISABLED", "date": today}
    if not settings.get("manager", True):
        return {"status": "skipped", "code": "MANAGER_DISABLED", "date": today}

    created = api.request(
        "POST",
        "/api/internal/agent/v1/runs",
        token=manager_token,
        trace_id=trace_id,
        body={
            "agentType": "MANAGER",
            "triggerType": "SCHEDULE",
            "triggerRef": "hermes-cron:08:00-Asia/Tashkent",
            "idempotencyKey": f"daily-manager-report:{today}",
            "metadata": {"orchestrator": "hermes", "version": 1},
        },
    )
    manager_run = created["run"]
    if created.get("duplicate"):
        return {"status": "already_processed", "date": today, "runId": manager_run["id"]}
    manager_run_id = manager_run["id"]
    _patch_run(api, manager_token, trace_id, manager_run_id, {"status": "RUNNING", "startedAt": _utc_now()})

    total_usage = Usage()
    summaries: dict[str, str] = {}
    payment_context: dict[str, Any] = {}
    analytics_context: dict[str, Any] = {}
    active_child: str | None = None
    try:
        if settings.get("payment", True):
            child = api.request(
                "POST",
                "/api/internal/agent/v1/runs",
                token=manager_token,
                trace_id=trace_id,
                body={
                    "agentType": "PAYMENT",
                    "triggerType": "SCHEDULE",
                    "triggerRef": manager_run_id,
                    "idempotencyKey": f"payment-analysis:{today}",
                },
            )["run"]
            active_child = child["id"]
            token = api.token(PAYMENT_SCOPES)
            due = api.request("GET", "/api/internal/agent/v1/payments/due", token=token, trace_id=trace_id, run_id=active_child)
            overdue = api.request("GET", "/api/internal/agent/v1/payments/overdue", token=token, trace_id=trace_id, run_id=active_child)
            payment_context = _safe_payment_context(due, overdue)
            summaries["payment"], usage = run_hermes("Payment", "payment-analysis", payment_context)
            _patch_run(api, manager_token, trace_id, active_child, {"status": "COMPLETED", "completedAt": _utc_now(), **_usage_patch(usage)})
            _merge_usage(total_usage, usage)
            active_child = None

        if settings.get("analyst", True):
            child = api.request(
                "POST",
                "/api/internal/agent/v1/runs",
                token=manager_token,
                trace_id=trace_id,
                body={
                    "agentType": "ANALYST",
                    "triggerType": "SCHEDULE",
                    "triggerRef": manager_run_id,
                    "idempotencyKey": f"monthly-analysis:{today}",
                },
            )["run"]
            active_child = child["id"]
            token = api.token(ANALYST_SCOPES)
            analytics = api.request("GET", "/api/internal/agent/v1/analytics/monthly-summary", token=token, trace_id=trace_id, run_id=active_child)
            analytics_context = _safe_analytics_context(analytics)
            summaries["analyst"], usage = run_hermes("Analyst", "monthly-analytics", analytics_context)
            _patch_run(api, manager_token, trace_id, active_child, {"status": "COMPLETED", "completedAt": _utc_now(), **_usage_patch(usage)})
            _merge_usage(total_usage, usage)
            active_child = None

        manager_context = {
            "date": today,
            "paymentAgentSummary": summaries.get("payment"),
            "analystAgentSummary": summaries.get("analyst"),
            "authoritativeAnalytics": analytics_context,
            "outputSchema": {"recommendations": ["maximum five evidence-based Uzbek sentences"]},
        }
        manager_text, usage = run_hermes("Manager", "manager", manager_context)
        recommendations = extract_recommendations(manager_text)
        _merge_usage(total_usage, usage)
        dry_run = _flag("HERMES_DRY_RUN", True) if dry_run_override is None else dry_run_override
        delivery = api.request(
            "POST",
            "/api/internal/agent/v1/notifications/telegram",
            token=manager_token,
            trace_id=trace_id,
            run_id=manager_run_id,
            body={
                "type": "DAILY_MANAGER_REPORT",
                "reportDate": today,
                "runId": manager_run_id,
                "idempotencyKey": f"daily-manager-report:{today}:telegram",
                "dryRun": dry_run,
                "recommendations": recommendations,
                "report": {
                    "dueTodayCount": int(payment_context.get("dueTodayCount") or 0),
                    "overdueCount": int(payment_context.get("overdueCount") or 0),
                    "totalDebt": float(payment_context.get("totalDebt") or 0),
                    "vacantRooms": int((analytics_context.get("occupancy") or {}).get("vacant") or 0),
                    "recommendations": recommendations,
                },
            },
        )
        _patch_run(
            api,
            manager_token,
            trace_id,
            manager_run_id,
            {
                "status": "COMPLETED",
                "completedAt": _utc_now(),
                **_usage_patch(total_usage),
                "metadata": {
                    "deliveryStatus": delivery.get("status"),
                    "dryRun": dry_run,
                    "orchestrator": "hermes",
                },
            },
        )
        return {
            "status": "completed",
            "date": today,
            "runId": manager_run_id,
            "deliveryStatus": delivery.get("status"),
            "dryRun": dry_run,
            "inputTokens": total_usage.input_tokens,
            "outputTokens": total_usage.output_tokens,
            "model": total_usage.model,
            "provider": total_usage.provider,
        }
    except Exception as exc:
        if active_child:
            try:
                _patch_run(api, manager_token, trace_id, active_child, {"status": "FAILED", "completedAt": _utc_now(), "errorCode": "HERMES_CHILD_FAILED", "errorSummary": str(exc)[:500]})
            except Exception:
                pass
        try:
            _patch_run(api, manager_token, trace_id, manager_run_id, {"status": "FAILED", "completedAt": _utc_now(), "errorCode": "HERMES_ORCHESTRATION_FAILED", "errorSummary": str(exc)[:500]})
        except Exception:
            pass
        raise


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--live", action="store_true")
    args = parser.parse_args()
    override = True if args.dry_run else False if args.live else None
    try:
        print(json.dumps(execute(override), ensure_ascii=False, sort_keys=True))
        return 0
    except Exception as exc:
        print(json.dumps({"status": "failed", "error": str(exc)[:800]}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
