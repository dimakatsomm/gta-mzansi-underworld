fx_version 'cerulean'
game 'gta5'

name        'hijack'
description 'Vehicle hijack crime — publishes crime.committed (hijack) via backend /events'
author      'Mzansi Underworld Team'
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

dependencies {
  '/assetpacks',
  'ox_lib',
}

lua54 'yes'
