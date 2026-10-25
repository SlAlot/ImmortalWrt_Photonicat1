#!/usr/bin/env python3
"""Install the pinned official Photonicat 1 kernel power stack."""
import hashlib
import json
from pathlib import Path
import re
import sys

BASE_PATCH = "106-arm64-dts-rockchip-complete-photonicat-dts.patch"
BASE_SHA256 = "bdad6910e4c10c33a12df0e16793af28b4686b2a0af222228f17163c13556dad"
PATCH_NAME = "950-swrt-photonicat-keep-aux-power.patch"
DRIVER_PATCH = "990-photonicat-pm-add-driver.patch"
DRIVER_SHA256 = "40a5a540f6b3169cf590cbf246548ea78cdbf287e61a1c764c242f0d1a86ff99"
REQUIRED = ("PHOTONICAT_PM", "SERIAL_DEV_BUS", "SERIAL_DEV_CTRL_TTYPORT",
            "SERIAL_8250", "SERIAL_8250_DW", "STAGING", "POWER_RESET",
            "RTC_CLASS", "HWMON", "POWER_SUPPLY", "THERMAL")


def prepare(root):
    root = Path(root)
    target = root / "target/linux/rockchip"
    kernel = target / "armv8/config-6.12"
    patch_dir = target / "patches-6.12"
    base_hash = hashlib.sha256((patch_dir / BASE_PATCH).read_bytes()).hexdigest()
    if base_hash != BASE_SHA256:
        raise ValueError("Photonicat device-tree source changed; review official power bindings")
    repo = Path(__file__).resolve().parents[1]
    files = {}
    for name in (PATCH_NAME, DRIVER_PATCH):
        payload = (repo / "patches/rockchip" / name).read_bytes()
        if name == DRIVER_PATCH and hashlib.sha256(payload).hexdigest() != DRIVER_SHA256:
            raise ValueError("Official kernel power driver changed; review its pinned source")
        destination = patch_dir / name
        if destination.exists() and destination.read_bytes() != payload:
            raise ValueError("A different power patch is already present; refusing to overwrite " + name)
        files[destination] = payload
    config = kernel.read_text(encoding="utf-8")
    for name in REQUIRED:
        pattern = rf"^(?:CONFIG_{name}=.*|# CONFIG_{name} is not set)$"
        config, count = re.subn(pattern, "CONFIG_" + name + "=y", config, flags=re.M)
        if count == 0:
            config += "\nCONFIG_" + name + "=y\n"
    for destination, payload in files.items():
        destination.write_bytes(payload)
    kernel.write_bytes(config.encode())
    audit = root / "swrt-metadata"
    audit.mkdir(exist_ok=True)
    (audit / "board-power.json").write_text(json.dumps({
        "board": "ariaboard,photonicat", "mcu_backend": "official-kernel-serdev",
        "base_patch_sha256": base_hash,
        "patch_sha256": hashlib.sha256(files[patch_dir / PATCH_NAME]).hexdigest(),
        "driver_sha256": DRIVER_SHA256,
        "auxiliary_gpio": "GPIO4_D2", "auxiliary_owner": "official-aux-pwren-gpio-hog",
        "main_power_owner": "photonicat-pm", "pm_version": 1,
        "comparison_repository": "photonicat/photonicat_openwrt",
        "comparison_commit": "119964435eb7bc6384eed8ecee7bd7104b6e8ee2"
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Installed pinned official Photonicat 1 kernel power driver and matching device-tree bindings")


if __name__ == "__main__":
    prepare(sys.argv[1])
