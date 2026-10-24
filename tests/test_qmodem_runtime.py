import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from feed_fixtures import write_qmodem_runtime

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("patch_feeds", ROOT / "scripts/patch-feeds.py")
patch_feeds = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patch_feeds)


@unittest.skipIf(os.name == "nt", "QModem shell behavior runs on Linux CI")
class QModemRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        write_qmodem_runtime(self.root)
        patch_feeds.patch_qmodem_runtime(self.root)
        self.base = self.root / "feeds/qmodem/application/qmodem/files"
        self.state = self.root / "state.json"
        self.state.write_text(json.dumps({"ready_after": 2, "calls": 0, "enabled": True}))
        self.log = self.root / "calls.log"
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.executable("uci", '''#!/usr/bin/env python3
import json,os,sys
s=json.load(open(os.environ['TEST_STATE']))
key=sys.argv[-1]
if key.endswith('block_auto_probe'): print(os.getenv('TEST_BLOCK','0'))
elif key.endswith('start_delay'): print('2')
else: print('1' if s['enabled'] else '0')
''')
        self.executable("modem_scanc", '''#!/usr/bin/env python3
import json,os,sys
p=os.environ['TEST_STATE'];s=json.load(open(p))
with open(os.environ['TEST_LOG'],'a') as f: f.write(' '.join(sys.argv[1:])+'\\n')
if sys.argv[1]=='status':
 s['calls']+=1;json.dump(s,open(p,'w'));sys.exit(0 if s['calls']>s['ready_after'] else 2)
''')
        self.executable("sleep", '''#!/usr/bin/env python3
import json,os
if os.getenv('TEST_DISABLE_LATER')=='1':
 p=os.environ['TEST_STATE'];s=json.load(open(p));s['enabled']=False;json.dump(s,open(p,'w'))
''')
        self.executable("logger", "#!/bin/sh\nexit 0\n")
        self.env = {**os.environ, "PATH": str(self.bin) + ":" + os.environ["PATH"],
                    "TEST_STATE": str(self.state), "TEST_LOG": str(self.log)}
        self.helper = self.root / "scan.sh"
        self.helper.write_text((ROOT / "files/usr/share/qmodem/swrt-scan-once").read_text().replace(
            "/usr/bin/modem_scanc", str(self.bin / "modem_scanc")))

    def executable(self, name, text):
        path = self.bin / name
        path.write_text(text)
        path.chmod(0o755)

    def scan(self, **env):
        return subprocess.run(["sh", str(self.helper), "usb"], env={**self.env, **env},
                              capture_output=True, text=True,
                              timeout=float(os.environ.get("SWRT_TEST_PROCESS_TIMEOUT", "10")))

    def test_boot_scan_waits_for_daemon_then_queues_once(self):
        result = self.scan()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.log.read_text().splitlines(), ["status"] * 3 + ["scan usb"])

    def test_disabled_or_blocked_scan_does_not_touch_daemon(self):
        for disabled in (True, False):
            self.state.write_text(json.dumps({"enabled": not disabled}))
            result = self.scan(TEST_BLOCK="0" if disabled else "1")
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertFalse(self.log.exists())

    def test_switch_disabled_during_delay_cancels_scan(self):
        result = self.scan(TEST_DISABLE_LATER="1")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.log.exists())

    def test_unavailable_daemon_has_bounded_retries(self):
        self.state.write_text(json.dumps({"enabled": True, "ready_after": 100, "calls": 0}))
        result = self.scan()
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertEqual(self.log.read_text().splitlines(), ["status"] * 30)

    def test_generic_carrier_falls_back_but_real_profile_is_preserved(self):
        vendor = (self.base / "usr/share/qmodem/vendor/fibocom.sh").read_text()
        script = vendor + '''
platform=mediatek
cmd_gtcurcar_query() { printf '+GTCURCAR: 1,"%s"\\n' "$TEST_CARRIER"; }
cmd_cops_query() { echo '+COPS: 0,0,"China Mobile",11'; }
fibocom_get_carrier
'''
        for profile, expected in (("Generic", "China Mobile"), ("", "China Mobile"), ("China Telecom", "China Telecom")):
            result = subprocess.run(["sh", "-c", script], env={**self.env, "TEST_CARRIER": profile}, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout.strip(), expected)

    def test_init_registers_managed_scan_processes(self):
        init = (self.base / "etc/init.d/qmodem_init").read_text()
        script = init + '''
procd_open_instance() { :; }
procd_close_instance() { :; }
procd_set_param() { [ "$1" != command ] || printf '%s %s\\n' "$2" "$3"; }
_scan_usb
_scan_pcie
'''
        result = subprocess.run(["sh", "-c", script], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.splitlines(), ["/usr/share/qmodem/swrt-scan-once usb", "/usr/share/qmodem/swrt-scan-once pcie"])
