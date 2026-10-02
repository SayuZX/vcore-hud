(function () {
    'use strict';
    const $ = id => document.getElementById(id), P = window.HudPreferences;
    const game = typeof GetParentResourceName === 'function', root = document.documentElement, hud = $('hud');
    let settingsKey = 'I', trackRequest = 0;
    let previewMusic, dismissPlayer = false, mediaStatus = { state: 'idle' }, playbackIdentity = '', playbackAdapter = '';
    let shortcutConfig = { phone: { key: 'M', enabled: !game }, inventory: { key: 'TAB', enabled: !game }, music: { key: '', enabled: true }, settings: { key: 'I', enabled: true } };
    let prefs = P.normalize(), aerialActive = false, state = window.VeloxUI.getState(), open = false, editing = false, saveTimer, toastTimer, activeTab = 'appearance', music = { playing: false, volume: .35, playlist: [], liked: false }, services = {};
    if (!game) {
        try {
            prefs = P.parse(localStorage.getItem('velox:preset') || JSON.stringify(P.defaults));
        }
        catch (_) { }
    }
    const icon = id => `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#${id}"/></svg>`;
    const radar = document.querySelector('.radar-widget');
    const header = document.createElement('div');
    header.className = 'radar-header';
    header.innerHTML = `<button class="glass music-mini" data-open="music"><span class="music-disc">♫</span><span><b id="music-mini-title">Musik kendaraan</b><small id="music-mini-status">Pilih lagu</small></span><span id="music-mini-play">▷</span></button><div class="glass location-row"><span id="compass-letter">NW</span><div id="location-slot"></div><time id="world-clock">19:31</time><span id="weather-icon" title="Weather">☀</span></div><div class="glass map-tabs" aria-label="Tombol HUD"><button data-open="vehicle" aria-label="Kontrol kendaraan">▰</button><button data-open="music" aria-label="Musik">♫</button><button data-open="voice" aria-label="Perintah suara">${icon('voice')}</button><button data-open="appearance" aria-label="Pengaturan HUD">⚙</button></div>`;
    radar.prepend(header);
    $('location-slot').append(document.querySelector('.location'));
    const mapNote = document.createElement('span');
    mapNote.className = 'native-map-note';
    mapNote.textContent = 'GTA V radar · rendered in game';
    document.querySelector('.radar-bezel').append(mapNote);
    const extra = document.createElement('div');
    extra.id = 'dashboard-widgets';
    extra.innerHTML = `<section id="identity-widget" class="identity-widget movable" aria-label="Player identity"><div class="identity-top glass"><span class="server-emblem">V</span><span><b>VCORE ROLEPLAY</b><small>LOS SANTOS / SAN ANDREAS</small></span><span class="online-dot"></span></div><div class="identity-person"><span class="date-chip glass" id="date-chip"></span><div class="glass name-chip"><span class="id-chip" id="player-id"></span><span><b id="player-name"></b><small id="player-job"></small></span></div></div><div id="money-cards"><div class="money cash glass"><span>▱</span><small>Cash</small><b id="cash-value"></b></div><div class="money bank glass"><span>▥</span><small>Bank</small><b id="bank-value"></b></div></div></section><section id="ring-status" class="ring-status movable" aria-label="Player status"></section><section id="new-speed" class="new-speed movable" aria-label="Vehicle telemetry"><div class="instrument"><div class="tachometer"><div class="tachometer-core"></div></div><div class="speed-top"><span id="speed-class">CAR</span><b id="new-gear">D</b><span id="drive-mode">AUTO</span></div><div class="new-speed-value"><strong id="new-speed-value">0</strong><span id="new-speed-unit">MPH</span></div><div class="aerial-values"><span>ALT <b id="altitude-value">0</b> M</span><span>V/S <b id="vertical-value">0</b></span><div class="horizon"><i id="horizon-line"></i></div></div><div class="fuel-mini"><span>${icon('fuel')}</span><div><i id="new-fuel-fill"></i></div><b id="new-fuel-value">80</b></div><div class="rpm-strip" id="rpm-strip"></div><div class="vehicle-state-row"><span id="new-lights">${icon('lights')}</span><span id="new-belt">${icon('seatbelt')}</span><span id="new-lock">${icon('lock')}</span><span id="new-cruise" title="Cruise control">CC</span><span id="new-signals" title="Turn signals">↔</span></div><div class="drift-readout"><span>DRIFT</span><b id="drift-score">0</b><small id="drift-combo">×1</small></div><div class="nitro-track" title="Nitro charge"><i id="nitro-fill"></i></div></div></section><nav id="shortcut-widget" class="shortcut-widget movable" aria-label="Quick actions"><button data-command="open phone" aria-label="Buka telepon">▯<small>PHONE</small></button><button data-command="open inventory" aria-label="Buka inventori">▣<small>BAG</small></button><button data-open="music" aria-label="Buka musik">♫<small>F3</small></button><button data-open="appearance" aria-label="Buka pengaturan HUD">⚙<small>F6</small></button></nav><section id="aerial-overlay" class="aerial-overlay" hidden aria-label="Helicopter camera"><div class="camera-top"><b>VCORE / FLIR</b><span id="camera-mode">NORMAL</span></div><div class="camera-reticle"></div><div class="camera-target glass" id="camera-target">NO TARGET</div><div class="camera-hints">Mouse / arrows: pan · Scroll: zoom · Esc: close</div></section>`;
    hud.append(extra);
    const dial = document.querySelector('#new-speed .instrument'), dialNS = 'http://www.w3.org/2000/svg';
    const analog = document.createElementNS(dialNS, 'svg');
    analog.id = 'analog-scale';
    analog.setAttribute('viewBox', '0 0 210 210');
    analog.setAttribute('role', 'meter');
    analog.setAttribute('aria-label', 'Analog speedometer');
    analog.setAttribute('aria-valuemin', '0');
    const dialPoint = (angle, radius) => { const radians = angle * Math.PI / 180; return [105 + Math.sin(radians) * radius, 105 - Math.cos(radians) * radius].map(value => value.toFixed(3)); };
    const dialArc = radius => { const start = dialPoint(-135, radius), end = dialPoint(135, radius); return `M${start.join(' ')} A${radius} ${radius} 0 1 1 ${end.join(' ')}`; };
    const ticks = Array.from({ length: 41 }, (_, i) => { const angle = -135 + i * 6.75, major = i % 5 === 0, a = dialPoint(angle, 94), b = dialPoint(angle, major ? 84 : 89); return `<line class="analog-tick${major ? ' major' : ''}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`; }).join('');
    const labels = Array.from({ length: 5 }, (_, i) => { const [x, y] = dialPoint(-135 + i * 67.5, 74); return `<text data-dial-label="${i}" x="${x}" y="${y}">${i * 40}</text>`; }).join('');
    analog.innerHTML = `<g aria-hidden="true"><path class="dial-rpm-track" d="${dialArc(100)}"/><path id="dial-rpm-arc" d="${dialArc(100)}" pathLength="100"/>${ticks}${labels}<text class="dial-rpm-label" x="105" y="72">RPM <tspan id="dial-rpm-value">0%</tspan></text><g id="analog-needle"><path d="M103 111 104.2 29 105.8 29 107 111Z"/></g><circle class="analog-hub" cx="105" cy="105" r="6"/><circle class="analog-hub-core" cx="105" cy="105" r="2"/></g>`;
    dial.prepend(analog);
    const dialLabels = Array.from(analog.querySelectorAll('[data-dial-label]'));
    let dialUnit;
    const stats = [['health', 'heart', '#ef6c89', 'Health'], ['armor', 'shield', '#718de9', 'Armor'], ['hunger', 'burger', '#edb45a', 'Hunger'], ['thirst', 'drink', '#67d6da', 'Thirst'], ['stress', 'brain', '#c974df', 'Stress'], ['stamina', 'oxygen', '#b5d764', 'Stamina']];
    for (const [key, i, color, label] of stats) {
        const meter = document.createElement('div');
        meter.className = 'ring-stat';
        meter.dataset.stat = key;
        meter.style.setProperty('--stat-color', color);
        meter.setAttribute('role', 'meter');
        meter.setAttribute('aria-label', label);
        meter.setAttribute('aria-valuemin', '0');
        meter.setAttribute('aria-valuemax', '100');
        meter.innerHTML = `<div class="ring-circle">${icon(i)}<b></b></div><span>${label}</span><div class="stat-mini-bar"><i></i></div>`;
        $('ring-status').append(meter);
    }
    const voice = document.createElement('div');
    voice.className = 'ring-voice';
    voice.innerHTML = icon('voice') + '<span id="new-voice-range">N</span>';
    $('ring-status').append(voice);
    for (let n = 0; n < 20; n++)
        $('rpm-strip').append(document.createElement('i'));
    const menu = document.createElement('section');
    menu.id = 'hud-menu';
    menu.hidden = true;
    menu.setAttribute('aria-label', 'Pengaturan HUD');
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-modal', 'true');
    const select = (key, label, options) => `<label class="setting"><span>${label}</span><select data-pref="${key}">${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></label>`;
    menu.innerHTML = `<header class="menu-header"><div><h1>VCORE HUD</h1></div><button id="menu-close" aria-label="Tutup pengaturan HUD">×</button></header>
<div class="menu-body">
<nav class="menu-nav" aria-label="Bagian pengaturan">
<button data-tab="appearance"><span>HUD</span></button><button data-tab="instruments"><span>Tampilan</span></button><button data-tab="vehicle"><span>Kendaraan</span></button><button data-tab="music"><span>Musik</span></button><button data-tab="voice"><span>Suara & kamera</span></button>
</nav>
<div class="menu-content">
<section data-page="appearance"><h2>Pengaturan HUD</h2><p>Atur tampilan HUD sesuai kebutuhanmu.</p><div class="settings-grid">${select('theme','Tema',[['dark','Gelap'],['light','Terang'],['dynamic','Ikuti waktu game']])}<label class="setting"><span>Warna utama</span><input type="color" data-pref="accent"></label><label class="setting"><span>Ukuran seluruh HUD <output id="scale-value">100%</output></span><input type="range" min=".7" max="1.3" step=".05" data-pref="scale"></label>${select('mapMode','Minimap',[['always','Selalu tampil'],['vehicle','Saat berkendara'],['off','Sembunyikan']])}</div><label><input type="checkbox" data-pref="blur"> Efek kaca</label><button id="edit-layout" class="accent-button" type="button">Pindahkan widget <kbd>M</kbd></button><details class="preset-text"><summary>Bagikan preset</summary><textarea id="preset-text" maxlength="20000" aria-label="Isi preset" placeholder="Tempel preset di sini"></textarea><button id="show-preset">Salin pengaturan saat ini</button><button id="paste-preset">Terapkan preset</button></details></section>
<section data-page="instruments" hidden><h2>Tampilan</h2><p>Pilih bentuk HUD dan satuan kecepatan.</p><div class="settings-grid">${select('statusStyle','Bentuk status',[['rings','Lingkaran'],['percentage','Lingkaran dengan angka'],['bars','Bar'],['velox','Ringkas']])}${select('speedStyle','Speedometer',P.choices.speedStyle.map(v=>[v,v==='auto'?'Otomatis':v]))}${select('unit','Satuan kecepatan',[['MPH','MPH'],['KMH','KM/H']])}</div></section>
<section data-page="vehicle" hidden><h2>Kendaraan</h2><p id="vehicle-access">Duduk di kursi pengemudi untuk memakai kontrol ini.</p><div class="vehicle-control-grid" id="vehicle-controls"></div><h3>Pintu & jendela</h3><div class="door-control-grid" id="door-controls"></div><h3>Mode berkendara</h3><div class="mode-buttons">${[['normal','Normal'],['drift','Drift'],['sport','Sport'],['sportplus','Sport Plus']].map(([value,label])=>`<button data-vehicle="mode" data-mode="${value}">${label}</button>`).join('')}</div><div class="limiter-input"><label>Batas kecepatan<input id="limit-speed" type="number" min="10" max="300" value="80"></label><button data-vehicle="limiter">Terapkan</button></div></section>
<section data-page="music" hidden><h2>Musik</h2><p>Tempel link YouTube, lalu tekan Enter untuk memutar.</p><div class="music-now"><span>♫</span><div><b id="music-title">Belum ada lagu</b><small id="music-status" role="status">Berhenti</small></div></div><form id="music-form"><label>Link YouTube<input id="music-url" maxlength="160" placeholder="https://youtube.com/watch?v=…" autocomplete="off"></label><label>Nama lagu (opsional)<input id="track-title" maxlength="80" placeholder="Nama yang muncul di HUD"></label><button class="accent-button" type="submit">Putar</button><button id="queue-track" type="button">Tambah ke antrean</button></form><div class="music-actions"><button data-music="pause">Jeda / lanjut</button><button data-music="stop">Hentikan</button><button data-music="next">Lagu berikutnya</button><button data-music="like">Favorit</button><button id="audio-unmute">Aktifkan suara / coba lagi</button></div><label class="setting volume-setting"><span>Volume <output id="volume-value">35%</output></span><input id="music-volume" type="range" min="0" max="100" value="35"></label><div class="limiter-input"><label>Posisi lagu (detik)<input id="music-position" type="number" min="0" max="21600" value="0"></label><button id="music-seek">Lompat</button></div><div id="music-playlist" class="music-playlist"></div><small id="music-adapter-note">Audio saja. Sebagian video YouTube dibatasi oleh pemiliknya.</small></section>
<section data-page="voice" hidden><h2>Suara & kamera</h2><p>Dua alat kendaraan yang bisa diaktifkan oleh server.</p><h3>Perintah suara kendaraan</h3><p>Ucapkan perintah seperti “engine on” untuk menyalakan mesin. Fitur ini tidak mengatur percakapan dengan pemain lain.</p><form id="voice-form"><label>Coba perintah kendaraan<input id="voice-text" maxlength="160" placeholder="Contoh: engine on"></label><button type="submit" class="accent-button">Jalankan perintah</button></form><button id="record-command" class="accent-button" disabled>Rekam perintah (3 detik)</button><p class="small-note" id="voice-support-note">Rekaman hanya dimulai saat kamu menekan tombol rekam.</p><h3>Kamera helikopter</h3><p id="camera-support-note">Pantau area dari helikopter dengan kamera termal dan lampu sorot. Tersedia sesuai izin server.</p><div class="camera-controls"><button data-aerial="toggle">Buka / tutup kamera</button><button data-aerial="vision" data-mode="normal">Normal</button><button data-aerial="vision" data-mode="thermal">Termal</button><button data-aerial="vision" data-mode="negative">Negatif</button><button data-aerial="spotlight">Lampu sorot</button></div><div class="settings-grid"><label class="setting"><span>Jarak lampu</span><input id="spot-distance" type="range" min="20" max="500" value="200"></label><label class="setting"><span>Lebar sorotan</span><input id="spot-radius" type="range" min="1" max="30" value="10"></label></div></section>
</div></div>
<div class="menu-keyboard-hints"><span><kbd>Q</kbd><kbd>E</kbd> Ganti tab</span><span><kbd>Tab</kbd> Pilih kontrol</span><span><kbd>Enter</kbd><kbd>Spasi</kbd> Gunakan</span><span><kbd>Esc</kbd> Tutup</span></div>
<footer class="menu-footer"><button id="reset-settings">Reset HUD</button><button id="export-settings">Ekspor preset</button><label class="import-preset" tabindex="0" role="button">Impor preset<input id="import-settings" type="file" accept="application/json,.json"></label><span id="save-status">Tersimpan</span><button class="accent-button" id="save-close">Simpan & tutup</button></footer>`;
    document.body.append(menu);
    const musicPanel = document.createElement('section');
    musicPanel.id = 'music-panel';
    musicPanel.hidden = true;
    musicPanel.setAttribute('role', 'dialog');
    musicPanel.setAttribute('aria-modal', 'true');
    musicPanel.setAttribute('aria-label', 'Pemutar musik kendaraan');
    musicPanel.innerHTML = '<header><div><small>VCORE AUDIO</small><h2>Musik kendaraan</h2></div><button id="music-close" type="button" aria-label="Tutup pemutar musik">×</button></header>';
    const musicPage = menu.querySelector('[data-page="music"]');
    musicPage.hidden = false;
    musicPage.querySelector('h2').remove();
    musicPanel.append(musicPage);
    const audioHints = document.createElement('footer');
    audioHints.className = 'music-keyboard-hints';
    audioHints.innerHTML = '<span><kbd>K</kbd> Jeda</span><span><kbd>J</kbd><kbd>L</kbd> Geser lagu</span><span><kbd>N</kbd> Berikutnya</span><span><kbd>Esc</kbd> Tutup</span>';
    musicPanel.append(audioHints);
    document.body.append(musicPanel);
    menu.querySelector('[data-tab="music"]').remove();

    const editBar = document.createElement('div');
    editBar.id = 'edit-bar';
    editBar.hidden = true;
    editBar.innerHTML = '<span>Drag a widget to move it</span><button id="finish-edit">Done editing</button>';
    document.body.append(editBar);
    const previewButton = document.createElement('button');
    previewButton.id = 'settings-preview';
    previewButton.textContent = 'Pengaturan HUD';
    previewButton.hidden = game;
    document.body.append(previewButton);
    const toast = document.createElement('div');
    toast.id = 'hud-toast';
    toast.setAttribute('role', 'status');
    toast.hidden = true;
    document.body.append(toast);
    const vehicleButtons = [['engine', 'Mesin'], ['lock', 'Kunci'], ['seatbelt', 'Sabuk pengaman'], ['signalLeft', '← Sein'], ['hazards', 'Lampu hazard'], ['signalRight', 'Sein →'], ['cruise', 'Cruise'], ['manual', 'Manual'], ['nitro', 'Isi nitro'], ['gearDown', 'Gigi −'], ['gearUp', 'Gigi +']];
    for (const [action, label] of vehicleButtons) {
        const b = document.createElement('button');
        b.dataset.vehicle = action;
        b.textContent = label;
        $('vehicle-controls').append(b);
    }
    for (const [index, label] of [[0, 'Pengemudi'], [1, 'Penumpang'], [2, 'Belakang kiri'], [3, 'Belakang kanan'], [4, 'Kap mesin'], [5, 'Bagasi']]) {
        const b = document.createElement('button');
        b.dataset.vehicle = 'door';
        b.dataset.index = index;
        b.textContent = label;
        $('door-controls').append(b);
        if (index < 4) {
            const w = document.createElement('button');
            w.dataset.vehicle = 'window';
            w.dataset.index = index;
            w.textContent = 'Jendela ' + label.toLowerCase();
            $('door-controls').append(w);
        }
    }
    function notify(text, error = false) { toast.textContent = String(text).slice(0, 160); toast.classList.toggle('error', error); toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.hidden = true, 4000); }
    async function request(name, data) {
        if (name === 'music:action' && data.action === 'stop') trackRequest++;
        if (!game) {
            const result = await previewAction(name, data);
            finishMusicAction(name, data, result);
            return result;
        }
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), name === 'voice:audio' ? 30000 : 8000);
        try {
            const r = await fetch(`https://${GetParentResourceName()}/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(data || {}), signal: controller.signal });
            if (!r.ok)
                throw new Error('HUD callback unavailable');
            const result = await r.json();
            if (result?.message || result?.error)
                notify(result.message || result.error, !result.ok);
            finishMusicAction(name, data, result);
            return result;
        }
        catch (e) {
            notify('Game belum merespons. Coba lagi.', true);
            return { ok: false };
        }
        finally {
            clearTimeout(timer);
        }
    }
    function finishMusicAction(name, data, result) {
        if (name !== 'music:action' || !result?.ok) return;
        if (data.action === 'stop') {
            dismissPlayer = true;
            media.destroy();
            audioBackend.hidden = true;
        }
    }
    function previewAction(name, data) {
        if (name === 'music:action') {
            const result = previewMusic.action(data);
            if (!result.ok) notify(result.error, true);
            return Promise.resolve(result);
        }
        if (name.startsWith('settings:'))
            return Promise.resolve({ ok: true });
        if (name === 'vehicle:action') {
            const fields = { engine: 'engineOn', lock: 'locked', seatbelt: 'seatbelt', cruise: 'cruise', limiter: 'limiter', manual: 'manual' };
            if (fields[data.action])
                window.VeloxUI.update({ [fields[data.action]]: !state[fields[data.action]] });
            if (data.action === 'mode')
                window.VeloxUI.update({ driveMode: data.mode });
            if (['signalLeft', 'signalRight', 'hazards'].includes(data.action))
                window.VeloxUI.update({ signals: state.signals === 'off' ? { signalLeft: 'left', signalRight: 'right', hazards: 'hazards' }[data.action] : 'off' });
        }
        notify(name === 'vehicle:action' ? 'Pratinjau kendaraan diperbarui.' : 'Kontrol ini tersedia saat bermain di server.');
        return Promise.resolve({ ok: true });
    }
    function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(async () => { if (game) {
        const r = await request('settings:save', { preferences: prefs });
        $('save-status').textContent = r.ok ? 'Tersimpan untuk karakter ini' : 'Gagal menyimpan';
    }
    else {
        try {
            localStorage.setItem('velox:preset', JSON.stringify(prefs));
            $('save-status').textContent = 'Tersimpan di browser';
        }
        catch (_) {
            $('save-status').textContent = 'Penyimpanan tidak tersedia';
        }
    } }, 200); }
    function chooseTab(name) {
        if (name !== 'music' && !menu.querySelector(`[data-page="${name}"]`)) name = 'appearance';
        activeTab = name;
        menu.querySelectorAll('[data-page]').forEach(node => { node.hidden = node.dataset.page !== name; });
        menu.querySelectorAll('[data-tab]').forEach(node => { node.classList.toggle('selected', node.dataset.tab === name); });
        menu.hidden = !open || editing || name === 'music';
        musicPanel.hidden = !open || editing || name !== 'music';
        root.classList.toggle('minimap-audio-open', !musicPanel.hidden);
        if (window.HudAudioWidget) {
            render(state);
            window.HudAudioWidget.refresh();
        }
    }
    function setOpen(value, tab = activeTab) {
        const wasEditing = editing;
        open = value;
        if (!value) {
            editing = false;
            root.classList.remove('layout-editing');
            editBar.hidden = true;
        }
        chooseTab(tab);
        root.classList.toggle('menu-open', value);
        if (value && !editing) {
            syncSettings();
            (activeTab === 'music' ? $('music-url') : $('menu-close')).focus();
        }
        if (wasEditing && !editing) window.dispatchEvent(new CustomEvent('velox:editing', { detail: { editing: false } }));
    }
    function setEditing(value) {
        if (value && !open)
            return;
        editing = !!value;
        if (editing && activeTab === 'music') activeTab = 'appearance';
        chooseTab(activeTab);
        root.classList.toggle('layout-editing', editing);
        editBar.hidden = true;
        if (!editing && open) {
            persist();
            syncSettings();
        }
        window.dispatchEvent(new CustomEvent('velox:editing', { detail: { editing } }));
        if (!editing && open) {
            const trigger = [$('edit-layout')].find(node => node && !node.disabled && node.getClientRects().length);
            (trigger || $('menu-close')).focus();
        }
    }
    async function openMenu(tab = 'appearance') { if (game) {
        const r = await request('settings:open', { tab });
        if (r?.ok === false)
            return;
    } setOpen(true, tab); }
    async function closeMenu() { clearTimeout(saveTimer); if (game) {
        const r = await request('settings:save', { preferences: prefs });
        if (!r.ok)
            return;
        await request('settings:close', {});
    }
    else {
        try {
            localStorage.setItem('velox:preset', JSON.stringify(prefs));
        }
        catch (_) { }
    } window.HudSpeech.stop(); setOpen(false); }
    function syncSettings() { menu.querySelectorAll('[data-pref]').forEach(el => { if (el.type === 'checkbox')
        el.checked = prefs[el.dataset.pref];
    else
        el.value = prefs[el.dataset.pref]; }); $('scale-value').textContent = Math.round(prefs.scale * 100) + '%'; menu.querySelectorAll('[data-layout]').forEach(b => b.classList.toggle('selected', b.dataset.layout === prefs.layout)); }
    function applyPreferences(input, save = false) { prefs = P.normalize(input, prefs); root.dataset.layout = prefs.layout; root.dataset.statusStyle = prefs.statusStyle; root.dataset.statusPlacement = prefs.statusPlacement; root.dataset.identityShape = prefs.identityShape; root.dataset.moneyShape = prefs.moneyShape; root.dataset.cashShape = prefs.cashShape; root.dataset.bankShape = prefs.bankShape; root.dataset.shortcutShape = prefs.shortcutShape; root.style.setProperty('--accent', prefs.accent); root.classList.toggle('soft-glass', prefs.blur); syncSettings(); if (!game && prefs.unit !== state.unit)
        window.VeloxUI.update({ unit: prefs.unit, speed: state.speed * (prefs.unit === 'KMH' ? 1.609344 : 1 / 1.609344) });
    else
        render(state); window.dispatchEvent(new CustomEvent('velox:preferences', { detail: prefs })); if (save)
        persist(); }
    function position(el, name, width, height) { const point = P.position(innerWidth, innerHeight, prefs, name, width, height); el.style.left = point.left + 'px'; el.style.top = point.top + 'px'; el.style.transform = `scale(${point.scale})`; el.style.transformOrigin = 'top left'; }
    function render(data) {
        state = data;
        const theme = prefs.theme === 'dynamic' ? (Number(state.worldTime.split(':')[0]) >= 6 && Number(state.worldTime.split(':')[0]) < 19 ? 'light' : 'dark') : prefs.theme;
        root.dataset.theme = theme;
        const g = P.radar(innerWidth, innerHeight, prefs);
        root.style.setProperty('--hud-scale', g.scale);
        radar.style.left = g.widgetLeft + 'px';
        radar.style.top = g.widgetTop + 'px';
        radar.style.right = 'auto';
        radar.style.width = g.widgetWidth + 'px';
        radar.style.height = g.widgetHeight + 'px';
        radar.style.transform = `scale(${g.scale})`;
        radar.style.transformOrigin = 'top left';
        const bezel = document.querySelector('.radar-bezel');
        bezel.style.left = g.frameX + 'px';
        bezel.style.top = g.frameY + 'px';
        bezel.style.setProperty('--map-inset', g.inset + 'px');
        bezel.style.width = g.frameWidth + 'px';
        bezel.style.height = g.frameHeight + 'px';
        radar.hidden = !(open && !editing && activeTab === 'music') && (prefs.mapMode === 'off' || (prefs.mapMode === 'vehicle' && !state.inVehicle));
        $('world-clock').textContent = state.worldTime;
        $('compass-letter').textContent = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(state.heading / 45) % 8];
        $('weather-icon').textContent = /RAIN|THUNDER/.test(state.weather) ? '☂' : /SNOW|BLIZZARD/.test(state.weather) ? '❄' : /CLOUD|FOG|OVERCAST/.test(state.weather) ? '☁' : '☀';
        $('identity-widget').hidden = !prefs.showIdentity;
        document.querySelector('.identity-top').hidden = !prefs.showIdentity;
        document.querySelector('.identity-person').hidden = !prefs.showIdentity;
        position($('identity-widget'), 'identity', 236, 108);
        $('date-chip').textContent = state.date;
        $('player-id').textContent = state.playerId;
        $('player-name').textContent = state.playerName;
        $('player-job').textContent = [state.job, state.jobGrade].filter(Boolean).join(' · ');
        $('cash-value').textContent = '$' + Math.round(state.cash).toLocaleString('en-US');
        $('bank-value').textContent = '$' + Math.round(state.bank).toLocaleString('en-US');
        position($('shortcut-widget'), 'shortcuts', 48, 264);
        $('shortcut-widget').hidden = !prefs.showShortcuts;
        const original = document.querySelector('.vitals-widget');
        original.hidden = !prefs.showVitals || prefs.statusStyle !== 'velox';
        position(original, 'vitals', 352, 67);
        $('ring-status').hidden = !prefs.showVitals || prefs.statusStyle === 'velox';
        position($('ring-status'), 'vitals', 430, prefs.statusStyle === 'bars' ? 100 : 60);
        for (const [key] of stats) {
            const el = $('ring-status').querySelector(`[data-stat="${key}"]`), value = key === 'stamina' && state.diving ? state.oxygen : state[key];
            el.style.setProperty('--percent', value + '%');
            el.querySelector('b').textContent = Math.round(value);
            el.querySelector('.stat-mini-bar i').style.width = value + '%';
            el.classList.toggle('low', key === 'stress' ? value >= 80 : value <= 20);
            el.setAttribute('aria-valuenow', Math.round(value));
            if (key === 'stamina') {
                el.setAttribute('aria-label', state.diving ? 'Oxygen' : 'Stamina');
                el.querySelector('span').textContent = state.diving ? 'Oxygen' : 'Stamina';
            }
        }
        voice.classList.toggle('talking', state.talking);
        $('new-voice-range').textContent = state.voiceRange <= 1 ? 'W' : state.voiceRange >= 3 ? 'S' : 'N';
        let style = prefs.speedStyle === 'auto' ? (state.driveMode === 'drift' ? 'drift' : { car: 'bar', moto: 'moto', boat: 'boat', plane: 'plane', heli: 'heli' }[state.vehicleType]) : prefs.speedStyle;
        root.dataset.speedStyle = style;
        const originalSpeed = $('vehicle-widget');
        originalSpeed.hidden = !prefs.showVehicle || !state.inVehicle || style !== 'velox';
        position(originalSpeed, 'vehicle', 224, 151);
        $('new-speed').hidden = !prefs.showVehicle || !state.inVehicle || style === 'velox';
        const size = window.HudInstruments?.dimensions(style);
        position($('new-speed'), 'vehicle', size?.width ?? (style === 'dial' ? 210 : style === 'minimal' || style === 'bar' ? 196 : 246), size?.height ?? (style === 'dial' ? 250 : style === 'minimal' ? 196 : style === 'bar' ? 112 : 210));
        const speed = state.speed * (prefs.unit === state.unit ? 1 : prefs.unit === 'KMH' ? 1.609344 : 1 / 1.609344);
        $('new-speed-value').textContent = Math.round(speed).toString().padStart(style === 'digital' || style === 'drift' ? 3 : 1, '0');
        $('new-speed-unit').textContent = prefs.unit === 'KMH' ? 'KM/H' : 'MPH';
        $('new-gear').textContent = state.gear === '0' ? 'N' : state.gear;
        $('speed-class').textContent = state.vehicleType.toUpperCase();
        $('drive-mode').textContent = state.manual ? 'MANUAL' : state.driveMode === 'normal' ? 'AUTO' : state.driveMode.toUpperCase();
        $('new-speed').style.setProperty('--rpm', state.rpm);
        $('new-speed').style.setProperty('--fuel', state.fuel + '%');
        $('new-fuel-fill').style.width = state.fuel + '%';
        $('new-fuel-value').textContent = Math.round(state.fuel);
        $('rpm-strip').querySelectorAll('i').forEach((el, i) => el.classList.toggle('lit', i < state.rpm * 20));
        const dialMax = prefs.unit === 'KMH' ? 240 : 160;
        if (dialUnit !== prefs.unit) {
            dialLabels.forEach((label, i) => label.textContent = String(i * dialMax / 4));
            dialUnit = prefs.unit;
            analog.setAttribute('aria-valuemax', String(dialMax));
        }
        $('analog-needle').style.transform = `rotate(${-135 + Math.min(1, Math.max(0, speed / dialMax)) * 270}deg)`;
        analog.setAttribute('aria-valuenow', String(Math.min(dialMax, Math.round(speed))));
        analog.setAttribute('aria-valuetext', `${Math.round(speed)} ${prefs.unit === 'KMH' ? 'kilometers' : 'miles'} per hour`);
        $('dial-rpm-arc').style.strokeDasharray = `${state.rpm * 100} 100`;
        $('dial-rpm-value').textContent = Math.round(state.rpm * 100) + '%';
        for (const [id, on] of [['lights', state.lights], ['belt', state.seatbelt], ['lock', state.locked], ['cruise', state.cruise]])
            $('new-' + id).classList.toggle('active', on);
        $('new-belt').hidden = !state.seatbeltAvailable;
        $('new-belt').classList.toggle('warning', !state.seatbelt);
        $('new-lights').classList.toggle('highbeam', state.highbeams);
        $('new-signals').textContent = state.signals === 'left' ? '←' : state.signals === 'right' ? '→' : '↔';
        $('new-signals').classList.toggle('active', state.signals !== 'off');
        $('nitro-fill').style.width = state.nitro + '%';
        $('new-speed').classList.toggle('boosting', state.boosting);
        $('drift-score').textContent = Math.round(state.driftScore).toLocaleString();
        $('drift-combo').textContent = '×' + Number(state.driftCombo).toFixed(1);
        $('altitude-value').textContent = Math.round(state.altitude);
        $('vertical-value').textContent = Number(state.verticalSpeed).toFixed(1);
        $('horizon-line').style.transform = `translateY(${state.pitch * .4}px) rotate(${-state.roll}deg)`;
        $('vehicle-access').textContent = state.inVehicle ? 'Kontrol berlaku pada kendaraan yang kamu kemudikan.' : 'Masuk kendaraan untuk memakai kontrol ini.';
        menu.querySelectorAll('[data-vehicle]').forEach(b => b.disabled = game && !state.inVehicle);
    }
    const audioBackend = document.createElement('div');
    audioBackend.id = 'music-audio-backend';
    audioBackend.hidden = true;
    audioBackend.setAttribute('aria-hidden', 'true');
    const mediaHost = document.createElement('div');
    mediaHost.id = 'music-embed';
    mediaHost.hidden = true;
    audioBackend.append(mediaHost);
    document.body.append(audioBackend);
    function syncAudioState() {
        audioBackend.hidden = dismissPlayer || mediaHost.hidden || !state.visible || !prefs.showMusic;
    }
    function getMusicState() {
        return { ...music, playback: { ...mediaStatus }, canControl: !game || music.canControl === true, inVehicle: state.inVehicle };
    }
    function emitMusic() {
        window.dispatchEvent(new CustomEvent('velox:music', { detail: getMusicState() }));
    }
    function showMusicStatus() {
        const states = { idle: 'Berhenti', loading: 'Memuat lagu…', buffering: 'Memuat audio…', playing: 'Sedang diputar', paused: 'Dijeda', blocked: 'Tekan Aktifkan suara untuk memutar', error: 'Tidak dapat memutar', ended: 'Lagu selesai', external: music.playing ? 'Menunggu pemutar server…' : 'Dijeda', preview: 'Pratinjau · audio dimainkan di FiveM' };
        $('music-status').textContent = mediaStatus.message || states[mediaStatus.state] || 'Berhenti';
        $('music-mini-status').textContent = states[mediaStatus.state] || 'Pilih lagu';
        $('audio-unmute').hidden = !['error', 'blocked'].includes(mediaStatus.state);
        emitMusic();
    }
    const media = (game ? window.HudMedia : window.HudBoombox).create(mediaHost, notify, () => {
        if (music.canControl === true) request('music:action', { action: Array.isArray(music.playlist) && music.playlist.length ? 'next' : 'stop' });
    }, status => {
        mediaStatus = status;
        showMusicStatus();
        syncAudioState();
    });
    new MutationObserver(() => {
        syncAudioState();
        mediaHost.querySelectorAll('iframe').forEach(frame => { frame.tabIndex = -1; });
    }).observe(mediaHost, { attributes: true, attributeFilter: ['hidden'], childList: true });
    previewMusic = game ? null : window.HudMedia.createPreview(data => syncMusic({ ...data, adapter: 'nui' }));
    window.addEventListener('pagehide', () => { previewMusic?.destroy(); media.destroy(); });
    function syncMusic(data) {
        if (!data || typeof data !== 'object')
            return;
        music = { ...music, ...data };
        music.volume = window.HudMedia.bounded(music.volume, 0, 1);
        $('music-title').textContent = String(music.title || 'Belum ada lagu').slice(0, 80);
        $('music-mini-title').textContent = String(music.title || 'Musik kendaraan').slice(0, 80);
        $('music-mini-play').textContent = music.playing ? 'Ⅱ' : '▷';
        if (document.activeElement !== $('music-volume'))
            $('music-volume').value = Math.round(music.volume * 100);
        $('volume-value').textContent = Math.round(music.volume * 100) + '%';
        if (music.playing) dismissPlayer = false;
        if (music.adapter === 'cs-boombox') {
            if (playbackAdapter !== 'cs-boombox') media.destroy();
            const identity = [music.vehicleNetId, music.boomboxNetId, music.boomboxGeneration, music.videoId].join(':');
            if (!game) mediaStatus = { state: music.videoId ? 'preview' : 'idle' };
            else if (identity !== playbackIdentity) mediaStatus = { state: music.videoId ? 'loading' : 'idle' };
            else if (!music.playing && !['error', 'ended'].includes(mediaStatus.state)) mediaStatus = { state: music.position > 0 ? 'paused' : 'idle' };
            playbackIdentity = identity;
            playbackAdapter = 'cs-boombox';
        } else {
            playbackAdapter = music.adapter;
            if (!dismissPlayer && state.visible && prefs.showMusic) media.sync(music);
            else media.destroy();
        }
        syncAudioState();
        showMusicStatus();
        musicPanel.querySelector('[data-music=like]').classList.toggle('selected', music.liked === true);
        $('music-adapter-note').textContent = music.adapter === 'cs-boombox' ? (game ? 'Audio kendaraan diputar oleh cs-boombox.' : 'Pratinjau HUD. Audio cs-boombox berjalan di server FiveM.') : music.adapter === 'xsound' ? 'Musik mengikuti kendaraan dan terdengar oleh pemain di sekitar.' : 'Audio saja. Sebagian video YouTube dibatasi oleh pemiliknya.';
        $('music-playlist').replaceChildren();
        if (Array.isArray(music.playlist))
            for (const track of music.playlist.slice(0, 50)) {
                const b = document.createElement('button');
                b.textContent = String(track.title || track.videoId || track).slice(0, 80);
                b.addEventListener('click', () => request('music:action', { action: 'play', videoId: track.videoId, title: track.title }));
                $('music-playlist').append(b);
            }
    }
    const extractVideoId = text => Array.isArray(services.mediaChoices) && services.mediaChoices.some(item => item.key === text.trim()) ? text.trim() : window.HudMedia.videoId(text);
    const menuClick = async (e) => { const b = e.target.closest('button'); if (!b)
        return; if (b.dataset.tab)
        chooseTab(b.dataset.tab); if (b.dataset.layout)
        applyPreferences({ layout: b.dataset.layout }, true); if (b.dataset.vehicle && ['cruise', 'nitro'].includes(b.dataset.vehicle)) {
        await closeMenu();
        if (open)
            return;
    } if (b.dataset.vehicle)
        await request('vehicle:action', { action: b.dataset.vehicle, index: b.dataset.index ? Number(b.dataset.index) : undefined, mode: b.dataset.mode, speed: b.dataset.vehicle === 'limiter' ? Number($('limit-speed').value) : undefined }); if (b.dataset.aerial)
        await request('aerial:action', { action: b.dataset.aerial, mode: b.dataset.mode }); if (b.dataset.music)
        await request('music:action', { action: b.dataset.music === 'pause' && !music.playing ? 'play' : b.dataset.music }); };
    menu.addEventListener('click', menuClick);
    musicPanel.addEventListener('click', menuClick);
    menu.querySelectorAll('[data-pref]').forEach(el => el.addEventListener('input', () => applyPreferences({ [el.dataset.pref]: el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value }, true)));
    document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openMenu(b.dataset.open)));
    document.querySelectorAll('[data-command]').forEach(b => b.addEventListener('click', () => request('shortcut:action', { action: b.dataset.command === 'open phone' ? 'phone' : 'inventory' })));
    $('settings-preview').addEventListener('click', () => openMenu());
    $('menu-close').addEventListener('click', closeMenu);
    $('music-close').addEventListener('click', closeMenu);
    $('save-close').addEventListener('click', closeMenu);
    $('reset-settings').addEventListener('click', async () => { let response; if (game) {
        response = await request('settings:reset', {});
        if (!response.ok)
            return;
    } prefs = P.normalize(game ? response.preferences : P.defaults); applyPreferences(prefs, !game); notify('HUD dikembalikan ke pengaturan awal.'); });
    $('export-settings').addEventListener('click', () => { const blob = new Blob([JSON.stringify(prefs, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'vcore-hud-preset.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
    $('import-settings').addEventListener('change', async (e) => { const file = e.target.files[0]; if (!file)
        return; try {
        if (file.size > 20000)
            throw new Error('Ukuran preset terlalu besar.');
        applyPreferences(P.parse(await file.text()), true);
        notify('Preset diterapkan.');
    }
    catch (err) {
        notify(err.message, true);
    } e.target.value = ''; });
    $('show-preset').addEventListener('click', () => { $('preset-text').value = JSON.stringify(prefs, null, 2); $('preset-text').focus(); $('preset-text').select(); });
    $('paste-preset').addEventListener('click', () => { try {
        applyPreferences(P.parse($('preset-text').value), true);
        notify('Preset diterapkan.');
    }
    catch (error) {
        notify(error.message, true);
    } });
    $('record-command').addEventListener('click', async () => { const b = $('record-command'); b.disabled = true; b.textContent = 'Merekam…'; try {
        const audio = await window.HudSpeech.record();
        b.textContent = 'Memproses perintah…';
        const result = await request('voice:audio', { audio, mime: 'audio/wav' });
        if (result.text)
            $('voice-text').value = result.text;
    }
    catch (error) {
        notify(error.message, true);
    }
    finally {
        b.disabled = !game || services.speechEnabled !== true;
        b.textContent = 'Rekam perintah (3 detik)';
    } });
    async function submitTrack(action) {
        const videoId = extractVideoId($('music-url').value);
        if (!videoId) { notify('Masukkan link YouTube yang valid.', true); return; }
        const token = ++trackRequest;
        $('music-status').textContent = 'Mengambil judul lagu…';
        const info = await window.HudMedia.metadata(videoId);
        if (token !== trackRequest) return;
        const title = info?.title || $('track-title').value || 'YouTube · ' + videoId;
        request('music:action', { action, videoId, title });
    }
    $('music-form').addEventListener('submit', event => { event.preventDefault(); submitTrack('play'); });
    $('queue-track').addEventListener('click', () => submitTrack('playlist'));
    $('music-seek').addEventListener('click', () => request('music:action', { action: 'seek', position: Number($('music-position').value) }));
    $('voice-form').addEventListener('submit', e => { e.preventDefault(); request('voice:command', { text: $('voice-text').value }); });
    $('music-volume').addEventListener('change', () => request('music:action', { action: 'volume', volume: Number($('music-volume').value) / 100 }));
    $('music-volume').addEventListener('input', () => $('volume-value').textContent = $('music-volume').value + '%');
    $('audio-unmute').addEventListener('click', () => music.adapter === 'cs-boombox' ? request('music:action', { action: 'play' }) : media.enableSound());
    for (const id of ['spot-distance', 'spot-radius'])
        $(id).addEventListener('change', () => request('aerial:action', { action: 'settings', distance: Number($('spot-distance').value), radius: Number($('spot-radius').value) }));
    let mediaVisible = state.visible && prefs.showMusic;
    function syncPlaybackVisibility() {
        const allowed = state.visible && prefs.showMusic;
        if (allowed !== mediaVisible) {
            mediaVisible = allowed;
            if (!allowed) media.destroy();
            else if (!dismissPlayer && music.adapter !== 'cs-boombox') media.sync(game ? music : previewMusic.snapshot());
        }
        syncAudioState();
    }
    window.addEventListener('velox:render', e => { render(e.detail); syncPlaybackVisibility(); });
    window.addEventListener('velox:preferences', syncPlaybackVisibility);
    window.addEventListener('resize', () => render(state));
    window.addEventListener('message', e => { if (e.source && e.source !== window)
        return; const m = e.data; if (!m || typeof m !== 'object')
        return; if (m.action === 'hud:preferences')
        applyPreferences(m.data); if (m.action === 'hud:settings' && typeof m.data?.open === 'boolean') {
        if (!m.data.open)
            window.HudSpeech.stop();
        setOpen(m.data.open, m.data.tab || activeTab);
    } if (m.action === 'hud:music')
        syncMusic(m.data); if (m.action === 'hud:notice' || m.action === 'hud:voiceResult' || m.action === 'hud:shortcutResult')
        notify(m.data?.message || '', m.data?.ok === false); if (m.action === 'hud:servicesConfig' && m.data) {
        services = m.data;
        $('music-adapter-note').textContent = services.musicEnabled ? (services.musicAdapter === 'xsound' ? 'Musik mengikuti kendaraan.' : 'Audio saja. Sebagian video YouTube dibatasi oleh pemiliknya.') : 'Musik dinonaktifkan oleh server.';
        $('record-command').disabled = !game || services.speechEnabled !== true;
        $('voice-support-note').textContent = services.speechEnabled ? 'Tekan Rekam untuk mengucapkan perintah kendaraan.' : 'Rekaman perintah suara belum diaktifkan oleh server.';
        $('camera-support-note').textContent = services.aerialEnabled ? 'Gunakan dari kursi helikopter yang diizinkan server.' : 'Kamera helikopter dinonaktifkan oleh server.';
        $('voice-form').querySelectorAll('input,button').forEach(control => { control.disabled = services.voiceCommands !== true; });
        musicPanel.querySelectorAll('#music-form input,#music-form button,[data-music],#music-volume,#music-seek,#music-position,#audio-unmute').forEach(control => { control.disabled = services.musicEnabled === false; });
        menu.querySelectorAll('[data-aerial]').forEach(b => b.disabled = !services.aerialEnabled || (b.dataset.mode === 'negative' && !services.negativeAvailable));
    } if (m.action === 'hud:aerial' && m.data && typeof m.data === 'object') {
        const a = m.data;
        if (a.active && !aerialActive && open)
            closeMenu();
        aerialActive = !!a.active;
        $('aerial-overlay').hidden = !a.active;
        $('camera-mode').textContent = String(a.vision || 'normal').toUpperCase();
        $('camera-target').textContent = a.target?.jammed ? 'SIGNAL JAMMED' : a.target ? `${a.target.kind || 'TARGET'} · ${String(a.target.label || '').slice(0, 60)} · ${Math.round(a.target.distance || 0)} M${a.target.masked ? ' · MASKED' : ''}` : 'NO TARGET';
    } });
    function menuControls() {
        const surface = activeTab === 'music' ? musicPanel : menu;
        return [...surface.querySelectorAll('button,input,select,textarea,summary,[tabindex="0"]')].filter(node => !node.disabled && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
    }
    function refreshBindings() {
        const selectors = { phone: '#shortcut-widget [data-command="open phone"]', inventory: '#shortcut-widget [data-command="open inventory"]', music: '#shortcut-widget [data-open="music"]', settings: '#shortcut-widget [data-open="appearance"]' };
        for (const [name, selector] of Object.entries(selectors)) {
            const button = document.querySelector(selector), binding = shortcutConfig[name];
            if (!button || !binding) continue;
            button.disabled = binding.enabled === false;
            const badge = button.querySelector('small');
            if (badge) { badge.textContent = binding.key; badge.hidden = !binding.key; }
        }
        for (const [selector, name] of [['.radio-orbit', 'music'], ['.cursor-orbit', 'settings']]) {
            const button = document.querySelector(selector), binding = shortcutConfig[name];
            if (!button || !binding) continue;
            button.disabled = binding.enabled === false;
            const badge = button.querySelector('small');
            if (badge) { badge.textContent = binding.key; badge.hidden = !binding.key; }
        }
    }
    window.addEventListener('message', event => {
        if (event.source && event.source !== window) return;
        const data = event.data;
        if (data?.action !== 'hud:config' || !data.data) return;
        if (typeof data.data.settingsKey === 'string') settingsKey = data.data.settingsKey.slice(0, 24).toUpperCase();
        for (const key of Object.keys(shortcutConfig)) {
            const next = data.data.shortcuts?.[key];
            if (next && typeof next.key === 'string' && typeof next.enabled === 'boolean') shortcutConfig[key] = { key: next.key.slice(0, 24), enabled: next.enabled };
        }
        if (typeof data.data.voiceRangeKey === 'string') {
            document.querySelectorAll('.ring-voice,.voice-orbit,#voice-display').forEach(node => { node.title = data.data.voiceRangeKey ? 'Jarak bicara: ' + data.data.voiceRangeKey : 'Indikator jarak bicara'; });
        }
        refreshBindings();
    });
    window.addEventListener('message', event => {
        if (event.source && event.source !== window) return;
        const data = event.data;
        if (data?.action !== 'hud:musicStatus' || music.adapter !== 'cs-boombox') return;
        const value = data.data;
        if (!value || value.vehicleNetId !== music.vehicleNetId || value.videoId !== music.videoId || value.boomboxNetId !== music.boomboxNetId || value.boomboxGeneration !== music.boomboxGeneration) return;
        if (!['idle', 'loading', 'buffering', 'playing', 'paused', 'blocked', 'error', 'ended'].includes(value.state)) return;
        mediaStatus = { state: value.state, message: typeof value.message === 'string' ? value.message.slice(0, 240) : '', errorCode: value.errorCode };
        if (Number.isFinite(value.time)) mediaStatus.time = Math.max(0, Math.min(21600, value.time));
        if (Number.isFinite(value.duration)) mediaStatus.duration = Math.max(0, Math.min(21600, value.duration));
        showMusicStatus();
    });
    document.addEventListener('keydown', event => {
        if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
        const textInput = event.target.closest('textarea,input:not([type=checkbox]):not([type=range]):not([type=color]),[contenteditable=true]');
        const key = event.key.toUpperCase();
        if (settingsKey && key === settingsKey && (!textInput || settingsKey.length > 1)) {
            event.preventDefault();
            if (!event.repeat) open ? closeMenu() : openMenu();
            return;
        }
        if (!open) {
            if (!game && !textInput && shortcutConfig.music.key && key === shortcutConfig.music.key.toUpperCase()) { event.preventDefault(); openMenu('music'); }
            return;
        }
        if (editing) return;
        if (event.key === 'Escape') { event.preventDefault(); closeMenu(); return; }
        if (event.key === 'Tab') {
            const controls = menuControls();
            const index = controls.indexOf(document.activeElement);
            if (controls.length) { event.preventDefault(); controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus(); }
            return;
        }
        if (textInput) return;
        if (activeTab === 'music') {
            if (key === 'K') { event.preventDefault(); request('music:action', { action: music.playing ? 'pause' : 'play' }); }
            else if (key === 'N') { event.preventDefault(); request('music:action', { action: 'next' }); }
            else if (key === 'J' || key === 'L') { event.preventDefault(); request('music:action', { action: 'seek', position: Math.max(0, Math.min(21600, (mediaStatus.time ?? music.position ?? 0) + (key === 'L' ? 10 : -10))) }); }
            return;
        }
        if (key === 'Q' || key === 'E') {
            event.preventDefault();
            const tabs = [...menu.querySelectorAll('[data-tab]')].filter(node => !node.disabled);
            const index = tabs.findIndex(node => node.dataset.tab === activeTab);
            const next = tabs[(index + (key === 'E' ? 1 : -1) + tabs.length) % tabs.length];
            if (next) { chooseTab(next.dataset.tab); next.focus(); }
        } else if (key === 'M') {
            event.preventDefault();
            if (!event.repeat) $('edit-layout').click();
        } else if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.import-preset')) {
            event.preventDefault();
            $('import-settings').click();
        }
    });
    window.VeloxDashboard = { getPreferences: () => P.normalize(prefs), applyPreferences, openMenu, setEditing, isEditing: () => editing, isOpen: () => open, closeMenu, refreshBindings, getMusicState, musicAction: data => request('music:action', data), extractVideoId };
    applyPreferences(prefs);
    syncMusic(game ? music : { ...previewMusic.snapshot(), adapter: 'nui' });
    requestAnimationFrame(refreshBindings);
})();
