import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import socket
import subprocess
import tarfile
import tempfile
import threading
import time
import unittest
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SERVICE = ROOT / "package/swrt-pcat-manager"
ARCHIVE = None


def official_archive():
    global ARCHIVE
    if ARCHIVE is None:
        lock = json.loads((ROOT / "sources.lock.json").read_text(encoding="utf-8"))["photonicat_pmu"]
        local = ROOT.parent / "diagnostics/official-manager-master" / (lock["commit"] + ".tar.gz")
        if local.exists():
            ARCHIVE = local.read_bytes()
        else:
            with urllib.request.urlopen(lock["repository"] + "/archive/" + lock["commit"] + ".tar.gz", timeout=45) as response:
                ARCHIVE = response.read(2 * 1024 * 1024)
        if hashlib.sha256(ARCHIVE).hexdigest() != lock["sha256"]:
            raise AssertionError("Official PMU source checksum mismatch")
    return ARCHIVE


def profile_source(folder):
    with tarfile.open(fileobj=io.BytesIO(official_archive())) as archive:
        archive.extractall(folder, filter="data")
    source = next(Path(folder).iterdir())
    spec = importlib.util.spec_from_file_location("pcat_profile", SERVICE / "files/prepare-source.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.profile(source)
    return source


class OfficialPowerProfileTests(unittest.TestCase):
    def test_official_source_is_pinned_and_power_only(self):
        with tempfile.TemporaryDirectory() as folder:
            source = profile_source(folder)
            recipe = (source / "src/meson.build").read_text(encoding="utf-8")
            self.assertNotIn("modem-manager.c", recipe)
            self.assertNotIn("pcat_modem_manager_", (source / "src/controller.c").read_text(encoding="utf-8"))
            self.assertNotIn("pcat_modem_manager_init()", (source / "src/main.c").read_text(encoding="utf-8"))
            self.assertEqual((source / "src/controller.c").read_text(encoding="utf-8").count('.command = "'), 6)
            config = (source / "conf/pcat-manager.conf.sample").read_text(encoding="utf-8")
            self.assertIn("AutoShutdownVoltage5G=0", config)
            self.assertIn("BatteryFullThreshold=0", config)
            pmu = (source / "src/pmu-manager.c").read_text(encoding="utf-8")
            self.assertIn('"/dev/pcat-pm-ctl"', pmu)
            self.assertIn('/sys/class/power_supply/battery', pmu)
            self.assertNotIn('pcat_modem_manager_', pmu)
            self.assertNotIn('pcat_pmu_serial_', pmu)
            self.assertIn('swrt_status_valid', pmu)

    @unittest.skipIf(os.name == "nt", "Native official C build runs on Linux CI")
    def test_pinned_official_daemon_builds_without_modem_libraries(self):
        with tempfile.TemporaryDirectory() as folder:
            source = profile_source(folder)
            flags = subprocess.check_output(["pkg-config", "--cflags", "--libs", "glib-2.0", "gio-2.0",
                "gio-unix-2.0", "gthread-2.0", "json-c"], text=True).split()
            result = subprocess.run(["cc", "-O2", "-Werror=implicit-function-declaration",
                str(source / "src/main.c"), str(source / "src/pmu-manager.c"), str(source / "src/controller.c"),
                str(source / "src/swrt-schedule-time.c"),
                *flags, "-o", str(source / "power-daemon")], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            # Compile only. NEVER start the daemon against a host UART.

    def test_readonly_role_cannot_modify_power_policy(self):
        acl = json.loads((ROOT / "package/luci-app-swrt-power/root/usr/share/rpcd/acl.d/luci-app-swrt-power.json").read_text(encoding="utf-8"))
        access = acl["luci-app-swrt-power"]
        self.assertEqual(access["read"], {"ubus": {"luci.swrt_power": ["status", "battery"]}})
        self.assertEqual(access["write"], {"ubus": {"luci.swrt_power": ["configure"]}})

    @unittest.skipIf(os.name == "nt", "Official state machine executes on Linux")
    def test_official_sysfs_state_and_manual_boot_safety(self):
        with tempfile.TemporaryDirectory() as folder:
            source = profile_source(folder)
            flags = subprocess.check_output(["pkg-config", "--cflags", "--libs", "glib-2.0", "gio-2.0", "json-c"], text=True).split()
            binary = source / "safety-test"
            subprocess.run(["cc", "-O1", "-Werror=implicit-function-declaration",
                "-I", str(source / "src"), str(ROOT / "tests/power_safety_harness.c"),
                str(source / "src/swrt-schedule-time.c"),
                *flags, "-o", str(binary)], check=True, capture_output=True, text=True)
            result = subprocess.run([str(binary)], capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    @unittest.skipIf(os.name == "nt", "Compile GLib calendar conversion on Linux")
    def test_daily_wake_converts_device_time_to_utc_including_next_day_dst(self):
        with tempfile.TemporaryDirectory() as folder:
            binary = Path(folder) / "schedule-time"
            flags = subprocess.check_output(["pkg-config", "--cflags", "--libs", "glib-2.0"], text=True).split()
            subprocess.run(["cc", "-std=c11", "-Wall", "-Wextra", "-Werror",
                "-I", str(SERVICE / "files"), str(SERVICE / "files/swrt-schedule-time.c"),
                str(ROOT / "tests/schedule_time_harness.c"), *flags, "-o", str(binary)], check=True)
            result = subprocess.run([str(binary)], capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

@unittest.skipIf(os.name == "nt", "Unix socket client integration runs on Linux CI")
class PowerClientTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.build = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.build.cleanup)
        cls.binary = Path(cls.build.name) / "swrt-power"
        flags = subprocess.check_output(["pkg-config", "--cflags", "--libs", "glib-2.0", "json-c"], text=True).split()
        subprocess.run(["cc", "-std=c11", "-Wall", "-Wextra", "-Werror", "-DSWRT_POWER_TEST",
            str(SERVICE / "files/power-client.c"), *flags, "-o", str(cls.binary)], check=True)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "tmp/sysinfo").mkdir(parents=True)
        (self.root / "var/run").mkdir(parents=True)
        self.board = self.root / "tmp/sysinfo/board_name"
        self.board.write_text("ariaboard,photonicat\n")
        self.pmu = {"battery-voltage": 3960, "charger-voltage": 5000,
                    "on-battery": 0, "charge-percentage": 7350, "board-temperature": 42}
        self.car = {"state": 0, "timeout": 0, "countdown": -1, "armed": False}
        self.events, self.commands = [], []
        self.fail_once = None
        self.wrong_echo = False
        self.listener = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.listener.bind(str(self.root / "tmp/pcat-manager.sock"))
        self.listener.listen(16)
        self.listener.settimeout(.1)
        self.running = True
        self.thread = threading.Thread(target=self.serve, daemon=True)
        self.thread.start()
        self.addCleanup(self.close_server)

    def close_server(self):
        self.running = False
        self.thread.join(1)
        self.listener.close()

    def serve(self):
        while self.running:
            try:
                connection, _ = self.listener.accept()
            except socket.timeout:
                continue
            with connection:
                buffer = b""
                while b"\0" not in buffer:
                    block = connection.recv(4096)
                    if not block: break
                    buffer += block
                if not buffer: continue
                request = json.loads(buffer.split(b"\0")[0])
                name = request["command"]
                self.commands.append(request)
                response = {"command": "incorrect" if self.wrong_echo else name, "code": 0}
                if self.fail_once == name:
                    response["code"] = 5
                    self.fail_once = None
                elif name == "pmu-status": response.update(self.pmu)
                elif name == "charger-on-auto-start-get": response.update(self.car)
                elif name == "schedule-power-event-get":
                    response["event-list"] = self.events
                    response["timezone"] = "UTC"
                elif name == "charger-on-auto-start-set":
                    self.car.update(state=request["state"], timeout=request["timeout"])
                elif name == "schedule-power-event-set": self.events = request["event-list"]
                else: response["code"] = 1
                payload = json.dumps(response).encode() + b"\0"
                # Exercise split reads without closing the write half early.
                try:
                    connection.sendall(payload[:3])
                    time.sleep(.001)
                    connection.sendall(payload[3:])
                except BrokenPipeError:
                    pass

    def call(self, method, data=None):
        result = subprocess.run([str(self.binary), method],
            input=json.dumps(data) if data is not None else None,
            env={**os.environ, "SWRT_POWER_ROOT": str(self.root)}, capture_output=True, text=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def request(self, **changes):
        status = self.call("status")
        self.assertTrue(status["ok"], status)
        data = {"mode": "manual", "minutes": 0, "start": "07:00", "stop": "23:00",
                "revision": status["revision"], "confirm": 1}
        data.update(changes)
        return data

    def writes(self):
        return [c for c in self.commands if c["command"].endswith("-set")]

    def test_status_reads_only_and_converts_percentage(self):
        status = self.call("status")
        self.assertTrue(status["ok"], status)
        self.assertEqual(status["battery"]["percentage"], 74)
        self.assertTrue(status["battery"]["external_power"])
        self.assertIsNone(status["battery"]["charging"], "Supply presence cannot establish charging")
        self.assertEqual(len(status["revision"]), 64)
        self.assertEqual(self.writes(), [])

    def test_zero_or_stale_voltage_and_wrong_board_never_write(self):
        data = self.request(mode="ups", minutes=5)
        self.pmu["battery-voltage"] = 0
        self.assertFalse(self.call("configure", data)["ok"])
        self.pmu["battery-voltage"] = 3960
        self.board.write_text("ariaboard,photonicat2")
        self.assertFalse(self.call("configure", data)["ok"])
        self.assertEqual(self.writes(), [])

    def test_revision_change_and_invalid_inputs_never_write(self):
        data = self.request()
        self.car["timeout"] = 60
        self.assertFalse(self.call("configure", data)["ok"])
        for changes in ({"confirm": 0}, {"mode": "unknown"}, {"mode": "ups", "minutes": 0},
                        {"mode": "daily", "start": "24:00"}, {"mode": "daily", "start": "23:00"}):
            with self.subTest(changes=changes):
                self.assertFalse(self.call("configure", self.request(**changes))["ok"])
        self.assertEqual(self.writes(), [])

    def test_ups_requires_external_power(self):
        data = self.request(mode="ups", minutes=5)
        self.pmu["on-battery"] = 1
        self.pmu["charger-voltage"] = 0
        self.assertFalse(self.call("configure", data)["ok"])
        self.assertEqual(self.writes(), [])

    def test_battery_only_does_not_claim_a_charge_current_measurement(self):
        self.pmu["on-battery"] = 1
        self.pmu["charger-voltage"] = 0
        status = self.call("battery")
        self.assertTrue(status["ok"], status)
        self.assertFalse(status["external_power"])
        self.assertIsNone(status["charging"])

    def test_changed_timezone_blocks_daily_policy_without_writes(self):
        (self.root / "etc").mkdir()
        (self.root / "etc/TZ").write_text("CST-8\n")
        result = self.call("configure", self.request(mode="daily"))
        self.assertFalse(result["ok"])
        self.assertIn("时区", result["message"])
        self.assertEqual(self.writes(), [])

    def test_daily_schedule_uses_official_event_fields_and_roundtrips(self):
        result = self.call("configure", self.request(mode="daily", start="00:05", stop="23:55"))
        self.assertTrue(result["ok"], result)
        self.assertEqual(self.events, [
            {"action": 1, "enabled": 1, "enable-bits": 56, "dow-bits": 127, "hour": 0, "minute": 5},
            {"action": 0, "enabled": 1, "enable-bits": 56, "dow-bits": 127, "hour": 23, "minute": 55}])
        self.assertEqual(self.car["state"], 0)

    def test_ups_minutes_are_seconds_and_manual_clears_old_plan(self):
        result = self.call("configure", self.request(mode="ups", minutes=5))
        self.assertTrue(result["ok"], result)
        self.assertEqual((self.car["state"], self.car["timeout"]), (1, 300))
        result = self.call("configure", self.request(mode="manual"))
        self.assertTrue(result["ok"], result)
        self.assertEqual(self.car["state"], 0)
        self.assertEqual(self.events, [])

    def test_partial_failure_restores_old_policy(self):
        self.car.update(state=1, timeout=300)
        data = self.request(mode="daily")
        self.fail_once = "schedule-power-event-set"
        result = self.call("configure", data)
        self.assertFalse(result["ok"])
        self.assertIn("已恢复", result["message"])
        self.assertEqual((self.car["state"], self.car["timeout"]), (1, 300))

    def test_wrong_response_command_and_disconnection_fail_closed(self):
        data = self.request()
        self.wrong_echo = True
        self.assertFalse(self.call("configure", data)["ok"])
        self.assertEqual(self.writes(), [])
        self.close_server()
        self.assertFalse(self.call("status")["ok"])


if __name__ == "__main__": unittest.main()
