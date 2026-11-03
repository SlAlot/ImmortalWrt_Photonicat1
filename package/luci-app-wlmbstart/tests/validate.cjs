const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'), namespace="luci-app-wlmbstart"==='luci-theme-apollo'?'apollo':'wlmbstart';
const dom=new JSDOM('<!doctype html><head></head><body></body>',{url:'http://router.test'});
const context=vm.createContext({window:dom.window,document:dom.window.document,baseclass:{extend:x=>x},rpc:{declare:()=>()=>Promise.resolve({ok:true,data:{}})},L:{resource:p=>'/'+p},Date,Promise});
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);}
for(const file of walk(path.join(root,'root'))){
 if(file.endsWith('.js'))new Function(fs.readFileSync(file,'utf8'));
 if(file.endsWith('.json'))JSON.parse(fs.readFileSync(file,'utf8'));
}
const file=path.join(root,'root/www/luci-static/resources',namespace,'ui.js');
const api=vm.runInContext('(function(){'+fs.readFileSync(file,'utf8')+'})()',context);
const now=Date.now(),system={stale:false,observedAtMs:now,battery:{available:true,stale:false,percent:0,charging:null,source:'provider',observedAtMs:now}};
assert.equal(api.battery(system).percent,0);assert.equal(api.battery(system).charging,null);
system.battery.percent=101;assert.equal(api.battery(system).available,false);
system.battery.percent=67;system.battery.observedAtMs=now-61000;assert.equal(api.battery(system).available,false);
system.battery.observedAtMs=now;system.stale=true;assert.equal(api.battery(system).available,false);
assert.equal(api.bytes(null),'—');assert.equal(api.bytes(-1),'—');
for(const key of ['home','wifi','bands','battery','disk','docker','settings','terminal'])assert(api.icon(key).childNodes.length>0);
console.log("luci-app-wlmbstart"+': JavaScript/JSON syntax, contract validity, real zero, stale/invalid battery and semantic SVG icons passed');

const recipe=fs.readFileSync(path.join(root,"Makefile"),"utf8");assert(recipe.includes("  PKGARCH:=all"),"Package metadata must be architecture independent");
