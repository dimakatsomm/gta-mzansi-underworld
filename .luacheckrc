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

  -- Input / controls
  "IsControlJustReleased",
  "IsControlJustPressed",
  "IsControlPressed",
  "DisableControlAction",
  "EnableControlAction",
  "IsDisabledControlJustPressed",
  "IsDisabledControlJustReleased",

  -- Vehicle
  "GetVehiclePedIsIn",
  "GetClosestVehicle",
  "GetGamePool",
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
  "GetClockHours",
  "vector3",
  "vector2",
  "vector4",
  "GetGameTimer",
  "GetFrameTime",
  "GetLastError",
  "IsDuplicityVersion",
  "msgpack",

  -- HTTP / WebSocket / timers
  "PerformHttpRequest",
  "WebsocketConnect",
  "SetTimeout",
  "SetInterval",
  "ClearTimeout",
  "ClearInterval",

  -- Player roster
  "GetPlayers",
  "playerDropped",

  -- LocalPlayer / client globals
  "LocalPlayer",

  -- Convars
  "GetConvar",
  "GetConvarInt",
  "SetConvar",
  "SetConvarReplicated",

  -- Entity / ped extras
  "GetEntityHeading",
  "HasEntityBeenDamagedByWeapon",
  "IsEntityPlayingAnim",
  "LoadAnimDict",
  "RemoveAnimDict",
  "RequestAnimDict",
  "HasAnimDictLoaded",
  "TaskPlayAnim",
  "ClearPedTasks",
  "NetworkRequestControlOfNetworkId",

  -- Sound
  "PlaySoundFrontend",

  -- ox_lib (loaded as shared script — exposes `lib` global)
  "lib",

  -- Allow legacy ESX references (porting period only)
  "ESX",
}

-- fxmanifest.lua files use the FiveM manifest DSL — declarative keys are
-- not Lua globals but luacheck treats them as such. Whitelist the manifest
-- keys for any file named fxmanifest.lua so resource manifests pass cleanly.
files['**/fxmanifest.lua'] = {
  read_globals = {},
  globals = {
    'fx_version',
    'game',
    'games',
    'name',
    'description',
    'author',
    'version',
    'license',
    'repository',
    'lua54',
    'use_experimental_fxv2_oal',
    'shared_script',
    'shared_scripts',
    'client_script',
    'client_scripts',
    'server_script',
    'server_scripts',
    'ui_page',
    'files',
    'file',
    'data_file',
    'dependency',
    'dependencies',
    'provide',
    'export',
    'server_export',
    'before_level_meta',
    'after_level_meta',
    'replace_level_meta',
    'this_is_a_map',
    'loadscreen',
    'loadscreen_cursor',
    'loadscreen_manual_shutdown',
    'convar_category',
  },
}
