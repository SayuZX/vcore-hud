(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const isFiveM = typeof window.GetParentResourceName === 'function';
    const debug = !isFiveM && typeof window.location?.search === 'string' && new URLSearchParams(window.location.search).get('debug') === '1';
    document.documentElement.classList.toggle('debug-preview', debug);
    const { defaults, patch, clamp, normalizeRadarLayout, measureRadar } = window.HudState;
    let state = { ...defaults };
    let radarAlwaysVisible = true;
    let radarLayout = normalizeRadarLayout();
    let handshake = null;
    let driving = false;
    let animation = 0;
    let lastFrame = 0;
    let driveTime = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const svgNS = 'http://www.w3.org/2000/svg';
    function svg(tag, attributes, parent) { const el = document.createElementNS(svgNS, tag); Object.entries(attributes).forEach(([k, v]) => el.setAttribute(k, v)); parent.appendChild(el); return el; }
    function polar(cx, cy, r, angle) { const a = angle * Math.PI / 180; return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) }; }
    function arc(cx, cy, r, start, end) { const a = polar(cx, cy, r, start), b = polar(cx, cy, r, end); return `M${a.x},${a.y}A${r},${r} 0 ${end - start > 180 ? 1 : 0} 1 ${b.x},${b.y}`; }
    function resize() {
        const style = document.documentElement.style;
        style.setProperty('--hud-scale', measureRadar(innerWidth, innerHeight, radarLayout).scale);
        ['right', 'top', 'diameter', 'inset'].forEach(key => style.setProperty('--radar-' + key, radarLayout[key] + 'px'));
    }
    resize();
    window.addEventListener('resize', resize);
    const rpmTicks = [];
    for (let i = 0; i < 38; i++) {
        rpmTicks.push(svg('path', { d: arc(76, 76, 66, 210 + i * 7.6, 210 + i * 7.6 + 5.5), fill: 'none', stroke: '#3a3b3c', 'stroke-width': 3.7 }, $('rpm-ticks')));
    }
    $('dial-inner').setAttribute('d', arc(76, 76, 62, 210, 491));
    const fuelArc = arc(-43, 76, 76, 46, 119);
    $('fuel-track').setAttribute('d', fuelArc);
    $('fuel-level').setAttribute('d', fuelArc);
    for (let i = 0; i < 24; i++) {
        const a = polar(92, 92, 80, i * 15), b = polar(92, 92, i % 6 === 0 ? 75 : 77, i * 15);
        svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#ffffff80', 'stroke-width': 1.5 }, $('compass-ticks'));
    }
    const cardinals = ['N', 'E', 'S', 'W'].map((label, i) => { const g = svg('g', {}, $('compass-cardinals')); if (i === 0)
        svg('rect', { x: -6, y: -8, width: 12, height: 16, class: 'north-badge' }, g); const t = svg('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', class: i === 0 ? 'north-label' : '' }, g); t.textContent = label; return g; });
    function render() {
        $('hud').classList.toggle('is-hidden', !state.visible);
        document.querySelector('.radar-widget').hidden = isFiveM && !radarAlwaysVisible && !state.inVehicle;
        ['health', 'armor', 'hunger', 'thirst'].forEach(key => { const el = $(key + '-display'); el.setAttribute('aria-valuenow', Math.round(state[key])); el.classList.toggle('critical', state[key] <= 20); $(key + '-fill').style.width = state[key] + '%'; });
        const stamina = state.diving ? state.oxygen : state.stamina;
        $('stamina-ring').style.strokeDasharray = `${stamina} 100`;
        $('stamina-display').classList.toggle('is-diving', state.diving);
        $('stamina-display').setAttribute('aria-label', state.diving ? 'Oxygen' : 'Stamina');
        $('stamina-display').setAttribute('aria-valuenow', Math.round(stamina));
        $('stress-ring').style.strokeDasharray = `${state.stress} 100`;
        $('stress-display').setAttribute('aria-valuenow', Math.round(state.stress));
        $('voice-display').classList.toggle('is-talking', state.talking);
        $('voice-display').dataset.range = state.voiceRange <= 1 ? 'whisper' : state.voiceRange >= 3 ? 'shout' : 'normal';
        $('voice-display').setAttribute('aria-label', `Voice: ${state.talking ? 'talking, ' : ''}${state.voiceRange <= 1 ? 'whisper' : state.voiceRange >= 3 ? 'shout' : 'normal'}`);
        $('vehicle-widget').hidden = !state.inVehicle;
        const speed = Math.round(state.speed).toString().padStart(3, '0');
        const leading = speed.match(/^0*/)[0].length;
        $('speed').replaceChildren();
        for (let i = 0; i < speed.length; i++) {
            const digit = document.createElement('span');
            digit.textContent = speed[i];
            if (i < Math.min(leading, 2))
                digit.className = 'muted';
            $('speed').appendChild(digit);
        }
        $('speed').setAttribute('aria-label', `${Math.round(state.speed)} ${state.unit === 'MPH' ? 'miles' : 'kilometers'} per hour`);
        $('speed-unit').textContent = state.unit === 'KMH' ? 'KM/H' : 'MPH';
        $('gear').textContent = state.gear;
        rpmTicks.forEach((tick, i) => tick.setAttribute('stroke', i < Math.round(state.rpm * 38) ? (i > 31 ? '#ee466d' : '#fafcff') : '#3a3b3c'));
        $('fuel-level').style.strokeDasharray = `${state.fuel} 100`;
        $('fuel-level').setAttribute('stroke', state.fuel <= 15 ? '#ee466d' : '#fafcff');
        const vehicleStates = [['lights', state.lights, 'Headlights on', 'Headlights off'], ['seatbelt', state.seatbelt, 'Seatbelt fastened', 'Seatbelt unfastened'], ['locked', state.locked, 'Vehicle locked', 'Vehicle unlocked']];
        vehicleStates.forEach(([key, active, on, off]) => { const el = $(key + '-display'); el.classList.toggle('active', active); el.classList.toggle('warning', key === 'seatbelt' && !active); el.setAttribute('aria-label', active ? on : off); });
        $('seatbelt-display').hidden = !state.seatbeltAvailable;
        $('lights-display').classList.toggle('high-beam', state.highbeams);
        if (state.highbeams)
            $('lights-display').setAttribute('aria-label', 'High beams on');
        $('heading').textContent = `${Math.round(state.heading) % 360}°`;
        $('zone').textContent = state.zone.toUpperCase();
        $('street').textContent = state.street.toUpperCase();
        cardinals.forEach((g, i) => { const p = polar(92, 92, 70, i * 90 - state.heading); g.setAttribute('transform', `translate(${p.x},${p.y})`); });
        $('compass-ticks').setAttribute('transform', `rotate(${-state.heading} 92 92)`);
        $('map-roads').setAttribute('transform', `rotate(${120 - state.heading} 92 92)`);
        window.dispatchEvent(new CustomEvent('velox:render', { detail: state }));
    }
    function update(data, sync = false) { state = patch(state, data); render(); if (sync && debug)
        syncControls(); }
    function nui(name, data = {}, signal) { return fetch(`https://${GetParentResourceName()}/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(data), signal }); }
    window.addEventListener('message', event => {
        if (event.source && event.source !== window)
            return;
        const message = event.data;
        if (!message || typeof message !== 'object')
            return;
        if (message.action === 'hud:update' && message.data && typeof message.data === 'object' && !Array.isArray(message.data)) {
            update(message.data, debug);
            if (isFiveM && typeof message.data.visible === 'boolean') {
                document.documentElement.classList.add('is-ready');
                if (handshake)
                    handshake.stop();
            }
        }
        else if (message.action === 'hud:config' && message.data && typeof message.data === 'object') {
            if (typeof message.data.radarAlwaysVisible === 'boolean')
                radarAlwaysVisible = message.data.radarAlwaysVisible;
            if (message.data.radarLayout) {
                radarLayout = normalizeRadarLayout(message.data.radarLayout);
                resize();
            }
            update({ unit: message.data.unit });
            if (typeof message.data.nativeRadar === 'boolean')
                document.documentElement.classList.toggle('radar-disabled', !message.data.nativeRadar);
        }
        else if (message.action === 'hud:visible' && typeof message.data?.visible === 'boolean')
            update({ visible: message.data.visible });
    });
    window.VeloxUI = { getState: () => ({ ...state }), update };
    if (isFiveM) {
        $('dev-ui')?.remove();
        render();
        handshake = window.HudBridge.start(signal => nui('ready', {}, signal).then(response => { if (!response.ok)
            throw new Error('NUI not ready'); }));
        window.addEventListener('pagehide', () => handshake.stop());
        return;
    }
    if (!debug) { $('dev-ui')?.remove(); render(); return; }
    function sliders(target, items) { items.forEach(([field, label, min, max, step = 1]) => { const row = document.createElement('label'); row.className = 'slider-row'; const title = document.createElement('span'); title.textContent = label; const input = document.createElement('input'); input.type = 'range'; input.min = min; input.max = max; input.step = step; input.dataset.field = field; input.setAttribute('aria-label', label); const out = document.createElement('output'); out.id = field + '-output'; row.append(title, input, out); $(target).appendChild(row); }); }
    sliders('player-sliders', [['health', 'Health', 0, 100], ['armor', 'Armor', 0, 100], ['hunger', 'Hunger', 0, 100], ['thirst', 'Thirst', 0, 100], ['stamina', 'Stamina', 0, 100], ['stress', 'Stress', 0, 100], ['oxygen', 'Oxygen', 0, 100]]);
    sliders('vehicle-sliders', [['speed', 'Speed', 0, 240], ['rpm', 'RPM', 0, 1, .01], ['fuel', 'Fuel', 0, 100]]);
    sliders('location-sliders', [['heading', 'Heading', 0, 359]]);
    const fields = Array.from(document.querySelectorAll('[data-field]'));
    function syncControls() { fields.forEach(input => { const value = state[input.dataset.field]; if (input.type === 'checkbox')
        input.checked = value;
    else if (document.activeElement !== input)
        input.value = value; const out = $(input.dataset.field + '-output'); if (out)
        out.textContent = input.dataset.field === 'rpm' ? Math.round(value * 100) + '%' : Math.round(value) + (input.dataset.field === 'heading' ? '°' : ''); }); }
    function clearPreset() { document.querySelectorAll('[data-preset]').forEach(button => button.classList.remove('selected')); }
    $('controls').addEventListener('submit', e => e.preventDefault());
    fields.forEach(input => input.addEventListener('input', () => { const field = input.dataset.field; let value = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value; const data = { [field]: value }; if (field === 'unit' && value !== state.unit)
        data.speed = state.speed * (value === 'KMH' ? 1.609344 : 1 / 1.609344); if (driving && ['speed', 'rpm', 'gear', 'heading', 'inVehicle'].includes(field))
        stopDrive(); clearPreset(); update(data, true); }));
    function panel(open) { $('dev-panel').hidden = !open; $('dev-toggle').setAttribute('aria-expanded', String(open)); $('dev-toggle').textContent = open ? 'Hide Dev Controls' : 'Show Dev Controls'; if (!open)
        $('dev-toggle').focus(); }
    $('dev-toggle').addEventListener('click', () => panel($('dev-panel').hidden));
    $('close-panel').addEventListener('click', () => panel(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('dev-panel').hidden) {
        panel(false);
        return;
    } if (e.key.toLowerCase() === 'h' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName))
        panel($('dev-panel').hidden); });
    function preset(name) { stopDrive(); state = { ...defaults }; if (name === 'drive')
        state = patch(state, { health: 100, armor: 95, hunger: 76, thirst: 68, speed: 68, gear: '4', rpm: .57, fuel: 64, seatbelt: true, lights: true, locked: true, heading: 248, zone: 'DOWNTOWN', street: 'OLYMPIC FWY' }); if (name === 'foot')
        state = patch(state, { inVehicle: false, health: 92, armor: 50, stamina: 64, stress: 8, heading: 35, zone: 'VESPUCCI', street: 'MAGELLAN AVE' }); document.querySelectorAll('[data-preset]').forEach(button => button.classList.toggle('selected', button.dataset.preset === name)); render(); syncControls(); }
    document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => preset(button.dataset.preset)));
    $('reset').addEventListener('click', () => preset('reference'));
    function stopDrive() { driving = false; cancelAnimationFrame(animation); $('simulate').innerHTML = '<span class="play-icon" aria-hidden="true">▶</span> Test drive'; $('simulate').setAttribute('aria-pressed', 'false'); }
    function drive(frame) { if (!driving)
        return; if (!lastFrame)
        lastFrame = frame; const dt = Math.min((frame - lastFrame) / 1000, .1); lastFrame = frame; driveTime += dt; const mph = clamp(driveTime * 9, 0, 85) + Math.sin(driveTime * .6) * 4; update({ inVehicle: true, speed: Math.max(0, mph) * (state.unit === 'KMH' ? 1.609344 : 1), gear: String(Math.min(6, Math.max(1, Math.floor(mph / 18) + 1))), rpm: .2 + (mph % 18) / 25, fuel: Math.max(0, state.fuel - dt * .025), heading: state.heading + (reducedMotion.matches ? 0 : dt * 1.5) }, true); animation = requestAnimationFrame(drive); }
    $('simulate').setAttribute('aria-pressed', 'false');
    $('simulate').addEventListener('click', () => { if (driving) {
        stopDrive();
        return;
    } clearPreset(); driving = true; lastFrame = 0; driveTime = 0; $('simulate').innerHTML = '<span class="play-icon" aria-hidden="true">Ⅱ</span> Pause drive'; $('simulate').setAttribute('aria-pressed', 'true'); update({ inVehicle: true, seatbelt: true, gear: '1' }, true); animation = requestAnimationFrame(drive); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && driving)
        stopDrive(); });
    render();
    syncControls();
})();
