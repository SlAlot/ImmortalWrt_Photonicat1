#!/usr/bin/env python3
"""Check the final built kernel, not only package selections or seed configs."""
import hashlib
import json
from pathlib import Path
import sys


def check(root):
    root = Path(root)
    configs = sorted(root.glob("build_dir/target-*/linux-rockchip_armv8/linux-6.12*/.config"))
    if len(configs) != 1:
        raise ValueError("Expected one resolved Rockchip 6.12 kernel configuration, found " + str(len(configs)))
    kernel = configs[0]
    payload = kernel.read_bytes()
    values = dict(line.split("=", 1) for line in payload.decode("utf-8").splitlines()
                  if line.startswith("CONFIG_") and "=" in line)
    if values.get("CONFIG_PHOTONICAT_PM") in ("y", "m"):
        raise ValueError("Resolved kernel MCU owner conflicts with SWRT UART backend; refusing release")
    for symbol in ("CONFIG_SERIAL_8250", "CONFIG_SERIAL_8250_DW"):
        if values.get(symbol) != "y":
            raise ValueError("MCU UART must be built into the kernel: " + symbol)
    audit = root / "swrt-metadata"
    audit.mkdir(exist_ok=True)
    (audit / "kernel.config").write_bytes(payload)
    (audit / "kernel-power.json").write_text(json.dumps({
        "mcu_backend": "userspace-ttyS4", "kernel_mcu_owner": False,
        "kernel_config": kernel.relative_to(root).as_posix(),
        "kernel_config_sha256": hashlib.sha256(payload).hexdigest(),
        "uart_built_in": True,
    }, indent=2) + "\n", encoding="utf-8")
    print("Validated resolved kernel MCU ownership and built-in UART; saved kernel configuration")


if __name__ == "__main__":
    check(sys.argv[1])
