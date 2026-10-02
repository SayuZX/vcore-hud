local cfg = Config.Music
local sessions, requests, windowRates = {}, {}, {}
local function finite(value) return type(value) == 'number' and value == value and math.abs(value) ~= math.huge end
local function integer(value) return finite(value) and value % 1 == 0 end
local function clamp(value, low, high) return math.max(low, math.min(high, value)) end
local function elapsed(now, before) return before == nil and math.huge or (now-before) % 4294967296 end
local function result(ok, message) return { ok = ok, message = message } end
local function cleanText(value, limit)
    if type(value) ~= 'string' then return nil end
    return value:gsub('[%z\1-\31\127]', ''):sub(1, limit)
end

local function authorizedPed(src)
    if not integer(src) or src<=0 then return nil end
    local ped = GetPlayerPed(src)
    if ped == 0 or not DoesEntityExist(ped) or GetEntityHealth(ped) <= 0 then return nil end
    if Config.Framework == 'qb' then
        if GetResourceState(Config.CoreResource) ~= 'started' then return nil end
        local ok, player = pcall(function()
            return exports[Config.CoreResource]:GetCoreObject().Functions.GetPlayer(src)
        end)
        if not ok or type(player) ~= 'table' or type(player.PlayerData) ~= 'table'
            or tonumber(player.PlayerData.source) ~= src or not player.PlayerData.citizenid then return nil end
        local metadata=player.PlayerData.metadata
        if type(metadata)=='table' and (metadata.isdead==true or metadata.inlaststand==true) then return nil end
    end
    return ped
end
local function playerVehicle(src, netId, driverOnly)
    if not integer(netId) or netId<=0 or netId>2147483647 then return nil end
    local ped=authorizedPed(src)
    if not ped then return nil end
    local vehicle = NetworkGetEntityFromNetworkId(netId)
    if vehicle == 0 or not DoesEntityExist(vehicle) or GetEntityType(vehicle) ~= 2
        or GetVehiclePedIsIn(ped, false) ~= vehicle then return nil end
    if driverOnly and GetPedInVehicleSeat(vehicle, -1) ~= ped then return nil end
    return vehicle
end

local function configuredMedia(key)
    if type(key) ~= 'string' or #key == 0 or #key > 80 or key:find('[%z\1-\31\127]') then return nil end
    local allowed = type(cfg.AllowedMedia) == 'table' and cfg.AllowedMedia[key] or nil
    if type(allowed) ~= 'table' or type(allowed.url) ~= 'string' or #allowed.url > 512
        or not allowed.url:match('^https://[^/?#]+') or allowed.url:find('[%z\1-\32\127]')
        or (allowed.title ~= nil and type(allowed.title) ~= 'string') then return nil end
    return { videoId = key, url = allowed.url, title = cleanText(allowed.title or key, 80), source = 'media' }
end

local function resolveMedia(id, title)
    if type(id) ~= 'string' or #id == 0 or #id > 80 then return nil end
    if title ~= nil and (type(title) ~= 'string' or #title > 160) then return nil end
    local allowed = configuredMedia(id)
    if allowed then return allowed end
    if #id == 11 and id:match('^[%w_%-]+$') then
        local aliases = type(cfg.YouTubeAudio) == 'table' and cfg.YouTubeAudio or {}
        local alias = aliases[id]
        if alias ~= nil then return configuredMedia(alias) end
        if cfg.AllowYouTube then
            return { videoId = id, url = 'https://www.youtube.com/watch?v=' .. id,
                title = cleanText(title, 80) or 'YouTube track', source = 'youtube' }
        end
    end
    return nil
end

local function boomboxEnabled()
    return cfg.Adapter == 'cs-boombox'
end

local function pollBoombox(session)
    if not boomboxEnabled() or not VcoreBoombox then return end
    local state = VcoreBoombox.Poll(session)
    if not state then
        if session.videoId ~= '' and not VcoreBoombox.Snapshot(session.netId) and (session.playing or session.position > 0) then
            session.playing, session.position, session.startedAt = false, 0, GetGameTimer()
            session.revision = session.revision + 1
        end
        return
    end
    local switched = session.videoId ~= state.videoId or session.url ~= state.url
    local changed = switched or session.playing ~= state.playing or session.volume ~= state.volume
        or #session.playlist ~= #state.playlist
    if not changed then
        for index, track in ipairs(state.playlist) do
            if track.videoId ~= session.playlist[index].videoId or track.url ~= session.playlist[index].url then changed = true; break end
        end
    end
    for _, key in ipairs({'videoId','url','title','source','playing','position','volume','playlist'}) do session[key] = state[key] end
    session.startedAt = GetGameTimer()
    if switched then session.liked = false end
    if changed then session.revision = session.revision + 1 end
end

local function removeBoombox(netId)
    if VcoreBoombox then VcoreBoombox.Remove(netId) end
end

local function position(session, now)
    return clamp(session.position + (session.playing and elapsed(now, session.startedAt)/1000.0 or 0), 0, cfg.MaximumPosition)
end

local function snapshot(session)
    pollBoombox(session)
    local boombox = boomboxEnabled() and VcoreBoombox and VcoreBoombox.Snapshot(session.netId) or nil
    local queue = {}
    for _, track in ipairs(session.playlist) do
        queue[#queue+1] = { videoId = track.videoId, title = track.title, source = track.source }
    end
    return { vehicleNetId = session.netId, videoId = session.videoId or '', url = session.url or '',
        title = session.title or '', source = session.source or 'youtube', playing = session.playing,
        position = position(session, GetGameTimer()), volume = session.volume, playlist = queue,
        liked = session.liked, revision = session.revision, windowOpen = session.windowOpen,
        boomboxNetId = boombox and boombox.boomboxNetId or nil, boomboxGeneration = boombox and boombox.boomboxGeneration or nil }
end

local function clearAmbient(session)
    for src in pairs(session.ambientListeners or {}) do
        TriggerClientEvent('velox-hud:client:ambientStop',src,session.netId)
    end
    session.ambientListeners={}
end

local function listenerSnapshot(nearby)
    local listeners={}
    for _,player in ipairs(GetPlayers()) do
        local src=tonumber(player)
        local ped=authorizedPed(src)
        if ped then
            local listener={src=src,vehicle=GetVehiclePedIsIn(ped,false)}
            if nearby then listener.coords,listener.bucket=GetEntityCoords(ped),GetPlayerRoutingBucket(src) end
            listeners[#listeners+1]=listener
        end
    end
    return listeners
end
local function nearbyEnabled()
    return cfg.NearbyAudio and not boomboxEnabled() and cfg.Adapter~='nui' and GetResourceState(cfg.Resource)=='started'
        and type(GetEntityRoutingBucket)=='function' and type(GetPlayerRoutingBucket)=='function'
end
local function publish(session,listeners)
    local state = snapshot(session)
    local nearby=nearbyEnabled() and state.videoId~='' and (state.playing or state.position>0)
    local center=nearby and GetEntityCoords(session.entity) or nil
    local bucket=nearby and GetEntityRoutingBucket(session.entity) or nil
    local radius=clamp(cfg.Distance,1,100)+clamp(cfg.ListenerMargin,0,10)
    local candidates={}


    for _,listener in ipairs(listeners or listenerSnapshot(nearby)) do
        local src=listener.src
            if listener.vehicle==session.entity then
                TriggerClientEvent('velox-hud:client:musicState', src, state)
            elseif nearby and listener.bucket==bucket then
                local pos=listener.coords
                local distance=(pos.x-center.x)^2+(pos.y-center.y)^2+(pos.z-center.z)^2
                if distance<=radius^2 then candidates[#candidates+1]={src=src,distance=distance} end
            end
    end
    table.sort(candidates,function(a,b) return a.distance<b.distance end)
    local selected={}
    local ambient={vehicleNetId=state.vehicleNetId,videoId=state.videoId,url=state.url,source=state.source,
        title=state.title,playing=state.playing,position=state.position,volume=state.volume,
        revision=state.revision,windowOpen=state.windowOpen}
    for index=1,math.min(#candidates,math.floor(clamp(cfg.ListenerLimit,0,64))) do
        local src=candidates[index].src
        selected[src]=true
        TriggerClientEvent('velox-hud:client:ambientMusic',src,ambient)
    end
    for src in pairs(session.ambientListeners or {}) do
        if not selected[src] then TriggerClientEvent('velox-hud:client:ambientStop',src,session.netId) end
    end
    session.ambientListeners=selected
end

local function sessionFor(netId, entity)
    local session = sessions[netId]

    if not session or session.entity ~= entity then
        if session then removeBoombox(netId) end
        local count = 0
        for _ in pairs(sessions) do count = count + 1 end
        if count >= cfg.SessionLimit then return nil end
        session = { netId = netId, entity = entity, videoId = '', url = '', title = '', source = 'youtube',
            playing = false, position = 0.0, startedAt = GetGameTimer(),
            volume = clamp(cfg.DefaultVolume, 0, cfg.MaximumVolume), playlist = {}, liked = false, revision = 0,
            lastOccupied = GetGameTimer(), ambientListeners={}, windowOpen=nil }
        sessions[netId] = session
    end
    return session
end

local function playTrack(session, media)
    session.videoId, session.url, session.title, session.source = media.videoId, media.url, media.title, media.source
    session.position, session.startedAt, session.playing, session.liked = 0.0, GetGameTimer(), true, false
end

local function musicAction(src, data)
    if not cfg.Enabled then return result(false, 'Vehicle music is disabled.') end
    if type(data) ~= 'table' or type(data.action) ~= 'string' then return result(false, 'Invalid music request.') end
    local allowedActions = { sync=true, play=true, pause=true, stop=true, seek=true, volume=true, next=true, like=true, playlist=true }
    if not allowedActions[data.action] then return result(false, 'Unknown music action.') end
    local vehicle = playerVehicle(src, data.vehicleNetId, data.action ~= 'sync')
    if not vehicle then return result(false, 'Control music from the current vehicle driver seat.') end
    local now = GetGameTimer()
    local previous = requests[src]
    if previous and elapsed(now, previous) < cfg.RequestInterval then return result(false, 'Music controls are being used too quickly.') end
    requests[src] = now
    local session = sessionFor(data.vehicleNetId, vehicle)
    if not session then return result(false, 'Vehicle music capacity is reached; try again later.') end
    session.lastOccupied = now
    pollBoombox(session)
    local original = session
    if data.action ~= 'sync' then
        session = {}
        for key, value in pairs(original) do session[key] = value end
        session.playlist = {}
        for index, track in ipairs(original.playlist) do session.playlist[index] = track end
        session.position, session.startedAt = position(original, now), now
    end
    if data.action == 'sync' then
        TriggerClientEvent('velox-hud:client:musicState', src, snapshot(session))
        return result(true, 'Music synchronized.')
    elseif data.action == 'play' then
        if data.videoId ~= nil and data.videoId ~= '' then
            local media = resolveMedia(data.videoId, data.title)
            if not media then return result(false, 'Use a valid YouTube video ID or configured media key.') end
            playTrack(session, media)
        elseif session.videoId ~= '' then
            session.position = position(session, now)
            session.startedAt, session.playing = now, true
        else return result(false, 'Choose a track first.') end
    elseif data.action == 'pause' then
        session.position, session.startedAt, session.playing = position(session, now), now, false
    elseif data.action == 'stop' then
        session.playing, session.position, session.startedAt = false, 0.0, now
    elseif data.action == 'seek' then
        if not finite(data.position) or data.position < 0 or data.position > cfg.MaximumPosition then
            return result(false, 'Playback position is out of range.')
        end
        if session.videoId == '' then return result(false, 'Choose a track first.') end
        session.position, session.startedAt = data.position, now
    elseif data.action == 'volume' then
        if not finite(data.volume) or data.volume < 0 or data.volume > cfg.MaximumVolume then
            return result(false, 'Volume is out of range.')
        end
        session.volume = data.volume
    elseif data.action == 'playlist' then
        local media = resolveMedia(data.videoId, data.title)
        if not media then return result(false, 'Use a valid YouTube video ID or configured media key.') end
        if #session.playlist >= cfg.PlaylistLimit then return result(false, 'The vehicle playlist is full.') end
        session.playlist[#session.playlist+1] = media
    elseif data.action == 'next' then
        if #session.playlist == 0 then return result(false, 'The vehicle playlist is empty.') end
        playTrack(session, table.remove(session.playlist, 1))
    elseif data.action == 'like' then
        if session.videoId == '' then return result(false, 'Choose a track first.') end
        session.liked = not session.liked
    end
    if boomboxEnabled() and data.action ~= 'like' then
        if not VcoreBoombox then return result(false, 'Bridge cs-boombox belum dimuat.') end
        local action = data.action == 'play' and data.videoId and data.videoId ~= '' and 'restart' or data.action
        local completed, applied, message = pcall(VcoreBoombox.Apply, session, action)
        if not completed then applied, message = false, 'cs-boombox gagal menerima lagu. Coba lagi.' end
        if not applied then
            local restored = false
            if original.videoId ~= '' or #original.playlist > 0 then
                local recovered, value = pcall(VcoreBoombox.Apply, original, 'restore')
                restored = recovered and value == true
            end
            if not restored then
                removeBoombox(original.netId)
                original.playing, original.position, original.startedAt = false, 0, now
            end
            publish(original)
            return result(false, message or 'cs-boombox gagal menerima lagu. Coba lagi.')
        end
    end
    session.revision = session.revision + 1
    for key, value in pairs(session) do original[key] = value end
    session = original
    publish(session)
    return result(true, 'Music updated.')
end

RegisterNetEvent('velox-hud:server:musicAction', function(data, requestId)
    local src = source

    if not integer(requestId) or requestId < 1 or requestId > 2147483647 then return end
    local ok, response = pcall(musicAction, src, data)
    TriggerClientEvent('velox-hud:client:musicResult', src, requestId,
        ok and response or result(false, 'Music service is unavailable.'))
end)

RegisterNetEvent('velox-hud:server:musicWindow',function(data)
    local src=source
    if not cfg.Enabled or not cfg.SyncWindowState or type(data)~='table' or type(data.open)~='boolean' then return end
    local vehicle=playerVehicle(src,data.vehicleNetId,true)
    if not vehicle or elapsed(GetGameTimer(),windowRates[src])<500 then return end
    windowRates[src]=GetGameTimer()
    local session=sessions[data.vehicleNetId]
    if not session or session.entity~=vehicle then return end

    session.windowOpen=data.open
    publish(session)
end)

AddEventHandler('playerDropped', function()
    requests[source],windowRates[source]=nil,nil
    for _,session in pairs(sessions) do if session.ambientListeners then session.ambientListeners[source]=nil end end
end)
AddEventHandler('entityRemoved', function(entity)
    for id, session in pairs(sessions) do if session.entity == entity then clearAmbient(session); removeBoombox(id); sessions[id] = nil end end
end)
AddEventHandler('onResourceStop', function(resource)
    if resource==GetCurrentResourceName() or resource==Config.CoreResource or resource==cfg.Resource then
        for id,session in pairs(sessions) do
            clearAmbient(session)
            removeBoombox(id)
            if boomboxEnabled() then session.playing, session.position, session.startedAt = false, 0, GetGameTimer(); publish(session) end
        end
        if resource==GetCurrentResourceName() then sessions,requests,windowRates={},{},{} end
    end
end)
CreateThread(function()
    while true do
        Wait(math.max(1000, cfg.SyncInterval))


        local listeners=next(sessions) and listenerSnapshot(nearbyEnabled()) or {}
        for id, session in pairs(sessions) do
            if not DoesEntityExist(session.entity) or NetworkGetEntityFromNetworkId(id) ~= session.entity then clearAmbient(session); removeBoombox(id); sessions[id] = nil
            else
                local occupied = false
                for _,listener in ipairs(listeners) do
                    if listener.vehicle==session.entity then occupied=true; break end
                end
                if occupied then session.lastOccupied = GetGameTimer(); publish(session,listeners)
                elseif elapsed(GetGameTimer(), session.lastOccupied) >= cfg.EmptyVehicleTimeout then clearAmbient(session); removeBoombox(id); sessions[id] = nil
                else publish(session,listeners) end
            end
        end
    end
end)



exports('TranscribeVoice', function(src, audio)
    if not Config.Commands.Enabled or type(Config.Commands.TranscriptProvider) ~= 'function' then
        return result(false, 'Configure a server speech provider before using microphone transcription.')
    end
    if not integer(src) or src <= 0 or GetPlayerPed(src) == 0 or type(audio) ~= 'string' or #audio < 1 or #audio > 1048576 then
        return result(false, 'Invalid speech input.')
    end
    local ok, text = pcall(Config.Commands.TranscriptProvider, src, audio, GetConvar('velox_wit_token', ''))
    text = ok and cleanText(text, Config.Commands.MaximumText) or nil
    if not text or text == '' then return result(false, 'Speech provider returned no transcript.') end
    TriggerClientEvent('velox-hud:client:voiceTranscript', src, text)
    return result(true, 'Transcript delivered to the player for local command validation.')
end)



local speechRequests, speechRates, httpSlots = {}, {}, {}
local speechConfig = Config.Commands.Wit
local base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
local base64Values = {}
for i=1,#base64Alphabet do base64Values[base64Alphabet:sub(i,i)] = i-1 end

local function decodeSpeechWav(encoded)
    if type(encoded)~='string' or #encoded<60 or #encoded>speechConfig.MaximumEncodedBytes or #encoded%4~=0 then return nil end
    local body=encoded:gsub('=+$','')
    local padding=#encoded-#body
    if padding>2 or body:find('[^A-Za-z0-9+/]') or body:find('=') then return nil end
    if (#encoded//4)*3-padding>speechConfig.MaximumAudioBytes then return nil end
    local chunks={}
    for i=1,#encoded,4 do
        local a,b=base64Values[encoded:sub(i,i)],base64Values[encoded:sub(i+1,i+1)]
        local c,d=base64Values[encoded:sub(i+2,i+2)],base64Values[encoded:sub(i+3,i+3)]
        if not a or not b then return nil end
        if i<#encoded-3 and (not c or not d) then return nil end
        if not c and (padding~=2 or (b & 15)~=0) then return nil end
        if c and not d and (padding~=1 or (c & 3)~=0) then return nil end
        local value=(a<<18)|(b<<12)|((c or 0)<<6)|(d or 0)
        chunks[#chunks+1]=string.char((value>>16)&255)
        if c then chunks[#chunks+1]=string.char((value>>8)&255) end
        if d then chunks[#chunks+1]=string.char(value&255) end
    end
    local wav=table.concat(chunks)
    if #wav<46 or #wav>speechConfig.MaximumAudioBytes or wav:sub(1,4)~='RIFF' or wav:sub(9,12)~='WAVE'
        or wav:sub(13,16)~='fmt ' or wav:sub(37,40)~='data' then return nil end
    local riff=string.unpack('<I4',wav,5)
    local formatSize,encoding,channels,rate,byteRate,alignment,bits=string.unpack('<I4I2I2I4I4I2I2',wav,17)
    local bytes=string.unpack('<I4',wav,41)

    if riff~=#wav-8 or formatSize~=16 or encoding~=1 or channels~=1 or rate~=16000
        or byteRate~=32000 or alignment~=2 or bits~=16 or bytes~=#wav-44 or bytes%2~=0
        or bytes<3200 or bytes>160000 then return nil end
    return wav
end

local function speechIdentity(src)
    if not integer(src) or src<=0 then return nil end
    local ped=GetPlayerPed(src)
    if ped==0 or not DoesEntityExist(ped) or GetEntityHealth(ped)<=0 then return nil end
    if Config.Framework=='qb' then
        if GetResourceState(Config.CoreResource)~='started' then return nil end
        local ok,player=pcall(function() return exports[Config.CoreResource]:GetCoreObject().Functions.GetPlayer(src) end)
        if not ok or type(player)~='table' or type(player.PlayerData)~='table' then return nil end
        local data=player.PlayerData
        if tonumber(data.source)~=src or type(data.citizenid)~='string' or data.citizenid=='' then return nil end
        if type(data.metadata)=='table' and (data.metadata.isdead==true or data.metadata.inlaststand==true) then return nil end
        return tostring(ped)..':'..data.citizenid
    end
    return tostring(src)..':'..tostring(ped)
end

local function parseWitSpeech(body)
    if type(body)~='string' or #body<2 or #body>262144 then return nil end
    local records,depth,start,quoted,escaped={},0,nil,false,false


    for i=1,#body do
        local char=body:sub(i,i)
        if quoted then
            if escaped then escaped=false elseif char=='\\' then escaped=true elseif char=='"' then quoted=false end
        elseif char=='"' then quoted=true
        elseif char=='{' then if depth==0 then start=i end; depth=depth+1
        elseif char=='}' then
            depth=depth-1
            if depth<0 then return nil end
            if depth==0 and start then
                local ok,record=pcall(json.decode,body:sub(start,i))
                if not ok or type(record)~='table' or record.error then return nil end
                records[#records+1]=record
                if #records>256 then return nil end
                start=nil
            end
        end
    end
    if quoted or depth~=0 or #records==0 then return nil end
    local transcript,priority=nil,-1
    for _,record in ipairs(records) do
        local final=record.type=='FINAL_UNDERSTANDING' or record.type=='FINAL_TRANSCRIPTION' or record.is_final==true
        local legacy=#records==1 and record.type==nil and record.is_final==nil
        if (final or legacy) and type(record.text)=='string' and #record.text<=Config.Commands.MaximumText then
            local rank=record.type=='FINAL_UNDERSTANDING' and 2 or 1
            local text=cleanText(record.text,Config.Commands.MaximumText):match('^%s*(.-)%s*$')
            if text~='' and rank>=priority then transcript,priority=text,rank end
        end
    end
    return transcript
end

local function finishSpeech(src,item,response)
    if speechRequests[src]~=item then return end
    speechRequests[src]=nil
    if speechIdentity(src)~=item.identity then response=result(false,'The player context changed during recognition.') end
    TriggerClientEvent('velox-hud:client:voiceAudioResult',src,item.id,response)
end

local function requestSpeech(src,data,id)
    local function reject(message) TriggerClientEvent('velox-hud:client:voiceAudioResult',src,id,result(false,message)) end
    if not integer(id) or id<1 or id>2147483647 then return end
    local identity=speechIdentity(src)
    if not identity then reject('Load your player before using microphone commands.'); return end
    if not Config.Commands.Enabled or (Config.Commands.SpeechAdapter~='wit' and Config.Commands.SpeechAdapter~='provider') then
        reject('Configure the WIT or speech provider adapter before recording.'); return
    end
    local now=GetGameTimer()
    if elapsed(now,speechRates[src])<math.max(6000,speechConfig.RateLimit) then reject('Wait before another microphone request.'); return end
    speechRates[src]=now
    if speechRequests[src] then reject('A speech request is already pending.'); return end
    local count=0
    for _ in pairs(speechRequests) do count=count+1 end
    local httpCount=0
    for _ in pairs(httpSlots) do httpCount=httpCount+1 end
    if count>=speechConfig.MaximumPending or httpCount>=speechConfig.MaximumPending then reject('Speech service is busy; try again later.'); return end
    if type(data)~='table' or data.mime~='audio/wav' then reject('Supply a bounded PCM WAV recording.'); return end
    local wav=decodeSpeechWav(data.audio)
    if not wav then reject('Use 16 kHz mono 16-bit PCM WAV audio within the recording limit.'); return end
    local token=GetConvar('velox_wit_token','')
    if Config.Commands.SpeechAdapter=='wit' then
        if #token<20 or #token>256 or token:find('[^A-Za-z0-9_.%-]') then reject('Configure the server-only WIT token first.'); return end
        if type(speechConfig.ApiVersion)~='string' or not speechConfig.ApiVersion:match('^%d%d%d%d%d%d%d%d$') then
            reject('The configured WIT API version is invalid.'); return
        end
    elseif type(Config.Commands.TranscriptProvider)~='function' then reject('Configure the server speech provider first.'); return end
    local item={id=id,identity=identity}
    speechRequests[src]=item
    httpSlots[item]=true
    SetTimeout(speechConfig.RequestTimeout,function() finishSpeech(src,item,result(false,'Speech recognition timed out.')) end)
    if Config.Commands.SpeechAdapter=='provider' then
        CreateThread(function()
            local ok,text=pcall(Config.Commands.TranscriptProvider,src,wav,token)
            httpSlots[item]=nil
            if not ok or type(text)~='string' or #text<1 or #text>Config.Commands.MaximumText then
                finishSpeech(src,item,result(false,'The speech provider returned no valid transcript.')); return
            end
            finishSpeech(src,item,{ok=true,message='Speech recognized.',text=cleanText(text,Config.Commands.MaximumText)})
        end)
        return
    end
    local ok=pcall(PerformHttpRequest,'https://api.wit.ai/speech?v='..speechConfig.ApiVersion,function(status,body)
        httpSlots[item]=nil
        if speechRequests[src]~=item then return end
        if status~=200 then
            local message=(status==401 or status==403) and 'WIT authentication failed; check the server token.'
                or status==429 and 'WIT request limit reached; try again later.' or 'WIT speech service is unavailable.'
            finishSpeech(src,item,result(false,message)); return
        end
        local text=parseWitSpeech(body)
        if not text then finishSpeech(src,item,result(false,'WIT returned no final transcription.')); return end
        finishSpeech(src,item,{ok=true,message='Speech recognized.',text=text})
    end,'POST',wav,{['Content-Type']='audio/wav',Authorization='Bearer '..token},{followLocation=false})
    if not ok then httpSlots[item]=nil; finishSpeech(src,item,result(false,'Unable to start WIT speech recognition.')) end
end

RegisterNetEvent('velox-hud:server:voiceAudio',function(data,id) requestSpeech(source,data,id) end)
AddEventHandler('playerDropped',function() speechRequests[source],speechRates[source]=nil,nil end)
AddEventHandler('onResourceStop',function(resource)
    if resource==Config.CoreResource or resource==GetCurrentResourceName() then
        for src,item in pairs(speechRequests) do finishSpeech(src,item,result(false,'The speech service is restarting.')) end
        speechRequests,speechRates={},{}


    end
end)
