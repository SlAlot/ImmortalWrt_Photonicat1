'use strict';
'require view';
'require rpc';
'require ui';
'require poll';

var statusCall = rpc.declare({ object: 'luci.swrt_upgrade', method: 'status', expect: {} });
var checkCall = rpc.declare({ object: 'luci.swrt_upgrade', method: 'check', expect: {} });
var downloadCall = rpc.declare({ object: 'luci.swrt_upgrade', method: 'download', expect: {} });
var installCall = rpc.declare({ object: 'luci.swrt_upgrade', method: 'install', params: [ 'keep', 'sha256' ], expect: {} });

return view.extend({
    handleSave: null,
    handleSaveApply: null,
    handleReset: null,

    load: function() { return statusCall(); },

    render: function(initial) {
        var writable = L.hasViewPermission();
        var latest = null, pending = false, polling = false, reconnecting = false;
        var installRequested = false, statusFailures = 0;
        var current = E('strong', {}, '—'), available = E('strong', {}, '—');
        var filesystem = E('strong', {}, '—'), size = E('strong', {}, '—');
        var filename = E('span', {}, '检查后显示匹配的固件');
        var digest = E('code', {}, '下载时获取并验证');
        var message = E('p', { role: 'status', 'aria-live': 'polite' });
        var progress = E('progress', { max: '100', value: '0', 'aria-label': '固件下载进度' });
        var progressText = E('span', { 'class': 'np-hint' });
        var notes = E('pre', { 'class': 'swrt-release-notes' }, '检查更新后显示发布说明。');
        var releaseLink = E('a', { href: 'https://github.com/SlAlot/ImmortalWrt_Photonicat1/releases', target: '_blank', rel: 'noopener noreferrer' }, '查看 GitHub 发布');
        var keep = E('input', { type: 'checkbox' });
        var checkButton = E('button', { type: 'button', 'class': 'np-btn primary' }, '检查更新');
        var downloadButton = E('button', { type: 'button', 'class': 'np-btn', disabled: '' }, '下载并校验');
        var installButton = E('button', { type: 'button', 'class': 'np-btn primary', disabled: '' }, '确认升级');
        var backupButton = E('button', { type: 'button', 'class': 'np-btn' }, '下载配置备份');
        var root;

        function notifyError(err) {
            ui.addNotification(null, E('p', {}, String(err.message || err)), 'error');
        }
        function accept(result) {
            if (!result || result.ok !== true) throw new Error(result && result.message || '操作未成功，请重试');
            return result;
        }
        function bytes(value) { return (Math.max(0, Number(value) || 0) / 1048576).toFixed(1) + ' MiB'; }
        function update(data) {
            accept(data);
            latest = data;
            var state = data.state || {}, release = data.release || {};
            statusFailures = 0;
            if (state.phase === 'installing') installRequested = true;
            var busy = [ 'checking', 'downloading', 'verifying', 'preparing', 'installing' ].indexOf(state.phase) !== -1;
            current.textContent = data.current ? 'v' + data.current : '需要手动安装支持在线更新的固件';
            available.textContent = release.version ? 'v' + release.version : '待检查';
            filesystem.textContent = data.filesystem || '未识别';
            size.textContent = release.size ? bytes(release.size) : '—';
            filename.textContent = release.name || '检查后显示匹配的固件';
            digest.textContent = release.sha256 || '下载时获取并验证';
            notes.textContent = String(release.notes || '暂无发布说明。').slice(0, 24000);
            message.textContent = state.message || '';
            message.dataset.phase = state.phase || 'idle';
            checkButton.disabled = !writable || pending || busy;
            downloadButton.disabled = !writable || pending || !data.eligible || state.phase !== 'available';
            installButton.disabled = !writable || pending || !data.eligible || state.phase !== 'ready';
            keep.disabled = !writable || pending || busy;
            backupButton.disabled = !writable || busy;
            progress.hidden = state.phase !== 'downloading';
            var percent = release.size ? Math.min(100, 100 * data.downloaded_bytes / release.size) : 0;
            progress.value = percent;
            progressText.textContent = state.phase === 'downloading' ? bytes(data.downloaded_bytes) + ' / ' + bytes(release.size) + ' · ' + Math.floor(percent) + '%' : '';
            if (state.phase === 'failed') installRequested = false;
        }
        function refresh() { return statusCall().then(update); }
        function statusUnavailable(err) {
            latest = null;
            checkButton.disabled = downloadButton.disabled = installButton.disabled = true;
            statusFailures++;
            if (installRequested) {
                message.textContent = '设备连接暂时中断，正在等待升级和重启，请勿断电。';
                if (statusFailures >= 2 && !reconnecting) {
                    reconnecting = true;
                    ui.showModal('等待设备重新连接', [ E('p', { 'class': 'spinning' }, '升级请求已提交，设备连接已中断。请勿断电，正在等待重新连接。') ]);
                    ui.awaitReconnect(window.location.host, '192.168.17.1');
                }
            } else {
                message.textContent = '暂时无法获取任务状态：' + String(err.message || err);
            }
        }
        function perform(call) {
            if (pending) return Promise.resolve();
            pending = true;
            if (latest) update(latest);
            return call().then(accept).then(function() { return refresh().catch(statusUnavailable); })
                .catch(function(err) {
                    installRequested = false;
                    notifyError(err);
                    return refresh().catch(statusUnavailable);
                }).finally(function() {
                pending = false;
                if (latest) update(latest);
            });
        }
        checkButton.addEventListener('click', function() { perform(checkCall); });
        downloadButton.addEventListener('click', function() { perform(downloadCall); });
        backupButton.addEventListener('click', function() {
            var form = E('form', { method: 'post', action: L.env.cgi_base + '/cgi-backup' },
                E('input', { type: 'hidden', name: 'sessionid', value: rpc.getSessionID() }));
            root.appendChild(form);
            form.submit();
            form.remove();
        });
        installButton.addEventListener('click', function() {
            if (!latest || !latest.eligible || latest.state.phase !== 'ready' || pending) return;
            var release = latest.release, preserve = keep.checked;
            var acknowledged = E('input', { type: 'checkbox' });
            var confirm = E('button', { type: 'button', 'class': 'btn cbi-button-negative important', disabled: '' }, '开始刷写并重启');
            acknowledged.addEventListener('change', function() { confirm.disabled = !acknowledged.checked; });
            confirm.addEventListener('click', function() {
                if (!acknowledged.checked) return;
                confirm.disabled = true;
                installRequested = true;
                ui.hideModal();
                perform(function() { return installCall(preserve ? 1 : 0, release.sha256); });
            });
            ui.showModal('确认更新至 v' + release.version, [
                E('p', {}, release.name),
                E('p', {}, preserve ? '保留当前配置。旧配置可能覆盖新版默认设置。' : '不保留配置。完成后通过 192.168.17.1 重新设置密码、Wi-Fi 和拨号。'),
                E('p', {}, '刷写会中断网络，请勿断电。额外安装的软件包和容器数据需另行备份。'),
                E('label', { 'class': 'swrt-confirm-backup' }, [ acknowledged, ' 我已保存需要的配置和数据，确认现在升级。' ]),
                E('div', { 'class': 'right' }, [
                    E('button', { type: 'button', 'class': 'btn', click: ui.hideModal }, '取消'), ' ', confirm
                ])
            ]);
        });
        function field(label, value) {
            return E('div', { 'class': 'np-info-field' }, [ E('span', { 'class': 'np-info-label' }, label), value ]);
        }
        function card(title, content) {
            return E('section', { 'class': 'np-native-card' }, [
                E('div', { 'class': 'np-native-card-head' }, E('strong', {}, title)),
                E('div', { 'class': 'np-native-card-body' }, content)
            ]);
        }
        root = E('div', { id: 'swrt-upgrade', 'class': 'np-root' }, [
            E('link', { rel: 'stylesheet', href: L.resource('wlmb-server/panel.css?v=1.1.3') }),
            E('link', { rel: 'stylesheet', href: L.resource('swrt-upgrade.css?v=1.0.0') }),
            E('div', { 'class': 'np-page-heading' }, [
                E('div', {}, [ E('h2', { 'class': 'np-page-title' }, 'SWRT 在线更新'),
                    E('p', { 'class': 'np-page-description' }, '光影猫一代 · 从 SlAlot 的 GitHub 正式发布获取固件') ]),
                E('span', { 'class': 'np-chip' }, 'Photonicat 1')
            ]),
            E('div', { 'class': 'swrt-upgrade-grid' }, [
                card('固件版本', [
                    E('div', { 'class': 'np-info-grid' }, [ field('当前版本', current), field('最新正式版', available), field('系统类型', filesystem), field('固件大小', size) ]),
                    E('div', { 'class': 'swrt-file' }, [ field('匹配固件', filename), field('SHA256', digest) ]),
                    E('div', { 'class': 'np-actions' }, [ checkButton, downloadButton ])
                ]),
                card('升级准备', [
                    E('p', { 'class': 'np-desc' }, '先下载配置备份。下载固件不会自动刷写，全部校验通过后再确认升级。'),
                    E('div', { 'class': 'np-actions swrt-backup' }, [ backupButton,
                        E('a', { href: L.url('admin/system/flash') }, '手动备份与升级') ]),
                    E('label', { 'class': 'swrt-keep' }, [ keep, ' 保留当前配置（默认关闭）' ]),
                    E('p', { 'class': 'np-hint' }, '推荐不保留配置，以应用新版默认设置。在线更新保持当前 SquashFS / ext4 类型。'),
                    E('div', { 'class': 'np-actions' }, [ installButton ])
                ])
            ]),
            card('任务状态', [ message, progress, progressText ]),
            card('发布说明', [ notes, releaseLink ]),
            E('p', { 'class': 'np-footer' }, 'SWRT · SlAlot ｜ 界面复用 SlAlot 网络面板（wlmb-server）')
        ]);
        keep.checked = false;
        update(initial);
        poll.add(function() {
            if (polling || pending || !document.getElementById('swrt-upgrade')) return Promise.resolve();
            polling = true;
            return refresh().catch(statusUnavailable).finally(function() { polling = false; });
        }, 2);
        return root;
    }
});
