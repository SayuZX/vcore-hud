VeloxHud = VeloxHud or {}
local cfg = Config.Aerial
local camera, cameraVehicle = nil, 0
local pitch, yaw, fov = -35.0, 0.0, cfg.InitialFov
local state = { active = false, vision = 'normal', spotlight = false, target = false, zoom = 1.0,
    distance = cfg.SpotlightDistance, radius = cfg.SpotlightRadius }
local cursor = { CPed = 1, CVehicle = 1 }
local lastScan, lastSend = nil, nil
local customVision, timecycleOwned = false, false
local priorThermal, priorNight = false, false

local function finite(value) return type(value) == 'number' and value == value and math.abs(value) ~= math.huge end
local function clamp(value, low, high) return math.max(low, math.min(high, value)) end
local function elapsed(now, before) return before == nil and math.huge or (now - before) % 4294967296 end
local function result(ok, message) return { ok = ok, message = message } end
local function publish()
    SendNUIMessage({ action = 'hud:aerial', data = state })
end

local function context()
    if not cfg.Enabled then return nil end
    if type(VeloxHud.CanInteract) ~= 'function' then return nil end
    local ready, ctx = VeloxHud.CanInteract(cfg.DriverOnly)
    if not ready or not ctx or ctx.vehicle == 0 or not DoesEntityExist(ctx.vehicle)
        or GetVehicleClass(ctx.vehicle) ~= 15 then return nil end
    if cfg.Jobs and not (cfg.Jobs[ctx.job and ctx.job.name] or cfg.Jobs[ctx.job and ctx.job.type]) then return nil end
    return ctx
end

local function clearVision()
    SetSeethrough(false)
    SetNightvision(false)
    if timecycleOwned then ClearTimecycleModifier(); timecycleOwned = false end
    if customVision and type(cfg.VisionProvider) == 'function' then pcall(cfg.VisionProvider, 'normal', camera) end
    customVision = false
end

local function stopCamera()
    if not state.active and not camera then return end
    clearVision()
    SetSeethrough(priorThermal)
    SetNightvision(priorNight)
    RenderScriptCams(false, false, 0, true, false)
    if camera then DestroyCam(camera, false) end
    camera, cameraVehicle = nil, 0
    state.active, state.spotlight, state.target, state.vision = false, false, false, 'normal'
    lastScan, lastSend = nil, nil
    publish()
end

local function setVision(mode)
    if mode ~= 'normal' and mode ~= 'thermal' and mode ~= 'negative' then return result(false, 'Unknown camera vision mode.') end
    if mode == 'negative' and not cfg.NegativeTimecycle and type(cfg.VisionProvider) ~= 'function' then
        return result(false, 'Negative vision needs a configured native timecycle or shader provider.')
    end
    clearVision()
    state.vision = 'normal'
    if mode == 'thermal' then SetSeethrough(true)
    elseif mode == 'negative' then
        if type(cfg.VisionProvider) == 'function' then
            local ok, applied = pcall(cfg.VisionProvider, mode, camera)
            if not ok or applied ~= true then publish(); return result(false, 'The negative vision provider is unavailable.') end
            customVision = true
        else
            SetTimecycleModifier(cfg.NegativeTimecycle)
            if type(GetTimecycleModifierIndex) == 'function' and GetTimecycleModifierIndex() == -1 then
                ClearTimecycleModifier()
                publish()
                return result(false, 'The configured negative timecycle is unavailable on this game build.')
            end
            SetTimecycleModifierStrength(1.0)
            timecycleOwned = true
        end
    end
    state.vision = mode
    publish()
    return result(true, 'Camera vision updated.')
end

local function startCamera(ctx)
    camera = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    if not camera or camera == 0 then camera = nil; return result(false, 'Unable to create the aerial camera.') end
    cameraVehicle = ctx.vehicle
    priorThermal = type(GetUsingseethrough) == 'function' and GetUsingseethrough() or false
    priorNight = type(GetUsingnightvision) == 'function' and GetUsingnightvision() or false
    pitch, yaw, fov = -35.0, GetEntityHeading(ctx.vehicle), cfg.InitialFov
    local pos = GetOffsetFromEntityInWorldCoords(cameraVehicle, 0.0, 1.0, -1.5)
    SetCamCoord(camera, pos.x, pos.y, pos.z)
    SetCamRot(camera, pitch, 0.0, yaw, 2)
    SetCamFov(camera, fov)
    RenderScriptCams(true, false, 0, true, false)
    clearVision()
    state.active, state.vision, state.zoom, state.target = true, 'normal', cfg.MaximumFov / fov, false
    publish()
    return result(true, 'Aerial camera enabled. Mouse or arrows pan; scroll zooms; Backspace or Escape exits.')
end

local function aerialAction(data)
    if type(data) ~= 'table' or type(data.action) ~= 'string' then return result(false, 'Invalid camera request.') end
    if data.action == 'toggle' and state.active then stopCamera(); return result(true, 'Aerial camera disabled.') end
    local ctx = context()
    if not ctx then stopCamera(); return result(false, 'Use the camera from an authorized helicopter seat.') end
    if data.action == 'toggle' then return startCamera(ctx) end
    if not state.active then return result(false, 'Enable the aerial camera first.') end
    if data.action == 'vision' then return setVision(data.mode) end
    if data.action == 'spotlight' then
        state.spotlight = not state.spotlight
        publish()
        return result(true, 'Spotlight updated.')
    end
    if data.action == 'settings' then
        if (data.distance ~= nil and not finite(data.distance)) or (data.radius ~= nil and not finite(data.radius)) then
            return result(false, 'Spotlight settings must be finite numbers.')
        end
        if data.distance ~= nil then state.distance = clamp(data.distance, 10.0, cfg.MaximumSpotlightDistance) end
        if data.radius ~= nil then state.radius = clamp(data.radius, 1.0, cfg.MaximumSpotlightRadius) end
        publish()
        return result(true, 'Spotlight settings updated.')
    end
    return result(false, 'Unknown camera action.')
end

local function targetInfo(entity, position)
    local pos = GetEntityCoords(entity)
    local distance = math.sqrt((pos.x-position.x)^2 + (pos.y-position.y)^2 + (pos.z-position.z)^2)
    if distance > cfg.ScanDistance then return nil end
    local onScreen, x, y = GetScreenCoordFromWorldCoord(pos.x, pos.y, pos.z + 0.5)
    if not onScreen or math.abs(x-0.5) > cfg.ReticleRadius or math.abs(y-0.5) > cfg.ReticleRadius
        or not HasEntityClearLosToEntity(cameraVehicle, entity, 17) then return nil end
    local isPed = IsEntityAPed(entity)
    local jammed = false
    if type(cfg.JammerProvider) == 'function' then
        local ok, value = pcall(cfg.JammerProvider, entity, cameraVehicle)
        jammed = not ok or value == true
    elseif cfg.JammerStateKey then
        local ok, value = pcall(function() return Entity(entity).state[cfg.JammerStateKey] end)
        jammed = ok and value == true
    end
    local masked = false
    if isPed then
        if type(cfg.MaskProvider) == 'function' then
            local ok, value = pcall(cfg.MaskProvider, entity)
            masked = not ok or value == true
        else masked = GetPedDrawableVariation(entity, 1) > 0 end
    end
    local label = isPed and 'Pedestrian' or GetVehicleNumberPlateText(entity)
    if isPed and IsPedAPlayer(entity) then
        label = 'Player'
        if cfg.ShowPlayerNames and not masked and not jammed then
            local player = NetworkGetPlayerIndexFromPed(entity)
            if player ~= -1 then label = GetPlayerName(player) or label end
        end
    end
    if jammed then label = 'SIGNAL JAMMED' elseif masked then label = 'MASKED' end
    return { kind = isPed and 'ped' or 'vehicle', label = tostring(label):sub(1, 60),
        distance = math.floor(distance + 0.5), speed = math.floor(GetEntitySpeed(entity) * 3.6 + 0.5),
        masked = masked, jammed = jammed, score = (x-0.5)^2 + (y-0.5)^2 }
end

local function scanTarget()
    local position = GetCamCoord(camera)
    local best


    for _, poolName in ipairs({ 'CPed', 'CVehicle' }) do
        local pool = GetGamePool(poolName)
        local count = #pool
        local limit = math.min(math.max(1, cfg.ScanCandidates // 2), count)
        for offset = 0, limit - 1 do
            local index = ((cursor[poolName] - 1 + offset) % count) + 1
            local entity = pool[index]
            if entity ~= cameraVehicle and entity ~= PlayerPedId() and DoesEntityExist(entity) then
                local candidate = targetInfo(entity, position)
                if candidate and (not best or candidate.score < best.score) then best = candidate end
            end
        end
        cursor[poolName] = count > 0 and ((cursor[poolName] - 1 + limit) % count) + 1 or 1
    end
    if best then best.score = nil end
    state.target = best or false
end

local function frame()
    local ctx = context()
    if not ctx or ctx.vehicle ~= cameraVehicle then stopCamera(); return end
    if IsDisabledControlJustPressed(0, 177) or IsControlJustPressed(0, 177)
        or IsDisabledControlJustPressed(0, 200) or IsControlJustPressed(0, 200) then stopCamera(); return end
    for _, control in ipairs({ 1, 2, 172, 173, 174, 175, 241, 242, 177, 200 }) do DisableControlAction(0, control, true) end
    local delta = math.min(GetFrameTime(), 0.05) * cfg.PanSpeed * (fov / cfg.MaximumFov)
    if type(GetDisabledControlNormal) == 'function' then
        local zoomScale = fov / cfg.MaximumFov
        yaw = (yaw - GetDisabledControlNormal(0, 1) * cfg.MousePanSpeed * zoomScale) % 360
        pitch = clamp(pitch - GetDisabledControlNormal(0, 2) * cfg.MousePanSpeed * zoomScale, -89.0, 20.0)
    end
    if IsDisabledControlPressed(0, 172) then pitch = clamp(pitch + delta, -89.0, 20.0) end
    if IsDisabledControlPressed(0, 173) then pitch = clamp(pitch - delta, -89.0, 20.0) end
    if IsDisabledControlPressed(0, 174) then yaw = (yaw + delta) % 360 end
    if IsDisabledControlPressed(0, 175) then yaw = (yaw - delta) % 360 end
    if IsDisabledControlJustPressed(0, 241) then fov = clamp(fov - 3.0, cfg.MinimumFov, cfg.MaximumFov) end
    if IsDisabledControlJustPressed(0, 242) then fov = clamp(fov + 3.0, cfg.MinimumFov, cfg.MaximumFov) end
    local pos = GetOffsetFromEntityInWorldCoords(cameraVehicle, 0.0, 1.0, -1.5)
    SetCamCoord(camera, pos.x, pos.y, pos.z)
    SetCamRot(camera, pitch, 0.0, yaw, 2)
    SetCamFov(camera, fov)
    state.zoom = math.floor(cfg.MaximumFov / fov * 10 + 0.5) / 10
    if state.spotlight then
        local p, z = math.rad(pitch), math.rad(yaw)
        DrawSpotLight(pos.x, pos.y, pos.z, -math.sin(z)*math.cos(p), math.cos(z)*math.cos(p), math.sin(p),
            255, 250, 230, state.distance, 5.0, 0.5, state.radius, 1.0)
    end
    local now = GetGameTimer()
    if elapsed(now, lastScan) >= cfg.ScanInterval then lastScan = now; scanTarget() end
    if elapsed(now, lastSend) >= 100 then lastSend = now; publish() end
end

RegisterNUICallback('aerial:action', function(data, cb) cb(aerialAction(data)) end)
VeloxHud.AerialAction = aerialAction
VeloxHud.AerialTelemetry = function(vehicle)
    return { available = cfg.Enabled and vehicle ~= 0 and GetVehicleClass(vehicle) == 15,
        active = state.active, vision = state.vision, spotlight = state.spotlight, zoom = state.zoom }
end
exports('SetAerialCamera', aerialAction)
AddEventHandler('QBCore:Client:OnPlayerUnload', stopCamera)
AddEventHandler('onClientResourceStop', function(resource)
    if resource == GetCurrentResourceName() or resource == Config.CoreResource then stopCamera() end
end)
AddEventHandler('onResourceStop', function(resource) if resource == GetCurrentResourceName() then stopCamera() end end)
CreateThread(function() while true do if state.active then frame(); Wait(0) else Wait(250) end end end)
