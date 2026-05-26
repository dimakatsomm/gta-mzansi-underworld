-- luacheck: globals AddEventHandler RegisterNetEvent TriggerClientEvent RegisterCommand
-- luacheck: globals GetPlayerIdentifiers GetNumPlayerIdentifiers GetResourceKvpString
-- luacheck: globals SetResourceKvp IsPlayerAceAllowed exports json

std = "lua54"
globals = {
    "AddEventHandler", "RegisterNetEvent", "TriggerClientEvent", "RegisterCommand",
    "GetPlayerIdentifiers", "GetNumPlayerIdentifiers", "GetResourceKvpString",
    "SetResourceKvp", "IsPlayerAceAllowed",
    "exports", "json", "source", "print",
    "Citizen",
}

max_line_length = 120

ignore = { "611" }
