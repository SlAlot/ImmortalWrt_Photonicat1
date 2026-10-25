import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
VALID = "".join("CONFIG_" + name + "=y\n" for name in (
    "PHOTONICAT_PM", "SERIAL_DEV_BUS", "SERIAL_DEV_CTRL_TTYPORT", "SERIAL_8250",
    "SERIAL_8250_DW", "POWER_SUPPLY", "RTC_CLASS"))



def write_kernel_config(root):
    path = Path(root) / "build_dir/target-aarch64_generic_musl/linux-rockchip_armv8/linux-6.12.103/.config"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(VALID)
    return path


class ResolvedKernelPowerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.config = write_kernel_config(self.root)
        spec = importlib.util.spec_from_file_location("kernel_power", ROOT / "scripts/check-kernel-power.py")
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)

    def test_resolved_config_is_audited_and_copied(self):
        self.module.check(self.root)
        audit = self.root / "swrt-metadata"
        self.assertEqual((audit / "kernel.config").read_bytes(), self.config.read_bytes())
        record = json.loads((audit / "kernel-power.json").read_text())
        self.assertEqual(record["kernel_config_sha256"], hashlib.sha256(self.config.read_bytes()).hexdigest())
        self.assertTrue(record["kernel_mcu_owner"])

    def test_missing_or_modular_official_kernel_owner_blocks_release(self):
        for mode in ("n", "m"):
            with self.subTest(mode=mode):
                self.config.write_text(VALID.replace("CONFIG_PHOTONICAT_PM=y", "CONFIG_PHOTONICAT_PM=" + mode))
                with self.assertRaisesRegex(ValueError, "Official power backend must be built"):
                    self.module.check(self.root)
                self.assertFalse((self.root / "swrt-metadata/kernel-power.json").exists())

    def test_missing_or_modular_uart_is_rejected(self):
        for symbol in ("CONFIG_SERIAL_8250", "CONFIG_SERIAL_8250_DW"):
            with self.subTest(symbol=symbol):
                self.config.write_text(VALID.replace(symbol + "=y", symbol + "=m"))
                with self.assertRaisesRegex(ValueError, "Official power backend must be built"):
                    self.module.check(self.root)

    def test_missing_resolved_config_is_not_treated_as_success(self):
        self.config.unlink()
        with self.assertRaisesRegex(ValueError, "found 0"):
            self.module.check(self.root)

    def test_multiple_kernel_builds_require_review(self):
        other = self.config.parents[1] / "linux-6.12.104/.config"
        other.parent.mkdir()
        other.write_text(VALID)
        with self.assertRaisesRegex(ValueError, "found 2"):
            self.module.check(self.root)
