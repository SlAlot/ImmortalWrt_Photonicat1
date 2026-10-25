from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(shutil.which("grep"), "GNU grep required by OpenWrt's package scanner")
class PackageDiscoveryTests(unittest.TestCase):
    def test_local_luci_library_is_found_by_pinned_openwrt_scanner(self):
        # Use the exact expression in the pinned scanner, not a list of
        # packages supplied by a mocked feeds/make command.
        scanner = (ROOT / "tests/fixtures/openwrt-package-scan.mk").read_text()
        pattern = re.search(r"else\n  GREP_STRING=([^\n]+)\nendif", scanner).group(1)
        recipe = ROOT / "package/luci-lib-docker/Makefile"
        result = subprocess.run(["grep", "-aHE", "call " + pattern, str(recipe)],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, "OpenWrt will silently skip this local package")
        self.assertIn("call BuildPackage", result.stdout)
        with tempfile.TemporaryDirectory() as folder:
            original = Path(folder) / "Makefile"
            original.write_text(recipe.read_text().replace(
                "# call BuildPackage - OpenWrt buildroot signature\n", ""))
            missing = subprocess.run(["grep", "-aHE", "call " + pattern, str(original)],
                                     capture_output=True, text=True)
            self.assertEqual(missing.returncode, 1, "The regression case must reproduce the skipped package")
