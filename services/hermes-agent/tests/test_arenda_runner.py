from __future__ import annotations

import importlib.util
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).parents[1] / "scripts" / "arenda_runner.py"
SPEC = importlib.util.spec_from_file_location("arenda_runner", MODULE_PATH)
assert SPEC and SPEC.loader
runner = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = runner
SPEC.loader.exec_module(runner)


class RunnerTests(unittest.TestCase):
    def test_payment_context_removes_tenant_pii(self):
        result = runner._safe_payment_context(
            {"date": "2026-09-14", "dueTodayCount": 3, "items": [{"fullName": "Secret"}]},
            {"overdueCount": 2, "totalDebt": 8500000, "items": [{"fullName": "Secret", "overdueDays": 4}]},
        )
        self.assertEqual(result["maximumOverdueDays"], 4)
        self.assertNotIn("items", result)
        self.assertNotIn("Secret", str(result))

    def test_extract_recommendations_from_json(self):
        result = runner.extract_recommendations(
            '{"recommendations":["Qarzdorlar bilan bog‘laning.","Elektrni tekshiring."]}'
        )
        self.assertEqual(len(result), 2)

    def test_extract_recommendations_is_bounded(self):
        text = '{"recommendations":[' + ",".join('"' + str(i) * 400 + '"' for i in range(8)) + "]}"
        result = runner.extract_recommendations(text)
        self.assertLessEqual(len(result), 5)
        self.assertTrue(all(len(value) <= 300 for value in result))

    def test_forbidden_environment_fails_closed(self):
        with patch.dict(os.environ, {"DATABASE_URL": "postgres://forbidden"}, clear=True):
            with self.assertRaises(runner.RunnerError):
                runner.assert_safe_environment()

    def test_scopes_are_separated(self):
        self.assertNotIn("notifications:telegram", runner.PAYMENT_SCOPES)
        self.assertNotIn("notifications:telegram", runner.ANALYST_SCOPES)
        self.assertNotIn("payments:read", runner.MANAGER_SCOPES)

    def test_unknown_cost_is_not_recorded_as_zero(self):
        total = runner.Usage()
        runner._merge_usage(total, runner.Usage(input_tokens=10, output_tokens=2))
        self.assertIsNone(total.estimated_cost)
        self.assertNotIn("estimatedCost", runner._usage_patch(total))

    def test_known_cost_is_accumulated(self):
        total = runner.Usage()
        runner._merge_usage(total, runner.Usage(estimated_cost=0.25))
        runner._merge_usage(total, runner.Usage(estimated_cost=0.50))
        self.assertEqual(total.estimated_cost, 0.75)

    def test_timestamp_uses_utc_z_format(self):
        self.assertRegex(runner._utc_now(), r"Z$")

    def test_full_dry_run_orchestration_uses_scoped_agents(self):
        class FakeApi:
            def __init__(self):
                self.tokens = []
                self.patches = []
                self.notification = None

            def token(self, scopes):
                self.tokens.append(tuple(scopes))
                return "token:" + ",".join(scopes)

            def request(self, method, path, **kwargs):
                body = kwargs.get("body") or {}
                if path.endswith("/health"):
                    return {
                        "killSwitch": {"masterEnabled": True},
                        "agents": {"manager": True, "payment": True, "analyst": True},
                    }
                if method == "POST" and path.endswith("/runs"):
                    kind = body["agentType"].lower()
                    return {"run": {"id": f"run-{kind}"}, "duplicate": False}
                if path.endswith("/payments/due"):
                    return {"date": "2026-09-15", "dueTodayCount": 3, "items": []}
                if path.endswith("/payments/overdue"):
                    return {
                        "date": "2026-09-15",
                        "overdueCount": 2,
                        "totalDebt": 8500000,
                        "items": [{"overdueDays": 4, "fullName": "Must not reach LLM"}],
                    }
                if path.endswith("/analytics/monthly-summary"):
                    return {
                        "date": "2026-09-15",
                        "occupancy": {"vacant": 2},
                        "comparison": {"income": {"percent": 7.1}},
                        "expenseHighlights": [],
                    }
                if path.endswith("/notifications/telegram"):
                    self.notification = body
                    return {"status": "dry_run"}
                if method == "PATCH" and "/runs/" in path:
                    self.patches.append((path, body))
                    return {"run": {"id": path.rsplit("/", 1)[-1]}}
                raise AssertionError(f"unexpected request: {method} {path}")

        fake = FakeApi()
        usage = runner.Usage(input_tokens=10, output_tokens=2, model="free", provider="nous")

        def fake_hermes(role, _skill, context):
            self.assertNotIn("Must not reach LLM", str(context))
            if role == "Manager":
                return '{"recommendations":["Qarzdorlar bilan bog‘laning."]}', usage
            return f"{role} summary", usage

        env = {
            "HERMES_ARENDA_API_BASE_URL": "https://example.test",
            "HERMES_ARENDA_CLIENT_ID": "client",
            "HERMES_ARENDA_CLIENT_SECRET": "secret",
        }
        with (
            patch.dict(os.environ, env, clear=True),
            patch.object(runner, "AgentApi", return_value=fake),
            patch.object(runner, "run_hermes", side_effect=fake_hermes),
        ):
            result = runner.execute(True)

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["deliveryStatus"], "dry_run")
        self.assertEqual(fake.tokens, [
            tuple(runner.MANAGER_SCOPES),
            tuple(runner.PAYMENT_SCOPES),
            tuple(runner.ANALYST_SCOPES),
        ])
        self.assertNotIn("snapshot", fake.notification)
        self.assertEqual(fake.notification["report"]["totalDebt"], 8500000)
        self.assertTrue(any(body.get("status") == "COMPLETED" for _, body in fake.patches))


if __name__ == "__main__":
    unittest.main()
