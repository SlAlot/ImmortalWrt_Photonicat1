import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import textwrap
import unittest
from feed_fixtures import write_qmodem_runtime

ROOT = Path(__file__).resolve().parents[1]


class FeedCompatibilityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.weechat = self.root / "feeds/luci/applications/luci-app-weechat/Makefile"
        self.qmodem = self.root / "feeds/qmodem/application/qmodem/Makefile"
        self.kernel = self.root / "package/kernel/linux/modules/netdevices.mk"
        for path in (self.weechat, self.qmodem, self.kernel):
            path.parent.mkdir(parents=True, exist_ok=True)
        self.weechat.write_text("LUCI_DEPENDS:=+luci-base +weechat +rpcd-mod-ucode\n")
        self.qmodem.write_text("+PACKAGE_qmodem_GENERIC_MHI_PCIe_DRIVER:kmod-mhi-wwan \\\n")
        self.kernel.write_text("define KernelPackage/mhi-net\nendef\n")
        write_qmodem_runtime(self.root)

    def patch(self):
        return subprocess.run([os.sys.executable, str(ROOT / "scripts/patch-feeds.py"), str(self.root)],
                              capture_output=True, text=True)

    def test_real_provider_and_driver_name_with_idempotent_reapply(self):
        for _ in range(2):
            result = self.patch()
            self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("+weechat-minimal ", self.weechat.read_text())
        self.assertIn("PCIe_DRIVER:kmod-mhi-net ", self.qmodem.read_text())

    def test_changed_recipe_requires_review(self):
        self.qmodem.write_text("unrecognized dependency declaration\n")
        result = self.patch()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Unexpected feed recipe", result.stderr)


@unittest.skipIf(os.name == "nt", "Prepare pipeline regression runs on Linux CI")
class PreparePipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / "repo"
        self.repo.mkdir()
        for name in ("scripts", "files", "package"):
            shutil.copytree(ROOT / name, self.repo / name)
        for name in (".config", "feeds.conf.default", "sources.lock.json", "diy.sh"):
            shutil.copy2(ROOT / name, self.repo / name)
        self.build = self.repo / "openwrt"
        (self.build / "include").mkdir(parents=True)
        (self.build / "include/toplevel.mk").touch()
        (self.build / "tmp").mkdir()
        for name in (".packageinfo", ".config-package.in"):
            (self.build / "tmp" / name).touch()
        fixtures = {
            "feeds/luci/applications/luci-app-weechat/Makefile": "LUCI_DEPENDS:=+weechat \n",
            "feeds/qmodem/application/qmodem/Makefile": "PCIe_DRIVER:kmod-mhi-wwan \n",
            "package/kernel/linux/modules/netdevices.mk": "define KernelPackage/mhi-net\nendef\n",
            "feeds/nas_luci/luci/luci-app-quickstart/Makefile": "LUCI_MINIFY_JS:=0\n",
            "feeds/luci/applications/luci-app-passwall/root/usr/share/passwall/nftables.sh": "MWAN3_RULE_ARGS=test\n",
        }
        for name, content in fixtures.items():
            path = self.build / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
        write_qmodem_runtime(self.build)
        (self.build / "scripts").mkdir()
        feeds = self.build / "scripts/feeds"
        feeds.write_text("""#!/bin/sh
case "$1" in
    update|install) printf 'CONFIG_RESET_BY_FEEDS=y\\n' > .config ;;
    list) printf 'src-git fixture fixture^0123456789\\n' ;;
esac
exit 0
""")
        feeds.chmod(0o755)
        diffconfig = self.build / "scripts/diffconfig.sh"
        diffconfig.write_text("#!/bin/sh\ncat .config\n")
        diffconfig.chmod(0o755)
        bin_dir = self.root / "bin"
        bin_dir.mkdir()
        make = bin_dir / "make"
        make.write_text("""#!/bin/sh
cmp .config "$SWRT_TEST_SEED" || exit 9
case "$SWRT_TEST_MODE" in
    cycle) echo 'tmp/.config-package.in:1:error: recursive dependency detected!'; exit 0 ;;
    drop) sed -i 's/^CONFIG_PACKAGE_tom_modem=y$/# CONFIG_PACKAGE_tom_modem is not set/' .config ;;
esac
echo '# configuration written to .config'
""")
        make.chmod(0o755)
        git = bin_dir / "git"
        git.write_text("#!/bin/sh\nprintf '0123456789012345678901234567890123456789\\n'\n")
        git.chmod(0o755)
        self.env = {**os.environ, "PATH": str(bin_dir) + ":" + os.environ["PATH"],
                    "GITHUB_WORKSPACE": str(self.repo), "SWRT_TEST_SEED": str(self.repo / ".config"),
                    "SWRT_TEST_MODE": "success"}
        workflow = (ROOT / ".github/workflows/swrt.yml").read_text()
        block = workflow.split("      - name: Install feeds and resolve configuration\n", 1)[1].split("      - name:", 1)[0]
        self.command = textwrap.dedent(block.split("run: |\n", 1)[1])

    def run_prepare(self, mode):
        return subprocess.run(["bash", "--noprofile", "--norc", "-e", "-o", "pipefail", "-c", self.command],
                              cwd=self.repo, env={**self.env, "SWRT_TEST_MODE": mode},
                              capture_output=True, text=True)

    def test_feed_index_cannot_replace_intended_package_selection(self):
        result = self.run_prepare("success")
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        resolved = self.build / "swrt-metadata/config.resolved"
        self.assertEqual(resolved.read_text(), (self.repo / ".config").read_text())
        self.assertIn("Validated", result.stdout)

    def test_recursive_dependency_is_fatal_even_when_make_returns_zero(self):
        result = self.run_prepare("cycle")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("recursive dependency", (self.repo / "prepare.log").read_text())
        self.assertFalse((self.build / "swrt-metadata/config.resolved").exists())

    def test_missing_tom_fails_through_tee_in_actual_workflow_step(self):
        result = self.run_prepare("drop")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Missing PACKAGE_tom_modem", (self.repo / "prepare.log").read_text())
        self.assertFalse((self.build / "swrt-metadata/config.resolved").exists())
