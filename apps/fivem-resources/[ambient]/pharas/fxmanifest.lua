fx_version 'cerulean'
game 'gta5'

name        'pharas'
description 'Pharas — ambient drug-addict NPCs scaling with area criminal reputation'
author      'Mzansi Underworld Team'
version     '1.0.0'

shared_scripts { '@ox_lib/init.lua' }
client_scripts { 'client.lua' }
server_scripts { 'server.lua' }

dependency '/assetpacks'
lua54 'yes'
