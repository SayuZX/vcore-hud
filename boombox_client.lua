VeloxHud = VeloxHud or {}

local cfg = Config.Music
local attachments = {}
local current
local lastStatus
local model = GetHashKey(cfg.BoomboxModel or 'prop_boombox_01')
local maximumAttachments = 64

local function finite(value)
    return type(value)=='number' and value==value and math.abs(value)~=math.huge
end

local function integer(value)
    return finite(value) and value%1==0 and value>0 and value<=2147483647
end

local function enabled()
    return cfg.Enabled==true and cfg.Adapter=='cs-boombox'
end

local function resource()
    return cfg.BoomboxResource or cfg.Resource or 'cs-boombox'
end

local function elapsed(now, before)
    return (now-before)%4294967296
end

local function report(state, message, errorCode, time, duration)
    if not current then return end
    local data = {
        adapter='cs-boombox',state=state,message=message or '',errorCode=errorCode,
        vehicleNetId=current.vehicleNetId,videoId=current.videoId,
        boomboxNetId=current.boomboxNetId,boomboxGeneration=current.generation,
        time=time,duration=duration
    }
    local signature = state..'|'..tostring(errorCode)..'|'..tostring(time and math.floor(time))
    if signature~=lastStatus then
        lastStatus=signature
        SendNUIMessage({action='hud:musicStatus',data=data})
    end
end

local function receiveAttachment(data)
    if not enabled() or type(data)~='table' or not integer(data.vehicleNetId)
        or not integer(data.boomboxNetId) or not integer(data.generation) then return false end
    local prior=attachments[data.boomboxNetId]
    if prior and prior.generation>data.generation then return false end
    if prior and prior.generation==data.generation and prior.vehicleNetId==data.vehicleNetId then return true end
    if not prior then
        local count,oldestId,oldest=0,nil,-1
        for id,item in pairs(attachments) do
            count=count+1
            local age=elapsed(GetGameTimer(),item.receivedAt)
            if age>oldest then oldestId,oldest=id,age end
        end
        if count>=maximumAttachments and oldestId then attachments[oldestId]=nil end
    end
    attachments[data.boomboxNetId]={
        boomboxNetId=data.boomboxNetId,vehicleNetId=data.vehicleNetId,
        generation=data.generation,receivedAt=GetGameTimer()
    }
    return true
end

local function entityFromNet(id)
    if not NetworkDoesEntityExistWithNetworkId(id) then return nil end
    local entity=NetworkGetEntityFromNetworkId(id)
    return entity~=0 and DoesEntityExist(entity) and entity or nil
end

local function attach(item)
    local object,vehicle=entityFromNet(item.boomboxNetId),entityFromNet(item.vehicleNetId)
    if not object or not vehicle then return end
    if GetEntityType(object)~=3 or GetEntityModel(object)~=model or GetEntityType(vehicle)~=2 then
        attachments[item.boomboxNetId]=nil
        return
    end
    local ok,tag=pcall(function() return Entity(object).state.vcoreBoombox end)
    if not ok or type(tag)~='table' then return end
    if tag.vehicleNetId~=item.vehicleNetId or tag.generation~=item.generation then
        attachments[item.boomboxNetId]=nil
        return
    end
    SetEntityVisible(object,false,false)
    SetEntityCollision(object,false,false)
    if IsEntityAttachedToEntity(object,vehicle) then return end
    if not NetworkHasControlOfEntity(object) then
        local ped=PlayerPedId()
        local driver=GetVehiclePedIsIn(ped,false)==vehicle and GetPedInVehicleSeat(vehicle,-1)==ped
        if driver then
            local now=GetGameTimer()
            if not item.controlStarted then item.controlStarted=now end
            if elapsed(now,item.controlStarted)<5000 and (not item.requestedAt or elapsed(now,item.requestedAt)>=1000) then
                item.requestedAt=now
                NetworkRequestControlOfEntity(object)
            end
        else
            item.controlStarted=nil
            item.requestedAt=nil
        end
        return
    end
    FreezeEntityPosition(object,false)
    AttachEntityToEntity(object,vehicle,0,0.0,0.0,0.0,0.0,0.0,0.0,false,false,false,false,2,true)
end

local function cleanup()
    if current then report('idle') end
    current=nil
    lastStatus=nil
end

local function sync(data)
    if not enabled() or type(data)~='table' or data.adapter~='cs-boombox'
        or not integer(data.vehicleNetId) or not integer(data.boomboxNetId)
        or not integer(data.boomboxGeneration) or type(data.videoId)~='string'
        or #data.videoId<1 or #data.videoId>80 or type(data.url)~='string'
        or #data.url>512 or type(data.playing)~='boolean' then
        cleanup()
        return
    end
    local changed=not current or current.vehicleNetId~=data.vehicleNetId
        or current.boomboxNetId~=data.boomboxNetId or current.generation~=data.boomboxGeneration
        or current.videoId~=data.videoId or current.url~=data.url
    local resumed=current and not current.playing and data.playing
    current={
        vehicleNetId=data.vehicleNetId,boomboxNetId=data.boomboxNetId,
        generation=data.boomboxGeneration,videoId=data.videoId,url=data.url,
        playing=data.playing,receivedAt=(changed or resumed) and GetGameTimer() or current.receivedAt,
        lastPlayback=not changed and not resumed and current.lastPlayback or nil,
        failed=not changed and not resumed and current.failed or false
    }
    receiveAttachment({vehicleNetId=current.vehicleNetId,boomboxNetId=current.boomboxNetId,generation=current.generation})
    if changed then lastStatus=nil end
    if GetResourceState(resource())~='started' then
        report('error','Pemutar musik server belum aktif.','CS_UNAVAILABLE')
    elseif not current.playing and not current.failed then
        report('paused')
    elseif changed or resumed then
        report('loading','Menyiapkan audio kendaraan…')
    end
end

local errorMessages={
    E_YOUTUBE_ERROR='YouTube tidak dapat memutar video ini. Coba tautan video lain.',
    E_SOURCE_NOT_FOUND='Audio video tidak ditemukan. Coba tautan video lain.',
    E_SOURCE_ERROR='Audio tidak dapat dimuat. Coba lagi.',
    E_TWITCH_CHANNEL_OFFLINE='Siaran sedang tidak aktif.',
    E_TWITCH_VOD_SUB_ONLY='Video ini memerlukan langganan.',
    E_TWITCH_PLAYBACK_BLOCKED='Video ini tidak mengizinkan pemutaran di dalam game.'
}

local function playback(data)
    if not enabled() or not current or GetResourceState(resource())~='started'
        or type(GetInvokingResource)~='function' or GetInvokingResource()~=resource()
        or type(data)~='table' or tostring(data.uniqueId)~=tostring(current.boomboxNetId)
        or data.generation~=current.generation then return end
    local sourceId=data.videoId or data.source
    if sourceId~=current.videoId and sourceId~=current.url then return end
    if data.error~=nil then
        if type(data.error)~='string' or #data.error>80 then return end
        local code=finite(data.errorCode) and data.errorCode or data.error
        current.failed=true
        report('error',errorMessages[data.error] or 'Musik tidak dapat diputar. Coba lagi.',code)
        return
    end
    if data.state=='ended' then
        current.failed=true
        report('ended')
        return
    end
    if type(data.playing)~='boolean' or not finite(data.time) or data.time<0
        or data.time>cfg.MaximumPosition then return end
    local duration=finite(data.duration) and data.duration>=0 and data.duration<=cfg.MaximumPosition and data.duration or nil
    if data.playing then current.lastPlayback=GetGameTimer(); current.failed=false end
    if current.failed then return end
    report(data.playing and 'playing' or current.playing and 'buffering' or 'paused','',nil,data.time,duration)
end

local function tick()
    if not enabled() then cleanup(); attachments={}; return end
    for id,item in pairs(attachments) do
        if elapsed(GetGameTimer(),item.receivedAt)>60000 and not entityFromNet(id) then
            attachments[id]=nil
        else
            attach(item)
        end
    end
    if not current then return end
    local ped=PlayerPedId()
    local vehicle=GetVehiclePedIsIn(ped,false)
    if IsEntityDead(ped) or vehicle==0 or not NetworkGetEntityIsNetworked(vehicle)
        or NetworkGetNetworkIdFromEntity(vehicle)~=current.vehicleNetId then cleanup(); return end
    if current.playing and not current.failed and elapsed(GetGameTimer(),current.lastPlayback or current.receivedAt)>30000 then
        current.failed=true
        report('error','Pemutar musik terlalu lama merespons. Coba lagi.','CS_TIMEOUT')
    end
end

RegisterNetEvent('velox-hud:client:boomboxAttach',function(data)
    if source==65535 then receiveAttachment(data) end
end)
RegisterNetEvent('velox-hud:client:boomboxDetach',function(data)
    if source~=65535 or type(data)~='table' or not integer(data.boomboxNetId) then return end
    local item=attachments[data.boomboxNetId]
    if item and item.generation==data.generation and item.vehicleNetId==data.vehicleNetId then
        attachments[data.boomboxNetId]=nil
        if current and current.boomboxNetId==data.boomboxNetId and current.generation==data.generation then cleanup() end
    end
end)

if type(AddStateBagChangeHandler)=='function' then
    AddStateBagChangeHandler('vcoreBoombox',nil,function(bagName,_,value)
        if type(bagName)~='string' then return end
        local id=tonumber(bagName:match('^entity:(%d+)$'))
        if not integer(id) then return end
        if type(value)~='table' then attachments[id]=nil; return end
        receiveAttachment({vehicleNetId=value.vehicleNetId,boomboxNetId=id,generation=value.generation})
    end)
end

AddEventHandler('cs-boombox:vcorePlayback',playback)
RegisterNetEvent('QBCore:Client:OnPlayerUnload',cleanup)
AddEventHandler('onClientResourceStop',function(name)
    if name==resource() then
        if current then report('error','Pemutar musik server berhenti.','CS_UNAVAILABLE') end
        current=nil
        attachments={}
    elseif name==GetCurrentResourceName() or name==Config.CoreResource then
        cleanup()
        attachments={}
    end
end)
AddEventHandler('onResourceStop',function(name)
    if name==GetCurrentResourceName() then cleanup(); attachments={} end
end)

VeloxHud.BoomboxSync=sync
VeloxHud.BoomboxCleanup=cleanup

CreateThread(function()
    while true do
        tick()
        Wait(500)
    end
end)
