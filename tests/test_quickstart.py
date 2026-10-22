import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("quickstart_patch", ROOT / "scripts/patch-quickstart.py")
patcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patcher)


def write_quickstart(root):
    """Small pinned bundle contexts, also used by the simulated feed pipeline."""
    base = root / "feeds/nas_luci/luci/luci-app-quickstart"
    js = base / "htdocs/luci-static/quickstart/index.js"
    js.parent.mkdir(parents=True, exist_ok=True)
    js.write_text('''var go=Object.defineProperty,
Status:{GET(){return W("/u/network/status/",{method:"GET"})}}
Qa=()=>{const o=document.createElement("div");
appStore:{component:u4,props:{color:"#ffffff"}}
color:"orange",alink:"/cgi-bin/luci/admin/store/pages/store"}
window.open(`${(B=(z=window.quickstart_configs)==null?void 0:z.ttyd)!=null&&B.ssl?"https":"http"}://${window.location.hostname}:${((M=(H=window.quickstart_configs)==null?void 0:H.ttyd)==null?void 0:M.port)||7681}/`,"_blank")
''', encoding="utf-8")
    template = base / "luasrc/view/quickstart/main.htm"
    template.parent.mkdir(parents=True, exist_ok=True)
    template.write_text('      window.token =\n<%+footer%>', encoding="utf-8")
    controller = base / "luasrc/controller/quickstart.lua"
    controller.parent.mkdir(parents=True, exist_ok=True)
    controller.write_text('''function index()
    if luci.sys.call("pgrep quickstart >/dev/null") == 0 then
        entry({"admin", "quickstart"}, template("quickstart/home"), _("QuickStart"), 1).leaf = true
    else
        entry({"admin", "quickstart"}, call("redirect_fallback")).leaf = true
    end
end
''', encoding="utf-8")
    return js


class QuickStartPatchTests(unittest.TestCase):
    def test_guarded_bundle_patch_reapplies_without_duplicate_card(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            js = write_quickstart(root)
            patcher.patch_quickstart(root)
            patched = js.read_text(encoding="utf-8")
            patcher.patch_quickstart(root)
            self.assertEqual(js.read_text(encoding="utf-8"), patched)
            self.assertEqual(patched.count('icon:"swrtPanel"'), 1)
            js.write_text(patched.replace('.then(swrtNetworkStatus)', '.changed()'), encoding="utf-8")
            with self.assertRaises(SystemExit):
                patcher.patch_quickstart(root)

    @unittest.skipUnless(shutil.which("node"), "Node is needed for frontend status regression")
    def test_real_frontend_preserves_failures_and_requires_successful_probe(self):
        result = subprocess.run(["node", str(ROOT / "tests/quickstart-status.mjs")],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    @unittest.skipUnless(shutil.which("lua5.1") or shutil.which("lua"), "Lua 5.1 runs on Linux CI")
    def test_routes_register_before_backend_starts(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            write_quickstart(root)
            patcher.patch_quickstart(root)
            controller = root / "feeds/nas_luci/luci/luci-app-quickstart/luasrc/controller/quickstart.lua"
            harness = root / "route-test.lua"
            harness.write_text('''
luci = { sys = { call = function() error("Route registration must not inspect running processes") end } }
local installed = true
nixio = { fs = { access = function(path) assert(path == "/usr/sbin/quickstart"); return installed end } }
local route
entry = function(path, action) route = action; return {} end
template = function(path) return { kind = "template", path = path } end
call = function(name) return { kind = "call", name = name } end
_ = function(text) return text end
dofile(arg[1])
index()
assert(route.kind == "template" and route.path == "quickstart/home")
installed = false
index()
assert(route.kind == "call" and route.name == "redirect_fallback")
''', encoding="utf-8")
            result = subprocess.run([shutil.which("lua5.1") or shutil.which("lua"),
                                     str(harness), str(controller)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)


@unittest.skipIf(os.name == "nt", "The BusyBox-compatible probe runs on Linux CI")
class ApkProbeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.feeds = self.root / "feeds.list"
        self.feeds.write_text("https://example.test/base/packages.adb\n")
        script = (ROOT / "files/usr/libexec/swrt-apk-status").read_text()
        script = script.replace("/etc/apk/repositories.d/distfeeds.list", str(self.feeds))
        script = script.replace("/var/run/swrt-apk-status", str(self.root / "cache"))
        self.script = self.root / "probe"
        self.script.write_text(script)
        bin_dir = self.root / "bin"
        bin_dir.mkdir()
        # Record exact argv: probe the index, never the nonexistent .asc file.
        curl = bin_dir / "curl"
        curl.write_text('#!/bin/sh\nprintf "%s\\n" "$@" >> "$PROBE_ARGS"\nexit "$PROBE_EXIT"\n')
        curl.chmod(0o755)
        self.env = {**os.environ, "PATH": str(bin_dir) + ":" + os.environ["PATH"],
                    "PROBE_ARGS": str(self.root / "args"), "PROBE_EXIT": "0"}

    def run_probe(self, code="0"):
        result = subprocess.run(["sh", str(self.script)],
                                env={**self.env, "PROBE_EXIT": code}, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.strip()

    def test_actual_index_cache_and_config_change_invalidation(self):
        self.assertEqual(self.run_probe(), "ok")
        self.assertEqual(self.run_probe("22"), "ok")
        args = (self.root / "args").read_text()
        self.assertEqual(args.count("https://example.test/base/packages.adb"), 1)
        self.assertNotIn(".asc", args)
        self.feeds.write_text("https://broken.test/base/packages.adb\n")
        self.assertEqual(self.run_probe("22"), "failed")

    def test_http_timeout_and_missing_configuration_never_report_success(self):
        self.assertEqual(self.run_probe("28"), "failed")
        self.feeds.write_text("# https://disabled.test/base/packages.adb\n")
        self.assertEqual(self.run_probe(), "unavailable")
