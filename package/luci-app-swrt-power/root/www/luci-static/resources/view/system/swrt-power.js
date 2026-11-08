'use strict';
'require view';
'require rpc';
'require ui';
'require poll';

var statusCall = rpc.declare({ object: 'luci.swrt_power', method: 'status', expect: {} });
var configureCall = rpc.declare({ object: 'luci.swrt_power', method: 'configure',
    params: [ 'mode', 'minutes', 'start', 'stop', 'revision', 'confirm' ], expect: {} });
var capacityCall = rpc.declare({ object: 'luci.swrt_power', method: 'battery_capacity', expect: {} });
var saveCapacityCall = rpc.declare({ object: 'luci.swrt_power', method: 'set_battery_capacity',
    params: [ 'capacity_mah' ], expect: {} });
var recordFullCall = rpc.declare({ object: 'luci.swrt_power', method: 'record_battery_full', expect: {} });
var resetCalibrationCall = rpc.declare({ object: 'luci.swrt_power', method: 'reset_battery_calibration', expect: {} });

function validCapacity(value) {
    return Number.isInteger(value) && value >= 1000 && value <= 20000;
}

function capacityPanel(data, writable, refreshStatus) {
    var presets = [6800, 3000, 4000, 5000, 6000, 7000, 8000];
    var saved = data && data.ok === true && validCapacity(data.capacity_mah) ? data.capacity_mah : null;
    var reference = data && data.full_reference || 0;
    var busy = false;
    var choice = E('select', { 'class': 'np-input', 'aria-label': '电池容量' }, [
        E('option', { value: '', disabled: '', hidden: '' }, '无法读取')
    ].concat(presets.map(function(value) {
        return E('option', { value: String(value) }, (value === 6800 ? '原厂 ' : '') + value + ' mAh');
    }), E('option', { value: 'custom' }, '自定义容量')));
    var custom = E('input', { type: 'number', 'class': 'np-input', min: '1000', max: '20000', step: '1',
        'aria-label': '自定义电池容量（mAh）' });
    var customField = E('label', { 'class': 'np-info-field' }, [
        E('span', { 'class': 'np-info-label' }, '自定义容量（mAh）'), custom
    ]);
    var save = E('button', { type: 'button', 'class': 'np-btn primary' }, '保存电池容量');
    var record = E('button', { type: 'button', 'class': 'np-btn' }, '记录满电');
    var reset = E('button', { type: 'button', 'class': 'np-btn' }, '恢复原厂估算');
    var actions = E('div', { 'class': 'np-actions' }, [save, record, reset]);
    actions.hidden = !writable;
    var feedback = E('p', { 'class': 'np-hint', role: 'status' }, saved === null ? '容量设置读取失败，请刷新页面。' : '');
    var calibration = E('p', { 'class': 'np-hint' });

    function selection() { return Number(choice.value === 'custom' ? custom.value : choice.value); }
    function updateControls() {
        var value = selection();
        customField.hidden = choice.value !== 'custom';
        choice.disabled = custom.disabled = !writable || saved === null || busy;
        save.disabled = choice.disabled || !validCapacity(value) || value === saved;
        record.disabled = choice.disabled || value !== saved;
        reset.disabled = choice.disabled;
        reset.hidden = !reference;
        calibration.textContent = reference ? '满电显示已校准 · 原始读数 ' + reference + '% 作为满电基准。' :
            '使用原厂电压估算。确认电池充满后，可记录满电读数。';
    }
    choice.value = saved === null ? '' : presets.includes(saved) ? String(saved) : 'custom';
    custom.value = saved === null ? '' : String(saved);
    [choice, custom].forEach(function(node) {
        node.addEventListener(node === choice ? 'change' : 'input', function() {
            feedback.textContent = '';
            updateControls();
        });
    });
    function changeProfile(request, success, pending) {
        busy = true;
        feedback.textContent = pending || '正在保存…';
        updateControls();
        return request().then(function(reply) {
            if (!reply || reply.ok !== true || !validCapacity(reply.capacity_mah))
                throw new Error(reply && reply.message || '电池显示设置保存失败');
            saved = reply.capacity_mah;
            reference = reply.full_reference || 0;
            choice.value = presets.includes(saved) ? String(saved) : 'custom';
            custom.value = String(saved);
            feedback.textContent = success();
            return refreshStatus();
        }).catch(function(error) {
            feedback.textContent = error.message || '电池显示设置保存失败';
        }).finally(function() {
            busy = false;
            updateControls();
        });
    }
    save.addEventListener('click', function() {
        if (save.disabled) return;
        var value = selection();
        return changeProfile(function() { return saveCapacityCall(value); }, function() { return '已保存 ' + saved + ' mAh。'; });
    });
    record.addEventListener('click', function() {
        if (record.disabled) return;
        ui.showModal('记录满电', [
            E('p', {}, '保持接电，等机身最下方的黄色充电灯从呼吸变为常亮。网页百分比是电压估算，请以机身灯的提示为准。'),
            E('p', {}, '校准约需 10 秒，请保持设备负载平稳。'),
            E('div', { 'class': 'np-actions right' }, [
                E('button', { type: 'button', 'class': 'np-btn', click: ui.hideModal }, '取消'),
                E('button', { type: 'button', 'class': 'np-btn primary', click: function() {
                    if (record.disabled) return;
                    ui.hideModal();
                    return changeProfile(recordFullCall, function() {
                        return reference ? '已保存满电校准。' : '原始读数已是 100%，使用原厂估算。';
                    }, '正在读取三次电量，请稍候…');
                } }, '黄灯已常亮')
            ])
        ], 'np-root', 'np-dialog', 'swrt-power-dialog');
    });
    reset.addEventListener('click', function() {
        if (reset.disabled || !reference) return;
        return changeProfile(resetCalibrationCall, function() { return '已恢复原厂估算。'; });
    });
    updateControls();
    return E('div', { 'class': 'swrt-power-capacity' }, [
        E('div', { 'class': 'swrt-power-capacity-fields' }, [
            E('label', { 'class': 'np-info-field' }, [E('span', { 'class': 'np-info-label' }, '电池容量'), choice]),
            customField
        ]),
        E('p', { 'class': 'np-hint' }, '填写电池标签上的额定容量。更换容量会清除已有满电基准。'),
        calibration,
        actions,
        feedback
    ]);
}

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,
    load: function() {
        return Promise.all([
            statusCall().catch(function() { return { ok: false, message: '电源管理服务暂不可用' }; }),
            capacityCall().catch(function() { return null; })
        ]);
    },
    render: function(initial) {
        var writable = L.hasViewPermission(), latest = null, editing = false, editRevision = '';
        var reading = false, saving = false;
        var percent = E('strong', { 'class': 'swrt-power-percent' }, '—');
        var source = E('span', { 'class': 'np-chip' }, '等待状态');
        var supplyHint = E('p', { 'class': 'np-hint', role: 'status' });
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
            E('p', { 'class': 'np-hint' }, '由充电器自动开机后启用；恢复供电即取消倒计时。') ]);
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
                supplyHint.textContent = '暂无可用电源数据。';
                active.textContent = '当前：未确认';
                details.textContent = '连接恢复后重新读取当前策略。';
                message.textContent = data && data.message || '电源状态读取失败，请稍后重试';
                buttons();
                return;
            }
            latest = data;
            var battery = data.battery;
            var display = battery.display_percentage ?? battery.percentage;
            percent.textContent = display + '%';
            meter.value = display;
            percent.title = battery.full_reference ? '电压估算 · 原始读数 ' + battery.percentage + '%' : '';
            source.textContent = battery.external_power ? '外部供电' : '电池供电';
            voltage.textContent = (battery.battery_mv / 1000).toFixed(2) + ' V';
            supply.textContent = (battery.supply_mv / 1000).toFixed(2) + ' V';
            // Advisory values from the v1 manual; never write MCU thresholds.
            supplyHint.textContent = !battery.external_power ? '电量为电压估算，当前使用电池供电。' :
                battery.supply_mv < 4700 ? '输入电压低于 4.7V，可能触发停充保护；接电不代表正在充电。' :
                battery.supply_mv < 4900 ? '输入电压未达官方建议的 4.9V，充电可能变慢；请结合机身充电指示灯判断。' :
                '电量为电压估算；外部供电不代表正在充电，请结合机身充电指示灯判断。';
            // The v1 status packet has no temperature; the official driver supplies zero.
            temperature.textContent = Number.isFinite(battery.temperature) && battery.temperature !== 0 ? battery.temperature + ' °C' : '未提供';
            var current = plan(data);
            active.textContent = '当前：' + { manual: '手动模式', ups: '车载 / UPS 模式', daily: '每日定时模式', custom: '自定义计划' }[current];
            if (current === 'ups') {
                details.textContent = !data.car.armed ? '策略已保存；请关机后由充电器自动开机，再开始断电监测。' :
                    battery.external_power ? '正在监测外部供电，断电后延时 ' + Math.ceil(data.car.timeout / 60) + ' 分钟关机。' :
                    (data.car.countdown >= 0 ? '电池供电中，约 ' + data.car.countdown + ' 秒后关机。' : '正在确认断电状态。');
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
            if (selected === 'ups' && (!Number.isInteger(minutes) || minutes < 1 || minutes > 600 || !latest.battery.external_power)) {
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
                '由充电器自动开机后，断开外部供电延时 ' + minutes + ' 分钟关机；恢复外部供电后取消倒计时。' : '每日 ' + on + ' 开机，' + off + ' 关机，按设备本地时间执行。';
            ui.showModal('确认电源策略', [ E('p', {}, description),
                E('p', {}, '新策略会替换原有计划。自动关机会中断供网，首次测试请确认可重新接入设备。'),
                E('label', { 'class': 'swrt-power-confirm' }, [ acknowledged, ' 我已确认设置，并了解设备可能自动关机。' ]),
                E('div', { 'class': 'np-actions right' }, [ E('button', { type: 'button', 'class': 'np-btn', click: ui.hideModal }, '取消'), confirm ])
            ], 'np-root', 'np-dialog', 'swrt-power-dialog');
        });
        function card(title, children, badge) { return E('section', { 'class': 'np-native-card' }, [
            E('div', { 'class': 'np-native-card-head' }, [ E('strong', {}, title), badge || '' ]), E('div', { 'class': 'np-native-card-body' }, children) ]); }
        var root = E('div', { id: 'swrt-power', 'class': 'np-root swrt-page' }, [
            E('link', { rel: 'stylesheet', href: L.resource('wlmb-server/panel.css') + '?v=1.1.5' }),
            E('link', { rel: 'stylesheet', href: L.resource('swrt-ui.css') + '?v=1.0.4' }),
            E('link', { rel: 'stylesheet', href: L.resource('swrt-power.css') + '?v=1.0.6' }),
            E('div', { 'class': 'np-page-heading' }, [ E('div', {}, [ E('h2', { 'class': 'np-page-title' }, '光影猫管理'),
                E('p', { 'class': 'np-page-description' }, '电池状态与自动开关机') ]), E('span', { 'class': 'np-chip' }, '电源控制') ]),
            E('div', { 'class': 'swrt-workspace' }, [
            E('div', { 'class': 'swrt-main-grid' }, [
            card('电池与供电', [ E('div', { 'class': 'swrt-power-hero' }, [ percent, source ]), meter,
                supplyHint,
                E('details', { 'class': 'swrt-power-more', open: '' }, [ E('summary', {}, '电池详情'),
                    E('div', { 'class': 'swrt-power-metrics' }, [ field('电池电压', voltage), field('外部电压', supply), field('主板温度', temperature) ]),
                    capacityPanel(initial[1], writable, function() { return fetchStatus(false); }) ]) ]),
            card('电源模式', [ details, field('选择模式', mode), upsBox, dailyBox,
                E('div', { 'class': 'np-actions swrt-power-actions' }, [ save, refresh ]) ],
                E('span', { 'class': 'np-chip' }, active))
            ]),
            E('div', { 'class': 'swrt-status-strip' }, [ E('span', { 'class': 'swrt-status-label' }, '设备状态'), message ])
            ]),
            E('p', { 'class': 'np-footer' }, 'SWRT · SlAlot')
        ]);
        selection(); update(initial[0], true);
        poll.add(function() { if (!document.getElementById('swrt-power')) return Promise.resolve(); return fetchStatus(false); }, 10);
        return root;
    }
});
