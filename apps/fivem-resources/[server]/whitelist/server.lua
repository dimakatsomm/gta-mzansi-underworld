-- whitelist/server.lua
-- KVP-backed connection whitelist. Operators seed via `whitelist add <id>`.
-- Other resources can call exports.whitelist.isWhitelisted(id).

-- luacheck: globals AddEventHandler RegisterNetEvent TriggerClientEvent RegisterCommand
-- luacheck: globals GetPlayerIdentifiers GetNumPlayerIdentifiers GetResourceKvpString
-- luacheck: globals SetResourceKvp IsPlayerAceAllowed exports json print source

local KVP_KEY = 'whitelist:v1'

-- Placeholder entry — operators MUST replace with their own steam/license IDs.
local DEFAULT_LIST = { 'license:0000000000000000000000000000000000000000' }

local whitelist = {}   -- set: identifier string → true

-- Ring buffer of recent rejected connection attempts so operators can review
-- and whitelist applicants quickly via `whitelist pending` / `add-pending`.
local PENDING_MAX = 20
local pending = {}     -- array of { name, license, ts }

local function pushPending(name, license)
    -- Skip if this license is already in the buffer (avoid duplicates from reconnects)
    for _, entry in ipairs(pending) do
        if entry.license == license then return end
    end
    table.insert(pending, 1, { name = name, license = license, ts = os.date('!%Y-%m-%dT%H:%M:%SZ') })
    while #pending > PENDING_MAX do
        table.remove(pending)
    end
end

--- Persist current whitelist to KVP.
local function saveWhitelist()
    local ids = {}
    for id in pairs(whitelist) do
        ids[#ids + 1] = id
    end
    SetResourceKvp(KVP_KEY, json.encode(ids))
end

--- Load whitelist from KVP; seed defaults when no KVP entry exists yet.
local function loadWhitelist()
    local raw = GetResourceKvpString(KVP_KEY)
    if raw and raw ~= '' then
        local ok, decoded = pcall(json.decode, raw)
        if ok and type(decoded) == 'table' then
            for _, id in ipairs(decoded) do
                whitelist[id] = true
            end
            print(('[whitelist] loaded %d identifier(s) from KVP'):format(#decoded))
            return
        end
        print('[whitelist] KVP data corrupt — re-seeding defaults')
    end
    for _, id in ipairs(DEFAULT_LIST) do
        whitelist[id] = true
    end
    saveWhitelist()
    print('[whitelist] seeded default whitelist; replace placeholder IDs before going live')
end

--- Extract the license: identifier for a connected player.
local function getLicenseId(playerId)
    for i = 0, GetNumPlayerIdentifiers(playerId) - 1 do
        local id = GetPlayerIdentifiers(playerId)[i + 1]
        if id and id:sub(1, 8) == 'license:' then
            return id
        end
    end
    return nil
end

--- @param identifier string  e.g. "license:abc123..."
--- @return boolean
local function isWhitelisted(identifier)
    return whitelist[identifier] == true
end

--- True when the calling source is console (0) or has the whitelist ace.
local function hasAdminAccess(src)
    if src == 0 then return true end
    return IsPlayerAceAllowed(tostring(src), 'command.whitelist')
end

loadWhitelist()

AddEventHandler('playerConnecting', function(playerName, setKickReason, deferrals)
    local src = source
    deferrals.defer()
    -- Give FiveM a tick to populate identifiers.
    Citizen.Wait(0)

    local licId = getLicenseId(src)
    if not licId then
        deferrals.done('Haai! Could not read your license identifier. Try restarting FiveM.')
        return
    end

    print(('[whitelist] CONNECT_ATTEMPT name="%s" license=%s'):format(playerName, licId))

    if not isWhitelisted(licId) then
        pushPending(playerName, licId)
        deferrals.done(
            'You are not whitelisted on Mzansi Underworld RP. Apply at discord.gg/mzansi'
        )
        return
    end

    deferrals.done()
end)

RegisterCommand('whitelist', function(src, args)
    if not hasAdminAccess(src) then
        if src ~= 0 then
            TriggerClientEvent('chat:addMessage', src, {
                args = { '^1[whitelist]', 'Haai — you do not have permission to use this command.' },
            })
        end
        return
    end

    local subCmd    = args[1]
    local identifier = args[2]

    if subCmd == 'add' then
        if not identifier or identifier == '' then
            print('[whitelist] Usage: whitelist add <identifier>')
            return
        end
        whitelist[identifier] = true
        saveWhitelist()
        print(('[whitelist] added: %s'):format(identifier))

    elseif subCmd == 'remove' then
        if not identifier or identifier == '' then
            print('[whitelist] Usage: whitelist remove <identifier>')
            return
        end
        if not whitelist[identifier] then
            print(('[whitelist] not found: %s'):format(identifier))
            return
        end
        whitelist[identifier] = nil
        saveWhitelist()
        print(('[whitelist] removed: %s'):format(identifier))

    elseif subCmd == 'list' then
        local ids = {}
        for id in pairs(whitelist) do
            ids[#ids + 1] = id
        end
        table.sort(ids)
        print(('[whitelist] %d entry/entries:'):format(#ids))
        for _, id in ipairs(ids) do
            print('  ' .. id)
        end

    elseif subCmd == 'pending' then
        if #pending == 0 then
            print('[whitelist] no pending connection attempts')
            return
        end
        print(('[whitelist] %d pending attempt(s) (newest first):'):format(#pending))
        for i, entry in ipairs(pending) do
            print(('  %d. %s  name="%s"  ts=%s'):format(i, entry.license, entry.name, entry.ts))
            print(('     → whitelist add %s'):format(entry.license))
        end

    elseif subCmd == 'add-pending' then
        local n = tonumber(identifier)
        if not n or n < 1 or n > #pending then
            print(('[whitelist] Usage: whitelist add-pending <n>  (n between 1 and %d)'):format(#pending))
            return
        end
        local entry = pending[n]
        whitelist[entry.license] = true
        saveWhitelist()
        table.remove(pending, n)
        print(('[whitelist] added from pending: %s (was "%s")'):format(entry.license, entry.name))

    else
        print('[whitelist] Subcommands: add <id> | remove <id> | list | pending | add-pending <n>')
    end
end, true)

exports('isWhitelisted', isWhitelisted)
