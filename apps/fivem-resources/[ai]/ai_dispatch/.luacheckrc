std = "lua54"
globals = {
  -- FiveM natives
  "RegisterNetEvent", "AddEventHandler", "TriggerClientEvent", "TriggerServerEvent",
  "RegisterCommand", "RegisterNUICallback", "SendNUIMessage", "SetNuiFocus",
  "PlaySoundFrontend", "GetPlayers", "GetPlayerPed", "GetEntityCoords",
  "SetTimeout", "WebsocketConnect", "GetConvar", "source", "math",
  -- ox_lib
  "lib",
  -- qbx_core
  "exports", "QBX",
  -- JSON
  "json",
}

ignore = {
  "611",
}
