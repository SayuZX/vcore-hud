(function () {
    'use strict';
    const dashboard = window.VeloxDashboard;
    const P = window.HudPreferences;
    const root = document.documentElement;
    const hud = document.getElementById('hud');
    if (!dashboard || !P || !hud || window.HudElementEditor)
        return;
    const query = selector => Array.from(document.querySelectorAll(selector));
    const labels = {
        status: 'Status pemain', speedometer: 'Speedometer', identity: 'Identitas pemain', shortcuts: 'Tombol cepat',
        minimap: 'Minimap', music: 'Musik', location: 'Lokasi', clock: 'Jam', weather: 'Cuaca', compass: 'Kompas',
        mapVehicle: 'Kontrol kendaraan', mapMusic: 'Tombol musik minimap', mapVoice: 'Tombol suara minimap', mapSettings: 'Tombol HUD minimap',
        radio: 'Pintasan musik', cursor: 'Pintasan HUD', voice: 'Indikator mikrofon', brandMark: 'Logo server', brand: 'Nama server', player: 'Nama & ID pemain', date: 'Tanggal', cash: 'Uang tunai', bank: 'Bank',
        health: 'Kesehatan', armor: 'Armor', hunger: 'Lapar', thirst: 'Haus', stress: 'Stres', stamina: 'Stamina / oksigen',
        speedFace: 'Dial speedometer', speedReadout: 'Angka kecepatan', gear: 'Gigi', fuel: 'Bahan bakar', rpm: 'RPM', lights: 'Lampu kendaraan', belt: 'Sabuk pengaman', lock: 'Kunci kendaraan', cruise: 'Cruise control', signals: 'Lampu sein', nitro: 'Nitro', driveMode: 'Mode berkendara', vehicleClass: 'Jenis kendaraan', aerialValues: 'Indikator penerbangan',
        phone: 'Tombol telepon', inventory: 'Tombol inventori', musicShortcut: 'Musik', settings: 'Tombol HUD'
    };
    const selectors = {
        music: '.music-mini', location: '.location-row', clock: '#world-clock', weather: '#weather-icon', compass: '#compass-letter',
        mapVehicle: '.map-tabs [data-open="vehicle"]', mapMusic: '.map-tabs [data-open="music"]', mapVoice: '.map-tabs [data-open="voice"]', mapSettings: '.map-tabs [data-open="appearance"]',
        radio: '.radio-orbit', cursor: '.cursor-orbit', voice: '.voice-orbit, #ring-status .ring-voice, #voice-display, #component-voice',
        brandMark: '.foundation-server-mark', brand: '.foundation-brand-pill', player: '.name-chip', date: '#date-chip', cash: '#cash-widget', bank: '#bank-widget',
        speedFace: '#analog-scale, #open-speed-arc, .foundation-speed-arcs, #new-speed .tachometer, #vehicle-widget .dial-art',
        speedReadout: '#new-speed .new-speed-value, #vehicle-widget #speed', gear: '#new-gear, #vehicle-widget .gear', fuel: '#new-speed .fuel-mini, #vehicle-widget .fuel-dial',
        rpm: '#rpm-strip', lights: '#new-lights, #lights-display', belt: '#new-belt, #seatbelt-display', lock: '#new-lock, #locked-display', cruise: '#new-cruise', signals: '#new-signals', nitro: '.nitro-track', driveMode: '#drive-mode', vehicleClass: '#speed-class', aerialValues: '.aerial-values',
        phone: '#shortcut-widget [data-command="open phone"]', inventory: '#shortcut-widget [data-command="open inventory"]', musicShortcut: '#shortcut-widget [data-open="music"]', settings: '#shortcut-widget [data-open="appearance"]'
    };
    for (const key of ['health', 'armor', 'hunger', 'thirst', 'stress', 'stamina'])
        selectors[key] = `#ring-status [data-stat="${key}"], #${key}-display`;
    const groupSelectors = { status: '#ring-status, .vitals-widget', speedometer: '#new-speed, #vehicle-widget', identity: '#identity-widget', shortcuts: '#shortcut-widget' };
    const groupMembers = Object.freeze({
        minimap: ['minimap', 'mapVehicle', 'mapMusic', 'mapVoice', 'mapSettings', 'radio', 'cursor'],
        music: ['music'], location: ['location', 'clock', 'weather', 'compass'], cash: ['cash'], bank: ['bank'],
        status: ['health', 'armor', 'hunger', 'thirst', 'stress', 'stamina'],
        speedometer: ['speedFace', 'speedReadout', 'gear', 'fuel', 'rpm', 'lights', 'belt', 'lock', 'cruise', 'signals', 'nitro', 'driveMode', 'vehicleClass', 'aerialValues'],
        identity: ['brandMark', 'brand', 'player', 'date'], shortcuts: ['phone', 'inventory', 'musicShortcut', 'settings']
    });
    const groupAnchors = { minimap: 'radar', status: 'vitals', speedometer: 'vehicle', identity: 'identity', shortcuts: 'shortcuts' };
    const layer = document.createElement('div');
    layer.id = 'element-editor';
    layer.hidden = true;
    layer.setAttribute('aria-label', 'Atur posisi HUD');
    layer.innerHTML = '<div class="element-targets"></div><section class="element-edit-dock" aria-label="Kontrol posisi widget"><div class="element-edit-heading"><span class="element-edit-symbol" aria-hidden="true">✥</span><div><strong>Pindahkan widget</strong><small id="element-edit-hint">PgUp / PgDn memilih widget, tombol panah menggeser.</small></div></div><label class="element-mode-label"><span>Cara memindahkan</span><select id="move-mode" aria-label="Cara memindahkan widget"><option value="group">Seluruh widget</option><option value="icon">Per ikon</option></select></label><label class="element-picker-label"><span>Widget pilihan</span><select id="element-picker" aria-label="Pilih widget HUD"></select></label><output id="element-coordinates" aria-live="off">Pilih widget</output><label class="element-snap"><input id="element-snap" type="checkbox">Kisi 8 px</label><button id="element-reset" type="button">Reset posisi ini</button><button id="element-reset-all" type="button">Reset semua posisi</button><button id="element-done" type="button">Selesai</button><p class="element-keyboard-help">Panah: geser 1 px <span>Shift + panah: 10 px</span><span>Esc: kembali</span><span>PgUp/PgDn: pilih · [ / ]: ukuran · H: tampil</span></p></section>';
    document.body.append(layer);
    const targetsLayer = layer.querySelector('.element-targets');
    const picker = document.getElementById('element-picker');
    const modePicker = document.getElementById('move-mode');
    const output = document.getElementById('element-coordinates');
    const resetButton = document.getElementById('element-reset');
    const hint = document.getElementById('element-edit-hint');
    const snapInput = document.getElementById('element-snap');
    const managed = new Map();
    const handles = new Map();
    let editing = false, selected = '', drag = null, scheduled = 0, entries = [], placementEntries = [], detachedRings = false, destroyed = false;
    let serverDefaults = P.normalize();
    const mode = () => dashboard.getPreferences().moveMode;
    const selectionKeys = () => mode() === 'group' ? P.groupKeys : P.elementKeys;
    function visible(node) {
        if (!node || !node.isConnected || !node.getClientRects().length)
            return false;
        const rect = node.getBoundingClientRect();
        if (rect.width <= .1 || rect.height <= .1)
            return false;
        for (let parent = node; parent && parent !== document.documentElement; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            if (parent.hidden || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0)
                return false;
        }
        return true;
    }
    function bounds(nodes) {
        const rects = nodes.map(node => node.getBoundingClientRect());
        const left = Math.min(...rects.map(rect => rect.left)), top = Math.min(...rects.map(rect => rect.top));
        const right = Math.max(...rects.map(rect => rect.right)), bottom = Math.max(...rects.map(rect => rect.bottom));
        return { left, top, right, bottom, width: right - left, height: bottom - top };
    }
    function candidates(key) {
        let selector = selectors[key] || groupSelectors[key];
        if (key === 'speedFace' && window.HudInstruments?.getFaceSelector) {
            selector = window.HudInstruments.getFaceSelector(root.dataset.speedStyle) || selector;
        }
        if (key === 'rpm' && window.HudInstruments?.getRpmSelector) {
            const rpmSelector = window.HudInstruments.getRpmSelector(root.dataset.speedStyle);
            if (rpmSelector === null)
                return [];
            selector = rpmSelector || selector;
        }
        return selector ? query(selector) : [];
    }
    function registry(allowedKeys = null) {
        const result = [];
        if (!allowedKeys || allowedKeys.has('minimap')) {
            const minimap = document.querySelector('.radar-bezel');
            if (visible(minimap))
                result.push({ key: 'minimap', nodes: [minimap] });
        }
        for (const key of [...Object.keys(groupSelectors), ...Object.keys(selectors)]) {
            if (allowedKeys && !allowedKeys.has(key))
                continue;
            const node = candidates(key).find(visible);
            if (!node)
                continue;
            const nodes = [node];
            if (key === 'speedReadout' && node.id === 'speed') {
                const unit = document.getElementById('speed-unit');
                if (visible(unit))
                    nodes.push(unit);
            }
            result.push({ key, nodes });
        }
        return result.sort((a, b) => {
            if (a.nodes.some(parent => b.nodes.some(child => parent !== child && parent.contains(child))))
                return -1;
            if (b.nodes.some(parent => a.nodes.some(child => parent !== child && parent.contains(child))))
                return 1;
            return 0;
        });
    }
    function remember(node) {
        if (!managed.has(node))
            managed.set(node, { value: node.style.getPropertyValue('translate'), priority: node.style.getPropertyPriority('translate'), applied: null });
    }
    function clearTranslations() {
        for (const [node, original] of managed) {
            if (node.style.getPropertyValue('translate') === original.applied) {
                if (original.value) node.style.setProperty('translate', original.value, original.priority);
                else node.style.removeProperty('translate');
            } else {
                original.value = node.style.getPropertyValue('translate');
                original.priority = node.style.getPropertyPriority('translate');
            }
            original.applied = null;
            node.classList.remove('element-custom-position');
            if (!node.isConnected) managed.delete(node);
        }
    }
    function localDelta(node, dx, dy) {
        let matrix = new DOMMatrix();
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            const values = style.scale === 'none' ? [1, 1] : style.scale.split(' ').map(Number);
            const size = new DOMMatrix().scale(values[0] || 1, values[1] || values[0] || 1);
            const transform = style.transform === 'none' ? new DOMMatrix() : new DOMMatrix(style.transform);
            matrix = size.multiply(transform).multiply(matrix);
        }
        const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
        if (Math.abs(determinant) < .000001)
            return { x: dx, y: dy };
        return { x: (matrix.d * dx - matrix.c * dy) / determinant, y: (-matrix.b * dx + matrix.a * dy) / determinant };
    }
    function translate(entry, dx, dy) {
        for (const node of entry.nodes) {
            remember(node);
            const delta = localDelta(node, dx, dy);
            const base = getComputedStyle(node).translate;
            const values = base === 'none' ? ['0px', '0px'] : base.split(' ');
            node.style.setProperty('translate', `calc(${values[0] || '0px'} + ${delta.x}px) calc(${values[1] || '0px'} + ${delta.y}px)`);
            managed.get(node).applied = node.style.getPropertyValue('translate');
            node.classList.add('element-custom-position');
        }
    }
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const pointFor = (left, top) => ({ x: clamp(left / innerWidth, 0, 1), y: clamp(top / innerHeight, 0, 1) });
    const positionMap = () => ({ ...(dashboard.getPreferences().elementPositions || {}) });
    function activeEntries() {
        if (mode() === 'icon') return placementEntries.filter(entry => P.elementKeys.includes(entry.key));
        return P.groupKeys.map(key => {
            const anchor = placementEntries.find(entry => entry.key === key);
            if (!anchor) return null;
            const members = placementEntries.filter(entry => groupMembers[key].includes(entry.key));
            const nodes = [...new Set([...anchor.nodes, ...members.flatMap(entry => entry.nodes)])];
            return { key, nodes, anchor };
        }).filter(Boolean);
    }
    function applyPlacements() {
        clearTranslations();
        const prefs = dashboard.getPreferences(), points = prefs.elementPositions || {};
        root.classList.toggle('elements-detached-vitals', !!(points.health || points.armor));
        root.classList.toggle('elements-detached-map-tools', ['mapVehicle', 'mapMusic', 'mapVoice', 'mapSettings'].some(key => points[key]));
        const keys = [...new Set([...Object.keys(points), ...Object.keys(prefs.elementOptions || {}).filter(key => (prefs.elementOptions[key].scale ?? 1) !== 1)])];
        if (!editing && !keys.length) {
            placementEntries = [];
            entries = [];
            return;
        }
        placementEntries = registry(editing ? null : new Set(keys));
        for (const entry of placementEntries) {
            const point = points[entry.key];
            if (entry.key === 'minimap') continue;
            const rect = bounds(entry.nodes);
            const left = clamp(point ? point.x * innerWidth : rect.left, 0, Math.max(0, innerWidth - rect.width));
            const top = clamp(point ? point.y * innerHeight : rect.top, 0, Math.max(0, innerHeight - rect.height));
            translate(entry, left - rect.left, top - rect.top);
        }
        entries = activeEntries();
    }
    function custom(key) {
        const prefs = dashboard.getPreferences();
        const keys = mode() === 'group' ? [key, ...groupMembers[key]] : [key];
        if (keys.some(name => JSON.stringify(prefs.elementPositions[name]) !== JSON.stringify(serverDefaults.elementPositions[name]))) return true;
        const anchor = mode() === 'group' && groupAnchors[key];
        return !!anchor && JSON.stringify(prefs.positions[anchor]) !== JSON.stringify(serverDefaults.positions[anchor]);
    }
    function select(key, focus = false) {
        selected = selectionKeys().includes(key) ? key : '';
        picker.value = selected;
        for (const [name, handle] of handles) {
            handle.classList.toggle('selected', name === selected);
            handle.setAttribute('aria-pressed', String(name === selected));
        }
        const entry = entries.find(item => item.key === selected);
        if (entry) {
            const rect = bounds(entry.nodes);
            output.textContent = `X ${Math.round(rect.left)} · Y ${Math.round(rect.top)}`;
            if (focus)
                handles.get(selected)?.focus({ preventScroll: true });
        }
        else
            output.textContent = selected ? 'Tersembunyi atau belum aktif' : 'Pilih widget';
        resetButton.disabled = !selected || !custom(selected);
        window.dispatchEvent(new CustomEvent('hud:elementSelected', { detail: { key: selected } }));
        hint.textContent = mode() === 'group' ? 'Seluruh bagian widget ikut bergeser.' : 'Hanya ikon pilihan yang bergeser.';
    }
    function updateOverlays() {
        if (!editing)
            return;
        const present = new Set(entries.map(entry => entry.key));
        for (const [key, handle] of handles)
            if (!present.has(key)) {
                handle.remove();
                handles.delete(key);
            }
        const selectedMode = mode();
        modePicker.value = selectedMode;
        if (picker.dataset.mode !== selectedMode) {
            picker.dataset.mode = selectedMode;
            picker.replaceChildren(...selectionKeys().map(key => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = labels[key];
                return option;
            }));
        }
        for (const entry of entries) {
            let handle = handles.get(entry.key);
            if (!handle) {
                handle = document.createElement('button');
                handle.type = 'button';
                handle.className = 'element-move-target';
                handle.dataset.element = entry.key;
                handle.setAttribute('aria-label', 'Pindahkan ' + labels[entry.key]);
                const label = document.createElement('span');
                label.textContent = labels[entry.key];
                handle.append(label);
                handle.addEventListener('pointerdown', beginDrag);
                handle.addEventListener('pointermove', moveDrag);
                handle.addEventListener('pointerup', event => finishDrag(event, true));
                handle.addEventListener('pointercancel', event => finishDrag(event, true));
                handle.addEventListener('lostpointercapture', event => finishDrag(event, true));
                handle.addEventListener('focus', () => select(entry.key));
                handle.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); select(entry.key); });
                targetsLayer.append(handle);
                handles.set(entry.key, handle);
            }
            const rect = bounds(entry.nodes), width = Math.max(14, rect.width + 6), height = Math.max(14, rect.height + 6);
            handle.style.left = clamp(rect.left - 3, 0, Math.max(0, innerWidth - width)) + 'px';
            handle.style.top = clamp(rect.top - 3, 0, Math.max(0, innerHeight - height)) + 'px';
            handle.style.width = width + 'px';
            handle.style.height = height + 'px';
            handle.style.zIndex = String(Math.round(10000 / Math.max(1, Math.sqrt(width * height))));
        }
        select(selectionKeys().includes(selected) ? selected : entries[0]?.key || selectionKeys()[0] || '');
    }
    function flush() {
        if (scheduled)
            cancelAnimationFrame(scheduled);
        scheduled = 0;
        if (destroyed)
            return;
        if (editing && (!window.VeloxUI.getState().visible || hud.classList.contains('is-hidden'))) {
            endDrag(false);
            dashboard.setEditing(false);
            return;
        }
        applyPlacements();
        updateOverlays();
    }
    function schedule() {
        if (!scheduled && !destroyed)
            scheduled = requestAnimationFrame(flush);
    }
    function freezeDependents(entry) {
        const points = positionMap();
        for (const other of placementEntries) {
            if (!P.elementKeys.includes(other.key)) continue;
            if (other.key === entry.key || other.key === 'minimap')
                continue;
            const dependent = entry.key === 'minimap' || entry.nodes.some(parent => other.nodes.some(child => parent.contains(child)));
            if (!dependent)
                continue;
            const rect = bounds(other.nodes);
            points[other.key] = pointFor(rect.left, rect.top);
        }
        dashboard.applyPreferences({ elementPositions: points });
        flush();
    }
    function freezeOutsideGroup(entry) {
        const points = positionMap();
        const members = new Set([entry.key, ...groupMembers[entry.key]]);
        const parentNodes = entry.anchor.nodes;
        for (const other of placementEntries) {
            if (members.has(other.key) || !P.elementKeys.includes(other.key)) continue;
            if (entry.key !== 'minimap' && !parentNodes.some(parent => other.nodes.some(child => parent.contains(child)))) continue;
            const rect = bounds(other.nodes);
            points[other.key] = pointFor(rect.left, rect.top);
        }
        dashboard.applyPreferences({ elementPositions: points });
        flush();
    }
    function prepareMove(entry) {
        if (mode() === 'group') freezeOutsideGroup(entry);
        else freezeDependents(entry);
    }
    function applyGroupPoint(key, left, top, reference, persist) {
        const entry = entries.find(item => item.key === key);
        if (!entry) return;
        const rect = bounds(entry.nodes);
        const dx = clamp(left, 0, Math.max(0, innerWidth - reference.width)) - rect.left;
        const dy = clamp(top, 0, Math.max(0, innerHeight - reference.height)) - rect.top;
        const points = positionMap();
        const anchorRect = bounds(entry.anchor.nodes);
        points[key] = pointFor(anchorRect.left + dx, anchorRect.top + dy);
        for (const member of groupMembers[key]) {
            if (member === key) continue;
            const current = placementEntries.find(item => item.key === member);
            if (points[member]) {
                points[member] = pointFor(points[member].x * innerWidth + dx, points[member].y * innerHeight + dy);
            } else if (current && key !== 'minimap' && !entry.anchor.nodes.some(parent => current.nodes.every(child => parent.contains(child)))) {
                const currentRect = bounds(current.nodes);
                points[member] = pointFor(currentRect.left + dx, currentRect.top + dy);
            }
        }
        dashboard.applyPreferences({ elementPositions: points }, persist);
        flush();
    }
    function beginDrag(event) {
        if (!editing || drag || event.button !== 0 || event.isPrimary === false)
            return;
        event.preventDefault();
        event.stopPropagation();
        flush();
        const key = event.currentTarget.dataset.element;
        let entry = entries.find(item => item.key === key);
        if (!entry)
            return;
        select(key);
        prepareMove(entry);
        entry = entries.find(item => item.key === key);
        if (!entry)
            return;
        const rect = bounds(entry.nodes);
        drag = { key, pointer: event.pointerId, handle: event.currentTarget, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height, captured: false };
        layer.classList.add('is-dragging');
        try {
            drag.handle.setPointerCapture(event.pointerId);
            drag.captured = drag.handle.hasPointerCapture(event.pointerId);
        }
        catch (_) { }
        drag.handle.focus({ preventScroll: true });
    }
    function applyPoint(key, left, top, reference, persist = false) {
        if (mode() === 'group') { applyGroupPoint(key, left, top, reference, persist); return; }
        const points = positionMap();
        points[key] = pointFor(clamp(left, 0, Math.max(0, innerWidth - reference.width)), clamp(top, 0, Math.max(0, innerHeight - reference.height)));
        dashboard.applyPreferences({ elementPositions: points }, persist);
        flush();
    }
    function moveDrag(event) {
        if (!drag || event.pointerId !== drag.pointer)
            return;
        event.preventDefault();
        event.stopPropagation();
        if (!entries.some(entry => entry.key === drag.key)) {
            endDrag(true);
            return;
        }
        let left = drag.left + event.clientX - drag.startX, top = drag.top + event.clientY - drag.startY;
        if (snapInput.checked && !event.altKey) {
            left = Math.round(left / 8) * 8;
            top = Math.round(top / 8) * 8;
        }
        applyPoint(drag.key, left, top, drag);
    }
    function endDrag(persist) {
        if (!drag)
            return;
        const previous = drag;
        drag = null;
        layer.classList.remove('is-dragging');
        try {
            if (previous.handle.hasPointerCapture(previous.pointer))
                previous.handle.releasePointerCapture(previous.pointer);
        }
        catch (_) { }
        if (persist)
            dashboard.applyPreferences({}, true);
    }
    function finishDrag(event, persist) {
        if (!drag || event.pointerId !== drag.pointer)
            return;
        event.preventDefault();
        event.stopPropagation();
        endDrag(persist);
        schedule();
    }
    function moveByKeyboard(dx, dy) {
        flush();
        let entry = entries.find(item => item.key === selected);
        if (!entry)
            return;
        prepareMove(entry);
        entry = entries.find(item => item.key === selected);
        if (!entry)
            return;
        const rect = bounds(entry.nodes);
        applyPoint(selected, rect.left + dx, rect.top + dy, rect, true);
    }
    function resetSelected() {
        endDrag(false);
        if (!selected) return;
        const entry = entries.find(item => item.key === selected);
        if (entry && selected === 'minimap') prepareMove(entry);
        const points = positionMap();
        const keys = mode() === 'group' ? [selected, ...groupMembers[selected]] : [selected];
        for (const key of keys) {
            const point = serverDefaults.elementPositions[key];
            if (point) points[key] = { ...point };
            else delete points[key];
        }
        const patch = { elementPositions: points };
        const anchor = mode() === 'group' && groupAnchors[selected];
        if (anchor) patch.positions = { [anchor]: { ...serverDefaults.positions[anchor] } };
        dashboard.applyPreferences(patch, true);
        flush();
    }
    function start() {
        detachedRings = dashboard.getPreferences().statusPlacement === 'attached';
        if (detachedRings)
            dashboard.applyPreferences({ statusPlacement: 'standalone' }, true);
        dashboard.setEditing(true);
    }
    function syncEditing(event) {
        editing = event.detail?.editing === true;
        layer.hidden = !editing;
        if (!editing) {
            endDrag(false);
            return;
        }
        flush();
        select(selected || entries[0]?.key || '', true);
    }
    function keydown(event) {
        if (!editing)
            return;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            endDrag(true);
            dashboard.setEditing(false);
            return;
        }
        const textInput = event.target.closest('textarea, input:not([type=checkbox]):not([type=range])');
        if (!textInput && ['PageUp', 'PageDown', '[', ']', 'h', 'H'].includes(event.key)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (event.key === 'PageUp' || event.key === 'PageDown') {
                const keys = selectionKeys();
                const index = keys.indexOf(selected);
                const step = event.key === 'PageDown' ? 1 : -1;
                select(keys[(index + step + keys.length) % keys.length], true);
            } else if (selected && window.HudWidgetControls) {
                const prefs = dashboard.getPreferences();
                if (event.key.toLowerCase() === 'h') window.HudWidgetControls.update(selected, { visible: !window.HudWidgetControls.enabled(prefs, selected) });
                else window.HudWidgetControls.update(selected, { scale: Math.max(.5, Math.min(2, (prefs.elementOptions[selected]?.scale ?? 1) + (event.key === ']' ? .05 : -.05))) });
            }
            return;
        }
        const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        const direction = directions[event.key];
        if (direction && !event.target.closest('select, input, textarea')) {
            event.preventDefault();
            event.stopPropagation();
            const step = event.shiftKey ? 10 : 1;
            moveByKeyboard(direction[0] * step, direction[1] * step);
        }
        if (event.key === 'Tab') {
            const controls = [...layer.querySelectorAll('button, select, input')].filter(node => !node.disabled && visible(node));
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            }
            else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        }
    }
    document.getElementById('edit-layout').addEventListener('click', start);
    document.getElementById('finish-edit')?.addEventListener('click', () => dashboard.setEditing(false));
    document.getElementById('element-done').addEventListener('click', () => { endDrag(true); dashboard.setEditing(false); });
    resetButton.addEventListener('click', resetSelected);
    document.getElementById('element-reset-all').addEventListener('click', () => {
        endDrag(false);
        dashboard.applyPreferences({ positions: serverDefaults.positions, elementPositions: serverDefaults.elementPositions }, true);
        flush();
    });
    picker.addEventListener('change', () => select(picker.value, true));
    modePicker.addEventListener('change', () => {
        endDrag(true);
        dashboard.applyPreferences({ moveMode: modePicker.value }, true);
        flush();
        select(selected, true);
    });
    layer.addEventListener('click', event => { if (event.target === layer || event.target === targetsLayer)
        select(''); });
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('pointermove', event => {
        if (drag && !drag.captured && !drag.handle.contains(event.target))
            moveDrag(event);
    });
    document.addEventListener('pointerup', event => { if (drag && !drag.captured)
        finishDrag(event, true); });
    document.addEventListener('pointercancel', event => { if (drag && !drag.captured)
        finishDrag(event, true); });
    window.addEventListener('velox:editing', syncEditing);
    window.addEventListener('velox:render', schedule);
    window.addEventListener('velox:preferences', schedule);
    window.addEventListener('resize', () => { endDrag(true); schedule(); });
    window.addEventListener('blur', () => endDrag(true));
    window.addEventListener('message', event => {
        if (event.source && event.source !== window)
            return;
        if (event.data?.action === 'hud:config' && event.data.data?.defaultPreferences)
            serverDefaults = P.normalize(event.data.data.defaultPreferences);
        if (event.data?.action === 'hud:preferences' || (event.data?.action === 'hud:settings' && event.data?.data?.open === false))
            endDrag(false);
    });
    window.addEventListener('pagehide', () => {
        destroyed = true;
        endDrag(false);
        if (scheduled)
            cancelAnimationFrame(scheduled);
        clearTranslations();
    });
    window.HudElementEditor = Object.freeze({
        refresh: flush, start, getSelected: () => selected,
        labels: Object.freeze(labels),
        getMode: mode, getGroups: () => [...P.groupKeys],
        getVisibleElements: () => registry().filter(entry => P.elementKeys.includes(entry.key)).map(entry => entry.key),
        getNodes: key => key === 'minimap' ? query('.radar-bezel') : query(selectors[key] || groupSelectors[key] || ':not(*)'),
        snapshot: () => Object.fromEntries(registry().filter(entry => P.elementKeys.includes(entry.key)).map(entry => { const rect = bounds(entry.nodes); return [entry.key, pointFor(rect.left, rect.top)]; }))
    });
    flush();
})();
