#!/usr/bin/env python3
"""Apply narrow compatibility fixes to the checksum-pinned feed revisions."""
from pathlib import Path
import sys


def replace_once(path, old, new):
    text = path.read_text(encoding="utf-8")
    if text.count(new) == 1 and old not in text.replace(new, "", 1):
        return
    if text.count(old) != 1 or new in text:
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
    patch_qmodem_runtime(root)
    print("Applied WeeChat provider and QModem MHI package-name compatibility fixes")


def patch_qmodem_runtime(root):
    base = root / "feeds/qmodem"
    settings = base / "luci/luci-app-qmodem-next/htdocs/luci-static/resources/view/qmodem/settings.js"
    for bus, default, title in (("usb", "1", "USB"), ("pcie", "0", "PCIe")):
        old = (f"\t\to = s.option(form.Flag, 'enable_{bus}_scan', _('Enable {title} Scan'));\n"
               f"\t\to.description = _('Once enabled, the {title} ports will be scanned on every boot.');\n"
               f"\t\to.default = '{default}';\n")
        replace_once(settings, old, old + "\t\to.rmempty = false;\n")
    vendor = base / "application/qmodem/files/usr/share/qmodem/vendor/fibocom.sh"
    old = '''            carrier=$(cmd_gtcurcar_query "$at_port" | awk -F'"' '/^\\+GTCURCAR:/ {print $2; exit}')'''
    replace_once(vendor, old, old + '\n            [ "$carrier" != "Generic" ] || carrier=""')
    init = base / "application/qmodem/files/etc/init.d/qmodem_init"
    old = '''    local delay=$(uci -q get qmodem.main.start_delay || echo 0)
    if [ "$delay" -gt 0 ]; then
        logger "Delay QModem Boot init scan for $delay S"
        ( sleep "$delay"; /usr/share/qmodem/modem_scan.sh scan >/dev/null 2>&1 ) &
    fi
    start'''
    replace_once(init, old, "    # Per-bus scan instances own the delay and respect scan switches.\n    start")
    for bus in ("usb", "pcie"):
        old = f'''    ( sleep 15; /usr/bin/modem_scanc scan {bus} >/dev/null 2>&1 ) &'''
        new = f'''    procd_open_instance "scan-{bus}"
    procd_set_param command /usr/share/qmodem/swrt-scan-once {bus}
    procd_set_param stdout 1
    procd_set_param stderr 1
    procd_close_instance'''
        replace_once(init, old, new)
    print("Applied QModem scan persistence, supervised boot scan and carrier fallback fixes")


if __name__ == "__main__":
    patch_feeds(Path(sys.argv[1]))
