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
const dom = new JSDOM('<!doctype html><html lang="zh-CN" data-theme="auto"><head></head><body class="np-theme"><header class="npt-topbar"><button id="npt-menu-toggle"></button><a class="npt-brand"><span class="npt-brand-mark">N</span><span>网络面板<small>S-Photonicat1</small></span></a><span id="npt-page-title"></span><div class="npt-topbar-actions"><a id="npt-battery"></a><button id="npt-appearance"></button></div></header><button id="npt-backdrop"></button><nav id="npt-navigation" class="npt-sidebar"><div class="npt-sidebar-heading">设备管理<button id="npt-nav-close">×</button></div><ul id="npt-menu"></ul></nav><main id="maincontent" class="container"><div id="tabmenu"></div></main><footer class="npt-footer">SWRT · SlAlot</footer></body></html>', {url:'http://router.test/cgi-bin/luci/admin/wlmbstart',pretendToBeVisual:true});
const {window} = dom, {document} = window;
const baseclass = {extend:x=>x};
const callbacks = [];
const poll = {add:fn=>callbacks.push(fn)};
let snapshot, failing = false, rpcCalls = 0;
const rpc = {declare:spec=>async()=>{
    if(spec.object==='network-panel') { rpcCalls++; if(failing)throw new Error('offline');return {ok:true,data:snapshot}; }
    if(spec.object==='wlmbstart') return {devices:['usb0'],time:Math.floor(Date.now()/1000)};
    return {interface:[{interface:'6_1',up:true,proto:'dhcp',l3_device:'usb0','ipv4-address':[{address:'192.168.100.2'}]},{interface:'lan',up:true,proto:'static','ipv4-address':[{address:'192.168.17.1'}]},{interface:'wan',up:false,proto:'dhcp'}]};
}};
function node(title,children={}) {return {title,children};}
const tree = {children:{admin:node('管理',{
    wlmbstart:node('首页'), status:node('状态',{overview:node('总览')}),
    system:node('系统',{'admin':node('管理权'),'swrt-power':node('光影猫管理'),'swrt-upgrade':node('SWRT 在线更新'),ttyd:node('终端')}),
    network:node('网络',{network:node('接口'),wireless:node('无线网络')}),
    services:node('服务',{'wlmb-server':node('网络面板')}),docker:node('Docker',{containers:node('容器')}),store:node('iStore'),logout:node('退出')
})}};
const ui = {menu:{load:async()=>tree,getChildren:n=>Object.entries(n.children||{}).map(([name,child])=>({...child,name}))}};
const L = {env:{media:'/luci-static/apollo',dispatchpath:['admin','wlmbstart'],requestpath:['admin','wlmbstart']},url:(...parts)=>'/cgi-bin/luci/'+parts.join('/'),resource:p=>'/luci-static/resources/'+p};
function E(tag,attrs={},children) {
    const el=document.createElement(tag);
    for(const [key,value] of Object.entries(attrs)) if(value!=null) el.setAttribute(key,String(value));
    for(const child of [children].flat(Infinity)) if(child!=null)el.appendChild(child.nodeType?child:document.createTextNode(String(child)));
    return el;
}
let narrow = false;
window.matchMedia = q=>({matches:q.includes('780')&&narrow,addEventListener(){},removeEventListener(){}});
const context = vm.createContext({
    window,document,localStorage:window.localStorage,performance:window.performance,
    CustomEvent:window.CustomEvent,ResizeObserver:class { observe() {} },
    baseclass,rpc,ui,poll,L,E,_:x=>x,view:{extend:x=>x},
    uci:{load:async()=>{},get:()=> '1'},Date,Promise,console
});
function moduleAt(file, dependencies={}) {
    const load=vm.runInContext('(function('+Object.keys(dependencies).join(',')+'){'+fs.readFileSync(file,'utf8')+'\n})',context);
    return load(...Object.values(dependencies));
}
const resources = 'www/luci-static/resources/';
const themePanel = moduleAt(path.join(theme,resources,'apollo/ui.js'));
const panel = moduleAt(path.join(home,resources,'wlmbstart/ui.js'));
const signalScore = moduleAt(path.join(home,resources,'wlmbstart/signal-score.js'));
const model = moduleAt(path.join(home,resources,'wlmbstart/model.js'),{signalScore});
const view = moduleAt(path.join(home,resources,'view/wlmbstart/home.js'),{panel,model});
const menu = moduleAt(path.join(theme,resources,'menu-apollo.js'),{panel:themePanel});
function fixture(percent=76) {
    const now=Date.now();
    return {selectedModem:'usb-modem',modems:[{id:'usb-modem',model:'5G 模组'}],
        radio:{stale:false,observedAtMs:now,serving:[{rat:'NR',rsrp:-85,rsrq:-8,sinr:22,stale:false,observedAtMs:now}]},
        system:{stale:false,observedAtMs:now,board:{hostname:'S-Photonicat1'},cpuUsage:8.4,memory:{usedPercent:29.5,usedBytes:1267015352,totalBytes:4294967296},temperature:{celsius:47.2},uptimeSeconds:96600,
            network:{interface:'usb0',rates:{downloadBytesPerSecond:23456789,uploadBytesPerSecond:1456789}},
            battery:{available:true,stale:false,percent,charging:null,source:'provider',observedAtMs:now}}};
}
async function refresh() {await Promise.all(callbacks.map(fn=>fn()));}
(async()=>{
    snapshot=fixture();
    menu.render(tree);
    const content=view.render(await view.load());
    document.getElementById('maincontent').appendChild(content);
    await refresh();

    const battery = document.getElementById('npt-battery');
    assert.equal(battery.getAttribute('aria-label'),'电量 76%，打开光影猫管理');
    assert.equal(content.querySelector('.nph-battery-chip').hidden,false);
    assert.match(content.textContent,/-85/);
    const cellular = [...content.querySelectorAll('.nph-interface')].find(row=>row.textContent.includes('usb0'));
    assert.match(cellular.textContent,/192\.168\.100\.2.*已连接/);
    assert(content.querySelector('.nph-action[href$="/network/network"]'));
    assert.equal(content.querySelector('.nph-action[href$="/system/diskman"]'),null);
    assert.equal(content.querySelector('.nph-plot').getAttribute('role'),'group');
    assert.equal(rpcCalls,1,'首页采样后，主题应复用电量事件');

    const group=document.querySelector('[aria-controls="npt-group-system"]');
    const submenu=document.getElementById('npt-group-system');
    group.click();
    assert.equal(group.getAttribute('aria-expanded'),'true');
    assert(!submenu.hasAttribute('inert'));
    group.click();
    assert.equal(group.getAttribute('aria-expanded'),'false');
    assert(submenu.hasAttribute('inert'));

    for (const mode of ['light','dark','auto']) {
        document.getElementById('npt-appearance').click();
        assert.equal(document.documentElement.dataset.theme,mode);
    }

    snapshot=fixture(0);
    await refresh();
    assert.equal(battery.getAttribute('aria-label'),'电量 0%，打开光影猫管理');
    assert(battery.classList.contains('is-low'));
    snapshot=fixture();
    snapshot.system.battery.observedAtMs-=63000;
    await refresh();
    assert(battery.hidden);

    snapshot=fixture();
    snapshot.system.board.hostname='<img src=x onerror=alert(1)>';
    await refresh();
    assert.match(content.textContent,/<img src=x onerror=alert\(1\)>/);
    assert.equal(content.querySelectorAll('img').length,0);
    failing=true;
    await refresh();
    assert(battery.hidden);
    assert.match(content.textContent,/设备状态暂不可用/);

    L.env.dispatchpath=['admin','network','wireless'];
    document.getElementById('npt-menu').replaceChildren();
    menu.render(tree);
    assert.equal(document.querySelector('[aria-controls="npt-group-network"]').getAttribute('aria-expanded'),'true');
    assert(!document.getElementById('npt-group-network').hasAttribute('inert'));
    assert(document.getElementById('npt-group-system').hasAttribute('inert'));
    console.log('Apollo / wlmbstart 集成检查通过');
})().catch(error=>{console.error(error);process.exitCode=1;});
