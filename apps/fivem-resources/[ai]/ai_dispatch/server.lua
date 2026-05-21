-- ai_dispatch/server.lua
-- Server-side: WebSocket bridge to backend.
-- Connects to backend /ws/fivem, receives dispatch.requested events,
-- and fires TriggerClientEvent to all police-job players.

-- luacheck: globals exports TriggerClientEvent GetPlayers GetPlayerPed source
-- luacheck: globals GetConvar print json QBX

local BACKEND_URL   = GetConvar('BACKEND_URL', 'http://localhost:3001')
local INGEST_TOKEN  = GetConvar('FIVEM_INGEST_TOKEN', '')

-- Convert http/https base URL to ws/wss
local function toWsUrl(url)
  return (url:gsub('^http', 'ws')) .. '/ws/fivem'
end

local WS_URL = toWsUrl(BACKEND_URL)

-- Set of server IDs of players currently on police job
local policeOnDuty = {}

-- Track job changes
AddEventHandler('QBCore:Server:OnPlayerLoaded', function()
  -- Re-evaluate on load
end)

-- Receive job update from qbx_core
RegisterNetEvent('QBCore:Server:SetJob', function(_, job)
  local playerId = source
  if job and (job.name == 'police' or job.name == 'pps') then
    policeOnDuty[playerId] = true
  else
    policeOnDuty[playerId] = nil
  end
end)

AddEventHandler('playerDropped', function()
  policeOnDuty[source] = nil
end)

--- Broadcast a dispatch event to all police-job players
local function broadcastDispatch(payload)
  for playerId, _ in pairs(policeOnDuty) do
    TriggerClientEvent('ai_dispatch:showIncident', playerId, payload)
  end

  -- Also broadcast to all players if no police on duty (solo testing)
  local hasPolice = next(policeOnDuty) ~= nil
  if not hasPolice then
    for _, playerId in ipairs(GetPlayers()) do
      TriggerClientEvent('ai_dispatch:showIncident', tonumber(playerId), payload)
    end
  end
end

-- WebSocket connection to backend.
-- `currentWsId` is kept (not just logged) so future code can `WebsocketClose(currentWsId)`
-- on graceful shutdown without restructuring this module.
local currentWsId = nil  -- luacheck: ignore
local reconnectDelay = 2000

local function connectWs()
  print(('[ai_dispatch] connecting to backend WS: %s'):format(WS_URL))
  WebsocketConnect(
    WS_URL,
    {
      ['Authorization'] = 'Bearer ' .. INGEST_TOKEN,
    },
    function(id)  -- onOpen
      currentWsId = id
      reconnectDelay = 2000
      print(('[ai_dispatch] WS connected id=%d'):format(id))
    end,
    function(id, data)  -- onMessage
      local ok, evt = pcall(json.decode, data)
      if not ok or type(evt) ~= 'table' then return end
      if evt.type == 'dispatch.requested' then
        broadcastDispatch(evt.data)
      end
    end,
    function(id, code, reason)  -- onClose
      currentWsId = nil
      print(('[ai_dispatch] WS closed id=%d code=%d reason=%s — reconnecting in %dms'):format(
        id, code, reason or '', reconnectDelay))
      -- Exponential back-off (max 30 s)
      SetTimeout(reconnectDelay, connectWs)
      reconnectDelay = math.min(reconnectDelay * 2, 30000)
    end,
    function(id, err)  -- onError
      print(('[ai_dispatch] WS error id=%d: %s'):format(id, err or 'unknown'))
    end
  )
end

-- Connect after a short startup delay to allow server convar resolution
SetTimeout(3000, connectWs)
