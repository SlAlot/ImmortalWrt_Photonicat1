#!/usr/bin/env python3
"""Select one MCU owner and preserve the existing battery indicator."""
from pathlib import Path
import re
import sys


def patch_indicator(text):
    # Existing sessions cache the preload list; also import from the known module.
    if "require preload.swrt-menu" not in text and text.count("'require ui';") == 1:
        text = text.replace("'require ui';", "'require ui';\n'require preload.swrt-menu as swrtMenu';", 1)
    if "# SWRT power source label" not in text:
        anchor = "ui.showIndicator(info.name, info.status,"
        if text.count(anchor) != 1:
            raise ValueError("Unexpected battery indicator; review supply status label")
        text = text.replace(anchor, '''// # SWRT power source label
                if (info.valid === true && typeof info.external_power === 'boolean') {
                    info.status = (info.external_power ? '外部供电' : '电池供电') + ': ' + info.percentage + '%';
                }
                ''' + anchor, 1)
    if "# SWRT battery management link" in text:
        return text
    pattern = (r"ui\.showIndicator\(info\.name, info\.status, null, info\.state\);\s*"
               r"if \(typeof info\.color != 'undefined'\) \{.*?\n\s*\}")
    replacement = '''// # SWRT battery management link
                ui.showIndicator(info.name, info.status, function() {
                    window.location.href = L.url('admin/system/swrt-power');
                }, info.state);
                const element = document.querySelector('[data-indicator="' + info.name + '"]');
                if (element) {
                    element.style.backgroundColor = info.color === 'Red' ? '#b42318' : info.color === 'GoldenRod' ? '#8a5a00' : '';
                    element.style.color = info.color ? '#fff' : '';
                    element.setAttribute('role', 'link');
                    element.setAttribute('tabindex', '0');
                    element.setAttribute('title', '打开光影猫管理');
                    if (!element.dataset.swrtPowerLink) {
                        element.dataset.swrtPowerLink = '1';
                        element.addEventListener('keydown', function(event) {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                window.location.href = L.url('admin/system/swrt-power');
                            }
                        });
                    }
                }'''
    result, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise ValueError("Unexpected battery indicator; review power page link")
    return result


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
    indicator = root / "feeds/luci/modules/luci-mod-battstatus/htdocs/luci-static/resources/preload/battstatus.js"
    indicator.write_text(patch_indicator(indicator.read_text(encoding="utf-8")), encoding="utf-8")
    rpc = root / "feeds/luci/modules/luci-mod-battstatus/root/usr/libexec/rpcd/luci.battstatus"
    text = rpc.read_text(encoding="utf-8")
    if '# SWRT PMU battery adapter' not in text or 'json_add_boolean external_power "$external_power"' not in text:
        pattern = r"\t+ariaboard,photonicat\)\n.*?\t+;;"
        match = re.search(pattern, text, re.S)
        if not match or not any(marker in match.group() for marker in ("Need pcat-mgr", "# SWRT PMU battery adapter")):
            raise ValueError("Unexpected battery RPC; review adapter")
        replacement = '''\t\t\t\t\tariaboard,photonicat)
                        # SWRT PMU battery adapter
                        status="$(/usr/libexec/swrt-power battery)"
                        valid="$(printf '%s' "$status" | jsonfilter -e '@.ok')"
                        if [ "$valid" = true ]; then
                            json_add_boolean valid 1
                            external_power="$(printf '%s' "$status" | jsonfilter -e '@.external_power')"
                            [ "$external_power" = true ] && external_power=1 || external_power=0
                            json_add_boolean external_power "$external_power"
                            json_add_int percentage "$(printf '%s' "$status" | jsonfilter -e '@.percentage')"
                        else
                            json_add_boolean valid 0
                            json_add_string message '电源状态暂不可用'
                        fi
                        ; ;'''.replace("; ;", ";;")
        rpc.write_text(text[:match.start()] + replacement + text[match.end():], encoding="utf-8")


if __name__ == "__main__":
    integrate(sys.argv[1])
