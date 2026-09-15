from __future__ import annotations

import importlib.util
import os
import unittest
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).parents[1] / "scripts" / "bootstrap_runtime.py"
SPEC = importlib.util.spec_from_file_location("bootstrap_runtime", MODULE_PATH)
assert SPEC and SPEC.loader
bootstrap = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bootstrap)


class BootstrapTests(unittest.TestCase):
    def test_tashkent_eight_is_three_utc(self):
        with patch.dict(
            os.environ,
            {"HERMES_DAILY_REPORT_TIMEZONE": "Asia/Tashkent", "HERMES_DAILY_REPORT_HOUR": "8"},
            clear=False,
        ):
            schedule, timezone_name, local_hour = bootstrap.daily_schedule()
        self.assertEqual(schedule, "0 3 * * *")
        self.assertEqual(timezone_name, "Asia/Tashkent")
        self.assertEqual(local_hour, 8)

    def test_invalid_hour_fails_closed(self):
        with patch.dict(os.environ, {"HERMES_DAILY_REPORT_HOUR": "24"}, clear=False):
            with self.assertRaises(SystemExit):
                bootstrap.daily_schedule()


if __name__ == "__main__":
    unittest.main()
