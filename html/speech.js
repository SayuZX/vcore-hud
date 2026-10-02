(function (root) {
    'use strict';
    function encodeWav(samples, inputRate) {
        if (!samples || !Number.isFinite(inputRate) || inputRate < 8000 || inputRate > 192000)
            throw new Error('Unsupported microphone format.');
        const count = Math.min(48000, Math.floor(samples.length * 16000 / inputRate)), buffer = new ArrayBuffer(44 + count * 2), v = new DataView(buffer);
        const text = (offset, value) => { for (let i = 0; i < value.length; i++)
            v.setUint8(offset + i, value.charCodeAt(i)); };
        text(0, 'RIFF');
        v.setUint32(4, 36 + count * 2, true);
        text(8, 'WAVE');
        text(12, 'fmt ');
        v.setUint32(16, 16, true);
        v.setUint16(20, 1, true);
        v.setUint16(22, 1, true);
        v.setUint32(24, 16000, true);
        v.setUint32(28, 32000, true);
        v.setUint16(32, 2, true);
        v.setUint16(34, 16, true);
        text(36, 'data');
        v.setUint32(40, count * 2, true);
        for (let i = 0; i < count; i++) {
            const start = Math.floor(i * inputRate / 16000), end = Math.max(start + 1, Math.floor((i + 1) * inputRate / 16000));
            let value = 0;
            for (let j = start; j < end && j < samples.length; j++)
                value += samples[j];
            value = Math.max(-1, Math.min(1, value / (end - start)));
            v.setInt16(44 + i * 2, value * (value < 0 ? 32768 : 32767), true);
        }
        return new Uint8Array(buffer);
    }
    let active = null;
    async function record() {
        if (active)
            throw new Error('A recording is already active.');
        if (!navigator.mediaDevices?.getUserMedia)
            throw new Error('Microphone capture is unavailable in this browser.');
        return new Promise((resolve, reject) => {
            let stream, context, processor, timer, stoppedStream, closedContext, settled = false, count = 0;
            const nodes = [], chunks = [], session = { cancel: () => finish(new Error('Recording canceled.')) };
            active = session;
            const clean = () => {
                clearTimeout(timer);
                if (processor)
                    processor.onaudioprocess = null;
                while (nodes.length) {
                    try {
                        nodes.pop().disconnect();
                    }
                    catch (_) { }
                }
                if (stream && stoppedStream !== stream) {
                    stoppedStream = stream;
                    stream.getTracks().forEach(t => { try {
                        t.stop();
                    }
                    catch (_) { } });
                }
                if (context && closedContext !== context) {
                    closedContext = context;
                    try {
                        Promise.resolve(context.close()).catch(() => { });
                    }
                    catch (_) { }
                }
            };
            function finish(error, value) { if (settled)
                return; settled = true; clean(); if (active === session)
                active = null; error ? reject(error) : resolve(value); }
            async function start() {
                stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
                if (settled) {
                    clean();
                    return;
                }
                const Context = root.AudioContext || root.webkitAudioContext;
                if (!Context)
                    throw new Error('Audio capture is unavailable.');
                context = new Context();
                await context.resume();
                if (settled) {
                    clean();
                    return;
                }
                const source = context.createMediaStreamSource(stream), silent = context.createGain();
                nodes.push(source, silent);
                processor = context.createScriptProcessor(4096, 1, 1);
                nodes.push(processor);
                silent.gain.value = 0;
                processor.onaudioprocess = e => { if (settled || count >= context.sampleRate * 3)
                    return; const data = e.inputBuffer.getChannelData(0).slice(0, Math.max(0, context.sampleRate * 3 - count)); chunks.push(data); count += data.length; };
                source.connect(processor);
                processor.connect(silent);
                silent.connect(context.destination);
                timer = setTimeout(() => {
                    try {
                        const rate = context.sampleRate;
                        if (count < rate * .2)
                            throw new Error('No microphone audio was captured.');
                        const samples = new Float32Array(count);
                        let at = 0;
                        for (const chunk of chunks) {
                            samples.set(chunk, at);
                            at += chunk.length;
                        }
                        const bytes = encodeWav(samples, rate);
                        let binary = '';
                        for (let i = 0; i < bytes.length; i++)
                            binary += String.fromCharCode(bytes[i]);
                        finish(null, btoa(binary));
                    }
                    catch (error) {
                        finish(error);
                    }
                }, 3000);
            }
            void start().catch(error => finish(error));
        });
    }
    const api = { encodeWav, record, stop: () => { if (active)
            active.cancel(); } };
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
    root.HudSpeech = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
