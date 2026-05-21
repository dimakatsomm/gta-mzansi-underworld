-- ai_dispatch/client.lua
-- Client-side: renders NUI dispatch card and plays synthesized voice audio.
-- Listens for ai_dispatch:showIncident from server.
-- /dispatch command toggles mute for non-police job players.

-- luacheck: globals RegisterNetEvent AddEventHandler RegisterCommand SendNUIMessage PlaySoundFrontend NetworkRequestControlOfNetworkId NetworkGetNetworkIdFromEntity
-- luacheck: globals exports lib TriggerServerEvent source LocalPlayer PlayerPedId GetPlayerPed

local nuiVisible = false
local isMuted    = false

-- Show or hide the NUI frame
local function setNuiVisible(visible)
  nuiVisible = visible
  SendNUIMessage({ action = 'setVisible', visible = visible })
end

-- Severity → colour mapping (SA police colour codes, lore-bible §tone)
local SEVERITY_COLORS = {
  petty   = '#6c757d',  -- grey
  minor   = '#ffc107',  -- amber
  major   = '#fd7e14',  -- orange
  serious = '#dc3545',  -- red
  capital = '#6f0000',  -- dark red
}

RegisterNetEvent('ai_dispatch:showIncident', function(data)
  if isMuted then return end

  local severity = data and data.severity or 'minor'
  local color    = SEVERITY_COLORS[severity] or SEVERITY_COLORS.minor
  local area     = (data and data.location and data.location.area) or 'Unknown area'
  local summary  = (data and data.summary) or 'Incident reported.'
  local voiceUrl = (data and data.voiceUrl)

  -- Push data to NUI
  SendNUIMessage({
    action   = 'showIncident',
    severity = severity,
    color    = color,
    area     = area,
    summary  = summary,
    voiceUrl = voiceUrl,
  })

  setNuiVisible(true)

  -- Auto-hide after 12 seconds
  SetTimeout(12000, function()
    setNuiVisible(false)
  end)

  -- Play police radio tone (FiveM built-in sound)
  PlaySoundFrontend(-1, 'SCANNING_POLICE', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true)
end)

-- /dispatch toggle mute (police job only — server enforces job check via event)
RegisterCommand('dispatch', function()
  isMuted = not isMuted
  lib.notify({
    type        = isMuted and 'inform' or 'success',
    description = isMuted and 'Dispatch chatter muted.' or 'Dispatch chatter enabled.',
  })
  if isMuted then
    setNuiVisible(false)
  end
end, false)

-- NUI callbacks
RegisterNUICallback('close', function(_, cb)
  setNuiVisible(false)
  cb('ok')
end)
