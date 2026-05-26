-- mdt/server.lua
-- Server-side: receives dispatch.requested events from ai_dispatch resource,
-- caches incidents for MDT queries, handles case note saves.

-- luacheck: globals exports TriggerClientEvent RegisterNetEvent AddEventHandler
-- luacheck: globals source GetPlayers json math table string os QBX GetConvar
-- luacheck: globals GetCurrentResourceName GetResourceKvpString SetResourceKvp
-- luacheck: globals GetPlayerPed GetEntityCoords PerformHttpRequest GetGameTimer

local BACKEND_URL  = GetConvar('BACKEND_URL', 'http://localhost:3001')
local INGEST_TOKEN = GetConvar('FIVEM_INGEST_TOKEN', '')

math.randomseed(os.time() + GetGameTimer())
for _ = 1, 8 do math.random() end

local function uuid4()
  -- Last group needs 12 hex chars (48 bits). Split into 8+4 to stay within
  -- math.random's integer range and avoid float precision truncation.
  return string.format(
    '%08x-%04x-4%03x-%04x-%08x%04x',
    math.random(0, 0xFFFFFFFF), math.random(0, 0xFFFF),
    math.random(0, 0x0FFF), math.random(0x8000, 0xBFFF),
    math.random(0, 0xFFFFFFFF), math.random(0, 0xFFFF)
  )
end

local function deriveArea(x, y)
  if x > 200 and y > 200   then return 'yeoville', 'GP' end
  if x > 100 and y < 0     then return 'hillbrow', 'GP' end
  if x < -200               then return 'soweto', 'GP'   end
  if x > 400 and y < -500   then return 'sandton', 'GP'  end
  return 'cbd', 'GP'
end

local MAX_INCIDENTS = 50   -- rolling window
local incidents     = {}   -- array of incident objects, newest first

local ALLOWED_SEVERITY = {
  petty = true, minor = true, major = true, serious = true, capital = true,
}

local NOTES_KVP_KEY = 'mdt:notes:v1'

--- Persist the (incidentId -> note) map to FiveM KVP so notes survive a
--- resource/server restart. Volatile incident list still rebuilds from new
--- dispatch.requested events, but operator notes don't vanish on reload.
local function persistNotes()
  local map = {}
  for _, inc in ipairs(incidents) do
    if inc.notes and inc.notes ~= '' then
      map[inc.incidentId] = inc.notes
    end
  end
  SetResourceKvp(NOTES_KVP_KEY, json.encode(map))
end

--- Restore notes from KVP after resource start.
local function restoreNotes()
  local raw = GetResourceKvpString(NOTES_KVP_KEY)
  if not raw then return {} end
  local ok, decoded = pcall(json.decode, raw)
  if not ok or type(decoded) ~= 'table' then return {} end
  return decoded
end

local restoredNotes = restoreNotes()

--- Reject anything but plain ASCII-ish strings of bounded length so a malicious
--- payload can't inject control characters / HTML into the NUI on the client.
local function safeString(value, maxLen)
  if type(value) ~= 'string' then return nil end
  if #value > (maxLen or 200) then return nil end
  if value:find('[<>]') then return nil end
  return value
end

-- Receive dispatched incidents forwarded from ai_dispatch (server-side only).
-- `mdt:newIncident` is a NetEvent purely so cross-resource TriggerEvent works
-- — but `source == 0` ONLY when fired server-side, so we reject anything else
-- to stop a modified client from injecting fake incidents.
RegisterNetEvent('mdt:newIncident', function(payload)
  if source ~= 0 then
    print(('[mdt] rejected mdt:newIncident from client source=%d'):format(source))
    return
  end
  if type(payload) ~= 'table' then return end

  local incidentId = safeString(payload.incidentId, 64)
  if not incidentId then return end

  local severity = payload.severity
  if not ALLOWED_SEVERITY[severity] then severity = 'minor' end

  -- ai_dispatch forwards `evt.data` from dispatch.requested which keeps
  -- location nested. Older internal callers may pass flattened fields.
  local loc = (type(payload.location) == 'table') and payload.location or payload
  local area     = safeString(loc.area, 64)     or 'unknown'
  local province = safeString(loc.province, 8)  or 'GP'
  local summary  = safeString(payload.summary, 1000) or ''
  local voiceUrl = safeString(payload.voiceUrl, 500)

  -- Prepend — newest first
  table.insert(incidents, 1, {
    incidentId = incidentId,
    severity   = severity,
    area       = area,
    province   = province,
    summary    = summary,
    voiceUrl   = voiceUrl,
    timestamp  = os.date('!%Y-%m-%dT%H:%M:%SZ'),
    notes      = restoredNotes[incidentId] or '',
  })

  -- Trim to max window
  while #incidents > MAX_INCIDENTS do
    table.remove(incidents)
  end
end)

-- Client requests the incident list (police-job check enforced client-side too)
RegisterNetEvent('mdt:requestIncidents', function()
  local playerId = source
  TriggerClientEvent('mdt:incidentList', playerId, incidents)
end)

-- Client saves a case note for an incident
RegisterNetEvent('mdt:saveNote', function(incidentId, note)
  local playerId = source
  if type(incidentId) ~= 'string' or type(note) ~= 'string' then return end
  if #note > 1000 then
    TriggerClientEvent('ox_lib:notify', playerId, {
      type = 'error', description = 'Note too long (max 1000 chars)',
    })
    return
  end

  for _, inc in ipairs(incidents) do
    if inc.incidentId == incidentId then
      inc.notes = note
      persistNotes()
      TriggerClientEvent('mdt:noteSaved', playerId, incidentId)
      return
    end
  end
end)

local VALID_CHARGES = {
  hijack=true, robbery=true, assault=true, murder=true,
  drug_deal=true, firearm_trafficking=true, smuggling=true,
  money_laundering=true, corruption_bribe=true,
}

local ARREST_COOLDOWN_MS = 10000  -- 10s between arrests per officer
local arrestLastAt = {}           -- officerId → GetGameTimer()

RegisterNetEvent('mdt:makeArrest', function(data)
  local officerId = source

  local now = GetGameTimer()
  if arrestLastAt[officerId] and (now - arrestLastAt[officerId]) < ARREST_COOLDOWN_MS then
    TriggerClientEvent('mdt:arrestLogged', officerId, false, 'Cooldown — wait before logging another arrest.')
    return
  end

  local player = QBX and QBX.Functions and QBX.Functions.GetPlayer(officerId)
  if not player then
    TriggerClientEvent('mdt:arrestLogged', officerId, false, 'Unable to verify officer identity.')
    return
  end

  local jobName = player.PlayerData and player.PlayerData.job and player.PlayerData.job.name
  if jobName ~= 'police' and jobName ~= 'pps' then
    TriggerClientEvent('mdt:arrestLogged', officerId, false, 'Officers only.')
    return
  end

  if type(data) ~= 'table' then
    TriggerClientEvent('mdt:arrestLogged', officerId, false, 'Invalid arrest payload.')
    return
  end

  local suspectId = tostring(data.suspectServerId or '')
  if not suspectId:match('^%d+$') then
    TriggerClientEvent('mdt:arrestLogged', officerId, false, 'Invalid suspect ID.')
    return
  end
  if suspectId == tostring(officerId) then
    TriggerClientEvent('mdt:arrestLogged', officerId, false, 'Cannot arrest yourself.')
    return
  end

  if type(data.charges) ~= 'table' or #data.charges == 0 then
    TriggerClientEvent('mdt:arrestLogged', officerId, false, 'Select at least one charge.')
    return
  end

  local validatedCharges = {}
  for _, charge in ipairs(data.charges) do
    if VALID_CHARGES[charge] then
      table.insert(validatedCharges, charge)
    end
  end
  if #validatedCharges == 0 then
    TriggerClientEvent('mdt:arrestLogged', officerId, false, 'No valid charges.')
    return
  end

  local ped = GetPlayerPed(officerId)
  if not ped or ped <= 0 then
    TriggerClientEvent('mdt:arrestLogged', officerId, false, 'Could not resolve officer location.')
    return
  end

  local coords = GetEntityCoords(ped)
  if not coords then
    TriggerClientEvent('mdt:arrestLogged', officerId, false, 'Could not resolve officer location.')
    return
  end

  local area, province = deriveArea(coords.x, coords.y)

  local eventId   = uuid4()
  local now       = os.date('!%Y-%m-%dT%H:%M:%SZ')
  local incidentId = safeString(tostring(data.incidentId or ''), 64)

  local payload = {
    id         = eventId,
    type       = 'arrest.made',
    version    = 1,
    occurredAt = now,
    actor      = tostring(officerId),
    data       = {
      suspectId  = suspectId,
      officerId  = tostring(officerId),
      charges    = validatedCharges,
      incidentId = incidentId,
      location   = {
        x        = coords.x,
        y        = coords.y,
        z        = coords.z,
        province = province,
        area     = area,
      },
    },
  }

  arrestLastAt[officerId] = GetGameTimer()

  PerformHttpRequest(
    BACKEND_URL .. '/events',
    function(statusCode, _, _headers)
      local ok = statusCode == 200 or statusCode == 201
      TriggerClientEvent('mdt:arrestLogged', officerId, ok, ok and nil or ('HTTP ' .. tostring(statusCode)))
    end,
    'POST',
    json.encode(payload),
    {
      ['Content-Type']         = 'application/json',
      ['x-fivem-ingest-token'] = INGEST_TOKEN,
      ['x-source-id']          = tostring(officerId),
    }
  )
end)

AddEventHandler('playerDropped', function()
  arrestLastAt[source] = nil
end)
