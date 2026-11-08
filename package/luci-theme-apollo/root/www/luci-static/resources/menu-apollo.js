'use strict';
'require baseclass';
'require ui';
'require poll';
'require apollo.ui as panel';

var navigationIcons = {
    wlmbstart: 'panel/home.svg',
    status: 'panel/chart.svg',
    system: 'panel/settings.svg',
    modem: 'panel/cellular.svg',
    services: 'lucide/layers.svg',
    store: 'lucide/shopping-bag.svg',
    docker: 'tabler/brand-docker.svg',
    vpn: 'lucide/shield.svg',
    network: 'panel/neighbors.svg',
    nas: 'panel/database.svg',
    logout: 'panel/logout.svg'
};

function navigationIcon(name) {
    if (name === 'qmodem' || name === 'qmodem-next') name = 'modem';
    if (!Object.hasOwn(navigationIcons, name))
        return E('span', { 'class':'npt-menu-spacer', 'aria-hidden':'true' });

    var asset = navigationIcons[name];
    return E('span', {
        'class': 'npt-menu-symbol',
        'aria-hidden': 'true',
        'style': '--npt-glyph: url("' + L.env.media + '/icons/' + asset + '")'
    });
}

var deviceIcons = {
    ethernet: 'panel/cable.svg',
    port: 'panel/cable.svg',
    bridge: 'lucide/git-merge.svg',
    wifi: 'panel/wifi.svg',
    alias: 'lucide/link-2.svg',
    tunnel: 'lucide/arrow-left-right.svg',
    switch: 'lucide/network.svg',
    vlan: 'lucide/layers-2.svg',
    vrf: 'lucide/route.svg',
    wireguard: 'lucide/shield.svg',
    'signal-none': 'panel/wifi-off.svg',
    'signal-000-000': 'panel/signal-zero.svg',
    'signal-000-025': 'panel/signal-low.svg',
    'signal-025-050': 'panel/signal-medium.svg',
    'signal-050-075': 'panel/signal-high.svg',
    'signal-075-100': 'panel/signal-full.svg'
};

return baseclass.extend({
    __init__: function() {
        if (document.querySelector('input[name="luci_password"]')) { document.body.classList.add('npt-login'); return; }
        var self = this;
        var status = document.getElementById('npt-menu-status');
        this.bindDrawer();
        ui.menu.load().then(function(tree) {
            if (!tree || !tree.children || !tree.children.admin) throw new Error('Menu unavailable');
            self.render(tree);
            if (status) status.hidden = true;
        }).catch(function() {
            if (status) status.textContent = '菜单加载失败，请刷新页面重试。';
        });
    },
    bindDrawer: function() {
        var nav = document.getElementById('npt-navigation');
        var menuButton = document.getElementById('npt-menu-toggle'), closer = document.getElementById('npt-nav-close');
        var backdrop = document.getElementById('npt-backdrop'), main = document.getElementById('maincontent');
        var topbar = document.querySelector('.npt-topbar');
        var media = window.matchMedia('(max-width: 780px)');
        if (!nav || !menuButton || !closer || !backdrop || !main) return;
        closer.replaceChildren(panel.icon('close'));
        function show(open) {
            open = open && media.matches;
            var wasOpen = document.body.classList.contains('npt-menu-open');
            document.body.classList.toggle('npt-menu-open', open);
            menuButton.setAttribute('aria-expanded', String(open));
            if (open) {
                nav.inert = false;
                nav.setAttribute('aria-hidden', 'false');
                closer.focus();
            }
            main.inert = open;
            if (topbar) topbar.inert = open;
            if (!open) {
                if (wasOpen && media.matches) menuButton.focus();
                if (wasOpen && !media.matches) main.focus();
                nav.inert = media.matches;
                nav.setAttribute('aria-hidden', String(media.matches));
            }
        }
        menuButton.addEventListener('click', function() { show(!document.body.classList.contains('npt-menu-open')); });
        closer.addEventListener('click', function() { show(false); });
        backdrop.addEventListener('click', function() { show(false); });
        document.addEventListener('keydown', function(event) {
            if (!document.body.classList.contains('npt-menu-open')) return;
            if (event.key === 'Escape') { event.preventDefault(); show(false); }
            if (event.key === 'Tab') {
                var items = Array.from(nav.querySelectorAll('a[href],button')).filter(function(el) {
                    return !el.closest('[inert]') && el.getClientRects().length;
                });
                var first = items[0], last = items[items.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        });
        media.addEventListener('change', function() { show(false); }); show(false);
    },
    render: function(tree) {
        var path = L.env.dispatchpath || [];
        var list = document.getElementById('npt-menu');
        if (!list) return;
        var children = ui.menu.getChildren(tree.children.admin);
        list.replaceChildren();
        children.forEach(function(child) {
            var sub = ui.menu.getChildren(child), prefix = 'admin/' + child.name;
            var active = path[0] === 'admin' && path[1] === child.name;
            var mark = navigationIcon(child.name);
            if (!sub.length) {
                list.appendChild(E('li', {}, E('a', { href:L.url(prefix), 'class':'npt-menu-link' + (active ? ' is-active' : ''),
                    'aria-current':active ? 'page' : null }, [mark, E('span', {}, _(child.title))])));
                return;
            }
            var submenu = E('ul', { 'class':'npt-submenu' });
            var disclosure = E('div', {
                'class':'npt-disclosure',
                id:'npt-group-' + child.name,
                inert:active ? null : '',
                'aria-hidden':String(!active)
            }, submenu);
            var toggle = E('button', { type:'button', 'class':'npt-menu-link npt-group-toggle' + (active ? ' is-current' : ''),
                'aria-expanded':String(active), 'aria-controls':disclosure.id }, [mark, E('span', {}, _(child.title)), panel.icon('chevron')]);
            toggle.addEventListener('click', function() {
                var open = toggle.getAttribute('aria-expanded') !== 'true';
                toggle.setAttribute('aria-expanded', String(open));
                disclosure.toggleAttribute('inert', !open);
                disclosure.setAttribute('aria-hidden', String(!open));
            });
            sub.forEach(function(leaf) {
                var current = active && path[2] === leaf.name;
                submenu.appendChild(E('li', {}, E('a', { href:L.url(prefix,leaf.name), 'class':'npt-menu-link' + (current ? ' is-active' : ''),
                    'aria-current':current ? 'page' : null }, [E('span', {}, _(leaf.title))])));
            });
            list.appendChild(E('li', { 'class':'npt-menu-group' }, [toggle, disclosure]));
        });
        var current = tree;
        var url = [];
        for (var i = 0; i < Math.min(3, path.length); i++) { current = current && current.children && current.children[path[i]]; url.push(path[i]); }
        var container = document.getElementById('tabmenu');
        function tabs(node, base, depth) {
            var items = node && ui.menu.getChildren(node);
            if (!items || !items.length) return;
            var ul = E('ul', { 'class':'tabs', 'aria-label':'页面选项' });
            items.forEach(function(child) {
                var active = path[3 + depth] === child.name;
                ul.appendChild(E('li', { 'class':active ? 'active' : '' }, E('a', { href:L.url(base,child.name), 'aria-current':active ? 'page' : null }, _(child.title))));
                if (active) tabs(child, base + '/' + child.name, depth + 1);
            });
            container.prepend(ul);
        }
        if (container) { container.replaceChildren(); tabs(current, url.join('/'), 0); }
        var breadcrumb = document.getElementById('npt-page-title'), node = tree;
        path.forEach(function(key) { node = node && node.children && node.children[key]; if (node && node.title) breadcrumb.textContent = _(node.title); });
        // 只匹配 LuCI 的设备图标目录，避免替换插件自己的图片。
        var nativeImages = 'img[src*="/luci-static/resources/icons/"]';
        function deviceIcon(img) {
            var src = img.getAttribute('src') || '', match = src.match(/\/luci-static\/resources\/icons\/([^/?]+)\.svg(?:\?.*)?$/);
            if (!match) return;
            var name = match[1];
            var device = name.replace(/(?:_pse)?_(?:disabled|up|down)$/, '');
            if (!Object.hasOwn(deviceIcons, device)) return;

            var disabled = /_(disabled|down)$|^signal-none$/.test(name);
            var asset = device === 'wifi' && disabled ? deviceIcons['signal-none'] : deviceIcons[device];
            img.classList.add('npt-native-icon');
            img.classList.toggle('is-disabled', disabled);
            img.classList.toggle('is-wireless', device === 'wifi' || name.startsWith('signal-'));
            img.src = L.env.media + '/icons/' + asset;
        }
        document.querySelectorAll(nativeImages).forEach(deviceIcon);
        if (window.__apolloIconObserver) window.__apolloIconObserver.disconnect();
        window.__apolloIconObserver = new window.MutationObserver(function(records) {
            records.forEach(function(record) {
                if(record.type==='attributes') {
                    if(record.target.matches(nativeImages)) deviceIcon(record.target);
                    return;
                }
                record.addedNodes.forEach(function(node) {
                    if(node.nodeType!==1)return;
                    if(node.matches(nativeImages))deviceIcon(node);
                    else if(node.firstElementChild)node.querySelectorAll(nativeImages).forEach(deviceIcon);
                });
            });
        });
        window.__apolloIconObserver.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
        var appearance = document.getElementById('npt-appearance');
        var systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
        function updateDarkMode(mode) {
            document.documentElement.dataset.darkmode = String(mode === 'dark' || (mode === 'auto' && systemTheme.matches));
        }
        function applyAppearance(mode) {
            document.documentElement.dataset.theme = mode;
            updateDarkMode(mode);
            appearance.setAttribute('aria-label', '切换外观，当前' + ({auto:'跟随系统',light:'浅色',dark:'深色'}[mode]));
            appearance.title = appearance.getAttribute('aria-label');
            appearance.replaceChildren(panel.icon({auto:'autoTheme',light:'sun',dark:'moon'}[mode]));
        }
        var mode = 'auto';
        try { mode = localStorage.getItem('network-panel-appearance') || 'auto'; } catch (e) {}
        if (!['auto','light','dark'].includes(mode)) mode = 'auto';
        applyAppearance(mode);
        systemTheme.addEventListener('change', function() { updateDarkMode(mode); });
        appearance.addEventListener('click', function() { mode = ['auto','light','dark'][(['auto','light','dark'].indexOf(mode)+1)%3]; applyAppearance(mode); try { localStorage.setItem('network-panel-appearance',mode); } catch(e) {} });
        var battery = document.getElementById('npt-battery');
        var powerPage = tree.children.admin.children.system && tree.children.admin.children.system.children && tree.children.admin.children.system.children['swrt-power'];
        var panelPage = tree.children.admin.children.services && tree.children.admin.children.services.children && tree.children.admin.children.services.children['wlmb-server'];
        if (battery) battery.hidden = true;
        if (battery && powerPage) battery.href = L.url('admin/system/swrt-power');

        function paintBattery(b) {
            battery.hidden = !b;
            if (!b || battery.title === b.label) return;
            battery.classList.toggle('is-low', b.percent <= 15);
            battery.setAttribute('aria-label', b.label + (powerPage ? '，打开光影猫管理' : ''));
            battery.replaceChildren.apply(battery, panel.batteryBadge(b));
            battery.title = b.label;
        }
        if (battery && panelPage) {
            var lastHomeSample = -Infinity;
            if (path[1] === 'wlmbstart') {
                lastHomeSample = performance.now();
                // 首页已读取模组快照，顶栏复用同一份电量。旧版首页继续使用独立轮询。
                document.addEventListener('wlmbstart:battery', function(event) {
                    lastHomeSample = performance.now();
                    paintBattery(event.detail);
                });
            }
            poll.add(function() {
                if (!document.hidden && performance.now() - lastHomeSample >= 15000)
                    return panel.readBattery().then(paintBattery);
            }, 12);
        }
    }
});
