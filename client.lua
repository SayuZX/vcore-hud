local resourceName = GetCurrentResourceName()
local enabled, nuiReady, radarConfigured = true, false, false
local previousVehicle, seatbelt, radarVisible = 0, false, nil
local qbCore, playerLoaded = nil, Config.Framework == 'standalone'
local playerData = {}
local fuelCache = { vehicle = 0, at = -1, value = 0 }
local scaleform, radarTxd, radarTexture
local status = {
    hunger = Config.DefaultStatus.hunger,
    thirst = Config.DefaultStatus.thirst,
    stress = Config.DefaultStatus.stress
}
local location = { street = 'Los Santos', zone = 'San Andreas' }
local latest = { visible = false }
local warnings = {}
local preferenceKey = VeloxPreferences.Key({})
local preferences = VeloxPreferences.Read(preferenceKey)
local settingsOpen = false
local settingsTab = 'appearance'
local positionRadar, sendPreferences, applyMapShape
local mapShape

local function clamp(value, minimum, maximum)
    value = tonumber(value)
    if not value or value ~= value then return minimum end
    return math.max(minimum, math.min(maximum, value))
end

local function round(value) return math.floor(value + 0.5) end
local function nativeBool(value) return value == true or value == 1 end
local function finite(value)
    return type(value) == 'number' and value == value and value ~= math.huge and value ~= -math.huge
end
local function warnOnce(key, message)
    if warnings[key] then return end
    warnings[key] = true
    print(('[%s] %s'):format(resourceName, message))
end

local function providerValue(name, provider, ...)
    if type(provider) ~= 'function' then return nil end
    local ok, result = pcall(provider, ...)
    if ok then return result end
    warnOnce(name, ('%s provider failed: %s'):format(name, tostring(result)))
    return nil
end

local function isPlayerDead(ped)
    if nativeBool(IsEntityDead(ped)) then return true end
    local metadata = Config.Framework == 'qb' and playerData.metadata
    return type(metadata) == 'table' and (metadata.isdead == true or metadata.inlaststand == true)
end

local function closeSettings()
    local wasOpen = settingsOpen
    settingsOpen = false
    if type(SetNuiFocus) == 'function' then SetNuiFocus(false, false) end
    if type(SetNuiFocusKeepInput) == 'function' then SetNuiFocusKeepInput(false) end
    if wasOpen then SendNUIMessage({ action = 'hud:settings', data = { open = false } }) end
end

local function loadPreferences(key)
    if key == preferenceKey then return end
    closeSettings()
    preferenceKey = key
    preferences = VeloxPreferences.Read(key)
    if nuiReady and sendPreferences then sendPreferences() end
    if radarConfigured and positionRadar then positionRadar() end
end

local function updateNeeds(data)
    if type(data) ~= 'table' then return end
    for _, key in ipairs({ 'hunger', 'thirst', 'stress' }) do
        if type(data[key]) == 'number' then status[key] = clamp(data[key], 0, 100) end
    end
end

local function setSeatbelt(value)
    if type(value) ~= 'boolean' then return end
    local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
    if vehicle == 0 then seatbelt = false; return end
    previousVehicle = vehicle
    seatbelt = value
end

local function setVisible(value)
    if type(value) == 'boolean' then
        enabled = value
        if not value then closeSettings() end
    end
end

local function resetPlayerState()
    closeSettings()
    playerLoaded = Config.Framework == 'standalone'
    playerData = {}
    seatbelt, previousVehicle = false, 0
    fuelCache = { vehicle = 0, at = -1, value = 0 }
    updateNeeds(Config.DefaultStatus)
    loadPreferences(VeloxPreferences.Key({}))
    TriggerEvent('velox-hud:client:resetStressEffects')
end

local function applyPlayerData(data)
    if type(data) ~= 'table' then return end
    playerData = data
    playerLoaded = data.citizenid ~= nil and LocalPlayer.state.isLoggedIn == true
    loadPreferences(playerLoaded and VeloxPreferences.Key(data) or VeloxPreferences.Key({}))
    updateNeeds(data.metadata)
    if not playerLoaded or isPlayerDead(PlayerPedId()) then
        closeSettings()
        TriggerEvent('velox-hud:client:resetStressEffects')
    end
end

local function refreshFramework()
    if Config.Framework ~= 'qb' then return end
    if GetResourceState(Config.CoreResource) ~= 'started' then
        qbCore = nil
        if playerLoaded then resetPlayerState() end
        return
    end
    if not qbCore then
        local ok, core = pcall(function() return exports[Config.CoreResource]:GetCoreObject() end)
        if not ok or not core then return end
        qbCore = core
    end
    local ok, data = pcall(function() return qbCore.Functions.GetPlayerData() end)
    if ok and type(data) == 'table' then
        applyPlayerData(data)
    else
        qbCore, playerLoaded, playerData = nil, false, {}
        closeSettings()
        warnOnce('core', 'Unable to read QBCore player data; retrying while the core is available.')
    end
end

if Config.Framework == 'qb' then
    RegisterNetEvent('QBCore:Client:OnPlayerLoaded', function()
        refreshFramework()
    end)
    RegisterNetEvent('QBCore:Client:OnPlayerUnload', function()
        resetPlayerState()
    end)
    RegisterNetEvent('QBCore:Player:SetPlayerData', applyPlayerData)
    RegisterNetEvent('QBCore:Client:OnPlayerUpdated', function(key, value)
        if key == 'all' then
            applyPlayerData(value)
        elseif key == 'metadata' and type(value) == 'table' then
            playerData.metadata = value
            updateNeeds(value)
            if isPlayerDead(PlayerPedId()) then
                closeSettings()
                TriggerEvent('velox-hud:client:resetStressEffects')
            end
        elseif key == 'job' and type(value) == 'table' then
            playerData.job = value
        end
    end)
    RegisterNetEvent('QBCore:Client:UpdateObject', function()
        qbCore = nil
        refreshFramework()
    end)

    RegisterNetEvent('hud:client:UpdateNeeds', function(hunger, thirst)
        updateNeeds({ hunger = hunger, thirst = thirst })
    end)
    RegisterNetEvent('hud:client:UpdateStress', function(stress)
        updateNeeds({ stress = stress })
    end)
    RegisterNetEvent('seatbelt:client:ToggleSeatbelt', function(value)
        if not Config.Seatbelt.Enabled and type(value) == 'boolean' then setSeatbelt(value) end
    end)
end

RegisterNetEvent('velox-hud:client:updateNeeds', updateNeeds)
RegisterNetEvent('velox-hud:client:setSeatbelt', setSeatbelt)
RegisterNetEvent('velox-hud:client:setVisible', setVisible)
exports('UpdateNeeds', updateNeeds)
exports('SetSeatbelt', setSeatbelt)
exports('SetVisible', setVisible)

RegisterCommand('hud', function() setVisible(not enabled) end, false)

if Config.Seatbelt.Enabled then
    RegisterCommand('velox-seatbelt', function()
        local ped = PlayerPedId()
        local vehicle = GetVehiclePedIsIn(ped, false)
        if vehicle == 0 or not VeloxHud.CanInteract() then return end
        if Config.Seatbelt.ExcludedClasses[GetVehicleClass(vehicle)] then return end
        setSeatbelt(not seatbelt)
        PlaySoundFrontend(-1, 'SELECT', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true)
    end, false)
    RegisterKeyMapping('velox-seatbelt', 'Toggle seatbelt (VCORE HUD)', 'keyboard', Config.Seatbelt.Key)
end

local function shortcutAvailable(name)
    local entry = Config.Shortcuts and Config.Shortcuts[name]
    if type(entry) ~= 'table' or entry.Enabled == false then return false end
    if name == 'Music' then return Config.Settings.Enabled == true and type(Config.Music) == 'table' and Config.Music.Enabled == true end
    local provider = Config.Commands and Config.Commands[name .. 'Provider']
    if type(provider) == 'function' then return true end
    return Config.Framework == 'qb' and type(entry.Resource) == 'string'
        and GetResourceState(entry.Resource) == 'started' and type(entry.Command) == 'string'
        and entry.Command:match('^[%w_%-]+$') ~= nil
end

local function mappedKey(command, fallback)
    if type(command) == 'string' and type(GetControlInstructionalButton) == 'function' then
        local ok, label = pcall(GetControlInstructionalButton, 0, GetHashKey(command) | 0x80000000, true)
        if ok and type(label) == 'string' then
            local key = label:match('^t_([%w_]+)$')
            if key then return key:upper() end
            return ''
        end
    end
    return type(fallback) == 'string' and fallback:upper() or ''
end

local function shortcutConfig()
    local shortcuts = {}
    for _, name in ipairs({ 'Phone', 'Inventory', 'Music' }) do
        local entry = Config.Shortcuts and Config.Shortcuts[name]
        shortcuts[name:lower()] = {
            key = type(entry) == 'table' and mappedKey(entry.Command, entry.Key) or '',
            enabled = shortcutAvailable(name),
            managed = name == 'Music'
        }
    end
    shortcuts.settings = {
        key = mappedKey(Config.Settings.Command or 'hudsettings', Config.Settings.Key or 'I'),
        enabled = Config.Settings.Enabled == true,
        managed = true
    }
    return shortcuts
end

local function voiceRangeKey()
    if type(GetConvarInt) == 'function' and GetConvarInt('voice_enableProximityCycle', 1) ~= 1 then return '' end
    if GetResourceState(Config.VoiceResource or 'pma-voice') ~= 'started'
        or (Config.VoiceAdapter ~= 'auto' and Config.VoiceAdapter ~= 'pma-voice') then return '' end
    local fallback = type(GetConvar) == 'function' and GetConvar('voice_defaultCycle', 'F11') or 'F11'
    return mappedKey('cycleproximity', fallback)
end

local function otherUiFocused()
    return not settingsOpen and type(IsNuiFocused) == 'function' and IsNuiFocused()
end

local function sendConfig()
    local radar = Config.Radar
    local shortcuts = shortcutConfig()
    SendNUIMessage({ action = 'hud:config', data = {
        unit = preferences.unit,
        settingsKey = shortcuts.settings.key,
        settingsUseMouse = Config.Settings.UseMouse == true,
        shortcuts = shortcuts,
        voiceRangeKey = voiceRangeKey(),
        defaultPreferences = VeloxPreferences.Defaults(),
        nativeRadar = Config.Radar.Enabled,
        radarAlwaysVisible = preferences.mapMode == 'always',
        radarLayout = {
            referenceWidth = radar.ReferenceWidth, referenceHeight = radar.ReferenceHeight,
            minScale = radar.MinScale, maxScale = radar.MaxScale,
            right = radar.Right, top = radar.Top, diameter = radar.Diameter, inset = radar.Inset
        }
    } })
end

sendPreferences = function()
    SendNUIMessage({ action = 'hud:preferences', data = VeloxPreferences.Normalize(preferences) })
end

local function openSettings(tab)
    if not Config.Settings.Enabled or not nuiReady or not VeloxHud.CanInteract() or otherUiFocused() then return false end
    settingsOpen = true
    settingsTab = tab == 'music' and 'music' or 'appearance'
    if Config.Radar.Enabled and settingsTab == 'music' then DisplayRadar(false); radarVisible = false end
    sendConfig()
    sendPreferences()
    SetNuiFocus(true, Config.Settings.UseMouse == true)
    if type(SetNuiFocusKeepInput) == 'function' then SetNuiFocusKeepInput(false) end
    SendNUIMessage({ action = 'hud:settings', data = { open = true, tab = settingsTab } })
    return true
end

RegisterCommand(Config.Settings.Command or 'hudsettings', function()
    if settingsOpen then closeSettings() else openSettings() end
end, false)
RegisterKeyMapping(Config.Settings.Command or 'hudsettings', 'HUD settings (VCORE)', 'keyboard', Config.Settings.Key or 'I')

local function runShortcut(name)
    if not nuiReady or not VeloxHud.CanInteract() or otherUiFocused() then
        return { ok = false, message = 'Tutup menu lain sebelum memakai pintasan HUD.' }
    end
    if not shortcutAvailable(name) then
        return { ok = false, message = 'Pintasan ini belum diaktifkan di server.' }
    end
    if name == 'Music' then
        if settingsOpen and settingsTab == 'music' then closeSettings(); return { ok = true } end
        return { ok = openSettings('music') }
    end
    local ready, context = VeloxHud.CanInteract()
    if not ready then return { ok = false, message = 'Pemain belum siap.' } end
    if settingsOpen then closeSettings() end
    local provider = Config.Commands and Config.Commands[name .. 'Provider']
    if type(provider) ~= 'function' then
        local entry = Config.Shortcuts[name]
        local ok = type(ExecuteCommand) == 'function' and pcall(ExecuteCommand, entry.Command)
        if ok then return { ok = true } end
        return { ok = false, message = 'Pintasan tidak tersedia. Coba lagi nanti.' }
    end
    local ok, response = pcall(provider, context)
    if ok and type(response) == 'table' and type(response.ok) == 'boolean' then return response end
    return { ok = false, message = 'Pintasan tidak tersedia. Coba lagi nanti.' }
end

for _, name in ipairs({ 'Music' }) do
    local entry = Config.Shortcuts and Config.Shortcuts[name]
    if type(entry) == 'table' and entry.Enabled ~= false and type(entry.Command) == 'string'
        and entry.Command:match('^[%w_%-]+$') then
        RegisterCommand(entry.Command, function()
            local response = runShortcut(name)
            if response.message then SendNUIMessage({ action = 'hud:shortcutResult', data = response }) end
        end, false)
        if shortcutAvailable(name) and type(entry.Key) == 'string' and entry.Key ~= '' then
            RegisterKeyMapping(entry.Command, 'VCORE: ' .. name, 'keyboard', entry.Key)
        end
    end
end

RegisterNUICallback('shortcut:action', function(data, cb)
    local names = { phone = 'Phone', inventory = 'Inventory', music = 'Music' }
    local name = type(data) == 'table' and names[data.action]
    if not name then cb({ ok = false, message = 'Pintasan tidak dikenal.' }); return end
    cb(runShortcut(name))
end)

RegisterNUICallback('settings:open', function(data, cb)
    local tab = type(data) == 'table' and data.tab
    cb({ ok = openSettings(tab) })
end)
RegisterNUICallback('settings:close', function(_, cb) closeSettings(); cb({ ok = true }) end)
RegisterNUICallback('settings:save', function(data, cb)
    if not settingsOpen or not VeloxHud.CanInteract() then cb({ ok = false, error = 'Open HUD settings first' }); return end
    local input = type(data) == 'table' and data.preferences or nil
    if type(input) ~= 'table' or (input.version ~= nil and input.version ~= 1 and input.version ~= 2 and input.version ~= 3 and input.version ~= 4 and input.version ~= 5) then
        cb({ ok = false, error = 'Unsupported preset' }); return
    end
    local nextPreferences = VeloxPreferences.Normalize(input, preferences)
    local ok, message = VeloxPreferences.Write(preferenceKey, nextPreferences)
    if not ok then cb({ ok = false, error = message }); return end
    preferences = nextPreferences
    positionRadar()
    sendConfig()
    sendPreferences()
    cb({ ok = true, preferences = VeloxPreferences.Normalize(preferences) })
end)
RegisterNUICallback('settings:reset', function(_, cb)
    if not settingsOpen or not VeloxHud.CanInteract() then cb({ ok = false, error = 'Open HUD settings first' }); return end
    local defaults = VeloxPreferences.Defaults()
    local ok, message = VeloxPreferences.Write(preferenceKey, defaults)
    if not ok then cb({ ok = false, error = message }); return end
    preferences = defaults
    positionRadar()
    sendConfig()
    sendPreferences()
    cb({ ok = true, preferences = VeloxPreferences.Normalize(preferences) })
end)

RegisterNUICallback('ready', function(_, cb)
    nuiReady = true
    cb({ ok = true })
    SendNUIMessage({ action = 'hud:settings', data = { open = settingsOpen, tab = settingsTab } })
    sendConfig()
    sendPreferences()
    if type(VeloxHud.SendServicesConfig) == 'function' then
        providerValue('servicesConfig', VeloxHud.SendServicesConfig)
    end
    SendNUIMessage({ action = 'hud:update', data = latest })
end)

local function nativeFuelPercent(vehicle)
    local fuel = GetVehicleFuelLevel(vehicle)
    local liters = Config.FuelMode == 'liters'
        or (Config.FuelMode == 'auto' and type(GetFuelConsumptionState) == 'function'
            and nativeBool(GetFuelConsumptionState()))
    if liters then
        local capacity = GetVehicleHandlingFloat(vehicle, 'CHandlingData', 'fPetrolTankVolume')
        if finite(capacity) and capacity > 0 then fuel = fuel / capacity * 100 end
    end
    return clamp(fuel, 0, 100)
end

local fuelResources = { ['legacyfuel'] = 'LegacyFuel', ['ps-fuel'] = 'ps-fuel', ['ox_fuel'] = 'ox_fuel' }
local function readFuel(vehicle)
    local supplied = providerValue('fuel', Config.FuelProvider, vehicle)
    if finite(supplied) then return clamp(supplied, 0, 100) end
    local adapter = tostring(Config.FuelAdapter or 'native'):lower()
    local sourceResource = Config.FuelResource
    if adapter == 'auto' then
        adapter = 'native'
        for _, candidate in ipairs({ 'ox_fuel', 'ps-fuel', 'legacyfuel' }) do
            if GetResourceState(fuelResources[candidate]) == 'started' then
                adapter, sourceResource = candidate, fuelResources[candidate]
                break
            end
        end
    elseif not fuelResources[adapter] and adapter ~= 'native' then
        warnOnce('fuelAdapter', 'Unknown FuelAdapter; using the native fuel level.')
        adapter = 'native'
    end
    sourceResource = sourceResource or fuelResources[adapter]
    if sourceResource and GetResourceState(sourceResource) == 'started' then
        local ok, value
        if adapter == 'ox_fuel' then

            ok, value = pcall(function() return Entity(vehicle).state.fuel end)
            if not ok or not finite(value) then value = GetVehicleFuelLevel(vehicle); ok = true end
        else
            ok, value = pcall(function() return exports[sourceResource]:GetFuel(vehicle) end)
        end
        if ok and finite(value) then return clamp(value, 0, 100) end
        warnOnce('fuel:' .. sourceResource, ('%s did not return a fuel percentage; using native fuel.'):format(sourceResource))
    end
    return nativeFuelPercent(vehicle)
end

local function fuelPercent(vehicle)
    local now = GetGameTimer()
    if fuelCache.vehicle ~= vehicle or fuelCache.at < 0 or now < fuelCache.at
        or now - fuelCache.at >= math.max(100, Config.FuelPollInterval) then
        fuelCache.vehicle, fuelCache.at, fuelCache.value = vehicle, now, readFuel(vehicle)
    end
    return fuelCache.value
end

local function voiceState(player)
    local talking = nativeBool(NetworkIsPlayerTalking(player))
        or (type(MumbleIsPlayerTalking) == 'function' and nativeBool(MumbleIsPlayerTalking(player)))
    local range = Config.VoiceRange
    local adapter = Config.VoiceAdapter or 'auto'
    if (adapter == 'auto' or adapter == 'pma-voice') and GetResourceState(Config.VoiceResource) == 'started' then
        local proximity = LocalPlayer.state.proximity
        if type(proximity) == 'table' and finite(proximity.index) then range = proximity.index end
    end
    local custom = providerValue('voice', Config.VoiceProvider, player)
    if type(custom) == 'table' then
        if type(custom.talking) == 'boolean' then talking = custom.talking end
        if finite(custom.range) then range = custom.range end
    end
    local suppliedRange = providerValue('voiceRange', Config.VoiceRangeProvider, player)
    if finite(suppliedRange) then range = suppliedRange end
    return talking, round(clamp(range, 1, 3))
end

local function readSeatbelt(vehicle)
    if Config.Seatbelt.Enabled then return seatbelt end
    local custom = providerValue('seatbelt', Config.Seatbelt.Provider, vehicle)
    if type(custom) == 'boolean' then return custom end
    local sourceResource = Config.Seatbelt.SourceResource
    if not sourceResource then return seatbelt end
    if GetResourceState(sourceResource) ~= 'started' then return false end
    local ok, value = pcall(function() return exports[sourceResource]:HasSeatbeltOn() end)
    local harnessOk, harness = pcall(function() return exports[sourceResource]:HasHarness() end)
    if ok and type(value) == 'boolean' then return value or (harnessOk and harness == true) end
    warnOnce('seatbelt:' .. sourceResource, ('%s has no usable HasSeatbeltOn export; use Seatbelt.Provider or set SourceResource=nil for events.'):format(sourceResource))
    return seatbelt
end



VeloxHud = VeloxHud or {}
VeloxHud.GetGameplayContext = function()
        local ped = PlayerPedId()
        local vehicle = GetVehiclePedIsIn(ped, false)
        if vehicle ~= previousVehicle then
            seatbelt, previousVehicle = false, vehicle
        end
        if vehicle ~= 0 and DoesEntityExist(vehicle) then seatbelt = readSeatbelt(vehicle) end
        return {
            ready = playerLoaded and NetworkIsPlayerActive(PlayerId())
                and (Config.Framework ~= 'qb' or LocalPlayer.state.isLoggedIn == true)
                and not IsScreenFadedOut() and not IsPauseMenuActive() and not isPlayerDead(ped),
            ped = ped, vehicle = vehicle, seatbelt = seatbelt, stress = status.stress,
            job = playerData.job, playerData = playerData, qbCore = qbCore,
            loaded = playerLoaded, playerId = PlayerId()
        }
end
VeloxHud.CanInteract = function(requireDriver)
    local context = VeloxHud.GetGameplayContext()
    local ready = context.ready
    if requireDriver then
        ready = ready and context.vehicle ~= 0 and DoesEntityExist(context.vehicle)
            and GetPedInVehicleSeat(context.vehicle, -1) == context.ped
    end
    return ready, context
end
VeloxHud.GetPreferences = function() return VeloxPreferences.Normalize(preferences) end
VeloxHud.OpenSettings = openSettings
VeloxHud.CloseSettings = closeSettings

local function isVisible(ped)
    return enabled and playerLoaded and NetworkIsPlayerActive(PlayerId())
        and (Config.Framework ~= 'qb' or LocalPlayer.state.isLoggedIn == true)
        and not IsScreenFadedOut()
        and not (Config.HideWhenPaused and IsPauseMenuActive())
        and not (Config.HideWhenDead and isPlayerDead(ped))
end

local function text(value, fallback, maximum)
    if type(value) ~= 'string' then return fallback end
    return value:sub(1, maximum or 80)
end

local weatherNames = { 'EXTRASUNNY', 'CLEAR', 'CLOUDS', 'SMOG', 'FOGGY', 'OVERCAST',
    'RAIN', 'THUNDER', 'CLEARING', 'NEUTRAL', 'SNOW', 'BLIZZARD', 'SNOWLIGHT', 'XMAS', 'HALLOWEEN' }
local function weatherLabel()
    local supplied = providerValue('weather', Config.WeatherProvider)
    if type(supplied) == 'string' then return text(supplied, 'UNKNOWN', 40) end
    if type(GetPrevWeatherTypeHashName) == 'function' then
        local current = GetPrevWeatherTypeHashName()
        for _, label in ipairs(weatherNames) do
            if current == GetHashKey(label) then return label end
        end
    end
    return 'UNKNOWN'
end

local function clockTelemetry()
    local date = type(os) == 'table' and type(os.date) == 'function' and os.date('%d/%m/%Y') or ''
    if type(GetLocalTime) == 'function' then
        local year, month, day = GetLocalTime()
        if finite(year) and finite(month) and finite(day) then
            date = ('%02d/%02d/%04d'):format(day, month, year)
        end
    end
    local hours = type(GetClockHours) == 'function' and GetClockHours() or 0
    local minutes = type(GetClockMinutes) == 'function' and GetClockMinutes() or 0
    return date, ('%02d:%02d'):format(clamp(hours, 0, 23), clamp(minutes, 0, 59))
end

local function vehicleType(vehicle)
    local class = GetVehicleClass(vehicle)
    if class == 8 or class == 13 then return 'moto' end
    if class == 14 then return 'boat' end
    if class == 15 then return 'heli' end
    if class == 16 then return 'plane' end
    return 'car'
end

local function addVehicleTelemetry(state, vehicle)
    local extra = providerValue('vehicleTelemetry', VeloxHud.VehicleTelemetry, vehicle, VeloxHud.GetGameplayContext())
    if type(extra) ~= 'table' then return end
    for _, key in ipairs({ 'engineOn', 'cruise', 'limiter', 'manual', 'boosting' }) do
        if type(extra[key]) == 'boolean' then state[key] = extra[key] end
    end
    if extra.driveMode == 'normal' or extra.driveMode == 'drift' or extra.driveMode == 'sport' or extra.driveMode == 'sportplus' then
        state.driveMode = extra.driveMode
    end
    if extra.signals == 'off' or extra.signals == 'left' or extra.signals == 'right' or extra.signals == 'hazards' then
        state.signals = extra.signals
    end
    for key, limits in pairs({ nitro = {0,100}, driftScore = {0,1000000000}, driftCombo = {0,1000},
        altitude = {-1000,100000}, verticalSpeed = {-1000,1000}, engineHealth = {0,100},
        roll = {-180,180}, pitch = {-180,180} }) do
        if finite(extra[key]) then state[key] = clamp(extra[key], limits[1], limits[2]) end
    end
    if type(extra.gear) == 'string' or type(extra.gear) == 'number' then
        local gear = tostring(extra.gear):upper()
        if gear == 'R' or gear == 'N' or gear:match('^%d$') then state.gear = gear end
    end
end

local function collectState()
    local ped, player = PlayerPedId(), PlayerId()
    local vehicle = GetVehiclePedIsIn(ped, false)
    local inVehicle = vehicle ~= 0 and DoesEntityExist(vehicle)
    if vehicle ~= previousVehicle then
        seatbelt = false
        previousVehicle = vehicle
    end
    if inVehicle then seatbelt = readSeatbelt(vehicle) end
    local maxHealth = math.max(1, GetEntityMaxHealth(ped) - Config.HealthBase)
    local diving = IsPedSwimmingUnderWater(ped)
    local talking, range = voiceState(player)
    local heading = Config.CompassSource == 'camera' and GetGameplayCamRot(0).z or GetEntityHeading(ped)
    local beltAvailable = inVehicle and not Config.Seatbelt.ExcludedClasses[GetVehicleClass(vehicle)]
    local charinfo = type(playerData.charinfo) == 'table' and playerData.charinfo or {}
    local money = type(playerData.money) == 'table' and playerData.money or {}
    local job = type(playerData.job) == 'table' and playerData.job or {}
    local grade = type(job.grade) == 'table' and job.grade or {}
    local fallbackName = type(GetPlayerName) == 'function' and GetPlayerName(player) or 'Citizen'
    local name = (text(charinfo.firstname, '', 40) .. ' ' .. text(charinfo.lastname, '', 40)):match('^%s*(.-)%s*$')
    if name == '' then name = text(fallbackName, 'Citizen') end
    local date, worldTime = clockTelemetry()
    local state = {
        visible = isVisible(ped),
        health = round(clamp((GetEntityHealth(ped) - Config.HealthBase) / maxHealth * 100, 0, 100)),
        armor = round(clamp(GetPedArmour(ped), 0, 100)),
        hunger = round(status.hunger), thirst = round(status.thirst),
        stress = Config.Stress.Mode == 'off' and 0 or round(status.stress),
        stamina = round(clamp(GetPlayerSprintStaminaRemaining(player), 0, 100)),
        oxygen = diving and round(clamp(GetPlayerUnderwaterTimeRemaining(player) / math.max(0.1, Config.OxygenSeconds) * 100, 0, 100)) or 100,
        diving = diving,
        talking = talking,
        voiceRange = range,
        inVehicle = inVehicle,
        speed = 0, unit = preferences.unit, gear = 'N', rpm = 0, fuel = 0,
        seatbelt = seatbelt, seatbeltAvailable = beltAvailable,
        lights = false, highbeams = false, locked = false,

        heading = round((360 - heading) % 360) % 360,
        street = location.street, zone = location.zone,
        playerId = type(GetPlayerServerId) == 'function' and GetPlayerServerId(player) or 0,
        playerName = name, job = text(job.label, text(job.name, 'Citizen')), jobGrade = text(grade.name, ''),
        cash = finite(money.cash) and clamp(money.cash, 0, 1000000000000) or 0,
        bank = finite(money.bank) and clamp(money.bank, 0, 1000000000000) or 0,
        date = date, worldTime = worldTime, weather = weatherLabel(),
        vehicleType = inVehicle and vehicleType(vehicle) or 'car',
        engineOn = false, engineHealth = 100, cruise = false, limiter = false, manual = false,
        boosting = false, driveMode = 'normal', signals = 'off', nitro = 0, driftScore = 0, driftCombo = 0,
        altitude = 0, verticalSpeed = 0, roll = 0, pitch = 0
    }
    if inVehicle then
        local speed = GetEntitySpeed(vehicle)
        local gear = GetVehicleCurrentGear(vehicle)
        local localVelocity = GetEntitySpeedVector(vehicle, true)
        local _, lights, highbeams = GetVehicleLightsState(vehicle)
        local lockStatus = GetVehicleDoorLockStatus(vehicle)
        state.speed = round(speed * (state.unit == 'KMH' and 3.6 or 2.236936))
        state.gear = gear == 0 and (localVelocity.y < -0.1 and 'R' or 'N') or tostring(gear)
        state.rpm = GetIsVehicleEngineRunning(vehicle) and clamp(GetVehicleCurrentRpm(vehicle), 0, 1) or 0
        state.fuel = round(fuelPercent(vehicle))
        state.lights = nativeBool(lights) or nativeBool(highbeams)
        state.highbeams = nativeBool(highbeams)
        state.locked = lockStatus >= 2
        state.engineOn = nativeBool(GetIsVehicleEngineRunning(vehicle))
        if type(GetVehicleEngineHealth) == 'function' then state.engineHealth = round(clamp(GetVehicleEngineHealth(vehicle) / 10, 0, 100)) end
        local coords = GetEntityCoords(vehicle)
        state.altitude = round(clamp(coords.z, -1000, 100000))
        local velocity = GetEntitySpeedVector(vehicle, false)
        if finite(velocity.z) then state.verticalSpeed = velocity.z end
        addVehicleTelemetry(state, vehicle)
    end
    return state
end



local function nativeRect(x, y, width, height)
    SetScriptGfxAlign(string.byte('L'), string.byte('T'))
    SetScriptGfxAlignParams(0.0, 0.0, 0.0, 0.0)
    local originX, originY = GetScriptGfxPosition(0.0, 0.0)
    local basisX, basisY = GetScriptGfxPosition(1.0, 1.0)
    ResetScriptGfxAlign()
    local scaleX = math.max(0.001, basisX - originX)
    local scaleY = math.max(0.001, basisY - originY)
    return (x - originX) / scaleX, (y - originY) / scaleY, width / scaleX, height / scaleY
end

applyMapShape = function()
    local desired = preferences.layout
    if mapShape == desired then return end
    if mapShape == 'circle' and radarTexture and radarTexture ~= 0 then
        RemoveReplaceTexture('platform:/textures/graphics', 'radarmasksm')
    end
    if desired == 'circle' then
        if Config.Radar.CircularMask then
            if not radarTxd then radarTxd = CreateRuntimeTxd('velox_radar') end
            if not radarTexture then
                radarTexture = CreateRuntimeTextureFromImage(radarTxd, 'radarmasksm', 'html/assets/minimap-mask.png')
            end
            if radarTexture and radarTexture ~= 0 then
                AddReplaceTexture('platform:/textures/graphics', 'radarmasksm', 'velox_radar', 'radarmasksm')
            else
                warnOnce('mapMask', 'Circular minimap texture did not load; using the native circular clip.')
            end
        end
        SetMinimapClipType(1)
    else
        SetMinimapClipType(0)
    end
    mapShape = desired
end

positionRadar = function()
    if not Config.Radar.Enabled then return end
    local width, height = GetActiveScreenResolution()
    if width < 1 or height < 1 then return end
    local radar = Config.Radar
    local geometry = VeloxPreferences.Radar(width, height, preferences)

    local mapWidth, mapHeight = geometry.width * radar.ScaleX, geometry.height * radar.ScaleY
    local left = geometry.left + radar.OffsetX * geometry.scale + (geometry.width - mapWidth) / 2
    local top = geometry.top + radar.OffsetY * geometry.scale + (geometry.height - mapHeight) / 2
    applyMapShape()
    local x, y, w, h = nativeRect(left / width, top / height, mapWidth / width, mapHeight / height)
    SetMinimapComponentPosition('minimap', 'L', 'T', x, y, w, h)
    SetMinimapComponentPosition('minimap_mask', 'L', 'T', x, y, w, h)

    SetMinimapComponentPosition('minimap_blur', 'L', 'T', -2.0, -2.0, 0.0, 0.0)
    SetRadarZoom(radar.Zoom)
    radarConfigured = true
end

CreateThread(function()
    while not NetworkIsPlayerActive(PlayerId()) do Wait(250) end
    if Config.Radar.Enabled then
        scaleform = RequestScaleformMovie('minimap')
        positionRadar()
        SetRadarBigmapEnabled(true, false)
        Wait(0)
        SetRadarBigmapEnabled(false, false)
    end
    local lastWidth, lastHeight, lastSafezone
    while true do
        local width, height = GetActiveScreenResolution()
        local safezone = GetSafeZoneSize()
        if width ~= lastWidth or height ~= lastHeight or safezone ~= lastSafezone then
            positionRadar()
            lastWidth, lastHeight, lastSafezone = width, height, safezone
        end
        local ped = PlayerPedId()
        local coords = GetEntityCoords(ped)
        local streetHash = GetStreetNameAtCoord(coords.x, coords.y, coords.z)
        local street = GetStreetNameFromHashKey(streetHash)
        local zoneKey = GetNameOfZone(coords.x, coords.y, coords.z)
        local zone = GetLabelText(zoneKey)
        location.street = street ~= '' and street or 'Off-road'
        location.zone = zone ~= 'NULL' and zone or zoneKey
        Wait(math.max(100, Config.LocationInterval))
    end
end)

CreateThread(function()
    while true do
        refreshFramework()
        updateNeeds(providerValue('status', Config.StatusProvider))
        Wait(math.max(250, Config.StatusInterval))
    end
end)

CreateThread(function()
    while true do
        latest = collectState()
        if settingsOpen and not VeloxHud.CanInteract() then closeSettings() end
        if nuiReady then SendNUIMessage({ action = 'hud:update', data = latest }) end
        if Config.Radar.Enabled then
            local mapOption = preferences.elementOptions and preferences.elementOptions.minimap
            local show = latest.visible and not (settingsOpen and settingsTab == 'music') and preferences.mapMode ~= 'off' and (not mapOption or mapOption.visible ~= false)
                and (preferences.mapMode == 'always' or latest.inVehicle)
            if show ~= radarVisible then DisplayRadar(show); radarVisible = show end
            if Config.Radar.DisableExpandedMap and IsBigmapActive() then SetRadarBigmapEnabled(false, false) end
        end
        Wait(math.max(50, Config.UpdateInterval))
    end
end)

CreateThread(function()
    while true do
        if latest.visible then
            for _, component in ipairs(Config.HideComponents) do HideHudComponentThisFrame(component) end
        end
        if Config.Radar.Enabled and Config.Radar.HideVanillaBars and scaleform and HasScaleformMovieLoaded(scaleform) then
            BeginScaleformMovieMethod(scaleform, 'SETUP_HEALTH_ARMOUR')
            ScaleformMovieMethodAddParamInt(3)
            EndScaleformMovieMethod()
        end
        if Config.Seatbelt.Enabled and Config.Seatbelt.BlockExit and seatbelt then
            local vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
            if vehicle ~= 0 and vehicle == previousVehicle then
                DisableControlAction(0, 75, true)
                DisableControlAction(27, 75, true)
            end
        end
        Wait(0)
    end
end)

AddEventHandler('onClientResourceStart', function(startedResource)
    if startedResource == Config.CoreResource then qbCore = nil; refreshFramework() end
    fuelCache.at = -1
    if nuiReady then sendConfig() end
end)

AddEventHandler('onClientResourceStop', function(stoppedResource)
    if stoppedResource == Config.CoreResource and Config.Framework == 'qb' then
        qbCore = nil
        resetPlayerState()
    end
    if stoppedResource == Config.Seatbelt.SourceResource then seatbelt = false end
    fuelCache.at = -1
    if nuiReady then sendConfig() end
end)

AddEventHandler('onResourceStop', function(stoppedResource)
    if stoppedResource ~= resourceName then return end
    closeSettings()
    if radarTexture and radarTexture ~= 0 then
        RemoveReplaceTexture('platform:/textures/graphics', 'radarmasksm')
        SetMinimapClipType(0)
    end
    if radarConfigured then
        SetMinimapComponentPosition('minimap', 'L', 'B', -0.0045, 0.002, 0.150, 0.188888)
        SetMinimapComponentPosition('minimap_mask', 'L', 'B', 0.020, 0.032, 0.111, 0.159)
        SetMinimapComponentPosition('minimap_blur', 'L', 'B', -0.03, 0.022, 0.266, 0.237)
        SetRadarBigmapEnabled(false, false)
        SetRadarZoom(1100)
        DisplayRadar(true)
    end
    if scaleform and HasScaleformMovieLoaded(scaleform) then
        BeginScaleformMovieMethod(scaleform, 'SETUP_HEALTH_ARMOUR')
        ScaleformMovieMethodAddParamInt(0)
        EndScaleformMovieMethod()
        SetScaleformMovieAsNoLongerNeeded(scaleform)
    end
end)
