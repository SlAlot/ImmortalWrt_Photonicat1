import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
globalThis.window = {swrt_theme_mode: 'dark'};
globalThis.document = {documentElement: {dataset: {}}};
const source = await readFile(new URL('../files/www/luci-static/swrt/quickstart.js', import.meta.url), 'utf8');
const {swrtNetworkStatus} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
assert.equal(document.documentElement.dataset.swrtTheme, 'dark');
let calls = 0;
globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, '/cgi-bin/luci/admin/swrt/apk-status');
    assert.equal(options.credentials, 'same-origin');
    return {ok: true, json: async () => ({ok: true})};
};
const response = value => ({data: {result: {networkInfo: value, ipv4addr: '192.0.2.1'}}});
for (const value of ['netFailed', 'dnsFailed', 'netSuccess', 'checking']) {
    const result = await swrtNetworkStatus(response(value));
    assert.equal(result.data.result.networkInfo, value);
}
assert.equal(calls, 0);
let result = await swrtNetworkStatus(response('softSourceFailed'));
assert.equal(result.data.result.networkInfo, 'netSuccess');
assert.equal(result.data.result.ipv4addr, '192.0.2.1');
for (const fetcher of [
    async () => ({ok: true, json: async () => ({ok: false})}),
    async () => ({ok: false, json: async () => ({ok: true})}),
    async () => {throw new Error('timeout');}
]) {
    globalThis.fetch = fetcher;
    result = await swrtNetworkStatus(response('softSourceFailed'));
    assert.equal(result.data.result.networkInfo, 'softSourceFailed');
}
