-- pharas/server.lua
-- Density query, activity event publish, and drug-deal fanout for ambient pharas.

-- luacheck: globals exports TriggerClientEvent RegisterNetEvent AddEventHandler
-- luacheck: globals source GetPlayers GetGameTimer GetEntityCoords
-- luacheck: globals PerformHttpRequest json math table string os GetConvar
-- luacheck: globals GetCurrentResourceName Citizen NetworkGetEntityFromNetworkId

local BACKEND_URL  = GetConvar('BACKEND_URL', 'http://localhost:3001')
local INGEST_TOKEN = GetConvar('FIVEM_INGEST_TOKEN', '')

-- Cooldown tracking: pharaRef -> { lastReport = gameTimerMs }
local activityCooldowns = {}
local COOLDOWN_MS       = 15 * 1000  -- 15 s per pharaRef

local ALLOWED_TYPES = {
  mugging          = true,
  overdose         = true,
  harassment       = true,
  dealing_proximity = true,
}

-- ── Helpers ──────────────────────────────────────────────────────────────────

local function isFiniteNumber(v)
  return type(v) == 'number' and v == v and v ~= math.huge and v ~= -math.huge
end

local function uuid4()
  return string.format(
    '%08x-%04x-4%03x-%04x-%06x%06x',
    math.random(0, 0xFFFFFFFF),
    math.random(0, 0xFFFF),
    math.random(0, 0x0FFF),
    math.random(0x8000, 0xBFFF),
    math.random(0, 0xFFFFFF),
    math.random(0, 0xFFFFFF)
  )
end

math.randomseed(os.time() + GetGameTimer())
for _ = 1, 8 do math.random() end

-- Convert a 0–100 criminal rep score to a spawn count.
-- Baseline: 1. +1 per 6.25 criminal rep, cap 8.
local function repToCount(criminalScore)
  local base  = 1
  local extra = math.floor((criminalScore or 0) / 6.25)
  return math.min(base + extra, 8)
end

-- ── Density query ─────────────────────────────────────────────────────────────

RegisterNetEvent('pharas:getDensity', function(area)
  local playerId = source
  if type(area) ~= 'string' or #area == 0 then return end

  local url = BACKEND_URL .. '/reputation?area=' .. area .. '&axis=criminal'

  PerformHttpRequest(url, function(statusCode, body, _)
    local score = 0
    if statusCode == 200 and body then
      local ok, decoded = pcall(json.decode, body)
      if ok and decoded and isFiniteNumber(decoded.score) then
        score = decoded.score
      end
    end
    TriggerClientEvent('pharas:densityResponse', playerId, area, repToCount(score))
  end, 'GET', '', { ['x-fivem-ingest-token'] = INGEST_TOKEN })
end)

-- ── Activity report ───────────────────────────────────────────────────────────

RegisterNetEvent('pharas:reportActivity', function(data)
  local playerId = source
  if type(data) ~= 'table'                          then return end
  if type(data.activityType) ~= 'string'            then return end
  if not ALLOWED_TYPES[data.activityType]           then return end
  if type(data.pharaRef) ~= 'string' or #data.pharaRef == 0 then return end
  if not isFiniteNumber(data.x)                     then return end
  if not isFiniteNumber(data.y)                     then return end
  if not isFiniteNumber(data.z)                     then return end
  if type(data.area) ~= 'string' or #data.area == 0 then return end

  -- Per-pharaRef cooldown
  local now = GetGameTimer()
  local last = activityCooldowns[data.pharaRef]
  if last and (now - last) < COOLDOWN_MS then return end
  activityCooldowns[data.pharaRef] = now

  -- Resolve optional victim from net ID
  local victimId = nil
  if type(data.victimNetId) == 'number' and data.victimNetId > 0 then
    local victimEnt = NetworkGetEntityFromNetworkId(data.victimNetId)
    if victimEnt and victimEnt ~= 0 then
      victimId = tostring(data.victimNetId)
    end
  end

  local eventId  = uuid4()
  local actId    = uuid4()
  local now_str  = os.date('!%Y-%m-%dT%H:%M:%SZ')

  local payload = {
    id         = eventId,
    type       = 'phara.activity',
    version    = 1,
    occurredAt = now_str,
    data       = {
      activityId   = actId,
      activityType = data.activityType,
      pharaRef     = data.pharaRef,
      location     = { area = data.area, x = data.x, y = data.y, z = data.z },
      victimId     = victimId,
    },
  }

  local body = json.encode(payload)

  PerformHttpRequest(
    BACKEND_URL .. '/events',
    function(statusCode, _, _headers)
      if statusCode == 200 or statusCode == 201 then
        print(('[pharas] published phara.activity type=%s pharaRef=%s area=%s'):format(
          data.activityType, data.pharaRef, data.area))
      else
        print(('[pharas] POST /events failed status=%s type=%s'):format(
          tostring(statusCode), data.activityType))
      end
    end,
    'POST',
    body,
    {
      ['Content-Type']         = 'application/json',
      ['x-fivem-ingest-token'] = INGEST_TOKEN,
    }
  )
end)

-- ── Drug-deal fanout ──────────────────────────────────────────────────────────
-- When ai_witness signals a crime, forward deal coords to pharas clients so
-- nearby pharas can walk toward the scene.

RegisterNetEvent('ai_witness:crimePublished', function(crimeId, crimeData)
  if source ~= 0 then return end  -- server-side only
  if type(crimeData) ~= 'table'  then return end
  if not isFiniteNumber(crimeData.x) then return end

  local fanout = { x = crimeData.x, y = crimeData.y, z = crimeData.z }
  for _, pid in ipairs(GetPlayers()) do
    TriggerClientEvent('pharas:drugDealNearby', tonumber(pid), fanout)
  end
end)

-- ── Cleanup thread ────────────────────────────────────────────────────────────
-- Sweep stale cooldown entries every 5 minutes to prevent unbounded table growth.

AddEventHandler('onResourceStart', function(resourceName)
  if resourceName ~= GetCurrentResourceName() then return end
  Citizen.CreateThread(function()
    while true do
      Citizen.Wait(5 * 60 * 1000)
      local cutoff = GetGameTimer() - COOLDOWN_MS
      for ref, ts in pairs(activityCooldowns) do
        if ts < cutoff then activityCooldowns[ref] = nil end
      end
    end
  end)
end)
