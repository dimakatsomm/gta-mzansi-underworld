-- pharas/client.lua
-- Spawns ambient phara NPCs in high-criminal-rep areas; drives their behaviour
-- (begging, harassment, mugging, overdose) and subtitle rendering.

-- luacheck: globals lib exports TriggerServerEvent RegisterNetEvent AddEventHandler
-- luacheck: globals PlayerPedId GetEntityCoords Citizen Wait math vector3
-- luacheck: globals CreatePed DeleteEntity SetEntityAsMissionEntity SetPedAsEnemy
-- luacheck: globals TaskWanderStandard TaskGoStraightToCoord IsEntityDead
-- luacheck: globals NetworkGetNetworkIdFromEntity IsPedDeadOrDying
-- luacheck: globals GetClockHours DrawText SetTextScale SetTextFont SetTextColour
-- luacheck: globals SetTextEntry SetTextCentre SetTextOutline AddTextComponentString
-- luacheck: globals DrawText3D N_0x25fbb336 table string math type
-- luacheck: globals GetHashKey RequestModel HasModelLoaded SetModelAsNoLongerNeeded

-- ── Territory clusters ────────────────────────────────────────────────────────

local CLUSTERS = {
  { area = 'hillbrow',        x =  -31.0, y = -1459.0, z =  31.0 },
  { area = 'yeoville',        x =  188.0, y = -1490.0, z =  31.0 },
  { area = 'alexandra',       x = 1265.0, y = -1530.0, z =  34.0 },
  { area = 'soweto_diepkloof', x = -960.0, y = -2150.0, z =  30.0 },
  { area = 'cbd',             x =  -75.0, y = -818.0,  z =  326.0 },
}

local PHARA_MODELS = {
  'a_m_o_tramp_01',
  'a_m_o_tramp_02',
  'a_f_o_tramp_01',
  'a_m_y_methhead_01',
}

-- ── Dialogue ──────────────────────────────────────────────────────────────────

local DIALOGUE = {
  begging = {
    'Aweh, bra... just a few rand, ne? Please, my china.',
    "Eish, I haven't eaten since yesterday. Spare something, mfowethu?",
    'Boss, boss — just two rand for transport, I swear on my mother.',
    'Sisi, please... one cigarette, anything. Please.',
    'Sharp sharp — help a ou out, ne?',
  },
  aggressive = {
    'Voetsek! Give me your phone, NOW.',
    "Empty your pockets, skebenga, before I lose it.",
    "You think I'm scared? I've got nothing to lose. Give it up.",
    "Sharp sharp, let's do this nice and easy. Give me the wallet.",
  },
  incoherent = {
    'The... the skollie said... eish... where is he now...',
    "Haai haai haai... it's too much, too much today...",
    'Sharp... lekker... the kasi is burning, bra...',
    "Voetsek voetsek... they're watching...",
    "Mfowethu... I can't... eish...",
  },
}

-- ── State ─────────────────────────────────────────────────────────────────────

-- pharas[area] = list of { ped, model, dialogue, dialogueTimer }
local pharas = {}
-- targetCount[area] -> desired number of spawned pharas in that cluster
local targetCount = {}
-- activeDialogue[pedNetId] = { lines = [...], idx, until = gameTimerMs }
local activeDialogue = {}
local modelLoadFailures = {}

local SPAWN_RADIUS   = 300.0  -- request density for clusters within this range
local SUBTITLE_RANGE = 6.0    -- show subtitle when player within this range
local SUBTITLE_CYCLE = 8000   -- ms between dialogue line advances
local MODEL_LOAD_TIMEOUT = 5000 -- ms

-- ── Helpers ───────────────────────────────────────────────────────────────────

local function pick(tbl)
  return tbl[math.random(1, #tbl)]
end

local function loadModel(modelName)
  local hash = GetHashKey(modelName)
  RequestModel(hash)
  local t = 0
  while not HasModelLoaded(hash) and t < MODEL_LOAD_TIMEOUT do
    Citizen.Wait(50)
    t = t + 50
  end
  if not HasModelLoaded(hash) then
    if not modelLoadFailures[modelName] then
      modelLoadFailures[modelName] = 1
      print(('[pharas] model load timeout model=%s waited=%dms'):format(modelName, t))
    else
      modelLoadFailures[modelName] = modelLoadFailures[modelName] + 1
    end
  end
  return hash
end

local function getPedNetId(ped)
  local netId = NetworkGetNetworkIdFromEntity(ped)
  if type(netId) ~= 'number' or netId == 0 then
    return nil
  end
  return netId
end

local function reportActivity(entry, activityType, pedPos, extra)
  local netId = getPedNetId(entry.ped)
  if not netId then return end

  local payload = {
    activityType = activityType,
    pharaRef     = tostring(netId),
    area         = entry.area,
    x = pedPos.x, y = pedPos.y, z = pedPos.z,
  }
  if extra then
    for k, v in pairs(extra) do payload[k] = v end
  end
  TriggerServerEvent('pharas:reportActivity', payload)
end

-- ── Spawn / despawn ───────────────────────────────────────────────────────────

local function spawnPhara(cluster)
  local modelName = pick(PHARA_MODELS)
  local hash      = loadModel(modelName)
  if not HasModelLoaded(hash) then return nil end

  local jitter = 8.0
  local x = cluster.x + math.random() * jitter * 2 - jitter
  local y = cluster.y + math.random() * jitter * 2 - jitter
  local z = cluster.z

  local ped = CreatePed(4, hash, x, y, z, math.random(0, 359), true, true)
  SetModelAsNoLongerNeeded(hash)

  if not ped or ped == 0 then return nil end

  SetEntityAsMissionEntity(ped, true, true)
  SetPedAsEnemy(ped, false)
  TaskWanderStandard(ped, 10.0, 10)

  -- Select dialogue category based on model (methhead skews incoherent)
  local dialogueKey = modelName == 'a_m_y_methhead_01' and 'incoherent' or 'begging'

  return {
    ped          = ped,
    model        = modelName,
    dialogueKey  = dialogueKey,
    area         = cluster.area,
  }
end

local function despawnPhara(entry)
  if entry and entry.ped and entry.ped ~= 0 and not IsPedDeadOrDying(entry.ped, true) then
    DeleteEntity(entry.ped)
  end
end

-- ── Density response (from server) ───────────────────────────────────────────

RegisterNetEvent('pharas:densityResponse', function(area, count)
  if type(area) ~= 'string' or type(count) ~= 'number' then return end
  targetCount[area] = math.max(0, math.min(count, 8))
end)

-- ── Drug-deal fanout — pharas walk toward deal coords ─────────────────────────

RegisterNetEvent('pharas:drugDealNearby', function(coords)
  if type(coords) ~= 'table' then return end
  local tx = tonumber(coords.x)
  local ty = tonumber(coords.y)
  local tz = tonumber(coords.z)
  if not tx or not ty or not tz then return end

  for _, list in pairs(pharas) do
    for _, entry in ipairs(list) do
      if entry.ped and entry.ped ~= 0 and not IsPedDeadOrDying(entry.ped, true) then
        local dist = #(GetEntityCoords(entry.ped) - vector3(tx, ty, tz))
        if dist < 200.0 then
          TaskGoStraightToCoord(entry.ped, tx, ty, tz, 1.0, 30000, 0.5, 0)
        end
      end
    end
  end
end)

-- ── Spawn tick (every 30 s) ───────────────────────────────────────────────────

Citizen.CreateThread(function()
  while true do
    Citizen.Wait(30000)
    local playerPos = GetEntityCoords(PlayerPedId())

    for _, cluster in ipairs(CLUSTERS) do
      local dist = #(playerPos - vector3(cluster.x, cluster.y, cluster.z))

      if dist <= SPAWN_RADIUS then
        TriggerServerEvent('pharas:getDensity', cluster.area)

        -- Reconcile alive pharas vs target
        pharas[cluster.area] = pharas[cluster.area] or {}
        local list = pharas[cluster.area]

        -- Prune dead/invalid peds
        local alive = {}
        for _, entry in ipairs(list) do
          if entry.ped and entry.ped ~= 0 and not IsPedDeadOrDying(entry.ped, true) then
            table.insert(alive, entry)
          end
        end
        pharas[cluster.area] = alive

        local target = targetCount[cluster.area] or 1
        local current = #alive

        if current < target then
          for _ = 1, target - current do
            local entry = spawnPhara(cluster)
            if entry then table.insert(pharas[cluster.area], entry) end
          end
        elseif current > target then
          for i = target + 1, current do
            despawnPhara(alive[i])
            alive[i] = nil
          end
        end
      else
        -- Despawn all in this cluster when player moves away
        if pharas[cluster.area] then
          for _, entry in ipairs(pharas[cluster.area]) do
            despawnPhara(entry)
          end
          pharas[cluster.area] = {}
        end
      end
    end
  end
end)

-- ── Behaviour tick (every 5 s) ────────────────────────────────────────────────

Citizen.CreateThread(function()
  while true do
    Citizen.Wait(5000)
    local playerPed = PlayerPedId()
    local playerPos = GetEntityCoords(playerPed)

    for _, list in pairs(pharas) do
      for _, entry in ipairs(list) do
        if not entry.ped or entry.ped == 0 then goto continue end
        if IsPedDeadOrDying(entry.ped, true) then goto continue end

        local pedPos = GetEntityCoords(entry.ped)
        local dist   = #(playerPos - pedPos)

        -- Overdose roll (2% per tick ≈ once per ~250 s on average)
        if math.random() < 0.02 then
          entry.dialogueKey = 'incoherent'
          reportActivity(entry, 'overdose', pedPos)
        end

        -- Harassment roll when player within 15 m (8% per tick)
        if dist < 15.0 and math.random() < 0.08 then
          entry.dialogueKey = 'aggressive'
          reportActivity(entry, 'harassment', pedPos)
        end

        -- Mugging trigger when player within 2 m
        if dist < 2.0 then
          entry.dialogueKey = 'aggressive'
          reportActivity(entry, 'mugging', pedPos, {
            victimNetId = NetworkGetNetworkIdFromEntity(playerPed),
          })
        end

        ::continue::
      end
    end
  end
end)

-- ── Subtitle render (every frame) ─────────────────────────────────────────────

Citizen.CreateThread(function()
  while true do
    Citizen.Wait(0)
    local playerPos = GetEntityCoords(PlayerPedId())
    local now       = GetGameTimer()

    for _, list in pairs(pharas) do
      for _, entry in ipairs(list) do
        if not entry.ped or entry.ped == 0 then goto continue end
        if IsPedDeadOrDying(entry.ped, true) then goto continue end

        local pedPos = GetEntityCoords(entry.ped)
        local dist   = #(playerPos - pedPos)

        if dist < SUBTITLE_RANGE then
          local netId = NetworkGetNetworkIdFromEntity(entry.ped)
          if not netId or netId == 0 then
            netId = entry.ped
          end
          local ad    = activeDialogue[netId]

          -- Initialise or advance dialogue line
          if not ad or now > ad.until_ then
            local lines = DIALOGUE[entry.dialogueKey] or DIALOGUE.begging
            local idx   = ad and (ad.idx % #lines) + 1 or math.random(1, #lines)
            activeDialogue[netId] = {
              lines  = lines,
              idx    = idx,
              until_ = now + SUBTITLE_CYCLE,
            }
            ad = activeDialogue[netId]
          end

          lib.drawText3d(
            vector3(pedPos.x, pedPos.y, pedPos.z + 1.15),
            ad.lines[ad.idx],
            { font = 4, scale = 0.35, colour = { 255, 220, 120, 220 } }
          )
        else
          local netId = NetworkGetNetworkIdFromEntity(entry.ped)
          if not netId or netId == 0 then
            netId = entry.ped
          end
          activeDialogue[netId] = nil
        end

        ::continue::
      end
    end
  end
end)
