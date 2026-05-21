fx_version 'cerulean'
game 'gta5'

name 'robbery'
description 'Convenience store holdup — publishes crime.committed via backend /events'
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

-- Dependencies
dependency 'ox_lib'
dependency 'qbx_core'
