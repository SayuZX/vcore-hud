(function (root) {
    'use strict';
    function start(send, options = {}) {
        const setTimer = options.setTimer || setTimeout;
        const clearTimer = options.clearTimer || clearTimeout;
        const timeoutMs = options.timeoutMs ?? 2500;
        const retryMs = options.retryMs ?? 250;
        const maxRetryMs = options.maxRetryMs ?? 5000;
        let stopped = false;
        let sequence = 0;
        let retries = 0;
        let timer = null;
        let controller = null;
        function attempt() {
            if (stopped)
                return;
            const id = ++sequence;
            controller = new AbortController();
            const current = controller;
            let settled = false;
            function finish() {
                if (stopped || id !== sequence || settled)
                    return;
                settled = true;
                clearTimer(timer);
                current.abort();
                const delay = Math.min(maxRetryMs, retryMs * Math.pow(2, Math.min(retries++, 20)));
                timer = setTimer(attempt, delay);
            }
            timer = setTimer(finish, timeoutMs);
            Promise.resolve().then(() => {
                if (stopped || id !== sequence)
                    return;
                return send(current.signal);
            }).then(finish, finish);
        }
        function stop() {
            stopped = true;
            sequence++;
            clearTimer(timer);
            if (controller)
                controller.abort();
        }
        attempt();
        return { stop };
    }
    const api = { start };
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
    root.HudBridge = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
