'use strict';
'require baseclass';
'require rpc';

var readStatus = rpc.declare({ object:'network-panel', method:'status', params:['modem'] });
var readClock = rpc.declare({ object:'luci', method:'getUnixtime', expect:{result:0} });
var readLegacyClock = rpc.declare({ object:'luci', method:'getLocaltime', expect:{result:0} });
var clockReader;

function routerTime() {
    if (clockReader) return clockReader().catch(function() { return 0; });
    // LuCI 23.05 和 24.10 的 getLocaltime 返回 Unix 时间戳。
    return readClock().catch(function() { return 0; }).then(function(seconds) {
        if (seconds>0) { clockReader=readClock; return seconds; }
        return readLegacyClock().then(function(legacy) {
            if (legacy>0) clockReader=readLegacyClock;
            return legacy;
        }).catch(function() { return 0; });
    });
}
// 与网络面板共用的 SVG 图形。
var panelGlyphs = {
    chevron: "M8.344 20Q8.667 20 8.946 19.763L16.237 12.624Q16.516 12.344 16.516 12Q16.516 11.613 16.237 11.376L8.946 4.258Q8.688 4 8.344 4Q7.978 4 7.731 4.237Q7.484 4.473 7.484 4.839Q7.484 5.183 7.742 5.441L14.452 12L7.742 18.559Q7.484 18.817 7.484 19.161Q7.484 19.527 7.731 19.763Q7.978 20 8.344 20Z",
    sun: "M12.796 2.796Q12.796 2.473 12.559 2.237Q12.323 2 12 2Q11.677 2 11.441 2.237Q11.204 2.473 11.204 2.796V4.731Q11.204 5.054 11.441 5.301Q11.677 5.548 12 5.548Q12.323 5.548 12.559 5.301Q12.796 5.054 12.796 4.731ZM16.559 6.323Q16.323 6.538 16.323 6.882Q16.323 7.226 16.559 7.441Q16.796 7.677 17.129 7.688Q17.462 7.699 17.699 7.441L19.075 6.065Q19.312 5.828 19.312 5.495Q19.312 5.161 19.075 4.925Q18.839 4.71 18.505 4.71Q18.172 4.71 17.935 4.925ZM6.301 7.441Q6.538 7.677 6.871 7.677Q7.204 7.677 7.441 7.441Q7.656 7.226 7.667 6.882Q7.677 6.538 7.441 6.323L6.065 4.925Q5.849 4.71 5.516 4.71Q5.183 4.71 4.946 4.925Q4.71 5.161 4.71 5.495Q4.71 5.828 4.925 6.065ZM12 7.29Q10.71 7.29 9.645 7.935Q8.581 8.581 7.935 9.645Q7.29 10.71 7.29 12Q7.29 13.29 7.935 14.355Q8.581 15.419 9.645 16.065Q10.71 16.71 12 16.71Q13.29 16.71 14.355 16.065Q15.419 15.419 16.054 14.355Q16.688 13.29 16.688 12Q16.688 10.71 16.054 9.645Q15.419 8.581 14.355 7.935Q13.29 7.29 12 7.29ZM12 8.71Q12.903 8.71 13.645 9.161Q14.387 9.613 14.839 10.355Q15.29 11.097 15.29 12Q15.29 12.903 14.839 13.656Q14.387 14.409 13.645 14.849Q12.903 15.29 12 15.29Q11.097 15.29 10.344 14.849Q9.591 14.409 9.151 13.656Q8.71 12.903 8.71 12Q8.71 11.097 9.151 10.355Q9.591 9.613 10.344 9.161Q11.097 8.71 12 8.71ZM21.161 12.796Q21.505 12.796 21.742 12.559Q21.978 12.323 21.978 12Q21.978 11.677 21.742 11.441Q21.505 11.204 21.161 11.204H19.247Q18.925 11.204 18.688 11.441Q18.452 11.677 18.452 12Q18.452 12.323 18.688 12.559Q18.925 12.796 19.247 12.796ZM2.839 11.204Q2.495 11.204 2.258 11.441Q2.022 11.677 2.022 12Q2.022 12.323 2.258 12.559Q2.495 12.796 2.839 12.796H4.753Q5.075 12.796 5.312 12.559Q5.548 12.323 5.548 12Q5.548 11.677 5.312 11.441Q5.075 11.204 4.753 11.204ZM17.677 16.559Q17.462 16.344 17.129 16.344Q16.796 16.344 16.559 16.559Q16.323 16.796 16.323 17.129Q16.323 17.462 16.559 17.699L17.935 19.075Q18.172 19.312 18.505 19.301Q18.839 19.29 19.075 19.075Q19.312 18.839 19.312 18.505Q19.312 18.172 19.075 17.935ZM4.925 17.935Q4.688 18.151 4.688 18.495Q4.688 18.839 4.925 19.054Q5.14 19.29 5.484 19.29Q5.828 19.29 6.065 19.075L7.441 17.699Q7.656 17.462 7.667 17.129Q7.677 16.796 7.441 16.559Q7.226 16.344 6.882 16.344Q6.538 16.344 6.301 16.559ZM12.796 19.269Q12.796 18.946 12.559 18.699Q12.323 18.452 12 18.452Q11.677 18.452 11.441 18.699Q11.204 18.946 11.204 19.269V21.204Q11.204 21.527 11.441 21.763Q11.677 22 12 22Q12.323 22 12.559 21.763Q12.796 21.527 12.796 21.204Z",
    moon: "M17.589 15.441Q14.864 15.441 12.878 14.39Q10.891 13.339 9.818 11.423Q8.744 9.506 8.744 6.873Q8.744 5.741 8.917 4.794Q9.09 3.848 9.367 3.316Q9.483 3.109 9.506 2.982Q9.529 2.855 9.529 2.693Q9.529 2.462 9.333 2.231Q9.136 2 8.813 2Q8.767 2 8.628 2.023Q8.49 2.046 8.259 2.139Q6.434 2.878 5.037 4.321Q3.64 5.764 2.843 7.658Q2.046 9.552 2.046 11.63Q2.046 13.871 2.808 15.776Q3.57 17.681 4.968 19.079Q6.365 20.476 8.259 21.238Q10.152 22 12.416 22Q14.564 22 16.4 21.284Q18.236 20.568 19.621 19.24Q21.007 17.912 21.815 16.065Q21.908 15.857 21.931 15.707Q21.954 15.557 21.954 15.464Q21.954 15.164 21.746 14.979Q21.538 14.794 21.307 14.794Q21.169 14.794 21.065 14.806Q20.961 14.818 20.799 14.887Q20.176 15.141 19.321 15.291Q18.467 15.441 17.589 15.441ZM3.594 11.561Q3.594 10.014 4.102 8.582Q4.61 7.15 5.545 5.949Q6.48 4.748 7.774 3.94Q7.52 4.633 7.393 5.395Q7.266 6.157 7.266 7.012Q7.266 10.106 8.478 12.312Q9.691 14.517 11.942 15.695Q14.194 16.873 17.358 16.873Q18.12 16.873 18.79 16.781Q19.46 16.688 20.06 16.48Q18.928 18.328 16.896 19.402Q14.864 20.476 12.485 20.476Q10.545 20.476 8.928 19.818Q7.312 19.159 6.111 17.958Q4.91 16.758 4.252 15.129Q3.594 13.501 3.594 11.561Z",
    autoTheme: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18.3V3.7a8.3 8.3 0 0 1 0 16.6Z",
    close: "M2.324 20.088Q2 20.412 2 20.882Q2 21.353 2.324 21.676Q2.676 22 3.132 22Q3.588 22 3.941 21.676L12 13.588L20.059 21.676Q20.382 22 20.853 22Q21.324 22 21.676 21.676Q22 21.324 22 20.868Q22 20.412 21.676 20.088L13.588 12L21.676 3.941Q22 3.618 22 3.147Q22 2.676 21.676 2.353Q21.324 2 20.853 2Q20.382 2 20.059 2.353L12 10.412L3.941 2.353Q3.588 2 3.118 2Q2.647 2 2.324 2.353Q2 2.676 2 3.147Q2 3.618 2.324 3.941L10.412 12Z",
};

function icon(name) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'np-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    if (Object.hasOwn(panelGlyphs, name)) {
        var path = document.createElementNS(ns, 'path');
        path.setAttribute('d', panelGlyphs[name]);
        path.setAttribute('fill', 'currentColor');
        path.setAttribute('stroke', 'none');
        svg.appendChild(path);
    }
    return svg;
}
function fresh(sample, now, ttl) {
    return !!sample && sample.stale === false && Number.isFinite(sample.observedAtMs) &&
        sample.observedAtMs > 0 && sample.observedAtMs <= now + 5000 && now - sample.observedAtMs <= ttl;
}

function battery(system, now) {
    var reading = system && system.battery;
    if (!fresh(system, now, 15000) || !fresh(reading, now, reading && reading.source === 'provider' ? 60000 : 15000) ||
        reading.available !== true || !Number.isInteger(reading.percent) || reading.percent < 0 || reading.percent > 100)
        return null;
    return { percent:reading.percent, charging:reading.charging === true, label:(reading.charging === true ? '正在充电 · ' : '电量 ') + reading.percent + '%' };
}

function batteryBadge(reading) {
    const fill = E('span', {
        'class':'npt-battery-fill', style:'inline-size:' + reading.percent + '%'
    });
    const segments = [fill];
    if (reading.charging) {
        segments.push(E('span', {
            'class':'npt-battery-bolt' + (reading.percent < 50 ? ' on-empty' : '')
        }));
    }
    return [
        E('span', {'class':'npt-battery-symbol','aria-hidden':'true'},
            E('span', {'class':'npt-battery-shell'}, segments)),
        E('span', {'class':'npt-battery-copy'}, [
            E('strong', {}, reading.percent + '%'),
            E('span', {}, reading.charging ? '充电中' : '电量')
        ])
    ];
}

return baseclass.extend({
    icon:icon,
    batteryBadge:batteryBadge,
    battery:battery,
    readBattery:function() {
        return Promise.all([readStatus(''), routerTime()]).then(function(result) {
            var reply = result[0], seconds = result[1];
            var now = Number.isInteger(seconds) && seconds > 0 ? seconds * 1000 : Date.now();
            return reply && reply.ok === true && reply.data ? battery(reply.data.system, now) : null;
        }).catch(function() { return null; });
    }
});
