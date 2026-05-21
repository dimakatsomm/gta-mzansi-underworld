-- hijack/client.lua
-- Client-side: Detects the player approaching/entering a vehicle and triggers a hijack.
-- Monitors for slow-moving or parked vehicles within interaction range.
-- All crime logic is server-authoritative; client only collects context.

-- luacheck: globals exports lib TriggerServerEvent GetEntityCoords GetEntityHeading
-- luacheck: globals LocalPlayer PlayerPedId GetVehiclePedIsIn GetEntitySpeed
-- luacheck: globals GetEntityModel GetDisplayNameFromVehicleModel IsThisModelACar
-- luacheck: globals Citizen Wait vector3 IsPedInAnyVehicle IsPedSittingInAnyVehicle

local inRangeVehicle = nil  -- nearest eligible vehicle entity handle
local DETECT_RANGE   = 5.0  -- metres

-- Poll every 500 ms for a nearby hijackable vehicle
Citizen.CreateThread(function()
  while true do
    Wait(500)
    local ped = PlayerPedId()

    -- Don't offer hijack when already driving
    if IsPedInAnyVehicle(ped, false) then
      if inRangeVehicle then
        lib.hideTextUI()
        inRangeVehicle = nil
      end
      goto continue
    end

    local playerCoords = GetEntityCoords(ped)
    local nearestVeh   = nil
    local nearestDist  = DETECT_RANGE + 1

    -- Iterate nearby vehicles; GetGamePool is QBox-available
    local vehs = GetGamePool and GetGamePool('CVehicle') or {}
    for _, veh in ipairs(vehs) do
      if IsThisModelACar(GetEntityModel(veh)) then
        local vehCoords = GetEntityCoords(veh)
        local dist      = #(playerCoords - vehCoords)
        local speed     = GetEntitySpeed(veh)
        -- Only hijackable when vehicle is slow (stopped/near-stop, ≤ 5 km/h)
        if dist < nearestDist and speed < 1.5 then
          nearestDist = dist
          nearestVeh  = veh
        end
      end
    end

    if nearestVeh then
      if inRangeVehicle ~= nearestVeh then
        inRangeVehicle = nearestVeh
        -- Show ox_lib keybind hint
        lib.showTextUI('[G] Hijack vehicle', { position = 'bottom-center', icon = 'car' })
      end
    elseif inRangeVehicle then
      lib.hideTextUI()
      inRangeVehicle = nil
    end

    ::continue::
  end
end)

-- ox_lib keybind — triggers hijack request
lib.addKeybind({
  name        = 'hijack_vehicle',
  description = 'Hijack a nearby vehicle',
  defaultKey  = 'G',
  onPressed   = function()
    if not inRangeVehicle then return end

    local ped     = PlayerPedId()
    local coords  = GetEntityCoords(ped)
    local heading = GetEntityHeading(ped)
    local model   = GetEntityModel(inRangeVehicle)
    local vehName = GetDisplayNameFromVehicleModel(model) or 'unknown'
    local vehCoords = GetEntityCoords(inRangeVehicle)

    TriggerServerEvent('hijack:requestHijack', {
      x           = coords.x,
      y           = coords.y,
      z           = coords.z,
      heading     = heading,
      vehicleModel = vehName,
      vehX        = vehCoords.x,
      vehY        = vehCoords.y,
      vehZ        = vehCoords.z,
    })
  end,
})

-- Feedback animation when server approves
RegisterNetEvent('hijack:startHijack', function()
  local ped = PlayerPedId()
  -- Brief struggle animation
  local animDict = 'melee@large_wpn@streamed_core'
  local animClip = 'ground_attack_0'
  lib.requestAnimDict(animDict)
  TaskPlayAnim(ped, animDict, animClip, 2.0, -1.0, 1500, 16, 0, false, false, false)
  Citizen.Wait(1500)
  ClearPedTasks(ped)
end)
