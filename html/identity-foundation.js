(function () {
    'use strict';
    const identity = document.getElementById('identity-widget');
    const shortcuts = document.getElementById('shortcut-widget');
    if (!identity || !shortcuts || identity.dataset.foundation === 'identity-v1')
        return;
    identity.dataset.foundation = 'identity-v1';
    const svg = (body, viewBox = '0 0 24 24') => `<svg viewBox="${viewBox}" aria-hidden="true" focusable="false">${body}</svg>`;
    const mark = svg('<path d="m5 4 7 16 7-16-6 5-1 5-2-8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>');
    const top = identity.querySelector('.identity-top');
    top.innerHTML = `<span class="foundation-server-mark" aria-label="VCORE HUD"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-opacity=".2" stroke-width="3"/><path d="M12 41a21 21 0 1 1 28-4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg><span>${mark}</span></span><div class="foundation-brand-pill"><span class="foundation-brand-copy"><b>VCORE</b><small>ROLEPLAY</small></span><span class="foundation-brand-mark">${mark}</span></div>`;
    const cashIcon = svg('<g transform="rotate(-35 16 16)"><rect x="5" y="9" width="23" height="16" rx="2" fill="currentColor" opacity=".3"/><rect x="3" y="5" width="23" height="16" rx="2" fill="currentColor"/><path d="M8 8h13a4 4 0 0 0 2 3v4a4 4 0 0 0-2 3H8a4 4 0 0 0-2-3v-4a4 4 0 0 0 2-3Z" fill="none" stroke="#32634e" stroke-width="1.2" opacity=".55"/><ellipse cx="14.5" cy="13" rx="3.3" ry="4.1" fill="#32634e" opacity=".65"/><path d="M14.5 10.3v5.4m1.4-4.3c-2.3-1.5-4 1.2-1.4 1.6s1 3.1-1.4 1.7" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></g>', '0 0 32 32');
    const bankIcon = svg('<path d="M3 10 16 3l13 7v3H3z" fill="currentColor"/><path d="M5 26h22v3H5zM3 29h26v2H3zM7 14h4v11H7zm7 0h4v11h-4zm7 0h4v11h-4z" fill="currentColor"/><path d="M16 6.3v3.5m-5.5 1h11" stroke="#476984" stroke-width="1.2" opacity=".6"/>', '0 0 32 32');
    identity.querySelector('.cash > span').innerHTML = cashIcon;
    identity.querySelector('.bank > span').innerHTML = bankIcon;
    const shortcutIcons = [
        svg('<path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" fill="currentColor"/><path d="M10 4h4M11 19.5h2" stroke="#29303a" stroke-width="1.5" stroke-linecap="round"/>'),
        svg('<path d="M9 5V4a3 3 0 0 1 6 0v1m-6 0h6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 5h10a3 3 0 0 1 3 3v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a3 3 0 0 1 3-3Z" fill="currentColor"/><path d="M7 13h10v5H7zm1-5v2m8-2v2" fill="none" stroke="#29303a" stroke-width="1.4" stroke-linejoin="round"/>'),
        svg('<path d="M9 17V5l11-3v13M9 9l11-3" fill="none" stroke="currentColor" stroke-width="2.5"/><ellipse cx="5.5" cy="18" rx="4" ry="3"/><ellipse cx="16.5" cy="16" rx="4" ry="3"/>'),
        svg('<path d="m10 2-.6 2.3-2 .9-2.1-.8-2 3.4L5 9.5l-.2 2.3-1.7 1.5 2 3.5 2.3-.5 1.8 1.4.3 2.3h4l.7-2.2 2-.9 2.1.7 2-3.5-1.7-1.7.1-2.2 1.8-1.6-2-3.4-2.3.5-1.8-1.4-.4-2.3H10Z" fill="currentColor"/><circle cx="11.8" cy="11" r="3.3" fill="#29303a"/>')
    ];
    const keys = ['F1', 'F2', 'F3', 'F6'];
    shortcuts.querySelectorAll('button:not(.move-handle)').forEach((button, index) => {
        if (!shortcutIcons[index])
            return;
        button.innerHTML = `${shortcutIcons[index]}<small>${keys[index]}</small>`;
    });
    function updateDate(state) {
        for (const id of ['cash-value', 'bank-value']) {
            const value = document.getElementById(id);
            value.title = value.textContent;
        }
        const playerId = document.getElementById('player-id');
        playerId.style.setProperty('--id-font-size', Math.max(9, Math.min(16, 54 / Math.max(1, playerId.textContent.length))) + 'px');
        playerId.title = playerId.textContent;
        const date = document.getElementById('date-chip');
        const raw = String(state?.date || '').trim();
        let weekday = '', day = '';
        const calendar = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
        const abbreviated = /^([A-Za-z]{3})\s+(\d{1,2})$/.exec(raw);
        if (calendar) {
            const value = new Date(Date.UTC(Number(calendar[3]), Number(calendar[2]) - 1, Number(calendar[1])));
            if (value.getUTCFullYear() === Number(calendar[3]) && value.getUTCMonth() === Number(calendar[2]) - 1 && value.getUTCDate() === Number(calendar[1])) {
                weekday = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][value.getUTCDay()];
                day = String(value.getUTCDate()).padStart(2, '0');
            }
        }
        else if (abbreviated) {
            weekday = abbreviated[1].toUpperCase();
            day = abbreviated[2].padStart(2, '0');
        }
        date.dataset.weekday = weekday;
        date.dataset.day = day;
        date.classList.toggle('foundation-date-formatted', !!weekday);
        date.setAttribute('aria-label', raw || 'Date unavailable');
        date.title = raw;
    }
    window.addEventListener('velox:render', event => updateDate(event.detail));
    window.addEventListener('velox:preferences', () => updateDate(window.VeloxUI?.getState()));
    updateDate(window.VeloxUI?.getState());
})();
