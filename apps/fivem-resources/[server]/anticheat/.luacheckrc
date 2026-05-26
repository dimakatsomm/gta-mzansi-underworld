std = "lua54"
globals = {
    -- server
    "RegisterNetEvent", "AddEventHandler", "DropPlayer", "GetPlayerName",
    "GetGameTimer", "source", "print", "json", "math", "type",
    "Citizen",
    -- client
    "TriggerServerEvent", "PlayerPedId", "GetEntityCoords", "GetEntityHealth",
}

max_line_length = 120

ignore = { "611" }
