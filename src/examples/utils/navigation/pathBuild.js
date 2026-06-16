import { Pathfinder } from './pathFinding.js'
import { isPointInForbiddenZone, findAnnouncementPoint, findNearestBoundaryPoint, findForbiddenZoneCornerTarget } from './poiUtil.js'

// ─── 模块级 Pathfinder 实例（由 initPathfinder 初始化）─────────────────────────
//
// 调用 initPathfinder(widthMeters, heightMeters) 外部传入地图有效尺寸。
// 所有寻路操作在 [0..1] 分数坐标空间中进行。

/** @type {Pathfinder|null} */
let pathfinderInstance = null
/** 米→分数坐标转换系数，由 initPathfinder 根据传入宽度计算 */
let meterToFrac = 0

/**
 * 初始化 Pathfinder 实例。必须在调用 buildPathfindingRoute 前调用。
 * @param {number} widthMeters - 地图有效宽度（米）
 * @param {number} heightMeters - 地图有效高度（米）
 */
export function initPathfinder(widthMeters, heightMeters) {
  pathfinderInstance = new Pathfinder({ widthMeters, heightMeters })
  meterToFrac = 1.0 / widthMeters
}

// 轻量级障碍网格缓存键 —— 仅在禁行区变化时重新调用 setObstacles。
let lastObstacleKey = null

function ensureObstaclesSet(forbiddenZones) {
  if (!pathfinderInstance) {
    throw new Error('Pathfinder 未初始化，请先调用 initPathfinder(widthMeters, heightMeters)')
  }
  const key = forbiddenZones
    ? forbiddenZones
        .map((zone) => zone.id)
        .sort()
        .join(',')
    : 'default'
  if (lastObstacleKey !== key) {
    pathfinderInstance.setObstacles(forbiddenZones || [])
    lastObstacleKey = key
  }
}

// ─── 内部：禁行区点调整 ───────────────────────────────────────────────────────
//
// 如果点位于禁行区内，调整该点的位置。
// - 如果是段起点：将点推送到最近的边界。
// - 如果是段终点：使用 prevAnnouncementPoint（如果有）寻找出口方向，
//   否则使用角落策略。

function adjustStartPoint(point, forbiddenZones) {
  if (isPointInForbiddenZone(point[0], point[1], forbiddenZones)) {
    return findNearestBoundaryPoint(point[0], point[1], forbiddenZones)
  }
  return point
}

function adjustEndPoint(point, referencePoint, forbiddenZones) {
  if (isPointInForbiddenZone(point[0], point[1], forbiddenZones)) {
    if (referencePoint) {
      return findAnnouncementPoint({
        poiXFrac: point[0],
        poiYFrac: point[1],
        prevXFrac: referencePoint[0],
        prevYFrac: referencePoint[1],
        forbiddenZones,
        meterToFrac
      })
    }
    return findForbiddenZoneCornerTarget(
      point[0],
      point[1],
      referencePoint?.[0] || 0.5,
      referencePoint?.[1] || 0.5,
      forbiddenZones
    )
  }
  return point
}

// ─── 通用路由构建器 ───────────────────────────────────────────────────────────
//
// 接收坐标段列表（起点→终点对）和一个寻路函数，
// 对每个段进行寻路，并在段边界自动去重后展平结果。

/**
 * 构建连续段之间的路由。
 *
 * @param {{ start: [number,number], end: [number,number] }[]} segments
 *   需要寻路的坐标对 [x,y] 的有序列表。
 *   每个段定义一个起点→终点对。
 *
 * @param {(start:[number,number], end:[number,number]) => [number,number][]|null} findPathFn
 *   为每个段调用的寻路函数。应返回 [x,y] 路径点数组
 *   （包含起点和终点），若不可达则返回 null。
 *
 * @returns {{ coords: [number,number][], segmentIndices: number[] }}
 *   coords — 所有段路径点的展平数组。
 *   segmentIndices — 每个段的最后一个路径点在 coords 中的索引
 *     （段边界）。
 */
function buildRoute(segments, findPathFn) {
  if (!segments || segments.length === 0) {
    return { coords: [], segmentIndices: [] }
  }

  const coords = []
  const segmentIndices = []
  let lastCoord = null

  for (const { start, end } of segments) {
    const segmentPath = findPathFn(start, end)

    if (segmentPath && segmentPath.length >= 2) {
      // 如果第一个点与上一段最后一个点重复，则跳过
      const startOffset = lastCoord && segmentPath[0][0] === lastCoord[0] && segmentPath[0][1] === lastCoord[1] ? 1 : 0

      for (let j = startOffset; j < segmentPath.length; j++) {
        coords.push(segmentPath[j])
      }
    } else {
      // 降级处理：至少记录终点
      coords.push(end)
    }

    segmentIndices.push(coords.length - 1)
    lastCoord = coords[coords.length - 1]
  }

  return { coords, segmentIndices }
}

// ─── 公开 API ──────────────────────────────────────────────────────────────

/**
 * 构建单个机器人的寻路路线：途径点间 A* 寻路
 * @param {number[][]} points - 点坐标数组，points[0] 为起点，points[1..n] 为播报点
 * @param {Object[]} forbiddenZones - 禁行区多边形列表 [{ id, polygon: [[x,y],...] }]
 * @returns {{ coords: number[][], poiIndices: number[] }}
 */
export function buildPathfindingRoute(points, forbiddenZones) {
  if (!points || points.length < 2) return { coords: [], poiIndices: [] }

  ensureObstaclesSet(forbiddenZones)

  const segments = []

  // 构建连续点之间的段，最后一个段闭合回起点
  for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
    const current = points[pointIndex]
    const next = points[(pointIndex + 1) % points.length]

    segments.push({
      start: adjustStartPoint(current, forbiddenZones),
      end: adjustEndPoint(next, current, forbiddenZones)
    })
  }

  // 委托给通用路由构建器
  const result = buildRoute(segments, (start, end) => pathfinderInstance.findPath(start, end))

  // poiIndices：每个播报路径点对应一个索引（除闭合段外的所有段）
  const poiIndexList = result.segmentIndices.slice(0, -1)

  // ===== 后处理：验证路径段未穿过禁行区 =====
  const validatedCoords = validatePathSegments(result.coords, forbiddenZones, (start, end) =>
    pathfinderInstance.findPath(start, end)
  )

  return { coords: validatedCoords, poiIndices: poiIndexList }
}

/**
 * 后处理验证：检测路径段是否穿过禁行区，如果有则插入锚点重新寻路
 * @param {number[][]} coords - 路径坐标数组
 * @param {Object[]} forbiddenZones - 禁行区列表
 * @param {Function} findPathFn - 寻路函数
 * @returns {number[][]} 修复后的路径坐标数组
 */
function validatePathSegments(coords, forbiddenZones, findPathFn) {
  if (!coords || coords.length < 2 || !forbiddenZones || forbiddenZones.length === 0) return coords

  const result = [coords[0]]

  for (let i = 1; i < coords.length; i++) {
    const prev = result[result.length - 1]
    const current = coords[i]

    // 检查段 prev→current 是否与任何禁行区相交
    if (lineSegmentIntersectsAnyZone(prev[0], prev[1], current[0], current[1], forbiddenZones)) {
      // 插入中点作为锚点并重新寻路
      const midX = (prev[0] + current[0]) / 2
      const midY = (prev[1] + current[1]) / 2
      const midPath = findPathFn(prev, [midX, midY])

      if (midPath && midPath.length >= 2) {
        // 添加 midPath 点（跳过与 prev 重复的第一个点）
        for (let j = 1; j < midPath.length; j++) {
          result.push(midPath[j])
        }
      } else {
        // 降级处理：直接添加当前点
        result.push(current)
      }
    } else {
      result.push(current)
    }
  }

  return result
}

/**
 * 几何级线段-多边形相交检测
 */
function lineSegmentIntersectsAnyZone(x1, y1, x2, y2, zones) {
  for (const zone of zones) {
    const poly = zone.polygon
    if (!poly || poly.length < 3) continue
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [cx, cy] = poly[i]
      const [dx, dy] = poly[j]
      if (segmentsIntersect(x1, y1, x2, y2, cx, cy, dx, dy)) {
        return true
      }
    }
  }
  return false
}

/**
 * 两线段相交检测
 */
function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1x = bx - ax,
    d1y = by - ay
  const d2x = dx - cx,
    d2y = dy - cy
  const cross = d1x * d2y - d1y * d2x
  if (Math.abs(cross) < 1e-10) return false
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / cross
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / cross
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}

/**
 * 路线 ID 数组 → 坐标数组
 * @param {string[]} routeIdList
 * @param {Object[]} allPois
 * @returns {number[][]}
 */
export function routeIdsToCoords(routeIdList, allPois) {
  if (!routeIdList?.length) return []
  const poiMap = new Map(allPois.map((poi) => [poi.id, poi]))
  return routeIdList.map((routeId) => {
    const poi = poiMap.get(routeId)
    return poi ? [poi.xFrac, poi.yFrac] : [0.5, 0.5]
  })
}
