fx_version 'cerulean'
game 'gta5'

author 'VCORE'
description 'A customizable QBCore HUD with native GTA radar, vehicle controls and keyboard settings'
version '2.0.0'

ui_page 'ui/index.html'

dependency '/onesync'

shared_scripts { 'config.lua', 'vehicle_config.lua', 'services_config.lua' }
client_scripts { 'preferences.lua', 'client.lua', 'stress_client.lua', 'stress_events.lua', 'vehicle_client.lua', 'aerial_client.lua', 'boombox_client.lua', 'services_client.lua' }
server_scripts { 'server.lua', 'vehicle_server.lua', 'boombox_server.lua', 'services_server.lua' }

files {
    'ui/**/*',
    'html/index.html',
    'html/*.css',
    'html/*.js',
    'html/*.svg',
    'html/boombox/*',
    'html/assets/*'
}
