const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const dom=new JSDOM('<!doctype html><head></head><body></body>',{url:'http://router.test'});
const context=vm.createContext({window:dom.window,document:dom.window.document,baseclass:{extend:x=>x},rpc:{declare:()=>()=>Promise.resolve({ok:true,data:{}})},L:{resource:p=>'/'+p},Date,Promise});
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
const file=path.join(root,'root/www/luci-static/resources/wlmbstart/ui.js');
const api=vm.runInContext('(function(){'+fs.readFileSync(file,'utf8')+'})()',context);
assert.equal(api.bytes(null),'—');assert.equal(api.bytes(-1),'—');
for(const key of ['tower','wifi','ethernet','network','store','docker','firmwareUpdate','terminal','disk','chart','cpu','memory','temperature','down','up','internet','chevron'])assert(api.icon(key).childNodes.length>0);
const [batteryGraphic,batteryText]=api.batteryBadge({percent:83,charging:true});
assert.equal(batteryGraphic.querySelectorAll('rect').length,3);
assert.ok(batteryGraphic.querySelector('.wlmb-battery-bolt'));
assert.equal(batteryText.textContent,'83%充电中');
assert.equal(api.batteryBadge({percent:0,charging:false})[0].querySelectorAll('rect').length,2);
console.log('luci-app-wlmbstart: JavaScript/JSON syntax and semantic SVG icons passed');

const recipe=fs.readFileSync(path.join(root,"Makefile"),"utf8");assert(recipe.includes("  PKGARCH:=all"),"Package metadata must be architecture independent");
require('./cpe-model.cjs');
