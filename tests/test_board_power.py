import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
PATCH_NAME = "950-swrt-photonicat-keep-aux-power.patch"


def write_board_power(root):
    target = Path(root) / "target/linux/rockchip"
    (target / "patches-6.12").mkdir(parents=True, exist_ok=True)
    (target / "armv8").mkdir(parents=True, exist_ok=True)
    (target / "patches-6.12/106-arm64-dts-rockchip-complete-photonicat-dts.patch").write_bytes(
        (ROOT / "tests/fixtures/photonicat-106.patch").read_bytes())
    (target / "armv8/config-6.12").write_text("CONFIG_SERIAL_DEV_BUS=y\nCONFIG_SERIAL_DEV_CTRL_TTYPORT=y\n")


class BoardPowerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        write_board_power(self.root)
        self.target = self.root / "target/linux/rockchip"
        self.destination = self.target / "patches-6.12" / PATCH_NAME
        spec = importlib.util.spec_from_file_location("board_power", ROOT / "scripts/patch-board-power.py")
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)

    def test_pinned_patch_is_idempotent_and_records_rail_ownership(self):
        for _ in range(2): self.module.prepare(self.root)
        self.assertEqual(self.destination.read_bytes(), (ROOT / "patches/rockchip" / PATCH_NAME).read_bytes())
        audit = json.loads((self.root / "swrt-metadata/board-power.json").read_text())
        self.assertEqual(audit["mcu_backend"], "userspace-ttyS4")
        self.assertEqual(audit["auxiliary_gpio"], "GPIO4_D2")
        self.assertTrue(audit["boot_on"])
        self.assertFalse(audit["always_on"])
        self.assertEqual(audit["runtime_supply_policy"], "existing-usb-consumers")
        additions = [line for line in self.destination.read_text().splitlines()
                     if line.startswith("+") and not line.startswith("+++")]
        self.assertEqual(additions, ["+\t\tregulator-boot-on;"])
        self.assertNotIn("gpio-hog", self.destination.read_text())

    def test_built_in_and_modular_kernel_owners_are_rejected_before_install(self):
        for mode in ("y", "m"):
            with self.subTest(mode=mode):
                (self.target / "armv8/config-6.12").write_text("CONFIG_PHOTONICAT_PM=" + mode + "\n")
                with self.assertRaisesRegex(ValueError, "Kernel MCU owner conflicts"):
                    self.module.prepare(self.root)
                self.assertFalse(self.destination.exists())

    def test_changed_device_source_requires_review(self):
        path = self.target / "patches-6.12" / self.module.BASE_PATCH
        path.write_bytes(path.read_bytes() + b"\nchanged upstream\n")
        with self.assertRaisesRegex(ValueError, "device-tree source changed"):
            self.module.prepare(self.root)
        self.assertFalse(self.destination.exists())

    def test_generic_and_target_kernel_layers_cannot_hide_an_mcu_owner(self):
        for path in ("target/linux/generic/config-6.12", "target/linux/rockchip/config-6.12"):
            with self.subTest(layer=path):
                layer = self.root / path
                layer.parent.mkdir(parents=True, exist_ok=True)
                layer.write_text("CONFIG_PHOTONICAT_PM=y\n")
                with self.assertRaisesRegex(ValueError, "Kernel MCU owner conflicts"):
                    self.module.prepare(self.root)
                self.assertFalse(self.destination.exists())
                layer.unlink()

    def test_other_local_patch_is_preserved(self):
        self.destination.write_text("local adjustment\n")
        with self.assertRaisesRegex(ValueError, "refusing to overwrite"):
            self.module.prepare(self.root)
        self.assertEqual(self.destination.read_text(), "local adjustment\n")

    def test_legacy_v1_service_is_not_allowed_with_swrt_backend(self):
        path = self.root / ".config"
        path.write_text((ROOT / ".config").read_text() + "\nCONFIG_PACKAGE_pcat-manager-v1=y\n")
        result = subprocess.run([sys.executable, str(ROOT / "scripts/check-config.py"), str(path)],
                                capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Unexpected PACKAGE_pcat-manager-v1", result.stderr)

    @unittest.skipIf(os.name == "nt", "Native patch and DTC checks run on Linux")
    def test_patch_compiles_and_preserves_gpio_and_supply_references(self):
        source = self.root / "arch/arm64/boot/dts/rockchip/rk3568-photonicat.dts"
        source.parent.mkdir(parents=True)
        shutil.copyfile(ROOT / "tests/fixtures/photonicat-aux-power.dts", source)
        before = self.root / "before.dtb"
        after = self.root / "after.dtb"
        subprocess.run(["dtc", "-q", "-I", "dts", "-O", "dtb", "-o", str(before), str(source)], check=True)
        original = source.read_text()
        result = subprocess.run(["patch", "--fuzz=0", "-p1", "-i", str(ROOT / "patches/rockchip" / PATCH_NAME)],
                                cwd=self.root, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        anchor = '\t\tregulator-name = "vcc5v0_boost";\n'
        self.assertEqual(source.read_text(), original.replace(anchor,
            anchor + "\t\tregulator-boot-on;\n"))
        subprocess.run(["dtc", "-q", "-I", "dts", "-O", "dtb", "-o", str(after), str(source)], check=True)
        def get(path, node, prop):
            return subprocess.check_output(["fdtget", "-tx", str(path), node, prop], text=True).strip()
        for node, prop in (("/regulator-vcc5v0-boost", "gpio"),
                           ("/regulator-vcc5v0-boost", "vin-supply"),
                           ("/regulator-vcc5v0-boost", "pinctrl-0"), ("/usb-phy", "phy-supply")):
            self.assertEqual(get(before, node, prop), get(after, node, prop))
        props = subprocess.check_output(["fdtget", "-p", str(after), "/regulator-vcc5v0-boost"], text=True)
        self.assertIn("regulator-boot-on", props.splitlines())
        self.assertNotIn("regulator-always-on", props.splitlines())


if __name__ == "__main__": unittest.main()
