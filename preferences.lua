
VeloxPreferences = {}


local prefix = 'velox:preferences:v1:'
local maximumBytes = 8192
local canvas = { width = 1920, height = 1080, minScale = 0.5, maxScale = 2 }
local layouts = {
    rectangle = { widgetWidth = 430, widgetHeight = 448, frameWidth = 360, frameHeight = 214,
        frameX = 0, frameY = 174, inset = 0 },
    circle = { widgetWidth = 440, widgetHeight = 300, frameWidth = 280, frameHeight = 280,
        frameX = 26, frameY = 10, inset = 7 }
}
local anchors = { radar = 'bottom-left', vitals = 'bottom-left', vehicle = 'bottom-right',
    identity = 'top-right', shortcuts = 'right-center' }
local legacyPositions = {
    radar = { x = 32, y = 575 }, vitals = { x = 32, y = 885 }, vehicle = { x = 1650, y = 785 },
    identity = { x = 1590, y = 30 }, shortcuts = { x = 1838, y = 435 }
}
local enums = {
    moveMode = { group = true, icon = true },
    layout = { rectangle = true, circle = true },
    theme = { dark = true, light = true, dynamic = true },
    statusStyle = { rings = true, percentage = true, bars = true, velox = true },
    statusPlacement = { standalone = true, attached = true },
    identityShape = { pill = true, rounded = true, square = true },
    moneyShape = { pill = true, rounded = true, square = true },
    cashShape = { pill = true, rounded = true, square = true },
    bankShape = { pill = true, rounded = true, square = true },
    shortcutShape = { circle = true, rounded = true, square = true },
    speedStyle = { auto = true, velox = true, minimal = true, dial = true, digital = true,
        bar = true, drift = true, moto = true, boat = true, plane = true, heli = true,
        arc = true, split = true, ribbon = true, numeric = true, outline = true, rail = true },
    unit = { MPH = true, KMH = true }, mapMode = { always = true, vehicle = true, off = true }
}
local elementKeys = { 'minimap', 'music', 'location', 'clock', 'weather', 'compass', 
    'mapVehicle', 'mapMusic', 'mapVoice', 'mapSettings', 'radio', 'cursor', 'voice', 'brandMark',
    'brand', 'player', 'date', 'cash', 'bank', 'health', 'armor', 'hunger', 'thirst', 'stress',
    'stamina', 'speedFace', 'speedReadout', 'gear', 'fuel', 'rpm', 'lights', 'belt', 'lock',
    'cruise', 'signals', 'nitro', 'driveMode', 'vehicleClass', 'aerialValues', 'phone',
    'inventory', 'musicShortcut', 'settings' }
local positionKeys = { 'status', 'speedometer', 'identity', 'shortcuts' }
for _, key in ipairs(elementKeys) do positionKeys[#positionKeys + 1] = key end
local optionKeys = { 'status', 'speedometer', 'identity', 'shortcuts', 'mapTools' }
for _, key in ipairs(elementKeys) do optionKeys[#optionKeys + 1] = key end
local booleanKeys = { 'blur', 'speedBackground', 'showIdentity', 'showMoney', 'showCash', 'showBank', 'showShortcuts', 'showVitals',
    'showVehicle', 'showVoice', 'showMusic', 'showLocation', 'showMapTools' }
local function finite(value)
    return type(value) == 'number' and value == value and value ~= math.huge and value ~= -math.huge
end
local function bound(value, minimum, maximum) return math.max(minimum, math.min(maximum, value)) end
local function defaults()
    return {
        version = 5, moveMode = 'group', layout = 'rectangle', theme = 'dark', statusStyle = 'rings', speedStyle = 'auto',
        unit = Config.Unit == 'KMH' and 'KMH' or 'MPH', accent = '#70e1ca', scale = 1,
        blur = true, speedBackground = false, showIdentity = true, showMoney = true, showCash = true, showBank = true, showShortcuts = true,
        showVitals = true, showVehicle = true, showVoice = true, showMusic = true,
        showLocation = true, showMapTools = true, statusPlacement = 'standalone',
        identityShape = 'pill', moneyShape = 'pill', cashShape = 'pill', bankShape = 'pill', shortcutShape = 'circle',
        mapMode = Config.Radar.AlwaysVisible and 'always' or 'vehicle',
        elementPositions = {}, elementOptions = {},
        positions = {
            radar = { x = 32, y = 24 }, vitals = { x = 32, y = 24 }, vehicle = { x = 32, y = 24 },
            identity = { x = 34, y = 28 }, shortcuts = { x = 34, y = 72 }
        }
    }
end
local function legacySize(name, input)
    if name == 'radar' then
        if input.layout == 'circle' then return 184, 342 end
        return 280, 368
    elseif name == 'vitals' then
        if input.statusStyle == 'velox' then return 352, 67 end
        return 360, input.statusStyle == 'bars' and 100 or 65
    elseif name == 'vehicle' then
        if input.speedStyle == 'velox' then return 224, 151 end
        return 246, 210
    elseif name == 'identity' then
        return 278, input.showMoney == false and 92 or 184
    end
    return 48, 220
end
local function migrate(input)
    if type(input) ~= 'table' or input.version ~= 1 then return input end
    local result, baseline = {}, defaults()
    local oldScale = finite(input.scale) and bound(input.scale, 0.7, 1.3) or 1
    local oldWidth, oldHeight = 1920 / oldScale, 969 / oldScale
    for key, value in pairs(input) do result[key] = value end
    result.version, result.positions = 5, {}
    for name, old in pairs(legacyPositions) do
        local supplied = type(input.positions) == 'table' and input.positions[name] or nil
        if type(supplied) ~= 'table' then supplied = {} end
        local x, y = finite(supplied.x) and supplied.x or old.x, finite(supplied.y) and supplied.y or old.y

        if y == old.y and (x == old.x or (name == 'shortcuts' and x == 1800)) then
            result.positions[name] = baseline.positions[name]
        else
            local w, h = legacySize(name, input)
            local left, top, ratio = bound(x, 0, math.max(0, oldWidth - w)), bound(y, 0, math.max(0, oldHeight - h)), 1080 / 969
            if name == 'radar' or name == 'vitals' then
                result.positions[name] = { x = left, y = (oldHeight - top - h) * ratio }
            elseif name == 'vehicle' then
                result.positions[name] = { x = oldWidth - left - w, y = (oldHeight - top - h) * ratio }
            elseif name == 'identity' then
                result.positions[name] = { x = oldWidth - left - w, y = top * ratio }
            else
                result.positions[name] = { x = oldWidth - left - w, y = (top + h / 2 - oldHeight / 2) * ratio }
            end
        end
    end
    return result
end
local function apply(result, input)
    if type(input) ~= 'table' then return end
    input = migrate(input)
    local moneyShape = rawget(input, 'moneyShape')
    if type(moneyShape) == 'string' and enums.moneyShape[moneyShape] then
        for _, key in ipairs({ 'cashShape', 'bankShape' }) do
            if rawget(input, key) == nil then result[key] = moneyShape end
        end
    end
    for key, allowed in pairs(enums) do
        if type(input[key]) == 'string' and allowed[input[key]] then result[key] = input[key] end
    end
    for _, key in ipairs(booleanKeys) do
        if type(input[key]) == 'boolean' then result[key] = input[key] end
    end
    if finite(input.scale) then result.scale = bound(input.scale, 0.7, 1.3) end
    if type(input.accent) == 'string' and input.accent:match('^#%x%x%x%x%x%x$') then
        result.accent = input.accent:lower()
    end

    local options = rawget(input, 'elementOptions')
    if options ~= nil then
        result.elementOptions = {}
        if type(options) == 'table' then
            for _, key in ipairs(optionKeys) do
                local value = rawget(options, key)
                if type(value) == 'table' then
                    local option, visible, size = {}, rawget(value, 'visible'), rawget(value, 'scale')
                    if type(visible) == 'boolean' then option.visible = visible end
                    if finite(size) then option.scale = bound(size, 0.5, 2) end
                    if next(option) then result.elementOptions[key] = option end
                end
            end
        end
    end
    local points = rawget(input, 'elementPositions')
    if points ~= nil then
        result.elementPositions = {}
        if type(points) == 'table' then
            for _, key in ipairs(positionKeys) do
                local point = rawget(points, key)
                if type(point) == 'table' then
                    local x, y = rawget(point, 'x'), rawget(point, 'y')
                    if finite(x) and finite(y) then
                        result.elementPositions[key] = { x = bound(x, 0, 1), y = bound(y, 0, 1) }
                    end
                end
            end
        end
    end
    if type(input.positions) == 'table' then
        for key, point in pairs(result.positions) do
            local supplied = input.positions[key]
            if type(supplied) == 'table' then
                if finite(supplied.x) then point.x = bound(supplied.x, 0, canvas.width * 4) end
                if finite(supplied.y) then
                    point.y = bound(supplied.y, key == 'shortcuts' and -canvas.height * 4 or 0, canvas.height * 4)
                end
            end
        end
    end
end

function VeloxPreferences.Defaults()
    local result = defaults()
    apply(result, Config.Preferences)
    return result
end
function VeloxPreferences.Normalize(input, base)
    local result = VeloxPreferences.Defaults()
    apply(result, base)
    apply(result, input)
    return result
end


function VeloxPreferences.Scale(width, height, preferences)
    return bound(math.min(width / canvas.width, height / canvas.height), canvas.minScale, canvas.maxScale) * preferences.scale
end
function VeloxPreferences.Position(width, height, preferences, name, widgetWidth, widgetHeight)
    local scale, point, anchor = VeloxPreferences.Scale(width, height, preferences), preferences.positions[name], anchors[name]
    if not point or not anchor then error('Unknown HUD widget: ' .. tostring(name)) end
    local left = anchor == 'bottom-left' and point.x * scale or width - (point.x + widgetWidth) * scale
    local top
    if anchor == 'top-right' then top = point.y * scale
    elseif anchor == 'right-center' then top = height / 2 + (point.y - widgetHeight / 2) * scale
    else top = height - (point.y + widgetHeight) * scale end
    return { left = bound(left, 0, math.max(0, width - widgetWidth * scale)),
        top = bound(top, 0, math.max(0, height - widgetHeight * scale)), scale = scale }
end
function VeloxPreferences.Radar(width, height, preferences)
    local geometry = {}
    for key, value in pairs(layouts[preferences.layout] or layouts.rectangle) do geometry[key] = value end

    local customized = false
    for _, key in ipairs({'status','health','armor','hunger','thirst','stress','stamina','minimap'}) do
        local option = preferences.elementOptions and preferences.elementOptions[key]
        if option and (option.visible == false or (option.scale ~= nil and option.scale ~= 1)) then customized = true end
    end
    local attached = not customized and preferences.statusPlacement == 'attached' and (preferences.statusStyle == 'rings'
        or (preferences.layout == 'rectangle' and preferences.statusStyle == 'percentage'))
    if not attached then
        local clearance = preferences.statusStyle == 'bars' and 40 or (preferences.statusStyle == 'velox' and 7 or 0)
        geometry.widgetHeight = (preferences.layout == 'circle' and 376 or 464) + clearance
    end
    local point = VeloxPreferences.Position(width, height, preferences, 'radar', geometry.widgetWidth, geometry.widgetHeight)
    local option = preferences.elementOptions and preferences.elementOptions.minimap
    local size = option and option.scale or 1
    geometry.frameWidth, geometry.frameHeight, geometry.inset = geometry.frameWidth * size, geometry.frameHeight * size, geometry.inset * size
    local minimap = preferences.elementPositions and preferences.elementPositions.minimap
    local left = minimap and minimap.x * width or point.left + geometry.frameX * point.scale
    local top = minimap and minimap.y * height or point.top + geometry.frameY * point.scale
    point.left = bound(left, 0, math.max(0, width - geometry.frameWidth * point.scale)) - geometry.frameX * point.scale
    point.top = bound(top, 0, math.max(0, height - geometry.frameHeight * point.scale)) - geometry.frameY * point.scale
    local result = {}
    for key, value in pairs(geometry) do result[key] = value end
    result.scale, result.widgetLeft, result.widgetTop = point.scale, point.left, point.top
    result.left = point.left + (geometry.frameX + geometry.inset) * point.scale
    result.top = point.top + (geometry.frameY + geometry.inset) * point.scale
    result.width = (geometry.frameWidth - 2 * geometry.inset) * point.scale
    result.height = (geometry.frameHeight - 2 * geometry.inset) * point.scale
    return result
end

function VeloxPreferences.Key(data)
    if Config.Framework == 'standalone' then return 'standalone' end
    if type(data) ~= 'table' or type(data.citizenid) ~= 'string'
        or #data.citizenid < 1 or #data.citizenid > 80 then return nil end
    return 'character:' .. data.citizenid
end
function VeloxPreferences.Read(key)
    local fallback = VeloxPreferences.Defaults()
    if type(key) ~= 'string' or type(GetResourceKvpString) ~= 'function' then return fallback end
    local ok, raw = pcall(GetResourceKvpString, prefix .. key)
    if not ok or type(raw) ~= 'string' or #raw > maximumBytes or #raw == 0 then return fallback end
    if type(json) ~= 'table' or type(json.decode) ~= 'function' then return fallback end
    local decodedOk, decoded = pcall(json.decode, raw)
    if not decodedOk or type(decoded) ~= 'table' or (decoded.version ~= 1 and decoded.version ~= 2 and decoded.version ~= 3 and decoded.version ~= 4 and decoded.version ~= 5) then return fallback end
    return VeloxPreferences.Normalize(decoded)
end
function VeloxPreferences.Write(key, input)
    if type(input) ~= 'table' or (input.version ~= nil and input.version ~= 1
        and input.version ~= 2 and input.version ~= 3 and input.version ~= 4 and input.version ~= 5) then return false, 'Unsupported preset' end
    if type(key) ~= 'string' or type(SetResourceKvp) ~= 'function'
        or type(json) ~= 'table' or type(json.encode) ~= 'function' then return false, 'Storage unavailable' end
    local ok, encoded = pcall(json.encode, VeloxPreferences.Normalize(input))
    if not ok or type(encoded) ~= 'string' or #encoded > maximumBytes then return false, 'Invalid preset' end
    local saved = pcall(SetResourceKvp, prefix .. key, encoded)
    if not saved then return false, 'Unable to save preferences' end
    return true
end
