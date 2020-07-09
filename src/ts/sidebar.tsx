import * as React from 'react'
import { render } from 'react-dom'
import { Config, getConfig } from './config'
import * as content from '../content.json'
import * as legends from '../legends.json'
import * as map from './map'
import { createLegendEntry, MapLegend, MapLegendGroup } from './legend'

let sidebarLeft: L.Control.Sidebar
let sidebarRight: L.Control.Sidebar
let opacitySliderValue = 0.9

export function createSidebar(map: L.Map, config: Config) {
  sidebarLeft = L.control.sidebar('sidebar-left', { position: 'left' })
  sidebarLeft.addTo(map)

  sidebarRight = L.control.sidebar('sidebar-right', { position: 'right' })

  // set up grid tab contents using react component
  ChangeGrid([])
  sidebarRight.close()
  sidebarRight.addTo(map)

  // setup home tab
  let sidebarHome: HTMLElement | null = document.getElementById('home')
  if (sidebarHome) {
    let home: HTMLElement | null = L.DomUtil.get('home')
    if (home) {
      let homeContainer = L.DomUtil.create('div', 'sidebar-home')
      homeContainer.innerHTML += '<h3><span id="close-home" class="sidebar-close">'
        + '<i class="fas fa-caret-left"></i></span></h3>'
      homeContainer.innerHTML += '<h2>' + content.info_panel.title[config.language] + '</h2>'
      for (let section of content.info_panel.info_sections) {
        if (section.section_title[config.language]) {
          homeContainer.innerHTML += '<h5>' + section.section_title[config.language] + '</h5>'
        }
        if (section.section_content[config.language]) {
          homeContainer.innerHTML += '<p>' + section.section_content[config.language] + '</p>'
        }
      }

      let getStartedButton = L.DomUtil.create('button', 'btn btn-primary start mb-4')
      getStartedButton.innerHTML += content.info_panel.button_text[config.language]
      getStartedButton.addEventListener('click', function () {
        sidebarLeft.open('layers')
      })

      homeContainer.appendChild(getStartedButton)

      let sponsorLinks = L.DomUtil.create('div', '')

      let eo4cLink = L.DomUtil.create('span', '')
      eo4cLink.innerHTML = '<a href=""><img class="mr-4 p-1 centered" style="width: 4rem; height: 4rem;"' +
        'title="EO4 Cultivar" alt="EO4 Cultivar" src="' + require('../images/eo4c.jpg') + '"></img></a>'
      sponsorLinks.appendChild(eo4cLink)

      let uksaLink = L.DomUtil.create('span', '')
      uksaLink.innerHTML = '<a href=""><img class="mr-4 p-1 centered" style="height: 4rem;" title="UK Space Agency" '
        + 'alt="UK Space Agency" src="' + require('../images/uksa.jpg') + '" /></a>'
      sponsorLinks.appendChild(uksaLink)

      homeContainer.appendChild(sponsorLinks)

      home.appendChild(homeContainer)
    }

    // set up layers tab using react component
    let layerControls: HTMLElement | null = document.getElementById('layers')
    if (layerControls) {
      render(<LayerControls />, layerControls)
    }
  }

  // event listeners for close buttons
  let homeClose: HTMLElement | null = document.getElementById('close-home')
  if (homeClose) {
    homeClose.addEventListener('click', function () {
      sidebarLeft.close()
    })
  }

  let layersClose: HTMLElement | null = document.getElementById('close-layers')
  if (layersClose) {
    layersClose.addEventListener('click', function () {
      sidebarLeft.close()
    })
  }

  sidebarLeft.open('home')
}

export function ChangeGrid(props: Array<MapLegend>) {
  let gridControls: HTMLElement | null = document.getElementById('grid')
  if (gridControls) {
    render(<GridTab mapLegends={props} />, gridControls)
    sidebarRight.open('grid')
  }
}

function GridTab(props: MapLegendGroup) {
  let gridInfoText = []
  for (let section of content.grid_panel.info_sections) {
    if (section.section_title) {
      gridInfoText.push(
        <h5 key={section.section_title.en.replace(' ', '-')} dangerouslySetInnerHTML={
          { __html: section.section_title[getConfig(window.location.search).language] }}>
        </h5>
      )
    }
    gridInfoText.push(
      <p key={`p-${section.section_title.en.replace(' ', '-')}`} dangerouslySetInnerHTML={
        { __html: section.section_content[getConfig(window.location.search).language] }}>
      </p>
    )
  }

  let gridLayers = []
  for (let gridLayer of props.mapLegends) {
    gridLayers.push(<hr />)
    gridLayers.push(
      <h6 key={gridLayer.layerName} dangerouslySetInnerHTML={
        { __html: gridLayer.layerName }}>
      </h6>
    )
    var legendEntries = []
    for (let entry of gridLayer.legendEntries) {
      legendEntries.push(
        createLegendEntry(entry)
      )
    }
    gridLayers.push(
      <table key={`grid-legend-table-${gridLayer.layerName}`}>
        <tbody key={`grid-legend-table-body-${gridLayer.layerName}`}>
          {legendEntries}
        </tbody>
      </table>)
  }

  return (
    <div>
      {gridInfoText}
      {gridLayers}
    </div>
  )
}

export class LayerControls extends React.Component {
  state = {
    hideBaseLayer: true,
    baseLayer: 'no_layer' as keyof typeof content.base_layers,
    overlays: {
      'zona_bananera': false
    } as any,
    underlays: {
      'satellite_imagery': true
    } as any,
    showGridLayer: false
  }

  changeBaseLayerTransparency = (event: React.ChangeEvent<HTMLInputElement>) => {
    opacitySliderValue = parseFloat(event.target.value)
    map.updateBaseLayerOpacity(opacitySliderValue)
  }

  changeBaseLayer = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (event.target.value === 'no_layer') {
      map.removeBaselayer()
      this.setState({
        hideBaseLayer: true,
        baseLayer: event.target.value
      })
    } else {
      this.setState({
        hideBaseLayer: false,
        baseLayer: event.target.value
      })
      map.updateBaseLayer(event.target.value as keyof typeof content.base_layers, opacitySliderValue)
      for (let overlay of keys(this.state.overlays)) {
        if (this.state.overlays[overlay]) {
          map.refreshOverlay(overlay as keyof typeof content.overlay_layers)
        }
      }
    }
  }

  changeOverlay = (event: React.ChangeEvent<HTMLInputElement>) => {
    let updatedOverlays = this.state.overlays
    updatedOverlays[event.target.value] = event.target.checked

    this.setState({
      overlays: updatedOverlays
    })
    map.updateOverlay(event.target.value as keyof typeof content.overlay_layers, event.target.checked)
  }

  changeUnderlay = (event: React.ChangeEvent<HTMLInputElement>) => {
    let updatedUnderlays = this.state.underlays
    updatedUnderlays[event.target.value] = event.target.checked

    this.setState({
      underlays: updatedUnderlays
    })
    map.updateUnderlay(event.target.value as keyof typeof content.underlay_layers, event.target.checked)
    map.refreshBaseLayer(this.state.baseLayer)
    for (let overlay of keys(this.state.overlays)) {
      if (this.state.overlays[overlay]) {
        map.refreshOverlay(overlay as keyof typeof content.overlay_layers)
      }
    }
  }

  changeGridLayer = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({
      showGridLayer: event.target.checked
    })
    map.updateGridLayer(event.target.checked)
    if (!event.target.checked) {
      sidebarRight.close()
    }
  }

  render() {
    let baseLayerOptions = []
    for (let layer of keys(content.base_layers)) {
      baseLayerOptions.push(
        <option key={layer} value={layer}>
          {content.base_layers[layer].short_title[getConfig(window.location.search).language]}
        </option>
      )
    }

    let overlayOptions = []
    for (let layer of keys(content.overlay_layers)) {
      if (content.overlay_layers[layer].display_sidebar) {
        overlayOptions.push(
          <div key={layer} className="checkbox">
            <div className="form-inline">
              <label className="form-check-label">
                <input id={layer + '-checkbox'} className="form-check-input" type="checkbox"
                  onChange={this.changeOverlay} value={layer} checked={this.state.overlays[layer]} />
                {content.overlay_layers[layer].short_title[getConfig(window.location.search).language]}
              </label>
            </div>
          </div>
        )
      }
    }

    let underlayOptions = []
    for (let layer of keys(content.underlay_layers)) {
      underlayOptions.push(
        <div key={layer} className="checkbox">
          <div className="form-inline">
            <label className="form-check-label">
              <input id={layer + '-checkbox'} className="form-check-input" type="checkbox"
                onChange={this.changeUnderlay} value={layer} checked={this.state.underlays[layer]} />
              {content.underlay_layers[layer].short_title[getConfig(window.location.search).language]}
            </label>
          </div>
        </div>
      )
    }

    let legend = []
    if (!this.state.hideBaseLayer) {
      let entries = []
      for (let entry of legends[this.state.baseLayer].legend_entries) {
        entries.push(createLegendEntry(entry))
      }

      legend.push(<table key={`legend-table-${legends[this.state.baseLayer]}`}>
        <tbody key={`legend-table-body-${legends[this.state.baseLayer]}`}>
          {entries}
        </tbody>
      </table>)
    }

    let info = []
    if (this.state.baseLayer !== 'no_layer') {
      info.push(
        <div key="opacitySliderContainer" className="opacitySliderContainer">
          <label htmlFor="opacitySlider">
            {content.info_panel.opacity_slider[getConfig(window.location.search).language]}
          </label>
          <input type="range" min="0" max="1" defaultValue="0.9" step="0.1"
            className="opacitySlider" id="opacitySlider"
            onChange={this.changeBaseLayerTransparency} ></input>
        </div>
      )
    }
    for (let section of content.base_layers[this.state.baseLayer as keyof typeof content.base_layers].info_sections) {
      if (section.section_title) {
        info.push(
          <h5 key={`h5-${section.section_title.en.replace(' ', '-')}`} dangerouslySetInnerHTML={
            { __html: section.section_title[getConfig(window.location.search).language] }}>
          </h5>
        )
      }
      info.push(
        <p key={`p-${section.section_title.en.replace(' ', '-')}`} dangerouslySetInnerHTML={
          { __html: section.section_content[getConfig(window.location.search).language] }}>
        </p>
      )
    }

    return (
      <div className="sidebar-layers">
        <h3><span id="close-layers" className="sidebar-close"><i className="fas fa-caret-left"></i></span></h3>
        <div className="layer-select">
          <div key="grid" id="grid-button">
            <label>
              <input type="checkbox" value="1" onChange={this.changeGridLayer} checked={this.state.showGridLayer} />
              <span>{content.overlay_layers['grid_5k'].short_title[getConfig(window.location.search).language]}</span>
            </label>
          </div>
          {underlayOptions}
          {overlayOptions}
          <hr />
          <select id="baselayer-select" className="form-control" onChange={this.changeBaseLayer}>
            {baseLayerOptions}
          </select>
        </div>
        <div className="legend-container">
          {legend}
        </div>

        <div className="info">
          {info}
        </div>
      </div>
    )
  }
}

export const keys = Object.keys as <T>(o: T) => (Extract<keyof T, string>)[]
