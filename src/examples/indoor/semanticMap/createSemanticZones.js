/**
 * 语义区域多边形渲染 — fill + outline + DOM 标注
 */

import { ZONE_STYLE_PRESETS, SEMANTIC_ZONE_TYPE } from './constants'

const FILL_SOURCE_ID = 'bic-semantic-map-fill-source'
const FILL_LAYER_ID = 'bic-semantic-map-fill-layer'
const OUTLINE_SOURCE_ID = 'bic-semantic-map-outline-source'
const OUTLINE_LAYER_ID = 'bic-semantic-map-outline-layer'

/**
 * @param {import('maplibre-gl').Map} map
 * @param {Array} zones
 * @param {Object} options
 */
export function createSemanticZones(map, zones = [], options = {}) {
  if (!map) {
    throw new Error('[semanticMap] 地图未初始化')
  }

  const {
    showLabels = true,
    labelFontSize = 11,
    labelColor = '#ffffff',
    onClick = null
  } = options

  let zoneList = [...zones]

  const centroid = (pts) => {
    const n = pts.length
    const sx = pts.reduce((a, p) => a + p[0], 0) / n
    const sy = pts.reduce((a, p) => a + p[1], 0) / n
    return [sx, sy]
  }

  const resolveStyle = (zone) => {
    const preset =
      ZONE_STYLE_PRESETS[zone.type] ?? ZONE_STYLE_PRESETS[SEMANTIC_ZONE_TYPE.OFFICE]
    return { ...preset, ...(zone.style ?? {}) }
  }

  const buildFillGeoJSON = () => ({
    type: 'FeatureCollection',
    features: zoneList.map((zone, i) => {
      const style = resolveStyle(zone)
      const ring = [...zone.points]
      if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
        ring.push(ring[0])
      }
      return {
        type: 'Feature',
        id: zone.id ?? `zone-${i}`,
        geometry: { type: 'Polygon', coordinates: [ring] },
        properties: {
          id: zone.id ?? `zone-${i}`,
          type: zone.type,
          name: zone.name ?? '',
          fillColor: style.fillColor,
          fillOpacity: style.fillOpacity,
          outlineColor: style.outlineColor,
          outlineWidth: style.outlineWidth
        }
      }
    })
  })

  const buildOutlineGeoJSON = () => ({
    type: 'FeatureCollection',
    features: zoneList.map((zone, i) => {
      const style = resolveStyle(zone)
      const ring = [...zone.points]
      if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
        ring.push(ring[0])
      }
      return {
        type: 'Feature',
        id: `outline-${zone.id ?? i}`,
        geometry: { type: 'LineString', coordinates: ring },
        properties: {
          outlineColor: style.outlineColor,
          outlineWidth: style.outlineWidth,
          outlineDash: style.outlineDash ? style.outlineDash.join(',') : ''
        }
      }
    })
  })

  let labelMarkerEls = []

  const buildLabelMarkers = () => {
    const MapLibre = window.maplibregl
    if (!MapLibre || !showLabels) return

    labelMarkerEls.forEach((m) => m.remove())
    labelMarkerEls = []

    zoneList.forEach((zone) => {
      const preset =
        ZONE_STYLE_PRESETS[zone.type] ?? ZONE_STYLE_PRESETS[SEMANTIC_ZONE_TYPE.OFFICE]
      const label = zone.name ?? preset.label
      const display =
        zone.type === SEMANTIC_ZONE_TYPE.CORRIDOR && zone.speedLimit
          ? `${label} ${zone.speedLimit}m/s`
          : label

      const el = document.createElement('div')
      el.textContent = display
      el.style.cssText = [
        `color:${labelColor}`,
        `font-size:${labelFontSize}px`,
        'font-weight:600',
        'font-family:system-ui,PingFang SC,Microsoft YaHei,sans-serif',
        'text-shadow:0 1px 4px rgba(0,0,0,0.75)',
        'white-space:nowrap',
        'pointer-events:none',
        'user-select:none',
        'letter-spacing:0.02em'
      ].join(';')

      const marker = new MapLibre.Marker({ element: el, anchor: 'center' })
        .setLngLat(centroid(zone.points))
        .addTo(map)
      labelMarkerEls.push(marker)
    })
  }

  const clearLabelMarkers = () => {
    labelMarkerEls.forEach((m) => m.remove())
    labelMarkerEls = []
  }

  const ensureLayers = () => {
    if (!map.getSource(FILL_SOURCE_ID)) {
      map.addSource(FILL_SOURCE_ID, { type: 'geojson', data: buildFillGeoJSON() })
      map.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: FILL_SOURCE_ID,
        paint: {
          'fill-color': ['get', 'fillColor'],
          'fill-opacity': ['get', 'fillOpacity']
        }
      })
    }

    if (!map.getSource(OUTLINE_SOURCE_ID)) {
      map.addSource(OUTLINE_SOURCE_ID, { type: 'geojson', data: buildOutlineGeoJSON() })
      map.addLayer({
        id: OUTLINE_LAYER_ID,
        type: 'line',
        source: OUTLINE_SOURCE_ID,
        paint: {
          'line-color': ['get', 'outlineColor'],
          'line-width': ['get', 'outlineWidth']
        }
      })
    }

    buildLabelMarkers()

    if (onClick) {
      map.on('click', FILL_LAYER_ID, (e) => {
        e.originalEvent.stopPropagation()
        const feat = map.queryRenderedFeatures(e.point, { layers: [FILL_LAYER_ID] })[0]
        if (!feat) return
        const zone = zoneList.find((z) => String(z.id) === String(feat.properties.id))
        onClick({ feature: feat, zone, lngLat: e.lngLat })
      })
      map.on('mouseenter', FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = ''
      })
    }
  }

  const syncSources = () => {
    if (map.getSource(FILL_SOURCE_ID)) {
      map.getSource(FILL_SOURCE_ID).setData(buildFillGeoJSON())
    }
    if (map.getSource(OUTLINE_SOURCE_ID)) {
      map.getSource(OUTLINE_SOURCE_ID).setData(buildOutlineGeoJSON())
    }
    buildLabelMarkers()
  }

  ensureLayers()

  return {
    addZone(zone) {
      zoneList.push(zone)
      syncSources()
    },
    removeZone(id) {
      zoneList = zoneList.filter((z) => z.id !== id)
      syncSources()
    },
    update(newZones = []) {
      zoneList = [...newZones]
      syncSources()
    },
    show() {
      ;[FILL_LAYER_ID, OUTLINE_LAYER_ID].forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible')
      })
      labelMarkerEls.forEach((m) => {
        const el = m.getElement()
        if (el) el.style.display = ''
      })
    },
    hide() {
      ;[FILL_LAYER_ID, OUTLINE_LAYER_ID].forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none')
      })
      labelMarkerEls.forEach((m) => {
        const el = m.getElement()
        if (el) el.style.display = 'none'
      })
    },
    getZones: () => [...zoneList],
    remove() {
      ;[FILL_LAYER_ID, OUTLINE_LAYER_ID].forEach((id) => {
        if (map.getLayer(id)) {
          map.off('click', id)
          map.off('mouseenter', id)
          map.off('mouseleave', id)
          map.removeLayer(id)
        }
      })
      ;[FILL_SOURCE_ID, OUTLINE_SOURCE_ID].forEach((id) => {
        if (map.getSource(id)) map.removeSource(id)
      })
      clearLabelMarkers()
      zoneList = []
    }
  }
}
