-- ai_witness/server.lua
-- Server-side: receives witness reports from clients, publishes witness.observed
-- to backend /events. Limits to 3 witnesses per crime to cap AI cost.

-- luacheck: globals exports TriggerClientEvent RegisterNetEvent AddEventHandler
-- luacheck: globals source GetPlayers GetPlayerPed GetEntityCoords GetGameTimer
-- luacheck: globals PerformHttpRequest json math table string os GetConvar

local BACKEND_URL    = GetConvar('BACKEND_URL', 'http://localhost:3001')
local INGEST_TOKEN   = GetConvar('FIVEM_INGEST_TOKEN', '')
local MAX_PER_CRIME  = 3

-- Track how many witnesses have been submitted per crime
local witnessCount = {}

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

local function isValidFloat(v, lo, hi)
  return type(v) == 'number' and v == v and v >= lo and v <= hi
end

RegisterNetEvent('ai_witness:reportWitness', function(data)
  if type(data) ~= 'table'             then return end
  if type(data.crimeId) ~= 'string'    then return end
  if not isValidFloat(data.quality, 0, 1) then return end

  local count = witnessCount[data.crimeId] or 0
  if count >= MAX_PER_CRIME then return end
  witnessCount[data.crimeId] = count + 1

  local factors = data.factors or {}
  local witnessId = 'npc-' .. uuid4()
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
    function(statusCode, _, _headers)
      if statusCode == 201 or statusCode == 200 then
        print(('[ai_witness] published witness.observed crimeId=%s witnessId=%s'):format(
          data.crimeId, witnessId))
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

-- When crime fires server-side (relayed from robbery/hijack), notify all clients
RegisterNetEvent('ai_witness:crimePublished', function(crimeId)
  for _, playerId in ipairs(GetPlayers()) do
    TriggerClientEvent('ai_witness:crimeOccurred', tonumber(playerId), crimeId)
  end
end)

-- Auto-expire witness counts after 2 minutes
AddEventHandler('onResourceStart', function(resourceName)
  if resourceName ~= GetCurrentResourceName() then return end
  Citizen.CreateThread(function()
    while true do
      Citizen.Wait(120000)
      -- Clear all counts — crimes older than 2 minutes won't accumulate more witnesses
      witnessCount = {}
    end
  end)
end)
