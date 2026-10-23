'use strict';
'require view';
'require rpc';
'require ui';
'require poll';

var statusCall = rpc.declare({ object: 'luci.swrt_power', method: 'status', expect: {} });
var configureCall = rpc.declare({ object: 'luci.swrt_power', method: 'configure',
    params: [ 'mode', 'minutes', 'start', 'stop', 'revision', 'confirm' ], expect: {} });

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,
    load: function() {
        return statusCall().catch(function() { return { ok: false, message: '电源管理服务暂不可用' }; });
    },
    render: function(initial) {
        var writable = L.hasViewPermission(), latest = null, editing = false, editRevision = '';
        var reading = false, saving = false;
        var percent = E('strong', { 'class': 'swrt-power-percent' }, '—');
        var source = E('span', { 'class': 'np-chip' }, '等待状态');
        var meter = E('progress', { max: '100', value: '0', 'aria-label': '电量' });
        var voltage = E('strong', {}, '—'), supply = E('strong', {}, '—'), temperature = E('strong', {}, '—');
        var active = E('strong', {}, '读取中'), details = E('p', { 'class': 'np-desc' });
        var message = E('p', { 'class': 'np-hint', role: 'status', 'aria-live': 'polite' });
        var customChoice = E('option', { value: 'custom', disabled: '', hidden: '' }, '当前自定义计划');
        var mode = E('select', { 'class': 'np-input', 'aria-label': '电源模式' }, [
            customChoice,
            E('option', { value: 'manual' }, '手动模式'),
            E('option', { value: 'ups' }, '车载 / UPS 模式'),
            E('option', { value: 'daily' }, '每日定时模式')
        ]);
        var delay = E('input', { type: 'number', 'class': 'np-input', min: '1', max: '600', value: '5', 'aria-label': '延时关机分钟' });
        var start = E('input', { type: 'time', 'class': 'np-input', value: '07:00', 'aria-label': '每日开机时间' });
        var stop = E('input', { type: 'time', 'class': 'np-input', value: '23:00', 'aria-label': '每日关机时间' });
        var save = E('button', { type: 'button', 'class': 'np-btn primary', disabled: '' }, '保存电源策略');
        var refresh = E('button', { type: 'button', 'class': 'np-btn', hidden: '' }, '取消修改');
        function field(label, node) { return E('div', { 'class': 'np-info-field' }, [ E('span', { 'class': 'np-info-label' }, label), node ]); }
        var upsBox = E('div', { 'class': 'swrt-power-settings' }, [ field('断电后多久关机（分钟）', delay),
            E('p', { 'class': 'np-hint' }, '接通外部电源后启用；恢复供电即取消倒计时。') ]);
        var dailyBox = E('div', { 'class': 'swrt-power-times' }, [ field('开机时间', start), field('关机时间', stop) ]);
        function selection() {
            upsBox.hidden = mode.value !== 'ups';
            dailyBox.hidden = mode.value !== 'daily';
        }
        function buttons() {
            var valid = latest && latest.ok === true;
            save.disabled = !writable || !valid || !editing || saving || reading ||
                (editing && editRevision !== latest.revision);
            refresh.disabled = reading || saving;
            refresh.hidden = valid && !editing;
            refresh.textContent = !valid || (editing && editRevision !== latest.revision) ? '重新读取' : '取消修改';
            [mode, delay, start, stop].forEach(function(node) { node.disabled = !writable || saving; });
        }
        function timeOf(row) { return String(row.hour).padStart(2, '0') + ':' + String(row.minute).padStart(2, '0'); }
        function plan(data) {
            if (data.car.state === 1) return 'ups';
            if (!data.events.length) return 'manual';
            if (data.events.length === 2 && data.events.every(function(row) {
                return row && row.enabled === 1 && row['enable-bits'] === 56 && row['dow-bits'] === 127 &&
                    Number.isInteger(row.hour) && row.hour >= 0 && row.hour <= 23 &&
                    Number.isInteger(row.minute) && row.minute >= 0 && row.minute <= 59;
            }) && data.events.filter(function(row) { return row.action === 1; }).length === 1 &&
                data.events.filter(function(row) { return row.action === 0; }).length === 1) return 'daily';
            return 'custom';
        }
        function update(data, reset) {
            if (!data || data.ok !== true) {
                latest = null;
                percent.textContent = voltage.textContent = supply.textContent = temperature.textContent = '—';
                meter.value = 0;
                source.textContent = '状态不可用';
                active.textContent = '当前：未确认';
                details.textContent = '连接恢复后重新读取当前策略。';
                message.textContent = data && data.message || '电源状态读取失败，请稍后重试';
                buttons();
                return;
            }
            latest = data;
            var battery = data.battery;
            percent.textContent = battery.percentage + '%';
            meter.value = battery.percentage;
            source.textContent = battery.charging ? '外部供电' : '电池供电';
            voltage.textContent = (battery.battery_mv / 1000).toFixed(2) + ' V';
            supply.textContent = (battery.supply_mv / 1000).toFixed(2) + ' V';
            temperature.textContent = battery.temperature + ' °C';
            var current = plan(data);
            active.textContent = '当前：' + { manual: '手动模式', ups: '车载 / UPS 模式', daily: '每日定时模式', custom: '自定义计划' }[current];
            if (current === 'ups') {
                details.textContent = battery.charging ? '正在监测外部供电，断电后延时 ' + Math.ceil(data.car.timeout / 60) + ' 分钟关机。' :
                    (data.car.armed && data.car.countdown >= 0 ? '电池供电中，约 ' + data.car.countdown + ' 秒后关机。' : '等待接入外部电源后开始监测。');
            } else if (current === 'daily') {
                details.textContent = '每日 ' + timeOf(data.events.find(function(row) { return row.action === 1; })) + ' 开机，' +
                    timeOf(data.events.find(function(row) { return row.action === 0; })) + ' 关机（设备本地时间）。';
            } else details.textContent = current === 'manual' ? '未启用自动开关机策略。' : '当前有 ' + data.events.length + ' 条计划；保存新策略将替换它们。';
            if (!editing || reset) {
                editing = false;
                editRevision = data.revision;
                customChoice.hidden = current !== 'custom';
                mode.value = current;
                if (current === 'ups') delay.value = Math.ceil(data.car.timeout / 60);
                if (current === 'daily') {
                    start.value = timeOf(data.events.find(function(row) { return row.action === 1; }));
                    stop.value = timeOf(data.events.find(function(row) { return row.action === 0; }));
                }
                selection();
            }
            message.textContent = editing && editRevision !== data.revision ? '策略已在其他位置变化，请刷新后重新编辑。' :
                new Date().toLocaleTimeString() + ' 已更新';
            buttons();
        }
        function fetchStatus(reset) {
            if (reading || saving) return Promise.resolve();
            reading = true; buttons();
            return statusCall().then(function(data) { update(data, reset); })
                .catch(function() { update({ ok: false, message: '电源管理服务连接中断，暂时禁止保存' }); })
                .finally(function() { reading = false; buttons(); });
        }
        [mode, delay, start, stop].forEach(function(node) {
            function changed() {
                if (!editing && latest) editRevision = latest.revision;
                editing = true; selection(); buttons();
            }
            node.addEventListener('input', changed);
            node.addEventListener('change', changed);
        });
        refresh.addEventListener('click', function() { fetchStatus(true); });
        save.addEventListener('click', function() {
            if (save.disabled || !latest) return;
            var selected = mode.value, minutes = Number(delay.value), revision = editRevision;
            var on = start.value, off = stop.value;
            if (selected === 'ups' && (!Number.isInteger(minutes) || minutes < 1 || minutes > 600 || !latest.battery.charging)) {
                ui.addNotification(null, E('p', {}, '请接入外部电源，并填写 1～600 分钟的整数延时。')); return;
            }
            if (selected === 'daily' && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(on) ||
                !/^([01]\d|2[0-3]):[0-5]\d$/.test(off) || on === off)) {
                ui.addNotification(null, E('p', {}, '请输入不同的有效开机和关机时间。')); return;
            }
            var acknowledged = E('input', { type: 'checkbox' });
            var confirm = E('button', { type: 'button', 'class': 'np-btn primary', disabled: '' }, '确认保存');
            acknowledged.addEventListener('change', function() { confirm.disabled = !acknowledged.checked; });
            confirm.addEventListener('click', function() {
                if (!acknowledged.checked || saving || reading) return;
                ui.hideModal(); saving = true; buttons();
                configureCall(selected, selected === 'ups' ? minutes : 0, on, off, revision, 1)
                    .then(function(data) {
                        if (!data || data.ok !== true) throw new Error(data && data.message || '策略保存失败');
                        update(data, true);
                        ui.addNotification(null, E('p', {}, '电源策略已保存。'));
                    }).catch(function(err) { ui.addNotification(null, E('p', {}, String(err.message || err)), 'error'); })
                    .finally(function() { saving = false; return fetchStatus(false); });
            });
            var description = selected === 'manual' ? '关闭车载 / UPS 与定时计划，恢复手动模式。' : selected === 'ups' ?
                '断开外部供电后延时 ' + minutes + ' 分钟关机；恢复外部供电后取消倒计时。' : '每日 ' + on + ' 开机，' + off + ' 关机，按设备本地时间执行。';
            ui.showModal('确认电源策略', [ E('p', {}, description),
                E('p', {}, '新策略会替换原有计划。自动关机会中断供网，首次测试请确认可重新接入设备。'),
                E('label', { 'class': 'swrt-power-confirm' }, [ acknowledged, ' 我已确认设置，并了解设备可能自动关机。' ]),
                E('div', { 'class': 'np-actions right' }, [ E('button', { type: 'button', 'class': 'np-btn', click: ui.hideModal }, '取消'), confirm ])
            ], 'np-root', 'np-dialog', 'swrt-power-dialog');
        });
        function card(title, children, badge) { return E('section', { 'class': 'np-native-card' }, [
            E('div', { 'class': 'np-native-card-head' }, [ E('strong', {}, title), badge || '' ]), E('div', { 'class': 'np-native-card-body' }, children) ]); }
        var root = E('div', { id: 'swrt-power', 'class': 'np-root swrt-page' }, [
            E('link', { rel: 'stylesheet', href: L.resource('wlmb-server/panel.css') + '?v=1.1.3' }),
            E('link', { rel: 'stylesheet', href: L.resource('swrt-ui.css') + '?v=1.0.4' }),
            E('link', { rel: 'stylesheet', href: L.resource('swrt-power.css') + '?v=1.0.5' }),
            E('div', { 'class': 'np-page-heading' }, [ E('div', {}, [ E('h2', { 'class': 'np-page-title' }, '光影猫管理'),
                E('p', { 'class': 'np-page-description' }, '电池状态与自动开关机') ]), E('span', { 'class': 'np-chip' }, '电源控制') ]),
            E('div', { 'class': 'swrt-workspace' }, [
            E('div', { 'class': 'swrt-main-grid' }, [
            card('电池与供电', [ E('div', { 'class': 'swrt-power-hero' }, [ percent, source ]), meter,
                E('details', { 'class': 'swrt-power-more', open: '' }, [ E('summary', {}, '电池详情'),
                    E('div', { 'class': 'swrt-power-metrics' }, [ field('电池电压', voltage), field('外部电压', supply), field('主板温度', temperature) ]) ]) ]),
            card('电源模式', [ details, field('选择模式', mode), upsBox, dailyBox,
                E('div', { 'class': 'np-actions swrt-power-actions' }, [ save, refresh ]) ],
                E('span', { 'class': 'np-chip' }, active))
            ]),
            E('div', { 'class': 'swrt-status-strip' }, [ E('span', { 'class': 'swrt-status-label' }, '设备状态'), message ])
            ]),
            E('p', { 'class': 'np-footer' }, 'SWRT · SlAlot')
        ]);
        selection(); update(initial, true);
        poll.add(function() { if (!document.getElementById('swrt-power')) return Promise.resolve(); return fetchStatus(false); }, 10);
        return root;
    }
});
