(function () {
    'use strict';
    const origin = location.origin;
    const session = new URLSearchParams(location.search).get('session');
    if (parent === window || !session) return;
    let controller = null, latest = null, failed = false, initializing = false;
    let state = 'idle', revision = -1, lastPlaying = null, lastProgress = 0, loadTimer;
    const finite = value => typeof value === 'number' && Number.isFinite(value);
    function send(next, extra = {}) {
        state = next;
        parent.postMessage({ type: 'vcore:boombox:status', session, videoId: latest?.videoId, state: next, ...extra }, origin);
    }
    function fail(code, message) {
        if (failed) return;
        failed = true;
        clearTimeout(loadTimer);
        if (controller) clearInterval(controller.playCheckInterval);
        send('error', { errorCode: code, message: message || 'cs-boombox gagal memutar lagu. Kode: ' + code });
    }
    function apply() {
        if (!controller?.ready || !latest || failed) return;
        const changed = controller.source !== latest.videoId;
        if (changed) controller.set(latest.videoId);
        controller.player.setVolume(latest.volume * 100);
        if (changed || revision !== latest.revision) controller.seek(latest.position);
        revision = latest.revision;
        if (changed || lastPlaying !== latest.playing) {
            lastPlaying = latest.playing;
            if (latest.playing) {
                controller.play();
                lastProgress = Date.now();
                send('loading');
            } else {
                controller.pause();
                send('paused');
            }
        }
    }
    class BrowserYouTubeController extends YouTubeController {
        hook() {
            this.hooked = true;
        }
    }
    function initialize() {
        if (initializing || failed) return;
        initializing = true;
        send('loading');
        loadTimer = setTimeout(() => fail('CS_TIMEOUT', 'cs-boombox terlalu lama merespons. Coba lagi.'), 20000);
        function create() {
            if (failed || controller) return;
            try {
                controller = new BrowserYouTubeController({
                    context: null,
                    controllerHooked() {},
                    controllerSeeked() {},
                    controllerEnded() { send('ended'); },
                    controllerError(_controller, error, code) { fail(code || error); }
                }, () => { clearTimeout(loadTimer); apply(); });
            } catch (_) {
                fail('CS_INIT', 'Controller cs-boombox gagal dimuat.');
            }
        }
        if (window.YT?.Player) create();
        else {
            window.onYouTubeIframeAPIReady = create;
            const script = document.createElement('script');
            script.src = 'https://www.youtube.com/iframe_api';
            script.referrerPolicy = 'strict-origin-when-cross-origin';
            script.addEventListener('error', () => fail('CS_NETWORK', 'YouTube tidak dapat dihubungi.'));
            document.head.append(script);
        }
    }
    window.addEventListener('message', event => {
        if (event.source !== parent || event.origin !== origin || event.data?.session !== session) return;
        const message = event.data;
        if (message.type === 'vcore:boombox:activate') {
            if (!failed && controller?.ready && latest?.playing) {
                controller.play();
                lastProgress = Date.now();
                send('loading');
            }
            return;
        }
        if (message.type !== 'vcore:boombox:sync') return;
        const value = message.data;
        if (!value || typeof value.videoId !== 'string' || !/^[\w-]{11}$/.test(value.videoId)
            || typeof value.playing !== 'boolean' || !finite(value.volume) || !finite(value.position)
            || !finite(value.revision)) return;
        if (latest && latest.videoId !== value.videoId) return;
        latest = { videoId: value.videoId, playing: value.playing, volume: Math.max(0, Math.min(1, value.volume)),
            position: Math.max(0, Math.min(21600, value.position)), revision: value.revision };
        initialize();
        apply();
    });
    setInterval(() => {
        if (!controller?.ready || !latest || failed || state === 'ended') return;
        const native = controller.player.getPlayerState();
        if (native === 1) {
            const time = controller.time();
            if (finite(time)) {
                lastProgress = Date.now();
                send('playing', { time, muted: controller.player.isMuted(), volume: controller.player.getVolume() });
            }
        } else if (native === 3 && state !== 'buffering') send('buffering');
        else if (!latest.playing && native === 2 && state !== 'paused') send('paused');
        else if (latest.playing && Date.now() - lastProgress > 15000 && state !== 'blocked') {
            clearInterval(controller.playCheckInterval);
            send('blocked', { message: 'Tekan Aktifkan suara untuk memutar.' });
        }
    }, 500);
    parent.postMessage({ type: 'vcore:boombox:ready', session }, origin);
})();
