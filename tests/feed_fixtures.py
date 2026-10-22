"""Small upstream contexts used by feed patch and pipeline regressions."""


def write_qmodem_runtime(root):
    base = root / "feeds/qmodem"
    settings = ""
    for bus, title, default in (("usb", "USB", "1"), ("pcie", "PCIe", "0")):
        settings += (f"\t\to = s.option(form.Flag, 'enable_{bus}_scan', _('Enable {title} Scan'));\n"
                     f"\t\to.description = _('Once enabled, the {title} ports will be scanned on every boot.');\n"
                     f"\t\to.default = '{default}';\n")
    files = {
        "luci/luci-app-qmodem-next/htdocs/luci-static/resources/view/qmodem/settings.js": settings,
        "application/qmodem/files/usr/share/qmodem/vendor/fibocom.sh": '''fibocom_get_carrier()
{
    local carrier
    case "$platform" in
        "mediatek")
            carrier=$(cmd_gtcurcar_query "$at_port" | awk -F'"' '/^\\+GTCURCAR:/ {print $2; exit}')
            ;;
    esac
    [ -n "$carrier" ] || carrier=$(cmd_cops_query "$at_port" | grep "+COPS" | awk -F'"' '{print $2}')
    echo "$carrier"
}
''',
        "application/qmodem/files/etc/init.d/qmodem_init": '''boot() {
    local delay=$(uci -q get qmodem.main.start_delay || echo 0)
    if [ "$delay" -gt 0 ]; then
        logger "Delay QModem Boot init scan for $delay S"
        ( sleep "$delay"; /usr/share/qmodem/modem_scan.sh scan >/dev/null 2>&1 ) &
    fi
    start
}
_scan_usb()
{
    ( sleep 15; /usr/bin/modem_scanc scan usb >/dev/null 2>&1 ) &
}
_scan_pcie()
{
    ( sleep 15; /usr/bin/modem_scanc scan pcie >/dev/null 2>&1 ) &
}
'''
    }
    for name, content in files.items():
        path = base / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
