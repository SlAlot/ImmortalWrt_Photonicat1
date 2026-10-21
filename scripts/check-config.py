#!/usr/bin/env python3
"""Fail when Kconfig silently drops a requested integration or hardware driver."""
import pathlib
import sys

config = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
values = dict(line.split("=", 1) for line in config.splitlines()
              if line.startswith("CONFIG_") and "=" in line)
required = [
    "TARGET_rockchip_armv8_DEVICE_ariaboard_photonicat",
    "PACKAGE_luci-app-qmodem-next", "PACKAGE_qmodem", "PACKAGE_modem_scan",
    "PACKAGE_ubus-at-daemon", "PACKAGE_wlmb-server",
    "PACKAGE_luci-app-quickstart", "PACKAGE_quickstart", "PACKAGE_luci-app-store",
    "PACKAGE_luci-compat", "PACKAGE_luci-lua-runtime", "PACKAGE_luci-lib-ipkg",
    "PACKAGE_docker", "PACKAGE_dockerd", "PACKAGE_luci-app-dockerman",
    "PACKAGE_pcat-mgr", "PACKAGE_u-boot-photonicat-rk3568",
    "PACKAGE_kmod-ath10k-sdio", "PACKAGE_kmod-ath11k-pci",
    "PACKAGE_kmod-usb-serial-option", "PACKAGE_kmod-usb-serial-qualcomm",
    "PACKAGE_kmod-usb-acm", "PACKAGE_kmod-usb-wdm",
    "PACKAGE_kmod-usb-net-cdc-ether", "PACKAGE_kmod-usb-net-cdc-mbim",
    "PACKAGE_kmod-usb-net-cdc-ncm", "PACKAGE_kmod-usb-net-rndis",
    "PACKAGE_kmod-usb-net-qmi-wwan", "PACKAGE_kmod-usb-storage-uas",
    "PACKAGE_luci-app-passwall", "PACKAGE_luci-app-openclash",
    "PACKAGE_luci-app-mwan3", "PACKAGE_luci-app-smartdns",
    "PACKAGE_luci-app-zerotier", "PACKAGE_luci-mod-battstatus",
    "TARGET_ROOTFS_EXT4FS", "TARGET_ROOTFS_SQUASHFS",
]
forbidden = [
    "PACKAGE_luci-app-modemband", "PACKAGE_modemband",
    "PACKAGE_luci-app-sms-tool-js", "PACKAGE_luci-app-qmodem",
    "PACKAGE_luci-app-qmodem-mwan",
    "PACKAGE_qmodem_INCLUDE_vendor-qmi-wwan",
    "PACKAGE_qmodem_VENDOR_MHI_PCIe_DRIVER",
]
errors = [f"Missing {key}" for key in required if values.get("CONFIG_" + key) != "y"]
errors += [f"Unexpected {key}" for key in forbidden
           if values.get("CONFIG_" + key) in ("y", "m")]
if errors:
    raise SystemExit("\n".join(errors))
print(f"Validated {len(required)} required symbols and {len(forbidden)} exclusions")
