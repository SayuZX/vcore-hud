VeloxHud = VeloxHud or {}
local cfg = Config.Music
local music, soundId, soundTrack, currentNet = nil, nil, nil, 0
local requestSequence, pending, lastRequest, lastVoice = 0, {}, nil, nil
local receivedAt, lastSync, lastUi = 0, nil, nil
local audioFailed = false
local speechPending, speechSequence, lastSpeech = nil, 0, nil
local ambient, clearAmbient, updateAmbient, receiveAmbient = {}, nil, nil, nil
local musicRequest
local ownEnded
local lastWindow = {vehicle=0,value=nil,at=nil}

local function finite(value) return type(value) == 'number' and value == value and math.abs(value) ~= math.huge end
local function clamp(value, low, high) return math.max(low, math.min(high, value)) end
local function elapsed(now, before) return before == nil and math.huge or (now-before) % 4294967296 end
local function result(ok, message) return { ok=ok, message=message } end
local function context(driverOnly)
    if type(VeloxHud.CanInteract) ~= 'function' then return nil end
    local ready, ctx = VeloxHud.CanInteract(driverOnly)
    return ready and ctx or nil
end
local function vehicleNet(ctx)
    if not ctx or ctx.vehicle == 0 or not DoesEntityExist(ctx.vehicle) or not NetworkGetEntityIsNetworked(ctx.vehicle) then return 0 end
    return NetworkGetNetworkIdFromEntity(ctx.vehicle)
end
local function boomboxResource() return cfg.BoomboxResource or cfg.Resource or 'cs-boombox' end
local function adapter()
    if cfg.Adapter=='cs-boombox' then return 'cs-boombox' end
    if not audioFailed and cfg.Adapter ~= 'nui' and GetResourceState(cfg.Resource) == 'started' then return 'xsound' end
    return 'nui'
end
local function audioCall(method, ...)
    if GetResourceState(cfg.Resource) ~= 'started' then return false end
    local args = { ... }
    return pcall(function() local api = exports[cfg.Resource]; return api[method](api, table.unpack(args)) end)
end
local function destroyAudio()
    local previous=soundId
    soundId, soundTrack = nil, nil
    ownEnded=nil
    if previous then audioCall('Destroy', previous) end
end
local function currentPosition()
    if not music then return 0 end
    return clamp(music.position + (music.playing and elapsed(GetGameTimer(), receivedAt)/1000.0 or 0), 0, cfg.MaximumPosition)
end
local function publish()
    if music then
        local data = {}
        for key, value in pairs(music) do data[key] = value end
        data.position, data.adapter = currentPosition(), adapter()
        data.canControl = context(true) ~= nil
        SendNUIMessage({ action='hud:music', data=data })
        if type(VeloxHud.BoomboxSync)=='function' then VeloxHud.BoomboxSync(data) end
    else
        SendNUIMessage({ action='hud:music', data={videoId='',url='',title='',source='youtube',playing=false,
            position=0,volume=cfg.DefaultVolume,playlist={},liked=false,adapter=adapter(),vehicleNetId=0,revision=0,
            canControl=context(true)~=nil} })
    end
end
local function cleanup(full)
    if type(VeloxHud.BoomboxCleanup)=='function' then VeloxHud.BoomboxCleanup() end
    destroyAudio()
    if full~=false then clearAmbient() end
    lastWindow={vehicle=0,value=nil,at=nil}
    music, currentNet, lastSync, lastUi = nil, 0, nil, nil
    for id, item in pairs(pending) do pending[id] = nil; item.cb(result(false, 'Player or vehicle context changed.')) end
    if speechPending then
        local item = speechPending; speechPending = nil
        item.cb(result(false, 'Player context changed during speech recognition.'))
    end
    publish()
end
local function dampening(vehicle, remoteWindow)
    if type(cfg.OcclusionProvider) == 'function' then
        local ok, value = pcall(cfg.OcclusionProvider, vehicle)
        if ok and finite(value) then return clamp(value, 0, 1) end
    end
    if cfg.SyncWindowState and remoteWindow==true then return 1.0 end
    if type(VeloxHud.VehicleWindowOpen) == 'function' and VeloxHud.VehicleWindowOpen(vehicle) == true then return 1.0 end
    for index=0,3 do if not IsVehicleWindowIntact(vehicle, index) then return 1.0 end end
    return clamp(cfg.ClosedWindowVolume, 0, 1)
end

clearAmbient = function(netId)
    if netId then
        local item=ambient[netId]
        ambient[netId]=nil
        if item and item.id then audioCall('Destroy',item.id) end
    else
        for id in pairs(ambient) do clearAmbient(id) end
    end
end
local function ambientPosition(item)
    return clamp(item.state.position+(item.state.playing and elapsed(GetGameTimer(),item.at)/1000.0 or 0),0,cfg.MaximumPosition)
end
local function ambientVehicle(netId,ctx)
    if not ctx or type(NetworkDoesEntityExistWithNetworkId)~='function' or not NetworkDoesEntityExistWithNetworkId(netId) then return nil end
    local vehicle=NetToVeh(netId)
    if vehicle==0 or not DoesEntityExist(vehicle) or GetEntityType(vehicle)~=2 or ctx.vehicle==vehicle then return nil end
    local source,target=GetEntityCoords(ctx.ped),GetEntityCoords(vehicle)
    local distance=(source.x-target.x)^2+(source.y-target.y)^2+(source.z-target.z)^2
    local radius=clamp(cfg.Distance,1,100)+clamp(cfg.ListenerMargin,0,10)
    if distance>radius^2 then return nil end
    return vehicle,distance
end
local function startAmbient(netId,item)
    local captured=item
    item.id='velox_ambient_'..netId
    local ok=audioCall('PlayUrlPos',item.id,item.state.url,item.state.volume*dampening(item.vehicle,item.state.windowOpen),
        GetEntityCoords(item.vehicle),false,{onPlayStart=function()
            if ambient[netId]~=captured or not captured.id then return end
            audioCall('setTimeStamp',captured.id,ambientPosition(captured))
            if not captured.state.playing then audioCall('Pause',captured.id) end
        end,onPlayEnd=function()
            if ambient[netId]~=captured then return end
            captured.id,captured.ended=nil,true
        end})
    if not ok then clearAmbient(netId); audioFailed=true; return false end
    audioCall('Distance',item.id,clamp(cfg.Distance,1,100))
    return true
end
receiveAmbient = function(data)
    if not cfg.Enabled or not cfg.NearbyAudio or adapter()~='xsound' then clearAmbient(); return end
    if type(data)~='table' or not finite(data.vehicleNetId) or data.vehicleNetId%1~=0 or data.vehicleNetId<1
        or data.vehicleNetId>2147483647 or type(data.videoId)~='string' or #data.videoId>80
        or (data.source~='youtube' and data.source~='media') or type(data.title)~='string' or #data.title>80
        or type(data.url)~='string' or #data.url>512 or (data.url~='' and (not data.url:match('^https://') or data.url:find('[%z\1-\32]')))
        or type(data.playing)~='boolean' or not finite(data.position) or data.position<0 or data.position>cfg.MaximumPosition
        or not finite(data.volume) or data.volume<0 or data.volume>cfg.MaximumVolume
        or not finite(data.revision) or data.revision<0 or (data.windowOpen~=nil and type(data.windowOpen)~='boolean') then return end
    if data.source=='youtube' and data.videoId~='' and (#data.videoId~=11 or not data.videoId:match('^[%w_%-]+$')
        or data.url~='https://www.youtube.com/watch?v='..data.videoId) then return end
    if data.source=='media' then
        local allowed=cfg.AllowedMedia[data.videoId]
        if type(allowed)~='table' or allowed.url~=data.url then return end
    end
    local netId=data.vehicleNetId
    if data.videoId=='' or (not data.playing and data.position==0) then clearAmbient(netId); return end
    local ctx=context(false)
    local vehicle,distance=ambientVehicle(netId,ctx)
    if not vehicle then clearAmbient(netId); return end
    local existing=ambient[netId]
    if existing and data.revision<existing.state.revision then return end
    if existing and (existing.vehicle~=vehicle or existing.state.videoId~=data.videoId) then clearAmbient(netId); existing=nil end
    if not existing then
        local count,farthest,maximum=0,nil,-1
        for id,item in pairs(ambient) do
            count=count+1
            local _,candidateDistance=ambientVehicle(id,ctx)
            if not candidateDistance then candidateDistance=math.huge end
            if candidateDistance>maximum then maximum,farthest=candidateDistance,id end
        end
        local limit=math.floor(clamp(cfg.AmbientClientLimit,0,32))
        if limit==0 then return end
        if count>=limit then
            if distance>=maximum then return end
            clearAmbient(farthest)
        end
    end
    local previousPosition=existing and ambientPosition(existing) or 0
    local previousPlaying=existing and existing.state.playing
    local rewind=existing and data.position<previousPosition-2
    local item=existing or {vehicle=vehicle}
    item.state={videoId=data.videoId,url=data.url,playing=data.playing,position=data.position,
        volume=data.volume,revision=data.revision,windowOpen=data.windowOpen}
    item.at=GetGameTimer()
    ambient[netId]=item
    if rewind then item.ended=false end
    if not item.id and not item.ended and not startAmbient(netId,item) then return end
    if item.id then
        if not existing or math.abs(previousPosition-data.position)>2 then audioCall('setTimeStamp',item.id,data.position) end
        if previousPlaying~=data.playing then audioCall(data.playing and 'Resume' or 'Pause',item.id) end
        audioCall('Position',item.id,GetEntityCoords(vehicle))
        audioCall('setVolumeMax',item.id,data.volume*dampening(vehicle,data.windowOpen))
    end
end
updateAmbient = function()
    if not cfg.Enabled or not cfg.NearbyAudio or adapter()~='xsound' then clearAmbient(); return end
    local ctx=context(false)
    if not ctx then clearAmbient(); return end
    for netId,item in pairs(ambient) do
        local vehicle=ambientVehicle(netId,ctx)
        if not vehicle or vehicle~=item.vehicle or elapsed(GetGameTimer(),item.at)>=math.max(1000,cfg.AmbientTimeout) then clearAmbient(netId)
        elseif item.id then
            audioCall('Position',item.id,GetEntityCoords(vehicle))
            audioCall('setVolumeMax',item.id,item.state.volume*dampening(vehicle,item.state.windowOpen))
        end
    end
end
RegisterNetEvent('velox-hud:client:ambientMusic',receiveAmbient)
RegisterNetEvent('velox-hud:client:ambientStop',function(netId)
    if finite(netId) and netId%1==0 and netId>0 then clearAmbient(netId) end
end)
local function syncWindows(ctx)
    if not cfg.SyncWindowState or not ctx or GetPedInVehicleSeat(ctx.vehicle,-1)~=ctx.ped or type(VeloxHud.VehicleWindowOpen)~='function' then return end
    local open=VeloxHud.VehicleWindowOpen(ctx.vehicle)
    if type(open)~='boolean' then return end
    if lastWindow.vehicle~=ctx.vehicle then lastWindow={vehicle=ctx.vehicle,value=nil,at=nil} end
    if open~=lastWindow.value and elapsed(GetGameTimer(),lastWindow.at)>=500 then
        lastWindow.value,lastWindow.at=open,GetGameTimer()
        TriggerServerEvent('velox-hud:server:musicWindow',{vehicleNetId=vehicleNet(ctx),open=open})
    end
end
local function updateAudio(vehicle)
    clearAmbient(currentNet)
    if not music or music.videoId == '' or adapter() ~= 'xsound' or (not music.playing and music.position==0) then destroyAudio(); return end
    local track = tostring(currentNet) .. ':' .. music.videoId
    if ownEnded and ownEnded.track==track and music.position>=ownEnded.position-2 then return end
    if soundTrack ~= track then
        destroyAudio()
        soundId, soundTrack = 'velox_vehicle_' .. currentNet, track
        local capturedId, capturedTrack = soundId, track
        local ok = audioCall('PlayUrlPos', soundId, music.url, music.volume * dampening(vehicle), GetEntityCoords(vehicle), false,
            { onPlayStart = function()
                if soundId ~= capturedId or soundTrack ~= capturedTrack or not music then return end
                audioCall('setTimeStamp', capturedId, currentPosition())
                if not music.playing then audioCall('Pause', capturedId) end
            end, onPlayEnd=function()
                if soundId~=capturedId or soundTrack~=capturedTrack or not music or not music.playing then return end
                ownEnded={track=capturedTrack,position=currentPosition()}
                soundId,soundTrack=nil,nil
                local ended=ownEnded
                SetTimeout(math.max(250,cfg.RequestInterval+25),function()
                    local ctx=context(true)
                    if ownEnded==ended and music and music.playing and ctx and vehicleNet(ctx)==currentNet then
                        musicRequest({action=#music.playlist>0 and 'next' or 'stop'},nil,false)
                    end
                end)
            end })
        if not ok then destroyAudio(); audioFailed=true; return end
        audioCall('Distance', soundId, cfg.Distance)
    end
    audioCall('Position', soundId, GetEntityCoords(vehicle))
    audioCall('setVolumeMax', soundId, music.volume * dampening(vehicle))
end

musicRequest = function(data, cb, sync)
    cb = cb or function() end
    if not cfg.Enabled then cb(result(false, 'Vehicle music is disabled.')); return end
    if cfg.Adapter=='cs-boombox' and GetResourceState(boomboxResource())~='started' then
        cb(result(false,'Pemutar musik server belum aktif.')); return
    end
    if type(data) ~= 'table' or type(data.action) ~= 'string' then cb(result(false, 'Invalid music request.')); return end
    local ctx = context(not sync)
    local netId = vehicleNet(ctx)
    if netId == 0 then cb(result(false, 'Control music from the current networked vehicle driver seat.')); return end
    local now = GetGameTimer()
    if elapsed(now, lastRequest) < cfg.RequestInterval then cb(result(false, 'Music controls are being used too quickly.')); return end
    local count=0
    for _ in pairs(pending) do count=count+1 end
    if count >= 4 then cb(result(false, 'Wait for the pending music requests.')); return end
    lastRequest = now
    requestSequence = requestSequence % 2147483647 + 1
    local id = requestSequence

    local payload = { action=data.action, vehicleNetId=netId, videoId=data.videoId,
        position=data.position, volume=data.volume, title=data.title }
    pending[id] = { cb=cb, netId=netId }
    TriggerServerEvent('velox-hud:server:musicAction', payload, id)
    SetTimeout(cfg.RequestTimeout, function()
        local item=pending[id]
        if item then pending[id]=nil; item.cb(result(false, 'The music server did not respond.')) end
    end)
end

RegisterNUICallback('music:action', function(data, cb) musicRequest(data, cb, false) end)
RegisterNetEvent('velox-hud:client:musicResult', function(id, response)
    local item=pending[id]
    if not item then return end
    pending[id]=nil
    if vehicleNet(context(false)) ~= item.netId then item.cb(result(false, 'The vehicle context changed.')); return end
    item.cb(type(response)=='table' and type(response.ok)=='boolean' and response or result(false, 'Invalid music server response.'))
end)
RegisterNetEvent('velox-hud:client:musicState', function(data)
    local ctx = context(false)
    local netId = vehicleNet(ctx)
    if type(data) ~= 'table' or netId == 0 or data.vehicleNetId ~= netId
        or type(data.videoId) ~= 'string' or type(data.playing) ~= 'boolean'
        or #data.videoId > 80 or type(data.title) ~= 'string' or #data.title > 80
        or (data.source ~= 'youtube' and data.source ~= 'media')
        or not finite(data.revision) or data.revision < 0 or type(data.liked) ~= 'boolean'
        or (data.windowOpen~=nil and type(data.windowOpen)~='boolean')
        or type(data.playlist) ~= 'table' or #data.playlist > cfg.PlaylistLimit
        or not finite(data.position) or not finite(data.volume) or type(data.url) ~= 'string' or #data.url > 512
        or (data.url ~= '' and (not data.url:match('^https://') or data.url:find('[%z\1-\32]'))) then return end
    if adapter()=='cs-boombox' and (data.playing or data.position>0) and (not finite(data.boomboxNetId)
        or data.boomboxNetId%1~=0 or data.boomboxNetId<1 or data.boomboxNetId>2147483647
        or not finite(data.boomboxGeneration) or data.boomboxGeneration%1~=0
        or data.boomboxGeneration<1 or data.boomboxGeneration>2147483647) then return end
    if music and currentNet == netId and finite(data.revision) and data.revision < music.revision then return end
    local playlist = {}
    for _, track in ipairs(data.playlist) do
        if type(track) == 'table' and type(track.videoId) == 'string' and #track.videoId <= 80
            and type(track.title) == 'string' and #track.title <= 80
            and (track.source == 'youtube' or track.source == 'media') then
            playlist[#playlist+1] = {videoId=track.videoId,title=track.title,source=track.source}
        end
    end
    data = {vehicleNetId=data.vehicleNetId,videoId=data.videoId,url=data.url,title=data.title,
        source=data.source,playing=data.playing,position=data.position,volume=data.volume,windowOpen=data.windowOpen,
        playlist=playlist,liked=data.liked,revision=data.revision,
        boomboxNetId=data.boomboxNetId,boomboxGeneration=data.boomboxGeneration}
    local previousPosition, previousPlaying = currentPosition(), music and music.playing
    local sameTrack = music and currentNet == netId and music.videoId == data.videoId
    currentNet, music, receivedAt = netId, data, GetGameTimer()
    music.position = clamp(music.position, 0, cfg.MaximumPosition)
    music.volume = clamp(music.volume, 0, cfg.MaximumVolume)
    updateAudio(ctx.vehicle)
    if soundId then
        if not sameTrack or math.abs(previousPosition-music.position) > 2 then audioCall('setTimeStamp', soundId, music.position) end
        if previousPlaying ~= music.playing then audioCall(music.playing and 'Resume' or 'Pause', soundId) end
    end
    publish()
end)

local function normalizeText(text)
    if type(text) ~= 'string' or #text < 1 or #text > Config.Commands.MaximumText then return nil end
    for from,to in pairs({ ['İ']='i',['I']='i',['ı']='i',['Ş']='s',['ş']='s',['Ğ']='g',['ğ']='g',
        ['Ç']='c',['ç']='c',['Ö']='o',['ö']='o',['Ü']='u',['ü']='u' }) do text=text:gsub(from,to) end
    return text:lower():gsub('[%p%c]', ' '):gsub('%s+', ' '):match('^%s*(.-)%s*$')
end
local function parseCommand(text)
    text=normalizeText(text)
    if not text or text=='' then return nil end
    local exact = {
        ['engine on']={action='engine',value=true}, ['start engine']={action='engine',value=true},
        ['engine off']={action='engine',value=false}, ['stop engine']={action='engine',value=false},
        ['motoru ac']={action='engine',value=true}, ['motor ac']={action='engine',value=true},
        ['motoru kapat']={action='engine',value=false}, ['motor kapat']={action='engine',value=false},
        ['lock car']={action='lock',value=true}, ['lock vehicle']={action='lock',value=true},
        ['unlock car']={action='lock',value=false}, ['unlock vehicle']={action='lock',value=false},
        ['araci kilitle']={action='lock',value=true}, ['kilidi ac']={action='lock',value=false},
        ['lights on']={action='lights',value=true}, ['lights off']={action='lights',value=false},
        ['farlari ac']={action='lights',value=true}, ['farlari kapat']={action='lights',value=false},
        ['seatbelt on']={action='seatbelt',value=true}, ['seatbelt off']={action='seatbelt',value=false},
        ['kemeri tak']={action='seatbelt',value=true}, ['kemeri cikar']={action='seatbelt',value=false},
        ['left signal']={action='signalLeft'}, ['right signal']={action='signalRight'}, ['hazards']={action='hazards'},
        ['sol sinyal']={action='signalLeft'}, ['sag sinyal']={action='signalRight'}, ['dortluler']={action='hazards'},
        ['cruise control']={action='cruise'}, ['hiz sabitle']={action='cruise'},
        ['open hood']={action='door',index=4,value=true}, ['close hood']={action='door',index=4,value=false},
        ['kaputu ac']={action='door',index=4,value=true}, ['kaputu kapat']={action='door',index=4,value=false},
        ['open trunk']={action='door',index=5,value=true}, ['close trunk']={action='door',index=5,value=false},
        ['bagaji ac']={action='door',index=5,value=true}, ['bagaji kapat']={action='door',index=5,value=false},
        ['open phone']={service='phone'}, ['telefonu ac']={service='phone'},
        ['open inventory']={service='inventory'}, ['envanteri ac']={service='inventory'}
    }
    if exact[text] then return exact[text] end
    local verb, side = text:match('^(open) (%a+) window$')
    if not verb then verb,side=text:match('^(close) (%a+) window$') end
    local indices={driver=0, passenger=1, rearleft=2, rearright=3}
    if verb and indices[side] then return {action='window',index=indices[side],value=verb=='open'} end
    if text=='cami ac' or text=='cam ac' then return {action='window',index=0,value=true} end
    if text=='cami kapat' or text=='cam kapat' then return {action='window',index=0,value=false} end
    return nil
end
local function voiceCommand(data)
    if not Config.Commands.Enabled then return result(false, 'Voice commands are disabled.') end
    local intent = parseCommand(type(data)=='table' and data.text or data)
    if not intent then return result(false, 'Command not recognized. Try “engine on”, “open driver window”, or “motoru aç”.') end
    local ctx = context(false)
    if not ctx then return result(false, 'Load your player and close the pause menu before using commands.') end
    local now = GetGameTimer()
    if elapsed(now,lastVoice) < Config.Commands.Cooldown then return result(false,'Wait before another command.') end
    lastVoice=now
    if intent.service then
        local provider = intent.service=='phone' and Config.Commands.PhoneProvider or Config.Commands.InventoryProvider
        if type(provider)~='function' then return result(false, 'Configure the '..intent.service..' provider first.') end
        local ok, response=pcall(provider,ctx)
        if ok and type(response)=='table' and type(response.ok)=='boolean' then return response end
        return result(false,'The '..intent.service..' provider is unavailable.')
    end
    if type(VeloxHud.VehicleAction)=='function' then
        local ok, response=pcall(VeloxHud.VehicleAction,intent)
        if ok and type(response)=='table' and type(response.ok)=='boolean' then return response end
    end
    return result(false,'Vehicle controls are unavailable.')
end
RegisterNUICallback('voice:command', function(data, cb) cb(voiceCommand(data)) end)
local function speechAudio(data, cb)
    if not Config.Commands.Enabled or (Config.Commands.SpeechAdapter ~= 'wit' and Config.Commands.SpeechAdapter ~= 'provider') then
        cb(result(false, 'Configure the WIT or speech provider adapter before recording.')); return
    end
    if type(data) ~= 'table' or data.mime ~= 'audio/wav' or type(data.audio) ~= 'string'
        or #data.audio < 60 or #data.audio > Config.Commands.Wit.MaximumEncodedBytes
        or #data.audio % 4 ~= 0 or data.audio:find('[^A-Za-z0-9+/=]') then
        cb(result(false, 'Supply a bounded PCM WAV recording.')); return
    end
    local ctx = context(false)
    if not ctx then cb(result(false, 'Load your player before using microphone commands.')); return end
    if speechPending then cb(result(false, 'Wait for the current speech request.')); return end
    if elapsed(GetGameTimer(), lastSpeech) < math.max(6000, Config.Commands.Wit.RateLimit) then
        cb(result(false, 'Wait before another microphone request.')); return
    end
    lastSpeech = GetGameTimer()
    speechSequence = speechSequence % 2147483647 + 1
    local id = speechSequence
    speechPending = { id=id,cb=cb,ped=ctx.ped,vehicle=ctx.vehicle }
    TriggerLatentServerEvent('velox-hud:server:voiceAudio', Config.Commands.Wit.TransferBytesPerSecond,
        {audio=data.audio,mime='audio/wav'}, id)
    SetTimeout(Config.Commands.Wit.ClientTimeout, function()
        if speechPending and speechPending.id == id then
            local item=speechPending; speechPending=nil
            item.cb(result(false, 'The speech server did not respond.'))
        end
    end)
end
RegisterNUICallback('voice:audio', speechAudio)
RegisterNetEvent('velox-hud:client:voiceAudioResult', function(id, response)
    if not speechPending or speechPending.id ~= id then return end
    local item=speechPending; speechPending=nil
    local ctx=context(false)
    if not ctx or ctx.ped ~= item.ped or ctx.vehicle ~= item.vehicle then
        item.cb(result(false, 'The player or vehicle context changed during recognition.')); return
    end
    if type(response) ~= 'table' or type(response.ok) ~= 'boolean' then item.cb(result(false,'Invalid speech response.')); return end
    if not response.ok then item.cb(result(false,type(response.message)=='string' and response.message:sub(1,180) or 'Speech recognition failed.')); return end
    if type(response.text) ~= 'string' or #response.text < 1 or #response.text > Config.Commands.MaximumText then
        item.cb(result(false,'Speech returned an invalid transcript.')); return
    end
    local command=voiceCommand({text=response.text})
    command.text=response.text
    item.cb(command)
end)
RegisterNetEvent('velox-hud:client:voiceTranscript', function(text)
    local response=voiceCommand({text=text})
    SendNUIMessage({action='hud:voiceResult',data=response})
end)
exports('ProcessVoiceTranscript', function(text) return voiceCommand({text=text}) end)
VeloxHud.ParseVoiceCommand, VeloxHud.VoiceCommand = parseCommand, voiceCommand
VeloxHud.SendServicesConfig = function()
    local mediaChoices, validKeys, youtubeAudio = {}, {}, {}
    for key,media in pairs(type(cfg.AllowedMedia)=='table' and cfg.AllowedMedia or {}) do
        if type(key)=='string' and #key>0 and #key<=80 and not key:find('[%z\1-\31\127]')
            and type(media)=='table' and type(media.url)=='string'
            and #media.url<=512 and media.url:match('^https://[^/?#]+') and not media.url:find('[%z\1-\32\127]')
            and (media.title==nil or type(media.title)=='string') then
            mediaChoices[#mediaChoices+1]={key=key,title=(media.title or key):gsub('[%z\1-\31\127]',''):sub(1,80)}
        end
    end
    table.sort(mediaChoices,function(a,b) return a.key<b.key end)
    while #mediaChoices>64 do table.remove(mediaChoices) end
    for _,media in ipairs(mediaChoices) do validKeys[media.key]=true end
    local aliases={}
    for id,key in pairs(type(cfg.YouTubeAudio)=='table' and cfg.YouTubeAudio or {}) do
        if type(id)=='string' and #id==11 and id:match('^[%w_%-]+$')
            and type(key)=='string' and validKeys[key] then aliases[#aliases+1]={id=id,key=key} end
    end
    table.sort(aliases,function(a,b) return a.id<b.id end)
    for index=1,math.min(#aliases,64) do youtubeAudio[aliases[index].id]=aliases[index].key end
    SendNUIMessage({action='hud:servicesConfig',data={musicEnabled=cfg.Enabled,musicAdapter=adapter(),
        mediaChoices=mediaChoices,youtubeAudio=youtubeAudio,
        voiceCommands=Config.Commands.Enabled,speechAdapter=Config.Commands.SpeechAdapter,
        speechEnabled=Config.Commands.Enabled and (Config.Commands.SpeechAdapter=='wit' or Config.Commands.SpeechAdapter=='provider'),
        aerialEnabled=Config.Aerial.Enabled,negativeAvailable=Config.Aerial.NegativeTimecycle~=nil or type(Config.Aerial.VisionProvider)=='function'}})
    publish()
end
AddEventHandler('QBCore:Client:OnPlayerUnload',cleanup)
AddEventHandler('onClientResourceStop',function(resource)
    if resource==GetCurrentResourceName() or resource==Config.CoreResource then cleanup()
    elseif resource==cfg.Resource or resource==boomboxResource() then clearAmbient(); soundId,soundTrack=nil,nil; audioFailed=false; VeloxHud.SendServicesConfig() end
end)
AddEventHandler('onClientResourceStart',function(resource) if resource==cfg.Resource or resource==boomboxResource() then audioFailed=false; VeloxHud.SendServicesConfig() end end)
AddEventHandler('onResourceStop',function(resource) if resource==GetCurrentResourceName() then cleanup() end end)
CreateThread(function()
    while true do
        local ctx=context(false)
        local netId=vehicleNet(ctx)
        updateAmbient()
        if speechPending and (not ctx or ctx.ped~=speechPending.ped or ctx.vehicle~=speechPending.vehicle) then
            local item=speechPending; speechPending=nil
            item.cb(result(false,'The player or vehicle context changed during recognition.'))
        end
        if netId==0 then if music or currentNet~=0 or next(pending) then cleanup(not ctx) end
        else
            if currentNet~=0 and currentNet~=netId then cleanup(false) end
            local now=GetGameTimer()
            if elapsed(now,lastSync)>=math.max(1000,cfg.SyncInterval) then
                lastSync=now; musicRequest({action='sync'},nil,true)
            end
            if music then
                syncWindows(ctx)
                updateAudio(ctx.vehicle)
                if elapsed(now,lastUi)>=1000 then lastUi=now; publish() end
            end
        end
        Wait(250)
    end
end)
