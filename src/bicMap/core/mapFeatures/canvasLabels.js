/*
 * @Description: Canvas 2D 离屏渲染标签工具
 *   将 GeoJSON Polygon/Point 的 label 属性渲染为 Canvas Image，
 *   以 icon-image 注入 symbol 图层，规避 WebGL 中文文本渲染问题。
 *   - Polygon 自动计算中心点坐标
 *   - Point 直接使用坐标
 *   - 支持自定义字体、颜色、阴影等样式
 */

const DEFAULT_STYLE = {
  font: '700 12px "PingFang SC","Microsoft YaHei",system-ui,sans-serif',
  textColor: '#ffffff',
  haloColor: '#1e293b',
  haloBlur: 4,
  padding: 4,
  labelKey: 'name',
}

/**
 * 在 map 上创建 Canvas 标签图层
 *
 * @param {object}   map      - MapLibre Map 实例
 * @param {object}   options
 * @param {string}   options.layerId   - symbol 图层 ID，同时 source ID 为 `${layerId}-src`
 * @param {object}   options.data      - GeoJSON FeatureCollection（Polygon 或 Point）
 * @param {object}   [options.style]   - 样式覆盖，支持：font/textColor/haloColor/haloBlur/padding/labelKey
 * @param {string}   [options.beforeId] - 插入到该图层之前
 * @returns {{ remove: () => void }} 控制器，调用 remove() 清理图层和图片
 */
export function addCanvasLabels(map, options) {
  const { layerId, data, style = {}, beforeId } = options

  if (!map || !layerId || !data) return { remove() {} }
  if (!Array.isArray(data.features)) return { remove() {} }

  const s = { ...DEFAULT_STYLE, ...style }
  const DPR = Math.min(window.devicePixelRatio || 2, 2)

  // 1. 提取标注点（Polygon → 重心坐标，Point → 直接取）
  const rawLabels = []
  data.features.forEach(f => {
    if (!f) return
    const label = f.properties?.[s.labelKey]
    if (!label) return

    let coordinates
    const geomType = f.geometry?.type

    if (geomType === 'Polygon') {
      const ring = f.geometry.coordinates[0]
      if (!ring || ring.length < 2) return
      let cx = 0, cy = 0
      const pointCount = Math.max(1, ring.length - 1)
      for (let i = 0; i < pointCount; i++) { cx += ring[i][0]; cy += ring[i][1] }
      cx /= pointCount
      cy /= pointCount
      coordinates = [cx, cy]
    } else if (geomType === 'Point') {
      coordinates = f.geometry.coordinates
    } else {
      return
    }

    rawLabels.push({ coordinates, label: String(label) })
  })

  if (rawLabels.length === 0) return { remove() {} }

  // 2. Canvas 渲染每个标签为 Image
  const imageIds = []
  const features = []

  rawLabels.forEach((item, idx) => {
    const imageId = `cl-${layerId}-${idx}`

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx.font = s.font
    const textWidth = ctx.measureText(item.label).width
    const lw = Math.ceil(textWidth) + s.padding * 2
    const lh = 12 + s.padding * 2
    canvas.width = Math.ceil(lw * DPR)
    canvas.height = Math.ceil(lh * DPR)
    ctx.scale(DPR, DPR)
    ctx.font = s.font
    ctx.shadowColor = s.haloColor
    ctx.shadowBlur = s.haloBlur
    ctx.shadowOffsetY = 1
    ctx.fillStyle = s.textColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(item.label, lw / 2, lh / 2)

    const { data: imageData } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    map.addImage(imageId, { width: canvas.width, height: canvas.height, data: imageData }, { pixelRatio: DPR })
    imageIds.push(imageId)
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: item.coordinates },
      properties: { imageId }
    })
  })

  // 3. 创建 source + symbol 图层
  const sourceId = layerId + '-src'
  map.addSource(sourceId, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features }
  })
  map.addLayer({
    id: layerId,
    type: 'symbol',
    source: sourceId,
    layout: {
      'icon-image': ['get', 'imageId'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    }
  }, beforeId)

  // 4. 返回清理控制器
  return {
    remove() {
      if (map.getLayer(layerId)) map.removeLayer(layerId)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
      imageIds.forEach(id => { try { map.removeImage(id) } catch (_) {} })
    }
  }
}
