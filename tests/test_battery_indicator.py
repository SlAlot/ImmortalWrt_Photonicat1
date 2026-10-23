import importlib.util
import json
from pathlib import Path
import subprocess
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
""".replace("PATCHED", json.dumps(patched))
        result = subprocess.run(["node", "-e", script], capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(result.returncode, 0, result.stderr)
