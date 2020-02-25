// polyfills
import 'ts-polyfill/lib/es2016-array-include'
import 'ts-polyfill/lib/es2017-object'
import 'ts-polyfill/lib/es2017-string'
import 'url-search-params-polyfill'
import 'es6-object-assign/auto'

// styles
import '../styles.less'
import 'leaflet/dist/leaflet.css'
import '../css/leaflet-sidebar.css'
import '../../lib/fontawesome-5.10.2/css/all.css'

import { getConfig } from './config'
import { createMap } from './map'
import { createSidebar } from './sidebar'

let config = getConfig(window.location.search)

// draw the leaflet map in the div and add the sidebar
let div = document.getElementById('map') as HTMLElement
let map = createMap(div, config)
createSidebar(map, config)
