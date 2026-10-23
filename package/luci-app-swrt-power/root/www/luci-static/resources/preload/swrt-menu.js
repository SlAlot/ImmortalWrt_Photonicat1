'use strict';
'require baseclass';
'require ui';
'require session';

return baseclass.extend({
    __init__: function() {
        var title = '光影猫管理', target = L.url('admin/system/swrt-power');
        ui.menu.load().then(function(tree) {
            var children = tree.children || {};
            var system = children.admin && children.admin.children ? children.admin.children.system : children.system;
            var node = system && system.children && system.children['swrt-power'];
            if (node && node.title !== title) {
                node.title = title;
                session.setLocalData('menu', tree);
            }
            var sidebar = document.querySelector('.main-left') || document.querySelector('nav') || document.body;
            var observer;
            function rename() {
                var found = false;
                sidebar.querySelectorAll('a[href]').forEach(function(link) {
                    if (new URL(link.href, window.location.href).pathname.replace(/\/+$/, '') !== target.replace(/\/+$/, '')) return;
                    var walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT), text;
                    while ((text = walker.nextNode())) text.nodeValue = text.nodeValue.replace('光影猫一代管理', title);
                    found = true;
                });
                if (found && observer) observer.disconnect();
                return found;
            }
            if (!rename()) {
                observer = new MutationObserver(rename);
                observer.observe(sidebar, { childList: true, subtree: true });
            }
        }).catch(function() {});
    }
});
