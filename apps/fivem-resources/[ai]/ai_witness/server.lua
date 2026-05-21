-- ai_witness/server.lua
-- Server-side: receives witness reports from clients, publishes witness.observed
-- to backend /events. Limits to 3 witnesses per crime to cap AI cost.

-- luacheck: globals exports TriggerClientEvent RegisterNetEvent AddEventHandler
-- luacheck: globals source GetPlayers GetPlayerPed GetEntityCoords GetGameTimer
-- luacheck: globals PerformHttpRequest json math table string os GetConvar
-- luacheck: globals GetCurrentResourceName Citizen

local BACKEND_URL    = GetConvar('BACKEND_URL', 'http://localhost:3001')
local INGEST_TOKEN   = GetConvar('FIVEM_INGEST_TOKEN', '')
local MAX_PER_CRIME  = 3
local CRIME_TTL_MS   = 5 * 60 * 1000  -- 5 min — crimes older than this won't accept new witnesses

-- Track how many witnesses have been submitted per crime, and which NPCs
-- already reported (dedupe). Both expire together via cleanup thread.
local witnessCount   = {}                 -- crimeId -> count
local knownCrimes    = {}                 -- crimeId -> { signalledAt, x, y, z }
local witnessSeen    = {}                 -- crimeId -> { [netId] = true }

local function isValidFloat(v, lo, hi)
  return type(v) == 'number' and v == v and v >= lo and v <= hi
end

--- Deterministic 8-char hash for combining crimeId + netId into a witnessId.
--- Two reports from the same NPC for the same crime produce the same id so
--- the engine can dedupe via Redis NX claim, and the MAX_PER_CRIME cap can't
--- be burnt by repeated reports of one NPC.
local function djb2Hex(s)
  local h = 5381
  for i = 1, #s do
    h = (h * 33 + string.byte(s, i)) & 0xFFFFFFFF
  end
  return string.format('%08x', h)
end

local function buildWitnessId(crimeId, netId)
  return 'npc-' .. djb2Hex(crimeId .. ':' .. tostring(netId))
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

RegisterNetEvent('ai_witness:reportWitness', function(data)
  local playerId = source
  if type(data) ~= 'table'                  then return end
  if type(data.crimeId) ~= 'string'         then return end
  if not isValidFloat(data.quality, 0, 1)   then return end
  if type(data.netId) ~= 'number'           then return end

  -- Reject reports for crimes the server didn't actually signal — stops a
  -- modified client from inventing crimeIds and burning AI budget.
  if not knownCrimes[data.crimeId] then
    print(('[ai_witness] rejected witness from player %d — unknown crimeId=%s'):format(
      playerId, data.crimeId))
    return
  end

  -- Dedupe per NPC per crime (deterministic witnessId would also be caught
  -- downstream, but rejecting here saves an HTTP round-trip and a budget hit).
  witnessSeen[data.crimeId] = witnessSeen[data.crimeId] or {}
  if witnessSeen[data.crimeId][data.netId] then return end

  local count = witnessCount[data.crimeId] or 0
  if count >= MAX_PER_CRIME then return end
  witnessCount[data.crimeId] = count + 1
  witnessSeen[data.crimeId][data.netId] = true

  local factors   = data.factors or {}
  local witnessId = buildWitnessId(data.crimeId, data.netId)
  local eventId   = uuid4()
  local now       = os.date('!%Y-%m-%dT%H:%M:%SZ')

  local payload = {
    id         = eventId,
    type       = 'witness.observed',
    version    = 1,
    occurredAt = now,
    data       = {
      crimeId   = data.crimeId,
      witnessId = witnessId,
      quality   = data.quality,
      factors   = {
        lighting   = tonumber(factors.lighting)   or 0.5,
        distance   = tonumber(factors.distance)   or 10,
        fear       = tonumber(factors.fear)       or 0.3,
        intimidated = (factors.intimidated == true),
        intoxicated = (factors.intoxicated == true),
        relationshipToSuspect = 'stranger',
      },
    },
  }

  local body = json.encode(payload)

  PerformHttpRequest(
    BACKEND_URL .. '/events',
    function(statusCode, responseBody, _headers)
      if statusCode == 201 or statusCode == 200 then
        print(('[ai_witness] published witness.observed crimeId=%s witnessId=%s'):format(
          data.crimeId, witnessId))
      else
        print(('[ai_witness] FAILED witness.observed crimeId=%s witnessId=%s status=%s body=%s'):format(
          data.crimeId, witnessId, tostring(statusCode), tostring(responseBody):sub(1, 120)))
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

-- When crime fires server-side (relayed from robbery/hijack), notify all
-- clients with the crime location so every client samples NPCs around the
-- actual scene. Source==0 guard rejects spoofed NetEvent fires from clients.
RegisterNetEvent('ai_witness:crimePublished', function(crimeId, crimeData)
  if source ~= 0 then
    print(('[ai_witness] rejected ai_witness:crimePublished from client source=%d'):format(source))
    return
  end
  if type(crimeId) ~= 'string' then return end

  crimeData = crimeData or {}
  knownCrimes[crimeId] = {
    signalledAt = GetGameTimer(),
    x = tonumber(crimeData.x),
    y = tonumber(crimeData.y),
    z = tonumber(crimeData.z),
  }

  local fanout = {
    crimeId = crimeId,
    x = knownCrimes[crimeId].x,
    y = knownCrimes[crimeId].y,
    z = knownCrimes[crimeId].z,
  }
  for _, playerId in ipairs(GetPlayers()) do
    TriggerClientEvent('ai_witness:crimeOccurred', tonumber(playerId), fanout)
  end
end)

-- Expire crime tracking after CRIME_TTL_MS so the memo tables don't grow
-- unbounded over a long server session.
AddEventHandler('onResourceStart', function(resourceName)
  if resourceName ~= GetCurrentResourceName() then return end
  Citizen.CreateThread(function()
    while true do
      Citizen.Wait(60000)
      local now = GetGameTimer()
      for crimeId, info in pairs(knownCrimes) do
        if now - info.signalledAt > CRIME_TTL_MS then
          knownCrimes[crimeId] = nil
          witnessCount[crimeId] = nil
          witnessSeen[crimeId] = nil
        end
      end
    end
  end)
end)
