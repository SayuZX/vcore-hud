(function () {
    'use strict';
    const menu = document.getElementById('hud-menu'), dashboard = window.VeloxDashboard;
    if (!menu || !dashboard)
        return;
    menu.classList.add('liquid-settings');
    const appearance = menu.querySelector('[data-page="appearance"]'), general = menu.querySelector('[data-page="instruments"]');
    const field = key => menu.querySelector(`[data-pref="${key}"]`).closest('label');
    const retained = { statusStyle: field('statusStyle'), speedStyle: field('speedStyle'), unit: field('unit'), theme: field('theme'), accent: field('accent'), scale: field('scale'), mapMode: field('mapMode'), blur: menu.querySelector('[data-pref="blur"]').closest('label'), edit: document.getElementById('edit-layout'), preset: menu.querySelector('.preset-text') };
    Object.values(retained).forEach(el => el.remove());
    const svg = body => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
    const icons = {
        minimap: svg('<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'),
        status: svg('<path d="M12 20S3 14.5 3 8.5C3 3.5 9 2 12 6c3-4 9-2.5 9 2.5 0 6-9 11.5-9 11.5Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m3 11 5 0 2-3 3 7 2-4h6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'),
        vehicle: svg('<path d="M4 19a10 10 0 1 1 16 0M5 15l2-1m0-6 2 2m3-5v3m5 0-2 2m5 5-3-1M12 16l4-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="16" r="2"/>'),
        identity: svg('<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 22v-2a8 8 0 0 1 16 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
        money: svg('<rect x="2" y="5" width="20" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 9h1m12 6h1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
        shortcuts: svg('<rect x="3" y="3" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="3" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="14" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="14" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
        general: svg('<path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>')
    };
    icons.cash = icons.money;
    icons.bank = icons.money;
    icons.location = svg('<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="10" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/>');
    const toggle = (key, label, component = false) => `<label class="liquid-switch"><input type="checkbox" role="switch" ${component ? 'data-component-toggle' : 'data-setting'}="${key}" aria-label="${label}"><span class="switch-track" aria-hidden="true"></span></label>`;
    const select = (key, label, options) => `<label class="setting"><span>${label}</span><select data-setting="${key}" aria-label="${label}">${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></label>`;
    const shapeOptions = [['pill', 'Kapsul'], ['rounded', 'Sudut membulat'], ['square', 'Kotak']];
    const previews = {
        minimap: '<div class="sample-map"><i></i><span></span></div>',
        status: '<div class="sample-status"><i>♥</i><i>◆</i><i>●</i><i>ϟ</i></div>',
        vehicle: '<div class="sample-speed"><i></i><strong>72</strong><span>MPH</span></div>',
        identity: '<div class="sample-identity"><i></i><span><b></b><small></small></span></div>',
        money: '<div class="sample-money"><span>$</span><i></i><b>12,500</b></div>',
        shortcuts: '<div class="sample-shortcuts"><i>▦</i><i>⌖</i><i>✦</i></div>'
    };
    previews.cash = previews.money;
    previews.bank = previews.money;
    previews.location = '<div class="sample-location"><b>⌖</b><span>Alta Street<small>La Puerta</small></span></div>';
    const components = [
        { id: 'minimap', label: 'Minimap', description: 'Peta GTA V', toggle: 'minimap', control: '<div class="shape-segments" role="group" aria-label="Minimap shape"><button type="button" data-shape-choice="rectangle" aria-pressed="false"><i class="shape-rectangle"></i>Kotak</button><button type="button" data-shape-choice="circle" aria-pressed="false"><i class="shape-circle"></i>Lingkaran</button></div>', extra: '<div data-field-slot="mapMode"></div>' },
        { id: 'status', label: 'Status pemain', description: 'Kesehatan, armor & kebutuhan', toggle: 'showVitals', control: '<div data-field-slot="statusStyle"></div>', extra: select('statusPlacement', 'Posisi status', [['standalone', 'Terpisah'], ['attached', 'Menempel di minimap']]) + '<span id="status-placement-note" class="component-note" hidden></span>' },
        { id: 'vehicle', label: 'Speedometer', description: 'Kecepatan & kondisi kendaraan', toggle: 'showVehicle', control: '<div data-field-slot="speedStyle"></div>', extra: '<div class="component-background"><span>Latar speedometer</span>' + toggle('speedBackground', 'Tampilkan latar speedometer') + '</div>' },
        { id: 'identity', label: 'Identitas pemain', description: 'Server, nama & ID', toggle: 'showIdentity', control: select('identityShape', 'Bentuk identitas', shapeOptions), extra: '' },
        { id: 'cash', label: 'Uang tunai', description: 'Uang yang kamu bawa', toggle: 'showCash', control: select('cashShape', 'Bentuk uang tunai', shapeOptions), extra: '' },
        { id: 'bank', label: 'Bank', description: 'Saldo rekening', toggle: 'showBank', control: select('bankShape', 'Bentuk saldo bank', shapeOptions), extra: '' },
        { id: 'location', label: 'Lokasi pemain', description: 'Jalan, area & arah', toggle: 'showLocation', control: '<span class="component-location-note">Tetap tampil tanpa minimap</span>', extra: '' },
        { id: 'shortcuts', label: 'Tombol cepat', description: 'Telepon, tas, musik & HUD', toggle: 'showShortcuts', control: select('shortcutShape', 'Bentuk tombol', [['circle', 'Lingkaran'], ['rounded', 'Sudut membulat'], ['square', 'Kotak']]), extra: '' }
    ];
    appearance.innerHTML = `<div class="components-heading"><div><h2>Bagian HUD</h2><p>Pilih bentuk dan bagian HUD yang ingin ditampilkan.</p></div><span id="component-count" class="component-count"></span></div><div class="component-grid">${components.map(c => `<article class="component-card" data-component="${c.id}"><header><span class="component-icon">${icons[c.id]}</span><div><h3>${c.label}</h3><p>${c.description}</p></div>${toggle(c.toggle, 'Tampilkan ' + c.label.toLowerCase(), true)}</header><div class="component-options"><div class="component-preview" aria-hidden="true">${previews[c.id]}</div><div class="component-shape">${c.control}</div></div><div class="component-extra">${c.extra}</div></article>`).join('')}</div><section class="component-details"><h3>Informasi tambahan</h3><div class="detail-switches">${[['showMusic', 'Musik'], ['showMapTools', 'Tombol minimap'], ['showVoice', 'Indikator mikrofon']].map(([key, label]) => `<div><span>${label}</span>${toggle(key, 'Tampilkan ' + label.toLowerCase())}</div>`).join('')}</div></section>`;
    for (const key of ['statusStyle', 'speedStyle', 'mapMode'])
        appearance.querySelector(`[data-field-slot="${key}"]`).append(retained[key]);
    retained.statusStyle.querySelector('span').textContent = 'Bentuk status';
    retained.statusStyle.querySelector('select').setAttribute('aria-label', 'Bentuk status');
    retained.speedStyle.querySelector('span').textContent = 'Model speedometer';
    retained.speedStyle.querySelector('select').setAttribute('aria-label', 'Model speedometer');
    const speedNames = { arc: 'Busur', split: 'Terpisah', ribbon: 'Bar balap', numeric: 'Angka saja', outline: 'Dial tipis', rail: 'Bar vertikal', auto: 'Otomatis', minimal: 'Lingkaran', bar: 'Bar', digital: 'Digital', dial: 'Analog', velox: 'Klasik', drift: 'Drift', moto: 'Motor', boat: 'Kapal', plane: 'Pesawat', heli: 'Helikopter' };
    for (const option of retained.speedStyle.querySelectorAll('option'))
        option.textContent = speedNames[option.value] || option.textContent;
    retained.mapMode.querySelector('span').textContent = 'Tampilkan minimap';
    retained.mapMode.querySelector('select').setAttribute('aria-label', 'Tampilkan minimap');
    retained.mapMode.querySelector('option[value="off"]').remove();
    general.innerHTML = '<div class="components-heading"><div><h2>Tampilan</h2><p>Atur tema, warna dan ukuran HUD.</p></div></div><div class="settings-grid global-settings"></div><div class="global-blur"></div>';
    for (const key of ['theme', 'accent', 'scale', 'unit'])
        general.querySelector('.global-settings').append(retained[key]);
    retained.blur.classList.add('glass-option');
    general.querySelector('.global-blur').append(retained.blur);
    retained.edit.innerHTML = 'Pindahkan widget <kbd aria-hidden="true">M</kbd>';
    retained.edit.setAttribute('aria-label', 'Pindahkan widget');
    retained.edit.setAttribute('aria-keyshortcuts', 'M');
    menu.querySelector('.menu-header').insertBefore(retained.edit, document.getElementById('menu-close'));
    general.append(retained.preset);
    const extraShapes = [['arc', 'Busur'], ['split', 'Terpisah'], ['ribbon', 'Bar balap'], ['numeric', 'Angka saja'], ['outline', 'Dial tipis'], ['rail', 'Bar vertikal']];
    const collection = document.createElement('details');
    collection.className = 'instrument-collection';
    collection.innerHTML = '<summary><span>Model speedometer lainnya</span><small>6 model tanpa latar</small></summary><div class="instrument-gallery">' + extraShapes.map(([key, label]) => `<button type="button" data-instrument-choice="${key}" aria-label="Use ${label}" aria-pressed="false"><span class="instrument-thumbnail" data-instrument="${key}" aria-hidden="true"><i></i><b>72</b><small>MPH</small><em>4</em></span><span>${label}</span></button>`).join('') + '</div>';
    appearance.querySelector('.component-grid').after(collection);
    collection.addEventListener('click', event => { const button = event.target.closest('[data-instrument-choice]'); if (button)
        dashboard.applyPreferences({ speedStyle: button.dataset.instrumentChoice }, true); });
    const navNames = { appearance: 'HUD', instruments: 'Tampilan', vehicle: 'Kendaraan', music: 'Musik', voice: 'Suara & kamera' };
    const navIcons = { appearance: icons.shortcuts, instruments: icons.general, vehicle: icons.vehicle, music: svg('<path d="M9 18V5l11-3v13M9 9l11-3" fill="none" stroke="currentColor" stroke-width="1.6"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="15" rx="3" ry="2"/>'), voice: svg('<use href="#voice"/>') };
    menu.querySelectorAll('.menu-nav [data-tab]').forEach(button => { button.innerHTML = navIcons[button.dataset.tab] + `<span>${navNames[button.dataset.tab]}</span>`; button.setAttribute('title', navNames[button.dataset.tab]); });
    const brand = menu.querySelector('.menu-header>div');
    brand.innerHTML = `<div class="settings-brand-mark">${icons.general}</div><div><h1>VCORE HUD</h1></div>`;
    const footer = menu.querySelector('.menu-footer');
    footer.querySelector('#reset-settings').textContent = 'Reset HUD';
    footer.querySelector('#save-close').textContent = 'Simpan & tutup';
    let lastMapMode = dashboard.getPreferences().mapMode === 'always' ? 'always' : 'vehicle';
    menu.addEventListener('input', event => {
        const input = event.target;
        const visibility = { minimap: 'minimap', showVitals: 'status', showVehicle: 'speedometer', showIdentity: 'identity', showCash: 'cash', showBank: 'bank', showLocation: 'location', showShortcuts: 'shortcuts', showMusic: 'music', showVoice: 'voice', showMapTools: 'mapTools' };
        const visibilityKey = input.dataset.componentToggle || input.dataset.setting;
        if (window.HudWidgetControls && visibility[visibilityKey]) {
            window.HudWidgetControls.update(visibility[visibilityKey], { visible: input.checked });
            return;
        }
        if (input.dataset.componentToggle) {
            const key = input.dataset.componentToggle;
            if (key === 'minimap') {
                const current = dashboard.getPreferences();
                if (current.mapMode !== 'off')
                    lastMapMode = current.mapMode;
                dashboard.applyPreferences({ mapMode: input.checked ? lastMapMode : 'off' }, true);
            }
            else if (key === 'showCash' || key === 'showBank') {
                const current = dashboard.getPreferences(), sibling = key === 'showCash' ? 'showBank' : 'showCash';
                dashboard.applyPreferences({ [key]: input.checked, ...(input.checked ? { showMoney: true, [sibling]: current.showMoney && current[sibling] } : {}) }, true);
            }
            else
                dashboard.applyPreferences({ [key]: input.checked }, true);
        }
        if (input.dataset.setting)
            dashboard.applyPreferences({ [input.dataset.setting]: input.type === 'checkbox' ? input.checked : input.value }, true);
    });
    appearance.addEventListener('click', event => { const button = event.target.closest('[data-shape-choice]'); if (button)
        dashboard.applyPreferences({ layout: button.dataset.shapeChoice }, true); });
    function sync() {
        const prefs = dashboard.getPreferences();
        if (prefs.mapMode !== 'off')
            lastMapMode = prefs.mapMode;
        let count = 0;
        for (const component of components) {
            const card = appearance.querySelector(`[data-component="${component.id}"]`), enabled = window.HudWidgetControls ? window.HudWidgetControls.enabled(prefs, component.id === 'vehicle' ? 'speedometer' : component.id) : component.toggle === 'minimap' ? prefs.mapMode !== 'off' : (component.id === 'cash' || component.id === 'bank') ? prefs.showMoney && prefs[component.toggle] : prefs[component.toggle];
            card.classList.toggle('component-disabled', !enabled);
            card.querySelector('[data-component-toggle]').checked = enabled;
            card.querySelectorAll('.component-shape button,.component-shape select,.component-extra select,.component-extra [data-setting="speedBackground"]').forEach(control => control.disabled = !enabled);
            if (enabled)
                count++;
        }
        document.getElementById('component-count').textContent = `${count}/${components.length} aktif`;
        menu.querySelectorAll('[data-setting]').forEach(input => { if (input.type === 'checkbox')
            input.checked = prefs[input.dataset.setting];
        else
            input.value = prefs[input.dataset.setting]; });
        retained.mapMode.querySelector('select').value = prefs.mapMode === 'off' ? lastMapMode : prefs.mapMode;
        appearance.querySelectorAll('[data-shape-choice]').forEach(button => { const selected = button.dataset.shapeChoice === prefs.layout; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); });
        const placement = menu.querySelector('[data-setting="statusPlacement"]'), canAttach = prefs.statusStyle === 'rings' || (prefs.statusStyle === 'percentage' && prefs.layout === 'rectangle');
        placement.disabled = !prefs.showVitals || !canAttach;
        const placementNote = document.getElementById('status-placement-note');
        placementNote.hidden = canAttach;
        placementNote.textContent = prefs.statusStyle === 'percentage' ? 'Status angka tetap terpisah pada minimap lingkaran.' : 'Model ini memakai widget terpisah.';
        placement.title = canAttach ? '' : placementNote.textContent;
        collection.querySelectorAll('[data-instrument-choice]').forEach(button => { const active = button.dataset.instrumentChoice === prefs.speedStyle; button.setAttribute('aria-pressed', String(active)); button.classList.toggle('selected', active); button.disabled = !prefs.showVehicle; });
        for (const [component, key] of [['minimap', 'layout'], ['status', 'statusStyle'], ['vehicle', 'speedStyle'], ['identity', 'identityShape'], ['cash', 'cashShape'], ['bank', 'bankShape'], ['shortcuts', 'shortcutShape']])
            appearance.querySelector(`[data-component="${component}"] .component-preview`).dataset.sample = prefs[key];
        for (const key of ['showMusic', 'showMapTools'])
            menu.querySelector(`[data-setting="${key}"]`).disabled = prefs.mapMode === 'off';
    }
    window.addEventListener('velox:preferences', sync);
    new MutationObserver(() => { if (!menu.hidden)
        sync(); }).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
    sync();
})();
