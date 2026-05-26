-- mdt/client.lua
-- Client-side: MDT NUI controller.
-- Opens the MDT on /mdt command for police-job players.
-- Fetches the incident list, supports case notes, and replays dispatch audio.

-- luacheck: globals exports lib TriggerServerEvent TriggerNetEvent RegisterNetEvent
-- luacheck: globals AddEventHandler SetNuiFocus SendNUIMessage RegisterNUICallback
-- luacheck: globals Citizen Wait QBX LocalPlayer

local mdtOpen = false

local function isPoliceJob()
  -- QBX exposes the local player job via the shared object
  local player = QBX and QBX.Functions and QBX.Functions.GetPlayerData()
  if player and player.job then
    local name = player.job.name
    return name == 'police' or name == 'pps'
  end
  return false
end

local function openMdt()
  if mdtOpen then return end
  if not isPoliceJob() then
    lib.notify({ type = 'error', description = 'Haai, this terminal is for officers only.' })
    return
  end

  mdtOpen = true
  SetNuiFocus(true, true)
  SendNUIMessage({ action = 'open' })

  -- Request fresh incident list from server
  TriggerServerEvent('mdt:requestIncidents')
end

local function closeMdt()
  if not mdtOpen then return end
  mdtOpen = false
  SetNuiFocus(false, false)
  SendNUIMessage({ action = 'close' })
end

-- /mdt command
lib.addCommand('mdt', {
  help = 'Open the Mobile Data Terminal (police only)',
}, function()
  openMdt()
end)

-- NUI callbacks
RegisterNUICallback('close', function(_, cb)
  closeMdt()
  cb({ ok = true })
end)

RegisterNUICallback('saveNote', function(data, cb)
  if type(data.incidentId) == 'string' and type(data.note) == 'string' then
    TriggerServerEvent('mdt:saveNote', data.incidentId, data.note)
  end
  cb({ ok = true })
end)

RegisterNUICallback('replayAudio', function(data, cb)
  -- Audio replay is handled in NUI via the voiceUrl; nothing to do server-side
  cb({ ok = true })
end)

RegisterNUICallback('makeArrest', function(data, cb)
  if type(data.suspectServerId) ~= 'string' and type(data.suspectServerId) ~= 'number' then
    cb({ ok = false })
    return
  end
  if type(data.charges) ~= 'table' or #data.charges == 0 then
    cb({ ok = false })
    return
  end
  TriggerServerEvent('mdt:makeArrest', {
    suspectServerId = tostring(data.suspectServerId),
    charges         = data.charges,
    incidentId      = data.incidentId,
  })
  cb({ ok = true })
end)

-- Server → client events
RegisterNetEvent('mdt:incidentList', function(list)
  SendNUIMessage({ action = 'incidentList', incidents = list })
end)

RegisterNetEvent('mdt:noteSaved', function(incidentId)
  SendNUIMessage({ action = 'noteSaved', incidentId = incidentId })
end)

RegisterNetEvent('mdt:arrestLogged', function(ok, errorMsg)
  SendNUIMessage({ action = 'arrestLogged', ok = ok, error = errorMsg })
end)

-- Live push: ai_dispatch triggers this when a new incident arrives
RegisterNetEvent('ai_dispatch:showIncident', function(payload)
  if not mdtOpen then return end
  -- Forward new incident to MDT NUI if it's already open
  TriggerServerEvent('mdt:requestIncidents')
end)

-- Close MDT on ESC / toggle
Citizen.CreateThread(function()
  while true do
    Wait(0)
    if mdtOpen and IsControlJustReleased(0, 200) then  -- 200 = ESC
      closeMdt()
    end
  end
end)
