const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const dom=new JSDOM('<!doctype html><head></head><body></body>',{url:'http://router.test'});
const rpcReplies=new Map(),rpcCalls=[];
const rpc={declare:({method})=>()=>{rpcCalls.push(method);return Promise.resolve(rpcReplies.get(method));}};
const context=vm.createContext({window:dom.window,document:dom.window.document,baseclass:{extend:x=>x},rpc,L:{resource:p=>'/'+p},Date,Promise});
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);}
for(const file of walk(path.join(root,'root'))){
 if(file.endsWith('.js'))new Function(fs.readFileSync(file,'utf8'));
 if(file.endsWith('.json'))JSON.parse(fs.readFileSync(file,'utf8'));
}
context.E=(tag,attrs,children)=>{
 const node=dom.window.document.createElement(tag);
 Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,value));
 for(const child of [children].flat())node.append(child);
 return node;
};
const file=path.join(root,'root/www/luci-static/resources/apollo/ui.js');
const api=vm.runInContext('(function(){'+fs.readFileSync(file,'utf8')+'})()',context);
const now=Date.now(),system={stale:false,observedAtMs:now,battery:{available:true,stale:false,percent:0,charging:null,source:'provider',observedAtMs:now}};
assert.equal(api.battery(system,now).percent,0);
system.battery.percent=101;assert.equal(api.battery(system,now),null);
system.battery.percent=67;system.battery.observedAtMs=now-61000;assert.equal(api.battery(system,now),null);
system.battery.observedAtMs=now;system.stale=true;assert.equal(api.battery(system,now),null);
for(const key of ['close','autoTheme','sun','moon','chevron'])assert(api.icon(key).childNodes.length>0);
const [batteryGraphic,batteryText]=api.batteryBadge({percent:83,charging:true});
assert.equal(batteryGraphic.querySelector('.npt-battery-fill').style.inlineSize,'83%');
assert.ok(batteryGraphic.querySelector('.npt-battery-shell > .npt-battery-bolt'));
assert.equal(batteryText.textContent,'83%充电中');
const [emptyBattery]=api.batteryBadge({percent:0,charging:false});
assert.equal(emptyBattery.querySelector('.npt-battery-fill').style.inlineSize,'0%');
assert.equal(emptyBattery.querySelector('.npt-battery-bolt'),null);
console.log("luci-theme-apollo"+': JavaScript/JSON syntax, contract validity, real zero, stale/invalid battery and semantic SVG icons passed');

const recipe=fs.readFileSync(path.join(root,"Makefile"),"utf8");assert(recipe.includes("  PKGARCH:=all"),"Package metadata must be architecture independent");
require('./navigation.cjs');

(async()=>{
 const seconds=1700000000;
 const observedAtMs=seconds*1000;
 const data={system:{observedAtMs,stale:false,battery:{available:true,stale:false,observedAtMs,percent:45}}};
 rpcReplies.set('status',{ok:true,data});
 rpcReplies.set('getLocaltime',seconds);
 assert.equal((await api.readBattery()).percent,45);
 assert.deepEqual(rpcCalls,['status','getUnixtime','getLocaltime']);
 rpcCalls.length=0;
 assert.equal((await api.readBattery()).percent,45);
 assert.deepEqual(rpcCalls,['status','getLocaltime']);
 console.log('Apollo battery: OpenWrt 23.05 and 24.10 clock fallback passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
