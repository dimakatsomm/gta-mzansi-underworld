-- robbery/server.lua
-- Server-side: validates holdup request, publishes crime.committed via backend /events.
-- No direct DB writes here — all persistence is event-driven through backend.

-- luacheck: globals exports TriggerClientEvent source GetPlayerPed GetEntityCoords
-- luacheck: globals GetConvar math table string os

local BACKEND_URL      = GetConvar('BACKEND_URL', 'http://localhost:3001')
local INGEST_TOKEN     = GetConvar('FIVEM_INGEST_TOKEN', '')

-- Cooldown per-player to prevent spam (milliseconds)
local HOLDUP_COOLDOWN_MS = 30000
local playerCooldowns    = {}

--- Generate a UUID v4-ish string (no crypto lib in Lua runtime, use math.random seeded by os.time)
local function uuid4()
  math.randomseed(os.time() + source * 1000)
  return string.format(
    '%08x-%04x-4%03x-%04x-%012x',
    math.random(0, 0xFFFFFFFF),
    math.random(0, 0xFFFF),
    math.random(0, 0x0FFF),
    math.random(0x8000, 0xBFFF),
    math.random(0, 0xFFFFFFFF)
  )
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

  -- Cooldown guard
  if not checkCooldown(playerId) then
    TriggerClientEvent('ox_lib:notify', playerId, {
      type    = 'error',
      description = 'Eish, give it a moment before trying again.',
    })
    return
  end

  -- Confirm player is on foot and in approximate range (anti-cheat lite)
  local ped    = GetPlayerPed(playerId)
  local coords = GetEntityCoords(ped)
  local dist   = #(coords - vector3(data.x, data.y, data.z))
  if dist > 10.0 then
    print(('[robbery] player %d coords mismatch (dist=%.1f) — possible cheat'):format(playerId, dist))
    return
  end

  publishCrimeEvent(playerId, data)
end)
