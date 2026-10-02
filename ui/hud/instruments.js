(function () {
    'use strict';
    const root = document.documentElement;
    const dashboard = window.VeloxDashboard;
    const ui = window.VeloxUI;
    const instrument = document.querySelector('#new-speed .instrument');
    if (!dashboard || !ui || !instrument)
        return;
    const styles = Object.freeze({
        arc: Object.freeze({ width: 240, height: 188, label: 'Open arc' }),
        split: Object.freeze({ width: 280, height: 158, label: 'Split cluster' }),
        ribbon: Object.freeze({ width: 340, height: 112, label: 'Racing ribbon' }),
        numeric: Object.freeze({ width: 204, height: 174, label: 'Pure numeric' }),
        outline: Object.freeze({ width: 210, height: 284, label: 'Outline dial' }),
        rail: Object.freeze({ width: 230, height: 190, label: 'Vertical rail' })
    });
    const point = (angle, radius) => {
        const radians = angle * Math.PI / 180;
        return [120 + Math.sin(radians) * radius, 108 - Math.cos(radians) * radius];
    };
    const arcPath = radius => {
        const a = point(-105, radius), b = point(105, radius);
        return `M${a.join(' ')} A${radius} ${radius} 0 1 1 ${b.join(' ')}`;
    };
    const ticks = Array.from({ length: 29 }, (_, i) => {
        const angle = -105 + i * 7.5;
        const a = point(angle, 95), b = point(angle, i % 7 === 0 ? 86 : 91);
        return `<line class="open-arc-tick${i % 7 === 0 ? ' major' : ''}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
    }).join('');
    const arc = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arc.id = 'open-speed-arc';
    arc.setAttribute('viewBox', '0 0 240 150');
    arc.setAttribute('role', 'meter');
    arc.setAttribute('aria-label', 'Engine RPM');
    arc.setAttribute('aria-valuemin', '0');
    arc.setAttribute('aria-valuemax', '100');
    arc.innerHTML = `<g aria-hidden="true"><path class="open-arc-track" d="${arcPath(103)}"/><path id="open-rpm-arc" d="${arcPath(103)}" pathLength="100"/>${ticks}<text x="120" y="37">RPM</text></g>`;
    instrument.prepend(arc);
    function render() {
        const prefs = dashboard.getPreferences();
        const state = ui.getState();
        const rpm = Math.min(1, Math.max(0, Number(state.rpm) || 0));
        root.dataset.speedBackground = prefs.speedBackground ? 'on' : 'off';
        root.dataset.instrumentFamily = styles[root.dataset.speedStyle] ? 'open' : 'classic';
        document.getElementById('open-rpm-arc').style.strokeDasharray = `${rpm * 100} 100`;
        arc.setAttribute('aria-valuenow', String(Math.round(rpm * 100)));
        arc.setAttribute('aria-valuetext', `${Math.round(rpm * 100)} percent engine RPM`);
        arc.classList.toggle('redline', rpm >= .85);
    }
    window.HudInstruments = Object.freeze({
        styles,
        dimensions: style => styles[style] || null,
        getFaceSelector: style => style === 'outline' || style === 'dial' ? '#analog-scale' : style === 'arc' ? '#open-speed-arc' : null,
        getRpmSelector: style => ['arc', 'outline', 'dial'].includes(style) ? null : '#rpm-strip'
    });
    window.addEventListener('velox:render', render);
    window.addEventListener('velox:preferences', render);
    dashboard.applyPreferences({}, false);
})();
