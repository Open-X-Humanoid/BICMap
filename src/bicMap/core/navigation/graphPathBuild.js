import { pointInPolygon, lineSegmentIntersectsPolygon } from './pointUtil.js'
import { findNearestBoundaryPoint } from './poiUtil.js'
import { GraphPathfinder } from './graphPathFinding.js'

/*
 * @FilePath: /bic-map/src/bicMap/core/navigation/graphPathBuild.js
 * 对每个段进行寻路，并在段边界自动去重后展平结果。
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
 *   segmentIndices — 每个段的最后一个路径点在 coords 中的索引（段边界）。
 */
export function buildRoute(segments, findPathFn) {
  if (!segments || segments.length === 0) {
    return { coords: [], segmentIndices: [] }
  }

  const coords = []
  const segmentIndices = []
  let lastCoord = null

  for (const { start, end } of segments) {
    const segmentPath = findPathFn(start, end)

    if (segmentPath && segmentPath.length >= 2) {
      const startOffset = lastCoord && segmentPath[0][0] === lastCoord[0] && segmentPath[0][1] === lastCoord[1] ? 1 : 0

      for (let pointIndex = startOffset; pointIndex < segmentPath.length; pointIndex++) {
        coords.push(segmentPath[pointIndex])
      }
    } else {
      coords.push(end)
    }

    segmentIndices.push(coords.length - 1)
    lastCoord = coords[coords.length - 1]
  }

  return { coords, segmentIndices }
}

/**
 * 通用路径验证中间件。
 *
 * 遍历路径点，使用可插拔的 validator 检查每对相邻点组成的段是否有效。
 * 若无效，则调用 repairFn 进行修复并替换该段。
 *
 * @param {[number,number][]} coords - 路径坐标数组
 * @param {Object} options
 * @param {Function} options.validator - 验证函数 (prev, current) => boolean
 *   返回 true 表示段有效，false 表示需要修复
 * @param {Function} options.repairFn - 修复函数 (prev, current, index, context) => [number,number][]
 *   当段无效时的修复逻辑。返回修复后的路径点数组（含 current），
 *   第一个点应与 prev 相同（会被跳过以去重）
 * @returns {[number,number][]} 修复后的路径
 */
export function validatePathSegments(coords, options) {
  if (!coords || coords.length < 2) return coords

  const { validator, repairFn } = options
  const result = [coords[0]]

  for (let i = 1; i < coords.length; i++) {
    const prev = result[result.length - 1]
    const current = coords[i]

    if (validator(prev, current)) {
      result.push(current)
    } else {
      const repaired = repairFn(prev, current, i, { fullPath: coords })
      if (repaired && repaired.length > 1) {
        for (let pointIndex = 1; pointIndex < repaired.length; pointIndex++) {
          result.push(repaired[pointIndex])
        }
      } else {
        result.push(current)
      }
    }
  }

  return result
}

/**
 * 创建可配置的路径验证器工厂。
 *
 * 封装碰撞检测与段修复逻辑，返回可直接作用于路径坐标数组的验证函数。
 *
 * @param {Object} config
 * @param {Function} [config.collisionCheck] - (x1, y1, x2, y2) => boolean
 *   检测线段是否穿过障碍物
 * @param {Function} [config.onSegmentInvalid] - (prev, current, index, context) => [number,number][]
 *   当段无效时的修复逻辑。context 包含 { fullPath } 等上下文
 * @param {number} [config.maxDeviation] - 最大允许偏差（用于精度验证）
 * @param {Function} [config.deviationCheck] - (point, originalPoint) => boolean
 *   精度验证函数
 * @returns {Function} validate(coords) => [number,number][]
 *   接收路径坐标数组，返回验证/修复后的路径
 */
export function createPathValidator(config) {
  const { collisionCheck, onSegmentInvalid, deviationCheck } = config

  return function validatePath(coords) {
    if (!coords || coords.length < 2) return coords

    const result = [coords[0]]

    for (let i = 1; i < coords.length; i++) {
      const prev = result[result.length - 1]
      const current = coords[i]

      let segmentValid = true
      if (collisionCheck) {
        segmentValid = !collisionCheck(prev[0], prev[1], current[0], current[1])
      }

      let precisionValid = true
      if (deviationCheck) {
        precisionValid = deviationCheck(current, coords[i])
      }

      if (segmentValid && precisionValid) {
        result.push(current)
        continue
      }

      if (!segmentValid && onSegmentInvalid) {
        const repaired = onSegmentInvalid(prev, current, i, { fullPath: coords })
        if (repaired && repaired.length > 1) {
          for (let pointIndex = 1; pointIndex < repaired.length; pointIndex++) {
            result.push(repaired[pointIndex])
          }
        } else {
          result.push(current)
        }
      } else {
        result.push(current)
      }
    }

    return result
  }
}

/**
 * 将点投影到最近的图边上（分数坐标），确保路径点不脱离道路网络。
 *
 * @param {number} xFrac - 点的 x 分数坐标
 * @param {number} yFrac - 点的 y 分数坐标
 * @param {Object} graph - 图结构（{ nodes, edges }）
 * @param {Object} nodeIndex - 节点索引 { nodeId: [lng, lat] }
 * @param {Function} gpsToFracFn - GPS 转分数坐标的函数 (lng, lat) => [xFrac, yFrac]
 * @returns {[number, number]} 投影后的分数坐标
 */
export function projectToNearestGraphEdge(xFrac, yFrac, graph, nodeIndex, gpsToFracFn) {
  let minDistanceSq = Infinity
  let bestProjection = [xFrac, yFrac]

  for (const edge of graph.edges) {
    const fromNodeGps = nodeIndex[edge.from]
    const toNodeGps = nodeIndex[edge.to]
    if (!fromNodeGps || !toNodeGps) continue

    const [axFrac, ayFrac] = gpsToFracFn(fromNodeGps[0], fromNodeGps[1])
    const [bxFrac, byFrac] = gpsToFracFn(toNodeGps[0], toNodeGps[1])

    const dx = bxFrac - axFrac
    const dy = byFrac - ayFrac
    const lengthSq = dx * dx + dy * dy
    if (lengthSq === 0) continue

    let t = ((xFrac - axFrac) * dx + (yFrac - ayFrac) * dy) / lengthSq
    t = Math.max(0, Math.min(1, t))

    const projectionXFrac = axFrac + t * dx
    const projectionYFrac = ayFrac + t * dy

    const distanceSq = (projectionXFrac - xFrac) * (projectionXFrac - xFrac)
      + (projectionYFrac - yFrac) * (projectionYFrac - yFrac)
    if (distanceSq < minDistanceSq) {
      minDistanceSq = distanceSq
      bestProjection = [projectionXFrac, projectionYFrac]
    }
  }

  return bestProjection
}

/**
 * 构建基于图结构的巡逻路径。
 *
 * 对标 pathBuild.js 的 buildPathfindingRoute（网格路径构建），此函数提供
 * 基于图拓扑的巡逻路径构建能力。完整管线：
 *   nodeId → GPS → 分数坐标 → (碰撞检测 → 图边投影) → 笛卡尔坐标 → 段级验证
 *
 * @param {string[]} nodeIdCircuit - 图节点 ID 的有序列表（巡逻回路）
 * @param {Object} options
 * @param {Object} options.geoUtils - 坐标工具集（需含 fracToCart, cartToGPS, fracToGPS）
 * @param {Object} options.graph - 图结构（{ nodes, edges }）
 * @param {[number,number][][]} options.buildingPolygons - 建筑物多边形列表（分数坐标）
 * @param {string[]} [options.excludeNodeIds=[]] - 需排除的节点 ID
 * @param {Function} [options.onRerouteLog] - 重路由日志回调 ({ from, to, altLength }) => void
 * @returns {{ coords: [number,number][], reRouteCount: number }}
 *   coords — 验证后的笛卡尔坐标路径 [x, y] 数组
 *   reRouteCount — 重路由的段数
 */
export function buildGraphCoveragePath(nodeIdCircuit, options) {
  const {
    geoUtils,
    graph,
    buildingPolygons,
    excludeNodeIds = [],
    onRerouteLog = null,
  } = options

  // 从 geoUtils 派生固定坐标转换函数
  function gpsToFrac(lng, lat) {
    const [refLng0, refLat0] = geoUtils.fracToGPS(0, 0)
    const [refLng1, refLat1] = geoUtils.fracToGPS(1, 1)
    const xFrac = (lng - refLng0) / (refLng1 - refLng0)
    const yFrac = (lat - refLat0) / (refLat1 - refLat0)
    return [xFrac, yFrac]
  }
  const fracToCart = (xFrac, yFrac) => geoUtils.fracToCart(xFrac, yFrac)
  const cartToGPS = (x, y) => geoUtils.cartToGPS(x, y)

  // 从 graph 构造内部图寻路实例
  const graphPathfinding = new GraphPathfinder(graph)

  // Step 1: 坐标转换 + 碰撞检测 + 图边投影
  const rawCoords = []
  for (const nodeId of nodeIdCircuit) {
    const [lng, lat] = graphPathfinding.nodeIndex[nodeId]
    const [xFrac, yFrac] = gpsToFrac(lng, lat)

    let currentXFrac = xFrac
    let currentYFrac = yFrac
    const collisionCorrection = validateCollision(currentXFrac, currentYFrac, buildingPolygons)
    if (collisionCorrection) {
      currentXFrac = collisionCorrection[0]
      currentYFrac = collisionCorrection[1]
      const projectedPoint = projectToNearestGraphEdge(
        currentXFrac, currentYFrac,
        graph, graphPathfinding.nodeIndex,
        gpsToFrac
      )
      currentXFrac = projectedPoint[0]
      currentYFrac = projectedPoint[1]
    }

    const cartesianPoint = fracToCart(currentXFrac, currentYFrac)
    rawCoords.push([cartesianPoint.x, cartesianPoint.y])
  }

  // Step 2: 段级穿越建筑检测与重路由
  let reRouteCount = 0
  const segmentValidator = createPathValidator({
    collisionCheck: (cartX1, cartY1, cartX2, cartY2) => {
      const [backLng1, backLat1] = cartToGPS(cartX1, cartY1)
      const [backLng2, backLat2] = cartToGPS(cartX2, cartY2)
      const [fracX1, fracY1] = gpsToFrac(backLng1, backLat1)
      const [fracX2, fracY2] = gpsToFrac(backLng2, backLat2)
      for (const polygon of buildingPolygons) {
        if (lineSegmentIntersectsPolygon(fracX1, fracY1, fracX2, fracY2, polygon)) return true
      }
      return false
    },
    onSegmentInvalid: (prevCart, currentCart, segmentIndex) => {
      const currentGps = cartToGPS(prevCart[0], prevCart[1])
      const nextGps = cartToGPS(currentCart[0], currentCart[1])
      const startNode = graphPathfinding.findNearestNode(currentGps[0], currentGps[1])
      const endNode = graphPathfinding.findNearestNode(nextGps[0], nextGps[1])

      if (startNode && endNode && startNode.id !== endNode.id) {
        const alternativePath = graphPathfinding.findPath(startNode.id, endNode.id, { excludeNodeIds })
        if (alternativePath && alternativePath.length > 1) {
          const altCartesianPath = alternativePath.slice(1).map(altNodeId => {
            const [altLng, altLat] = graphPathfinding.nodeIndex[altNodeId]
            const [altXFrac, altYFrac] = gpsToFrac(altLng, altLat)
            let finalXFrac = altXFrac
            let finalYFrac = altYFrac
            const collisionCheck = validateCollision(finalXFrac, finalYFrac, buildingPolygons)
            if (collisionCheck) {
              finalXFrac = collisionCheck[0]
              finalYFrac = collisionCheck[1]
              const proj = projectToNearestGraphEdge(finalXFrac, finalYFrac, graph, graphPathfinding.nodeIndex, gpsToFrac)
              finalXFrac = proj[0]
              finalYFrac = proj[1]
            }
            const cartPt = fracToCart(finalXFrac, finalYFrac)
            return [cartPt.x, cartPt.y]
          })
          reRouteCount++
          if (onRerouteLog) {
            onRerouteLog({ from: startNode.id, to: endNode.id, altLength: altCartesianPath.length })
          }
          return [prevCart, ...altCartesianPath]
        }
      }
      console.warn(`[GraphPatrolRoute] 重路由失败: 段 ${segmentIndex - 1}→${segmentIndex} 无法找到替代路径`)
      return null
    },
  })

  const validatedCoords = segmentValidator(rawCoords)
  return { coords: validatedCoords, reRouteCount }
}

/**
 * 临时吸附边权重缩放默认值——需与 parkLayout.js 的 WEIGHT_SCALE 保持一致，
 * 使临时吸附边与图内已有边的权重处于同一量纲（GPS 度 → 整数权重）。
 * 可通过 options.weightScale 覆盖。
 */
export const DEFAULT_GRAPH_WEIGHT_SCALE = 85000

/** 线段内部穿建筑采样段数默认值，可通过 options.sampleSteps 覆盖。 */
export const DEFAULT_BUILDING_SAMPLE_STEPS = 24

/**
 * 剔除图中任何"内部穿过建筑"的边，返回新的图对象（节点不变，仅过滤边）。
 *
 * 该函数把"异常边处理"从寻路逻辑中独立出来：调用方在寻路前先用本函数清理图，
 * 再把干净图交给 buildGraphPointToPointPath。后者只负责用传入的边创建通路。
 *
 * @param {Object} graph - 图结构（{ nodes, edges }）
 * @param {Object} options
 * @param {[number,number][][]} options.buildingPolygons - 建筑物多边形列表（分数坐标）
 * @param {Object} options.geoUtils - 坐标工具集（需含 fracToGPS）
 * @param {number} [options.sampleSteps=DEFAULT_BUILDING_SAMPLE_STEPS] - 线段穿建筑判定的采样段数
 * @returns {{ nodes: Object[], edges: Object[] }} 过滤后的新图（穿建筑的边已移除）
 */
export function removeEdgesThroughBuildings(graph, options = {}) {
  const { buildingPolygons = [], geoUtils, sampleSteps = DEFAULT_BUILDING_SAMPLE_STEPS } = options
  if (!buildingPolygons.length || !geoUtils) return graph

  const nodeIndex = new GraphPathfinder(graph).nodeIndex

  function gpsToFrac(lng, lat) {
    const [refLng0, refLat0] = geoUtils.fracToGPS(0, 0)
    const [refLng1, refLat1] = geoUtils.fracToGPS(1, 1)
    return [(lng - refLng0) / (refLng1 - refLng0), (lat - refLat0) / (refLat1 - refLat0)]
  }

  function segmentCrossesBuilding(aGps, bGps) {
    const [ax, ay] = gpsToFrac(aGps[0], aGps[1])
    const [bx, by] = gpsToFrac(bGps[0], bGps[1])
    for (const polygon of buildingPolygons) {
      for (let k = 1; k < sampleSteps; k++) {
        const t = k / sampleSteps
        if (pointInPolygon(ax + (bx - ax) * t, ay + (by - ay) * t, polygon)) return true
      }
    }
    return false
  }

  const edges = graph.edges.filter(edge => {
    const a = nodeIndex[edge.from]
    const b = nodeIndex[edge.to]
    if (!a || !b) return false
    return !segmentCrossesBuilding(a, b)
  })

  return { ...graph, edges }
}

/**
 * 构建基于图结构的最短路径（支持途经点）。
 *
 * 只负责"用传入的边创建通路"：异常边（如穿建筑）需由调用方在传入前剔除
 * （见 removeEdgesThroughBuildings）。管线：
 *   1. 将非节点输入（GPS/笛卡尔）吸附到最近道路边的投影点（location snapping），
 *      必要时插入临时节点拆分该边；
 *   2. 在增广图上跑 A* 求最短路；
 *   3. 直接输出沿边的折线坐标。
 *
 * 输入点支持以下格式：
 *   - 字符串: 图节点 ID（如 "N1"）
 *   - { nodeId: string } - 图节点 ID
 *   - { gps: [lng, lat] } - GPS 坐标
 *   - { cart: {x, y} } - 笛卡尔坐标
 *
 * @param {(Object|string)[]} points - 有序路径点列表，至少 2 个：[起点, ...途经点, 终点]
 * @param {Object} options
 * @param {Object} options.geoUtils - 坐标工具集（需含 fracToCart, cartToGPS, fracToGPS）
 * @param {Object} options.graph - 图结构（{ nodes, edges }），应为调用方已清理好的图
 * @param {string[]} [options.excludeNodeIds=[]] - 需排除的节点 ID
 * @param {number} [options.weightScale=DEFAULT_GRAPH_WEIGHT_SCALE] - 临时吸附边权重缩放（需与建图层 WEIGHT_SCALE 一致）
 * @returns {{ coords: [number,number][], reRouteCount: number }|null}
 *   成功返回沿道路的笛卡尔坐标路径，无法规划返回 null
 */
export function buildGraphPointToPointPath(points, options) {
  const {
    geoUtils,
    graph,
    excludeNodeIds = [],
    weightScale = DEFAULT_GRAPH_WEIGHT_SCALE,
  } = options
  const cartToGPS = (x, y) => geoUtils.cartToGPS(x, y)
  const fracToCart = (xFrac, yFrac) => geoUtils.fracToCart(xFrac, yFrac)

  if (!points || points.length < 2) return null

  // GPS → 分数坐标转换
  function gpsToFrac(lng, lat) {
    const [refLng0, refLat0] = geoUtils.fracToGPS(0, 0)
    const [refLng1, refLat1] = geoUtils.fracToGPS(1, 1)
    const xFrac = (lng - refLng0) / (refLng1 - refLng0)
    const yFrac = (lat - refLat0) / (refLat1 - refLat0)
    return [xFrac, yFrac]
  }

  const baseNodeIndex = new GraphPathfinder(graph).nodeIndex

  // ── 增广图：原节点 + 传入的边，后续按需插入临时吸附节点/边 ──
  // 本函数只负责用"传入的边"创建通路；异常边（如穿建筑）应由调用方在
  // 传入前自行剔除（见 removeEdgesThroughBuildings）。
  const augNodes = [...graph.nodes]
  const augEdges = [...graph.edges]
  let snapSeq = 0

  // 将任意 GPS 点吸附到最近道路边的投影点（行业标准 location snapping）。
  // 返回可用于寻路的节点 ID（可能是已有端点，或新插入的临时节点）。
  function snapGpsToGraph(gps) {
    let best = null
    for (const edge of graph.edges) {
      const a = baseNodeIndex[edge.from]
      const b = baseNodeIndex[edge.to]
      if (!a || !b) continue
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const lengthSq = dx * dx + dy * dy
      if (lengthSq === 0) continue
      let t = ((gps[0] - a[0]) * dx + (gps[1] - a[1]) * dy) / lengthSq
      t = Math.max(0, Math.min(1, t))
      const px = a[0] + t * dx
      const py = a[1] + t * dy
      const dist = Math.hypot(px - gps[0], py - gps[1])
      if (!best || dist < best.dist) {
        best = { dist, edge, t, px, py }
      }
    }

    if (!best) return null

    const EPSILON = 1e-7
    if (best.t <= EPSILON) return best.edge.from
    if (best.t >= 1 - EPSILON) return best.edge.to

    const aId = best.edge.from
    const bId = best.edge.to
    const a = baseNodeIndex[aId]
    const b = baseNodeIndex[bId]
    const snapId = `__snap_${snapSeq++}__`
    augNodes.push({ id: snapId, type: 'snap', coordinates: [best.px, best.py] })
    augEdges.push({
      id: `${snapId}-a`,
      from: snapId, to: aId,
      weight: Math.round(Math.hypot(best.px - a[0], best.py - a[1]) * weightScale),
    })
    augEdges.push({
      id: `${snapId}-b`,
      from: snapId, to: bId,
      weight: Math.round(Math.hypot(best.px - b[0], best.py - b[1]) * weightScale),
    })
    return snapId
  }

  // 将输入点解析为 GPS 坐标
  function resolveToGps(point) {
    if (typeof point === 'string') return baseNodeIndex[point] || null
    if (point.nodeId) return baseNodeIndex[point.nodeId] || null
    if (point.gps) return point.gps
    if (point.cart) {
      const [lng, lat] = cartToGPS(point.cart.x, point.cart.y)
      return [lng, lat]
    }
    return null
  }

  // 解析所有点为寻路节点 ID（显式 nodeId 直接使用，其余吸附到道路边）
  const refIds = []
  for (const point of points) {
    const gps = resolveToGps(point)
    if (!gps) return null

    let refId
    if (typeof point === 'string') {
      refId = point
    } else if (point.nodeId) {
      refId = point.nodeId
    } else {
      refId = snapGpsToGraph(gps)
    }
    if (!refId) return null
    refIds.push(refId)
  }

  // 构建增广图寻路实例（A*，沿边求最短路）
  const pathfinder = new GraphPathfinder({ nodes: augNodes, edges: augEdges })

  // 逐段 A* 寻路并拼接
  const fullNodePath = []
  for (let pointIndex = 0; pointIndex < refIds.length - 1; pointIndex++) {
    const fromId = refIds[pointIndex]
    const toId = refIds[pointIndex + 1]

    if (fromId === toId) {
      if (fullNodePath.length === 0) fullNodePath.push(fromId)
      continue
    }

    const segmentPath = pathfinder.findPath(fromId, toId, { excludeNodeIds })
    if (!segmentPath || segmentPath.length < 2) {
      // 不可达：返回 null 而非直连，避免产生穿越非道路区域的直线
      console.warn(`[buildGraphPointToPointPath] 段 ${fromId}→${toId} 不可达`)
      return null
    }

    const startOffset = fullNodePath.length > 0 && segmentPath[0] === fullNodePath[fullNodePath.length - 1] ? 1 : 0
    for (let pathIndex = startOffset; pathIndex < segmentPath.length; pathIndex++) {
      fullNodePath.push(segmentPath[pathIndex])
    }
  }

  if (fullNodePath.length < 2) {
    return { coords: [], reRouteCount: 0 }
  }

  // 节点序列 → 笛卡尔坐标（路径全程严格沿传入的边）
  const augNodeIndex = pathfinder.nodeIndex
  const coords = []
  for (const nodeId of fullNodePath) {
    const [lng, lat] = augNodeIndex[nodeId]
    const [xFrac, yFrac] = gpsToFrac(lng, lat)
    const cartPt = fracToCart(xFrac, yFrac)
    coords.push([cartPt.x, cartPt.y])
  }

  return { coords, reRouteCount: 0 }
}

/**
 * 碰撞检测辅助函数：检查点是否在建筑物多边形内，若是则修正到边界外。
 *
 * @param {number} xFrac - 点的 x 分数坐标
 * @param {number} yFrac - 点的 y 分数坐标
 * @param {[number,number][][]} buildingPolygons - 建筑物多边形列表
 * @returns {[number,number]|null} 修正后的分数坐标，无碰撞返回 null
 */
export function validateCollision(xFrac, yFrac, buildingPolygons) {
  for (const polygon of buildingPolygons) {
    if (pointInPolygon(xFrac, yFrac, polygon)) {
      return findNearestBoundaryPoint(xFrac, yFrac, [{ polygon }])
    }
  }
  return null
}
