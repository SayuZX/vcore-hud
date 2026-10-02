

local cooldowns = { gain = {}, relief = {} }

local function finiteNumber(value)
    return type(value) == 'number' and value == value and value ~= math.huge and value ~= -math.huge
end

local function playerSource(value)
    local id = tonumber(value)
    if finiteNumber(id) and id > 0 and id == math.floor(id) then return id end
end

local function getPlayer(id)
    if not id or Config.Framework ~= 'qb' then return end
    local resource = Config.CoreResource or 'qb-core'
    if GetResourceState(resource) ~= 'started' then return end

    local ok, player = pcall(function()
        local core = exports[resource]:GetCoreObject()
        if type(core) ~= 'table' or type(core.Functions) ~= 'table' then return end
        return core.Functions.GetPlayer(id)
    end)
    if ok and type(player) == 'table' and not player.Offline and type(player.PlayerData) == 'table'
        and playerSource(player.PlayerData.source) == id then
        return player
    end
end

local function saveStress(player, value)

    local setter = type(player.Functions) == 'table' and player.Functions.SetMetaData
    local ok, result
    if setter then
        ok, result = pcall(setter, 'stress', value)
    elseif player.SetMetaData then

        ok, result = pcall(player.SetMetaData, player, 'stress', value)
    end
    return ok and result ~= false
end

local function updateStress(rawSource, amount, direction)
    local settings = Config.Stress
    if Config.Framework ~= 'qb' or type(settings) ~= 'table' or settings.Mode ~= 'internal' then return end
    if not finiteNumber(amount) or amount <= 0 then return end
    local maximum = finiteNumber(settings.MaxEventAmount) and settings.MaxEventAmount or 100
    if amount > maximum then return end
    amount = math.floor(amount)
    if amount == 0 then return end

    local id = playerSource(rawSource)
    if not id then return end
    local previous = cooldowns[direction][id]
    local duration = direction == 'gain' and settings.GainCooldown or settings.ReliefCooldown
    duration = finiteNumber(duration) and math.max(0, duration) or 1000
    local now = GetGameTimer()

    if previous and ((now - previous) % 4294967296) < duration then return end

    local player = getPlayer(id)
    if not player then return end
    local data = player.PlayerData
    if type(data.metadata) ~= 'table' then return end
    if direction == 'gain' then
        local job = type(data.job) == 'table' and data.job or {}
        local whitelist = type(settings.WhitelistedJobs) == 'table' and settings.WhitelistedJobs or {}
        if whitelist[job.name] or whitelist[job.type] then return end
    end

    local current = finiteNumber(data.metadata.stress) and data.metadata.stress or 0
    current = math.min(100, math.max(0, current))
    local delta = direction == 'gain' and amount or -amount
    local value = math.min(100, math.max(0, current + delta))
    if not saveStress(player, value) then return end
    cooldowns[direction][id] = now
    TriggerClientEvent('hud:client:UpdateStress', id, value)
end

RegisterNetEvent('hud:server:GainStress', function(amount)
    updateStress(source, amount, 'gain')
end)

RegisterNetEvent('hud:server:RelieveStress', function(amount)
    updateStress(source, amount, 'relief')
end)

local function clearCooldowns(id)
    id = playerSource(id)
    if not id then return end
    cooldowns.gain[id] = nil
    cooldowns.relief[id] = nil
end

AddEventHandler('playerDropped', function()
    clearCooldowns(source)
end)


AddEventHandler('QBCore:Server:OnPlayerUnload', function(id)
    clearCooldowns(id)
end)

local function formatMoney(value)
    local digits = string.format('%.0f', math.floor(math.abs(value)))
    local grouped = digits:reverse():gsub('(%d%d%d)', '%1,'):reverse():gsub('^,', '')
    return (value < 0 and '-$' or '$') .. grouped
end

local function showAccount(rawSource, account)
    if not Config.AccountCommands then return end
    local id = playerSource(rawSource)
    local player = getPlayer(id)
    if not player then return end
    local money = player.PlayerData.money
    local balance = type(money) == 'table' and money[account]
    if not finiteNumber(balance) then return end
    local label = account == 'cash' and 'Cash' or 'Bank'
    TriggerClientEvent('QBCore:Notify', id, label .. ': ' .. formatMoney(balance), 'primary', 5000)
end


if Config.Framework == 'qb' and Config.AccountCommands then
    RegisterCommand('cash', function(source)
        showAccount(source, 'cash')
    end, false)
    RegisterCommand('bank', function(source)
        showAccount(source, 'bank')
    end, false)
end
