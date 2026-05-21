-- Standard Lua/FiveM globals — suppressed at top of each file
std = "lua54"
globals = {
  -- FiveM natives
  "RegisterNetEvent", "TriggerClientEvent", "TriggerServerEvent",
  "AddEventHandler", "GetPlayerPed", "GetEntityCoords", "GetEntityHeading",
  "PerformHttpRequest", "GetGameTimer", "GetConvar",
  "LocalPlayer", "PlayerPedId", "HasEntityBeenDamagedByWeapon",
  "IsEntityPlayingAnim", "LoadAnimDict", "RemoveAnimDict",
  "RequestAnimDict", "HasAnimDictLoaded", "TaskPlayAnim", "ClearPedTasks",
  "NetworkGetNetworkIdFromEntity", "source",
  "vector3", "json",
  -- ox_lib
  "lib",
  -- qbx_core
  "exports",
  -- Citizen timer
  "Citizen",
}

ignore = {
  "611", -- line length
}
