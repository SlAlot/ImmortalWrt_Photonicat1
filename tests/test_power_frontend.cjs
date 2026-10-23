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
            battery: { percentage: 74, battery_mv: 3960, supply_mv: 5000, charging: true, temperature: 42 },
            car: { state: 0, timeout: 0, countdown: -1, armed: false }, events: [] } };
    const context = {
        view: { extend: value => value }, E: (tag, attrs, children) => new Element(tag, attrs, children),
        rpc: { declare: spec => (...args) => { h.calls.push([spec.method, args]); return Promise.resolve(h.data); } },
        L: { hasViewPermission: () => !readonly, resource: value => '/resources/' + value },
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
    assert.equal(h.calls.length, 0, 'Opening the page never changes policy');
    assert.equal(h.input('电源模式').value, 'manual');
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

    const batteryOnly = harness();
    batteryOnly.data.battery.charging = false;
    batteryOnly.change('电源模式', 'ups');
    batteryOnly.button('保存电源策略').fire('click');
    assert.equal(batteryOnly.modal, null);
    assert.equal(batteryOnly.calls.length, 0);
    assert.ok(!source.includes('参考') && !source.includes('PEIT98'));
    console.log('Power UI: read-only status, edit preservation, conflict detection and explicit confirmation passed');
})().catch(err => { console.error(err); process.exitCode = 1; });
