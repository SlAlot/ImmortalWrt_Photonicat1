'use strict';
'require view';
'require rpc';
'require poll';
'require ui';
'require uci';
'require wlmbstart.ui as panel';
'require wlmbstart.model as model';
var interfaces = rpc.declare({object:'network.interface',method:'dump'});
var readNetworkMetadata = rpc.declare({object:'wlmbstart',method:'cellularDevices'});
return view.extend({
    load:function(){
        return Promise.all([ui.menu.load(), uci.load('wlmbstart').then(function(){
            return uci.get('wlmbstart','main','show_battery') === '1';
        }).catch(function(){return false;})]);
    },
    render:function(data){
        var tree=data[0],showBattery=data[1];
        var refs={},period=60000,scope='connection',lastRow,lastWrite=0;
        var history={network:null,uptime:null,points:[]},restored=false,storageKey;
        var routerClock;
        function routerNow() {
            return routerClock ? routerClock.time + performance.now() - routerClock.received : Date.now();
        }
        function value(key,tag,cls){var n=E(tag||'strong',{'class':cls||''},'—');refs[key]=n;return n;}
        function setText(node,text) { if (node.textContent!==text) node.textContent=text; }
        function setPath(node,path) { if (node.getAttribute('d')!==path) node.setAttribute('d',path); }
        function set(key,text){setText(refs[key],text==null||text===''?'—':String(text));}
        function allowed(path){var n=tree;return path.split('/').every(function(k){n=n&&n.children&&n.children[k];return !!n;});}
        function title(text,action,description){
            var labels=[E('h3',{},text)];
            if (description) labels.push(E('p',{'class':'nph-secondary'},description));
            return E('div',{'class':'nph-section-title'},[
                E('div',{},labels),
                action||''
            ]);
        }
        function link(label,description,path,glyph){
            if (!allowed(path)) return null;
            return E('a',{'class':'nph-action',href:L.url(path)},[
                E('span',{'class':'nph-icon-tile'},panel.icon(glyph)),
                E('span',{'class':'nph-action-copy'},[E('strong',{},label),E('small',{},description)]),
                panel.icon('chevron')
            ]);
        }
        function signalMetric(label,key,unit,description){
            return E('div',{'class':'nph-signal-metric'},[
                E('span',{'class':'nph-signal-label'},label),
                E('div',{'class':'nph-signal-number'},[value(key),E('span',{},unit)]),
                E('span',{'class':'nph-signal-detail'},description)
            ]);
        }
        function ring(label,key,glyph){
            var ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 64 64');svg.setAttribute('aria-hidden','true');
            ['nph-ring-track','nph-ring-fill'].forEach(function(cls){var c=document.createElementNS(ns,'circle');Object.entries({cx:32,cy:32,r:27,'class':cls,pathLength:100}).forEach(function(a){c.setAttribute(a[0],a[1]);});svg.appendChild(c);if(cls==='nph-ring-fill')refs[key+'-ring']=c;});
            return E('div',{'class':'nph-device-metric','data-metric':key},[E('div',{'class':'nph-ring'},[svg,panel.icon(glyph)]),E('div',{'class':'nph-device-reading'},[E('span',{},label),value(key),value(key+'-note','small')])]);
        }
        var battery=null;
        if(showBattery){
            battery=allowed('admin/system/swrt-power')
                ? E('a',{'class':'nph-battery-chip',href:L.url('admin/system/swrt-power'),hidden:''})
                : E('span',{'class':'nph-battery-chip',hidden:''});
        }
        var bars=E('div',{'class':'nph-signal-bars','aria-hidden':'true'},[0,1,2,3,4].map(function(){return E('i');}));
        var signal=E('section',{'class':'nph-card nph-signal','aria-label':'蜂窝信号'},[
            E('div',{'class':'nph-signal-header'},[
                E('div',{'class':'nph-network-name'},[value('operator','h3'),value('mode','span','nph-mode')]),
                value('radio-state','span','nph-radio-state')
            ]),
            E('div',{'class':'nph-signal-layout'},[
                E('div',{'class':'nph-score'},[
                    E('span',{'class':'nph-score-label'},'综合信号评分'),
                    E('div',{'class':'nph-score-value'},[value('signal-score'),E('span',{},'/ 10')]),
                    value('radio-note','span','nph-radio-note')
                ])
            ]),
            bars,
            E('div',{'class':'nph-signal-values'},[
                signalMetric('RSRP','rsrp','dBm','接收强度'),
                signalMetric('RSRQ','rsrq','dB','信号质量'),
                signalMetric('SINR','sinr','dB','信干噪比')
            ]),
            E('div',{'class':'nph-signal-footer'},[
                E('span',{'class':'nph-uplink'},[panel.icon('internet'),value('uplink','span')]),
                allowed('admin/services/wlmb-server')?E('a',{'class':'nph-text-link',href:L.url('admin/services/wlmb-server')},['网络面板',panel.icon('chevron')]):null
            ])
        ]);
        var device=E('section',{'class':'nph-card nph-device'},[
            title('设备信息',battery,'资源占用和传感器读数'),
            E('div',{'class':'nph-device-grid'},[
                ring('CPU 占用','cpu','cpu'),ring('内存占用','memory','memory'),
                ring('模组温度','modem-temperature','temperature'),ring('设备温度','temperature','temperature')
            ]),
            E('div',{'class':'nph-device-footer'},[value('device','span'),E('span',{},['已运行 ',value('uptime','span')])])
        ]);
        var shortcuts=[
            link('网络面板','模组与信号参数','admin/services/wlmb-server','tower'),
            link('无线设置','Wi-Fi 与热点','admin/network/wireless','wifi'),
            link('网络接口','管理连接与设备','admin/network/network','network'),
            link('应用商店','浏览和安装应用','admin/store','store'),
            link('Docker','管理容器','admin/docker','docker'),
            link('在线更新','检查固件版本','admin/system/swrt-upgrade','firmwareUpdate'),
            link('终端','打开命令行','admin/system/ttyd','terminal'),
            link('磁盘管理','查看存储设备','admin/system/diskman','disk')
        ].filter(Boolean);
        var menu=shortcuts.length?E('section',{'class':'nph-menu-section','aria-label':'常用功能'},[
            title('常用功能',null,'常用管理入口'),E('div',{'class':'nph-actions'},shortcuts)
        ]):null;
        var periodButtons=[['1 分钟',60000],['10 分钟',600000],['1 小时',3600000]].map(function(item){
            var b=E('button',{type:'button','aria-pressed':String(period===item[1])},item[0]);
            b.addEventListener('click',function(){period=item[1];periodButtons.forEach(function(other){other.setAttribute('aria-pressed',String(other===b));});draw(lastRow);});return b;
        });
        var scopeSelect=E('select',{'aria-label':'流量统计范围'},[E('option',{value:'connection'},'接口累计'),E('option',{value:'today'},'今日已记录'),E('option',{value:'month'},'本周期已记录')]);
        scopeSelect.addEventListener('change',function(){scope=scopeSelect.value;paintTraffic(lastRow);});
        function usageMetric(label,key,style){
            return E('div',{'class':'nph-usage-metric '+style},[E('span',{},label),value(key)]);
        }
        function svgNode(tag,attrs) {
            var node=document.createElementNS('http://www.w3.org/2000/svg',tag);
            Object.keys(attrs).forEach(function(key){node.setAttribute(key,attrs[key]);});
            return node;
        }
        var axisLabels=[E('span'),E('span'),E('span')],timeLabels=[E('span'),E('span'),E('span')];
        var chartSvg=svgNode('svg',{'aria-hidden':'true'});
        var stage=E('div',{'class':'nph-chart-stage','aria-hidden':'true'},chartSvg);
        var emptyChart=E('div',{'class':'nph-chart-empty'},[panel.icon('chart'),E('strong',{},'等待有效网速采样'),E('span',{},'连接就绪后自动绘制，缺失时段留空')]);
        var plot=E('div',{'class':'nph-plot is-empty',tabindex:'0',role:'group','aria-label':'网速波形，等待采样'},[
            E('div',{'class':'nph-chart-y'},axisLabels),stage,E('div',{'class':'nph-chart-x'},timeLabels),
            emptyChart
        ]);
        var guide=svgNode('g',{visibility:'hidden'});
        var cursor=svgNode('line',{'class':'nph-wave-cursor'});
        var defs=svgNode('defs',{});
        chartSvg.appendChild(defs);
        var grid=[0,.25,.5,.75,1].map(function(fraction){
            var line=svgNode('line',{x1:0,'class':fraction===1?'nph-wave-baseline':'nph-gridline'});
            chartSvg.appendChild(line);
            return line;
        });
        guide.appendChild(cursor);
        var series=['down','up'].map(function(direction,index){
            var id='nph-wave-fill-'+direction, tone=' nph-wave-'+direction;
            var gradient=svgNode('linearGradient',{id:id,x1:0,x2:0,y1:0,y2:1,gradientUnits:'objectBoundingBox'});
            gradient.appendChild(svgNode('stop',{offset:'0%','class':'nph-gradient-'+direction,'stop-opacity':.27}));
            gradient.appendChild(svgNode('stop',{offset:'100%','class':'nph-gradient-'+direction,'stop-opacity':.025}));
            defs.appendChild(gradient);
            var area=svgNode('path',{fill:'url(#'+id+')'});
            var outline=svgNode('path',{'class':'nph-wave-outline'+tone});
            var isolated=svgNode('path',{'class':'nph-wave-isolated'+tone});
            var point=svgNode('circle',{r:4,fill:'currentColor',stroke:'var(--h-card)','stroke-width':1.5,'class':'nph-wave-marker'+tone});
            chartSvg.append(area,outline,isolated);
            guide.appendChild(point);
            return {index:index+1,area:area,outline:outline,isolated:isolated,point:point};
        });
        chartSvg.appendChild(guide);
        var hover=E('div',{'class':'nph-chart-tooltip',role:'status',hidden:''},[
            value('sample-time','time'),value('sample-down','span','nph-key-down'),value('sample-up','span','nph-key-up')
        ]);
        var traffic=E('details',{'class':'nph-card nph-traffic',open:''},[
            E('summary',{'class':'nph-trend-toggle'},[
                E('span',{'class':'nph-icon-tile'},panel.icon('chart')),
                E('span',{'class':'nph-trend-label'},[E('strong',{},'实时趋势'),E('small',{},'网速与流量')]),
                E('span',{'class':'nph-trend-live'},[value('trend-rate','span'),panel.icon('chevron')])
            ]),
            E('div',{'class':'nph-trend-panel'},[
            E('div',{'class':'nph-traffic-summary'},[
                E('div',{'class':'nph-rate nph-download'},[E('span',{},[panel.icon('down'),'下载']),E('div',{},[value('down'),value('down-unit','small')])]),
                E('div',{'class':'nph-rate nph-upload'},[E('span',{},[panel.icon('up'),'上传']),E('div',{},[value('up'),value('up-unit','small')])]),
                E('div',{'class':'nph-usage'},[
                    E('div',{'class':'nph-usage-heading'},[E('span',{},'使用流量'),scopeSelect]),
                    refs['usage-values']=E('div',{'class':'nph-usage-values'},[
                        usageMetric('合计','usage','nph-usage-total'),
                        usageMetric('下行','usage-down','nph-key-down'),
                        usageMetric('上行','usage-up','nph-key-up')
                    ]),
                    value('usage-note','small')
                ])
            ]),
            E('div',{'class':'nph-chart-surface'},[
                E('div',{'class':'nph-chart-heading'},[E('span',{'class':'nph-chart-legend'},[E('span',{'class':'nph-key-down'},'下载'),E('span',{'class':'nph-key-up'},'上传')]),E('div',{'class':'nph-chart-periods',role:'group','aria-label':'网速历史时间范围'},periodButtons)]),
                E('div',{'class':'nph-chart-wrap'},[plot,hover]),
                E('div',{'class':'nph-chart-caption'},[
                    value('chart-note','span'),
                    E('span',{'class':'nph-chart-storage'},'此浏览器保留最近 1 小时有效采样'),
                    E('span',{'class':'nph-chart-touch'},'点按或左右滑动查看网速')
                ])
            ])
            ])
        ]);
        var addresses=E('div',{'class':'nph-interface-list'},E('p',{'class':'nph-secondary'},'正在读取网络接口…')),addressState=null;
        var root=E('div',{'class':'nph-root',id:'wlmbstart'},[
            E('link',{rel:'stylesheet',href:L.resource('wlmbstart/home.css')+'?v=1.0.0'}),
            E('div',{'class':'nph-heading'},[
                E('div',{},[E('span',{'class':'nph-eyebrow'},'CPE 控制台'),E('h2',{},'设备总览'),value('hostname','p')]),
                value('updated','span','nph-updated')
            ]),
            signal,
            E('div',{'class':'nph-overview-grid'},[
                device,E('section',{'class':'nph-card nph-interfaces'},[title('网络连接',null,'主要接口与 IP 地址'),addresses])
            ]),
            menu,traffic,E('p',{'class':'nph-footer'},'SWRT · SlAlot')
        ].filter(Boolean));
        function restore(row){
            if(restored||!row.valid)return;restored=true;storageKey='wlmbstart.history.v2:'+String(row.hostname||window.location.hostname);
            try{var data=JSON.parse(localStorage.getItem(storageKey));if(data&&typeof data.network==='string'&&model.numeric(data.uptime)&&Array.isArray(data.points))history={network:data.network,uptime:data.uptime,points:model.trimHistory(data.points.filter(function(p){return Array.isArray(p)&&p.length===3&&p.every(model.numeric)&&p[0]<=row.at&&p[1]>=0&&p[2]>=0;}),row.at)};}catch(e){}
        }
        function persist(row,force){if(storageKey&&row?.valid&&row.at!==lastWrite&&(force||row.at<lastWrite||row.at-lastWrite>=60000)){lastWrite=row.at;try{localStorage.setItem(storageKey,JSON.stringify(history));}catch(e){}}}
        function paintTraffic(row){
            row=row||{};
            var connection=scope==='connection';
            var amount=scope==='today'?row.today:scope==='month'?row.month:row.rx==null||row.tx==null?null:row.rx+row.tx;
            set('usage',panel.bytes(amount));
            set('usage-down',panel.bytes(connection?row.rx:null));
            set('usage-up',panel.bytes(connection?row.tx:null));
            refs['usage-down'].parentElement.hidden=!connection;
            refs['usage-up'].parentElement.hidden=!connection;
            refs['usage-values'].dataset.scope=connection?'connection':'period';
            var note='';
            if (connection) {
                note=amount==null?'等待接口计数':(row.network||'当前接口')+' · 重建接口或重启后可能清零';
            } else if (amount==null) {
                note=row.trafficSupported&&!row.clockValid?'统计时钟尚未就绪':'暂无此时段流量记录';
            } else {
                note=scope==='today'?'今日 0 点起已记录的上下行合计':
                    (row.cycleStartDay?'每月 '+row.cycleStartDay+' 日起算':'当前账期')+' · 已记录的上下行合计';
                if(row.partial)note+='，可能缺少早期记录';
            }
            setText(refs['usage-note'],note);
            refs['usage-note'].hidden=!note;
        }
        var waveData=[],chartEnd=0,chartDisplayOffset=0,hoverIndex=-1,selectedAt=null,touchSelection=false;
        var chartWidth=0,chartHeight=0,chartPeak=1,hoverFraction=null;
        function xPosition(at) {
            return (at-(chartEnd-period))/period*chartWidth;
        }
        function yFraction(fraction) {
            return chartHeight*(.08+fraction*.86);
        }
        function yPosition(rate) {
            return yFraction(1-rate/chartPeak);
        }
        function hideSample() {
            hover.hidden=true;
            selectedAt=null;
            hoverIndex=-1;
            hoverFraction=null;
            touchSelection=false;
            guide.setAttribute('visibility','hidden');
        }
        function nearestSample(at) {
            return waveData.reduce(function(closest,point,index) {
                return closest<0||Math.abs(point[0]-at)<Math.abs(waveData[closest][0]-at)?index:closest;
            },-1);
        }
        function inspect(index) {
            if (!waveData.length||!chartWidth) return;
            hoverIndex=Math.max(0,Math.min(waveData.length-1,index));
            var sample=waveData[hoverIndex],down=model.speed(sample[1]),up=model.speed(sample[2]);
            if (selectedAt!==sample[0]) set('sample-time',new Date(sample[0]+chartDisplayOffset).toLocaleTimeString());
            selectedAt=sample[0];
            var position=xPosition(selectedAt);
            set('sample-down','↓ '+down.value+' '+down.unit);
            set('sample-up','↑ '+up.value+' '+up.unit);
            hover.hidden=false;

            guide.setAttribute('visibility','visible');
            cursor.setAttribute('x1',position);
            cursor.setAttribute('x2',position);
            series.forEach(function(line) {
                line.point.setAttribute('cx',position);
                line.point.setAttribute('cy',yPosition(sample[line.index]));
            });

            var box=stage.getBoundingClientRect();
            var wrap=hover.parentElement.getBoundingClientRect();
            var x=box.left-wrap.left+position;
            var width=hover.offsetWidth;
            hover.style.left=Math.max(0,Math.min(wrap.width-width,x-width/2))+'px';
        }
        function inspectFraction(fraction,touch) {
            var at=chartEnd-period+fraction*period;
            var index=nearestSample(at);
            if (Math.abs(waveData[index][0]-at)>Math.min(10000,Math.max(3500,period*.02))) {
                hideSample();
                return;
            }
            touchSelection=touch;
            hoverFraction=touch?null:fraction;
            inspect(index);
        }
        function inspectPointer(e) {
            if (!waveData.length) return;
            var box=stage.getBoundingClientRect();
            if (!box.width||e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom) return hideSample();
            if (box.width!==chartWidth||box.height!==chartHeight) draw(lastRow);
            if (!waveData.length) return;
            inspectFraction((e.clientX-box.left)/box.width,e.pointerType==='touch');
        }
        plot.addEventListener('pointerdown',function(e) {
            if (e.pointerType!=='touch'||!e.isPrimary) return;
            plot.setPointerCapture(e.pointerId);
            inspectPointer(e);
        });
        plot.addEventListener('pointermove',function(e) {
            if (e.pointerType!=='touch'||plot.hasPointerCapture(e.pointerId)) inspectPointer(e);
        });
        plot.addEventListener('pointerleave',function(e) { if (e.pointerType!=='touch') hideSample(); });
        plot.addEventListener('pointercancel',hideSample);
        plot.addEventListener('blur',function() { if (!touchSelection) hideSample(); });
        traffic.addEventListener('pointerdown',function(e) { if (!plot.contains(e.target)) hideSample(); });
        plot.addEventListener('keydown',function(e) {
            if (e.key==='Escape') { hideSample(); return; }
            if (e.key!=='ArrowLeft'&&e.key!=='ArrowRight') return;
            e.preventDefault();
            touchSelection=false;
            hoverFraction=null;
            inspect(hoverIndex<0?waveData.length-1:hoverIndex+(e.key==='ArrowLeft'?-1:1));
        });
        function resizeChart() {
            // SVG 未设 viewBox，路径、圆点与指针使用同一套 CSS 像素坐标。
            var size=stage.getBoundingClientRect();
            if (!size.width||!size.height||(size.width===chartWidth&&size.height===chartHeight)) return;
            chartWidth=size.width;
            chartHeight=size.height;
            grid.forEach(function(line,index) {
                var y=yFraction(index/4);
                line.setAttribute('x2',chartWidth);
                line.setAttribute('y1',y);
                line.setAttribute('y2',y);
            });
            cursor.setAttribute('y1',yFraction(0));
            cursor.setAttribute('y2',yFraction(1));
        }
        var chartVisible=!window.IntersectionObserver;
        function draw(row) {
            if (!traffic.open || !chartVisible || document.hidden) return;
            var deviceTime=routerNow();
            // 历史采样按路由器时间对齐，横轴显示浏览器的本地时间。
            var now=row&&row.valid ? Math.max(deviceTime,row.at) : deviceTime;
            var live=row&&row.valid&&row.down!=null&&row.up!=null;
            var windowData=model.waveWindow(history.points,now,period,live);
            chartEnd=windowData.end;
            chartDisplayOffset=Date.now()-deviceTime;
            waveData=windowData.samples;
            plot.classList.toggle('is-empty',!waveData.length);
            emptyChart.hidden=waveData.length>0;
            if (!waveData.length) {
                hideSample();
                plot.setAttribute('aria-label','网速波形，等待采样');
                set('chart-note','当前暂无有效历史');
                return;
            }
            resizeChart();
            if (!chartWidth) return;
            chartPeak=Math.max(125,...windowData.segments.flat().map(function(point){return Math.max(point[1],point[2]);}))*1.1;
            var baseline=yFraction(1).toFixed(1);
            series.forEach(function(line) {
                var outline=[],areas=[],isolated=[];
                windowData.segments.forEach(function(segment) {
                    var points=segment.map(function(point){return [xPosition(point[0]),yPosition(point[line.index])];});
                    var first=points[0],last=points[points.length-1];
                    if (points.length===1) {
                        var direction=first[0]<1?1:-1;
                        isolated.push('M'+first[0].toFixed(1)+','+first[1].toFixed(1)+'h'+direction);
                        return;
                    }
                    var path=model.wavePath(points);
                    outline.push(path);
                    areas.push(path+'L'+last[0].toFixed(1)+','+baseline+' '+first[0].toFixed(1)+','+baseline+'Z');
                });
                setPath(line.area,areas.join(' '));
                setPath(line.outline,outline.join(' '));
                setPath(line.isolated,isolated.join(' '));
            });
            [chartPeak,chartPeak/2,0].forEach(function(rate,index){
                var scale=model.speed(rate);
                setText(axisLabels[index],rate===0?'0':scale.value+' '+scale.unit);
            });
            [0,.5,1].forEach(function(t,index){
                setText(timeLabels[index],new Date(chartEnd+chartDisplayOffset-period+period*t).toLocaleTimeString([],period<=60000?{hour:'2-digit',minute:'2-digit',second:'2-digit'}:{hour:'2-digit',minute:'2-digit'}));
            });
            if (hoverFraction!==null) inspectFraction(hoverFraction,false);
            else if (selectedAt!==null) {
                var selected=nearestSample(selectedAt);
                if (waveData[selected][0]===selectedAt) inspect(selected);
                else hideSample();
            }
            plot.setAttribute('aria-label','最近'+period/60000+'分钟网速波形，'+waveData.length+'个有效样本。点按或用左右方向键查看采样。');
            set('chart-note',(live?'实时采样':'当前数据不可用，保留已有历史')+' · '+(history.network||'—')+' · 缺失时段留空');
        }
        var chartSize=new ResizeObserver(function(){ draw(lastRow); });
        chartSize.observe(stage);
        traffic.addEventListener('toggle',function(){ if(traffic.open) draw(lastRow); });
        if (window.IntersectionObserver) {
            var visibleCards=new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (entry.target===signal) {
                        signal.classList.toggle('is-ribbon-visible',entry.isIntersecting);
                    } else {
                        chartVisible=entry.isIntersecting;
                        if (chartVisible) draw(lastRow);
                    }
                });
            });
            visibleCards.observe(signal);
            visibleCards.observe(plot);
        } else {
            signal.classList.add('is-ribbon-visible');
        }
        function paintRing(key, fill) {
            var indicator=refs[key+'-ring'];
            indicator.style.strokeDasharray=(fill ?? 0)+' 100';
            indicator.classList.toggle('is-unknown',fill===null);
        }
        function paintTemperature(key, celsius, source, missing) {
            var gauge=model.temperatureGauge(celsius);
            refs[key+'-ring'].closest('.nph-device-metric').dataset.temperatureState=gauge.state;
            paintRing(key,gauge.fill);
            set(key,gauge.fill===null?null:celsius.toFixed(1)+' °C');
            set(key+'-note',gauge.state==='critical'?'温度过高':gauge.state==='warm'?'温度偏高':gauge.state==='unknown'?missing:source);
        }
        function paint(snapshot){
            var now=routerNow(),row=model.sample(snapshot,now);lastRow=row;restore(row);history=model.historyPush(history,row);persist(row);
            set('hostname',row.hostname);set('operator',row.operator||'蜂窝网络');set('mode',row.mode);
            refs.mode.hidden=!row.mode;
            var score=row.score, scored=score.value!==null;
            set('signal-score',scored?score.value.toFixed(1):'未读取');
            refs['signal-score'].parentElement.classList.toggle('is-unavailable',!scored);
            set('radio-state',scored?score.label:row.radioValid?'信号不完整':'信号未读取');
            var radioNote=score.carrierText?'载波 '+score.carrierText:scored?'当前小区信号':row.radioValid?'等待完整的信号参数':'等待网络面板采样';
            set('radio-note',radioNote+(score.bandwidth===null?'':' · 下行 '+score.bandwidth+' MHz'));
            signal.classList.toggle('has-signal',scored);
            ['rsrp','rsrq','sinr'].forEach(function(k){var n=row.signal[k];set(k,model.numeric(n)?n.toFixed(0):null);});
            Array.from(bars.children).forEach(function(b,i){ b.classList.toggle('is-active',i<score.level); });
            set('uplink',row.network?'当前上网接口 · '+row.network:'上网接口尚未确认');
            ['cpu','memory'].forEach(function(k){set(k,row[k]==null?null:row[k].toFixed(1)+'%');paintRing(k,row[k]);});
            set('cpu-note',row.cpu==null?'等待采样':'实时负载');set('memory-note',row.memory==null?'等待采样':panel.bytes(row.memoryUsed)+' / '+panel.bytes(row.memoryTotal));
            paintTemperature('modem-temperature',row.modemTemperature,'模组传感器','模组尚未报告');
            paintTemperature('temperature',row.deviceTemperature,'设备传感器','等待传感器数据');
            set('device',row.device);set('uptime',model.duration(row.uptime));
            var b=model.battery(snapshot&&snapshot.system,now);
            document.dispatchEvent(new CustomEvent('wlmbstart:battery',{detail:b}));
            if(battery){
                battery.hidden=!b;
                if(b&&battery.getAttribute('aria-label')!==b.label){
                    battery.replaceChildren.apply(battery,panel.batteryBadge(b));
                    battery.title=b.label;
                    battery.setAttribute('aria-label',b.label);
                }
            }
            ['down','up'].forEach(function(k){var r=model.speed(row[k]);set(k,r.value);setText(refs[k+'-unit'],r.unit);});
            var download=model.speed(row.down);
            set('trend-rate',row.down==null?'等待采样':'↓ '+download.value+' '+download.unit);
            paintTraffic(row);draw(row);set('updated',row.valid?'更新于 '+new Date(Date.now()+row.at-now).toLocaleTimeString():'设备状态暂不可用');
            return row;
        }
        function paintInterfaces(reply,devices,uplink){
            if(!reply||!Array.isArray(reply.interface))throw new Error('接口信息不可用');
            var rows=model.networkInterfaces(reply.interface,devices,uplink);
            var state=JSON.stringify(rows);
            if (state===addressState) return;
            var entries=rows.map(function(row){
                var detail=row.ip||'暂无 IP 地址';
                if(row.device) detail=row.device+' · '+detail;
                return E('div',{'class':'nph-interface'},[
                    E('span',{'class':'nph-icon-tile'},panel.icon(row.cellular?'tower':'ethernet')),
                    E('div',{},[E('strong',{},row.label),E('span',{},detail)]),
                    E('span',{'class':'nph-connection-state'+(row.up?' is-up':'')},[E('i',{}),row.up?'已连接':'未连接'])
                ]);
            });
            addresses.replaceChildren(...(entries.length?entries:[E('p',{'class':'nph-secondary'},'暂无主要网络接口')]));
            addressState=state;
        }
        var refreshing, linkReply, devices=[], nextLinks=0, nextMetadata=0;
        function refresh(){
            if (document.hidden || refreshing) return refreshing;
            var now=performance.now();
            var tasks=[panel.status().catch(function(){return null;})];
            // 网速保持三秒采样，接口地址与硬件枚举各自按变化频率读取。
            if (now>=nextLinks) {
                nextLinks=now+6000;
                tasks.push(interfaces().then(function(reply){linkReply=reply;},function(){linkReply=null;}));
            }
            if (now>=nextMetadata) {
                nextMetadata=now+15000;
                tasks.push(readNetworkMetadata().then(function(reply){
                    devices=Array.isArray(reply?.devices)?reply.devices:[];
                    if (Number.isInteger(reply?.time)&&reply.time>0)
                        routerClock={time:reply.time*1000,received:performance.now()};
                },function(){devices=[];}));
            }
            refreshing=Promise.all(tasks).then(function(result){
                var row=paint(result[0]);
                if (Array.isArray(linkReply?.interface)) {
                    paintInterfaces(linkReply,devices,row.network);
                } else if(addressState!=='error') {
                    addresses.replaceChildren(E('p',{'class':'nph-secondary'},'网络接口读取失败'));
                    addressState='error';
                }
            }).finally(function(){refreshing=null;});
            return refreshing;
        }
        poll.add(refresh,3);refresh();
        document.addEventListener('visibilitychange',function(){
            if (document.hidden) {
                persist(lastRow,true);
            } else {
                nextLinks=nextMetadata=0;
                refresh();
            }
        });
        return root;
    },
    handleSaveApply:null,handleSave:null,handleReset:null
});
