(function () {
    'use strict';
    const hud = document.getElementById('hud');
    const dashboard = window.VeloxDashboard;
    const P = window.HudPreferences;
    if (!hud || !dashboard || !P || window.HudStandaloneWidgets)
        return;
    const balances = [
        { key: 'cash', preference: 'showCash', top: 148, label: 'Cash balance' },
        { key: 'bank', preference: 'showBank', top: 208, label: 'Bank balance' }
    ].map(item => {
        const node = document.querySelector('#money-cards .' + item.key);
        if (!node)
            return null;
        node.id = item.key + '-widget';
        node.classList.add('standalone-money');
        node.setAttribute('aria-label', item.label);
        hud.append(node);
        return { ...item, node };
    }).filter(Boolean);
    document.getElementById('money-cards')?.remove();
    const location = document.querySelector('.location-row');
    const compass = document.getElementById('compass-letter');
    location.id = 'location-widget';
    location.classList.add('standalone-location');
    location.setAttribute('aria-label', 'Player location');
    compass.classList.add('standalone-compass');
    compass.setAttribute('aria-label', 'Compass heading');
    hud.append(location, compass);
    const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
    function place(node, left, top, width, height, scale) {
        node.style.left = clamp(left, 0, Math.max(0, innerWidth - width * scale)) + 'px';
        node.style.top = clamp(top, 0, Math.max(0, innerHeight - height * scale)) + 'px';
        node.style.transform = `scale(${scale})`;
        node.style.transformOrigin = 'top left';
    }
    function render() {
        const prefs = dashboard.getPreferences();
        const scale = P.scale(innerWidth, innerHeight, prefs);
        for (const item of balances) {
            item.node.hidden = !prefs.showMoney || prefs[item.preference] === false;
            place(item.node, innerWidth - 270 * scale, item.top * scale, 236, 48, scale);
        }
        const anchorPrefs = P.normalize({ layout: prefs.layout, scale: prefs.scale, statusStyle: 'rings', statusPlacement: 'standalone' });
        const anchor = P.radar(innerWidth, innerHeight, anchorPrefs);
        const circle = prefs.layout === 'circle';
        location.hidden = !prefs.showLocation;
        compass.hidden = !prefs.showLocation;
        place(location, anchor.widgetLeft + (circle ? 336 : 0) * scale, anchor.widgetTop + (circle ? 104 : 66) * scale, circle ? 104 : 360, circle ? 105 : 48, scale);
        place(compass, anchor.widgetLeft + (circle ? 143 : 2) * scale, anchor.widgetTop + (circle ? 20 : 68) * scale, circle ? 46 : 44, circle ? 24 : 44, scale);
    }
    window.addEventListener('velox:render', render);
    window.addEventListener('velox:preferences', render);
    window.addEventListener('resize', render);
    window.HudStandaloneWidgets = Object.freeze({ refresh: render });
    render();
})();
