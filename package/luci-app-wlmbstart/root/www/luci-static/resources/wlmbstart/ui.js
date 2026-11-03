'use strict';
'require baseclass';
'require rpc';

var readStatus = rpc.declare({ object:'network-panel', method:'status', params:['modem'] });
var cache = window.__wlmbReadCache || (window.__wlmbReadCache = { pending:null, at:0 }), assetsReady;
var extra = {
    battery:[['rect',{x:2,y:6,width:18,height:12,rx:3}],['path',{d:'M22 10v4'}]],
    cpu:[['rect',{x:5,y:5,width:14,height:14,rx:3}],['rect',{x:9,y:9,width:6,height:6,rx:1}],['path',{d:'M9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3'}]],
    memory:[['rect',{x:3,y:6,width:18,height:12,rx:2}],['path',{d:'M7 10v4m5-4v4m5-4v4M7 18v3m5-3v3m5-3v3'}]],
    disk:[['rect',{x:3,y:3,width:18,height:18,rx:3}],['circle',{cx:12,cy:10,r:4}],['path',{d:'m12 10 5 7M6 18h2'}]],
    store:[['path',{d:'M4 7h16l1 14H3L4 7Zm4 0V5a4 4 0 0 1 8 0v2'}]],
    docker:[['path',{d:'M3 12h17c0 6-3 9-9 9-5 0-8-3-8-9Zm17 0c2 0 3-2 3-3M5 8h4v4H5Zm4-4h4v4H9Zm0 4h4v4H9Zm4 0h4v4h-4Z'}]],
    shield:[['path',{d:'m12 2 8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5l8-3Z'}],['path',{d:'m8 12 3 3 5-6'}]],
    menu:[['path',{d:'M4 6h16M4 12h16M4 18h16'}]],
    chevron:[['path',{d:'m9 5 7 7-7 7'}]],
    sun:[['circle',{cx:12,cy:12,r:4}],['path',{d:'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5'}]],
    logout:[['path',{d:'M9 4H4v16h5m5-13 5 5-5 5m-6-5h11'}]],
    clock:[['circle',{cx:12,cy:12,r:9}],['path',{d:'M12 7v5l3 2'}]],
    apps:[['rect',{x:3,y:3,width:7,height:7,rx:2}],['rect',{x:14,y:3,width:7,height:7,rx:2}],['rect',{x:3,y:14,width:7,height:7,rx:2}],['rect',{x:14,y:14,width:7,height:7,rx:2}]]
};
function icon(name, percent) {
    var ns='http://www.w3.org/2000/svg', svg=document.createElementNS(ns,'svg'), upstream=window.WLMBIcons;
    svg.setAttribute('class','np-icon'); svg.setAttribute('aria-hidden','true'); svg.setAttribute('focusable','false');
    if (upstream && upstream.paths[name]) {
        svg.setAttribute('viewBox',upstream.viewBox); svg.setAttribute('fill','currentColor');
        var path=document.createElementNS(ns,'path'); path.setAttribute('d',upstream.paths[name]); path.setAttribute('transform',upstream.transform); svg.appendChild(path);
    } else {
        svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('fill','none'); svg.setAttribute('stroke','currentColor');
        svg.setAttribute('stroke-width','1.7'); svg.setAttribute('stroke-linecap','round'); svg.setAttribute('stroke-linejoin','round');
        (extra[name] || extra.apps).forEach(function(row) { var node=document.createElementNS(ns,row[0]); Object.keys(row[1]).forEach(function(k){node.setAttribute(k,row[1][k]);}); svg.appendChild(node); });
    }
    if (name==='battery' && Number.isFinite(percent) && percent>=0 && percent<=100) {
        var level=document.createElementNS(ns,'rect');
        Object.entries({x:5,y:9,width:12*percent/100,height:6,rx:1,fill:'currentColor',stroke:'none'}).forEach(function(item){level.setAttribute(item[0],item[1]);});
        svg.appendChild(level);
    }
    return svg;
}
function fresh(s) {
    return !!s && s.stale === false && Number.isFinite(s.observedAtMs) && s.observedAtMs > 0 && s.observedAtMs <= Date.now()+5000 && Date.now()-s.observedAtMs <= 15000;
}
function battery(s) {
    var b=s && s.battery;
    if (!fresh(s) || !b || b.available !== true || b.stale !== false || !Number.isInteger(b.percent) || b.percent<0 || b.percent>100 ||
        !Number.isFinite(b.observedAtMs) || b.observedAtMs<=0 || b.observedAtMs>Date.now()+5000 || Date.now()-b.observedAtMs>(b.source==='provider'?60000:15000))
        return {available:false,label:'电量暂不可用',percent:null,charging:null};
    return {available:true,percent:b.percent,charging:b.charging,label:(b.charging===true?'正在充电 · ':'电量 ')+b.percent+'%'};
}
return baseclass.extend({
    icon:icon, fresh:fresh, battery:battery,
    status:function() {
        if (!cache.pending || Date.now()-cache.at>=2800) {
            cache.at=Date.now();
            cache.pending=readStatus('').then(function(r){if (!r || r.ok!==true || !r.data || typeof r.data!=='object') throw new Error('网络面板服务暂不可用'); return r.data;})
                .catch(function(err){cache.pending=null;throw err;});
        }
        return cache.pending;
    },
    assets:function() {
        if (window.WLMBIcons) return Promise.resolve();
        if (!assetsReady) assetsReady=new Promise(function(resolve,reject){var s=document.createElement('script');s.src=L.resource('wlmbstart/icons.js');s.onload=resolve;s.onerror=function(){reject(new Error('图标资源加载失败'));};document.head.appendChild(s);});
        return assetsReady;
    },
    number:function(n,suffix){return Number.isFinite(n)?n.toFixed(1)+(suffix||''):'—';},
    bytes:function(n,rate){if(!Number.isFinite(n)||n<0)return '—';var u=rate?['B/s','KiB/s','MiB/s','GiB/s']:['B','KiB','MiB','GiB','TiB'],i=0;while(n>=1024&&i<u.length-1){n/=1024;i++;}return n.toFixed(i?1:0)+' '+u[i];}
});
