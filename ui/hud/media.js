(function (root) {
    'use strict';

    const safeId = value => typeof value === 'string' && /^[\w-]{11}$/.test(value);
    const bounded = (value, min, max) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
    const label = value => typeof value === 'string' ? value.trim().slice(0, 80) : '';
    const maximumPosition = 21600;
    let youtubeLibrary = null;
    const metadataCache = new Map();

    function videoId(input) {
        if (typeof input !== 'string') return null;
        const text = input.trim();
        if (safeId(text)) return text;
        try {
            const url = new URL(text);
            if (url.protocol !== 'https:' || !['www.youtube.com', 'youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'].includes(url.hostname)) return null;
            const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop();
            return safeId(id) ? id : null;
        } catch (_) {
            return null;
        }
    }

    function youtubeError(code) {
        const messages = {
            2: 'Tautan YouTube tidak valid. Masukkan tautan video lain.',
            5: 'Video ini tidak dapat diputar oleh pemutar YouTube. Coba lagi atau pilih video lain.',
            100: 'Video YouTube sudah dihapus atau bersifat pribadi. Pilih video lain.',
            101: 'Pemilik video melarang pemutaran di aplikasi lain. Pilih video lain.',
            150: 'Pemilik video melarang pemutaran di aplikasi lain. Pilih video lain.',
            153: 'YouTube tidak menerima identitas situs pemutar (origin/referrer, kode 153). Periksa konfigurasi server atau gunakan sumber audio server.'
        };
        return messages[code] || 'YouTube gagal memutar video ini. Coba lagi atau pilih video lain.';
    }

    async function metadata(input) {
        const id = videoId(input);
        if (!id || typeof root.fetch !== 'function' || typeof root.AbortController !== 'function') return null;
        if (metadataCache.has(id)) return metadataCache.get(id);
        const controller = new root.AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        try {
            const endpoint = new URL('https://www.youtube.com/oembed');
            endpoint.searchParams.set('url', 'https://www.youtube.com/watch?v=' + id);
            endpoint.searchParams.set('format', 'json');
            const response = await root.fetch(endpoint.href, { signal: controller.signal, credentials: 'omit' });
            if (!response.ok) return null;
            const data = await response.json();
            if (data.provider_name !== 'YouTube' || typeof data.title !== 'string' || !data.title.trim()) return null;
            const result = Object.freeze({ videoId: id, title: label(data.title.replace(/[\x00-\x1f\x7f]/g, '')), author: label(data.author_name) });
            if (metadataCache.size >= 64) metadataCache.delete(metadataCache.keys().next().value);
            metadataCache.set(id, result);
            return result;
        } catch (_) {
            return null;
        } finally {
            clearTimeout(timer);
        }
    }

    function loadYoutube() {
        if (root.YT?.Player) return Promise.resolve(root.YT);
        if (youtubeLibrary) return youtubeLibrary;
        youtubeLibrary = new Promise((resolve, reject) => {
            const prior = root.onYouTubeIframeAPIReady;
            const script = root.document.createElement('script');
            let settled = false;
            let timer;
            function finish(error) {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                if (root.onYouTubeIframeAPIReady === onReady) root.onYouTubeIframeAPIReady = prior;
                if (error) {
                    youtubeLibrary = null;
                    script.remove();
                    reject(error);
                } else {
                    resolve(root.YT);
                }
            }
            function onReady() {
                try {
                    if (typeof prior === 'function') prior();
                } finally {
                    finish(root.YT?.Player ? null : new Error('Pemutar YouTube belum siap. Coba lagi.'));
                }
            }
            root.onYouTubeIframeAPIReady = onReady;
            script.src = 'https://www.youtube.com/iframe_api';
            script.referrerPolicy = 'strict-origin-when-cross-origin';
            script.addEventListener('error', () => finish(new Error('YouTube tidak dapat dihubungi. Periksa koneksi lalu coba lagi.')));
            timer = setTimeout(() => finish(new Error('YouTube terlalu lama merespons. Coba lagi.')), 15000);
            root.document.head.append(script);
        });
        return youtubeLibrary;
    }

    function create(host, notice = () => {}, onEnd = () => {}, onStatus = () => {}) {
        let youtube = null;
        let audio = null;
        let loaded = '';
        let data = null;
        let generation = 0;
        let ready = false;
        let revision = -1;
        let endedRevision = null;
        let readyTimer = null;
        let status = { state: 'idle', message: '', errorCode: null };

        function report(state, message = '', errorCode = null) {
            const changed = state !== status.state || message !== status.message || errorCode !== status.errorCode;
            status = { state, message, errorCode };
            if (!changed) return;
            onStatus({ ...status });
            if (message) notice(message, state === 'error' || state === 'blocked');
        }

        function release() {
            generation++;
            clearTimeout(readyTimer);
            readyTimer = null;
            if (youtube) {
                try { youtube.destroy(); } catch (_) {}
                youtube = null;
            }
            if (audio) {
                audio.pause();
                audio.removeAttribute('src');
                audio.load();
                audio = null;
            }
            loaded = '';
            ready = false;
            revision = -1;
            endedRevision = null;
            host.replaceChildren();
            host.hidden = true;
        }

        function destroy() {
            release();
            data = null;
            report('idle');
        }

        function end(token) {
            if (token !== generation || !data || endedRevision === data.revision) return;
            endedRevision = data.revision;
            report('ended');
            onEnd();
        }

        function applyYoutube(force = false) {
            if (!youtube || !ready || !data || endedRevision === data.revision || status.state === 'error') return;
            youtube.setVolume(data.volume * 100);
            if (force || revision !== data.revision) {
                youtube.seekTo(data.position, true);
                revision = data.revision;
            } else if (typeof youtube.getCurrentTime === 'function' && Math.abs(youtube.getCurrentTime() - data.position) > 3) {
                youtube.seekTo(data.position, true);
            }
            if (data.playing) {
                if (status.state !== 'blocked') {
                    youtube.unMute?.();
                    youtube.playVideo();
                }
            } else {
                youtube.pauseVideo();
                report('paused');
            }
        }

        function playAudio(token) {
            if (!audio) return;
            const pending = audio.play();
            if (pending?.catch) pending.catch(error => {
                if (token !== generation) return;
                report(error?.name === 'NotAllowedError' ? 'blocked' : 'error', error?.name === 'NotAllowedError' ? 'Tekan Aktifkan suara untuk mulai memutar.' : 'Audio gagal diputar. Coba lagi atau pilih lagu lain.');
            });
        }

        async function sync(next) {
            if (!next || typeof next !== 'object') return;
            const clean = {
                ...next,
                position: bounded(next.position, 0, maximumPosition),
                volume: bounded(next.volume, 0, 1),
                revision: bounded(next.revision, 0, Number.MAX_SAFE_INTEGER),
                playing: next.playing === true
            };
            if (clean.adapter === 'xsound' || !clean.videoId) {
                destroy();
                report(clean.adapter === 'xsound' && clean.videoId ? 'external' : 'idle');
                return;
            }
            const identity = String(clean.source || 'youtube') + ':' + clean.videoId + (clean.source === 'media' ? ':' + clean.url : '');
            if (clean.source === 'media') {
                let url;
                try {
                    url = new URL(clean.url);
                    if (url.protocol !== 'https:') throw new Error();
                } catch (_) {
                    destroy();
                    report('error', 'Sumber audio server tidak tersedia. Pilih lagu lain.');
                    return;
                }
                if (loaded !== identity) {
                    release();
                    loaded = identity;
                    const token = generation;
                    audio = new root.Audio(url.href);
                    audio.preload = 'auto';
                    report('loading');
                    audio.addEventListener('ended', () => end(token));
                    audio.addEventListener('playing', () => { if (token === generation) report('playing'); });
                    audio.addEventListener('error', () => { if (token === generation) report('error', 'Sumber audio server gagal diputar. Pilih lagu lain.'); });
                    audio.addEventListener('loadedmetadata', () => {
                        if (token === generation && audio && data) audio.currentTime = data.position;
                    });
                }
                data = clean;
                audio.volume = data.volume;
                if (audio.readyState >= 1 && (revision !== data.revision || Math.abs(audio.currentTime - data.position) > 3)) audio.currentTime = data.position;
                revision = data.revision;
                if (endedRevision === data.revision) return;
                if (data.playing) {
                    if (status.state !== 'blocked' && status.state !== 'error') playAudio(generation);
                } else {
                    audio.pause();
                    report('paused');
                }
                return;
            }
            if (!safeId(clean.videoId)) {
                destroy();
                report('error', youtubeError(2), 2);
                return;
            }
            if (loaded === identity) {
                data = clean;
                applyYoutube();
                return;
            }
            release();
            data = clean;
            loaded = identity;
            const token = generation;
            host.hidden = false;
            report('loading');
            try {
                const YT = await loadYoutube();
                if (token !== generation) return;
                const frame = root.document.createElement('iframe');
                const source = new URL('https://www.youtube.com/embed/' + clean.videoId);
                const playerVars = { enablejsapi: 1, playsinline: 1, autoplay: 0, controls: 1, rel: 0 };
                if (/^https?:\/\//.test(root.location?.origin || '')) playerVars.origin = root.location.origin;
                for (const [key, value] of Object.entries(playerVars)) source.searchParams.set(key, String(value));
                frame.width = '100%';
                frame.height = '200';
                frame.title = 'Pemutar YouTube';
                frame.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
                frame.referrerPolicy = 'strict-origin-when-cross-origin';
                frame.src = source.href;
                host.append(frame);
                readyTimer = setTimeout(() => {
                    if (token !== generation || ready) return;
                    release();
                    loaded = identity;
                    report('error', 'Pemutar YouTube tidak merespons. Tekan Aktifkan suara untuk mencoba lagi.');
                }, 15000);
                youtube = new YT.Player(frame, {
                    width: '100%',
                    height: 200,
                    videoId: clean.videoId,
                    playerVars,
                    events: {
                        onReady: () => {
                            if (token !== generation) return;
                            clearTimeout(readyTimer);
                            readyTimer = null;
                            ready = true;
                            applyYoutube(true);
                        },
                        onStateChange: event => {
                            if (token !== generation) return;
                            if (event.data === 0) end(token);
                            else if (event.data === 1) report('playing');
                            else if (event.data === 2) report('paused');
                            else if (event.data === 3) report('buffering');
                        },
                        onError: event => {
                            if (token !== generation) return;
                            clearTimeout(readyTimer);
                            report('error', youtubeError(event.data), event.data);
                        },
                        onAutoplayBlocked: () => {
                            if (token === generation) report('blocked', 'Tekan Aktifkan suara untuk mulai memutar.');
                        }
                    }
                });
            } catch (error) {
                if (token !== generation) return;
                release();
                loaded = identity;
                report('error', error.message || 'YouTube gagal dimuat. Coba lagi.');
            }
        }

        function enableSound() {
            if (!data || !data.videoId || data.adapter === 'xsound') return;
            if (status.state === 'error' || !youtube && !audio) {
                const retry = { ...data };
                release();
                return sync(retry);
            }
            report(data.playing ? 'loading' : 'paused');
            if (youtube && ready) {
                youtube.unMute();
                if (data.playing) youtube.playVideo();
            }
            if (audio && data.playing) playAudio(generation);
        }

        return { sync, enableSound, destroy, getStatus: () => ({ ...status }) };
    }

    function createPreview(onChange, now = () => Date.now()) {
        let state = { videoId: '', title: '', source: 'youtube', adapter: 'nui', playing: false, position: 0, volume: 0.5, revision: 0, liked: false, playlist: [], canControl: true };
        let startedAt = now();
        let active = true;
        function snapshot() {
            const elapsed = state.playing ? Math.max(0, now() - startedAt) / 1000 : 0;
            return { ...state, position: bounded(state.position + elapsed, 0, maximumPosition), playlist: state.playlist.map(track => ({ ...track })) };
        }
        function action(request) {
            if (!active || !request || typeof request !== 'object') return { ok: false, error: 'Pemutar tidak tersedia.' };
            const next = snapshot();
            const choice = videoId(request.videoId);
            const track = choice ? { videoId: choice, title: label(request.title) || 'YouTube · ' + choice, source: 'youtube' } : null;
            if (request.action === 'play') {
                if (request.videoId && !track) return { ok: false, error: 'Masukkan tautan atau ID video YouTube yang valid.' };
                if (track) Object.assign(next, track, { position: 0, liked: false });
                if (!next.videoId) return { ok: false, error: 'Pilih lagu terlebih dahulu.' };
                next.playing = true;
            } else if (request.action === 'pause') {
                next.playing = false;
            } else if (request.action === 'stop') {
                next.playing = false;
                next.position = 0;
            } else if (request.action === 'volume') {
                if (typeof request.volume !== 'number' || !Number.isFinite(request.volume)) return { ok: false, error: 'Volume tidak valid.' };
                next.volume = bounded(request.volume, 0, 1);
            } else if (request.action === 'seek') {
                if (!next.videoId) return { ok: false, error: 'Pilih lagu terlebih dahulu.' };
                if (typeof request.position !== 'number' || !Number.isFinite(request.position)) return { ok: false, error: 'Posisi lagu tidak valid.' };
                next.position = bounded(request.position, 0, maximumPosition);
            } else if (request.action === 'playlist') {
                if (!track) return { ok: false, error: 'Masukkan tautan atau ID video YouTube yang valid.' };
                if (next.playlist.length >= 50) return { ok: false, error: 'Daftar putar penuh (maksimal 50 lagu).' };
                next.playlist.push(track);
            } else if (request.action === 'next') {
                if (!next.playlist.length) return { ok: false, error: 'Daftar putar masih kosong.' };
                Object.assign(next, next.playlist.shift(), { position: 0, playing: true, liked: false });
            } else if (request.action === 'like') {
                if (!next.videoId) return { ok: false, error: 'Pilih lagu terlebih dahulu.' };
                next.liked = !next.liked;
            } else if (request.action !== 'sync') {
                return { ok: false, error: 'Kontrol musik tidak dikenali.' };
            }
            next.revision++;
            state = next;
            startedAt = now();
            onChange(snapshot());
            return { ok: true };
        }
        return { action, snapshot, destroy: () => { active = false; state.playing = false; } };
    }

    const api = { videoId, bounded, youtubeError, metadata, create, createPreview };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.HudMedia = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
