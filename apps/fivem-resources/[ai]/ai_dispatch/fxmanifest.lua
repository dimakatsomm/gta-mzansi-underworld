fx_version 'cerulean'
game 'gta5'

name 'ai_dispatch'
description 'AI dispatch NUI card + voice audio for police job — subscribes to backend dispatch.requested WS'
author 'Mzansi Underworld RP'
version '1.0.0'

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

dependency 'ox_lib'
dependency 'qbx_core'
