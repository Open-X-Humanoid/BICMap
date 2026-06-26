/**
 * 路径规划、坐标修正和运动编排 Vue composable
 *
 * @module useRouteController
 */

import { GraphPathfinder, createGeoUtils, buildGraphCoveragePath, buildGraphPointToPointPath, removeEdgesThroughBuildings } from '@/bicMap/core/navigation'
import { PARK_BUILDINGS, PARK_GRAPH, PARK_INTERSECTIONS, WEIGHT_SCALE } from './parkLayout.js'

/**
 * 创建路径控制器 composable
 *
 * @param {Object} options
 * @param {Object} options.mapConfig - 地图配置 { startX, startY, width, height, scale }
 * @returns {Object} 路径控制器接口
 */
export function useRouteController({ mapConfig, buildings = PARK_BUILDINGS }) {
  let geoUtils = null

  /** 节点 ID → 语意化标签 */
  let nodeLabelMap = {}

  function init() {
    geoUtils = createGeoUtils(mapConfig)
    buildNodeLabelMap()
  }

  /** 构建节点语意化标签 */
  function buildNodeLabelMap() {
    // 1. 交叉路口：按坐标匹配 road_vertex 节点
    const intCoordMap = {}
    for (const intNode of PARK_INTERSECTIONS.nodes) {
      const key = intNode.coordinates[0].toFixed(7) + ',' + intNode.coordinates[1].toFixed(7)
      intCoordMap[key] = intNode.roads.join('×')
    }

    // 2. 遍历 GRAPH 节点生成标签
    for (const node of PARK_GRAPH.nodes) {
      if (node.type === 'entrance') {
        nodeLabelMap[node.id] = node.building + '(入口)'
      } else if (node.type === 'gate') {
        const gateName = PARK_INTERSECTIONS.nodes.find(n => n.name === node.name)?.name || node.name
        nodeLabelMap[node.id] = node.name || '门岗'
      } else if (node.type === 'road_vertex') {
        const key = node.coordinates[0].toFixed(7) + ',' + node.coordinates[1].toFixed(7)
        if (intCoordMap[key]) {
          nodeLabelMap[node.id] = intCoordMap[key]
        } else {
          nodeLabelMap[node.id] = node.id  // 回退到 ID
        }
      } else {
        nodeLabelMap[node.id] = node.id
      }
    }
  }

  /**
   * GPS 坐标 → 分数坐标（线性插值）
   *
   * @param {number} lng - 经度
   * @param {number} lat - 纬度
   * @returns {[number, number]} 分数坐标 [xFrac, yFrac]
   */
  function gpsToFrac(lng, lat) {
    const [refLng0, refLat0] = geoUtils.fracToGPS(0, 0)
    const [refLng1, refLat1] = geoUtils.fracToGPS(1, 1)
    const xFrac = (lng - refLng0) / (refLng1 - refLng0)
    const yFrac = (lat - refLat0) / (refLat1 - refLat0)
    return [xFrac, yFrac]
  }

  /**
   * 规划巡逻路径（返回笛卡尔坐标，供 RobotController.moveTo 使用）
   *
   * @param {Object} graph - 图结构（{ nodes, edges }）
   * @param {string} startNodeId - 起始节点 ID
   * @param {string[]} edgeIds - 需要遍历的边 ID 列表
   * @param {string[]} [excludeNodeIds=[]] - 需排除的节点 ID 列表
   * @returns {[number, number][]|null} 笛卡尔坐标路径数组，无法规划返回 null
   */
  function planPatrolPath(currentGraph, startNodeId, edgeIds, excludeNodeIds = []) {
    const graphPathfinding = new GraphPathfinder(currentGraph)
    const nodeIdCircuit = graphPathfinding.planCircuit(startNodeId, edgeIds, { excludeNodeIds })
    if (!nodeIdCircuit || nodeIdCircuit.length < 2) return null

    // 将建筑物多边形从 GPS 坐标预转为分数坐标（用于碰撞检测）
    const buildingPolygons = buildings.features
      .filter(feature => feature.geometry.type === 'Polygon')
      .map(feature =>
        feature.geometry.coordinates[0].map(([lng, lat]) =>
          gpsToFrac(lng, lat)
        )
      )

    // 使用 buildGraphCoveragePath 完成坐标转换 + 碰撞检测 + 段级验证
    const { coords: validatedPath } = buildGraphCoveragePath(nodeIdCircuit, {
      geoUtils,
      graph: currentGraph,
      buildingPolygons,
      excludeNodeIds,
    })

    return validatedPath
  }

  /**
   * 规划返回路径（沿道路网络）
   *
   * @param {Object} graph - 图结构（{ nodes, edges }）
   * @param {{x: number, y: number}} currentCartesian - 当前位置（笛卡尔坐标）
   * @param {{x: number, y: number}} standbyCartesian - 待机区位置（笛卡尔坐标）
   * @returns {[number, number][]|null} 笛卡尔坐标路径数组，无法规划返回 null
   */
  function planReturnPath(graph, currentCartesian, standbyCartesian) {
    // 将建筑物多边形从 GPS 坐标预转为分数坐标（用于碰撞检测）
    const buildingPolygons = buildings.features
      .filter(feature => feature.geometry.type === 'Polygon')
      .map(feature =>
        feature.geometry.coordinates[0].map(([lng, lat]) =>
          gpsToFrac(lng, lat)
        )
      )

    // 异常边（穿建筑）处理在寻路外部完成：先剔除穿建筑的边，再交给寻路函数
    const cleanGraph = removeEdgesThroughBuildings(graph, { buildingPolygons, geoUtils })

    const result = buildGraphPointToPointPath(
      [{ cart: currentCartesian }, { cart: standbyCartesian }],
      { geoUtils, graph: cleanGraph, weightScale: WEIGHT_SCALE }
    )

    return result ? result.coords : null
  }

  // ─── 访问器 ─────────────────────────────────────────────────────────────

  function getGeoUtils() { return geoUtils }
  function isInitialized() { return geoUtils !== null }

  // ─── 导出 ───────────────────────────────────────────────────────────────

  return {
    init,
    planPatrolPath,
    planReturnPath,
    getGeoUtils,
    isInitialized,
  }
}
