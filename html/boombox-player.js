(function (root) {
    'use strict';
    function create(host, notice = () => {}, onEnd = () => {}, onStatus = () => {}) {
        let frame = null, ready = false, sequence = 0, data = null, timeout = null, status = { state: 'idle' };
        const stylesheet = document.querySelector('link[href$="style.css"]');
        const workerUrl = new URL('boombox/index.html', stylesheet?.href || location.href);
        const states = new Set(['idle', 'loading', 'playing', 'paused', 'buffering', 'blocked', 'error', 'ended']);
        function report(value) {
            status = value;
            host.dataset.playbackEngine = 'cs-boombox';
            host.dataset.playbackState = value.state;
            onStatus({ ...value });
            if (value.message && (value.state === 'error' || value.state === 'blocked')) notice(value.message, true);
        }
        function release() {
            sequence++;
            clearTimeout(timeout);
            timeout = null;
            ready = false;
            frame?.remove();
            frame = null;
            host.hidden = true;
        }
        function send(type = 'vcore:boombox:sync') {
            if (!frame || !ready) return;
            frame.contentWindow.postMessage({ type, session: String(sequence), data }, workerUrl.origin);
        }
        function initialize() {
            release();
            report({ state: 'loading' });
            frame = document.createElement('iframe');
            frame.title = 'cs-boombox audio';
            frame.allow = 'autoplay; encrypted-media';
            frame.tabIndex = -1;
            frame.referrerPolicy = 'strict-origin-when-cross-origin';
            const source = new URL(workerUrl);
            source.searchParams.set('session', String(sequence));
            frame.src = source.href;
            host.hidden = false;
            host.append(frame);
            const attempt = sequence;
            timeout = setTimeout(() => {
                if (attempt !== sequence || ready) return;
                report({ state: 'error', errorCode: 'CS_WORKER_TIMEOUT', message: 'Pemutar cs-boombox belum siap. Coba lagi.' });
            }, 12000);
        }
        function sync(next) {
            if (!next || typeof next !== 'object') return;
            if (!next.videoId) { destroy(); return; }
            const id = root.HudMedia.videoId(next.videoId);
            if (!id) { report({ state: 'error', errorCode: 2, message: 'Tautan YouTube tidak valid.' }); return; }
            const changed = data?.videoId !== id;
            data = { videoId: id, volume: root.HudMedia.bounded(next.volume, 0, 1),
                position: root.HudMedia.bounded(next.position, 0, 21600),
                revision: root.HudMedia.bounded(next.revision, 0, Number.MAX_SAFE_INTEGER), playing: next.playing === true };
            if (!frame || changed) initialize();
            else send();
        }
        function destroy() {
            release();
            data = null;
            report({ state: 'idle' });
        }
        function receive(event) {
            if (!frame || event.source !== frame.contentWindow || event.origin !== workerUrl.origin || event.data?.session !== String(sequence)) return;
            const value = event.data;
            if (value.type === 'vcore:boombox:ready') {
                ready = true;
                clearTimeout(timeout);
                send();
                return;
            }
            if (value.type !== 'vcore:boombox:status' || value.videoId !== data?.videoId || !states.has(value.state)) return;
            const next = { state: value.state };
            if (typeof value.message === 'string') next.message = value.message.slice(0, 240);
            if (typeof value.errorCode === 'number' || typeof value.errorCode === 'string') next.errorCode = value.errorCode;
            if (Number.isFinite(value.time)) next.time = Math.max(0, Math.min(21600, value.time));
            if (typeof value.muted === 'boolean') next.muted = value.muted;
            if (Number.isFinite(value.volume)) next.volume = Math.max(0, Math.min(100, value.volume));
            const ended = status.state === 'ended';
            report(next);
            if (next.state === 'ended' && !ended) onEnd();
        }
        function enableSound() {
            if (!data) return;
            if (status.state === 'error') initialize();
            else send('vcore:boombox:activate');
        }
        window.addEventListener('message', receive);
        window.addEventListener('pagehide', () => { release(); window.removeEventListener('message', receive); });
        return { sync, destroy, enableSound, getStatus: () => ({ ...status }) };
    }
    root.HudBoombox = Object.freeze({ create });
})(window);
