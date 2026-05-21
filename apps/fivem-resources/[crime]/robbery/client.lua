-- robbery/client.lua
-- Client-side: Detects player at convenience store till zone and starts holdup sequence.
-- All gameplay logic is server-authoritative; client only collects contextual data.

-- luacheck: globals exports lib TriggerServerEvent NetworkGetNetworkIdFromEntity GetEntityCoords GetEntityHeading LocalPlayer PlayerPedId GetPlayerPed HasEntityBeenDamagedByWeapon IsEntityPlayingAnim LoadAnimDict RemoveAnimDict RequestAnimDict HasAnimDictLoaded TaskPlayAnim ClearPedTasks
-- luacheck: globals vector3 Citizen Wait

-- Convenience store till interaction zones (fictional eGoli locations, lore-bible §1)
local STORE_ZONES = {
  {
    name  = 'yeoville_corner_shop',
    label = 'Yeoville Corner Shop',
    coords = vector3(372.3, 328.6, 103.6),
    area   = 'yeoville',
  },
  {
    name  = 'hillbrow_spaza',
    label = 'Hillbrow Spaza',
    coords = vector3(138.0, -1006.4, 29.3),
    area   = 'hillbrow',
  },
}

local activeZone = nil

-- Register ox_lib interaction zones for each store
for _, store in ipairs(STORE_ZONES) do
  lib.zones.box({
    coords  = store.coords,
    size    = vector3(3.5, 3.5, 2.0),
    rotation = 0,
    debug   = false,
    onEnter = function()
      activeZone = store
    end,
    onExit = function()
      activeZone = nil
    end,
  })
end

-- Holdup animation dict
local ANIM_DICT = 'random@mugging3'
local ANIM_CLIP = 'handsup_standing_base'

RegisterNetEvent('robbery:startHoldup', function()
  local ped = PlayerPedId()

  -- Play hands-up if nearby pedestrian is the "cashier" prop
  RequestAnimDict(ANIM_DICT)
  while not HasAnimDictLoaded(ANIM_DICT) do
    Wait(50)
  end
  TaskPlayAnim(ped, ANIM_DICT, ANIM_CLIP, 1.0, -1.0, 3000, 49, 0, false, false, false)
  Citizen.Wait(3000)
  ClearPedTasks(ped)
  RemoveAnimDict(ANIM_DICT)
end)

-- ox_lib keybind to trigger holdup when in zone
lib.addKeybind({
  name        = 'robbery_holdup',
  description = 'Hold up the cashier',
  defaultKey  = 'G',
  onPressed   = function()
    if not activeZone then return end

    local ped    = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local heading = GetEntityHeading(ped)

    TriggerServerEvent('robbery:requestHoldup', {
      zone    = activeZone.name,
      area    = activeZone.area,
      x       = coords.x,
      y       = coords.y,
      z       = coords.z,
      heading = heading,
    })
  end,
})
