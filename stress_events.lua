


local previous = { ped=0, vehicle=0, model=0, speed=0, body=nil, health=nil, falling=false }
local cooldowns = { crash=nil, fall=nil }
local function finite(value)
    return type(value)=='number' and value==value and value~=math.huge and value~=-math.huge
end
local function number(value,fallback) return finite(value) and value or fallback end
local function elapsed(now,before) return (now-before) % 4294967296 end
local function resetSamples()
    previous={ped=0,vehicle=0,model=0,speed=0,body=nil,health=nil,falling=false}
end
local function reset()
    resetSamples()
    cooldowns={crash=nil,fall=nil}
end
local function options()
    local stress=Config.Stress
    if Config.Framework~='qb' or type(stress)~='table' or stress.Mode~='internal' then return nil,nil end
    return type(stress.Crashes)=='table' and stress.Crashes or {},type(stress.Falls)=='table' and stress.Falls or {}
end
local function gain(kind,settings,now)
    local amount=math.floor(number(settings.Amount,0))
    local maximum=math.min(100,math.max(0,number(Config.Stress.MaxEventAmount,100)))
    amount=math.min(maximum,amount)
    if amount<=0 then return end
    local cooldown=math.max(1000,number(settings.Cooldown,5000))
    if cooldowns[kind] and elapsed(now,cooldowns[kind])<cooldown then return end
    cooldowns[kind]=now
    TriggerServerEvent('hud:server:GainStress',amount)
end
local function sample(now)
    local crashes,falls=options()
    if not crashes or not (crashes.Enabled or falls.Enabled) then resetSamples(); return end
    local state=VeloxHud.GetGameplayContext()
    if type(state)~='table' or state.ready~=true or state.ped==0 or not DoesEntityExist(state.ped)
        or IsEntityDead(state.ped) or IsPauseMenuActive() then resetSamples(); return end
    local ped,vehicle=state.ped,state.vehicle or 0
    if vehicle~=0 and not DoesEntityExist(vehicle) then vehicle=0 end
    local health=GetEntityHealth(ped)
    if not finite(health) then resetSamples(); return end
    if ped~=previous.ped then resetSamples(); previous.ped=ped end
    local healthDamage=previous.health and math.max(0,previous.health-health) or 0
    local onFoot=IsPedOnFoot(ped) and vehicle==0
    local falling=onFoot and IsPedFalling(ped)
    if falls.Enabled and previous.falling and not falling and onFoot
        and healthDamage>=math.max(0.1,number(falls.MinimumHealthDamage,2.0)) then
        gain('fall',falls,now)
    end
    if crashes.Enabled and vehicle~=0 then
        local model=GetEntityModel(vehicle)
        local speed,body=GetEntitySpeed(vehicle),GetVehicleBodyHealth(vehicle)
        if finite(speed) and finite(body) then
            local sameVehicle=vehicle==previous.vehicle and model==previous.model and previous.body~=nil
            local permitted=not crashes.DriverOnly or GetPedInVehicleSeat(vehicle,-1)==ped
            local classes=type(crashes.VehicleClasses)=='table' and crashes.VehicleClasses or {}
            local bodyDamage=sameVehicle and math.max(0,previous.body-body) or 0
            local minimumSpeed=math.max(1.0,number(crashes.MinimumSpeed,12.0))
            local deceleration=math.min(0.95,math.max(0.01,number(crashes.MinimumDeceleration,0.25)))
            local injured=bodyDamage>=math.max(0.1,number(crashes.MinimumBodyDamage,10.0))
                or healthDamage>=math.max(0.1,number(crashes.MinimumHealthDamage,2.0))
            if sameVehicle and permitted and classes[GetVehicleClass(vehicle)]==true and injured
                and previous.speed>=minimumSpeed and speed<=previous.speed*(1-deceleration)
                and HasEntityCollidedWithAnything(vehicle) then gain('crash',crashes,now) end
            previous.vehicle,previous.model,previous.speed,previous.body=vehicle,model,speed,body
        else previous.vehicle,previous.model,previous.speed,previous.body=0,0,0,nil end
    else previous.vehicle,previous.model,previous.speed,previous.body=0,0,0,nil end
    previous.health,previous.falling=health,falling
end
RegisterNetEvent('QBCore:Client:OnPlayerUnload',reset)
AddEventHandler('velox-hud:client:resetStressEffects',reset)
local function stopped(resource)
    if resource==GetCurrentResourceName() or resource==Config.CoreResource then reset() end
end
AddEventHandler('onResourceStop',stopped)
AddEventHandler('onClientResourceStop',stopped)
CreateThread(function()
    while true do
        sample(GetGameTimer())
        local crashes,falls=options()
        local interval=200
        if crashes and falls then
            local crashInterval=crashes.Enabled and number(crashes.PollInterval,200) or math.huge
            local fallInterval=falls.Enabled and number(falls.PollInterval,200) or math.huge
            interval=math.min(crashInterval,fallInterval)
            if interval==math.huge then interval=1000 end
        else interval=1000 end
        Wait(math.max(200,math.min(5000,interval)))
    end
end)
