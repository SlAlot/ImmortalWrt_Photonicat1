'use strict';
'require baseclass';
'require wlmbstart.signal-score as signalScore';

function numeric(n) { return typeof n === 'number' && Number.isFinite(n); }
function fresh(row, now, ttl) {
    return !!row && row.stale === false && numeric(row.observedAtMs) && row.observedAtMs > 0 &&
        row.observedAtMs <= now + 5000 && now - row.observedAtMs <= (ttl || 15000);
}
function battery(system, now) {
    var reading = system && system.battery;
    if (!fresh(system, now) || !fresh(reading, now, reading && reading.source === 'provider' ? 60000 : 15000) ||
        !Number.isInteger(reading.percent) || reading.percent < 0 || reading.percent > 100 || reading.available !== true)
        return null;
    return { percent:reading.percent, charging:reading.charging === true, label:(reading.charging === true ? '正在充电 · ' : '电量 ') + reading.percent + '%' };
}
function nonnegative(n) { return numeric(n) && n >= 0 ? n : null; }
function percent(n) { return numeric(n) && n >= 0 && n <= 100 ? n : null; }
function signalValue(n, kind) {
    var range = kind === 'rsrp' ? [-160,-20] : kind === 'rsrq' ? [-60,3] : [-40,60];
    return numeric(n) && n >= range[0] && n <= range[1] ? n : null;
}
function temperature(row, now, system) {
    if (!row || !numeric(row.celsius) || row.celsius < -40 || row.celsius > 150) return null;
    return (system || fresh(row, now, 90000)) ? row.celsius : null;
}
function temperatureGauge(celsius) {
    if (!numeric(celsius)) return {fill:null,state:'unknown'};
    return {
        fill:Math.max(0,Math.min(100,celsius)),
        state:celsius>=90?'critical':celsius>=75?'warm':'normal'
    };
}
function sample(snapshot, now) {
    snapshot = snapshot || {}; now = now == null ? Date.now() : now;
    var system = snapshot.system || {}, valid = fresh(system, now), s = valid ? system : {};
    var radio = snapshot.radio || {}, rows = fresh(radio, now) && Array.isArray(radio.serving) ? radio.serving.filter(function(row) { return fresh(row, now); }) : [];
    var primary = rows.find(function(row) { return row.rat === 'NR'; }) || rows[0] || {};
    var mode = primary.networkMode || (primary.rat === 'NR' ? (rows.some(function(row) { return row.rat === 'LTE'; }) ? '5G NSA' : '5G') : primary.rat === 'LTE' ? '4G LTE' : primary.rat);
    var selected = (Array.isArray(snapshot.modems) ? snapshot.modems : []).find(function(m) { return m.id === snapshot.selectedModem; });
    var operator = radio.networkOperator, net = s.network && s.network.stale !== true ? s.network : {}, rates = net.rates || {};
    var traffic = s.traffic || {}, dated = traffic.stale === false && traffic.clockValid === true;
    var startDay = s.trafficLimit && s.trafficLimit.startDay;
    return { valid:valid, at:valid ? system.observedAtMs : null, uptime:nonnegative(s.uptimeSeconds),
        hostname:system.board && system.board.hostname, device:system.board && system.board.model,
        cpu:percent(s.cpuUsage), memory:percent(s.memory && s.memory.usedPercent), memoryUsed:s.memory && s.memory.usedBytes, memoryTotal:s.memory && s.memory.totalBytes,
        deviceTemperature:temperature(s.temperature, now, valid), modemTemperature:temperature(radio.temperature, now, false),
        modem:selected && selected.model, operator:operator && fresh(operator, now) ? operator.name : null,
        mode:mode, signal:{rsrp:signalValue(primary.rsrp,'rsrp'),rsrq:signalValue(primary.rsrq,'rsrq'),sinr:signalValue(primary.sinr,'sinr')},
        score:signalScore.fromRadio(radio,primary), radioValid:rows.length > 0,
        network:net.interface, down:nonnegative(rates.downloadBytesPerSecond), up:nonnegative(rates.uploadBytesPerSecond),
        rx:nonnegative(net.sinceBootRxBytes), tx:nonnegative(net.sinceBootTxBytes),
        today:dated ? nonnegative(traffic.todayBytes) : null, month:dated ? nonnegative(traffic.monthBytes) : null,
        cycleStartDay:Number.isInteger(startDay) && startDay >= 1 && startDay <= 28 ? startDay : null,
        partial:traffic.partialHistory === true, clockValid:traffic.clockValid === true,
        trafficSupported:!!s.traffic };
}
function networkInterfaces(interfaces, cellularDevices, uplink) {
    var protocols = new Set(['qmi', 'mbim', 'ncm', '3g', 'modemmanager']);
    var devices = new Set(cellularDevices);
    var entries = interfaces.map(function(row) {
        var ipv4 = (row['ipv4-address'] || []).map(function(item) { return item.address; }).filter(Boolean).join(' · ');
        var ipv6 = (row['ipv6-address'] || []).find(function(item) {
            return item.address && !/^(?:fe[89ab]|ff|::(?:1)?$)/i.test(item.address);
        });
        return { name:row.interface, device:row.l3_device || row.device, up:row.up === true, ipv4:!!ipv4,
            ip:ipv4 || (ipv6 && ipv6.address),
            cellular:protocols.has(row.proto) || devices.has(row.l3_device) || devices.has(row.device) };
    });
    var cellularLinks = new Set(entries.filter(function(entry) {
        return entry.cellular && entry.device;
    }).map(function(entry) { return entry.device; }));
    function cellular(entry) {
        return entry.cellular || cellularLinks.has(entry.device);
    }

    var rows = entries.filter(function(entry) {
        return entry.name === 'lan' || (entry.name === 'wan' && !cellular(entry));
    }).map(function(entry) {
        return { label:entry.name.toUpperCase(), up:entry.up, ip:entry.ip };
    });
    var candidates = entries.filter(cellular);
    function priority(entry) {
        return (entry.up && entry.ip ? 8 : entry.up ? 4 : 0) +
            (uplink && entry.device === uplink ? 2 : 0) + (entry.ipv4 ? 1 : 0);
    }
    candidates.sort(function(a, b) { return priority(b) - priority(a); });
    var modem = candidates[0];
    if (modem) {
        rows.push({ label:'蜂窝接口', cellular:true, device:modem.device,
            up:modem.up && !!modem.ip, ip:modem.up ? modem.ip : null });
    } else if (devices.size) {
        rows.push({ label:'蜂窝接口', cellular:true, device:cellularDevices[0], up:false, ip:null });
    }
    return rows;
}

function speed(n) {
    if (!numeric(n) || n < 0) return { value:'—', unit:'' };
    n *= 8; var units=['bps','Kbps','Mbps','Gbps'],i=0;
    while (n >= 1000 && i < 3) { n /= 1000; i++; }
    return { value:n.toFixed(i === 0 ? 0 : n >= 100 ? 0 : 1), unit:units[i] };
}
function duration(n) {
    if (!numeric(n) || n < 0) return '—';
    return n >= 86400 ? Math.floor(n / 86400) + '天 ' + Math.floor(n / 3600 % 24) + '小时' : Math.floor(n / 3600) + '小时 ' + Math.floor(n / 60 % 60) + '分钟';
}
var waveGapMs = 20000;
function trimHistory(points, end) {
    // 保留窗口外紧邻的样本，用于计算图表左边界。
    return points.filter(function(point) { return point[0] >= end - 3600000 - waveGapMs; }).slice(-1208);
}

/* 重启、上网接口切换与采样缺口都应断开曲线。 */
function historyPush(state, row) {
    if (!row.valid || !row.network || row.down == null || row.up == null) return state;
    if (state.network !== row.network || (numeric(state.uptime) && numeric(row.uptime) && row.uptime < state.uptime) || (state.points.length && row.at < state.points[state.points.length - 1][0]))
        state = { network:row.network, uptime:row.uptime, points:[] };
    if (!state.points.length || row.at > state.points[state.points.length - 1][0]) state.points.push([row.at, row.down, row.up]);
    state.uptime = row.uptime;
    state.points = trimHistory(state.points, row.at);
    return state;
}
function waveSegments(points) {
    var segments = [], segment = [];
    points.forEach(function(point) {
        if (segment.length && point[0] - segment[segment.length - 1][0] > waveGapMs) {
            segments.push(segment);
            segment = [];
        }
        segment.push(point);
    });
    if (segment.length) segments.push(segment);
    return segments;
}

function waveWindow(points, now, period, live) {
    var latest=points[points.length-1];
    // 采样延迟在容许范围内时，以最新样本作为右边界。
    var end=live&&latest&&latest[0]<=now&&now-latest[0]<=10000?latest[0]:now;
    var start=end-period;
    var index=points.findIndex(function(point){return point[0]>=start;});
    var samples=index<0?[]:points.slice(index).filter(function(point){return point[0]<=end;});
    var segments=waveSegments(samples);
    var first=samples[0],previous=points[index-1];
    if (first&&previous&&first[0]>start&&first[0]-previous[0]<=waveGapMs) {
        // 左边界插值只参与绘图，悬停提示仍使用实测数据。
        var ratio=(start-previous[0])/(first[0]-previous[0]);
        segments[0].unshift([start,previous[1]+(first[1]-previous[1])*ratio,
            previous[2]+(first[2]-previous[2])*ratio]);
    }
    return {end:end,samples:samples,segments:segments};
}

// 将插值限制在相邻样本范围内，避免绘出虚高峰值或负速率。
function wavePath(points) {
    if (!points.length) return '';
    function coord(x,y) { return x.toFixed(1)+','+y.toFixed(1); }
    var path = 'M'+coord(points[0][0],points[0][1]);
    function slope(index) {
        var prev=points[index-1], point=points[index], next=points[index+1];
        if (!prev||!next||prev[0]>=point[0]||point[0]>=next[0]) return 0;
        var a=(point[1]-prev[1])/(point[0]-prev[0]);
        var b=(next[1]-point[1])/(next[0]-point[0]);
        return a*b>0 ? 2*a*b/(a+b) : 0;
    }
    for (var i=1;i<points.length;i++) {
        var first=points[i-1], last=points[i], dx=(last[0]-first[0])/3;
        var top=Math.min(first[1],last[1]), bottom=Math.max(first[1],last[1]);
        var left=Math.max(top,Math.min(bottom,first[1]+slope(i-1)*dx));
        var right=Math.max(top,Math.min(bottom,last[1]-slope(i)*dx));
        path+='C'+coord(first[0]+dx,left)+' '+coord(last[0]-dx,right)+' '+coord(last[0],last[1]);
    }
    return path;
}

return baseclass.extend({ numeric:numeric, battery:battery, sample:sample, temperatureGauge:temperatureGauge, networkInterfaces:networkInterfaces, speed:speed, duration:duration, historyPush:historyPush, trimHistory:trimHistory, waveWindow:waveWindow, wavePath:wavePath });
