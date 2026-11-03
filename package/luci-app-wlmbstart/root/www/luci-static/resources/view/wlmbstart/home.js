'use strict';
'require view';
'require rpc';
'require poll';
'require ui';
'require wlmbstart.ui as panel';

var interfaces = rpc.declare({ object: 'network.interface', method: 'dump' });

return view.extend({
    load: function() {
        return Promise.all([panel.assets().catch(function() {}), ui.menu.load()]);
    },
    render: function(loaded) {
        var values = {}, chartPoints = [], lastSample = null, activeInterface = null;
        var tree = loaded[1], now = new Date();
        function allowed(path) {
            var node = tree;
            return path.split('/').every(function(key) { node = node && node.children && node.children[key]; return !!node; });
        }
        function value(key, tag, cls) {
            var node = E(tag || 'strong', { 'class': cls || '' }, '—'); values[key] = node; return node;
        }
        function metric(title, key, glyph) {
            return E('div', { 'class': 'nph-metric' }, [
                E('span', { 'class': 'nph-metric-label' }, [panel.icon(glyph), title]), value(key), value(key + '-note', 'small')
            ]);
        }
        function card(title, glyph, content, action) {
            return E('section', { 'class': 'nph-card' }, [
                E('div', { 'class': 'nph-card-head' }, [E('h3', {}, [panel.icon(glyph), title]), action || '']), content
            ]);
        }
        function link(title, path, glyph, description) {
            if (!allowed(path)) return null;
            return E('a', { 'class': 'nph-shortcut', href: L.url(path) }, [
                E('span', { 'class': 'nph-shortcut-icon' }, panel.icon(glyph)),
                E('span', {}, [E('strong', {}, title), E('small', {}, description)]), panel.icon('chevron')
            ]);
        }
        var battery = E('div', { 'class': 'nph-battery is-unknown' }, [
            E('div', { 'class': 'nph-battery-reading' }, [panel.icon('battery'), value('battery')]),
            E('progress', { max: 100, value: 0, 'aria-label': '电池电量' }),
            value('battery-note', 'p', 'nph-muted'),
            link('光影猫管理', 'admin/system/swrt-power', 'settings', '电池详情与电源策略')
        ]);
        var chart = E('div', { 'class': 'nph-chart', role: 'img', 'aria-label': '最近一分钟上行与下行流量，等待有效采样' });
        var addressList = E('div', { 'class': 'nph-interfaces' }, E('p', { 'class': 'nph-muted' }, '正在读取接口…'));
        var modemFields = E('div', { 'class': 'nph-cellular-fields' }, [
            E('div', {}, [E('span', {}, '当前模组'), value('modem')]),
            E('div', {}, [E('span', {}, '网络制式'), value('rat')]),
            E('div', {}, [E('span', {}, 'RSRP'), value('rsrp')]),
            E('div', {}, [E('span', {}, 'SINR'), value('sinr')])
        ]);
        var update = E('p', { 'class': 'nph-update', 'aria-live': 'polite' }, '正在读取网络面板…');
        var shortcuts = [
            link('网络面板', 'admin/services/wlmb-server', 'bands', '信号、模组与网络状态'),
            link('无线网络', 'admin/network/wireless', 'wifi', '热点、频段与连接'),
            link('应用商店', 'admin/store', 'store', '管理 iStore 应用'),
            link('Docker', 'admin/docker', 'docker', '容器与镜像'),
            link('在线更新', 'admin/system/swrt-upgrade', 'upload', '检查并更新 SWRT'),
            link('终端', 'admin/system/ttyd', 'terminal', '打开网页终端')
        ].filter(Boolean);
        var root = E('div', { 'class': 'np-root nph-root', id: 'wlmbstart' }, [
            E('link', { rel: 'stylesheet', href: L.resource('wlmb-server/panel.css') + '?v=1.1.5' }),
            E('link', { rel: 'stylesheet', href: L.resource('wlmbstart/home.css') + '?v=1.0.0' }),
            E('div', { 'class': 'nph-heading' }, [E('div', {}, [E('p', { 'class': 'nph-eyebrow' }, 'NETWORK PANEL'),
                E('h2', {}, ['设备概览 ', value('hostname', 'span')]), E('p', { 'class': 'nph-muted' }, '网络与设备状态，一目了然')]),
                E('span', { 'class': 'nph-date' }, now.toLocaleDateString())]),
            E('div', { 'class': 'nph-shortcuts' }, shortcuts),
            E('div', { 'class': 'nph-metrics' }, [metric('CPU 占用', 'cpu', 'cpu'), metric('内存占用', 'memory', 'memory'),
                metric('设备温度', 'temperature', 'info'), metric('运行时间', 'uptime', 'clock')]),
            E('div', { 'class': 'nph-main-grid' }, [
                card('网络流量', 'chart', E('div', { 'class': 'nph-card-body' }, [
                    E('div', { 'class': 'nph-rates' }, [E('div', {}, [E('span', {}, '实时下载'), value('down')]),
                        E('div', {}, [E('span', {}, '实时上传'), value('up')]), value('interface', 'small')]),
                    chart, E('p', { 'class': 'nph-muted nph-chart-note' }, '最近一分钟 · 接口总速率，不等同于单个设备的速率')
                ])),
                card('电池状态', 'battery', battery)
            ]),
            card('蜂窝网络', 'bands', modemFields, allowed('admin/services/wlmb-server') ?
                E('a', { 'class':'nph-detail-link', href:L.url('admin/services/wlmb-server') }, '查看信号详情') : null),
            card('网络接口', 'neighbors', addressList), update,
            E('footer', { 'class': 'np-footer nph-footer' }, 'SWRT · SlAlot')
        ]);
        function set(key, content) { values[key].textContent = content == null || content === '' ? '—' : String(content); }
        function drawChart(rates, system) {
            var good = panel.fresh(system) && rates && Number.isFinite(rates.downloadBytesPerSecond) && Number.isFinite(rates.uploadBytesPerSecond);
            if (!good) {
                chartPoints = []; lastSample = null; chart.replaceChildren(E('p', { 'class': 'nph-chart-empty' }, '等待有效流量采样'));
                chart.setAttribute('aria-label', '当前无有效流量数据'); return;
            }
            if (activeInterface !== system.network.interface) { chartPoints = []; activeInterface = system.network.interface; }
            if (lastSample !== system.observedAtMs) {
                chartPoints.push([rates.downloadBytesPerSecond, rates.uploadBytesPerSecond]);
                chartPoints = chartPoints.slice(-20); lastSample = system.observedAtMs;
            }
            var ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
            svg.setAttribute('viewBox', '0 0 600 140'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
            var peak = Math.max(1, ...chartPoints.flat());
            [0, 1].forEach(function(series) {
                var line = document.createElementNS(ns, 'polyline');
                line.setAttribute('points', chartPoints.map(function(p, i) { return (i * 600 / 19) + ',' + (132 - p[series] / peak * 120); }).join(' '));
                line.setAttribute('class', series ? 'nph-line-up' : 'nph-line-down'); svg.appendChild(line);
            });
            chart.replaceChildren(svg);
            chart.setAttribute('aria-label', '实时下载 ' + panel.bytes(rates.downloadBytesPerSecond, true) + '，实时上传 ' + panel.bytes(rates.uploadBytesPerSecond, true));
        }
        function paint(snapshot) {
            var system = snapshot && snapshot.system, fresh = panel.fresh(system), s = fresh ? system : {};
            var rates = s.network && s.network.rates;
            set('hostname', system && system.board && system.board.hostname);
            set('cpu', panel.number(s.cpuUsage, '%')); set('cpu-note', fresh ? '当前 CPU 使用率' : '等待有效采样');
            set('memory', panel.number(s.memory && s.memory.usedPercent, '%'));
            set('memory-note', s.memory ? panel.bytes(s.memory.usedBytes) + ' / ' + panel.bytes(s.memory.totalBytes) : '等待有效采样');
            set('temperature', panel.number(s.temperature && s.temperature.celsius, ' °C'));
            set('temperature-note', '设备传感器');
            var selected = snapshot && (snapshot.modems || []).find(function(m) { return m.id === snapshot.selectedModem; });
            set('modem', selected && selected.model);
            var radio = snapshot && snapshot.radio, serving = radio && radio.stale === false && Array.isArray(radio.serving) ? radio.serving.filter(function(row) {
                return row.stale === false && Number.isFinite(row.observedAtMs) && Date.now() - row.observedAtMs <= 15000 && row.observedAtMs <= Date.now() + 5000;
            }) : [];
            var primary = serving.find(function(row) { return row.rat === 'NR'; }) || serving[0] || {};
            set('rat', primary.networkMode || primary.rat);
            set('rsrp', panel.number(primary.rsrp, ' dBm')); set('sinr', panel.number(primary.sinr, ' dB'));
            var seconds = s.uptimeSeconds;
            set('uptime', Number.isFinite(seconds) ? Math.floor(seconds / 86400) + '天 ' + Math.floor(seconds / 3600 % 24) + '时' : '—');
            set('uptime-note', '自上次启动');
            set('down', panel.bytes(rates && rates.downloadBytesPerSecond, true)); set('up', panel.bytes(rates && rates.uploadBytesPerSecond, true));
            set('interface', s.network ? s.network.interface : '无有效上网接口');
            var b = panel.battery(system);
            set('battery', b.available ? b.percent + '%' : '—');
            set('battery-note', !b.available ? '电量暂不可用' : b.charging === true ? '正在充电' : b.charging === false ? '当前未充电' : '实际充电状态未知');
            battery.classList.toggle('is-unknown', !b.available); battery.classList.toggle('is-low', b.available && b.percent <= 15);
            battery.querySelector('.nph-battery-reading > svg').replaceWith(panel.icon('battery', b.percent));
            battery.querySelector('progress').value = b.available ? b.percent : 0;
            battery.querySelector('progress').setAttribute('aria-valuetext', b.label);
            drawChart(rates, system);
            update.textContent = fresh ? '数据已更新 · ' + new Date(system.observedAtMs).toLocaleTimeString() : '网络面板数据暂不可用，配置页面仍可正常使用';
        }
        poll.add(function() {
            return Promise.all([
                panel.status().then(paint).catch(function() { paint(null); }),
                interfaces().then(function(reply) {
                    if (!reply || !Array.isArray(reply.interface)) throw new Error('接口信息不可用');
                    var rows = reply.interface;
                    addressList.replaceChildren.apply(addressList, rows.filter(function(row) { return row.interface !== 'loopback'; }).map(function(row) {
                        var addresses = (row['ipv4-address'] || []).map(function(ip) { return ip.address; }).concat((row['ipv6-address'] || []).map(function(ip) { return ip.address; }));
                        return E('div', { 'class': 'nph-interface' }, [panel.icon(row.proto === 'qmi' || row.proto === 'ncm' ? 'bands' : 'neighbors'),
                            E('div', {}, [E('strong', {}, row.interface), E('small', {}, addresses.join(' · ') || '暂无地址')]),
                            E('span', { 'class': 'nph-state ' + (row.up ? 'is-up' : '') }, row.up ? '接口已启用' : '接口未启用')]);
                    }));
                    if (!addressList.children.length) addressList.appendChild(E('p', { 'class': 'nph-muted' }, '暂无网络接口'));
                }).catch(function() { addressList.replaceChildren(E('p', { 'class': 'nph-muted' }, '接口信息暂不可用')); })
            ]);
        }, 3);
        return root;
    },
    handleSaveApply: null, handleSave: null, handleReset: null
});
