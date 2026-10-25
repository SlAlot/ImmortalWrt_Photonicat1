const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,
    '../package/luci-app-swrt-power/root/www/luci-static/resources/view/system/swrt-power.js'), 'utf8');
class Element {
    constructor(tag, attrs = {}, children = []) {
        this.tag = tag; this.attrs = attrs; this.children = [].concat(children || []);
        this.textContent = typeof children === 'string' ? children : '';
        this.value = attrs.value || ''; this.checked = false;
        this.disabled = Object.hasOwn(attrs, 'disabled'); this.handlers = {};
        if (attrs.click) this.handlers.click = attrs.click;
    }
    addEventListener(name, fn) { this.handlers[name] = fn; }
    fire(name) { if (!(name === 'click' && this.disabled)) return this.handlers[name]?.(); }
}
function walk(node) { return node instanceof Element ? [node, ...node.children.flatMap(walk)] : []; }
function harness(readonly = false) {
    const h = { calls: [], polls: [], modal: null, notices: [], root: null,
        data: { ok: true, revision: 'a'.repeat(64),
            battery: { percentage: 74, battery_mv: 3960, supply_mv: 5000, external_power: true, charging: null, temperature: 42 },
            car: { state: 0, timeout: 0, countdown: -1, armed: false }, events: [] } };
    const context = {
        view: { extend: value => value }, E: (tag, attrs, children) => new Element(tag, attrs, children),
        rpc: { declare: spec => (...args) => { h.calls.push([spec.method, args]); return Promise.resolve(h.data); } },
        L: { hasViewPermission: () => !readonly, resource: value => {
            assert.match(value, /^[a-zA-Z0-9_.%/,-]+$/, 'L.resource takes a path, not a path containing query parameters');
            return '/resources/' + value;
        } },
        ui: { addNotification: (...args) => h.notices.push(args),
            showModal: (title, children) => { h.modal = new Element('modal', { title }, children); },
            hideModal: () => { h.modal = null; } },
        poll: { add: fn => h.polls.push(fn) },
        document: { getElementById: id => walk(h.root).find(n => n.attrs.id === id) },
        console
    };
    h.view = vm.runInNewContext('(function(){' + source + '\n})()', context);
    h.root = h.view.render(h.data);
    h.button = text => walk(h.root).find(n => n.tag === 'button' && n.textContent === text);
    h.input = label => walk(h.root).find(n => n.attrs['aria-label'] === label);
    h.change = (label, value) => { const node = h.input(label); node.value = value; node.fire('input'); };
    return h;
}
(async () => {
    const h = harness();
    assert.deepEqual(walk(h.root).filter(n => n.tag === 'link').map(n => n.attrs.href), [
        '/resources/wlmb-server/panel.css?v=1.1.3', '/resources/swrt-ui.css?v=1.0.4', '/resources/swrt-power.css?v=1.0.5'
    ]);
    assert.equal(h.calls.length, 0, 'Opening the page never changes policy');
    assert.equal(h.button('保存电源策略').disabled, true, 'Save is enabled only after editing');
    assert.ok(walk(h.root).filter(n => n.tag === 'details').every(n => Object.hasOwn(n.attrs, 'open')),
        'Battery details are expanded by default');
    assert.equal(h.input('电源模式').value, 'manual');
    assert.ok(walk(h.root).some(n => n.textContent === '外部供电'));
    assert.ok(!walk(h.root).some(n => n.textContent === '充电中'));
    const voltage = harness();
    for (const [mv, expected] of [
        [4699, '输入电压低于 4.7V'], [4700, '输入电压未达官方建议的 4.9V'],
        [4899, '输入电压未达官方建议的 4.9V'], [4900, '电量为电压估算；外部供电不代表正在充电']
    ]) {
        voltage.data.battery.supply_mv = mv;
        await voltage.polls[0]();
        assert.ok(walk(voltage.root).some(n => n.textContent.startsWith(expected)), 'Correct input voltage advisory at ' + mv);
        assert.ok(!voltage.calls.some(call => call[0] === 'configure'), 'Voltage monitoring must not alter power policy');
    }
    voltage.data = { ok: false, message: '离线' };
    await voltage.polls[0]();
    assert.ok(walk(voltage.root).some(n => n.textContent === '暂无可用电源数据。'), 'Clear stale voltage advice');
    h.change('电源模式', 'daily');
    h.change('每日开机时间', '08:35');
    await h.polls[0]();
    assert.equal(h.input('每日开机时间').value, '08:35', 'Polling must preserve unblurred edits');
    h.data = { ...h.data, revision: 'b'.repeat(64) };
    await h.polls[0]();
    assert.equal(h.button('保存电源策略').disabled, true, 'Conflicting policy revision requires refresh');

    const read = harness(true);
    assert.equal(read.button('保存电源策略').disabled, true);
    const invalid = harness();
    invalid.data = { ok: false, message: '电源状态已过期' };
    await invalid.polls[0]();
    assert.equal(invalid.button('保存电源策略').disabled, true);
    assert.ok(walk(invalid.root).some(n => n.textContent === '当前：未确认'), 'Do not display stale policy as current');

    const malformed = harness();
    malformed.data.events = [null, { action: 0, enabled: 1 }];
    await malformed.polls[0]();
    assert.equal(malformed.input('电源模式').value, 'custom', 'Unrecognized saved plans must not break rendering');

    const save = harness();
    save.change('电源模式', 'ups');
    save.change('延时关机分钟', '5');
    save.button('保存电源策略').fire('click');
    const confirm = walk(save.modal).find(n => n.tag === 'button' && n.textContent === '确认保存');
    const ack = walk(save.modal).find(n => n.tag === 'input');
    assert.equal(confirm.disabled, true);
    confirm.fire('click');
    assert.equal(save.calls.length, 0);
    ack.checked = true; ack.fire('change'); confirm.fire('click');
    await new Promise(resolve => setImmediate(resolve));
    const call = save.calls.find(c => c[0] === 'configure');
    assert.equal(call[1][0], 'ups'); assert.equal(call[1][1], 5);
    assert.equal(call[1][4], 'a'.repeat(64)); assert.equal(call[1][5], 1);

    const manualCar = harness();
    manualCar.data.car = {state: 1, timeout: 300, countdown: 0, armed: false};
    await manualCar.polls[0]();
    assert.ok(walk(manualCar.root).some(n => n.textContent.includes('由充电器自动开机')),
        'Official manual boots must not promise an armed unplug countdown');

    const batteryOnly = harness();
    batteryOnly.data.battery.external_power = false;
    await batteryOnly.polls[0]();
    assert.ok(walk(batteryOnly.root).some(n => n.textContent === '电池供电'));
    batteryOnly.change('电源模式', 'ups');
    batteryOnly.button('保存电源策略').fire('click');
    assert.equal(batteryOnly.modal, null);
    assert.ok(!batteryOnly.calls.some(call => call[0] === 'configure'));
    assert.ok(!source.includes('参考') && !source.includes('PEIT98'));
    console.log('Power UI: read-only status, edit preservation, conflict detection and explicit confirmation passed');
})().catch(err => { console.error(err); process.exitCode = 1; });
