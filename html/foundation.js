(function () {
    'use strict';
    const $ = id => document.getElementById(id), root = document.documentElement;
    const P = window.HudPreferences, dashboard = window.VeloxDashboard;
    const radar = document.querySelector('.radar-widget'), bezel = document.querySelector('.radar-bezel');
    const svg = body => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
    const use = name => svg(`<use href="#${name}"/>`);
    const glyph = {
        fork: svg('<path d="M5 2v7m3-7v7M2 2v5a3 3 0 0 0 6 0M5 10v12M18 2c-4 3-5 7-5 11h5V2Zm0 11v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
        drop: svg('<path d="M12 1C9 6 4 10 4 15a8 8 0 0 0 16 0c0-5-5-9-8-14Z"/>'),
        run: svg('<circle cx="15" cy="3.5" r="2.5"/><path d="m8 8 4-2 4 4 4 1m-8-3-3 6 5 3 1 5m-6-8-2 5-5 2" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'),
        cursor: svg('<path d="m5 2 14 11-7 1-3 7L5 2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'),
        radio: svg('<path d="M8 2v6m8-6-2 6M7 8h10v14H7zM9 12h6m-6 3h6m-6 3h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
        nav: svg('<path d="m3 10 18-7-7 18-3-8-8-3Z"/>'),
        car: svg('<path d="m5 5-3 8v7h3v-3h14v3h3v-7l-3-8H5Zm1.5 2h11l1.7 5H4.8l1.7-5ZM5 13.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm14 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"/>'),
        music: svg('<path d="M9 17V5l11-3v13M9 9l11-3" fill="none" stroke="currentColor" stroke-width="2.5"/><ellipse cx="5.5" cy="18" rx="4" ry="3"/><ellipse cx="16.5" cy="16" rx="4" ry="3"/>'),
        settings: document.querySelector('#shortcut-widget [data-open="appearance"] svg').outerHTML,
        sun: svg('<circle cx="12" cy="12" r="5" fill="#ffc96b"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4.2 4.2l1.5 1.5m12.6 12.6 1.5 1.5m0-15.6-1.5 1.5M5.7 18.3l-1.5 1.5" stroke="#ffc96b" stroke-width="2" stroke-linecap="round"/>'),
        cloud: svg('<path d="M6 20a5 5 0 0 1-1-9.9A7 7 0 0 1 18.5 9a5.5 5.5 0 0 1 0 11H6Z"/>')
    };
    const map = document.createElement('div');
    map.className = 'foundation-map';
    map.setAttribute('aria-hidden', 'true');
    bezel.prepend(map);
    const compass = $('compass-letter');
    radar.append(compass);
    document.querySelector('.music-mini').setAttribute('aria-label', 'Buka musik');
    const colors = { health: '#f76682', armor: '#6590ff', hunger: '#f8be61', thirst: '#6ce4ef', stress: '#d967e9', stamina: '#d6ef60' };
    for (const [key, color] of Object.entries(colors))
        document.querySelector(`[data-stat="${key}"]`).style.setProperty('--stat-color', color);
    for (const [key, icon] of [['hunger', glyph.fork], ['thirst', glyph.drop], ['stamina', glyph.run]])
        document.querySelector(`[data-stat="${key}"] .ring-circle svg`).outerHTML = icon;
    const tabIcons = { vehicle: glyph.car, music: glyph.music, voice: use('voice'), appearance: glyph.settings };
    document.querySelectorAll('.map-tabs button').forEach(button => { button.innerHTML = tabIcons[button.dataset.open]; button.classList.toggle('map-tab-current', button.dataset.open === 'music'); });
    document.querySelector('.music-disc').innerHTML = '<span></span>';
    function orbit(name, icon, key, tab) { const button = document.createElement('button'); button.className = 'radar-orbit ' + name; button.setAttribute('aria-label', ({voice: 'Status mikrofon', music: 'Musik', appearance: 'Pengaturan HUD'})[tab]); button.innerHTML = icon + `<small>${key}</small>`; button.addEventListener('click', () => dashboard.openMenu(tab)); radar.append(button); return button; }
    orbit('radio-orbit', glyph.radio, 'F3', 'music');
    orbit('cursor-orbit', glyph.cursor, 'F6', 'appearance');
    const voiceOrbit = orbit('voice-orbit', use('voice'), 'N', 'voice');
    const standaloneVoice = document.createElement('button');
    standaloneVoice.id = 'component-voice';
    standaloneVoice.className = 'component-voice ring-voice';
    standaloneVoice.setAttribute('aria-label', 'Voice settings');
    standaloneVoice.innerHTML = use('voice') + '<span>N</span>';
    standaloneVoice.addEventListener('click', () => dashboard.openMenu('voice'));
    $('hud').append(standaloneVoice);
    const arc = (radius, start, end) => { const point = d => [140 + radius * Math.cos(d * Math.PI / 180), 140 + radius * Math.sin(d * Math.PI / 180)]; const a = point(start), b = point(end); return `M${a.join(',')} A${radius},${radius} 0 ${end - start > 180 ? 1 : 0} 1 ${b.join(',')}`; };
    const arcs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arcs.classList.add('map-status-arcs');
    arcs.setAttribute('viewBox', '0 0 280 280');
    const segments = [['health', -178, -92], ['stress', -82, -59], ['stamina', -49, -5], ['thirst', 5, 48], ['hunger', 58, 85], ['armor', 95, 172]];
    arcs.innerHTML = segments.map(([key, start, end]) => `<path d="${arc(137, start, end)}" fill="none" stroke="${colors[key]}" stroke-opacity=".16" stroke-width="5" stroke-linecap="round"/><path data-map-stat="${key}" d="${arc(137, start, end)}" fill="none" stroke="${colors[key]}" stroke-width="5" pathLength="100" stroke-linecap="round"/>`).join('');
    bezel.append(arcs);
    const instrument = document.querySelector('#new-speed .instrument');
    const speedArcs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    speedArcs.classList.add('foundation-speed-arcs');
    speedArcs.setAttribute('viewBox', '0 0 196 196');
    speedArcs.innerHTML = '<path class="speed-arc-track" d="M49 182 A97 97 0 1 1 147 182"/><path id="foundation-rpm-arc" d="M49 182 A97 97 0 1 1 147 182" pathLength="100"/><path class="speed-arc-track" d="M65 181 A90 90 0 0 0 131 181"/><path id="foundation-fuel-arc" d="M65 181 A90 90 0 0 0 131 181" pathLength="100"/>';
    instrument.prepend(speedArcs);
    if (root.classList.contains('debug-preview') && typeof window.GetParentResourceName !== 'function') {
        const bar = document.createElement('nav');
        bar.id = 'foundation-preview';
        bar.setAttribute('aria-label', 'Layout preview');
        bar.innerHTML = '<span>HUD FOUNDATION <small id="preview-resolution"></small></span><button data-view="rectangle">Rectangle</button><button data-view="circle">Circle</button><button data-view="foot">On foot</button><button data-view="settings" aria-label="HUD settings">Settings</button>';
        document.body.append(bar);
        bar.addEventListener('click', event => { const view = event.target.closest('[data-view]')?.dataset.view; if (!view)
            return; if (view === 'settings') {
            dashboard.openMenu();
            return;
        } if (view === 'foot') {
            window.VeloxUI.update({ inVehicle: false });
        }
        else {
            dashboard.applyPreferences({ layout: view, mapMode: 'vehicle' }, true);
            window.VeloxUI.update({ inVehicle: true });
        } });
    }
    const titleCase = text => String(text).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    let previousWeather = '', previousDiving;
    function render() {
        const prefs = dashboard.getPreferences(), state = window.VeloxUI.getState(), g = P.radar(innerWidth, innerHeight, prefs), status = $('ring-status');
        root.classList.toggle('map-visible', !radar.hidden && prefs.elementOptions?.minimap?.visible !== false);
        root.classList.toggle('on-foot', !state.inVehicle);
        const mapVisible = !root.classList.contains('minimap-audio-open') && !radar.hidden && prefs.elementOptions?.minimap?.visible !== false;
        const linked = prefs.showVitals && P.attachedStatus(prefs) && mapVisible;
        root.classList.toggle('map-status-linked', linked);
        root.classList.toggle('vitals-enabled', prefs.showVitals);
        root.classList.toggle('voice-enabled', prefs.showVoice);
        status.hidden = !prefs.showVitals || prefs.statusStyle === 'velox' || (linked && prefs.layout === 'circle');
        arcs.toggleAttribute('hidden', !linked || prefs.layout !== 'circle');
        if (linked && prefs.layout === 'rectangle') {
            status.style.left = g.widgetLeft + 'px';
            status.style.top = (g.widgetTop + 388 * g.scale) + 'px';
        }
        document.querySelector('.music-mini').hidden = !prefs.showMusic;
        document.querySelector('.location-row').hidden = !prefs.showLocation;
        $('compass-letter').hidden = !prefs.showLocation;
        document.querySelector('.map-tabs').hidden = !prefs.showMapTools;
        document.querySelector('.cursor-orbit').hidden = !prefs.showMapTools;
        document.querySelector('.radio-orbit').hidden = !prefs.showVoice;
        const compactVisible = prefs.showVitals && prefs.statusStyle === 'velox';
        const voiceInMap = prefs.showVoice && linked;
        const voiceWithStatus = prefs.showVoice && !status.hidden;
        voiceOrbit.hidden = !voiceInMap;
        document.querySelector('.ring-status .ring-voice').hidden = !voiceWithStatus || voiceInMap;
        $('voice-display').hidden = !prefs.showVoice;
        standaloneVoice.hidden = !prefs.showVoice || voiceInMap || voiceWithStatus || compactVisible;
        const voicePoint = P.position(innerWidth, innerHeight, prefs, 'vitals', 430, 60);
        standaloneVoice.style.left = (voicePoint.left + 380 * voicePoint.scale) + 'px';
        standaloneVoice.style.top = (voicePoint.top + 6 * voicePoint.scale) + 'px';
        standaloneVoice.style.transform = `scale(${voicePoint.scale})`;
        standaloneVoice.style.transformOrigin = 'top left';
        $('zone').textContent = titleCase(state.zone);
        $('street').textContent = titleCase(state.street);
        const weather = /RAIN|THUNDER|CLOUD|FOG|OVERCAST|SNOW|BLIZZARD/.test(state.weather) ? 'cloud' : 'sun';
        if (previousWeather !== weather || !$('weather-icon').firstElementChild) {
            $('weather-icon').innerHTML = glyph[weather];
            previousWeather = weather;
        }
        if (previousDiving !== state.diving) {
            document.querySelector('[data-stat="stamina"] .ring-circle svg').outerHTML = state.diving ? use('oxygen') : glyph.run;
            previousDiving = state.diving;
        }
        voiceOrbit.classList.toggle('talking', state.talking);
        voiceOrbit.querySelector('small').textContent = state.voiceRange <= 1 ? 'W' : state.voiceRange >= 3 ? 'S' : 'N';
        standaloneVoice.classList.toggle('talking', state.talking);
        standaloneVoice.querySelector('span').textContent = state.voiceRange <= 1 ? 'W' : state.voiceRange >= 3 ? 'S' : 'N';
        standaloneVoice.setAttribute('aria-label', `Voice settings: ${state.talking ? 'talking, ' : ''}${state.voiceRange <= 1 ? 'whisper' : state.voiceRange >= 3 ? 'shout' : 'normal'}`);
        for (const path of arcs.querySelectorAll('[data-map-stat]')) {
            const key = path.dataset.mapStat, value = key === 'stamina' && state.diving ? state.oxygen : state[key];
            path.style.strokeDasharray = `${value} 100`;
        }
        $('foundation-rpm-arc').style.strokeDasharray = `${state.rpm * 100} 100`;
        $('foundation-fuel-arc').style.strokeDasharray = `${state.fuel} 100`;
        if ($('preview-resolution')) {
            $('preview-resolution').textContent = `${innerWidth} × ${innerHeight}`;
            document.querySelectorAll('[data-view]').forEach(b => { const selected = b.dataset.view === (!state.inVehicle ? 'foot' : prefs.layout); b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
        }
    }
    window.addEventListener('velox:render', render);
    window.addEventListener('velox:preferences', render);
    window.addEventListener('resize', render);
    render();
    dashboard.refreshBindings?.();
})();
