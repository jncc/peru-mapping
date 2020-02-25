import * as React from 'react'
import { getConfig } from './config'

export type MapLegendGroup = {
  mapLegends: Array<MapLegend>
}

export type MapLegend = {
  layerName: string,
  legendEntries: Array<LegendEntry>
}

export type LegendEntry = {
  entry_id: string,
  type: string,
  label?: I8lnObj,
  fill?: string,
  stroke?: string,
  stops?: Array<string>,
  labels?: I8lnLabelsObj,
  min?: number,
  max?: number
}

export type I8lnObj = {
  [key: string]: string
}

export type I8lnLabelsObj = {
  [key: string]: Array<string>
}

function createLineLegendEntry(legendEntry: LegendEntry, lang: string) {
  var line = [
    <line key={`line-${legendEntry.entry_id}`} x1={0} y1={10} x2={10} y2={0}
      stroke={legendEntry.fill} strokeWidth={2}>
    </line>
  ]

  if (legendEntry.stroke !== undefined) {
    line.unshift(
      <line key={`line-outline-${legendEntry.entry_id}`} x1={0} y1={10} x2={10} y2={0}
        stroke={legendEntry.stroke} strokeWidth={3}>
      </line>
    )
  }

  return <tr key={`legend-row-${legendEntry.label ? legendEntry.label[lang] : 'UNDEFINED'}`}>
    <td className="legend-iconography">
      <svg className="legend-iconography" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
        {line}
      </svg>
    </td>
    <td className="legend">
      {legendEntry.label ? legendEntry.label[lang] : 'UNDEFINED'}
    </td>
  </tr>
}

function createValueLegendEntry(legendEntry: LegendEntry, lang: string) {
  return <tr key={`legend-row-${legendEntry.label ? legendEntry.label[lang] : 'UNDEFINED'}`}>
    <td className="legend-iconography">
      <svg className="legend-iconography" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
        <rect width={8} height={8} x={1} y={1} rx={1}
          fill={legendEntry.fill !== undefined ? legendEntry.fill : 'none'}
          stroke={legendEntry.stroke !== undefined ? legendEntry.stroke : 'none'}>
        </rect>
      </svg>
    </td>
    <td className="legend">
      {legendEntry.label ? legendEntry.label[lang] : 'UNDEFINED'}
    </td>
  </tr>
}

function createRampLegendEntry(legendEntry: LegendEntry, lang: string) {
  if (legendEntry.stops && legendEntry.labels) {
    var overallHeight = legendEntry.stops.length * 20
    var interval = 100 / (legendEntry.stops.length - 1)
    var current = 0
    var stops: Array<JSX.Element> = []

    legendEntry.stops.forEach(stop => {
      stops.push(
        <stop key={`legend-stop-${current}`} offset={current + '%'} stopColor={stop}></stop>
      )
      current = Math.min(100, current + interval)
    })

    let boundary = <defs></defs>
    if (legendEntry.min != undefined && legendEntry.max != undefined) {
      let miny = ((overallHeight - 4) * legendEntry.min) + 2
      let height = Math.max(1, (((overallHeight - 4) * legendEntry.max) - miny + 2))
      boundary = <rect x={1} y={miny} width={8} height={height} rx={0.1}
        stroke="#000000" strokeWidth="2" fill="none"></rect>
    }

    var output = [<tr>
      <td style={{ height: `${legendEntry.stops.length}rem` }} rowSpan={legendEntry.stops.length}>
        <svg className="legend-iconography-ramp" viewBox={`0 0 10 ${overallHeight}`} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={legendEntry.entry_id} x1="0%" y1="0%" x2="0%" y2="100%">
              {stops}
            </linearGradient>
          </defs>
          <rect
            x={1} y={2} width={8} height={overallHeight - 4} rx={0.1}
            fill={'url("#' + legendEntry.entry_id + '")'} stroke="#000000" strokeWidth="0.5"></rect>
          {boundary}
        </svg>
      </td>
      <td className="legend-iconography-label legend-iconography-label-ramp-first">{legendEntry.labels[lang][0]}</td>
    </tr>]

    for (var i = 1; i < legendEntry.labels[lang].length; i++) {
      var text = legendEntry.labels[lang][i]

      if (text === undefined || text.length === 0 || !text.trim()) {
        text = '\u00A0'
      }

      if (i == legendEntry.labels[lang].length - 1) {
        output.push(<tr>
          <td className="legend-iconography-label legend-iconography-label-ramp-last">{text}</td>
        </tr>)
      } else {
        output.push(<tr>
          <td className="legend-iconography-label">{text}</td>
        </tr>)
      }
    }

    return output
  }

  return <tr><td>BAD RAMP!</td></tr>
}

export function createLegendEntry(entry: LegendEntry) {
  if (entry.type === 'value') {
    return createValueLegendEntry(entry, getConfig(window.location.search).language)
  }
  else if (entry.type === 'line') {
    return createLineLegendEntry(entry, getConfig(window.location.search).language)
  }
  else if (entry.type === 'ramp') {
    return createRampLegendEntry(entry, getConfig(window.location.search).language)
  }
  else {
    return <tr>
      <td className="legend-iconography"></td>
      <td>Unkown Legend Entry Type [{entry.type}]</td>
    </tr>
  }
}