#!/usr/bin/env python3
"""Select one MCU owner and preserve the existing battery indicator."""
from pathlib import Path
import re
import sys


def integrate(root):
    root = Path(root)
    device = root / "target/linux/rockchip/image/armv8.mk"
    text = device.read_text(encoding="utf-8")
    match = re.search(r"^define Device/ariaboard_photonicat\n.*?^endef", text, re.M | re.S)
    if not match:
        raise ValueError("Photonicat 1 device definition not found")
    section = match.group()
    if "swrt-pcat-manager" not in section:
        if section.count("pcat-mgr") != 1:
            raise ValueError("Unexpected Photonicat 1 MCU default")
        text = text[:match.start()] + section.replace("pcat-mgr", "swrt-pcat-manager") + text[match.end():]
        device.write_text(text, encoding="utf-8")
    rpc = root / "feeds/luci/modules/luci-mod-battstatus/root/usr/libexec/rpcd/luci.battstatus"
    text = rpc.read_text(encoding="utf-8")
    if "# SWRT PMU battery adapter" not in text:
        pattern = r"\t+ariaboard,photonicat\)\n.*?\t+;;"
        match = re.search(pattern, text, re.S)
        if not match or "Need pcat-mgr" not in match.group():
            raise ValueError("Unexpected battery RPC; review adapter")
        replacement = '''\t\t\t\t\tariaboard,photonicat)
                        # SWRT PMU battery adapter
                        status="$(/usr/libexec/swrt-power battery)"
                        valid="$(printf '%s' "$status" | jsonfilter -e '@.ok')"
                        if [ "$valid" = true ]; then
                            json_add_boolean valid 1
                            charging="$(printf '%s' "$status" | jsonfilter -e '@.charging')"
                            [ "$charging" = true ] && charging=1 || charging=0
                            json_add_boolean charging "$charging"
                            json_add_int percentage "$(printf '%s' "$status" | jsonfilter -e '@.percentage')"
                        else
                            json_add_boolean valid 0
                            json_add_string message '电源状态暂不可用'
                        fi
                        ; ;'''.replace("; ;", ";;")
        rpc.write_text(text[:match.start()] + replacement + text[match.end():], encoding="utf-8")


if __name__ == "__main__":
    integrate(sys.argv[1])
