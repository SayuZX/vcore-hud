local settings = Config.VehicleControls
local active = { vehicle=0, model=0, cruise=false, limiter=false, manual=false, gear=1,
    driveMode='normal', signals='off', cruiseSpeed=0, limitSpeed=0, handling={},
    driftScore=0, driftCombo=1, driftTime=0, lastDrift=0, lastSample=0,
    boosting=false, nitroStart=0, nitroDuration=0, nitroVehicle=0, particles={} }
local lastAction, pendingNitro, requestSerial = {}, nil, 0
local knownActions={engine=true,lock=true,lights=true,window=true,door=true,signalLeft=true,
    signalRight=true,hazards=true,cruise=true,limiter=true,manual=true,gearUp=true,gearDown=true,
    mode=true,nitro=true,seatbelt=true}
local eject = { ped=0, flag=nil, vehicle=0, speed=0, body=1000, sample=0 }
local cruiseExternal = type(settings.Cruise.Resource)=='string' and GetResourceState(settings.Cruise.Resource)=='started'
local externalCruiseState

local function finite(value)
    return type(value)=='number' and value==value and value~=math.huge and value~=-math.huge
end
local function clamp(value, low, high) return math.min(high, math.max(low, value)) end
local function elapsed(now, thenTime) return (now-thenTime) % 4294967296 end
local function result(ok, message) return { ok=ok, message=message } end
local function notify(message, ok)
    SendNUIMessage({action='hud:notice',data={message=message,ok=ok==true}})
    if Config.Framework=='qb' then TriggerEvent('QBCore:Notify', message, ok and 'success' or 'error', 3500) end
end
local function context(requireDriver)
    if VeloxHud.CanInteract then
        local ok, state = VeloxHud.CanInteract(requireDriver)
        return ok==true, state
    end
    local state = VeloxHud.GetGameplayContext()
    local ok = state and state.ready==true and not IsPauseMenuActive() and not IsEntityDead(state.ped)
    if requireDriver then ok=ok and state.vehicle~=0 and DoesEntityExist(state.vehicle)
        and GetPedInVehicleSeat(state.vehicle,-1)==state.ped end
    return ok==true, state
end
local function validActive()
    return active.vehicle~=0 and DoesEntityExist(active.vehicle) and GetEntityModel(active.vehicle)==active.model
        and (not active.network or NetworkGetNetworkIdFromEntity(active.vehicle)==active.network)
end
local function keys(vehicle)
    local plate = (GetVehicleNumberPlateText(vehicle) or ''):match('^%s*(.-)%s*$')
    if type(settings.KeyProvider)=='function' then
        local ok, allowed=pcall(settings.KeyProvider,vehicle,plate)
        return ok and allowed==true
    end
    local resource=settings.KeyResource
    if type(resource)~='string' or GetResourceState(resource)~='started' then return false end
    local ok, allowed=pcall(function() return exports[resource]:HasKeys(plate) end)
    return ok and allowed==true
end
local function stopParticles()
    for _, handle in ipairs(active.particles) do StopParticleFxLooped(handle,false) end
    active.particles={}
end
local function stopBoost()
    if active.boosting and validActive() then SetVehicleBoostActive(active.vehicle,false) end
    active.boosting=false
    stopParticles()
end
local function restoreEjection()
    if eject.ped~=0 and DoesEntityExist(eject.ped) and type(eject.flag)=='boolean' then
        SetPedConfigFlag(eject.ped,32,eject.flag)
    end
    eject={ped=0,flag=nil,vehicle=0,speed=0,body=1000,sample=0}
end
local function restoreHandling()
    if validActive() then
        for name, value in pairs(active.handling) do SetVehicleHandlingFloat(active.vehicle,'CHandlingData',name,value) end
    end
    active.handling={}
end
local function releaseSpeedCap(owner)
    if owner and active.speedCap~=owner then return end
    if validActive() and active.speedCap then SetVehicleMaxSpeed(active.vehicle,0.0) end
    active.speedCap=nil
end
local function externalCruiseValid()
    local tracked=externalCruiseState
    if not tracked or not DoesEntityExist(tracked.vehicle) or GetEntityModel(tracked.vehicle)~=tracked.model then return false end
    local ped=PlayerPedId()
    return not IsEntityDead(ped) and GetVehiclePedIsIn(ped,false)==tracked.vehicle
        and GetPedInVehicleSeat(tracked.vehicle,-1)==ped
        and (not tracked.network or NetworkGetNetworkIdFromEntity(tracked.vehicle)==tracked.network)
end
local function syncCruiseOwner(running)
    if running==nil then
        running=type(settings.Cruise.Resource)=='string' and GetResourceState(settings.Cruise.Resource)=='started'
    end
    if running~=cruiseExternal then
        externalCruiseState=nil
        active.cruise=false
        active.cruiseOwner=nil
        releaseSpeedCap('cruise')
        cruiseExternal=running
    end
    return running
end
local function reset()
    if not externalCruiseValid() then externalCruiseState=nil end
    stopBoost()
    restoreHandling()
    releaseSpeedCap()
    if validActive() then
        if active.highGear then SetVehicleHighGear(active.vehicle,active.highGear) end
        if active.signalsOwned then
            SetVehicleIndicatorLights(active.vehicle,0,false)
            SetVehicleIndicatorLights(active.vehicle,1,false)
        end
    end
    restoreEjection()
    active={vehicle=0,model=0,cruise=false,limiter=false,manual=false,gear=1,
        driveMode='normal',signals='off',cruiseSpeed=0,limitSpeed=0,handling={},
        driftScore=0,driftCombo=1,driftTime=0,lastDrift=0,lastSample=0,
        boosting=false,nitroStart=0,nitroDuration=0,nitroVehicle=0,particles={}}
    pendingNitro=nil
    lastAction={}
end
local function ownVehicle(vehicle)
    if vehicle~=active.vehicle or (vehicle~=0 and (GetEntityModel(vehicle)~=active.model
        or active.network and NetworkGetNetworkIdFromEntity(vehicle)~=active.network)) then
        reset()
        if vehicle~=0 and DoesEntityExist(vehicle) then
            active.vehicle,active.model=vehicle,GetEntityModel(vehicle)
            if NetworkGetEntityIsNetworked(vehicle) then active.network=NetworkGetNetworkIdFromEntity(vehicle) end
            active.lastSample=GetGameTimer()
        end
    end
    if externalCruiseValid() and externalCruiseState.vehicle==vehicle then
        active.cruise=true
        active.cruiseOwner='external'
    end
end
local function road(vehicle) return settings.RoadClasses[GetVehicleClass(vehicle)]==true end
local function currentSignals(vehicle)
    if type(GetVehicleIndicatorLights)=='function' then
        local value=GetVehicleIndicatorLights(vehicle)
        if value==1 then return 'left' elseif value==2 then return 'right' elseif value==3 then return 'hazards'
        elseif value==0 then return 'off' end
    end
    return active.vehicle==vehicle and active.signals or 'off'
end
local function signal(mode)
    active.signals=mode
    active.signalsOwned=true
    SetVehicleIndicatorLights(active.vehicle,1,mode=='left' or mode=='hazards')
    SetVehicleIndicatorLights(active.vehicle,0,mode=='right' or mode=='hazards')
end
local function desired(data, current)
    if type(data.value)=='boolean' then return data.value end
    return not current
end
local function displayUnit()
    if type(VeloxHud.GetPreferences)=='function' then
        local ok,preferences=pcall(VeloxHud.GetPreferences)
        if ok and type(preferences)=='table' and (preferences.unit=='KMH' or preferences.unit=='MPH') then return preferences.unit end
    end
    return Config.Unit=='KMH' and 'KMH' or 'MPH'
end
local function mode(name)
    if name~='normal' and name~='drift' and name~='sport' and name~='sportplus' then
        return result(false,'Unknown driving mode.')
    end
    if not settings.Modes.Enabled then return result(false,'Driving modes are disabled.') end
    restoreHandling()
    active.driveMode='normal'
    local profile=settings.Modes[name]
    if name~='normal' and type(profile)~='table' then return result(false,'Driving mode is not configured.') end
    if profile then
        local allowed={fTractionCurveMin=true,fTractionCurveMax=true,fLowSpeedTractionLossMult=true,
            fInitialDriveForce=true,fBrakeForce=true}
        for field,multiplier in pairs(profile) do
            if allowed[field] and finite(multiplier) and multiplier>=0.2 and multiplier<=2.0 then
                local previous=GetVehicleHandlingFloat(active.vehicle,'CHandlingData',field)
                if finite(previous) then
                    active.handling[field]=previous
                    SetVehicleHandlingFloat(active.vehicle,'CHandlingData',field,previous*multiplier)
                end
            end
        end
    end
    active.driveMode=name
    return result(true,'Driving mode: '..name..'.')
end
local function nitroRemaining()
    if active.nitroDuration<=0 or active.nitroVehicle~=active.vehicle then return 0 end
    return math.max(0,active.nitroDuration-elapsed(GetGameTimer(),active.nitroStart))
end
local function nitro(data)
    if not Config.Nitro.Enabled then return result(false,'Nitro is disabled in the server configuration.') end
    local wanted=desired(data,active.boosting)
    if not wanted then
        stopBoost()
        if pendingNitro then pendingNitro.wantBoost=false end
        return result(true,'Nitro released.')
    end
    if active.cruise or active.limiter then return result(false,'Disable cruise and the speed limiter before boosting.') end
    if not GetIsVehicleEngineRunning(active.vehicle) then return result(false,'Start the engine before boosting.') end
    if not IsVehicleOnAllWheels(active.vehicle) or GetEntitySpeed(active.vehicle)<Config.Nitro.MinimumSpeed then
        return result(false,'Nitro requires a moving road vehicle on the ground.')
    end
    if nitroRemaining()>0 then active.boosting=true; return result(true,'Nitro engaged.') end
    if pendingNitro then pendingNitro.wantBoost=true; return result(true,'Nitro authorization is pending.') end
    if not NetworkGetEntityIsNetworked(active.vehicle) then return result(false,'Nitro requires a networked vehicle.') end
    requestSerial=(requestSerial % 2147483646)+1
    pendingNitro={id=requestSerial,vehicle=active.vehicle,time=GetGameTimer(),wantBoost=true}
    TriggerServerEvent('velox-hud:server:nitroRequest',requestSerial,NetworkGetNetworkIdFromEntity(active.vehicle))
    return result(true,'Checking nitro canister and vehicle permission…')
end

local function vehicleAction(data)
    if not settings.Enabled then return result(false,'Vehicle controls are disabled.') end
    if type(data)~='table' or type(data.action)~='string' or #data.action>32 then
        return result(false,'Invalid vehicle action.')
    end
    if data.value~=nil and type(data.value)~='boolean' then return result(false,'Invalid action state.') end
    if data.speed~=nil and (not finite(data.speed) or data.speed<=0 or data.speed>500) then return result(false,'Invalid speed.') end
    if data.index~=nil and (not finite(data.index) or data.index%1~=0 or data.index<0 or data.index>5) then return result(false,'Invalid control index.') end
    if data.mode~=nil and (type(data.mode)~='string' or #data.mode>16) then return result(false,'Invalid driving mode.') end
    if not knownActions[data.action] then return result(false,'Unknown vehicle action.') end
    local allowed,state=context(true)
    if not allowed then return result(false,'Vehicle controls require a living, active driver.') end
    local vehicle=state.vehicle
    ownVehicle(vehicle)
    syncCruiseOwner()
    local action=data.action
    if action~='engine' and action~='lock' and action~='lights' and action~='window' and action~='door'
        and not road(vehicle) then return result(false,'This action requires a road vehicle.') end
    local now=GetGameTimer()
    if lastAction[action] and elapsed(now,lastAction[action])<120 then return result(false,'Please wait before repeating that action.') end
    lastAction[action]=now
    if action=='engine' then
        if settings.RequireKeysForEngine and not keys(vehicle) then return result(false,'Vehicle keys are required.') end
        local wanted=desired(data,GetIsVehicleEngineRunning(vehicle))
        if type(settings.EngineProvider)=='function' then
            local ok,handled=pcall(settings.EngineProvider,vehicle,wanted)
            if not ok or handled~=true then return result(false,'The engine provider refused the action.') end
        else SetVehicleEngineOn(vehicle,wanted,false,true) end
        if not wanted then
            if active.cruiseOwner~='external' then active.cruise=false; active.cruiseOwner=nil end
            active.limiter=false; stopBoost(); releaseSpeedCap()
        end
        return result(true,wanted and 'Engine started.' or 'Engine stopped.')
    elseif action=='lock' then
        local locked=GetVehicleDoorLockStatus(vehicle)
        local wanted=desired(data,locked==2 or locked==4)
        if type(settings.LockProvider)=='function' then
            local ok,handled=pcall(settings.LockProvider,vehicle,wanted)
            return result(ok and handled==true,ok and handled==true and 'Lock provider handled the action.' or 'The lock provider refused the action.')
        end
        if not keys(vehicle) then return result(false,'Vehicle keys are required.') end
        if wanted==(locked==2 or locked==4) then return result(true,wanted and 'Vehicle is already locked.' or 'Vehicle is already unlocked.') end
        if type(settings.LockCommand)~='string' or not settings.LockCommand:match('^[%w_-]+$') then
            return result(false,'Configure a vehicle lock provider.')
        end
        ExecuteCommand(settings.LockCommand)
        return result(true,'Lock request sent to the vehicle keys resource.')
    elseif action=='lights' then
        local _,on,high=GetVehicleLightsState(vehicle)
        local wanted=desired(data,on==true or on==1 or high==true or high==1)
        SetVehicleLights(vehicle,wanted and 2 or 1)
        return result(true,wanted and 'Lights on.' or 'Lights off.')
    elseif action=='window' or action=='door' then
        local index=data.index or (action=='window' and 0 or 5)
        local maximum=action=='window' and 3 or 5
        if not finite(index) or index%1~=0 or index<0 or index>maximum then return result(false,'Invalid '..action..' index.') end
        if action=='window' then
            if not IsVehicleWindowIntact(vehicle,index) then return result(false,'That window is broken or unavailable.') end
            active.windows=active.windows or {}
            local wanted=desired(data,active.windows[index]==true)
            if wanted then RollDownWindow(vehicle,index) else RollUpWindow(vehicle,index) end
            active.windows[index]=wanted
            return result(true,wanted and 'Window opened.' or 'Window closed.')
        end
        if not GetIsDoorValid(vehicle,index) or IsVehicleDoorDamaged(vehicle,index) then return result(false,'That door is unavailable.') end
        local wanted=desired(data,GetVehicleDoorAngleRatio(vehicle,index)>0.1)
        if wanted then SetVehicleDoorOpen(vehicle,index,false,false) else SetVehicleDoorShut(vehicle,index,false) end
        return result(true,wanted and 'Door opened.' or 'Door closed.')
    elseif action=='signalLeft' or action=='signalRight' or action=='hazards' then
        local wanted=action=='signalLeft' and 'left' or action=='signalRight' and 'right' or 'hazards'
        local enabled=desired(data,currentSignals(vehicle)==wanted)
        signal(enabled and wanted or 'off')
        return result(true,enabled and 'Signals enabled.' or 'Signals off.')
    elseif action=='cruise' or action=='limiter' then
        local options=action=='cruise' and settings.Cruise or settings.Limiter
        if not options.Enabled then return result(false,'This speed control is disabled.') end
        local enable=desired(data,active[action])
        if action=='cruise' and cruiseExternal then
            if active.cruise then
                return result(enable,enable and 'Cruise control is already active.' or 'Tekan rem untuk menonaktifkan cruise control.')
            end
            if not enable then return result(true,'Cruise control is already disabled.') end
            if data.speed~=nil then return result(false,'Cruise control follows the current vehicle speed.') end
            if active.boosting or active.manual then return result(false,'Disable nitro/manual control before cruise.') end
            if type(options.Command)~='string' or not options.Command:match('^[%w_-]+$') then
                return result(false,'The cruise control command is not configured.')
            end
            if not GetIsVehicleEngineRunning(vehicle) or not IsVehicleOnAllWheels(vehicle)
                or GetEntitySpeed(vehicle)<=0 or GetVehicleCurrentGear(vehicle)<=0 then
                return result(false,'Drive forward before enabling cruise control.')
            end
            active.limiter=false
            releaseSpeedCap()
            ExecuteCommand(options.Command)
            return result(true,'Cruise control request sent. Press the brake to cancel.')
        end
        if action=='limiter' and enable and active.cruiseOwner=='external' and active.cruise then
            return result(false,'Tekan rem untuk mematikan cruise control sebelum memakai pembatas kecepatan.')
        end
        if not enable then active[action]=false; if action=='cruise' then active.cruiseOwner=nil end; releaseSpeedCap(action); return result(true,'Speed control disabled.') end
        if active.boosting or active.manual and action=='cruise' then return result(false,'Disable nitro/manual control before cruise.') end
        local speed=GetEntitySpeed(vehicle)
        if data.speed~=nil then
            if not finite(data.speed) or data.speed<=0 or data.speed>500 then return result(false,'Invalid speed.') end
            speed=data.speed/(displayUnit()=='KMH' and 3.6 or 2.236936)
        end
        if speed<options.MinimumSpeed or speed>options.MaximumSpeed then return result(false,'Speed is outside the configured range.') end
        if not GetIsVehicleEngineRunning(vehicle) or not IsVehicleOnAllWheels(vehicle) then
            return result(false,'Speed control requires a running vehicle on the ground.')
        end
        active[action]=true
        if action=='cruise' then active.cruiseSpeed=speed; active.limiter=false; active.cruiseOwner='internal'
        else active.limitSpeed=speed; active.cruise=false; active.cruiseOwner=nil end
        active.speedCap=action
        SetVehicleMaxSpeed(vehicle,speed)
        return result(true,action=='cruise' and 'Cruise control enabled; brake to cancel.' or 'Speed limiter enabled.')
    elseif action=='manual' then
        if not settings.Manual.Enabled then return result(false,'Manual transmission requires enabling it in vehicle_config.lua.') end
        if type(SetVehicleCurrentGear)~='function' or type(SetVehicleNextGear)~='function'
            or type(GetVehicleHighGear)~='function' then return result(false,'Manual transmission requires current FiveM gear natives.') end
        local wanted=desired(data,active.manual)
        if wanted and active.cruise and active.cruiseOwner=='external' then
            return result(false,'Tekan rem untuk mematikan cruise control sebelum memakai transmisi manual.')
        end
        if wanted then
            if not active.highGear then active.highGear=GetVehicleHighGear(vehicle) end
            active.gear=math.max(1,GetVehicleCurrentGear(vehicle))
            active.cruise=false; active.cruiseOwner=nil; releaseSpeedCap()
        elseif active.highGear then SetVehicleHighGear(vehicle,active.highGear) end
        active.manual=wanted
        return result(true,wanted and 'Manual transmission enabled.' or 'Automatic transmission enabled.')
    elseif action=='gearUp' or action=='gearDown' then
        if not active.manual then return result(false,'Enable manual transmission first.') end
        local nextGear=clamp(active.gear+(action=='gearUp' and 1 or -1),-1,math.max(1,active.highGear or 6))
        if nextGear<=0 and GetEntitySpeed(vehicle)>2.0 then return result(false,'Stop before selecting neutral or reverse.') end
        active.gear=nextGear
        return result(true,nextGear==-1 and 'Reverse selected.' or nextGear==0 and 'Neutral selected.' or 'Gear '..nextGear..'.')
    elseif action=='mode' then return mode(data.mode)
    elseif action=='nitro' then return nitro(data)
    elseif action=='seatbelt' then
        if Config.Seatbelt.ExcludedClasses[GetVehicleClass(vehicle)] then return result(false,'This vehicle has no seatbelt.') end
        local wanted=desired(data,state.seatbelt==true)
        if not Config.Seatbelt.Enabled then
            if type(settings.SeatbeltProvider)=='function' then
                local ok,handled=pcall(settings.SeatbeltProvider,vehicle,wanted)
                return result(ok and handled==true,ok and handled==true and 'Seatbelt provider handled the action.' or 'The seatbelt provider refused the action.')
            end
            local owner=Config.Seatbelt.SourceResource
            if type(owner)~='string' or GetResourceState(owner)~='started'
                or type(settings.SeatbeltCommand)~='string' or not settings.SeatbeltCommand:match('^[%w_-]+$') then
                return result(false,'Configure the external seatbelt control provider or use its keybind.')
            end
            local ok,harness=pcall(function() return exports[owner]:HasHarness() end)
            if not wanted and ok and harness==true then return result(false,'Remove the harness using its item before unbuckling.') end
            if wanted==(state.seatbelt==true) then return result(true,wanted and 'Seatbelt is already fastened.' or 'Seatbelt is already released.') end
            ExecuteCommand(settings.SeatbeltCommand)
            return result(true,'Seatbelt request sent to its owner resource.')
        end
        TriggerEvent('velox-hud:client:setSeatbelt',wanted)
        return result(true,wanted and 'Seatbelt fastened.' or 'Seatbelt released.')
    end
    return result(false,'Unknown vehicle action.')
end

AddEventHandler('seatbelt:client:ToggleCruise',function(enabled)
    if type(enabled)~='boolean' or not syncCruiseOwner() then return end
    local invoking=type(GetInvokingResource)=='function' and GetInvokingResource() or nil
    if invoking and invoking~=settings.Cruise.Resource then return end
    if not enabled then
        externalCruiseState=nil
        if active.cruiseOwner=='external' then active.cruise=false; active.cruiseOwner=nil end
        return
    end
    local allowed,state=context(true)
    if not allowed or not road(state.vehicle) then return end
    ownVehicle(state.vehicle)
    releaseSpeedCap()
    active.limiter=false
    if active.manual and active.highGear then SetVehicleHighGear(active.vehicle,active.highGear) end
    active.manual=false
    stopBoost()
    active.cruise=true
    active.cruiseOwner='external'
    externalCruiseState={vehicle=active.vehicle,model=active.model,network=active.network}
end)

VeloxHud.VehicleAction=vehicleAction

VeloxHud.VehicleWindowOpen=function(vehicle)
    if vehicle~=active.vehicle or type(active.windows)~='table' then return nil end
    for _,open in pairs(active.windows) do if open then return true end end
    return false
end
RegisterNUICallback('vehicle:action',function(data,cb)
    local ok,reply=pcall(vehicleAction,data)
    cb(ok and reply or result(false,'Vehicle action failed.'))
end)
AddEventHandler('velox-hud:client:vehicleAction',function(data,cb)
    local ok,reply=pcall(vehicleAction,data)
    reply=ok and reply or result(false,'Vehicle action failed.')
    if type(cb)=='function' then cb(reply) else notify(reply.message,reply.ok) end
end)
for action,command in pairs(settings.Commands) do
    if type(command.name)=='string' and command.name:match('^[%w_-]+$') then
        RegisterCommand(command.name,function() local reply=vehicleAction({action=action}); notify(reply.message,reply.ok) end,false)
        if type(command.key)=='string' and command.key~='' then
            RegisterKeyMapping(command.name,'VCORE: '..action,'keyboard',command.key)
        end
    end
end
if Config.Nitro.Enabled and type(Config.Nitro.Command)=='string' and Config.Nitro.Command:match('^[%w_-]+$') then
    RegisterCommand('+'..Config.Nitro.Command,function() local reply=vehicleAction({action='nitro',value=true}); if not reply.ok then notify(reply.message,false) end end,false)
    RegisterCommand('-'..Config.Nitro.Command,function()
        stopBoost()
        if pendingNitro then pendingNitro.wantBoost=false end
    end,false)
    if type(Config.Nitro.Key)=='string' and Config.Nitro.Key~='' then
        RegisterKeyMapping('+'..Config.Nitro.Command,'VCORE: hold nitro','keyboard',Config.Nitro.Key)
    end
end
RegisterNetEvent('velox-hud:client:nitroReply',function(id,netId,duration,message)
    if source~=65535 then return end
    local pending=pendingNitro
    if not pending or pending.id~=id then return end
    pendingNitro=nil
    if not finite(duration) or duration<=0 or duration>30000 then notify(type(message)=='string' and message:sub(1,160) or 'Nitro refused.',false); return end
    local ok,state=context(true)
    if not ok or state.vehicle~=pending.vehicle or not DoesEntityExist(state.vehicle)
        or NetworkGetNetworkIdFromEntity(state.vehicle)~=netId then return end
    ownVehicle(state.vehicle)
    active.nitroStart,active.nitroDuration,active.nitroVehicle=GetGameTimer(),duration,state.vehicle
    active.boosting=pending.wantBoost==true
    notify('Nitro canister consumed; boost authorized.',true)
end)
RegisterNetEvent('velox-hud:client:nitroReset',function()
    if source~=65535 then return end
    stopBoost(); pendingNitro=nil; active.nitroDuration=0
end)

local function driftSample(now)
    local options=settings.Drift
    if not options.Enabled then return end
    local delta=clamp(elapsed(now,active.lastSample)/1000,0,0.25)
    active.lastSample=now
    local velocity=GetEntitySpeedVector(active.vehicle,true)
    local speed=GetEntitySpeed(active.vehicle)
    local angle=math.deg(math.atan(math.abs(velocity.x),math.abs(velocity.y)))
    local drifting=velocity.y>0 and speed>=options.MinimumSpeed and angle>=options.MinimumAngle
        and angle<=options.MaximumAngle and IsVehicleOnAllWheels(active.vehicle)
        and not HasEntityCollidedWithAnything(active.vehicle)
    if drifting then
        active.lastDrift=now
        active.driftTime=active.driftTime+delta
        active.driftCombo=clamp(1+math.floor(active.driftTime/2),1,10)
        active.driftScore=math.min(99999999,active.driftScore+delta*options.PointsPerSecond*(angle/20)*active.driftCombo)
    elseif elapsed(now,active.lastDrift)>options.ComboDelay then
        active.driftTime=0; active.driftCombo=1
    end
end
local function boostParticles()
    if #active.particles>0 then return end
    RequestNamedPtfxAsset(Config.Nitro.ParticleAsset)
    if not HasNamedPtfxAssetLoaded(Config.Nitro.ParticleAsset) then return end
    for i=1,16 do
        local name=i==1 and 'exhaust' or 'exhaust_'..i
        local bone=GetEntityBoneIndexByName(active.vehicle,name)
        if bone~=-1 then
            UseParticleFxAssetNextCall(Config.Nitro.ParticleAsset)
            local spawn=Config.Nitro.NetworkedParticles and type(StartNetworkedParticleFxLoopedOnEntityBone)=='function'
                and StartNetworkedParticleFxLoopedOnEntityBone or StartParticleFxLoopedOnEntityBone
            local handle=spawn(Config.Nitro.ParticleName,active.vehicle,
                0.0,0.0,0.0,0.0,0.0,0.0,bone,Config.Nitro.ParticleScale,false,false,false)
            if handle and handle~=0 then table.insert(active.particles,handle) end
        end
    end
end
local function processVehicle(now,state)
    syncCruiseOwner()
    if pendingNitro and elapsed(now,pendingNitro.time)>5000 then pendingNitro=nil; notify('Nitro authorization timed out.',false) end
    if not GetIsVehicleEngineRunning(active.vehicle) or not IsVehicleOnAllWheels(active.vehicle) then
        if active.cruiseOwner~='external' then active.cruise=false; active.cruiseOwner=nil end
        stopBoost()
    end
    if active.cruise and active.cruiseOwner=='internal' and ((type(IsNuiFocused)=='function' and IsNuiFocused())
        or IsControlPressed(0,72) or IsControlPressed(0,76)
        or HasEntityCollidedWithAnything(active.vehicle) or GetEntitySpeedVector(active.vehicle,true).y<0
        or GetEntitySpeed(active.vehicle)<settings.Cruise.MinimumSpeed*0.5) then
        active.cruise=false
        active.cruiseOwner=nil
    end
    if active.cruise and active.cruiseOwner=='internal' then
        local difference=active.cruiseSpeed-GetEntitySpeed(active.vehicle)
        if difference>0 then SetControlNormal(0,71,clamp(difference*0.35+0.15,0,1)) end
    end
    if (active.cruise and active.cruiseOwner=='internal') or active.limiter then
        active.speedCap=active.limiter and 'limiter' or 'cruise'
        SetVehicleMaxSpeed(active.vehicle,active.limiter and active.limitSpeed or active.cruiseSpeed)
    else releaseSpeedCap() end
    if active.manual then
        if active.gear>0 then
            SetVehicleHighGear(active.vehicle,active.gear)
            SetVehicleCurrentGear(active.vehicle,active.gear)
            SetVehicleNextGear(active.vehicle,active.gear)
        else
            local throttle=GetControlNormal(0,71)
            DisableControlAction(0,71,true)
            SetVehicleHighGear(active.vehicle,active.highGear)
            SetVehicleCurrentGear(active.vehicle,0)
            SetVehicleNextGear(active.vehicle,0)
            if active.gear==-1 and throttle>0 then SetControlNormal(0,72,throttle) end
        end
    end
    if active.boosting then
        if nitroRemaining()<=0 or active.nitroVehicle~=active.vehicle or GetEntitySpeed(active.vehicle)<Config.Nitro.MinimumSpeed
            or IsControlPressed(0,72) or IsControlPressed(0,76) then stopBoost()
        else
            SetVehicleBoostActive(active.vehicle,true)
            SetVehicleCheatPowerIncrease(active.vehicle,clamp(Config.Nitro.TorqueMultiplier,1.0,1.8))
            boostParticles()
        end
    end
    driftSample(now)
end
local function ejectionSample(now,state)
    local options=Config.Seatbelt.Ejection
    local vehicle=state.vehicle
    if not Config.Seatbelt.Enabled or not options.Enabled or vehicle==0
        or Config.Seatbelt.ExcludedClasses[GetVehicleClass(vehicle)] then restoreEjection(); return end
    if eject.ped~=state.ped or eject.vehicle~=vehicle then
        restoreEjection()
        eject.ped,eject.vehicle=state.ped,vehicle
        eject.flag=GetPedConfigFlag(state.ped,32,true)
        eject.speed,eject.body,eject.sample=GetEntitySpeed(vehicle),GetVehicleBodyHealth(vehicle),now
        eject.forward=GetEntitySpeedVector(vehicle,true).y
        eject.velocity=GetEntityVelocity(vehicle)
    end
    SetPedConfigFlag(state.ped,32,false)
    if elapsed(now,eject.sample)<options.SampleInterval then return end
    local speed,body=GetEntitySpeed(vehicle),GetVehicleBodyHealth(vehicle)
    local throw=not state.seatbelt and eject.speed>=options.MinimumSpeed
        and speed<eject.speed*(1-options.Deceleration) and eject.body-body>=options.MinimumBodyDamage
        and HasEntityCollidedWithAnything(vehicle) and (eject.forward or 0)>0.1
    local oldVelocity=eject.velocity
    eject.sample,eject.speed,eject.body=now,speed,body
    eject.forward=GetEntitySpeedVector(vehicle,true).y
    eject.velocity=GetEntityVelocity(vehicle)
    if throw then
        local velocity=oldVelocity or GetEntityVelocity(vehicle)
        local point=GetOffsetFromEntityInWorldCoords(vehicle,0.0,2.0,1.0)
        SetEntityCoords(state.ped,point.x,point.y,point.z,false,false,false,false)
        SetEntityVelocity(state.ped,velocity.x,velocity.y,velocity.z+2.0)
        SetPedToRagdoll(state.ped,options.RagdollDuration,options.RagdollDuration,0,false,false,false)
        restoreEjection()
    end
end
VeloxHud.VehicleTelemetry=function(vehicle,state)
    state=type(state)=='table' and state or {ped=PlayerPedId()}
    local isDriver=vehicle~=0 and DoesEntityExist(vehicle) and GetPedInVehicleSeat(vehicle,-1)==state.ped
    local height,vertical,roll,pitch=0,0,0,0
    if vehicle~=0 and DoesEntityExist(vehicle) then
        height=GetEntityHeightAboveGround(vehicle)
        vertical=GetEntityVelocity(vehicle).z
        local rotation=GetEntityRotation(vehicle,2)
        roll,pitch=rotation.y,rotation.x
    end
    return {engineOn=vehicle~=0 and GetIsVehicleEngineRunning(vehicle) or false,
        cruise=isDriver and active.vehicle==vehicle and active.cruise,
        limiter=isDriver and active.vehicle==vehicle and active.limiter,
        manual=isDriver and active.vehicle==vehicle and active.manual,
        driveMode=active.vehicle==vehicle and active.driveMode or 'normal',
        signals=vehicle~=0 and currentSignals(vehicle) or 'off',
        nitro=active.vehicle==vehicle and active.nitroDuration>0 and nitroRemaining()/active.nitroDuration*100 or 0,
        boosting=isDriver and active.vehicle==vehicle and active.boosting,
        driftScore=active.vehicle==vehicle and math.floor(active.driftScore) or 0,
        driftCombo=active.vehicle==vehicle and active.driftCombo or 1,
        altitude=height,verticalSpeed=vertical,roll=roll,pitch=pitch,
        gear=isDriver and active.vehicle==vehicle and active.manual and (active.gear==-1 and 'R' or active.gear==0 and 'N' or tostring(active.gear)) or nil}
end
CreateThread(function()
    while true do
        local allowed,state=context(false)
        if not allowed or state.vehicle==0 or not DoesEntityExist(state.vehicle) then reset(); Wait(250)
        else
            local now=GetGameTimer()
            if settings.Enabled and GetPedInVehicleSeat(state.vehicle,-1)==state.ped then
                ownVehicle(state.vehicle)
                if road(active.vehicle) then processVehicle(now,state) end
            elseif active.vehicle~=0 then reset() end

            ejectionSample(now,state)
            local continuous=active.manual or (active.cruise and active.cruiseOwner=='internal') or active.boosting
            local onRoad=road(state.vehicle)
            Wait(continuous and 0 or onRoad and 100 or 250)
        end
    end
end)
RegisterNetEvent('QBCore:Client:OnPlayerUnload',function()
    externalCruiseState=nil
    reset()
end)
AddEventHandler('onClientResourceStart',function(resource)
    if resource==settings.Cruise.Resource then syncCruiseOwner(true) end
end)
AddEventHandler('onClientResourceStop',function(resource)
    if resource==settings.Cruise.Resource then syncCruiseOwner(false) end
end)
AddEventHandler('onResourceStop',function(resource)
    if resource==settings.Cruise.Resource then syncCruiseOwner(false) end
    if resource==GetCurrentResourceName() or resource==Config.CoreResource then externalCruiseState=nil; reset() end
    if resource==Config.Nitro.InventoryResource or resource==Config.Nitro.KeyResource then stopBoost(); active.nitroDuration=0; pendingNitro=nil end
end)
