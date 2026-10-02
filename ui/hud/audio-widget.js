(function () {
    'use strict';

    const hud = document.getElementById('hud');
    const dashboard = window.VeloxDashboard;
    const preferences = window.HudPreferences;
    const openButton = document.querySelector('button.music-mini');
    if (!hud || !dashboard || !preferences || !openButton || window.HudAudioWidget) return;

    const widget = document.createElement('section');
    widget.id = 'audio-widget';
    widget.className = 'glass music-mini audio-widget';
    widget.setAttribute('aria-label', 'Musik kendaraan');
    const playLabel = document.getElementById('music-mini-play');
    openButton.className = 'audio-widget-open';
    openButton.type = 'button';
    openButton.setAttribute('aria-label', 'Buka pemutar musik');
    openButton.removeAttribute('aria-haspopup');
    openButton.setAttribute('aria-controls', 'music-panel');
    openButton.title = 'Buka pemutar musik';
    const disc = openButton.querySelector('.music-disc');
    disc.textContent = '';
    disc.setAttribute('aria-hidden', 'true');
    openButton.querySelector('#music-mini-title').parentElement.classList.add('audio-widget-copy');

    const svg = path => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
    const controls = document.createElement('div');
    controls.className = 'audio-widget-controls';
    controls.setAttribute('aria-label', 'Kontrol musik');
    controls.innerHTML = `<button type="button" data-audio-action="restart" aria-label="Ulangi lagu" title="Ulangi lagu">${svg('M5 4v16M19 5 8 12l11 7Z')}</button><button type="button" data-audio-action="toggle" aria-label="Putar lagu" title="Putar lagu"></button><button type="button" data-audio-action="next" aria-label="Lagu berikutnya" title="Lagu berikutnya">${svg('M19 4v16M5 5l11 7-11 7Z')}</button>`;
    const toggle = controls.querySelector('[data-audio-action="toggle"]');
    toggle.append(playLabel);
    widget.append(openButton, controls);
    hud.append(widget);

    const panel = document.getElementById('music-panel');
    const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
    let music = dashboard.getMusicState?.() || {};
    const bezel = document.querySelector('.radar-bezel');
    if (panel && bezel) {
        bezel.append(panel);
        panel.removeAttribute('aria-modal');
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'Musik dalam minimap');
        panel.classList.add('minimap-audio-panel');
        panel.querySelector('header small')?.remove();
        const heading = panel.querySelector('header h2');
        if (heading) heading.textContent = 'Musik';
        const page = panel.querySelector('[data-page="music"]');
        page.querySelector(':scope > p')?.remove();
        const queueButton = document.createElement('button');
        queueButton.type = 'button';
        queueButton.id = 'audio-queue-toggle';
        queueButton.textContent = 'Antrean';
        queueButton.setAttribute('aria-expanded', 'false');
        queueButton.setAttribute('aria-controls', 'music-playlist');
        panel.querySelector('header').insertBefore(queueButton, document.getElementById('music-close'));
        const queue = document.getElementById('music-playlist');
        queue.hidden = true;
        queueButton.addEventListener('click', () => {
            queue.hidden = !queue.hidden;
            panel.classList.toggle('show-audio-queue', !queue.hidden);
            queueButton.setAttribute('aria-expanded', String(!queue.hidden));
        });
        const urlLabel = document.getElementById('music-url').parentElement;
        urlLabel.classList.add('audio-url-field');
        document.getElementById('music-url').setAttribute('aria-label', 'Link YouTube');
        document.getElementById('music-url').placeholder = 'Tempel link YouTube';
        const titleLabel = document.getElementById('track-title').parentElement;
        titleLabel.hidden = true;
        document.getElementById('music-position').closest('.limiter-input').hidden = true;
        document.getElementById('music-adapter-note').hidden = true;
        const add = document.getElementById('queue-track');
        add.textContent = '+';
        add.setAttribute('aria-label', 'Tambah lagu ke antrean');
    }
    function positionPanel() {
        if (!panel || !bezel) return;
        const opened = !panel.hidden;
        document.documentElement.classList.toggle('minimap-audio-open', opened);
        bezel.classList.toggle('audio-dock-open', opened);
        document.querySelectorAll('.map-tabs [data-open="music"]').forEach(button => button.setAttribute('aria-pressed', String(opened)));
    }
    function schedulePanel() { positionPanel(); }

    function renderLayout() {
        const prefs = dashboard.getPreferences();
        const scale = preferences.scale(innerWidth, innerHeight, prefs);
        const anchorPrefs = preferences.normalize({ layout: prefs.layout, scale: prefs.scale, statusStyle: 'rings', statusPlacement: 'standalone' });
        const anchor = preferences.radar(innerWidth, innerHeight, anchorPrefs);
        const circle = prefs.layout === 'circle';
        const width = circle ? 280 : 360;
        const extraScale = prefs.elementOptions?.music?.scale || 1;
        const left = anchor.widgetLeft + (circle ? 26 : 0) * scale;
        const top = anchor.widgetTop - (circle ? 66 : 0) * scale;
        widget.hidden = !prefs.showMusic;
        widget.style.width = width + 'px';
        widget.style.left = clamp(left, 0, Math.max(0, innerWidth - width * scale * extraScale)) + 'px';
        widget.style.top = clamp(top, 0, Math.max(0, innerHeight - 62 * scale * extraScale)) + 'px';
        widget.style.transform = `scale(${scale})`;
        widget.style.transformOrigin = 'top left';
        schedulePanel();
    }

    function renderMusic(value = music) {
        music = value && typeof value === 'object' ? value : {};
        const hasTrack = typeof music.videoId === 'string' && music.videoId.length > 0;
        const allowed = hasTrack && music.canControl !== false;
        const playback = music.playback?.state || music.status?.state;
        widget.dataset.playback = playback || (hasTrack ? 'paused' : 'idle');
        widget.classList.toggle('audio-is-playing', playback === 'playing');
        controls.querySelector('[data-audio-action="restart"]').disabled = !allowed;
        toggle.disabled = !allowed;
        const label = music.playing ? 'Jeda lagu' : 'Lanjutkan lagu';
        toggle.setAttribute('aria-label', label);
        toggle.title = label;
        controls.querySelector('[data-audio-action="next"]').disabled = !allowed || !Array.isArray(music.playlist) || music.playlist.length === 0;
        openButton.setAttribute('aria-expanded', String(panel ? !panel.hidden : false));
        schedulePanel();
    }

    controls.addEventListener('click', event => {
        const button = event.target.closest('[data-audio-action]');
        if (!button || button.disabled) return;
        const action = button.dataset.audioAction;
        const payload = action === 'restart' ? { action: 'seek', position: 0 }
            : { action: action === 'toggle' ? (music.playing ? 'pause' : 'play') : 'next' };
        dashboard.musicAction?.(payload);
    });

    if (panel) {
        panel.classList.add('audio-player-panel');
        const currentDisc = panel.querySelector('.music-now > span');
        if (currentDisc) {
            currentDisc.classList.add('audio-player-disc');
            currentDisc.textContent = '';
            currentDisc.setAttribute('aria-hidden', 'true');
        }
        const observer = new MutationObserver(() => {
            openButton.setAttribute('aria-expanded', String(!panel.hidden));
            schedulePanel();
        });
        observer.observe(panel, { attributes: true, attributeFilter: ['hidden'] });

    }

    window.addEventListener('velox:music', event => renderMusic(event.detail));
    window.addEventListener('velox:render', renderLayout);
    window.addEventListener('velox:preferences', renderLayout);
    window.addEventListener('resize', renderLayout);
    window.HudAudioWidget = Object.freeze({ refresh: renderLayout });
    dashboard.applyPreferences({}, false);
    renderMusic();
    renderLayout();
})();
