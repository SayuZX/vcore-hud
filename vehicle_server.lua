
local leases, requests, busy, generations = {}, {}, {}, {}
local function finite(value)
    return type(value)=='number' and value==value and value~=math.huge and value~=-math.huge
end
local function integer(value,maximum) return finite(value) and value%1==0 and value>0 and value<=maximum end
local function elapsed(now,before) return (now-before) % 4294967296 end
local function reply(id,request,network,duration,message)
    TriggerClientEvent('velox-hud:client:nitroReply',id,request,network,duration,message)
end
local function corePlayer(id)
    if Config.Framework~='qb' or GetResourceState(Config.CoreResource)~='started' then return nil end
    local ok,player=pcall(function()
        local core=exports[Config.CoreResource]:GetCoreObject()
        return core.Functions.GetPlayer(id)
    end)
    if not ok or type(player)~='table' or type(player.PlayerData)~='table'
        or tonumber(player.PlayerData.source)~=id or type(player.PlayerData.citizenid)~='string' then return nil end
    local metadata=player.PlayerData.metadata or {}
    if metadata.isdead==true or metadata.inlaststand==true then return nil end
    return player
end
local function authorized(id,vehicle,plate)
    if not Config.Nitro.RequireKeys then return true end
    if type(Config.Nitro.KeyProvider)=='function' then
        local ok,allowed=pcall(Config.Nitro.KeyProvider,id,vehicle,plate)
        return ok and allowed==true
    end
    local resource=Config.Nitro.KeyResource
    if type(resource)~='string' or GetResourceState(resource)~='started' then return false end
    local ok,allowed=pcall(function() return exports[resource]:HasKeys(id,plate) end)
    return ok and allowed==true
end
local function consume(id,player)
    local itemName=Config.Nitro.Item
    if type(itemName)~='string' or #itemName>64 or not itemName:match('^[%w_-]+$') then return false end
    if type(Config.Nitro.ConsumeItem)=='function' then
        local ok,removed=pcall(Config.Nitro.ConsumeItem,id,itemName)
        return ok and removed==true
    end
    local resource=Config.Nitro.InventoryResource
    if resource~=nil then
        if type(resource)~='string' or GetResourceState(resource)~='started' then return false end
        local ok,item=pcall(function() return exports[resource]:GetItemByName(id,itemName) end)
        if not ok or type(item)~='table' or item.name~=itemName or not finite(item.amount) or item.amount<1
            or not integer(tonumber(item.slot),10000) then return false end

        local slot=tonumber(item.slot)
        local verified,stored=pcall(function() return exports[resource]:GetItemBySlot(id,slot) end)
        if not verified or type(stored)~='table' or stored.name~=itemName or not finite(stored.amount) or stored.amount<1 then return false end
        local removed,result=pcall(function() return exports[resource]:RemoveItem(id,itemName,1,slot,'velox-hud:nitro') end)
        return removed and result==true
    end

    local functions=player.Functions
    if type(functions)~='table' or type(functions.GetItemByName)~='function' or type(functions.RemoveItem)~='function' then return false end
    local ok,item=pcall(functions.GetItemByName,itemName)
    if not ok or type(item)~='table' or item.name~=itemName or not finite(item.amount) or item.amount<1
        or not integer(tonumber(item.slot),10000) then return false end
    local removed,result=pcall(functions.RemoveItem,itemName,1,tonumber(item.slot),'velox-hud:nitro')
    return removed and result==true
end
local function requestNitro(id,request,network)
    if not integer(id,65535) or not integer(request,2147483647) or not integer(network,2147483647) then return end
    if not Config.Nitro.Enabled then reply(id,request,network,0,'Nitro is disabled.'); return end
    local now=GetGameTimer()
    if busy[id] or requests[id] and elapsed(now,requests[id])<1000 then
        reply(id,request,network,0,'Please wait before requesting nitro.'); return
    end
    requests[id]=now
    local duration=finite(Config.Nitro.Duration) and math.floor(math.min(30000,math.max(1000,Config.Nitro.Duration))) or 5000
    local cooldown=finite(Config.Nitro.Cooldown) and math.min(120000,math.max(duration+1000,Config.Nitro.Cooldown)) or duration+2000
    if leases[id] and elapsed(now,leases[id].time)<cooldown then
        reply(id,request,network,0,'That nitro canister is still active or cooling down.'); return
    end
    local player=corePlayer(id)
    if not player then reply(id,request,network,0,'An active QBCore character is required.'); return end
    local ped=GetPlayerPed(id)
    local vehicle=NetworkGetEntityFromNetworkId(network)
    if ped==0 or vehicle==0 or not DoesEntityExist(ped) or not DoesEntityExist(vehicle)
        or GetEntityType(vehicle)~=2 or GetVehiclePedIsIn(ped,false)~=vehicle
        or GetPedInVehicleSeat(vehicle,-1)~=ped then
        reply(id,request,network,0,'Only the current vehicle driver can use nitro.'); return
    end
    local vehicleType=GetVehicleType(vehicle)
    if vehicleType~='automobile' and vehicleType~='bike' and vehicleType~='quadbike' then
        reply(id,request,network,0,'Nitro requires a road vehicle.'); return
    end
    local plate=(GetVehicleNumberPlateText(vehicle) or ''):match('^%s*(.-)%s*$')

    local generation=generations[id] or 0
    local reservation={generation=generation}
    busy[id]=reservation
    local allowed=authorized(id,vehicle,plate)
    if (generations[id] or 0)~=generation then
        if busy[id]==reservation then busy[id]=nil end
        return
    end
    if not allowed then
        if busy[id]==reservation then busy[id]=nil end
        reply(id,request,network,0,'The server vehicle keys provider refused nitro.'); return
    end
    if GetPlayerPed(id)~=ped or not DoesEntityExist(vehicle)
        or GetVehiclePedIsIn(ped,false)~=vehicle or GetPedInVehicleSeat(vehicle,-1)~=ped then
        if busy[id]==reservation then busy[id]=nil end
        reply(id,request,network,0,'Nitro canceled because the driver changed.'); return
    end
    local consumed=consume(id,player)
    if busy[id]==reservation then busy[id]=nil end
    if (generations[id] or 0)~=generation then return end
    if not consumed then reply(id,request,network,0,'A configured nitro canister is required.'); return end

    local current=corePlayer(id)
    if not current or current.PlayerData.citizenid~=player.PlayerData.citizenid
        or GetPlayerPed(id)~=ped or not DoesEntityExist(vehicle)
        or GetVehiclePedIsIn(ped,false)~=vehicle or GetPedInVehicleSeat(vehicle,-1)~=ped then
        reply(id,request,network,0,'Nitro canceled because the driver changed.'); return
    end
    leases[id]={time=GetGameTimer(),vehicle=vehicle}
    reply(id,request,network,duration,'Nitro authorized.')
end
RegisterNetEvent('velox-hud:server:nitroRequest',function(request,network)
    local id=tonumber(source)
    local ok=pcall(requestNitro,id,request,network)
    if not ok then
        if integer(id or 0,65535) then busy[id]=nil end
        if integer(id or 0,65535) and integer(request,2147483647) and integer(network,2147483647) then
            reply(id,request,network,0,'Nitro integration failed; check the configured adapters.')
        end
    end
end)
local function clear(id)
    id=tonumber(id)
    if not id then return end
    generations[id]=(generations[id] or 0)+1
    leases[id],requests[id],busy[id]=nil,nil,nil
end
AddEventHandler('playerDropped',function() clear(source) end)
AddEventHandler('QBCore:Server:OnPlayerUnload',function(id) clear(id or source) end)
AddEventHandler('onResourceStop',function(resource)
    if resource==Config.CoreResource or resource==Config.Nitro.InventoryResource or resource==Config.Nitro.KeyResource then
        for id in pairs(leases) do TriggerClientEvent('velox-hud:client:nitroReset',id) end
        for id in pairs(busy) do generations[id]=(generations[id] or 0)+1 end
        leases,requests,busy={},{},{}
    end
end)
