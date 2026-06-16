/**
 * 语义地图 — 坐标转换与 Mock 区域构建
 */

import {
  MAP_START_X,
  MAP_START_Y,
  MAP_WIDTH_M,
  MAP_HEIGHT_M,
  MAP_RESOLUTION,
  MAP_ZOOM_FACTOR,
  ZONE_STYLE_PRESETS,
  SEMANTIC_ZONE_TYPE
} from './constants'

/**
 * SLAM 笛卡尔坐标（米）→ [longitude, latitude]
 * @param {number} x
 * @param {number} y
 * @returns {[number, number]}
 */
export function cartToGPS(x, y) {
  const g = window.MapUtils.cartesianToGPS({
    x,
    y,
    scale: MAP_RESOLUTION,
    zoomFactor: MAP_ZOOM_FACTOR
  })
  return [g.longitude, g.latitude]
}

/**
 * 分数坐标（0~1）→ SLAM 笛卡尔坐标（米）
 * @param {number} xFrac
 * @param {number} yFrac
 */
export function fracToCart(xFrac, yFrac) {
  return {
    x: MAP_START_X + xFrac * MAP_WIDTH_M,
    y: MAP_START_Y + yFrac * MAP_HEIGHT_M
  }
}

/**
 * 分数坐标 → [lng, lat]
 * @param {number} xFrac
 * @param {number} yFrac
 * @returns {[number, number]}
 */
export function fracToGPS(xFrac, yFrac) {
  const c = fracToCart(xFrac, yFrac)
  return cartToGPS(c.x, c.y)
}

/**
 * 矩形分数区域 → 多边形顶点（闭合前四点，lng/lat）
 * @param {[number, number, number, number]} rect [x1, y1, x2, y2]
 * @returns {Array<[number, number]>}
 */
export function rectFracToPoints(rect) {
  const [x1, y1, x2, y2] = rect
  return [
    fracToGPS(x1, y1),
    fracToGPS(x2, y1),
    fracToGPS(x2, y2),
    fracToGPS(x1, y2)
  ]
}

/**
 * 自定义分数多边形顶点 → lng/lat 顶点
 * @param {Array<[number, number]>} fracPoints
 */
export function polyFracToPoints(fracPoints) {
  return fracPoints.map(([xf, yf]) => fracToGPS(xf, yf))
}

/**
 * 将 Mock 定义转为 createSemanticZones 所需格式
 * @param {import('./zoneMockData').SemanticZoneDef[]} defs
 */
export function buildZonesFromMock(defs) {
  return defs.map((def) => {
    const points = def.points
      ? polyFracToPoints(def.points)
      : rectFracToPoints(def.rect)

    const preset = ZONE_STYLE_PRESETS[def.type] ?? ZONE_STYLE_PRESETS[SEMANTIC_ZONE_TYPE.OFFICE]

    return {
      id: def.id,
      type: def.type,
      name: def.name,
      points,
      speedLimit: def.speedLimit,
      style: def.style ? { ...def.style } : undefined,
      description: def.description ?? preset.label
    }
  })
}
