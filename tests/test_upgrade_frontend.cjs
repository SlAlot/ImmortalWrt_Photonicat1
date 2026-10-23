const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,
    '../package/luci-app-swrt-upgrade/root/www/luci-static/resources/view/system/swrt-upgrade.js'), 'utf8');

class Element {
    constructor(tag, attrs = {}, children = []) {
        this.tag = tag;
        this.attrs = attrs;
        this.children = [].concat(children || []);
        this.textContent = typeof children === 'string' ? children : '';
        this.disabled = Object.hasOwn(attrs, 'disabled');
        this.checked = false;
        this.dataset = {};
        this.handlers = {};
        if (attrs.click) this.handlers.click = attrs.click;
    }
    addEventListener(event, fn) { this.handlers[event] = fn; }
    appendChild(child) { this.children.push(child); }
    remove() {}
    submit() {}
    fire(event) { if (!(event === 'click' && this.disabled)) return this.handlers[event]?.(); }
}
function walk(node) {
    if (!(node instanceof Element)) return [];
    return [node, ...node.children.flatMap(walk)];
}
function harness(phase = 'available', readonly = false) {
    const state = { ok: true, eligible: true, current: '1.9', filesystem: 'squashfs',
        state: { phase, message: '测试状态' }, downloaded_bytes: 0,
        release: { version: '2.0', name: 'immortalwrt-photonicat-1-squashfs-sysupgrade-2.0.img.gz',
            size: 104857600, sha256: 'a'.repeat(64), notes: '<script>never HTML</script>' } };
    const h = { state, calls: [], modal: null, polls: [], notices: [], root: null };
    const context = {
        view: { extend: obj => obj },
        rpc: { declare: spec => (...args) => {
            h.calls.push([spec.method, args]);
            if (spec.method === 'status') return h.statusOffline ? Promise.reject(new Error('network offline')) : Promise.resolve(h.state);
            if (spec.method === 'check' && h.error) return Promise.resolve({ ok: false, message: h.error });
            if (spec.method === 'download') h.state.state.phase = 'downloading';
            if (spec.method === 'install') h.state.state.phase = 'preparing';
            return Promise.resolve({ ok: true });
        }, getSessionID: () => 'fixture-session' },
        E: (tag, attrs, children) => new Element(tag, attrs, children),
        L: { hasViewPermission: () => !readonly, resource: s => '/resources/' + s,
            url: s => '/cgi-bin/luci/' + s, env: { cgi_base: '/cgi-bin' } },
        ui: { addNotification: (...args) => h.notices.push(args),
            showModal: (title, children) => { h.modal = new Element('modal', { title }, children); },
            hideModal: () => { h.modal = null; }, awaitReconnect: () => {} },
        poll: { add: fn => h.polls.push(fn) },
        document: { getElementById: id => walk(h.root).find(n => n.attrs.id === id) },
        window: { location: { host: '192.168.17.1' } }, console
    };
    h.view = vm.runInNewContext('(function(){' + source + '\n})()', context);
    h.root = h.view.render(h.state);
    h.button = text => walk(h.root).find(n => n.tag === 'button' && n.textContent === text);
    h.keep = walk(h.root).find(n => n.tag === 'input' && n.attrs.type === 'checkbox');
    return h;
}
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };

(async () => {
    const available = harness();
    assert.equal(available.calls.length, 0, 'Rendering must not download or flash');
    assert.equal(available.keep.checked, false, 'Fresh install is the default');
    assert.equal(available.button('确认升级').disabled, true);
    available.button('下载并校验').fire('click');
    await flush();
    assert.equal(available.calls.filter(c => c[0] === 'download').length, 1);
    assert.equal(available.calls.filter(c => c[0] === 'install').length, 0);
    assert.equal(available.button('确认升级').disabled, true);

    const ready = harness('ready');
    ready.button('确认升级').fire('click');
    const confirm = walk(ready.modal).find(n => n.tag === 'button' && n.textContent === '开始刷写并重启');
    assert.equal(confirm.disabled, true, 'Confirmation requires backup acknowledgement');
    confirm.fire('click');
    assert.equal(ready.calls.length, 0);
    const acknowledgement = walk(ready.modal).find(n => n.tag === 'input');
    acknowledgement.checked = true;
    acknowledgement.fire('change');
    confirm.fire('click');
    await flush();
    const install = ready.calls.find(c => c[0] === 'install');
    assert.equal(install[1][0], 0);
    assert.equal(install[1][1], 'a'.repeat(64));

    const failed = harness('ready');
    failed.state = { ...failed.state, state: { phase: 'failed', message: 'SHA256 校验失败' } };
    await failed.polls[0]();
    assert.equal(failed.button('确认升级').disabled, true, 'A failed task must clear stale ready state');
    const stale = harness('current');
    assert.equal(stale.button('下载并校验').disabled, true);
    assert.equal(stale.button('确认升级').disabled, true);
    const offline = harness('ready');
    offline.statusOffline = true;
    await offline.polls[0]();
    assert.equal(offline.button('确认升级').disabled, true, 'An unavailable status must disable stale flash action');

    const restarting = harness('installing');
    restarting.statusOffline = true;
    await restarting.polls[0]();
    await restarting.polls[0]();
    assert.equal(restarting.modal.attrs.title, '等待设备重新连接');

    const read = harness('ready', true);
    for (const text of ['检查更新', '下载并校验', '确认升级', '下载配置备份'])
        assert.equal(read.button(text).disabled, true);

    const error = harness();
    error.error = 'GitHub API 访问受限';
    error.button('检查更新').fire('click');
    await flush();
    assert.equal(error.notices[0][1].textContent, 'GitHub API 访问受限');
    assert.ok(walk(error.root).some(n => n.tag === 'pre' && n.textContent === '<script>never HTML</script>'),
        'Release notes must remain text, never HTML');
    console.log('Online upgrade UI: download/flash separation, confirmation, stale state and read-only access passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
