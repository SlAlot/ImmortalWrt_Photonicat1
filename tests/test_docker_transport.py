from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
LUA = shutil.which("lua5.1") or shutil.which("lua")


@unittest.skipUnless(LUA, "Lua 5.1 required; Linux CI installs Lua and cjson")
class DockerTransportTests(unittest.TestCase):
    def test_socket_boundaries_and_unavailable_daemon(self):
        for case in ("json_fragments", "chunked_json", "ndjson_fragments", "daemon_unavailable",
                     "failed_send", "empty_response", "complete_request_write", "invalid_json",
                     "multiplexed_logs", "tty_logs", "failed_body_write", "progress_callback",
                     "truncated_logs"):
            with self.subTest(case=case):
                result = subprocess.run([LUA, str(ROOT / "tests/test_docker_transport.lua"),
                                         str(ROOT / "package/luci-lib-docker/luasrc/docker.lua"), case],
                                        capture_output=True, text=True, encoding="utf-8")
                self.assertEqual(result.returncode, 0, result.stderr)
