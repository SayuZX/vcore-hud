(function (root) {
    'use strict';
    const defaults = Object.freeze({ visible: true, health: 85, armor: 75, hunger: 80, thirst: 90, stamina: 100, oxygen: 100, diving: false, stress: 22, talking: false, voiceRange: 2, inVehicle: true, speed: 0, unit: 'MPH', gear: 'R', rpm: 0.18, fuel: 80, seatbelt: false, seatbeltAvailable: true, lights: false, highbeams: false, locked: false, heading: 120, street: 'ALTA ST', zone: 'LA PUERTA', playerId: 42, playerName: 'Alex Morgan', job: 'Civilian', jobGrade: 'Citizen', cash: 16400, bank: 762120, date: 'THU 01', worldTime: '19:31', weather: 'CLEAR', vehicleType: 'car', engineOn: true, engineHealth: 100, cruise: false, limiter: false, manual: false, boosting: false, driveMode: 'normal', signals: 'off', nitro: 0, driftScore: 0, driftCombo: 1, altitude: 0, verticalSpeed: 0, roll: 0, pitch: 0 });
    const percentageKeys = ['health', 'armor', 'hunger', 'thirst', 'stamina', 'oxygen', 'stress', 'fuel', 'engineHealth', 'nitro'];
    const booleanKeys = ['visible', 'diving', 'talking', 'inVehicle', 'seatbelt', 'seatbeltAvailable', 'lights', 'highbeams', 'locked', 'engineOn', 'cruise', 'limiter', 'manual', 'boosting'];
    function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
    function patch(previous, incoming) {
        const next = { ...previous };
        if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming))
            return next;
        percentageKeys.forEach(key => { if (typeof incoming[key] === 'number' && Number.isFinite(incoming[key]))
            next[key] = clamp(incoming[key], 0, 100); });
        booleanKeys.forEach(key => { if (typeof incoming[key] === 'boolean')
            next[key] = incoming[key]; });
        [['speed', 0, 999], ['rpm', 0, 1], ['voiceRange', 0, 10]].forEach(([key, min, max]) => { if (typeof incoming[key] === 'number' && Number.isFinite(incoming[key]))
            next[key] = clamp(incoming[key], min, max); });
        if (typeof incoming.heading === 'number' && Number.isFinite(incoming.heading))
            next.heading = ((incoming.heading % 360) + 360) % 360;
        if (incoming.unit === 'MPH' || incoming.unit === 'KMH')
            next.unit = incoming.unit;
        if (typeof incoming.gear === 'string' || typeof incoming.gear === 'number') {
            const g = String(incoming.gear).toUpperCase();
            if (/^(R|N|[0-9])$/.test(g))
                next.gear = g;
        }
        ['street', 'zone', 'playerName', 'job', 'jobGrade', 'date', 'worldTime', 'weather'].forEach(key => { if (typeof incoming[key] === 'string')
            next[key] = incoming[key].slice(0, 60); });
        for (const [key, min, max] of [['playerId', 0, 999999], ['cash', 0, 1e12], ['bank', 0, 1e12], ['driftScore', 0, 1e9], ['driftCombo', 0, 100], ['altitude', -500, 15000], ['verticalSpeed', -1000, 1000], ['roll', -180, 180], ['pitch', -180, 180]])
            if (typeof incoming[key] === 'number' && Number.isFinite(incoming[key]))
                next[key] = clamp(incoming[key], min, max);
        for (const [key, options] of Object.entries({ vehicleType: ['car', 'moto', 'boat', 'plane', 'heli'], driveMode: ['normal', 'drift', 'sport', 'sportplus'], signals: ['off', 'left', 'right', 'hazards'] }))
            if (options.includes(incoming[key]))
                next[key] = incoming[key];
        return next;
    }
    const radarDefaults = Object.freeze({ referenceWidth: 1920, referenceHeight: 1080, minScale: .5, maxScale: 2, right: 24, top: 48, diameter: 184, inset: 2 });
    function normalizeRadarLayout(input) {
        const result = { ...radarDefaults };
        if (!input || typeof input !== 'object')
            return result;
        Object.keys(result).forEach(key => {
            const value = input[key];
            const allowZero = ['right', 'top', 'inset'].includes(key);
            if (typeof value === 'number' && Number.isFinite(value) && (allowZero ? value >= 0 : value > 0))
                result[key] = value;
        });
        if (result.maxScale < result.minScale)
            result.maxScale = result.minScale;
        if (result.diameter < 8)
            result.diameter = radarDefaults.diameter;
        if (result.inset >= result.diameter / 2)
            result.inset = radarDefaults.inset;
        return result;
    }
    function measureRadar(width, height, layout) {
        const preferences = root.HudPreferences;
        const scale = preferences ? preferences.scale(width, height, root.VeloxDashboard?.getPreferences() || preferences.defaults) : Math.max(.5, Math.min(width / 1920, height / 1080, 2));
        const size = (layout.diameter - 2 * layout.inset) * scale;
        return { scale, left: width - (layout.right + layout.diameter - layout.inset) * scale, top: (layout.top + layout.inset) * scale, width: size, height: size };
    }
    const api = { defaults, patch, clamp, radarDefaults, normalizeRadarLayout, measureRadar };
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
    root.HudState = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
