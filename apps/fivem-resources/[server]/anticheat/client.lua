-- anticheat/client.lua
-- Reports player position and health to server every 2 seconds for server-side anomaly detection.

-- luacheck: globals TriggerServerEvent PlayerPedId GetEntityCoords GetEntityHealth Citizen

local REPORT_INTERVAL_MS = 2000

Citizen.CreateThread(function()
    while true do
        Citizen.Wait(REPORT_INTERVAL_MS)

        local ped    = PlayerPedId()
        local coords = GetEntityCoords(ped)
        local health = GetEntityHealth(ped)

        TriggerServerEvent('anticheat:report', {
            x      = coords.x,
            y      = coords.y,
            z      = coords.z,
            health = health,
        })
    end
end)
