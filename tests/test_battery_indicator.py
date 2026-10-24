import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("power_integration", ROOT / "scripts/patch-power-integration.py")
integration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(integration)

# Minimal feed context; unrelated upstream rendering remains outside the patch.
CONTEXT = """ui.showIndicator(info.name, info.status, null, info.state);
if (typeof info.color != 'undefined') {
    info.element.innerHTML = 'old color markup';
}
"""


class BatteryIndicatorTests(unittest.TestCase):
    def test_patch_is_idempotent(self):
        patched = integration.patch_indicator(CONTEXT)
        self.assertEqual(integration.patch_indicator(patched), patched)

    def test_changed_feed_fails_explicitly(self):
        with self.assertRaises(ValueError):
            integration.patch_indicator("unexpected indicator template")

    def test_existing_adapter_migrates_without_changing_other_devices(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            device = root / "target/linux/rockchip/image/armv8.mk"
            rpc = root / "feeds/luci/modules/luci-mod-battstatus/root/usr/libexec/rpcd/luci.battstatus"
            indicator = root / "feeds/luci/modules/luci-mod-battstatus/htdocs/luci-static/resources/preload/battstatus.js"
            old = '\tariaboard,photonicat)\n\t\t# SWRT PMU battery adapter\n\t\tjson_add_boolean charging "$charging"\n\t\t;;\n'
            other = '\tother,device)\n\t\tjson_add_boolean charging 1\n\t\t;;\n'
            for path, content in [(device, "define Device/ariaboard_photonicat\n  DEVICE_PACKAGES := swrt-pcat-manager\nendef\n"),
                                  (rpc, old + other), (indicator, CONTEXT)]:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding="utf-8")
            integration.integrate(root)
            first = rpc.read_text(encoding="utf-8")
            self.assertIn('json_add_boolean external_power "$external_power"', first)
            self.assertNotIn('json_add_boolean charging "$charging"', first)
            self.assertIn(other, first)
            integration.integrate(root)
            self.assertEqual(rpc.read_text(encoding="utf-8"), first)

    def test_low_battery_refresh_and_mouse_keyboard_links(self):
        patched = integration.patch_indicator(CONTEXT)
        script = """
const assert = require('node:assert/strict');
const vm = require('node:vm');
let click, keydown, registrations = 0;
const element = { style: {}, dataset: {}, setAttribute() {},
    addEventListener(name, fn) { assert.equal(name, 'keydown'); keydown=fn; registrations++; } };
const context = { info: {name:'battery-Ariaboard-Photonicat',status:'充电中: 12%',state:'active',color:'Red'},
    window: {location:{href:''}}, L:{url:p=>'/cgi-bin/luci/'+p},
    document:{querySelector:selector=>{assert.equal(selector,'[data-indicator="battery-Ariaboard-Photonicat"]');return element;}},
    ui:{showIndicator:(id,label,handler)=>{assert.equal(label,context.info.status);click=handler;}} };
vm.createContext(context);
const source = '{' + PATCHED + '}';
vm.runInContext(source,context);
assert.equal(element.style.backgroundColor,'#b42318');
click(); assert.equal(context.window.location.href,'/cgi-bin/luci/admin/system/swrt-power');
context.window.location.href='';
keydown({key:'Enter',preventDefault(){}});
assert.equal(context.window.location.href,'/cgi-bin/luci/admin/system/swrt-power');
context.info.color=undefined;context.info.status='充电中: 42%';
vm.runInContext(source,context);
assert.equal(element.style.backgroundColor,'');assert.equal(element.style.color,'');
assert.equal(registrations,1,'Polling must not duplicate keyboard handlers');
context.info.valid=true;context.info.external_power=true;context.info.percentage=42;
vm.runInContext(source,context);
assert.equal(context.info.status,'外部供电: 42%');
context.info.external_power=false;
vm.runInContext(source,context);
assert.equal(context.info.status,'电池供电: 42%');
context.info.valid=false;context.info.status='电源状态暂不可用';
vm.runInContext(source,context);
assert.equal(context.info.status,'电源状态暂不可用','Do not overwrite an invalid report with a supply label');
""".replace("PATCHED", json.dumps(patched))
        result = subprocess.run(["node", "-e", script], capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(result.returncode, 0, result.stderr)
