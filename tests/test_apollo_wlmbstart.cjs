/* Exercise the actual LuCI modules against read-only Rust-contract fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const localRequire = createRequire(path.resolve(__dirname, '../package/luci-theme-apollo/tests/package.json'));
const {JSDOM} = localRequire('jsdom');
const root = path.resolve(__dirname, '..');
const theme = path.join(root, 'package/luci-theme-apollo/root');
const home = path.join(root, 'package/luci-app-wlmbstart/root');
const dom = new JSDOM('<!doctype html><html lang="zh-CN" data-theme="auto"><head></head><body class="np-theme"><header class="npt-topbar"><button id="npt-menu-toggle"></button><a class="npt-brand"><span class="npt-brand-mark">N</span><span>网络面板<small>S-Photonicat1</small></span></a><span id="npt-page-title"></span><div class="npt-topbar-actions"><a id="npt-battery"></a><button id="npt-appearance"></button></div></header><button id="npt-backdrop"></button><nav id="npt-navigation" class="npt-sidebar"><div class="npt-sidebar-heading">设备管理<button id="npt-nav-close">×</button></div><ul id="npt-menu"></ul></nav><main id="maincontent" class="container"><div id="tabmenu"></div></main><footer class="npt-footer">SWRT · SlAlot</footer></body></html>', {url:'http://router.test/cgi-bin/luci/admin/wlmbstart'});
const {window} = dom, {document} = window;
const baseclass = {extend:x=>x};
const callbacks = [];
const poll = {add:fn=>callbacks.push(fn)};
let snapshot, failing = false, rpcCalls = 0;
const rpc = {declare:spec=>async()=>{
    if(spec.object==='network-panel') { rpcCalls++; if(failing)throw new Error('offline');return {ok:true,data:snapshot}; }
    return {interface:[{interface:'lan',up:true,proto:'static','ipv4-address':[{address:'192.168.17.1'}]},{interface:'wan',up:false,proto:'dhcp'}]};
}};
function node(title,children={}) {return {title,children};}
const tree = {children:{admin:node('管理',{
    wlmbstart:node('首页'), status:node('状态',{overview:node('总览')}),
    system:node('系统',{'admin':node('管理权'),'swrt-power':node('光影猫管理'),'swrt-upgrade':node('SWRT 在线更新'),ttyd:node('终端')}),
    network:node('网络',{interfaces:node('接口'),wireless:node('无线网络')}),
    services:node('服务',{'wlmb-server':node('网络面板')}),docker:node('Docker',{containers:node('容器')}),store:node('iStore'),logout:node('退出')
})}};
const ui = {menu:{load:async()=>tree,getChildren:n=>Object.entries(n.children||{}).map(([name,child])=>({...child,name}))}};
const L = {env:{dispatchpath:['admin','wlmbstart'],requestpath:['admin','wlmbstart']},url:(...parts)=>'/cgi-bin/luci/'+parts.join('/'),resource:p=>'/luci-static/resources/'+p};
function E(tag,attrs={},children) {
    const el=document.createElement(tag);
    for(const [key,value] of Object.entries(attrs)) if(value!=null) {if(key==='hidden')el.hidden=!!value;else el.setAttribute(key,String(value));}
    for(const child of [children].flat(Infinity)) if(child!=null)el.appendChild(child.nodeType?child:document.createTextNode(String(child)));
    return el;
}
let narrow = false;
window.matchMedia = q=>({matches:q.includes('780')&&narrow,addEventListener(){},removeEventListener(){}});
const context = vm.createContext({window,document,localStorage:window.localStorage,baseclass,rpc,ui,poll,L,E,_:x=>x,view:{extend:x=>x},Date,Promise,console});
function moduleAt(file) {return vm.runInContext('(function(){'+fs.readFileSync(file,'utf8')+'\n})()',context);}
vm.runInContext(fs.readFileSync(path.join(theme,'www/luci-static/resources/apollo/icons.js'),'utf8'),context);
const panel = moduleAt(path.join(theme,'www/luci-static/resources/apollo/ui.js'));
context.panel = panel;
const view = moduleAt(path.join(home,'www/luci-static/resources/view/wlmbstart/home.js'));
const menu = moduleAt(path.join(theme,'www/luci-static/resources/menu-apollo.js'));
function fixture(percent=76) {
    const now=Date.now();
    return {selectedModem:'usb-modem',modems:[{id:'usb-modem',model:'5G 模组'}],
        radio:{stale:false,serving:[{rat:'NR',rsrp:-85,sinr:22,stale:false,observedAtMs:now}]},
        system:{stale:false,observedAtMs:now,board:{hostname:'S-Photonicat1'},cpuUsage:8.4,memory:{usedPercent:29.5,usedBytes:1267015352,totalBytes:4294967296},temperature:{celsius:47.2},uptimeSeconds:96600,
            network:{interface:'usb0',rates:{downloadBytesPerSecond:23456789,uploadBytesPerSecond:1456789}},
            battery:{available:true,stale:false,percent,charging:null,source:'provider',observedAtMs:now}}};
}
async function refresh() {window.__wlmbReadCache.at=0;await Promise.all(callbacks.map(fn=>fn()));}
(async()=>{
    snapshot=fixture();
    const content=view.render(await view.load());document.getElementById('maincontent').appendChild(content);
    menu.render(tree);await refresh();
    assert.match(content.textContent,/76%/);assert.match(content.textContent,/实际充电状态未知/);assert.match(content.textContent,/-85.0 dBm/);
    assert.equal(document.querySelector('#npt-battery').getAttribute('aria-label'),'电量 76%，打开光影猫管理');
    assert.equal(document.querySelectorAll('.nph-shortcut').length,7);
    assert.equal(document.querySelector('.nph-chart polyline').getAttribute('points').includes('NaN'),false);
    assert.equal(rpcCalls,1,'Theme and home must share the same in-flight read');
    const group=document.querySelector('[aria-controls="npt-group-system"]');group.click();assert.equal(group.getAttribute('aria-expanded'),'true');assert.equal(document.getElementById('npt-group-system').hidden,false);group.click();assert.equal(document.getElementById('npt-group-system').hidden,true);
    document.getElementById('npt-appearance').click();assert.equal(document.documentElement.dataset.theme,'light');
    document.getElementById('npt-appearance').click();assert.equal(document.documentElement.dataset.theme,'dark');
    document.getElementById('npt-appearance').click();assert.equal(document.documentElement.dataset.theme,'auto');
    snapshot=fixture(0);await refresh();assert.match(content.textContent,/0%/);assert(document.getElementById('npt-battery').classList.contains('is-low'));
    snapshot=fixture();snapshot.system.observedAtMs-=20000;await refresh();assert.equal(document.getElementById('npt-battery').textContent,'—');assert.match(content.textContent,/数据暂不可用/);assert.equal(content.querySelectorAll('.nph-chart polyline').length,0);
    snapshot=fixture();snapshot.system.battery.observedAtMs-=61000;await refresh();assert.equal(document.getElementById('npt-battery').textContent,'—');
    snapshot=fixture();snapshot.system.board.hostname='<img src=x onerror=alert(1)>';await refresh();assert.equal(content.querySelectorAll('img').length,0,'Untrusted board text must remain text');
    failing=true;await refresh();assert.equal(document.getElementById('npt-battery').textContent,'—');assert.match(content.textContent,/暂不可用/);failing=false;
    snapshot=fixture();await refresh();
    // Keep a faithful static DOM preview for visual review, separate from the firmware.
    const preview=process.env.NP_PREVIEW;
    if(preview){
        for(const file of [path.join(theme,'www/luci-static/apollo/compat.css'),path.join(theme,'www/luci-static/apollo/theme.css'),path.join(root,'../sources/wlmb-server/frontend/www/luci-static/resources/wlmb-server/panel.css'),path.join(home,'www/luci-static/resources/wlmbstart/home.css')]){
            const style=document.createElement('style');style.textContent=fs.readFileSync(file,'utf8');document.head.appendChild(style);
        }
        document.querySelectorAll('link').forEach(el=>el.remove());
        document.title='Apollo × wlmbstart · 布局预览（示例数据）';
        fs.writeFileSync(preview,dom.serialize());
    }
    console.log('Apollo/wlmbstart: read-only API, cache sharing, stale/zero battery, honest failures, semantic navigation, appearance and escaped rendering passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
