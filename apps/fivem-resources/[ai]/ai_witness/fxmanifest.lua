fx_version 'cerulean'
game 'gta5'

name        'ai_witness'
description 'AI Witness system — NPC witnesses observe crimes and send statements to backend'
author      'GTA-RP Team'
version     '1.0.0'

shared_scripts {
  '@ox_lib/init.lua',
}

client_scripts {
  'client.lua',
}

server_scripts {
  'server.lua',
}

ui_page 'html/index.html'

files {
  'html/index.html',
  'html/style.css',
  'html/app.js',
}

dependency '/assetpacks'
lua54 'yes'
