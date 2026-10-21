import gzip
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

class ImagePublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.target = self.root / "build/bin/targets/rockchip/armv8"
        self.target.mkdir(parents=True)
        (self.root / "build/swrt-metadata").mkdir()
        self.payload = bytearray(65 * 1024 * 1024)
        self.payload[510:512] = b"\x55\xaa"
        self.payload[0x8000:0x8004] = b"RKNS"
        self.payload[0x800000:0x800004] = b"\xd0\x0d\xfe\xed"
        self.payload[0x800100:0x800113] = b"ariaboard,photonicat"
        struct.pack_into("<II", self.payload, 454, 65536, 32768)
        struct.pack_into("<II", self.payload, 470, 131072, 2048)
        self.manifest = self.target / "swrt-ariaboard_photonicat.manifest"
        self.manifest.write_text("\n".join(name + " - 1.0" for name in (
            "qmodem", "tom_modem", "ubus-at-daemon", "quectel-CM-5G-M",
            "qmodem-smsd", "sms-forwarder-next",
            "luci-app-qmodem-next", "wlmb-server", "quickstart",
            "luci-app-quickstart", "luci-app-store", "dockerd", "docker",
            "pcat-mgr", "luci-app-passwall", "luci-app-openclash")))

    def write_images(self):
        images = []
        for fs in ("squashfs", "ext4"):
            name = f"swrt-ariaboard_photonicat-{fs}-sysupgrade.img.gz"
            data = gzip.compress(self.payload, compresslevel=1) + b' {"supported_devices":["ariaboard,photonicat"]} FWx0'
            (self.target / name).write_bytes(data)
            images.append({"name": name, "type": "sysupgrade", "filesystem": fs,
                           "sha256": hashlib.sha256(data).hexdigest()})
        (self.target / "profiles.json").write_text(json.dumps({"profiles": {
            "ariaboard_photonicat": {"supported_devices": ["ariaboard,photonicat"], "images": images}}}))

    def collect(self):
        return subprocess.run([sys.executable, str(ROOT / "scripts/collect-firmware.py"),
            str(self.root / "build"), str(self.root / "release")], capture_output=True, text=True)

    def test_fwtool_trailer_and_output_checksums(self):
        self.write_images()
        result = self.collect()
        self.assertEqual(result.returncode, 0, result.stderr)
        for line in (self.root / "release/sha256sums").read_text().splitlines():
            digest, name = line.split("  ", 1)
            self.assertEqual(digest, hashlib.sha256((self.root / "release" / name).read_bytes()).hexdigest())

    def test_missing_loader_rejected_with_matching_sha256(self):
        self.payload[0x8000:0x8004] = b"\0" * 4
        self.write_images()
        result = self.collect()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Missing RK3568 loader", result.stderr)

    def test_missing_package_blocks_release(self):
        self.write_images()
        self.manifest.write_text(self.manifest.read_text().replace("wlmb-server - 1.0", ""))
        result = self.collect()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Missing installed packages", result.stderr)

    def test_legacy_qmodem_ui_blocks_release_with_next(self):
        self.write_images()
        self.manifest.write_text(self.manifest.read_text() + "\nluci-app-qmodem-sms - 1.0\n")
        result = self.collect()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Conflicting installed packages", result.stderr)

@unittest.skipIf(os.name == "nt", "OpenWrt shell integration runs on Linux CI")
class QModemFailoverTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.state = self.root / "uci.json"
        self.state.write_text(json.dumps({"mwan3.failover": "policy", "qmodem.modem0": "modem-device",
            "network.modem0.modem_config": "modem0", "network.modem0.proto": "dhcp",
            "network.modem0v6.modem_config": "modem0", "network.modem0v6.proto": "dhcpv6",
            "network.bridge_mgmt.modem_config": "modem0", "network.bridge_mgmt.proto": "static"}))
        uci = self.root / "uci"
        uci.write_text("""#!/usr/bin/env python3
import json,os,sys
p=os.environ['UCI_STATE']; state=json.load(open(p)); args=[a for a in sys.argv[1:] if a!='-q']; cmd=args[0]
if cmd=='get':
    if args[1] not in state: sys.exit(1)
    v=state[args[1]]; print(' '.join(v) if isinstance(v,list) else v)
elif cmd in ('set','add_list'):
    k,v=args[1].split('=',1)
    if cmd=='set': state[k]=v
    else: state.setdefault(k,[]).append(v)
    json.dump(state,open(p,'w'))
elif cmd=='commit': pass
else: sys.exit(2)
""")
        uci.chmod(0o755)
        service = self.root / "mwan3"
        service.write_text('#!/bin/sh\necho reload >> "$RELOAD_LOG"\n')
        service.chmod(0o755)
        hook = (ROOT / "files/etc/hotplug.d/iface/95-swrt-qmodem-mwan").read_text()
        hook = hook.replace("/etc/init.d/mwan3", str(service)).replace("/var/lock/swrt-qmodem-mwan.lock", str(self.root / "lock"))
        self.hook = self.root / "hook"
        self.hook.write_text(hook)
        self.env = {**os.environ, "PATH": str(self.root) + ":" + os.environ["PATH"],
            "UCI_STATE": str(self.state), "RELOAD_LOG": str(self.root / "reload.log"), "ACTION": "ifup"}

    def run_hook(self, interface):
        result = subprocess.run(["sh", str(self.hook)], env={**self.env, "INTERFACE": interface}, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(self.state.read_text())

    def test_enroll_once_preserving_manual_changes(self):
        state = self.run_hook("modem0")
        self.assertEqual(state["mwan3.failover.use_member"], ["swrt_modem0"])
        self.assertEqual(state["mwan3.swrt_modem0.metric"], "3")
        state["mwan3.swrt_modem0.metric"] = "4"
        self.state.write_text(json.dumps(state))
        state = self.run_hook("modem0")
        self.assertEqual(state["mwan3.swrt_modem0.metric"], "4")
        self.assertEqual(state["mwan3.failover.use_member"], ["swrt_modem0"])
        self.assertEqual((self.root / "reload.log").read_text(), "reload\n")

    def test_ipv6_management_other_wan_ignored(self):
        original = self.state.read_text()
        for interface in ("modem0v6", "bridge_mgmt", "wan"):
            self.run_hook(interface)
            self.assertEqual(self.state.read_text(), original)
        self.assertFalse((self.root / "reload.log").exists())

if __name__ == "__main__":
    unittest.main()
