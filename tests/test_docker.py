import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("docker_patch", ROOT / "scripts/patch-docker.py")
patch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patch)


def write_docker(root):
    paths = {
        "feeds/luci/" + patch.MENU: "menu.json",
        "feeds/luci/" + patch.COMMON: "common.js",
        "feeds/packages/" + patch.DAEMON: "dockerd.init",
        "feeds/luci/" + patch.CONTROLLER: "docker_controller.uc",
        "feeds/luci/applications/luci-app-dockerman/htdocs/luci-static/resources/dockerman/api.js": "api.js",
        "feeds/luci/applications/luci-app-dockerman/htdocs/luci-static/resources/view/dockerman/container.js": "container.js",
        "feeds/luci/applications/luci-app-dockerman/root/usr/share/rpcd/ucode/docker_rpc.uc": "docker_rpc.uc",
    }
    for path, fixture in paths.items():
        dest = root / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / "tests/fixtures/docker" / fixture, dest)


class DockerCompatibilityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        write_docker(self.root)

    def test_sidebar_and_legacy_routes_keep_auth_and_post_guards(self):
        original = json.loads((self.root / "feeds/luci" / patch.MENU).read_text())
        patch.patch_docker(self.root)
        menu = json.loads((self.root / "feeds/luci" / patch.MENU).read_text())
        self.assertEqual(menu["admin/docker"]["title"], "Docker")
        # LuCI firstchild ignores children without titles. A hidden old root
        # therefore needs an alias instead of firstchild over hidden children.
        self.assertEqual(menu[patch.OLD]["action"], {"type": "alias", "path": patch.NEW})
        for path, old in original.items():
            with self.subTest(path=path):
                self.assertNotIn("title", menu[path])
                current = menu[path.replace(patch.OLD, patch.NEW, 1)]
                for attr in ("auth", "depends"):
                    self.assertEqual(old.get(attr), current.get(attr))
                self.assertEqual(old["action"].get("post"), current["action"].get("post"))
        common = (self.root / "feeds/luci" / patch.COMMON).read_text(encoding="utf-8")
        self.assertIn("L.url('admin/docker')", common)
        self.assertNotIn("L.url('admin/services/dockerman')", common)

    def test_reapply_and_drift_fail_before_any_write(self):
        patch.patch_docker(self.root)
        files = {p: p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        patch.patch_docker(self.root)
        self.assertEqual(files, {p: p.read_bytes() for p in self.root.rglob("*") if p.is_file()})
        daemon = self.root / "feeds/packages" / patch.DAEMON
        daemon.write_text(daemon.read_text() + "# unknown change\n")
        with self.assertRaisesRegex(ValueError, "changed"):
            patch.patch_docker(self.root)

    def test_unknown_pinned_source_is_rejected(self):
        daemon = self.root / "feeds/packages" / patch.DAEMON
        daemon.write_text(daemon.read_text() + "# unknown change\n")
        menu = self.root / "feeds/luci" / patch.MENU
        before = menu.read_bytes()
        with self.assertRaisesRegex(ValueError, "source changed"):
            patch.patch_docker(self.root)
        self.assertEqual(menu.read_bytes(), before)

    @unittest.skipUnless(shutil.which("node"), "Node.js required")
    def test_http_stream_helpers_handle_split_headers_and_partial_writes(self):
        patch.patch_docker(self.root)
        controller = (self.root / "feeds/luci" / patch.CONTROLLER).read_text()
        backend = (self.root / "feeds/luci" / patch.RPC).read_text()
        self.assertIn("import * as http from 'luci.http';", controller)
        self.assertEqual(controller.count("response_buff = read_http_start(sock)"), 2)
        self.assertEqual(backend.count("response_buff = read_http_start(sock)"), 1)
        helpers = (ROOT / "patches/luci/docker-http-helpers.uc").read_text()
        self.assertIn(helpers, controller)
        self.assertIn(helpers, backend)
        script = r'''
const assert = require('node:assert/strict');
const length = value => value.length;
const substr = (value, offset) => value.slice(offset);
const index = (value, pattern) => value.indexOf(pattern);
const die = message => { throw new Error(message); };
const BLOCKSIZE = 8192;
const socket = { POLLIN: 1, poll: (timeout, fds) => fds[0].chunks?.length ? [1] : [] };
''' + helpers + r'''
const response = 'HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\nDATA';
const split = {chunks: ['HTTP/1.', '1 200 OK\r\nCont', 'ent-Length: 4\r\n\r', '\nDATA'], recv() {return this.chunks.shift();}};
assert.equal(read_http_start(split), response);
assert.equal(read_http_start({chunks:['partial'], recv(){return this.chunks.shift();}}), null);
const excessive={chunks:new Array(10).fill('x'.repeat(8192)),recv(){return this.chunks.shift();}};
assert.equal(read_http_start(excessive), null);
let sent='';
const writer={send(data){sent+=data.slice(0,2);return Math.min(2,data.length);},close(){throw new Error('unexpected close');}};
assert.equal(send_all(writer,'payload'),true);
assert.equal(sent,'payload');
let closed=false;
assert.throws(()=>send_all({send(){return 0;},close(){closed=true;}},'payload'), /write failed/);
assert.equal(closed,true);
'''
        result = subprocess.run([shutil.which("node"), "-e", script], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_changed_integration_requires_clean_pinned_feeds(self):
        patch.patch_docker(self.root)
        audit = self.root / "swrt-metadata/docker-compat.json"
        data = json.loads(audit.read_text())
        data["revision"] = "old-integration"
        audit.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "integration changed"):
            patch.patch_docker(self.root)

    def test_router_forwarding_preserves_established_replies_and_user_overrides(self):
        patch.patch_docker(self.root)
        daemon = (self.root / "feeds/packages" / patch.DAEMON).read_text()
        self.assertIn('ip_forward_no_drop "1"', daemon)
        self.assertIn('json_add_boolean "ip-forward-no-drop"', daemon)
        self.assertIn("'--match conntrack ! --ctstate RELATED,ESTABLISHED'", daemon)
        self.assertNotIn('uci set', daemon)
        self.assertIn('config_get extra_iptables_args "${cfg}"', daemon)

    def test_legacy_library_has_recorded_upstream_and_no_second_daemon(self):
        lib = ROOT / "package/luci-lib-docker"
        self.assertEqual(hashlib.sha256((ROOT / "tests/fixtures/docker/docker-legacy.lua").read_bytes()).hexdigest(),
                         "d6dd5087436fa259f5bf8965faf9d158af6c57294cfe1458523e1d7c5a667058")
        self.assertIn("Copyright 2019 lisaac", (lib / "luasrc/docker.lua").read_text())
        self.assertEqual(hashlib.sha256((lib / "luasrc/model/docker.lua").read_bytes()).hexdigest(),
                         "bf0baf0207955f7656b3a15ad06139e610603d7fb3d803dab5eded217994b020")
        self.assertFalse((lib / "root/etc/init.d").exists())
        self.assertFalse((lib / "luasrc/controller").exists())

    @unittest.skipUnless(shutil.which("node"), "Node.js required")
    def test_actual_patched_log_decoder_handles_binary_frames(self):
        patch.patch_docker(self.root)
        api = self.root / "feeds/luci/applications/luci-app-dockerman/htdocs/luci-static/resources/dockerman/api.js"
        source = api.read_text()
        func = source.split("function parse_multiplexed_stream(buffer) {", 1)[1].split("\n}\n", 1)[0]
        script = "function decode(buffer) {" + func + "\n}\n" + r'''
const assert = require('node:assert/strict');
function frame(type, text) {
    const body = Buffer.from(text), header = Buffer.alloc(8);
    header[0] = type; header.writeUInt32BE(body.length, 4);
    return Buffer.concat([header, body]);
}
const input = Buffer.concat([frame(1, '  ready\n'), frame(2, '错误\n'), frame(1, 'done\n')]);
assert.equal(decode(input).map(f => f.payload).join(''), '  ready\n错误\ndone\n');
assert.deepEqual(decode(Buffer.alloc(0)), []);
assert.deepEqual(decode(Buffer.from([1,0])), []);
assert.deepEqual(decode(frame(1, 'incomplete').subarray(0,9)), []);
'''
        result = subprocess.run([shutil.which("node"), "-e", script], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
