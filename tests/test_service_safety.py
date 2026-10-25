import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class OwnerConfigurationTests(unittest.TestCase):
    def test_power_driver_must_be_builtin_not_a_second_module(self):
        with tempfile.TemporaryDirectory() as folder:
            config = Path(folder) / "config"
            config.write_text((ROOT / ".config").read_text() + "\nCONFIG_PACKAGE_kmod-photonicat-pm=y\n")
            result = subprocess.run([os.sys.executable, str(ROOT / "scripts/check-config.py"), str(config)],
                                    capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Unexpected PACKAGE_kmod-photonicat-pm", result.stderr)


@unittest.skipIf(os.name == "nt", "OpenWrt service and storage scripts run on Linux")
class ServiceSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.log = self.root / "log"
        self.env = {**os.environ, "PATH": str(self.bin) + ":" + os.environ["PATH"], "TEST_LOG": str(self.log)}

    def executable(self, name, text):
        path = self.bin / name
        path.write_text(text)
        path.chmod(0o755)

    def test_kernel_backed_service_keeps_watchdog_in_kernel(self):
        board = self.root / "board"
        board.write_text("ariaboard,photonicat\n")
        timezone = self.root / "TZ"
        timezone.write_text("CST-8\n")
        voltage = self.root / "voltage"
        voltage.write_text("3900000\n")
        migrate = self.bin / "migrate"
        self.executable("migrate", '#!/bin/sh\necho MIGRATE >> "$TEST_LOG"\n')
        script = (ROOT / "package/swrt-pcat-manager/files/swrt-pcat-manager.init").read_text()
        script = script.replace("/tmp/sysinfo/board_name", str(board)).replace("/dev/pcat-pm-ctl", "/dev/null")
        script = script.replace("/sys/class/power_supply/battery/voltage_now", str(voltage))
        script = script.replace("/usr/libexec/swrt-power-migrate", str(migrate)).replace("/etc/TZ", str(timezone))
        prefix = '''pidof() { return 1; }
procd_open_instance() { :; }
procd_close_instance() { :; }
procd_set_param() { printf '%s\\n' "$*" >> "$TEST_LOG"; }
'''
        result = subprocess.run(["sh", "-c", prefix + script + "\nstart_service\n"],
                                env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        lines = self.log.read_text().splitlines()
        self.assertEqual(lines[0], "MIGRATE")
        self.assertIn("env TZ=CST-8", lines)
        self.assertIn("respawn 3600 2 5", lines)
        self.assertNotIn("USR1", script)
        self.assertNotIn("/dev/ttyS4", script)

    def test_missing_kernel_interface_refuses_legacy_uart_fallback(self):
        board = self.root / "board"
        board.write_text("ariaboard,photonicat\n")
        control = self.root / "not-a-character-device"
        control.touch()
        script = (ROOT / "package/swrt-pcat-manager/files/swrt-pcat-manager.init").read_text()
        script = script.replace("/tmp/sysinfo/board_name", str(board)).replace("/dev/pcat-pm-ctl", str(control))
        prefix = '''logger() { printf '%s\\n' "$*" >> "$TEST_LOG"; }
procd_open_instance() { echo STARTED >> "$TEST_LOG"; }
'''
        result = subprocess.run(["sh", "-c", prefix + script + "\nstart_service\n"], env=self.env,
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        log = self.log.read_text()
        self.assertIn("Official kernel power interface is unavailable", log)
        self.assertNotIn("STARTED", log)

    def test_only_exact_legacy_factory_voltages_are_migrated(self):
        factory = self.root / "factory"
        factory.mkdir()
        legacy = (ROOT / "package/swrt-pcat-manager/files/legacy-v1.conf").read_bytes()
        (factory / "legacy-v1.conf").write_bytes(legacy)
        official = b"[PowerManager]\nAutoShutdownVoltage5G=0\nBatteryFullThreshold=0\n"
        (factory / "official-v1.conf").write_bytes(official)
        config = self.root / "pcat-manager.conf"
        script = (ROOT / "package/swrt-pcat-manager/files/swrt-power-migrate").read_text()
        script = script.replace("/etc/pcat-manager.conf", str(config)).replace("/usr/share/swrt-pcat-manager", str(factory))
        self.executable("logger", "#!/bin/sh\nexit 0\n")
        def run():
            result = subprocess.run(["sh", "-c", script], env=self.env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
        custom = legacy.replace(b"ChargerLimitVoltage=0", b"ChargerLimitVoltage=4750")
        config.write_bytes(custom)
        run()
        self.assertEqual(config.read_bytes(), custom)
        self.assertFalse(Path(str(config) + ".pre-kernel-backend").exists())
        config.write_bytes(legacy)
        run()
        self.assertEqual(config.read_bytes(), official)
        self.assertEqual(Path(str(config) + ".pre-kernel-backend").read_bytes(), legacy)
        run()
        self.assertEqual(config.read_bytes(), official)
        self.assertEqual(Path(str(config) + ".pre-kernel-backend").read_bytes(), legacy)

    def storage(self, *, native="f2fs", fs="squashfs", current="/opt/docker/", existing=False,
                destination=False, running=False, alternative=""):
        old = self.root / "opt/docker"
        new = self.root / "overlay/docker"
        old.parent.mkdir(exist_ok=True)
        new.parent.mkdir(exist_ok=True)
        if existing:
            old.mkdir(exist_ok=True)
            (old / "sentinel").write_text("container-data")
        if destination: new.mkdir(exist_ok=True)
        mounts = self.root / "mounts"
        mounts.write_text(f"/dev/root /rom {fs} ro 0 0\n/dev/loop0 /overlay {native} rw 0 0\n")
        state = self.root / "uci.json"
        state.write_text(json.dumps({"dockerd.globals.data_root": current,
                                     "dockerd.globals.alt_config_file": alternative}))
        self.executable("uci", '''#!/usr/bin/env python3
import json,os,sys
p=os.environ['TEST_UCI'];s=json.load(open(p));args=[a for a in sys.argv[1:] if a!='-q']
if args[0]=='get':
 value=s.get(args[1]);print(value or '');sys.exit(0 if value is not None else 1)
if args[0]=='set':
 key,value=args[1].split('=',1);s[key]=value;json.dump(s,open(p,'w'))
''')
        self.executable("pidof", "#!/bin/sh\nexit " + ("0" if running else "1") + "\n")
        self.executable("logger", "#!/bin/sh\nexit 0\n")
        script = (ROOT / "files/etc/uci-defaults/98-swrt-docker-storage").read_text()
        script = script.replace("/proc/mounts", str(mounts)).replace("/opt/docker", str(old)).replace("/overlay/docker", str(new))
        # Keep the UCI upstream default literal independent of fixture paths.
        script = script.replace('case "$current" in ' + str(old) + '|' + str(old) + '/', 'case "$current" in /opt/docker|/opt/docker/')
        result = subprocess.run(["sh", "-c", script], env={**self.env, "TEST_UCI": str(state)},
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        if existing: self.assertEqual((old / "sentinel").read_text(), "container-data")
        return json.loads(state.read_text())["dockerd.globals.data_root"], new

    def test_fresh_squashfs_selects_native_storage(self):
        current, new = self.storage()
        self.assertEqual(current, str(new))
        self.assertEqual(new.stat().st_mode & 0o777, 0o700)

    def test_existing_data_is_never_moved_or_hidden(self):
        current, new = self.storage(existing=True)
        self.assertEqual(current, "/opt/docker/")
        self.assertFalse(new.exists())

    def test_custom_storage_ext4_root_and_live_daemon_are_preserved(self):
        for options in ({"current": "/mnt/disk/docker"}, {"fs": "ext4"}, {"native": "tmpfs"},
                        {"running": True}, {"alternative": "/etc/docker/daemon.json"}, {"destination": True}):
            with self.subTest(options=options):
                current, _ = self.storage(**options)
                self.assertEqual(current, options.get("current", "/opt/docker/"))


if __name__ == "__main__": unittest.main()
