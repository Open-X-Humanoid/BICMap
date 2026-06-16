
/**
 * WebMercator 下给定纬度与 zoom 的 meters-per-pixel
 * @param {number} lat
 * @param {number} zoom
 */
function metersPerPixelAtLat(lat, zoom) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom)
}

/**
 * 将米半径换算为像素半径
 * @param {Object} map
 * @param {number} radiusM
 * @param {number} centerLat
 */
function radiusMetersToPixels(map, radiusM, centerLat) {
  const zoom = typeof map.getZoom === 'function' ? map.getZoom() : 0
  const mpp = metersPerPixelAtLat(centerLat, zoom)
  if (!Number.isFinite(mpp) || mpp <= 0) return 0
  return radiusM / mpp
}

/**
 * 创建圆形显示控制器（支持多个圆）
 * 圆以 Point 要素表达，半径用 properties.radiusPx 驱动 circle-radius
 *
 * @param {Object} map - MapLibre map 实例
 * @param {Array<{center:[number,number], radiusM:number}>} circles
 * @param {Object} options
 * @param {string} [options.sourceId]
 * @param {string} [options.fillLayerId]
 * @param {string} [options.outlineLayerId]
 * @param {string} [options.fillColor='#3388ff']
 * @param {number} [options.fillOpacity=0.4]
 * @param {string} [options.outlineColor='#3388ff']
 * @param {number} [options.outlineWidth=2]
 * @returns {Object|null}
 */
export function createCircles(map, circles = [], options = {}) {
  if (!map) {
    console.error('创建圆形失败: 地图实例不能为空')
    return null
  }

  const mergedOptions = {
    fillColor: '#3388ff',
    fillOpacity: 0.4,
    outlineColor: '#3388ff',
    outlineWidth: 2,
    sourceId: `circle-source-${Date.now()}`,
    fillLayerId: `circle-fill-${Date.now()}`,
    outlineLayerId: `circle-outline-${Date.now()}`,
    ...options
  }

  const state = {
    items: []
  }

  const empty = { type: 'FeatureCollection', features: [] }

  function toFeature(c, id) {
    const center = c.center
    const radiusM = c.radiusM
    const radiusPx = radiusMetersToPixels(map, radiusM, center[1])
    return {
      type: 'Feature',
      id,
      properties: {
        id,
        radiusM,
        radiusPx,
        fillColor: c.fillColor,
        fillOpacity: c.fillOpacity,
        outlineColor: c.outlineColor,
        outlineWidth: c.outlineWidth
      },
      geometry: {
        type: 'Point',
        coordinates: center
      }
    }
  }

  function syncData() {
    const src = map.getSource(mergedOptions.sourceId)
    if (!src?.setData) return
    src.setData({
      type: 'FeatureCollection',
      features: state.items.map((it) => toFeature(it, it.id))
    })
  }

  function updateRadiusPxForAll() {
    const src = map.getSource(mergedOptions.sourceId)
    if (!src?.setData) return
    src.setData({
      type: 'FeatureCollection',
      features: state.items.map((it) => {
        const f = toFeature(it, it.id)
        f.properties.radiusPx = radiusMetersToPixels(map, it.radiusM, it.center[1])
        return f
      })
    })
  }

  // init source
  if (!map.getSource(mergedOptions.sourceId)) {
    map.addSource(mergedOptions.sourceId, { type: 'geojson', data: empty })
  }

  // fill layer
  if (!map.getLayer(mergedOptions.fillLayerId)) {
    map.addLayer({
      id: mergedOptions.fillLayerId,
      type: 'circle',
      source: mergedOptions.sourceId,
      paint: {
        'circle-color': ['coalesce', ['get', 'fillColor'], mergedOptions.fillColor],
        'circle-opacity': ['coalesce', ['get', 'fillOpacity'], mergedOptions.fillOpacity],
        'circle-radius': ['coalesce', ['get', 'radiusPx'], 0]
      }
    })
  }

  // outline layer (stroke-only)
  if (!map.getLayer(mergedOptions.outlineLayerId)) {
    map.addLayer({
      id: mergedOptions.outlineLayerId,
      type: 'circle',
      source: mergedOptions.sourceId,
      paint: {
        'circle-color': 'rgba(0,0,0,0)',
        'circle-opacity': 0,
        'circle-radius': ['coalesce', ['get', 'radiusPx'], 0],
        'circle-stroke-color': ['coalesce', ['get', 'outlineColor'], mergedOptions.outlineColor],
        'circle-stroke-width': ['coalesce', ['get', 'outlineWidth'], mergedOptions.outlineWidth],
        'circle-stroke-opacity': 1
      }
    })
  }

  // disable transitions to avoid shrink artifacts when updating radius
  try {
    map.setPaintProperty(mergedOptions.fillLayerId, 'circle-radius-transition', { duration: 0, delay: 0 })
    map.setPaintProperty(mergedOptions.outlineLayerId, 'circle-radius-transition', { duration: 0, delay: 0 })
  } catch (e) {
    // ignore
  }

  map.on('zoom', updateRadiusPxForAll)

  // seed
  circles.forEach((c) => {
    state.items.push({
      id: `circle-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      center: c.center,
      radiusM: c.radiusM,
      fillColor: c.fillColor,
      fillOpacity: c.fillOpacity,
      outlineColor: c.outlineColor,
      outlineWidth: c.outlineWidth
    })
  })
  syncData()

  return {
    addCircle(circle) {
      if (!circle?.center || typeof circle?.radiusM !== 'number') return
      state.items.push({
        id: `circle-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        center: circle.center,
        radiusM: circle.radiusM,
        fillColor: circle.fillColor,
        fillOpacity: circle.fillOpacity,
        outlineColor: circle.outlineColor,
        outlineWidth: circle.outlineWidth
      })
      syncData()
    },
    clear() {
      state.items.length = 0
      const src = map.getSource(mergedOptions.sourceId)
      src?.setData?.(empty)
    },
    remove() {
      map.off('zoom', updateRadiusPxForAll)
      if (map.getLayer(mergedOptions.fillLayerId)) map.removeLayer(mergedOptions.fillLayerId)
      if (map.getLayer(mergedOptions.outlineLayerId)) map.removeLayer(mergedOptions.outlineLayerId)
      if (map.getSource(mergedOptions.sourceId)) map.removeSource(mergedOptions.sourceId)
    }
  }
}

