import { MOCK_BUILDINGS, MOCK_ROADS } from '../buildings/mockBuildingData'

export const MAP_CENTER = [116.4076, 39.9045]
export const MAP_ZOOM = 16
export const MAP_PITCH = 55
export const MAP_BEARING = -20

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

/**
 * 计算多边形外环的包围盒
 * @param {Array<[number, number]>} ring 不含闭合点
 * @returns {{ minLng: number, maxLng: number, minLat: number, maxLat: number }}
 */
function computeBBox(ring) {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return { minLng, maxLng, minLat, maxLat }
}

/**
 * Ray-casting 判断点是否在多边形内
 * @param {number} lng
 * @param {number} lat
 * @param {Array<[number, number]>} ring 不含闭合点
 * @returns {boolean}
 */
function pointInPolygon(lng, lat, ring) {
  let inside = false
  const n = ring.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

// ─── 采样函数 ──────────────────────────────────────────────────────────────────

/**
 * 屋顶随机采样（包围盒内撒点，保留落在多边形内的点）
 * @param {Array<Array<[number, number]>>} coordinates GeoJSON Polygon coordinates
 * @param {number} baseHeight
 * @param {number} height
 * @returns {Array<[number, number, number]>}
 */
function sampleRoofPoints(coordinates, baseHeight, height) {
  const ring = coordinates[0].slice(0, -1)
  const roofZ = baseHeight + height
  const { minLng, maxLng, minLat, maxLat } = computeBBox(ring)
  const width = maxLng - minLng
  const h = maxLat - minLat
  const minDim = Math.min(width, h)
  const resolution = Math.max(0.00001, Math.min(minDim / 12, 0.00005))
  const nLng = Math.max(2, Math.ceil(width / resolution))
  const nLat = Math.max(2, Math.ceil(h / resolution))

  const gridTotal = (nLng + 1) * (nLat + 1)
  const targetCount = Math.ceil(gridTotal * 1.5)
  const maxAttempts = targetCount * 4

  const points = []
  for (let k = 0; k < maxAttempts && points.length < targetCount; k++) {
    const lng = minLng + Math.random() * width
    const lat = minLat + Math.random() * h
    if (pointInPolygon(lng, lat, ring)) {
      points.push([lng, lat, roofZ])
    }
  }
  return points
}

/**
 * 墙面随机采样
 * @param {Array<Array<[number, number]>>} coordinates GeoJSON Polygon coordinates
 * @param {number} baseHeight
 * @param {number} height
 * @returns {Array<[number, number, number]>}
 */
function sampleWallPoints(coordinates, baseHeight, height) {
  const ring = coordinates[0].slice(0, -1)
  const n = ring.length
  const nLevels = Math.max(2, Math.ceil(height / 4))
  const SCALE = 1.22
  const points = []

  for (let i = 0; i < n; i++) {
    const [ax, ay] = ring[i]
    const [bx, by] = ring[(i + 1) % n]
    const edgeLen = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2)
    const nEdgeSamples = Math.max(2, Math.ceil(edgeLen / 0.000025 * SCALE))
    const edgeLevels = Math.max(2, Math.ceil(nLevels * SCALE))
    const layerThickness = height / edgeLevels

    for (let s = 0; s < nEdgeSamples; s++) {
      const t = Math.random()
      const lng = ax + t * (bx - ax)
      const lat = ay + t * (by - ay)
      for (let l = 0; l < edgeLevels; l++) {
        const baseZ = baseHeight + (l / edgeLevels) * height
        const altitude = baseZ + (Math.random() - 0.5) * layerThickness
        points.push([lng, lat, altitude])
      }
    }
  }
  return points
}

/**
 * 将单个建筑 Feature 转换为点云坐标数组
 * @param {object} feature GeoJSON Feature
 * @returns {Array<[number, number, number]>}
 */
function convertBuilding(feature) {
  const { height, base_height: baseHeight } = feature.properties
  const roof = sampleRoofPoints(feature.geometry.coordinates, baseHeight, height)
  const walls = sampleWallPoints(feature.geometry.coordinates, baseHeight, height)
  return roof.concat(walls)
}

// ─── 生成点云数据 ──────────────────────────────────────────────────────────────

const pointCloudArrays = MOCK_BUILDINGS.features.map(convertBuilding)
const totalPoints = pointCloudArrays.reduce((sum, arr) => sum + arr.length, 0)

const MOCK_POINT_CLOUD = new Array(totalPoints)
let cursor = 0
for (const arr of pointCloudArrays) {
  for (const pt of arr) {
    MOCK_POINT_CLOUD[cursor++] = pt
  }
}

export { MOCK_POINT_CLOUD }
