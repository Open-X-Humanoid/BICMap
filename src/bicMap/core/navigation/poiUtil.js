import { pointInPolygon } from './pointUtil.js'

/**
 * 计算点到线段上的最近点。
 * @param {number} px - 点的 x 坐标
 * @param {number} py - 点的 y 坐标
 * @param {number} ax - 线段起点 x
 * @param {number} ay - 线段起点 y
 * @param {number} bx - 线段终点 x
 * @param {number} by - 线段终点 y
 * @returns {[number,number]}
 */
function closestPointOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return [ax, ay]
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return [ax + t * dx, ay + t * dy]
}

/**
 * 通用判断点是否在禁行区内。
 * @param {number} xFrac - 点的 x 坐标（分数坐标）
 * @param {number} yFrac - 点的 y 坐标（分数坐标）
 * @param {{ polygon: [number,number][] }[]} forbiddenZones - 禁行区列表
 * @returns {boolean}
 */
export function isPointInForbiddenZone(xFrac, yFrac, forbiddenZones) {
  if (!forbiddenZones) return false
  for (const zone of forbiddenZones) {
    if (pointInPolygon(xFrac, yFrac, zone.polygon)) {
      return true
    }
  }
  return false
}

/**
 * 找到禁行区边界外最近的推出点。
 * 遍历多边形每条边找到离点最近的线段位置，沿远离多边形方向推出。
 * 适用于将禁止行区内的起点推到边界外。
 *
 * @param {number} xFrac - 点的 x 坐标（分数坐标）
 * @param {number} yFrac - 点的 y 坐标（分数坐标）
 * @param {{ polygon: [number,number][] }[]} forbiddenZones - 禁行区列表
 * @param {number} [pushDistance=0.01] - 推出距离（分数坐标）
 * @returns {[number,number]}
 */
export function findNearestBoundaryPoint(xFrac, yFrac, forbiddenZones, pushDistance = 0.01) {
  const targetShop = forbiddenZones.find(zone => pointInPolygon(xFrac, yFrac, zone.polygon)) || null
  if (!targetShop) return [xFrac, yFrac]

  const polygon = targetShop.polygon
  let minDistSq = Infinity
  let nearest = [xFrac, yFrac]

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[j]
    const [bx, by] = polygon[i]
    const [cx, cy] = closestPointOnSegment(xFrac, yFrac, ax, ay, bx, by)
    const dx = xFrac - cx, dy = yFrac - cy
    const distSq = dx * dx + dy * dy
    if (distSq < minDistSq) {
      minDistSq = distSq
      nearest = [cx, cy]
    }
  }

  const [nx, ny] = nearest
  let ex = xFrac - nx, ey = yFrac - ny
  const len = Math.sqrt(ex * ex + ey * ey)
  if (len > 0) {
    ex /= len
    ey /= len
    return [nx - ex * pushDistance, ny - ey * pushDistance]
  }

  let cxSum = 0, cySum = 0
  for (const [px, py] of polygon) { cxSum += px; cySum += py }
  const centerX = cxSum / polygon.length
  const centerY = cySum / polygon.length
  const dirX = xFrac - centerX, dirY = yFrac - centerY
  const dirLen = Math.sqrt(dirX * dirX + dirY * dirY)
  if (dirLen > 0) {
    ex = dirX / dirLen
    ey = dirY / dirLen
  } else {
    ex = 1; ey = 0
  }
  return [nx + ex * pushDistance, ny + ey * pushDistance]
}

/**
 * 找到禁行区角落附近的推出点。
 * 遍历多边形顶点找到离参考点最近的顶点，沿指向多边形中心的方向推出。
 * 适用于将禁行区内的终点推到角落附近。
 *
 * @param {number} poiXFrac - POI 的 x 坐标（分数坐标）
 * @param {number} poiYFrac - POI 的 y 坐标（分数坐标）
 * @param {number} robotXFrac - 机器人当前 x 坐标（参考点）
 * @param {number} robotYFrac - 机器人当前 y 坐标（参考点）
 * @param {{ polygon: [number,number][] }[]} forbiddenZones - 禁行区列表
 * @param {number} [pushDistance=0.01] - 推出距离（分数坐标）
 * @returns {[number,number]}
 */
export function findForbiddenZoneCornerTarget(poiXFrac, poiYFrac, robotXFrac, robotYFrac, forbiddenZones, pushDistance = 0.01) {
  const targetShop = forbiddenZones.find(zone => pointInPolygon(poiXFrac, poiYFrac, zone.polygon)) || null
  if (!targetShop) return [poiXFrac, poiYFrac]

  const polygon = targetShop.polygon
  let minDistSq = Infinity
  let nearestCorner = null

  for (const [vx, vy] of polygon) {
    const dx = vx - robotXFrac
    const dy = vy - robotYFrac
    const distSq = dx * dx + dy * dy
    if (distSq < minDistSq) {
      minDistSq = distSq
      nearestCorner = [vx, vy]
    }
  }

  let cxSum = 0, cySum = 0
  for (const [px, py] of polygon) {
    cxSum += px
    cySum += py
  }
  const centerX = cxSum / polygon.length
  const centerY = cySum / polygon.length

  const [cx, cy] = nearestCorner
  const dirX = centerX - cx
  const dirY = centerY - cy
  const dirLen = Math.sqrt(dirX * dirX + dirY * dirY)

  const targetX = cx + (dirX / dirLen) * pushDistance
  const targetY = cy + (dirY / dirLen) * pushDistance

  return [targetX, targetY]
}

/**
 * 在多边形外靠近参考点最近的两个顶点处计算一个点。
 * 该点用作机器人在接近位于店铺/禁行区内的 POI 时的"停靠播报"位置。
 *
 * @param {Object} options
 * @param {number} options.poiXFrac - POI 的 x 坐标（分数坐标）
 * @param {number} options.poiYFrac - POI 的 y 坐标（分数坐标）
 * @param {number} options.prevXFrac - 上一个参考点的 x 坐标
 * @param {number} options.prevYFrac - 上一个参考点的 y 坐标
 * @param {{ polygon: [number,number][] }[]} options.forbiddenZones - 禁行区列表
 * @param {number} [options.meterToFrac=0.01] - 推出距离（分数坐标）
 * @returns {[number,number]}
 */
export function findAnnouncementPoint({ poiXFrac, poiYFrac, prevXFrac, prevYFrac, forbiddenZones, meterToFrac = 0.01 }) {
  const shop = forbiddenZones.find(zone => pointInPolygon(poiXFrac, poiYFrac, zone.polygon)) || null

  if (!shop) {
    return [poiXFrac, poiYFrac]
  }

  const uniqueVerts = []
  const seen = new Set()
  for (const vertex of shop.polygon) {
    const key = `${vertex[0]},${vertex[1]}`
    if (!seen.has(key)) {
      seen.add(key)
      uniqueVerts.push(vertex)
    }
  }

  const distances = uniqueVerts.map(vertex => {
    const deltaX = vertex[0] - prevXFrac
    const deltaY = vertex[1] - prevYFrac
    return { vertex, distanceSq: deltaX * deltaX + deltaY * deltaY }
  })
  distances.sort((a, b) => a.distanceSq - b.distanceSq)

  const closest1 = distances[0].vertex
  const closest2 = distances[1].vertex
  const midX = (closest1[0] + closest2[0]) / 2
  const midY = (closest1[1] + closest2[1]) / 2

  const centerX = uniqueVerts.reduce((sum, vertex) => sum + vertex[0], 0) / uniqueVerts.length
  const centerY = uniqueVerts.reduce((sum, vertex) => sum + vertex[1], 0) / uniqueVerts.length

  const directionX = midX - centerX
  const directionY = midY - centerY
  const directionLength = Math.sqrt(directionX * directionX + directionY * directionY)

  if (directionLength === 0) {
    return [midX, midY]
  }

  return [
    midX + (directionX / directionLength) * meterToFrac,
    midY + (directionY / directionLength) * meterToFrac,
  ]
}
