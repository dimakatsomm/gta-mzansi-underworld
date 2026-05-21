-- robbery/server.lua
-- Server-side: validates holdup request, publishes crime.committed via backend /events.
-- No direct DB writes here — all persistence is event-driven through backend.

-- luacheck: globals exports TriggerClientEvent RegisterNetEvent source GetPlayerPed GetEntityCoords GetGameTimer PerformHttpRequest vector3
-- luacheck: globals GetConvar GetCurrentResourceName json math table string os

local BACKEND_URL      = GetConvar('BACKEND_URL', 'http://localhost:3001')
local INGEST_TOKEN     = GetConvar('FIVEM_INGEST_TOKEN', '')

-- Cooldown per-player to prevent spam (milliseconds)
local HOLDUP_COOLDOWN_MS = 30000
local playerCooldowns    = {}

-- Seed math.random ONCE at resource load. Re-seeding per-call with os.time()
-- caused identical IDs for back-to-back generations within the same second
-- (and inside event handlers `source` here is the caller's id, which is the
-- same for crimeId+eventId produced on the same player tick). Mixing
-- GetGameTimer() in gives sub-second entropy on resource start.
math.randomseed(os.time() + GetGameTimer())
-- Burn a few values to move past correlated initial outputs.
for _ = 1, 8 do math.random() end

--- Generate a UUID v4 string. Relies on math.random being seeded once at load.
--- The trailing 12-hex segment needs 48 bits of entropy; Lua 5.4's math.random
--- supports the full range, but we split into two 24-bit calls so the function
--- also works on runtimes that cap at 2^53.
local function uuid4()
  local lo24 = math.random(0, 0xFFFFFF)
  local hi24 = math.random(0, 0xFFFFFF)
  return string.format(
    '%08x-%04x-4%03x-%04x-%06x%06x',
    math.random(0, 0xFFFFFFFF),
    math.random(0, 0xFFFF),
    math.random(0, 0x0FFF),
    math.random(0x8000, 0xBFFF),
    hi24,
    lo24
  )
end

--- True when v is a finite Lua number (rejects nil, NaN, +/-inf, strings).
local function isFiniteNumber(v)
  return type(v) == 'number' and v == v and v ~= math.huge and v ~= -math.huge
end

--- Check and set player cooldown. Returns true if allowed.
local function checkCooldown(playerId)
  local now = GetGameTimer()
  local last = playerCooldowns[playerId] or 0
  if now - last < HOLDUP_COOLDOWN_MS then
    return false
  end
  playerCooldowns[playerId] = now
  return true
end

--- Server-authoritative store-zone registry. Keys MUST match the `area` field
--- sent from client.lua's STORE_ZONES. Values are the canonical till coords +
--- the max distance (metres) the player may be from those coords when the
--- holdup is triggered. A modified client cannot invent areas or fire
--- robberies from outside a real till — both checks happen server-side here.
local SERVER_STORE_ZONES = {
  yeoville = { coords = vector3(372.3, 328.6, 103.6), radius = 5.0 },
  hillbrow = { coords = vector3(138.0, -1006.4, 29.3), radius = 5.0 },
}

--- Province lookup by in-world area (all GP for Joburg/eGoli analogue)
local AREA_PROVINCE = {
  yeoville    = 'GP',
  hillbrow    = 'GP',
  sandton     = 'GP',
  soweto      = 'GP',
  cbd         = 'GP',
  braamfontein = 'GP',
  default     = 'GP',
}

--- Publish typed crime.committed event to backend
local function publishCrimeEvent(playerId, data)
  local perpetratorId = tostring(playerId)
  local province      = AREA_PROVINCE[data.area] or AREA_PROVINCE.default
  local crimeId       = uuid4()
  local eventId       = uuid4()
  local now           = os.date('!%Y-%m-%dT%H:%M:%SZ')

  local payload = {
    id          = eventId,
    type        = 'crime.committed',
    version     = 1,
    occurredAt  = now,
    actor       = perpetratorId,
    data        = {
      crimeId      = crimeId,
      crimeType    = 'robbery',
      severity     = 'minor',
      perpetrators = { perpetratorId },
      victims      = {},
      location     = {
        x        = data.x,
        y        = data.y,
        z        = data.z,
        province = province,
        area     = data.area,
      },
      witnessed    = false,
      witnessIds   = {},
    },
  }

  local body = json.encode(payload)

  PerformHttpRequest(
    BACKEND_URL .. '/events',
    function(statusCode, _, headers)
      if statusCode == 201 or statusCode == 200 then
        print(('[robbery] published crime.committed crimeId=%s player=%s'):format(crimeId, perpetratorId))
        TriggerClientEvent('robbery:startHoldup', playerId)
      else
        print(('[robbery] /events returned %d for player %s'):format(statusCode, perpetratorId))
      end
    end,
    'POST',
    body,
    {
      ['Content-Type']          = 'application/json',
      ['x-fivem-ingest-token']  = INGEST_TOKEN,
      ['x-source-id']           = perpetratorId,
    }
  )
end

RegisterNetEvent('robbery:requestHoldup', function(data)
  local playerId = source

  -- Basic validation
  if type(data) ~= 'table' then return end
  if type(data.area) ~= 'string' then return end

  -- Coordinate validation BEFORE constructing vector3() so malformed payloads
  -- (nil/strings/NaN) can't throw or bypass the anti-cheat distance check.
  if not (isFiniteNumber(data.x) and isFiniteNumber(data.y) and isFiniteNumber(data.z)) then
    print(('[robbery] rejected player %d — non-numeric coords'):format(playerId))
    return
  end

  -- Server-side area allowlist: only known store zones can ever produce a
  -- crime.committed. A modified client cannot invent a new `area`.
  local zone = SERVER_STORE_ZONES[data.area]
  if not zone then
    print(('[robbery] rejected player %d — unknown area "%s"'):format(playerId, tostring(data.area)))
    return
  end

  -- Cooldown guard
  if not checkCooldown(playerId) then
    TriggerClientEvent('ox_lib:notify', playerId, {
      type    = 'error',
      description = 'Eish, give it a moment before trying again.',
    })
    return
  end

  -- Two distance checks anchored to the server's canonical till coords:
  -- (1) the player ped must be within `radius` metres of the till, and
  -- (2) the coords the client reported must also be within that radius.
  -- Either check failing means the client lied about position or area.
  local ped       = GetPlayerPed(playerId)
  local pedCoords = GetEntityCoords(ped)
  local pedDist   = #(pedCoords - zone.coords)
  if pedDist > zone.radius then
    print(('[robbery] player %d not at %s till (pedDist=%.1f, max=%.1f)'):format(
      playerId, data.area, pedDist, zone.radius))
    return
  end

  local reportedDist = #(vector3(data.x, data.y, data.z) - zone.coords)
  if reportedDist > zone.radius then
    print(('[robbery] player %d reported coords outside %s till (reportedDist=%.1f)'):format(
      playerId, data.area, reportedDist))
    return
  end

  publishCrimeEvent(playerId, data)
end)
