import hashlib
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


def block(text, start):
    begin = text.index(start)
    pos = text.index("{", begin) + 1
    depth = 1
    while depth:
        if text[pos] == "{": depth += 1
        if text[pos] == "}": depth -= 1
        pos += 1
    return text[begin:pos + 1]


def power_fragment(text):
    # Compile the actual patched power nodes with stub labels for unrelated
    # SoC resources, so this unit test needs no downloaded kernel headers.
    body = '/dts-v1/;\n/ {\n'
    body += 'gpio1: gpio1 { gpio-controller; #gpio-cells=<2>; };\n'
    body += 'gpio4: gpio4 { gpio-controller; #gpio-cells=<2>; };\n'
    body += 'uart4: serial@fe680000 { };\n'
    body += 'vcc5v0_boost_en: pinctrl { };\n'
    body += 'vcc5v0_usb30_otg0: usb-power { };\n'
    body += 'usb2phy0_otg: usb-phy { };\n'
    body += block(text, 'battery: battery {') + '\n'
    for node in ('gpio-poweroff {', 'vcc5v0_boost: regulator-vcc5v0-boost {'):
        if node in text: body += block(text, node) + '\n'
    body += '};\n' + block(text, '&uart4 {') + '\n' + block(text, '&usb2phy0_otg {') + '\n'
    if '&gpio4 {' in text: body += block(text, '&gpio4 {') + '\n'
    for name, value in {'RK_PB2':'10', 'RK_PD2':'26', 'GPIO_ACTIVE_HIGH':'0', 'GPIO_ACTIVE_LOW':'1'}.items():
        body = body.replace(name, value)
    return body


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

    def test_official_stack_is_pinned_idempotent_and_builtin(self):
        for _ in range(2): self.module.prepare(self.root)
        self.assertEqual(self.destination.read_bytes(), (ROOT / "patches/rockchip" / PATCH_NAME).read_bytes())
        driver = self.target / "patches-6.12" / self.module.DRIVER_PATCH
        self.assertEqual(hashlib.sha256(driver.read_bytes()).hexdigest(), self.module.DRIVER_SHA256)
        audit = json.loads((self.root / "swrt-metadata/board-power.json").read_text())
        self.assertEqual(audit["mcu_backend"], "official-kernel-serdev")
        self.assertEqual(audit["main_power_owner"], "photonicat-pm")
        self.assertEqual(audit["auxiliary_owner"], "official-aux-pwren-gpio-hog")
        self.assertEqual(audit["pm_version"], 1)
        config = (self.target / "armv8/config-6.12").read_text()
        for name in self.module.REQUIRED:
            self.assertIn("CONFIG_" + name + "=y", config)

    def test_raw_uart_or_modular_seed_is_upgraded_to_matched_builtin_driver(self):
        for mode in ("n", "m", "y"):
            (self.target / "armv8/config-6.12").write_text("CONFIG_PHOTONICAT_PM=" + mode + "\n")
            self.module.prepare(self.root)
            config = (self.target / "armv8/config-6.12").read_text()
            self.assertEqual(config.count("CONFIG_PHOTONICAT_PM=y"), 1)

    def test_changed_device_source_requires_review(self):
        path = self.target / "patches-6.12" / self.module.BASE_PATCH
        path.write_bytes(path.read_bytes() + b"\nchanged upstream\n")
        with self.assertRaisesRegex(ValueError, "device-tree source changed"):
            self.module.prepare(self.root)
        self.assertFalse(self.destination.exists())

    def test_other_local_patch_is_preserved(self):
        self.destination.write_text("local adjustment\n")
        with self.assertRaisesRegex(ValueError, "refusing to overwrite"):
            self.module.prepare(self.root)
        self.assertEqual(self.destination.read_text(), "local adjustment\n")

    def test_other_driver_patch_is_rejected_before_any_write(self):
        driver = self.target / "patches-6.12" / self.module.DRIVER_PATCH
        driver.write_text("local driver\n")
        with self.assertRaisesRegex(ValueError, "refusing to overwrite"):
            self.module.prepare(self.root)
        self.assertFalse(self.destination.exists())

    def test_legacy_v1_service_is_not_allowed_with_swrt_backend(self):
        path = self.root / ".config"
        path.write_text((ROOT / ".config").read_text() + "\nCONFIG_PACKAGE_pcat-manager-v1=y\n")
        result = subprocess.run([sys.executable, str(ROOT / "scripts/check-config.py"), str(path)],
                                capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Unexpected PACKAGE_pcat-manager-v1", result.stderr)

    @unittest.skipIf(os.name == "nt", "Native GNU patch and DTC checks run on Linux")
    def test_official_power_patch_applies_and_has_one_gpio_owner(self):
        source = self.root / "arch/arm64/boot/dts/rockchip/rk3568-photonicat.dts"
        source.parent.mkdir(parents=True)
        shutil.copyfile(ROOT / "tests/fixtures/photonicat-before.dts", source)
        result = subprocess.run(["patch", "--fuzz=0", "-p1", "-i", str(ROOT / "patches/rockchip" / PATCH_NAME)],
                                cwd=self.root, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        fragment = self.root / "power.dts"
        fragment.write_text(power_fragment(source.read_text()))
        dtb = self.root / "power.dtb"
        subprocess.run(["dtc", "-q", "-I", "dts", "-O", "dtb", "-o", str(dtb), str(fragment)], check=True)
        def get(node, prop):
            return subprocess.check_output(["fdtget", "-tu", str(dtb), node, prop], text=True).split()
        self.assertEqual(get('/serial@fe680000/pcat-pm', 'pm-version'), ['1'])
        gpio = get('/serial@fe680000/pcat-pm', 'power-gpio')
        self.assertEqual(gpio[1:], ['10', '0'])
        self.assertEqual(gpio[0], get('/gpio1', 'phandle')[0])
        self.assertEqual(get('/gpio4/aux-pwren', 'gpios'), ['26', '0'])
        subprocess.run(["fdtget", "-p", str(dtb), '/gpio4/aux-pwren'], check=True, capture_output=True)
        roots = subprocess.check_output(["fdtget", "-l", str(dtb), '/'], text=True).splitlines()
        self.assertNotIn('gpio-poweroff', roots)
        self.assertNotIn('regulator-vcc5v0-boost', roots)
        self.assertEqual(get('/usb-phy', 'phy-supply'), get('/usb-power', 'phandle'))
        self.assertEqual(get('/battery', 'voltage-min-design-microvolt'), ['3560000'])
        self.assertEqual(get('/battery', 'voltage-max-design-microvolt'), ['4100000'])
        self.assertEqual(get('/serial@fe680000/pcat-pm/charger', 'monitored-battery'), get('/battery', 'phandle'))


if __name__ == "__main__": unittest.main()
