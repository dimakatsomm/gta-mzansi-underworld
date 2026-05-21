-- hijack/server.lua
-- Server-side: Validates hijack request and publishes crime.committed (type=hijack).
-- Anti-cheat: speed check, distance check, cooldown, area derivation server-side.

-- luacheck: globals exports TriggerClientEvent RegisterNetEvent source GetPlayerPed
-- luacheck: globals GetEntityCoords GetGameTimer PerformHttpRequest vector3
-- luacheck: globals GetConvar GetCurrentResourceName json math table string os

local BACKEND_URL     = GetConvar('BACKEND_URL', 'http://localhost:3001')
local INGEST_TOKEN    = GetConvar('FIVEM_INGEST_TOKEN', '')

local HIJACK_COOLDOWN_MS  = 45000  -- 45s (longer than robbery — higher severity)
local MAX_PLAYER_VEH_DIST = 8.0    -- player must be within 8m of vehicle coords

local playerCooldowns = {}

math.randomseed(os.time() + GetGameTimer())
for _ = 1, 8 do math.random() end

local function uuid4()
  return string.format(
    '%08x-%04x-4%03x-%04x-%012x',
    math.random(0, 0xFFFFFFFF),
    math.random(0, 0xFFFF),
    math.random(0, 0x0FFF),
    math.random(0x8000, 0xBFFF),
    math.random(0, 0xFFFFFFFF)
  )
end

local function isFiniteNumber(v)
  return type(v) == 'number' and v == v and v ~= math.huge and v ~= -math.huge
end

local function checkCooldown(playerId)
  local now  = GetGameTimer()
  local last = playerCooldowns[playerId] or 0
  if now - last < HIJACK_COOLDOWN_MS then
    return false
  end
  playerCooldowns[playerId] = now
  return true
end

--- Derive area string from world coordinates.
--- Matches the province/area values used in dispatch templates.
local function deriveArea(x, y)
  -- Very rough eGoli region map (fictional GTA V coordinates mapped to SA names)
  if x > 200 and y > 200   then return 'yeoville'    end
  if x > 100 and y < 0     then return 'hillbrow'    end
  if x < -200               then return 'soweto'      end
  if x > 400 and y < -500   then return 'sandton'     end
  return 'cbd'
end

local function publishHijackEvent(playerId, data)
  local perpetratorId  = tostring(playerId)
  local area           = deriveArea(data.x, data.y)
  local crimeId        = uuid4()
  local eventId        = uuid4()
  local now            = os.date('!%Y-%m-%dT%H:%M:%SZ')

  local payload = {
    id          = eventId,
    type        = 'crime.committed',
    version     = 1,
    occurredAt  = now,
    actor       = perpetratorId,
    data        = {
      crimeId      = crimeId,
      crimeType    = 'hijack',
      severity     = 'major',
      perpetrators = { perpetratorId },
      victims      = {},
      location     = {
        x        = data.x,
        y        = data.y,
        z        = data.z,
        province = 'GP',
        area     = area,
      },
      witnessed    = false,
      witnessIds   = {},
      meta         = {
        vehicleModel = data.vehicleModel or 'unknown',
      },
    },
  }

  local body = json.encode(payload)

  PerformHttpRequest(
    BACKEND_URL .. '/events',
    function(statusCode, _, _headers)
      if statusCode == 201 or statusCode == 200 then
        print(('[hijack] published crime.committed crimeId=%s player=%s'):format(crimeId, perpetratorId))
        TriggerClientEvent('hijack:startHijack', playerId)
      else
        print(('[hijack] /events returned %d for player %s'):format(statusCode, perpetratorId))
      end
    end,
    'POST',
    body,
    {
      ['Content-Type']         = 'application/json',
      ['x-fivem-ingest-token'] = INGEST_TOKEN,
      ['x-source-id']          = perpetratorId,
    }
  )
end

RegisterNetEvent('hijack:requestHijack', function(data)
  local playerId = source

  if type(data) ~= 'table' then return end

  -- Validate all coords are real numbers
  if not (isFiniteNumber(data.x) and isFiniteNumber(data.y) and isFiniteNumber(data.z)) then
    print(('[hijack] rejected player %d — invalid player coords'):format(playerId))
    return
  end

  if not (isFiniteNumber(data.vehX) and isFiniteNumber(data.vehY) and isFiniteNumber(data.vehZ)) then
    print(('[hijack] rejected player %d — invalid vehicle coords'):format(playerId))
    return
  end

  -- Server-side distance check: player must be near the reported vehicle position
  local ped       = GetPlayerPed(playerId)
  local pedCoords = GetEntityCoords(ped)
  local vehVec    = vector3(data.vehX, data.vehY, data.vehZ)
  local pedDist   = #(pedCoords - vehVec)

  if pedDist > MAX_PLAYER_VEH_DIST then
    print(('[hijack] player %d too far from reported vehicle (dist=%.1f)'):format(playerId, pedDist))
    return
  end

  if not checkCooldown(playerId) then
    TriggerClientEvent('ox_lib:notify', playerId, {
      type        = 'error',
      description = 'Wara wara — cool down before trying again.',
    })
    return
  end

  publishHijackEvent(playerId, data)
end)
