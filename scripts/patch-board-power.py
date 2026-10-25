#!/usr/bin/env python3
"""Keep one Photonicat 1 power backend and preserve its auxiliary supply."""
import hashlib
import json
from pathlib import Path
import re
import sys

BASE_PATCH = "106-arm64-dts-rockchip-complete-photonicat-dts.patch"
BASE_SHA256 = "bdad6910e4c10c33a12df0e16793af28b4686b2a0af222228f17163c13556dad"
PATCH_NAME = "950-swrt-photonicat-keep-aux-power.patch"


def prepare(root):
    root = Path(root)
    target = root / "target/linux/rockchip"
    kernel = target / "armv8/config-6.12"
    # The official new kernel owns UART4 through serdev, whereas the current
    # SWRT backend owns the raw tty. Package exclusions alone cannot detect a
    # built-in kernel driver.
    layers = [root / "target/linux/generic/config-6.12", target / "config-6.12", kernel]
    for layer in layers:
        if layer == kernel or layer.exists():
            if re.search(r"^CONFIG_PHOTONICAT_PM=[ym]$", layer.read_text(), re.M):
                raise ValueError("Kernel MCU owner conflicts with SWRT UART backend; review " + str(layer))
    patch_dir = target / "patches-6.12"
    base = patch_dir / BASE_PATCH
    base_hash = hashlib.sha256(base.read_bytes()).hexdigest()
    if base_hash != BASE_SHA256:
        raise ValueError("Photonicat device-tree source changed; review auxiliary supply ownership")
    payload = (Path(__file__).resolve().parents[1] / "patches/rockchip" / PATCH_NAME).read_bytes()
    destination = patch_dir / PATCH_NAME
    if destination.exists() and destination.read_bytes() != payload:
        raise ValueError("A different auxiliary supply patch is already present; refusing to overwrite")
    destination.write_bytes(payload)
    audit = root / "swrt-metadata"
    audit.mkdir(exist_ok=True)
    (audit / "board-power.json").write_text(json.dumps({
        "board": "ariaboard,photonicat", "mcu_backend": "userspace-ttyS4",
        "base_patch_sha256": base_hash, "patch_sha256": hashlib.sha256(payload).hexdigest(),
        "auxiliary_gpio": "GPIO4_D2", "boot_on": True, "always_on": False,
        "runtime_supply_policy": "existing-usb-consumers",
        "comparison_repository": "photonicat/photonicat_openwrt",
        "comparison_commit": "119964435eb7bc6384eed8ecee7bd7104b6e8ee2"
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Validated MCU configuration layers; installed Photonicat 1 auxiliary boot supply patch")


if __name__ == "__main__":
    prepare(sys.argv[1])
