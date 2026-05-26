fx_version 'cerulean'
game 'gta5'

name        'mdt'
description 'Police Mobile Data Terminal — NUI incident list, case notes, dispatch audio replay'
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

ui_page 'html/index.html'

files {
  'html/index.html',
  'html/style.css',
  'html/app.js',
}

dependency '/assetpacks'
lua54 'yes'
