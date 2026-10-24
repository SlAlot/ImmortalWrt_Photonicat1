import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class OwnerConfigurationTests(unittest.TestCase):
    def test_kernel_mcu_owner_cannot_be_selected_alongside_uart_service(self):
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

    def test_restart_disarms_watchdog_but_system_shutdown_keeps_handshake(self):
        board = self.root / "board"
        board.write_text("ariaboard,photonicat\n")
        timezone = self.root / "TZ"
        timezone.write_text("CST-8\n")
        script = (ROOT / "package/swrt-pcat-manager/files/swrt-pcat-manager.init").read_text()
        script = script.replace("/tmp/sysinfo/board_name", str(board)).replace("/dev/ttyS4", "/dev/null").replace("/etc/TZ", str(timezone))
        prefix = '''pidof() { return 1; }
procd_open_instance() { :; }
procd_close_instance() { :; }
procd_set_param() { printf '%s\\n' "$*" >> "$TEST_LOG"; }
procd_send_signal() { printf '%s\\n' "$*" >> "$TEST_LOG"; }
sleep() { printf 'sleep %s\\n' "$*" >> "$TEST_LOG"; }
stop() { stop_service; procd_send_signal swrt-pcat-manager '*' TERM; }
'''
        result = subprocess.run(["sh", "-c", prefix + script + "\nstart_service\nstop\nshutdown\n"],
                                env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        lines = self.log.read_text().splitlines()
        self.assertIn("env TZ=CST-8", lines)
        self.assertIn("respawn 3600 1 5", lines)
        self.assertEqual(lines[-4:], ["swrt-pcat-manager * USR1", "sleep 2", "swrt-pcat-manager * TERM",
                                     "swrt-pcat-manager * TERM"])

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
