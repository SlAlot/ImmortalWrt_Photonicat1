'use strict';
'require baseclass';
'require ui';
'require poll';
'require apollo.ui as panel';

var glyphs = {
    wlmbstart:'home', overview:'chart', status:'chart', system:'settings', network:'neighbors',
    wireless:'wifi', interfaces:'neighbors', firewall:'shield', routing:'neighbors', routes:'neighbors',
    services:'apps', docker:'docker', containers:'docker', images:'docker', store:'store', vpn:'shield',
    nas:'disk', diskman:'disk', 'swrt-disk-keepalive':'disk', 'swrt-power':'battery',
    'swrt-upgrade':'upload', flash:'upload', reboot:'reboot', ttyd:'terminal',
    admin:'lock', logout:'logout', qmodem:'bands', 'qmodem-next':'bands', 'wlmb-server':'bands',
    log:'terminal', syslog:'terminal', processes:'cpu', 'cpu-perf':'cpu', dhcp:'neighbors'
};

return baseclass.extend({
    __init__: function() {
        var self = this;
        Promise.all([ui.menu.load(), panel.assets().catch(function() {})]).then(function(loaded) { self.render(loaded[0]); });
    },
    render: function(tree) {
        var path = L.env.dispatchpath || [], nav = document.getElementById('npt-navigation');
        var menuButton = document.getElementById('npt-menu-toggle'), closer = document.getElementById('npt-nav-close');
        var backdrop = document.getElementById('npt-backdrop'), main = document.getElementById('maincontent');
        var media = window.matchMedia('(max-width: 780px)'), focusBefore;
        if (!nav || !tree.children || !tree.children.admin) return;
        function show(open) {
            open = open && media.matches;
            document.body.classList.toggle('npt-menu-open', open);
            menuButton.setAttribute('aria-expanded', String(open));
            nav.inert = media.matches && !open;
            nav.setAttribute('aria-hidden', String(media.matches && !open));
            main.inert = open;
            if (open) { focusBefore = document.activeElement; closer.focus(); }
            else if (focusBefore) { focusBefore.focus(); focusBefore = null; }
        }
        menuButton.addEventListener('click', function() { show(!document.body.classList.contains('npt-menu-open')); });
        closer.addEventListener('click', function() { show(false); });
        backdrop.addEventListener('click', function() { show(false); });
        document.addEventListener('keydown', function(event) {
            if (!document.body.classList.contains('npt-menu-open')) return;
            if (event.key === 'Escape') { event.preventDefault(); show(false); }
            if (event.key === 'Tab') {
                var items = Array.from(nav.querySelectorAll('a[href],button')).filter(function(el) { return el.getClientRects().length; });
                var first = items[0], last = items[items.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
        });
        media.addEventListener('change', function() { show(false); }); show(false);
        var list = document.getElementById('npt-menu'), children = ui.menu.getChildren(tree.children.admin);
        children.forEach(function(child) {
            var sub = ui.menu.getChildren(child), prefix = 'admin/' + child.name;
            var active = path[0] === 'admin' && path[1] === child.name;
            var icon = glyphs[child.name] || 'apps';
            if (!sub.length) {
                list.appendChild(E('li', {}, E('a', { href:L.url(prefix), 'class':'npt-menu-link' + (active ? ' is-active' : ''),
                    'aria-current':active ? 'page' : null }, [panel.icon(icon), E('span', {}, _(child.title))])));
                return;
            }
            var submenu = E('ul', { 'class':'npt-submenu', id:'npt-group-' + child.name, hidden:!active });
            var toggle = E('button', { type:'button', 'class':'npt-menu-link npt-group-toggle' + (active ? ' is-current' : ''),
                'aria-expanded':String(active), 'aria-controls':submenu.id }, [panel.icon(icon), E('span', {}, _(child.title)), panel.icon('chevron')]);
            toggle.addEventListener('click', function() { var open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded', String(open)); submenu.hidden = !open; });
            sub.forEach(function(leaf) {
                var current = active && path[2] === leaf.name;
                submenu.appendChild(E('li', {}, E('a', { href:L.url(prefix,leaf.name), 'class':'npt-menu-link' + (current ? ' is-active' : ''),
                    'aria-current':current ? 'page' : null }, [panel.icon(glyphs[leaf.name] || icon), E('span', {}, _(leaf.title))])));
            });
            list.appendChild(E('li', { 'class':'npt-menu-group' }, [toggle, submenu]));
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
        if (container) tabs(current, url.join('/'), 0);
        var breadcrumb = document.getElementById('npt-page-title'), node = tree;
        path.forEach(function(key) { node = node && node.children && node.children[key]; if (node && node.title) breadcrumb.textContent = _(node.title); });
        var appearance = document.getElementById('npt-appearance');
        function applyAppearance(mode) {
            document.documentElement.dataset.theme = mode;
            appearance.setAttribute('aria-label', '切换外观，当前' + ({auto:'跟随系统',light:'浅色',dark:'深色'}[mode]));
            appearance.title = appearance.getAttribute('aria-label');
        }
        var mode = 'auto';
        try { mode = localStorage.getItem('network-panel-appearance') || 'auto'; } catch (e) {}
        if (!['auto','light','dark'].includes(mode)) mode = 'auto';
        applyAppearance(mode); appearance.replaceChildren(panel.icon('sun'));
        appearance.addEventListener('click', function() { mode = ['auto','light','dark'][(['auto','light','dark'].indexOf(mode)+1)%3]; applyAppearance(mode); try { localStorage.setItem('network-panel-appearance',mode); } catch(e) {} });
        var battery = document.getElementById('npt-battery');
        var powerPage = tree.children.admin.children.system && tree.children.admin.children.system.children && tree.children.admin.children.system.children['swrt-power'];
        if (battery && !powerPage) battery.removeAttribute('href');
        function paintBattery(data) {
            var b = panel.battery(data && data.system);
            battery.classList.toggle('is-low', b.available && b.percent <= 15);
            battery.classList.toggle('is-unknown', !b.available);
            battery.setAttribute('aria-label', b.label + (powerPage ? '，打开光影猫管理' : ''));
            battery.replaceChildren(panel.icon('battery', b.percent), E('span', {}, b.available ? b.percent + '%' : '—'));
            battery.title = b.label;
        }
        if (battery) poll.add(function() { return panel.status().then(paintBattery).catch(function() { paintBattery(null); }); }, 5);
    }
});
