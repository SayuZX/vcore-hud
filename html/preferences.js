(function (root) {
    'use strict';
    const canvas = Object.freeze({ width: 1920, height: 1080, minScale: .5, maxScale: 2 });
    const choices = { moveMode: ['group', 'icon'], layout: ['rectangle', 'circle'], theme: ['dark', 'light', 'dynamic'], statusStyle: ['rings', 'percentage', 'bars', 'velox'], statusPlacement: ['standalone', 'attached'], identityShape: ['pill', 'rounded', 'square'], moneyShape: ['pill', 'rounded', 'square'], cashShape: ['pill', 'rounded', 'square'], bankShape: ['pill', 'rounded', 'square'], shortcutShape: ['circle', 'rounded', 'square'], speedStyle: ['auto', 'velox', 'minimal', 'dial', 'digital', 'bar', 'drift', 'moto', 'boat', 'plane', 'heli', 'arc', 'split', 'ribbon', 'numeric', 'outline', 'rail'], unit: ['MPH', 'KMH'], mapMode: ['always', 'vehicle', 'off'] };
    const defaults = { version: 5, moveMode: 'group', layout: 'rectangle', theme: 'dark', statusStyle: 'rings', speedStyle: 'auto', unit: 'MPH', accent: '#70e1ca', scale: 1, blur: true, speedBackground: false, showIdentity: true, showMoney: true, showCash: true, showBank: true, showShortcuts: true, showVitals: true, showVehicle: true, showVoice: true, showMusic: true, showLocation: true, showMapTools: true, statusPlacement: 'standalone', identityShape: 'pill', moneyShape: 'pill', cashShape: 'pill', bankShape: 'pill', shortcutShape: 'circle', mapMode: 'vehicle', elementPositions: {}, elementOptions: {}, positions: { radar: { x: 32, y: 24 }, vitals: { x: 32, y: 24 }, vehicle: { x: 32, y: 24 }, identity: { x: 34, y: 28 }, shortcuts: { x: 34, y: 72 } } };
    const elementKeys = Object.freeze(['minimap', 'music', 'location', 'clock', 'weather', 'compass', 'mapVehicle', 'mapMusic', 'mapVoice', 'mapSettings', 'radio', 'cursor', 'voice', 'brandMark', 'brand', 'player', 'date', 'cash', 'bank', 'health', 'armor', 'hunger', 'thirst', 'stress', 'stamina', 'speedFace', 'speedReadout', 'gear', 'fuel', 'rpm', 'lights', 'belt', 'lock', 'cruise', 'signals', 'nitro', 'driveMode', 'vehicleClass', 'aerialValues', 'phone', 'inventory', 'musicShortcut', 'settings']);
    const groupKeys = Object.freeze(['minimap', 'music', 'location', 'cash', 'bank', 'status', 'speedometer', 'identity', 'shortcuts']);
    const positionKeys = Object.freeze([...elementKeys, 'status', 'speedometer', 'identity', 'shortcuts']);
    const optionKeys = Object.freeze([...elementKeys, 'status', 'speedometer', 'identity', 'shortcuts', 'mapTools']);
    const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
    const anchors = Object.freeze({ radar: 'bottom-left', vitals: 'bottom-left', vehicle: 'bottom-right', identity: 'top-right', shortcuts: 'right-center' });
    const layouts = Object.freeze({
        rectangle: Object.freeze({ widgetWidth: 430, widgetHeight: 448, frameWidth: 360, frameHeight: 214, frameX: 0, frameY: 174, inset: 0 }),
        circle: Object.freeze({ widgetWidth: 440, widgetHeight: 300, frameWidth: 280, frameHeight: 280, frameX: 26, frameY: 10, inset: 7 })
    });
    const legacyPositions = { radar: { x: 32, y: 575 }, vitals: { x: 32, y: 885 }, vehicle: { x: 1650, y: 785 }, identity: { x: 1590, y: 30 }, shortcuts: { x: 1838, y: 435 } };
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const finite = v => typeof v === 'number' && Number.isFinite(v);
    const object = v => v && typeof v === 'object' && !Array.isArray(v);
    function legacySize(name, input) {
        if (name === 'radar')
            return input.layout === 'circle' ? [184, 342] : [280, 368];
        if (name === 'vitals')
            return input.statusStyle === 'velox' ? [352, 67] : [360, input.statusStyle === 'bars' ? 100 : 65];
        if (name === 'vehicle')
            return input.speedStyle === 'velox' ? [224, 151] : [246, 210];
        return name === 'identity' ? [278, input.showMoney === false ? 92 : 184] : [48, 220];
    }
    function migrate(input) {
        if (!object(input) || input.version !== 1)
            return input;
        const result = { ...input, version: 5, positions: {} };
        const oldScale = finite(input.scale) ? clamp(input.scale, .7, 1.3) : 1, oldWidth = 1920 / oldScale, oldHeight = 969 / oldScale;
        for (const [name, old] of Object.entries(legacyPositions)) {
            const supplied = object(input.positions?.[name]) ? input.positions[name] : {};
            const x = finite(supplied.x) ? supplied.x : old.x, y = finite(supplied.y) ? supplied.y : old.y;
            if (y === old.y && (x === old.x || (name === 'shortcuts' && x === 1800))) {
                result.positions[name] = { ...defaults.positions[name] };
                continue;
            }
            const [w, h] = legacySize(name, input), left = clamp(x, 0, Math.max(0, oldWidth - w)), top = clamp(y, 0, Math.max(0, oldHeight - h)), ratio = 1080 / 969;
            if (name === 'radar' || name === 'vitals')
                result.positions[name] = { x: left, y: (oldHeight - top - h) * ratio };
            else if (name === 'vehicle')
                result.positions[name] = { x: oldWidth - left - w, y: (oldHeight - top - h) * ratio };
            else if (name === 'identity')
                result.positions[name] = { x: oldWidth - left - w, y: top * ratio };
            else
                result.positions[name] = { x: oldWidth - left - w, y: (top + h / 2 - oldHeight / 2) * ratio };
        }
        return result;
    }
    function apply(p, input) {
        if (!object(input))
            return;
        input = migrate(input);
        if (own(input, 'moneyShape') && choices.moneyShape.includes(input.moneyShape))
            for (const key of ['cashShape', 'bankShape'])
                if (!own(input, key))
                    p[key] = input.moneyShape;
        for (const [key, valid] of Object.entries(choices))
            if (valid.includes(input[key]))
                p[key] = input[key];
        for (const key of ['blur', 'speedBackground', 'showIdentity', 'showMoney', 'showCash', 'showBank', 'showShortcuts', 'showVitals', 'showVehicle', 'showVoice', 'showMusic', 'showLocation', 'showMapTools'])
            if (typeof input[key] === 'boolean')
                p[key] = input[key];
        if (finite(input.scale))
            p.scale = clamp(input.scale, .7, 1.3);
        if (typeof input.accent === 'string' && /^#[0-9a-f]{6}$/i.test(input.accent))
            p.accent = input.accent.toLowerCase();
        if (own(input, 'elementOptions')) {
            p.elementOptions = {};
            if (object(input.elementOptions)) {
                for (const key of optionKeys) {
                    if (!own(input.elementOptions, key)) continue;
                    const value = input.elementOptions[key];
                    if (!object(value)) continue;
                    const option = {};
                    if (own(value, 'visible') && typeof value.visible === 'boolean') option.visible = value.visible;
                    if (own(value, 'scale') && finite(value.scale)) option.scale = clamp(value.scale, .5, 2);
                    if (Object.keys(option).length) p.elementOptions[key] = option;
                }
            }
        }
        if (own(input, 'elementPositions')) {
            p.elementPositions = {};
            const points = input.elementPositions;
            if (object(points))
                for (const name of positionKeys) {
                    if (!own(points, name))
                        continue;
                    const point = points[name];
                    if (object(point) && own(point, 'x') && own(point, 'y') && finite(point.x) && finite(point.y))
                        p.elementPositions[name] = { x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) };
                }
        }
        for (const name of Object.keys(p.positions))
            for (const axis of ['x', 'y']) {
                const v = input.positions?.[name]?.[axis];
                if (finite(v))
                    p.positions[name][axis] = clamp(v, name === 'shortcuts' && axis === 'y' ? -canvas.height * 4 : 0, (axis === 'x' ? canvas.width : canvas.height) * 4);
            }
    }
    function normalize(input, base = defaults) {
        const p = { ...defaults, positions: {}, elementPositions: {}, elementOptions: {} };
        for (const [name, point] of Object.entries(defaults.positions))
            p.positions[name] = { ...point };
        apply(p, base);
        apply(p, input);
        p.version = 5;
        return p;
    }
    function parse(text) {
        if (typeof text !== 'string' || text.length > 20000)
            throw new Error('Preset must be a JSON object smaller than 20 KB.');
        const input = JSON.parse(text);
        if (!object(input) || ![1, 2, 3, 4, 5].includes(input.version))
            throw new Error('This is not a supported VCORE HUD preset.');
        return normalize(input);
    }
    function scale(width, height, p = defaults) { return clamp(Math.min(width / canvas.width, height / canvas.height), canvas.minScale, canvas.maxScale) * p.scale; }
    function position(width, height, p, name, widgetWidth, widgetHeight) {
        const s = scale(width, height, p), point = p.positions[name], anchor = anchors[name];
        if (!point || !anchor)
            throw new Error('Unknown HUD widget: ' + name);
        let left = anchor === 'bottom-left' ? point.x * s : width - (point.x + widgetWidth) * s;
        let top = anchor === 'top-right' ? point.y * s : anchor === 'right-center' ? height / 2 + (point.y - widgetHeight / 2) * s : height - (point.y + widgetHeight) * s;
        left = clamp(left, 0, Math.max(0, width - widgetWidth * s));
        top = clamp(top, 0, Math.max(0, height - widgetHeight * s));
        return { left, top, scale: s };
    }
    function fromScreen(width, height, p, name, left, top, widgetWidth, widgetHeight) {
        const s = scale(width, height, p), anchor = anchors[name];
        if (!anchor)
            throw new Error('Unknown HUD widget: ' + name);
        left = clamp(left, 0, Math.max(0, width - widgetWidth * s));
        top = clamp(top, 0, Math.max(0, height - widgetHeight * s));
        const x = anchor === 'bottom-left' ? left / s : (width - left) / s - widgetWidth;
        const y = anchor === 'top-right' ? top / s : anchor === 'right-center' ? (top - height / 2) / s + widgetHeight / 2 : (height - top) / s - widgetHeight;
        return { x, y };
    }
    function attachedStatus(p) {
        const customized = ['status', 'health', 'armor', 'hunger', 'thirst', 'stress', 'stamina', 'minimap'].some(key => { const value = p.elementOptions?.[key]; return value?.visible === false || (value?.scale !== undefined && value.scale !== 1); });
        return !customized && p.statusPlacement === 'attached' && (p.statusStyle === 'rings' || (p.layout === 'rectangle' && p.statusStyle === 'percentage'));
    }
    function radar(width, height, p) {
        const g = { ...(layouts[p.layout] || layouts.rectangle) };
        const attached = attachedStatus(p);
        if (!attached) {
            const clearance = p.statusStyle === 'bars' ? 40 : p.statusStyle === 'velox' ? 7 : 0;
            g.widgetHeight = (p.layout === 'circle' ? 376 : 464) + clearance;
        }
        const point = position(width, height, p, 'radar', g.widgetWidth, g.widgetHeight), s = point.scale;
        const size = p.elementOptions?.minimap?.scale ?? 1;
        g.frameWidth *= size;
        g.frameHeight *= size;
        g.inset *= size;
        const minimap = p.elementPositions?.minimap;
        const left = minimap ? minimap.x * width : point.left + g.frameX * s;
        const top = minimap ? minimap.y * height : point.top + g.frameY * s;
        point.left = clamp(left, 0, Math.max(0, width - g.frameWidth * s)) - g.frameX * s;
        point.top = clamp(top, 0, Math.max(0, height - g.frameHeight * s)) - g.frameY * s;
        return { ...g, scale: s, widgetLeft: point.left, widgetTop: point.top, left: point.left + (g.frameX + g.inset) * s, top: point.top + (g.frameY + g.inset) * s, width: (g.frameWidth - 2 * g.inset) * s, height: (g.frameHeight - 2 * g.inset) * s };
    }
    const api = { canvas, defaults, choices, elementKeys, groupKeys, positionKeys, optionKeys, attachedStatus, anchors, layouts, normalize, parse, scale, position, fromScreen, radar };
    if (typeof module !== 'undefined' && module.exports)
        module.exports = api;
    root.HudPreferences = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
