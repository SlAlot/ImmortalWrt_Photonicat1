#!/usr/bin/env python3
"""Apply narrow compatibility fixes to the checksum-pinned feed revisions."""
from pathlib import Path
import sys


def replace_once(path, old, new):
    text = path.read_text(encoding="utf-8")
    if old not in text and new in text:
        return
    if text.count(old) != 1:
        raise SystemExit(f"Unexpected feed recipe; review compatibility patch: {path}")
    path.write_text(text.replace(old, new), encoding="utf-8", newline="\n")


def patch_feeds(root):
    # The virtual weechat provider selects the default minimal variant while
    # also inheriting the full variant's conflict. Choose the real provider.
    replace_once(root / "feeds/luci/applications/luci-app-weechat/Makefile",
                 "+weechat ", "+weechat-minimal ")
    # Linux 6.12/OpenWrt calls this network module mhi-net, not mhi-wwan.
    kernel_modules = (root / "package/kernel/linux/modules/netdevices.mk").read_text(encoding="utf-8")
    if "define KernelPackage/mhi-net\n" not in kernel_modules:
        raise SystemExit("Review MHI driver compatibility for this kernel")
    replace_once(root / "feeds/qmodem/application/qmodem/Makefile",
                 "PCIe_DRIVER:kmod-mhi-wwan ", "PCIe_DRIVER:kmod-mhi-net ")
    print("Applied WeeChat provider and QModem MHI package-name compatibility fixes")


if __name__ == "__main__":
    patch_feeds(Path(sys.argv[1]))
