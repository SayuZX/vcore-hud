VcoreBoombox = VcoreBoombox or {}
local cfg = Config.Music
local bindings = {}
local generation = 0

local function finite(value)
    return type(value) == 'number' and value == value and math.abs(value) ~= math.huge
end

local function integer(value)
    return finite(value) and value > 0 and value % 1 == 0
end

local function resource()
    return cfg.BoomboxResource or cfg.Resource or 'cs-boombox'
end

local function invoke(method, ...)
    if GetResourceState(resource()) ~= 'started' then return false, 'Resource cs-boombox belum aktif.' end
    local args = table.pack(...)
    local ok, value = pcall(function()
        local api = exports[resource()]
        return api[method](api, table.unpack(args, 1, args.n))
    end)
    if not ok then return false, 'cs-boombox belum siap. Periksa resource dan bridge VCORE.' end
    if value == false then return false, 'cs-boombox menolak pengaturan pemutar.' end
    return true, value
end

function VcoreBoombox.Active()
    return cfg.Enabled == true and cfg.Adapter == 'cs-boombox'
end

local function mapping(entry)
    return { vehicleNetId = entry.netId, boomboxNetId = entry.propNetId, generation = entry.generation }
end

function VcoreBoombox.Snapshot(netId)
    local entry = bindings[netId]
    if not entry then return nil end
    return { boomboxNetId = entry.propNetId, boomboxGeneration = entry.generation }
end

function VcoreBoombox.Remove(netId)
    local entry = bindings[netId]
    if not entry then return end
    bindings[netId] = nil
    invoke('VcoreDestroyPlayer', entry.id)
    TriggerClientEvent('velox-hud:client:boomboxDetach', -1, mapping(entry))
    if DoesEntityExist(entry.prop) then DeleteEntity(entry.prop) end
end

function VcoreBoombox.Prepare(session)
    if not VcoreBoombox.Active() then return false, 'Adapter cs-boombox tidak aktif.' end
    if GetResourceState(resource()) ~= 'started' then return false, 'Resource cs-boombox belum aktif.' end
    if type(session) ~= 'table' or not integer(session.netId) or not integer(session.entity)
        or not DoesEntityExist(session.entity) or GetEntityType(session.entity) ~= 2
        or NetworkGetEntityFromNetworkId(session.netId) ~= session.entity then return false, 'Kendaraan tidak tersedia.' end
    local entry = bindings[session.netId]
    if entry and (entry.vehicle ~= session.entity or not DoesEntityExist(entry.prop)
        or NetworkGetEntityFromNetworkId(entry.propNetId) ~= entry.prop) then
        VcoreBoombox.Remove(session.netId)
        entry = nil
    end
    if not entry then
        local count = 0
        for _ in pairs(bindings) do count = count + 1 end
        if count >= math.min(256, tonumber(cfg.SessionLimit) or 256) then return false, 'Pemutar kendaraan penuh. Coba lagi nanti.' end
        local coords = GetEntityCoords(session.entity)
        local model = cfg.BoomboxModel or 'prop_boombox_01'
        local prop = CreateObject(GetHashKey(model), coords.x, coords.y, coords.z, true, true, false)
        if not integer(prop) or not DoesEntityExist(prop) then return false, 'Boombox kendaraan gagal dibuat.' end
        local propNetId = NetworkGetNetworkIdFromEntity(prop)
        if not integer(propNetId) then DeleteEntity(prop); return false, 'Boombox belum tersinkron. Coba lagi.' end
        generation = generation + 1
        entry = { netId = session.netId, vehicle = session.entity, prop = prop, propNetId = propNetId,
            id = tostring(propNetId), generation = generation, model = model, tracks = {} }
        bindings[session.netId] = entry
        if type(SetEntityRoutingBucket) == 'function' and type(GetEntityRoutingBucket) == 'function' then
            SetEntityRoutingBucket(prop, GetEntityRoutingBucket(session.entity))
        end
        if type(Entity) == 'function' then
            Entity(prop).state:set('vcoreBoombox', { vehicleNetId = entry.netId, generation = entry.generation }, true)
        end
    end
    local ok, message = invoke('VcoreEnsurePlayer', entry.id, entry.model)
    if not ok then VcoreBoombox.Remove(session.netId); return false, message end
    TriggerClientEvent('velox-hud:client:boomboxAttach', -1, mapping(entry))
    return true, entry
end

local function trackCopy(track)
    if type(track) ~= 'table' or type(track.url) ~= 'string' or #track.url > 512
        or not track.url:match('^https://[^/?#]+') or track.url:find('[%z\1-\32\127]')
        or type(track.videoId) ~= 'string' or #track.videoId == 0 or #track.videoId > 80 then return nil end
    return { videoId = track.videoId, url = track.url, source = track.source == 'media' and 'media' or 'youtube',
        title = type(track.title) == 'string' and track.title:sub(1,80) or track.videoId }
end

local function clearQueue(entry)
    local ok, current = invoke('GetQueue', entry.id)
    if not ok then return false, current end
    if type(current) ~= 'table' or #current > 256 then return false, 'Antrean cs-boombox tidak valid.' end
    for index = #current, 1, -1 do
        local removed, message = invoke('RemoveFromQueue', entry.id, index)
        if not removed then return false, message end
    end
    return true
end

local function addTrack(entry, track)
    local thumbnail = track.source == 'youtube' and 'https://i.ytimg.com/vi/' .. track.videoId .. '/hqdefault.jpg' or ''
    return invoke('AddToQueue', entry.id, track.url, thumbnail, track.title, track.title, track.source == 'youtube' and 'youtube' or 'music', nil)
end

function VcoreBoombox.Apply(session, action)
    local prepared, entry = VcoreBoombox.Prepare(session)
    if not prepared then return false, entry end
    local current = trackCopy(session)
    local pending = {}
    for _, track in ipairs(session.playlist or {}) do
        local clean = trackCopy(track)
        if not clean or #pending >= math.min(64, tonumber(cfg.PlaylistLimit) or 32) then return false, 'Antrean lagu tidak valid.' end
        pending[#pending + 1] = clean
    end
    local ok, player = invoke('GetPlayer', entry.id)
    if not ok then return false, player end
    local switching = current and (type(player) ~= 'table' or player.url ~= current.url or action == 'next' or action == 'restart')
    local tracks = {}
    if current then tracks[current.url] = current end
    for _, track in ipairs(pending) do tracks[track.url] = track end
    entry.tracks = tracks
    if switching then
        local cleared, message = clearQueue(entry)
        if not cleared then return false, message end
        local added, problem = addTrack(entry, current)
        if not added then return false, problem end
        local selected, reason = invoke('QueueNow', entry.id, 1)
        if not selected then return false, reason end
    end
    local cleared, message = clearQueue(entry)
    if not cleared then return false, message end
    for _, track in ipairs(pending) do
        local added, problem = addTrack(entry, track)
        if not added then return false, problem end
    end
    local volumeOk, volume = invoke('VcoreSetVolume', entry.id, math.max(0, math.min(1, finite(session.volume) and session.volume or 0)))
    if not volumeOk then return false, volume end
    if type(volume) == 'number' then session.volume = volume end
    if action == 'stop' or not current then return invoke('Stop', entry.id) end
    if switching or action == 'seek' or action == 'restart' or action == 'restore' then
        local seekOk, position = invoke('VcoreSeek', entry.id, math.max(0, math.min(21600, finite(session.position) and session.position or 0)))
        if not seekOk then return false, position end
        if type(position) == 'number' then session.position = position end
    end
    return invoke(session.playing and 'Play' or 'Pause', entry.id)
end

function VcoreBoombox.Poll(session)
    if type(session) ~= 'table' then return nil end
    local entry = bindings[session.netId]
    if not entry then return nil end
    if entry.vehicle ~= session.entity or not DoesEntityExist(entry.vehicle) or not DoesEntityExist(entry.prop) then
        VcoreBoombox.Remove(session.netId)
        return nil
    end
    if type(SetEntityRoutingBucket) == 'function' and type(GetEntityRoutingBucket) == 'function' then
        SetEntityRoutingBucket(entry.prop, GetEntityRoutingBucket(entry.vehicle))
    end
    local ok, player = invoke('GetPlayer', entry.id)
    if not ok or type(player) ~= 'table' then return nil end
    local current = player.url and entry.tracks[player.url] or trackCopy(session)
    local queueOk, queue = invoke('GetQueue', entry.id)
    if not current or not queueOk or type(queue) ~= 'table' then return nil end
    local result = trackCopy(current)
    result.playing = player.url ~= nil and player.playing == true and player.stopped ~= true
    result.position = finite(player.time) and math.max(0, math.min(21600, player.time)) or 0
    result.volume = finite(player.volume) and math.max(0, math.min(1, player.volume)) or session.volume
    result.playlist = {}
    for index = 1, math.min(#queue, 64) do
        local known = type(queue[index]) == 'table' and entry.tracks[queue[index].url]
        if known then result.playlist[#result.playlist + 1] = trackCopy(known) end
    end
    return result
end

AddEventHandler('entityRemoved', function(entity)
    local remove = {}
    for netId, entry in pairs(bindings) do
        if entity == entry.vehicle or entity == entry.prop then remove[#remove + 1] = netId end
    end
    for _, netId in ipairs(remove) do VcoreBoombox.Remove(netId) end
end)

AddEventHandler('onResourceStop', function(stopped)
    if stopped ~= GetCurrentResourceName() and stopped ~= resource() and stopped ~= Config.CoreResource then return end
    local remove = {}
    for netId in pairs(bindings) do remove[#remove + 1] = netId end
    for _, netId in ipairs(remove) do VcoreBoombox.Remove(netId) end
end)
