-- anticheat/server.lua
-- Receives position+health reports from clients and applies teleport / godmode checks.
-- All enforcement is server-side; the client report is the only untrusted input.

-- luacheck: globals RegisterNetEvent AddEventHandler DropPlayer GetPlayerName
-- luacheck: globals GetGameTimer source print json math type Citizen

local TELEPORT_THRESHOLD = 500.0   -- metres between consecutive 2s reports → kick
local MAX_HEALTH         = 201     -- FiveM health ceiling is 200; anything above is godmode
local REPORT_TIMEOUT_MS  = 10000   -- ms without a report before we consider the client dead

local playerData = {}
-- playerData[playerId] = { x, y, z, lastReportAt }

local KICK_MSG = "Eish! You've been removed for suspicious activity."

local function kickPlayer(playerId, reason)
    print(('[anticheat] kicking player %s (%s) — %s'):format(
        tostring(playerId), GetPlayerName(playerId) or '?', reason
    ))
    DropPlayer(playerId, KICK_MSG)
end

--- Euclidean distance² (avoid sqrt when only comparing to a threshold²).
local function distSq(ax, ay, az, bx, by, bz)
    local dx = ax - bx
    local dy = ay - by
    local dz = az - bz
    return dx * dx + dy * dy + dz * dz
end

local function isFiniteNumber(v)
    return type(v) == 'number' and v == v and v ~= math.huge and v ~= -math.huge
end

RegisterNetEvent('anticheat:report', function(data)
    local playerId = source

    if type(data) ~= 'table' then return end
    if not (isFiniteNumber(data.x) and isFiniteNumber(data.y) and isFiniteNumber(data.z)) then
        return
    end
    if not isFiniteNumber(data.health) then return end

    local now = GetGameTimer()

    -- Godmode check: FiveM health is 0–200; above 200 is only possible via trainer/mod.
    if data.health > MAX_HEALTH then
        kickPlayer(playerId, ('godmode detected (reported health=%.0f)'):format(data.health))
        playerData[playerId] = nil
        return
    end

    local prev = playerData[playerId]
    if prev then
        local elapsed = now - prev.lastReportAt

        -- Teleport check: compare distance to threshold scaled by elapsed time.
        -- We use (TELEPORT_THRESHOLD * elapsedFactor)² so a slow machine that
        -- fires the report event slightly late doesn't get false-flagged.
        local elapsedFactor = math.max(1.0, elapsed / 2000.0)
        local threshold     = TELEPORT_THRESHOLD * elapsedFactor
        local sq            = distSq(data.x, data.y, data.z, prev.x, prev.y, prev.z)

        if sq > threshold * threshold then
            kickPlayer(playerId, ('teleport detected (delta=%.1fm, threshold=%.1fm)'):format(
                math.sqrt(sq), threshold
            ))
            playerData[playerId] = nil
            return
        end
    end

    playerData[playerId] = { x = data.x, y = data.y, z = data.z, lastReportAt = now }
end)

-- Watchdog: players who stop reporting (suspended process / exploit) get kicked.
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(REPORT_TIMEOUT_MS)
        local now = GetGameTimer()
        for playerId, pd in pairs(playerData) do
            if now - pd.lastReportAt > REPORT_TIMEOUT_MS then
                kickPlayer(playerId, 'report timeout (client stopped sending)')
                playerData[playerId] = nil
            end
        end
    end
end)

-- Enrol every connecting player so the watchdog can kick those who never send
-- a report (e.g. a modified client that skips running client.lua).
AddEventHandler('playerConnecting', function(_, _, deferrals)
    deferrals.defer()
    Citizen.Wait(0)
    local playerId = source
    playerData[playerId] = { x = 0, y = 0, z = 0, lastReportAt = GetGameTimer() }
    deferrals.done()
end)

AddEventHandler('playerDropped', function()
    playerData[source] = nil
end)
