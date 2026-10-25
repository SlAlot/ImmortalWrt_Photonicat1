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
    "PACKAGE_ubus-at-daemon", "PACKAGE_tom_modem",
    "PACKAGE_tom_modem_ENABLE_UBUS_DAEMON",
    "PACKAGE_qmodem_USE_TOM_CUSTOMIZED_QUECTEL_CM", "PACKAGE_quectel-CM-5G-M",
    "PACKAGE_qmodem_INCLUDE_generic-qmi-wwan",
    "PACKAGE_qmodem_GENERIC_MHI_PCIe_DRIVER",
    "PACKAGE_kmod-mhi-net", "PACKAGE_kmod-mhi-pci-generic",
    "PACKAGE_kmod-mhi-wwan-ctrl", "PACKAGE_kmod-mhi-wwan-mbim",
    "PACKAGE_qmodem-smsd", "PACKAGE_sms-forwarder-next", "PACKAGE_wlmb-server",
    "PACKAGE_luci-app-quickstart", "PACKAGE_quickstart", "PACKAGE_luci-app-store",
    "PACKAGE_ttyd", "PACKAGE_luci-app-ttyd", "PACKAGE_luci-i18n-ttyd-zh-cn",
    "PACKAGE_luci-app-diskman", "PACKAGE_luci-i18n-diskman-zh-cn",
    "PACKAGE_parted", "PACKAGE_blkid", "PACKAGE_smartmontools",
    "PACKAGE_btrfs-progs", "PACKAGE_kmod-fs-btrfs", "PACKAGE_lsblk",
    "PACKAGE_luci-app-swrt-upgrade", "PACKAGE_jq-full", "PACKAGE_flock", "PACKAGE_coreutils-sha256sum",
    "PACKAGE_coreutils-stat",
    "PACKAGE_curl", "PACKAGE_luci-app-package-manager",
    "PACKAGE_luci-compat", "PACKAGE_luci-lua-runtime", "PACKAGE_luci-lib-ipkg",
    "PACKAGE_tar", "PACKAGE_xz-utils", "PACKAGE_xz",
    "PACKAGE_docker", "PACKAGE_dockerd", "PACKAGE_luci-app-dockerman",
    "PACKAGE_docker-compose", "PACKAGE_luci-lib-docker", "PACKAGE_luci-lib-taskd",
    "PACKAGE_luci-lib-xterm", "PACKAGE_taskd",
    "PACKAGE_containerd", "PACKAGE_runc", "PACKAGE_kmod-veth", "PACKAGE_mount-utils",
    "PACKAGE_swrt-pcat-manager", "PACKAGE_luci-app-swrt-power", "PACKAGE_glib2", "PACKAGE_jsonfilter",
    "PACKAGE_u-boot-photonicat-rk3568",
    "PACKAGE_kmod-ath10k-sdio", "PACKAGE_kmod-ath11k-pci",
    "PACKAGE_kmod-mt7921e", "PACKAGE_kmod-mt7921u", "PACKAGE_kmod-mt7921s",
    "PACKAGE_kmod-mt7921-firmware", "PACKAGE_kmod-mt7922-firmware",
    "PACKAGE_kmod-mt792x-common", "PACKAGE_kmod-mt792x-usb",
    "PACKAGE_iptables-nft", "PACKAGE_ip6tables-nft", "PACKAGE_ipset", "PACKAGE_ip-full",
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
    "PACKAGE_pcat-mgr", "PACKAGE_pcat-manager", "PACKAGE_pcat-manager-v1", "PACKAGE_kmod-photonicat-pm",
    "FEED_video", "FEED_istore", "FEED_nas", "FEED_nas_luci", "FEED_qmodem",
    "PACKAGE_luci-app-modemband", "PACKAGE_modemband",
    "PACKAGE_luci-app-sms-tool-js", "PACKAGE_luci-app-qmodem",
    "PACKAGE_luci-app-qmodem-mwan",
    "PACKAGE_luci-app-qmodem-sms", "PACKAGE_luci-app-qmodem-ttl",
    "PACKAGE_luci-app-qmodem-hc",
    "PACKAGE_qmodem_INCLUDE_vendor-qmi-wwan",
    "PACKAGE_qmodem_VENDOR_MHI_PCIe_DRIVER",
    "PACKAGE_qmodem_NSS_MHI_PCIe_DRIVER", "PACKAGE_qmodem_INCLUDE_nss-qmi-wwan",
    "PACKAGE_qmodem_USING_QWRT_QUECTEL_CM_5G", "PACKAGE_qmodem_USING_NORMAL_QUECTEL_CM",
    "PACKAGE_qmodem-uplink-manager", "PACKAGE_luci-app-qmodem-uplink",
    "PACKAGE_iptables-zz-legacy", "PACKAGE_ip6tables-zz-legacy",
]
errors = [f"Missing {key}" for key in required if values.get("CONFIG_" + key) != "y"]
errors += [f"Unexpected {key}" for key in forbidden
           if values.get("CONFIG_" + key) in ("y", "m")]
if errors:
    raise SystemExit("\n".join(errors))
print(f"Validated {len(required)} required symbols and {len(forbidden)} exclusions")
