
import * as L from 'leaflet'
import { Config } from './config.js'
import * as content from '../content.json'
//import * as layers from './layers'
import * as grid from '../grid.json'
import * as legends from '../legends.json'
import '../js/leaflet-sidebar.min.js'
import { ChangeGrid as LoadGridTab } from './sidebar'
import { MapLegend, LegendEntry } from './legend'

let overlayMaps = {} as any
let underlayMaps = {} as any
let baseMaps = {} as any
let gridLayer = {} as any
let map: L.Map
let previousEvent: L.LeafletEvent | undefined = undefined
let currentLayer: string | undefined = undefined

export function createMap(container: HTMLElement, config: Config) {

  map = L.map(container, { zoomControl: false, wheelDebounceTime: 300 })
    .setView([10.8034027, -74.15481], 11)
  new L.Control.Zoom({ position: 'bottomright' }).addTo(map)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)

  // set up interactive grid layer
  gridLayer = L.geoJSON(grid as GeoJSON.GeoJsonObject, {
    style: function (feature) {
      return {
        color: '#5DADE2',
        weight: 2,
        fillOpacity: 0
      }
    },

    onEachFeature: function (feature, layer) {
      let gridLayers: Array<MapLegend> = []

      if (feature.properties.legends) {
        let layerKeys = keys(feature.properties.legends)
        let orderedLayerKeys = keys(content.base_layers)
        orderedLayerKeys.forEach(layerKey => {
          if (layerKeys.lastIndexOf(layerKey) > 0) {
            let currentGroupLegendEntries = feature.properties.legends[layerKey]
            let layer: MapLegend = {
              layerName: content.base_layers[layerKey as keyof typeof content.base_layers].short_title[config.language],
              legendEntries: []
            }
            gridLayers.push(layer)

            let legend = legends[layerKey as keyof typeof content.base_layers]
            let entries: Array<LegendEntry> = legend.legend_entries

            if ('vector' in currentGroupLegendEntries) {
              currentGroupLegendEntries['vector'].forEach((entryId: string) => {
                let entry = entries.filter(entry => entry.entry_id === entryId)[0]
                layer.legendEntries.push(entry)
              })
            }

            if ('ramp' in currentGroupLegendEntries) {
              keys(currentGroupLegendEntries['ramp']).forEach((rampId: string) => {
                let entry = entries.filter(entry => entry.entry_id === rampId)[0]
                let newEntry: LegendEntry = Object.assign({}, entry)
                newEntry.min = currentGroupLegendEntries['ramp'][rampId]['min']
                newEntry.max = currentGroupLegendEntries['ramp'][rampId]['max']
                layer.legendEntries.push(newEntry)
              })
            }
          }
        })
      }

      layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: (e: L.LeafletEvent) => {
          clickHighlightFeature(e)
          onGridSquareclick(e, gridLayers)
        },
      })
    }
  })

  // setup base maps
  for (let baseLayer of keys(content.base_layers)) {
    let layer = L.tileLayer.wms(process.env.GEOSERVER_URL + '/colombia_eo4_cultivar/wms?tiled=true', {
      layers: content.base_layers[baseLayer].wms_name,
      transparent: true,
      format: 'image/png',
      opacity: 1,
      attribution: content.base_layers[baseLayer].attribution[config.language]
    })
    Object.assign(baseMaps, { [baseLayer]: layer })
  }

  // setup overlays  
  for (let overlay of keys(content.overlay_layers)) {
    let layer = L.tileLayer.wms(process.env.GEOSERVER_URL + '/colombia_eo4_cultivar/wms?tiled=true', {
      layers: content.overlay_layers[overlay].wms_name,
      transparent: true,
      format: 'image/png',
      opacity: 1,
      attribution: content.overlay_layers[overlay].attribution[config.language]
    })
    Object.assign(overlayMaps, { [overlay]: layer })
  }

  // setup underlays  
  for (let underlay of keys(content.underlay_layers)) {
    let layer = L.tileLayer.wms(process.env.GEOSERVER_URL + '/colombia_eo4_cultivar/wms?tiled=true', {
      layers: content.underlay_layers[underlay].wms_name,
      transparent: true,
      format: 'image/png',
      opacity: 1,
      attribution: content.underlay_layers[underlay].attribution[config.language]
    })
    Object.assign(underlayMaps, { [underlay]: layer })
  }
  updateUnderlay('satellite_imagery', true) // sentinel layer on as landing page view

  return map
}

function clickHighlightFeature(e: L.LeafletEvent) {
  if (previousEvent !== undefined && e.target !== previousEvent.target) {
    gridLayer.resetStyle(previousEvent.target)
  }

  var layer = e.target
  previousEvent = e
  layer.setStyle({
    color: 'red',
    weight: 5,
    fillOpacity: 0
  })

  if (!L.Browser.ie && !L.Browser.edge) {
    layer.bringToFront()
  }
}

function highlightFeature(e: L.LeafletEvent) {
  if (previousEvent !== undefined && e.target === previousEvent.target) {
    previousEvent.target.bringToFront()
  } else {
    var layer = e.target

    layer.setStyle({
      color: '#0090E1',
      weight: 5,
      fillOpacity: 0.1
    })

    if (!L.Browser.ie && !L.Browser.edge) {
      layer.bringToFront()

      if (previousEvent !== undefined && e.target !== previousEvent.target) {
        previousEvent.target.bringToFront()
      }
    }
  }

}

function resetHighlight(e: L.LeafletEvent) {
  if ((previousEvent === undefined) || (previousEvent !== undefined && e.target !== previousEvent.target)) {
    gridLayer.resetStyle(e.target)
  }
}

function onGridSquareclick(e: L.LeafletEvent, gridLayers: Array<MapLegend>) {
  LoadGridTab(gridLayers)
  zoomToFeature(e)
}

function zoomToFeature(e: L.LeafletEvent) {
  map.fitBounds(e.target.getBounds(), { maxZoom: 13 })
}

export function refreshOverlay(layer: keyof typeof content.overlay_layers) {
  overlayMaps[layer].bringToFront()
}

export function refreshBaseLayer(layer: keyof typeof content.base_layers) {
  baseMaps[layer].bringToFront()
}

export function updateOverlay(layer: keyof typeof content.overlay_layers, checked: boolean) {
  if (checked) {
    overlayMaps[layer].addTo(map)
  } else {
    map.removeLayer(overlayMaps[layer])
  }
}

export function updateUnderlay(layer: keyof typeof content.underlay_layers, checked: boolean) {
  if (checked) {
    underlayMaps[layer].addTo(map)
  } else {
    map.removeLayer(underlayMaps[layer])
  }
}

export function updateBaseLayer(layer: keyof typeof content.base_layers, opacity: number) {
  // for (let baseLayer of keys(baseMaps)) {
  //   map.removeLayer(baseMaps[baseLayer])
  // }  
  if (currentLayer !== undefined) {
    map.removeLayer(baseMaps[currentLayer])
    currentLayer = undefined
  }
  if (layer !== 'no_layer') {
    currentLayer = layer
    baseMaps[layer].setOpacity(opacity)
    baseMaps[layer].addTo(map)
  }
}

export function updateBaseLayerOpacity(opacity: number) {
  if (currentLayer !== undefined) {
    baseMaps[currentLayer].setOpacity(opacity)
  }
}

export function removeBaselayer() {
  for (let baseLayer of keys(baseMaps)) {
    map.removeLayer(baseMaps[baseLayer])
  }
}

export function updateGridLayer(checked: boolean) {
  if (checked) {
    gridLayer.addTo(map)
  } else {
    map.removeLayer(gridLayer)
  }
}

export const keys = Object.keys as <T>(o: T) => (Extract<keyof T, string>)[]
