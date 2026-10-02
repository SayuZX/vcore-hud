(function () {
    'use strict';
    const P = window.HudPreferences;
    const dashboard = window.VeloxDashboard;
    const editor = window.HudElementEditor;
    const menu = document.getElementById('hud-menu');
    if (!P || !dashboard || !editor || !menu) return;
    const groups = {
        status: { label: 'Status pemain', selector: '#ring-status, .vitals-widget', anchor: 'bottom-left' },
        speedometer: { label: 'Speedometer', selector: '#new-speed, #vehicle-widget', anchor: 'bottom-right' },
        identity: { label: 'Identitas pemain', selector: '#identity-widget', anchor: 'top-right' },
        shortcuts: { label: 'Tombol cepat', selector: '#shortcut-widget', anchor: 'right-center' },
        mapTools: { label: 'Tombol minimap', selector: '.map-tabs', anchor: 'top-left' }
    };
    const primary = ['minimap', 'status', 'speedometer', 'identity', 'cash', 'bank', 'location', 'shortcuts'];
    const labels = { ...editor.labels, ...Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, value.label])) };
    const visibilityKeys = { status: 'showVitals', speedometer: 'showVehicle', identity: 'showIdentity', shortcuts: 'showShortcuts', cash: 'showCash', bank: 'showBank', location: 'showLocation', music: 'showMusic', voice: 'showVoice', mapTools: 'showMapTools' };
    const componentKeys = { vehicle: 'speedometer' };
    const styled = new Map();
    let selected = 'minimap';
    let lastMapMode = dashboard.getPreferences().mapMode === 'always' ? 'always' : 'vehicle';
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    function nodesFor(key) {
        const variants = { rpm: '#rpm-strip, #dial-rpm-arc, #dial-rpm-value, #foundation-rpm-arc, #open-rpm-arc', fuel: '#foundation-fuel-arc' };
        if (groups[key]) return Array.from(document.querySelectorAll(groups[key].selector));
        const nodes = editor.getNodes(key);
        return variants[key] ? [...new Set([...nodes, ...document.querySelectorAll(variants[key])])] : nodes;
    }
    const optionFor = (prefs, key) => ({ visible: true, scale: 1, ...prefs.elementOptions?.[key] });
    function enabled(prefs, key) {
        if (!optionFor(prefs, key).visible) return false;
        if (key === 'minimap') return prefs.mapMode !== 'off';
        if ((key === 'cash' || key === 'bank') && !prefs.showMoney) return false;
        return visibilityKeys[key] ? prefs[visibilityKeys[key]] : true;
    }
    function restoreStyles() {
        for (const [node, original] of styled) {
            for (const [property, value] of Object.entries(original)) {
                if (value) node.style.setProperty(property, value);
                else node.style.removeProperty(property);
            }
            node.classList.remove('widget-hidden', 'widget-scaled');
        }
        styled.clear();
    }
    function remember(node, group) {
        if (!styled.has(node)) {
            const original = { scale: node.style.getPropertyValue('scale') };
            if (group) original.translate = node.style.getPropertyValue('translate');
            styled.set(node, original);
        }
    }
    function render() {
        restoreStyles();
        const prefs = dashboard.getPreferences();
        const options = prefs.elementOptions || {};
        if (prefs.mapMode !== 'off') lastMapMode = prefs.mapMode;
        for (const key of [...Object.keys(groups), ...P.elementKeys]) {
            const option = options[key];
            if (!option) continue;
            for (const node of nodesFor(key)) {
                const group = groups[key];
                remember(node, !!group);
                node.classList.toggle('widget-hidden', option.visible === false);
                if (key === 'minimap' || !option.scale || option.scale === 1) continue;
                const before = group ? node.getBoundingClientRect() : null;
                node.style.scale = String(option.scale);
                node.classList.add('widget-scaled');
                if (!group || before.width === 0 || before.height === 0) continue;
                const after = node.getBoundingClientRect();
                const right = group.anchor.startsWith('right') || group.anchor.endsWith('right');
                const bottom = group.anchor.startsWith('bottom');
                const left = clamp(right ? before.right - after.width : before.left, 0, Math.max(0, innerWidth - after.width));
                const top = clamp(bottom ? before.bottom - after.height : group.anchor === 'right-center' ? before.top + (before.height - after.height) / 2 : before.top, 0, Math.max(0, innerHeight - after.height));
                const parentScale = node.parentElement.closest('.radar-widget') ? P.scale(innerWidth, innerHeight, prefs) : 1;
                node.style.translate = `${(left - after.left) / parentScale}px ${(top - after.top) / parentScale}px`;
            }
        }
    }
    function update(key, changes) {
        if (!P.optionKeys.includes(key)) return;
        const prefs = dashboard.getPreferences();
        const elementOptions = { ...prefs.elementOptions, [key]: { ...prefs.elementOptions[key], ...changes } };
        const patch = { elementOptions };
        if (typeof changes.visible === 'boolean') {
            if (key === 'minimap') patch.mapMode = changes.visible ? lastMapMode : 'off';
            else if (visibilityKeys[key]) patch[visibilityKeys[key]] = changes.visible;
            if ((key === 'cash' || key === 'bank') && changes.visible) {
                const other = key === 'cash' ? 'showBank' : 'showCash';
                patch.showMoney = true;
                patch[other] = prefs.showMoney && prefs[other];
            }
        }
        if (key === 'minimap' && changes.scale !== undefined) {
            patch.elementPositions = { ...prefs.elementPositions, ...editor.snapshot() };
        }
        dashboard.applyPreferences(patch, true);
        editor.refresh();
        sync();
    }
    function reset(key) {
        const prefs = dashboard.getPreferences();
        const elementOptions = { ...prefs.elementOptions };
        delete elementOptions[key];
        dashboard.applyPreferences({ elementOptions }, true);
        editor.refresh();
        sync();
    }
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.dataset.tab = 'widgets';
    tab.title = 'Atur widget';
    tab.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5M8 12h8m-4-4v8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Widget</span>';
    menu.querySelector('[data-tab="instruments"]').before(tab);
    const panel = document.createElement('section');
    panel.dataset.page = 'widgets';
    panel.hidden = true;
    panel.innerHTML = '<div class="components-heading"><div><h2>Atur widget</h2><p>Pilih widget, lalu atur ukuran dan tampilannya.</p></div></div><label class="setting widget-selector"><span>Widget atau ikon</span><select id="widget-picker" aria-label="Pilih widget atau ikon"></select></label><div class="widget-inspector"><header><div><h3 id="widget-name"></h3><p id="widget-state"></p></div><label class="liquid-switch"><input id="widget-visible" type="checkbox" role="switch" aria-label="Tampilkan widget"><span class="switch-track" aria-hidden="true"></span></label></header><label class="widget-size-heading" for="widget-scale">Ukuran <output id="widget-scale-output">100%</output></label><input id="widget-scale" type="range" min="50" max="200" step="5" aria-label="Ukuran widget"><div class="widget-size-labels"><span>Kecil · 50%</span><span>Besar · 200%</span></div><div class="widget-size-actions"><label><input id="widget-scale-number" type="number" min="50" max="200" step="5" aria-label="Ukuran widget dalam persen"><span>%</span></label><button id="widget-size-reset" type="button">Reset ukuran</button></div></div><div class="widget-quick-list" aria-label="Pilih widget utama"></div><div class="widget-controls-footer"><span>Pengaturan tersimpan bersama preset HUD.</span></div>';
    menu.querySelector('.menu-content').append(panel);
    const picker = panel.querySelector('#widget-picker');
    for (const [title, keys] of [['Widget utama', [...primary, 'music', 'voice', 'mapTools']], ['Ikon', P.elementKeys.filter(key => !primary.includes(key) && key !== 'music' && key !== 'voice')]]) {
        const group = document.createElement('optgroup');
        group.label = title;
        for (const key of keys) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = labels[key];
            group.append(option);
        }
        picker.append(group);
    }
    for (const key of primary) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.widgetChoice = key;
        button.textContent = labels[key];
        button.addEventListener('click', () => { selected = key; sync(); });
        panel.querySelector('.widget-quick-list').append(button);
    }
    for (const card of menu.querySelectorAll('[data-component]')) {
        const key = componentKeys[card.dataset.component] || card.dataset.component;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'component-size-button';
        button.dataset.widgetSize = key;
        button.setAttribute('aria-label', 'Ubah ukuran ' + labels[key].toLowerCase());
        button.addEventListener('click', () => { selected = key; tab.click(); sync(); });
        card.querySelector('header .liquid-switch').before(button);
    }
    const editorControls = document.createElement('div');
    editorControls.className = 'element-appearance-controls';
    editorControls.innerHTML = '<label class="element-visibility-control"><input id="element-visible" type="checkbox">Tampilkan widget</label><label class="element-size-control">Ukuran <input id="element-scale" type="range" min="50" max="200" step="5" aria-label="Ukuran widget pilihan"><output id="element-scale-output">100%</output></label><button id="element-size-reset" type="button">Reset ukuran</button>';
    document.querySelector('.element-keyboard-help').before(editorControls);
    function syncEditor() {
        const key = editor.getSelected();
        const prefs = dashboard.getPreferences();
        const option = optionFor(prefs, key);
        editorControls.querySelectorAll('input,button').forEach(control => { control.disabled = !key; });
        document.getElementById('element-visible').checked = !!key && enabled(prefs, key);
        document.getElementById('element-scale').value = Math.round(option.scale * 100);
        document.getElementById('element-scale-output').textContent = Math.round(option.scale * 100) + '%';
    }
    function sync() {
        const prefs = dashboard.getPreferences();
        const option = optionFor(prefs, selected);
        picker.value = selected;
        document.getElementById('widget-name').textContent = labels[selected];
        document.getElementById('widget-state').textContent = enabled(prefs, selected) ? 'Tampil saat digunakan' : 'Disembunyikan';
        document.getElementById('widget-visible').checked = enabled(prefs, selected);
        document.getElementById('widget-scale').value = Math.round(option.scale * 100);
        document.getElementById('widget-scale-number').value = Math.round(option.scale * 100);
        document.getElementById('widget-scale-output').textContent = Math.round(option.scale * 100) + '%';
        menu.querySelectorAll('[data-widget-size]').forEach(button => { button.textContent = Math.round(optionFor(prefs, button.dataset.widgetSize).scale * 100) + '%'; });
        panel.querySelectorAll('[data-widget-choice]').forEach(button => { button.classList.toggle('selected', button.dataset.widgetChoice === selected); });
        syncEditor();
    }
    picker.addEventListener('change', () => { selected = picker.value; sync(); });
    document.getElementById('widget-visible').addEventListener('input', event => update(selected, { visible: event.target.checked }));
    document.getElementById('widget-scale').addEventListener('input', event => update(selected, { scale: Number(event.target.value) / 100 }));
    document.getElementById('widget-scale-number').addEventListener('input', event => {
        const value = event.target.valueAsNumber;
        if (Number.isFinite(value) && value >= 50 && value <= 200) update(selected, { scale: value / 100 });
    });
    document.getElementById('widget-scale-number').addEventListener('change', event => {
        const value = event.target.valueAsNumber;
        if (Number.isFinite(value)) update(selected, { scale: clamp(value, 50, 200) / 100 });
        else sync();
    });
    document.getElementById('widget-size-reset').addEventListener('click', () => update(selected, { scale: 1 }));
    document.getElementById('element-visible').addEventListener('input', event => update(editor.getSelected(), { visible: event.target.checked }));
    document.getElementById('element-scale').addEventListener('input', event => update(editor.getSelected(), { scale: Number(event.target.value) / 100 }));
    document.getElementById('element-size-reset').addEventListener('click', () => update(editor.getSelected(), { scale: 1 }));
    window.addEventListener('velox:render', render);
    window.addEventListener('velox:preferences', () => { render(); sync(); });
    window.addEventListener('resize', render);
    window.addEventListener('hud:elementSelected', syncEditor);
    window.addEventListener('pagehide', restoreStyles);
    window.HudWidgetControls = Object.freeze({ update, reset, render, enabled });
    render();
    editor.refresh();
    sync();
})();
