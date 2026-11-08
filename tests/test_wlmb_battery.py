"""Exercise the producer contract, failures and service lifetime on Linux."""
import json
import os
from pathlib import Path
import shutil
import signal
import stat
import subprocess
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "package/wlmb-server"


class BatteryPackagingTests(unittest.TestCase):
    def test_release_pin_and_installed_bridge(self):
        lock = json.loads((ROOT / "sources.lock.json").read_text())["wlmb"]
        recipe = (PACKAGE / "Makefile").read_text()
        self.assertIn("PKG_VERSION:=" + lock["version"], recipe)
        self.assertIn("PKG_HASH:=" + lock["sha256"], recipe)
        self.assertEqual(lock["asset"], f'wlmb-server-{lock["version"]}-aarch64_generic.ipk')
        self.assertIn("+swrt-pcat-manager +jq-full", recipe)
        self.assertIn("./files/swrt-wlmb-battery $(1)/usr/libexec/swrt-wlmb-battery", recipe)
        self.assertIn("./files/swrt-wlmb-battery.init $(1)/etc/init.d/swrt-wlmb-battery", recipe)
        service = (PACKAGE / "files/swrt-wlmb-battery.init").read_text()
        self.assertIn("ariaboard,photonicat", service)
        self.assertIn("START=94", service)
        self.assertIn("procd_set_param command /usr/libexec/swrt-wlmb-battery", service)


@unittest.skipIf(os.name == "nt", "Producer needs Linux shell and permissions")
class BatteryProducerTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        self.reports = self.root / "reports"
        self.client = self.root / "power"
        self.worker = self.root / "worker"
        self.assertIsNotNone(shutil.which("jq"), "Install jq to test the provider")
        # Paths are replaced only in the disposable test copy. No runtime path
        # overrides or arbitrary command selection are exposed in the firmware.
        source = (PACKAGE / "files/swrt-wlmb-battery").read_text()
        source = source.replace("report_dir=/var/run/wlmb-server", f"report_dir='{self.reports}'")
        source = source.replace("power_client=/usr/libexec/swrt-power", f"power_client='{self.client}'")
        # CI runs unprivileged. Only the disposable copy trusts the fixture's
        # owner; the installed producer continues to require root ownership.
        source = source.replace('"$(stat -c %u "$report_dir")" = 0',
                                f'"$(stat -c %u "$report_dir")" = {os.getuid()}')
        source = source.replace("sleep 20 &", "sleep 0.2 &")
        self.worker.write_text(source)
        self.client.write_text('#!/bin/sh\ncat "' + str(self.root / "reply") + '"\n')
        self.client.chmod(0o700)
        self.worker.chmod(0o700)

    def reply(self, value):
        (self.root / "reply").write_text(json.dumps(value))

    def run_once(self):
        result = subprocess.run(["sh", str(self.worker), "--once"], capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads((self.reports / "battery.json").read_text())
        self.assertEqual(set(report), {"version", "percent", "charging", "updatedAt"})
        self.assertEqual(report["version"], 1)
        self.assertIsNone(report["charging"])
        self.assertLessEqual(abs(report["updatedAt"] - time.time()), 5)
        return report

    def test_zero_full_and_unknown_charge_with_secure_atomic_files(self):
        for percent in (0, 48, 100):
            self.reply({"ok": True, "percentage": percent, "external_power": True, "charging": True})
            self.assertEqual(self.run_once()["percent"], percent)
        self.assertEqual(stat.S_IMODE(self.reports.stat().st_mode), 0o700)
        target = self.reports / "battery.json"
        self.assertEqual(stat.S_IMODE(target.stat().st_mode), 0o600)
        self.assertEqual(target.stat().st_nlink, 1)
        self.assertEqual(list(self.reports.iterdir()), [target])

    def test_failed_stale_malformed_or_wrongly_typed_readings_become_unavailable(self):
        self.reply({"ok": True, "percentage": 74})
        self.assertEqual(self.run_once()["percent"], 74)
        for reading in ({"ok": False, "percentage": 74}, {"ok": "true", "percentage": 74},
                        {"ok": True}, {"ok": True, "percentage": None},
                        *({"ok": True, "percentage": n} for n in (-1, 101, 12.5, "50", True))):
            self.reply(reading)
            self.assertIsNone(self.run_once()["percent"])
        for raw in ("broken json", "", '{}\n{"ok":true,"percentage":90}'):
            (self.root / "reply").write_text(raw)
            self.assertIsNone(self.run_once()["percent"])
        self.client.write_text("#!/bin/sh\necho '{\"ok\":true,\"percentage\":90}'\nexit 1\n")
        self.assertIsNone(self.run_once()["percent"])

    def test_calibrated_display_takes_precedence_over_raw_percentage(self):
        self.reply({"ok": True, "percentage": 95, "display_percentage": 100})
        self.assertEqual(self.run_once()["percent"], 100)

    def test_symlink_directory_is_rejected_without_writing_target(self):
        other = self.root / "other"
        other.mkdir()
        self.reports.symlink_to(other, target_is_directory=True)
        self.reply({"ok": True, "percentage": 50})
        result = subprocess.run(["sh", str(self.worker), "--once"], timeout=5)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(list(other.iterdir()), [])

    def test_repeated_updates_and_stop_invalidate_instead_of_reusing_old_reading(self):
        self.reply({"ok": True, "percentage": 40})
        process = subprocess.Popen(["sh", str(self.worker)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.addCleanup(lambda: process.poll() is None and process.kill())
        target = self.reports / "battery.json"

        def wait_percent(expected):
            end = time.monotonic() + 5
            while time.monotonic() < end:
                if target.exists():
                    value = json.loads(target.read_text())
                    if value["percent"] == expected:
                        return value
                time.sleep(0.03)
            self.fail(f"Provider did not publish {expected}")

        wait_percent(40)
        self.reply({"ok": True, "percentage": 41})
        wait_percent(41)
        self.reply({"ok": False})
        wait_percent(None)
        self.reply({"ok": True, "percentage": 42})
        wait_percent(42)
        process.send_signal(signal.SIGTERM)
        out, err = process.communicate(timeout=3)
        self.assertEqual(process.returncode, 0, (out, err))
        self.assertIsNone(json.loads(target.read_text())["percent"])
        self.assertEqual(list(self.reports.iterdir()), [target])


if __name__ == "__main__":
    unittest.main()
