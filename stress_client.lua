

local resourceName = GetCurrentResourceName()
local blurActive, blurStartedAt, scheduledAt, scheduledInterval = false, nil, nil, nil
local lastShootingSample

local function elapsed(now, previous)
    return (now - previous) % 4294967296
end

local function number(value, fallback)
    if type(value) ~= 'number' or value ~= value or value == math.huge or value == -math.huge then
        return fallback
    end
    return value
end

local function context()
    return VeloxHud.GetGameplayContext()
end

local function internalMode()
    return type(Config.Stress) == 'table' and Config.Stress.Mode == 'internal'
end

local function whitelistedJob(job)
    local list = Config.Stress.WhitelistedJobs or {}
    return type(job) == 'table' and (list[job.name] or list[job.type])
end

local function hashSet(values)
    local result = {}
    for key, enabled in pairs(values or {}) do
        if enabled then result[type(key) == 'string' and GetHashKey(key) or key] = true end
    end
    return result
end

local models = hashSet(Config.Stress.Driving.WhitelistedModels)
local weapons = hashSet(Config.Stress.Shooting.WhitelistedWeapons)

local function gain(amount)
    amount = math.floor(number(amount, 1))
    if amount > 0 then TriggerServerEvent('hud:server:GainStress', math.min(100, amount)) end
end

local function sampleDriving()
    local settings = Config.Stress.Driving
    if Config.Framework ~= 'qb' or not internalMode() or not settings.Enabled then return end
    local state = context()
    if not state.ready or whitelistedJob(state.job) then return end
    local vehicle = state.vehicle
    if vehicle == 0 or not DoesEntityExist(vehicle) then return end
    if settings.DriverOnly and GetPedInVehicleSeat(vehicle, -1) ~= state.ped then return end
    if not (settings.VehicleClasses or {})[GetVehicleClass(vehicle)] then return end
    if models[GetEntityModel(vehicle)] then return end
    local speed = GetEntitySpeed(vehicle) * (settings.Unit == 'KMH' and 3.6 or 2.236936)
    local threshold = state.seatbelt and settings.Speed or settings.UnbuckledSpeed
    if speed >= number(threshold, 100) then gain(settings.Amount) end
end

local function sampleShooting(now)
    local settings = Config.Stress.Shooting
    if Config.Framework ~= 'qb' or not internalMode() or not settings.Enabled then
        lastShootingSample = nil
        return false
    end
    local state = context()
    if not state.ready then lastShootingSample = nil; return false end
    if whitelistedJob(state.job) or not IsPedArmed(state.ped, 6) then return false end
    if IsPedShooting(state.ped) and not weapons[GetSelectedPedWeapon(state.ped)] then
        local interval = math.max(100, number(settings.SampleInterval, 1000))
        if not lastShootingSample or elapsed(now, lastShootingSample) >= interval then
            lastShootingSample = now
            local chance = math.max(0, math.min(1, number(settings.Chance, 0.1)))
            if math.random() < chance then gain(settings.Amount) end
        end
    end
    return true
end

local function resetEffects()
    if blurActive then TriggerScreenblurFadeOut(0.0) end
    blurActive, blurStartedAt, scheduledAt, scheduledInterval = false, nil, nil, nil
end

local function updateEffects(now)
    local settings = Config.Stress.Effects
    local state = context()
    local minimum = math.max(0, math.min(100, number(settings.MinimumStress, 50)))
    if not internalMode() or not settings.Enabled or not state.ready or state.stress < minimum then
        resetEffects()
        return
    end
    local severity = math.max(0, math.min(1, (state.stress - minimum) / math.max(1, 100 - minimum)))
    local minInterval = math.max(1000, number(settings.MinimumInterval, 15000))
    local maxInterval = math.max(minInterval, number(settings.MaximumInterval, 60000))
    local minBlur = math.max(0, number(settings.MinimumBlur, 1500))
    local maxBlur = math.max(minBlur, number(settings.MaximumBlur, 3000))
    local duration = minBlur + (maxBlur - minBlur) * severity
    if blurActive then
        if elapsed(now, blurStartedAt) >= duration then
            TriggerScreenblurFadeOut(250.0)
            blurActive, blurStartedAt = false, nil
            scheduledAt, scheduledInterval = now, maxInterval - (maxInterval - minInterval) * severity
        end
    elseif not scheduledAt then
        scheduledAt, scheduledInterval = now, maxInterval - (maxInterval - minInterval) * severity
    elseif elapsed(now, scheduledAt) >= scheduledInterval then
        TriggerScreenblurFadeIn(250.0)
        blurActive, blurStartedAt = true, now
        scheduledAt, scheduledInterval = nil, nil
    end
end

local function resetGameplay()
    lastShootingSample = nil
    resetEffects()
end

AddEventHandler('velox-hud:client:resetStressEffects', resetGameplay)
AddEventHandler('onResourceStop', function(stoppedResource)
    if stoppedResource == resourceName then resetGameplay() end
end)
AddEventHandler('onClientResourceStop', function(stoppedResource)
    if stoppedResource == resourceName or stoppedResource == Config.CoreResource then resetGameplay() end
end)

CreateThread(function()
    while true do
        Wait(math.max(1000, number(Config.Stress.Driving.Interval, 10000)))
        sampleDriving()
    end
end)

CreateThread(function()
    while true do
        local armed = sampleShooting(GetGameTimer())
        Wait(armed and 0 or 250)
    end
end)

CreateThread(function()
    while true do
        updateEffects(GetGameTimer())
        Wait(100)
    end
end)
