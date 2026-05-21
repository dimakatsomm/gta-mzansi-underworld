-- ai_witness/client.lua
-- Detects nearby pedestrian NPCs when a crime fires on this client.
-- Evaluates observation quality (lighting, distance, fear, intoxication proxy)
-- and sends witness data to server for the backend witness.observed event.

-- luacheck: globals exports lib TriggerServerEvent RegisterNetEvent AddEventHandler
-- luacheck: globals GetPedNearbyPeds PlayerPedId GetEntityCoords GetGameplayCamCoords
-- luacheck: globals GetEntityHeading IsPedInAnyVehicle IsPedDeadOrDying
-- luacheck: globals GetNightVision IsHelpMessageBeingDisplayed NetworkGetNetworkIdFromEntity
-- luacheck: globals NetworkIsEntityNetworkIdValid Citizen Wait math

local MAX_WITNESSES  = 3     -- cap to avoid spam
local DETECT_RADIUS  = 25.0  -- metres — NPCs within this range may witness

--- Estimate scene lighting (0-1) from time of day.
--- 0 = pitch dark, 1 = bright midday.
local function estimateLighting()
  local h = GetClockHours and GetClockHours() or 12
  if h >= 8 and h < 18 then
    return 0.9
  elseif (h >= 6 and h < 8) or (h >= 18 and h < 20) then
    return 0.55
  else
    return 0.2
  end
end

--- Sample nearby peds (NPCs only) within radius.
local function sampleNearbyNpcs(playerPed, radius)
  local playerPos = GetEntityCoords(playerPed)
  local results   = {}

  -- GetPedNearbyPeds returns up to 30 nearby peds
  local nearby = GetPedNearbyPeds(playerPed, 30, 0)
  if not nearby then return results end

  for i = 0, #nearby - 1 do
    local ped = nearby[i]
    if ped and ped ~= 0 and not IsPedDeadOrDying(ped, true) and not IsPedInAnyVehicle(ped, false) then
      local pedPos = GetEntityCoords(ped)
      local dist   = #(playerPos - pedPos)
      if dist <= radius then
        table.insert(results, { ped = ped, dist = dist })
      end
    end
    if #results >= MAX_WITNESSES then break end
  end

  return results
end

--- Build quality factors for a given witness NPC.
local function buildFactors(witnessData, lighting)
  return {
    lighting    = lighting,
    distance    = witnessData.dist,
    fear        = math.random(10, 90) / 100,   -- randomised: NPC emotional state proxy
    intimidated = witnessData.dist < 5.0,      -- very close = more intimidated
    intoxicated = math.random() < 0.08,        -- 8% chance of intoxicated NPC
    relationship = 'stranger',
  }
end

--- Called when a crime.committed event is confirmed by server
RegisterNetEvent('ai_witness:crimeOccurred', function(crimeId)
  local playerPed = PlayerPedId()
  local lighting  = estimateLighting()
  local witnesses = sampleNearbyNpcs(playerPed, DETECT_RADIUS)

  for _, w in ipairs(witnesses) do
    local factors = buildFactors(w, lighting)
    local quality = (
      factors.lighting * 0.3 +
      (1 - math.min(w.dist / DETECT_RADIUS, 1)) * 0.4 +
      (1 - factors.fear) * 0.2 +
      (factors.intoxicated and 0 or 0.1)
    )

    TriggerServerEvent('ai_witness:reportWitness', {
      crimeId    = crimeId,
      quality    = quality,
      factors    = factors,
    })
  end
end)
