#!/usr/bin/env python3
"""Adapt only the pinned QuickStart frontend; fail if upstream changes context."""
import importlib.util
import hashlib
from pathlib import Path
import sys

spec = importlib.util.spec_from_file_location("feed_patches", Path(__file__).with_name("patch-feeds.py"))
patches = importlib.util.module_from_spec(spec)
spec.loader.exec_module(patches)

REPO = Path(__file__).resolve().parents[1]
UI_REVISION = "swrt-" + hashlib.sha256(b"".join(path.read_bytes() for path in (
    Path(__file__), REPO / "files/www/luci-static/swrt/quickstart.js",
    REPO / "files/www/luci-static/swrt/quickstart.css", REPO / "sources.lock.json",
))).hexdigest()[:12]


def patch_quickstart(root):
    base = root / "feeds/nas_luci/luci/luci-app-quickstart"
    js = base / "htdocs/luci-static/quickstart/index.js"
    replace = patches.replace_once
    # LuCI caches the routes across requests. Checking pgrep here can freeze a
    # temporary early-boot backend outage into a permanent homepage redirect.
    replace(base / "luasrc/controller/quickstart.lua",
            '    if luci.sys.call("pgrep quickstart >/dev/null") == 0 then',
            '    if nixio.fs.access("/usr/sbin/quickstart") then')
    replace(js, 'var go=Object.defineProperty,',
            f'import {{swrtNetworkStatus}} from "/luci-static/swrt/quickstart.js?v={UI_REVISION}";\nvar go=Object.defineProperty,')
    replace(js, 'Status:{GET(){return W("/u/network/status/",{method:"GET"})}}',
            'Status:{GET(){return W("/u/network/status/",{method:"GET"}).then(swrtNetworkStatus)}}')
    # The stock source picker only knows OpenWrt mirrors. Use the actual system editor.
    replace(js, 'Qa=()=>{const o=document.createElement("div");',
            'Qa=()=>{location.href="/cgi-bin/luci/admin/system/package-manager";return;const o=document.createElement("div");')
    replace(js, 'appStore:{component:u4,props:{color:"#ffffff"}}',
            'swrtPanel:{component:I({setup(){return()=>t("span",{class:"swrt-panel-logo",role:"img","aria-label":"网络面板"})}}),props:{}},appStore:{component:u4,props:{color:"#ffffff"}}')
    old = 'color:"orange",alink:"/cgi-bin/luci/admin/store/pages/store"}'
    replace(js, old, old + ',{icon:"swrtPanel",title:"网络面板",subtitle:"信号、模组与网络状态",status:"",color:"swrtpanel",alink:"/cgi-bin/luci/admin/services/wlmb-server"}')
    # The homepage terminal button must follow the same entry as the system menu.
    old = 'window.open(`${(B=(z=window.quickstart_configs)==null?void 0:z.ttyd)!=null&&B.ssl?"https":"http"}://${window.location.hostname}:${((M=(H=window.quickstart_configs)==null?void 0:H.ttyd)==null?void 0:M.port)||7681}/`,"_blank")'
    replace(js, old, 'window.open("/cgi-bin/luci/admin/system/ttyd/ttyd","_blank","noopener")')
    template = base / "luasrc/view/quickstart/main.htm"
    replace(template, 'src="/luci-static/quickstart/index.js<%# ?v=PKG_VERSION %>"',
            f'src="/luci-static/quickstart/index.js?v={UI_REVISION}"')
    replace(template, '      window.token =',
            '      window.swrt_theme_mode = <%=jsonc.stringify(uci:get_first("argon", "global", "mode") or "normal")%>;\n      window.token =')
    old = '<%+footer%>'
    replace(template, old, f'<link rel="stylesheet" href="/luci-static/swrt/quickstart.css?v={UI_REVISION}">\n' + old)
    print("Applied SWRT QuickStart APK probe, source editor and network panel card")


if __name__ == "__main__":
    patch_quickstart(Path(sys.argv[1]))
