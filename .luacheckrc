-- .luacheckrc — luacheck config for FiveM / QBox resources
-- https://luacheck.readthedocs.io/en/stable/config.html

std = "lua54"
max_line_length = false
unused_args = false

-- Globals defined by the FiveM runtime and QBox framework.
-- Declare here so luacheck does not report them as undefined globals.
read_globals = {
  -- FiveM citizens / threads
  "Citizen",
  "Wait",
  "CreateThread",
  "CreateResourceThread",

  -- Event system
  "RegisterNetEvent",
  "AddEventHandler",
  "TriggerEvent",
  "TriggerNetEvent",
  "TriggerServerEvent",
  "TriggerClientEvent",
  "TriggerLatentClientEvent",
  "RemoveEventHandler",

  -- Commands
  "RegisterCommand",
  "ExecuteCommand",

  -- Resources / exports
  "GetCurrentResourceName",
  "GetResourceState",
  "GetNumResources",
  "exports",

  -- QBox core
  "QBCore",

  -- NUI / UI
  "RegisterNUICallback",
  "SendNUIMessage",
  "SetNuiFocus",
  "SetNuiFocusKeepInput",

  -- Networking
  "NetworkGetNetworkIdFromEntity",
  "NetworkGetEntityFromNetworkId",
  "GetPlayerServerId",
  "GetPlayerFromServerId",
  "NetworkIsPlayerActive",

  -- Ped / Player
  "PlayerPedId",
  "GetPlayerPed",
  "GetPlayerName",
  "IsPlayerDead",

  -- Entity helpers
  "GetEntityCoords",
  "SetEntityCoords",
  "DoesEntityExist",
  "DeleteEntity",
  "GetEntityModel",
  "GetEntityHealth",
  "SetEntityHealth",

  -- Vehicle
  "GetVehiclePedIsIn",
  "GetClosestVehicle",
  "SetVehicleEngineOn",
  "SetVehicleDirtLevel",

  -- Blips / markers
  "AddBlipForCoord",
  "AddBlipForEntity",
  "SetBlipSprite",
  "SetBlipColour",
  "SetBlipScale",
  "SetBlipAsShortRange",
  "BeginTextCommandSetBlipName",
  "EndTextCommandSetBlipName",
  "AddTextComponentString",
  "RemoveBlip",

  -- Notifications / text UI
  "SetNotificationTextEntry",
  "DrawNotification",
  "BeginTextCommandDisplayHelp",
  "EndTextCommandDisplayHelp",

  -- Scaleform / draw
  "RequestScaleformMovie",
  "HasScaleformMovieLoaded",
  "DrawScaleformMovieFullscreen",
  "CallScaleformMovieMethod",
  "PushScaleformMovieFunction",
  "PopScaleformMovieFunctionVoid",
  "BeginTextCommandScaleformString",
  "AddTextComponentSubstringPlayerName",
  "EndTextCommandScaleformString",

  -- Misc runtime
  "json",
  "vector3",
  "vector2",
  "vector4",
  "GetGameTimer",
  "GetFrameTime",
  "GetLastError",
  "IsDuplicityVersion",
  "msgpack",

  -- Allow legacy ESX references (porting period only)
  "ESX",
}
