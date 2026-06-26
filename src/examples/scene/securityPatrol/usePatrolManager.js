/*
 * @Description: 安防巡检机器人管理器（重构版）
 *   多机器人 GPS 路点巡逻、运动状态机、安防告警触发、电量衰减、FOV 扇形、相机跟随
 *   依赖 useRobotEngine（引擎管理）+ useRouteController（路径规划+坐标修正）+ useBatteryManager（电量管理）
 *
 *   核心修复：planGraphCircuit 返回笛卡尔坐标，但之前被当作 ENU 传给 toFracWaypoints，
 *   导致分数坐标计算错误，表现为运动漂移。现在由 useRouteController 统一做 cartToENU 转换。
 */
import { ref, computed, onBeforeUnmount } from 'vue'
import bicMap from '@/bicMap/core/bicmap-gl'
import { addStatusRobotMarkers, ROBOT_STATUS, RobotPhase } from '@/bicMap/core/robot'
import { createIoTBubbles } from '@/bicMap/core/overlay'
import { createGeoUtils } from '@/bicMap/core/navigation'
import { PARK_GRAPH, PARK_BUILDINGS, PARK_SEMANTIC_ZONES } from './parkLayout'
import { useRobotEngine } from './useRobotEngine.js'
import { useRouteController } from './useRouteController.js'
import { useBatteryManager } from './useBatteryManager.js'
import {
  ROBOT_CONFIGS,
  PATROL_ROUTE_CONFIGS,
  ROBOT_STANDBY_POSITIONS,
  SIMULATED_EVENT_TYPES,
  SIMULATED_EVENT_TEMPLATES,
  FOV_CONFIG,
  LOW_BATTERY_THRESHOLD,
  BATTERY_WARNING_THRESHOLD,
  RECALL_SPEED_MULTIPLIER,
  EVENT_REPORT_INTERVAL,
} from './constants'

// --- ENU 地图配置 ----------------------------------------------------------------

const MAP_CONFIG = {
  startX: -58.999993705749512,
  startY: -21.349997329711914,
  width: 137.6,
  height: 76.8,
  scale: 1,
}

// --- 禁行区障碍物（转换为分数坐标，供 Pathfinder 使用）----------------------------

function buildObstacles() {
  const gpsZones = [
    ...(PARK_SEMANTIC_ZONES.features || [])
      .filter(feature => feature.properties?.zoneType === 'forbidden')
      .map(feature => feature.geometry?.coordinates?.[0] || [])
      .filter(coords => coords.length > 0),
    ...(PARK_BUILDINGS.features || [])
      .filter(feature => feature.properties?.name !== '机器人待机区')
      .map(feature => feature.geometry?.coordinates?.[0] || [])
      .filter(coords => coords.length > 0),
  ]

  const obstacles = []
  for (const gpsPolygon of gpsZones) {
    const polygon = gpsPolygon.map(([lng, lat]) => {
      const [xFrac, yFrac] = gpsToFrac(lng, lat)
      return [xFrac, yFrac]
    })
    obstacles.push({ polygon })
  }
  return obstacles
}

/** 辅助：GPS -> 分数坐标 */
function gpsToFrac(lng, lat) {
  const [refLng0, refLat0] = geoUtils.fracToGPS(0, 0)
  const [refLng1, refLat1] = geoUtils.fracToGPS(1, 1)
  const xFrac = (lng - refLng0) / (refLng1 - refLng0)
  const yFrac = (lat - refLat0) / (refLat1 - refLat0)
  return [xFrac, yFrac]
}

/** geoUtils 实例（由 init 延迟初始化） */
let geoUtils = null

let obstacles = []

// --- 图结构工具（用于初始标注定位）--------------------------------------------------

/** 两点间欧氏距离（GPS 度空间） */
function segmentDistance(pointFrom, pointTo) {
  const deltaX = pointTo[0] - pointFrom[0]
  const deltaY = pointTo[1] - pointFrom[1]
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY)
}

/** 构建节点 ID -> 坐标索引 */
function buildNodeIndex() {
  const nodeIndex = {}
  for (const node of PARK_GRAPH.nodes) {
    nodeIndex[node.id] = node.coordinates
  }
  return nodeIndex
}

// --- 模拟安防事件报告 -----------------------------------------------------------------

function weightedRandomType() {
  const randomValue = Math.random()
  if (randomValue < 0.18) return 'MOTION_DETECTED'
  if (randomValue < 0.36) return 'PERIMETER_BREACH'
  if (randomValue < 0.52) return 'UNAUTHORIZED_ACCESS'
  if (randomValue < 0.68) return 'VEHICLE_ALERT'
  if (randomValue < 0.84) return 'DOOR_OPEN'
  return 'TEMPERATURE_ALERT'
}

function generateSimulatedEvent(robotState) {
  const { id: robotId, name: robotName, position } = robotState
  const eventType = weightedRandomType()
  const eventConfig = SIMULATED_EVENT_TYPES[eventType] || SIMULATED_EVENT_TYPES.MOTION_DETECTED
  const templates = SIMULATED_EVENT_TEMPLATES[eventType] || SIMULATED_EVENT_TEMPLATES.MOTION_DETECTED

  const template = templates[Math.floor(Math.random() * templates.length)]
  const description = template.replace(/\{poi\}/g, '园区道路')

  return {
    id:         'sim-event-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    time:       new Date(),
    robotId,
    robotName,
    position:   position ? { lng: position.lng, lat: position.lat } : null,
    nearbyPoi: '园区道路',
    eventType,
    label:      eventConfig.label,
    icon:       eventConfig.icon,
    color:      eventConfig.color,
    level:      eventConfig.level,
    description,
    severity:   eventConfig.level,
  }
}

// ─── 路线 GeoJSON 图层 ID 常量 ──────────────────────────────────────────────

const ROUTE_SOURCE_PREFIX = 'patrol-route-'
const ROUTE_LAYER_CASING_PREFIX = 'patrol-route-casing-'
const ROUTE_LAYER_LINE_PREFIX = 'patrol-route-line-'

// --- 主 composable --------------------------------------------------------------------

/**
 * usePatrolManager
 *
 * @param {object} options
 * @param {() => import('maplibre-gl').Map | null} options.getMap
 * @param {import('vue').Ref<boolean>} [options.is3D]
 */
export function usePatrolManager({ getMap, is3D }) {
  // --- 响应式状态 --------------------------------------------------------------------

  const robots       = ref(ROBOT_CONFIGS.map(config => ({ ...config })))
  const isRunning    = ref(false)
  const alerts       = ref([])
  const simulatedEvents = ref([])

  // --- 运行时对象（非响应式，性能优先）------------------------------------------------

  let robotMarkerController = null
  let iotBubbles = null
  let robotEngine = null
  let routeController = null
  let batteryManager = null
  let animationFrameId = 0
  let initialized = false
  let nodeIndex = {}
  let lastTickTime = 0

  // --- 主 RAF 循环 -----------------------------------------------------------------

  function mainTick() {
    const mapInstance = getMap()
    if (!mapInstance || !robotEngine) { animationFrameId = 0; return }

    const currentTime = performance.now()
    let deltaTime = lastTickTime ? currentTime - lastTickTime : 16
    lastTickTime = currentTime

    // 驱动机器人引擎
    const snapshot = robotEngine.tick(deltaTime)

    for (const robotState of robots.value) {
      const engineState = snapshot[robotState.id]
      if (!engineState) continue

      const { position, heading, phase, battery } = engineState

      // 同步电量
      robotState.battery = battery

      // 低电量检查（由 BatteryManager 处理）
      batteryManager.checkBatteryAndReturn(robotState.id, battery, phase)

      // 低电量预警检查
      batteryManager.checkBatteryWarning(robotState.id, battery)

      // 更新机器人标记（position 为笛卡尔坐标，直接用 cartToGPS）
      const gpsPosition = routeController.getGeoUtils().cartToGPS(position.x, position.y)
      const rotationAngle = iconRot(heading)

      // 同步任务状态到 robots 列表
      const taskStatus = engineState.taskStatus
      if (taskStatus === 'COMPLETED' || taskStatus === 'IDLE') {
        if (phase === 'CHARGING') {
          robotState.status = ROBOT_STATUS.CHARGING
          robotState.task = '充电中'
        } else if (phase === 'MOVING') {
          robotState.status = ROBOT_STATUS.RUNNING
          robotState.task = '巡逻中'
        } else {
          robotState.status = ROBOT_STATUS.IDLE
          robotState.task = '待命'
        }
      }

      robotMarkerController.updateRobot(robotState.id, {
        lngLat:   gpsPosition,
        rotation: rotationAngle,
        status:   robotState.status,
        battery:  robotState.battery,
        task:     robotState.task,
      })

      // 更新 FOV（position 已是笛卡尔坐标，无需转换）
      robotEngine.updateFOV(robotState.id, position, heading)
    }

    animationFrameId = requestAnimationFrame(mainTick)
  }

  /** 将语义朝向(0度=正北)转为图标旋转角（robo.png 默认朝东） */
  function iconRot(heading) {
    return (heading - 90 + 360) % 360
  }

  // --- 初始化 -----------------------------------------------------------------------

  function init() {
    const mapInstance = getMap()
    if (!mapInstance || initialized) return
    initialized = true

    // 构建图索引
    nodeIndex = buildNodeIndex()

    // 初始化 geoUtils（用于 buildObstacles 中的 gpsToFrac）
    geoUtils = createGeoUtils(MAP_CONFIG)

    // 构建障碍物
    obstacles = buildObstacles()

    // 初始化 RobotEngine
    robotEngine = useRobotEngine({ getMap, mapConfig: MAP_CONFIG, obstacles })
    robotEngine.init(ROBOT_CONFIGS)

    // ★ 设置机器人初始位置为笛卡尔坐标（MoveTask 以 m/s 运动，需笛卡尔空间）
    for (const robotConfig of ROBOT_CONFIGS) {
      const standbyGps = ROBOT_STANDBY_POSITIONS[robotConfig.id]
      if (standbyGps) {
        const [xFrac, yFrac] = gpsToFrac(standbyGps[0], standbyGps[1])
        const cartesianPosition = geoUtils.fracToCart(xFrac, yFrac)
        const controller = robotEngine.getController(robotConfig.id)
        if (controller) {
          controller.setPosition(cartesianPosition.x, cartesianPosition.y)
        }
      }
    }

    // 初始化 RouteController
    routeController = useRouteController({ mapConfig: MAP_CONFIG })
    routeController.init()

    // 初始化 BatteryManager
    batteryManager = useBatteryManager()
    batteryManager.setOnLowBattery(async (robotId) => {
      await performLowBatteryRecall(robotId)
    })

    // 初始标注
    const initialMarkers = robots.value.map(robotConfig => {
      const routeConfig = PATROL_ROUTE_CONFIGS[robotConfig.id]
      let waypoints
      try {
        waypoints = routeConfig ? buildPatrolRouteFallback(routeConfig) : null
      } catch (_) {
        waypoints = null
      }
      if (!waypoints || waypoints.length < 2) {
        waypoints = [[116.4050, 39.9055]]
      }
      let position = waypoints.length ? waypoints[0] : [116.4050, 39.9055]
      // 将 marker 对齐到离分散位置最近的图节点，避免视觉跳跃
      const standbyPosition = ROBOT_STANDBY_POSITIONS[robotConfig.id]
      if (standbyPosition) {
        let nearestNodeId = null
        let nearestDistance = Infinity
        for (const [nodeId, coordinates] of Object.entries(nodeIndex)) {
          const distance = segmentDistance(standbyPosition, coordinates)
          if (distance < nearestDistance) {
            nearestDistance = distance
            nearestNodeId = nodeId
          }
        }
        if (nearestNodeId && nodeIndex[nearestNodeId]) {
          position = nodeIndex[nearestNodeId]
        }
      }
      return {
        id:       robotConfig.id,
        name:     robotConfig.name,
        lngLat:   position,
        rotation: 0,
        status:   robotConfig.status,
        battery:  robotConfig.battery,
        task:     robotConfig.task,
      }
    })

    robotMarkerController = addStatusRobotMarkers(mapInstance, initialMarkers, { size: 22, showLabels: true })
    iotBubbles = createIoTBubbles(mapInstance, { defaultDuration: 5000, maxBubbles: 10 })

    // 创建 FOV 图层
    for (const config of ROBOT_CONFIGS) {
      robotEngine.createFOVForRobot(config.id, { ...FOV_CONFIG, fillColor: config.fovColor })
    }
  }

  /** 降级回退：使用图结构构建巡逻路点（仅用于初始标注定位） */
  function buildPatrolRouteFallback(routeConfig) {
    const { edgeIds, startNodeId } = routeConfig

    const validEdgeIds = edgeIds.filter(edgeId => {
      const graphEdge = PARK_GRAPH.edges.find(edge => edge.id === edgeId)
      return !!graphEdge
    })

    if (validEdgeIds.length === 0) {
      return null
    }

    return [
      ...(nodeIndex[startNodeId] ? [nodeIndex[startNodeId]] : []),
      ...validEdgeIds.map(edgeId => {
        const graphEdge = PARK_GRAPH.edges.find(edge => edge.id === edgeId)
        return graphEdge ? nodeIndex[graphEdge.to] : null
      }).filter(Boolean),
    ]
  }

  // --- 低电量/召回处理 -------------------------------------------------------------

  async function performLowBatteryRecall(robotId) {
    const robotState = robots.value.find(robot => robot.id === robotId)
    if (!robotState) return

    const controller = robotEngine.getController(robotId)
    if (!controller) return

    // 取消当前任务
    controller.cancelCurrentTask()

    // 计算机器人当前位置（笛卡尔）和待机区位置（笛卡尔）
    const currentPosition = controller.getPosition()
    const standbyCartPosition = computeStandbyCartesianPosition(robotId)
    if (!standbyCartPosition) return

    robotState.status = ROBOT_STATUS.RETURNING
    robotState.task = '低电量返回中'

    // 通过 RouteController 规划返回路径（接受/返回笛卡尔坐标）
    const returnWaypoints = routeController.planReturnPath(
      PARK_GRAPH,
      currentPosition,
      standbyCartPosition
    )

    if (!returnWaypoints || returnWaypoints.length < 2) {
      robotState.status = ROBOT_STATUS.ERROR
      robotState.task = '返回路径规划失败'
      return
    }

    // 逐个路点移动（waypoints 已是笛卡尔坐标 [x, y]）
    for (let pointIndex = 0; pointIndex < returnWaypoints.length; pointIndex++) {
      const target = returnWaypoints[pointIndex]
      try {
        await controller.moveTo(target, { tolerance: 0.5 })
      } catch (error) {
        break
      }
    }

    // 返回到待机区后进入充电状态
    robotState.status = ROBOT_STATUS.CHARGING
    robotState.task = '充电中'
  }

  /** 计算机器人待机区的笛卡尔坐标 */
  function computeStandbyCartesianPosition(robotId) {
    const standbyPosition = ROBOT_STANDBY_POSITIONS[robotId]
    if (!standbyPosition) return null
    const [xFrac, yFrac] = gpsToFrac(standbyPosition[0], standbyPosition[1])
    return geoUtils.fracToCart(xFrac, yFrac)
  }

  // ─── 路线渲染 ───────────────────────────────────────────────────────────────

  /**
   * 在地图上渲染指定机器人的巡逻路线
   *
   * @param {string} robotId - 机器人 ID
   * @param {[number, number][]} cartesianWaypoints - 笛卡尔坐标路径数组 [[x, y], ...]
   */
  function renderRobotRoute(robotId, cartesianWaypoints) {
    return;
    const mapInstance = getMap()
    if (!mapInstance || !routeController || !cartesianWaypoints || cartesianWaypoints.length < 2) return

    const geoUtils = routeController.getGeoUtils()
    if (!geoUtils) return

    // 查找机器人配置以获取颜色
    const robotConfig = ROBOT_CONFIGS.find(config => config.id === robotId)
    const routeColor = robotConfig?.fovColor || '#1677ff'

    // 转换为 GPS 坐标
    const gpsCoordinates = cartesianWaypoints.map(([x, y]) => {
      return geoUtils.cartToGPS(x, y)
    })

    // 构建 GeoJSON 数据
    const geojsonData = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: gpsCoordinates,
      },
    }

    const sourceId = ROUTE_SOURCE_PREFIX + robotId
    const casingLayerId = ROUTE_LAYER_CASING_PREFIX + robotId
    const lineLayerId = ROUTE_LAYER_LINE_PREFIX + robotId

    // 如果已存在 source，先移除旧的 source 和图层
    removeRobotRoute(robotId)

    // 添加 GeoJSON source
    mapInstance.addSource(sourceId, { type: 'geojson', data: geojsonData })

    // 添加描边图层（白色半透明，增强可见性）
    mapInstance.addLayer({
      id: casingLayerId,
      source: sourceId,
      type: 'line',
      paint: {
        'line-color': '#ffffff',
        'line-width': 5,
        'line-opacity': 0.3,
      },
    })

    // 添加主线图层（使用机器人颜色）
    mapInstance.addLayer({
      id: lineLayerId,
      source: sourceId,
      type: 'line',
      paint: {
        'line-color': routeColor,
        'line-width': 3,
        'line-opacity': 0.7,
      },
    })
  }

  /** 移除指定机器人的路线图层 */
  function removeRobotRoute(robotId) {
    const mapInstance = getMap()
    if (!mapInstance) return

    const layerIds = [
      ROUTE_LAYER_CASING_PREFIX + robotId,
      ROUTE_LAYER_LINE_PREFIX + robotId,
    ]
    const sourceId = ROUTE_SOURCE_PREFIX + robotId

    for (const layerId of layerIds) {
      if (mapInstance.getLayer(layerId)) {
        mapInstance.removeLayer(layerId)
      }
    }
    if (mapInstance.getSource(sourceId)) {
      mapInstance.removeSource(sourceId)
    }
  }

  /** 移除所有机器人的路线图层 */
  function removeAllRoutes() {
    for (const robotConfig of ROBOT_CONFIGS) {
      removeRobotRoute(robotConfig.id)
    }
  }

  // --- 公开控制 API ------------------------------------------------------------------

  function startAll() {
    init()
    if (isRunning.value) return
    isRunning.value = true

    for (const robotConfig of robots.value) {
      const patrolConfig = PATROL_ROUTE_CONFIGS[robotConfig.id]
      if (!patrolConfig) continue

      // ★★★ 核心修复：使用 routeController.planPatrolPath（含 cartToENU 转换）★★★
      const waypoints = routeController.planPatrolPath(
        PARK_GRAPH,
        patrolConfig.startNodeId,
        patrolConfig.edgeIds,
        patrolConfig.excludeNodeIds || []
      )

      if (!waypoints || waypoints.length < 2) {
        robotConfig.status = ROBOT_STATUS.ERROR
        robotConfig.task = '路径规划失败'
        continue
      }

      robotConfig.status = ROBOT_STATUS.RUNNING
      robotConfig.task = '巡逻中'

      // 渲染巡逻路线
      renderRobotRoute(robotConfig.id, waypoints)

      // 异步执行巡逻任务
      executePatrolTask(robotConfig.id, waypoints)

      // 启动事件报告
      const controller = robotEngine.getController(robotConfig.id)
      if (controller) {
        batteryManager.startEventReport(robotConfig.id, () => {
          const currentPosition = controller.getPosition()
          const gpsPosition = routeController.getGeoUtils().cartToGPS(currentPosition.x, currentPosition.y)
          const event = generateSimulatedEvent({
            id: robotConfig.id,
            name: robotConfig.name,
            position: { lng: gpsPosition[0], lat: gpsPosition[1] },
          })
          simulatedEvents.value.unshift(event)
          if (simulatedEvents.value.length > 100) simulatedEvents.value.pop()
          iotBubbles?.emit({
            id: 'security-event-' + robotConfig.id,
            lngLat: [gpsPosition[0], gpsPosition[1]],
            type: 'warning',
            message: event.description,
            deviceName: robotConfig.name,
          })
        })
      }
    }

    if (!animationFrameId) animationFrameId = requestAnimationFrame(mainTick)
  }

  /** 异步执行巡逻任务（不阻塞主循环） */
  async function executePatrolTask(robotId, waypoints) {
    const controller = robotEngine.getController(robotId)
    if (!controller) return

    // 找到离当前位置最近的路点索引，从那里继续（支持停止后重新启动）
    const currentPosition = controller.getPosition()
    let startIndex = 0
    let minDistanceSq = Infinity
    for (let pointIndex = 0; pointIndex < waypoints.length; pointIndex++) {
      const dx = waypoints[pointIndex][0] - currentPosition.x
      const dy = waypoints[pointIndex][1] - currentPosition.y
      const distanceSq = dx * dx + dy * dy
      if (distanceSq < minDistanceSq) {
        minDistanceSq = distanceSq
        startIndex = pointIndex
      }
    }

    for (let pointIndex = startIndex; pointIndex < waypoints.length; pointIndex++) {
      const target = waypoints[pointIndex]

      // 如果正在返回中（或已销毁），中断巡逻
      if (!batteryManager || batteryManager.isReturning(robotId)) break

      try {
        // target 已是笛卡尔坐标 [cartX, cartY]，tolerance 使用米级别
        await controller.moveTo(target, { tolerance: 0.5 })
      } catch (error) {
        // 任务被取消
        break
      }
    }

    // 循环结束后的处理（如果不在返回中，说明正常结束；已销毁则直接退出）
    if (!batteryManager) return
    const robotState = robots.value.find(robot => robot.id === robotId)
    if (robotState && !batteryManager.isReturning(robotId)) {
      robotState.status = ROBOT_STATUS.IDLE
      robotState.task = '待命'
      batteryManager.stopEventReport(robotId)
    }
  }

  function stopAll() {
    isRunning.value = false
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = 0 }
    lastTickTime = 0

    for (const robotConfig of robots.value) {
      const controller = robotEngine?.getController(robotConfig.id)
      if (controller) {
        controller.cancelCurrentTask()
      }
      robotConfig.status = ROBOT_STATUS.IDLE
      robotConfig.task = '待命'
      batteryManager?.stopEventReport(robotConfig.id)
    }

    // 移除所有路线
    removeAllRoutes()
  }

  function startSingle(robotId) {
    init()

    const patrolConfig = PATROL_ROUTE_CONFIGS[robotId]
    if (!patrolConfig) return

    // ★★★ 核心修复：使用 routeController.planPatrolPath（含 cartToENU 转换）★★★
    const waypoints = routeController.planPatrolPath(
      PARK_GRAPH,
      patrolConfig.startNodeId,
      patrolConfig.edgeIds,
      patrolConfig.excludeNodeIds || []
    )

    if (!waypoints || waypoints.length < 2) return

    const robotConfig = robots.value.find(robot => robot.id === robotId)
    if (robotConfig) {
      robotConfig.status = ROBOT_STATUS.RUNNING
      robotConfig.task = '巡逻中'
      // 渲染巡逻路线
      renderRobotRoute(robotId, waypoints)
      executePatrolTask(robotId, waypoints)
      batteryManager.startEventReport(robotId, () => {
        const controller = robotEngine.getController(robotId)
        if (!controller) return
        const currentPosition = controller.getPosition()
        const gpsPosition = routeController.getGeoUtils().cartToGPS(currentPosition.x, currentPosition.y)
        const event = generateSimulatedEvent({
          id: robotId,
          name: robotConfig.name,
          position: { lng: gpsPosition[0], lat: gpsPosition[1] },
        })
        simulatedEvents.value.unshift(event)
        if (simulatedEvents.value.length > 100) simulatedEvents.value.pop()
        iotBubbles?.emit({
          id: 'security-event-' + robotId,
          lngLat: [gpsPosition[0], gpsPosition[1]],
          type: 'custom',
          message: event.description,
          deviceName: robotConfig.name,
        })
      })
    }

    const hasRunning = robots.value.some(robot => robot.status === ROBOT_STATUS.RUNNING)
    if (hasRunning) isRunning.value = true
    if (!animationFrameId) animationFrameId = requestAnimationFrame(mainTick)
  }

  function stopSingle(robotId) {
    const controller = robotEngine?.getController(robotId)
    if (controller) {
      controller.cancelCurrentTask()
    }
    // 移除路线
    removeRobotRoute(robotId)

    const robotConfig = robots.value.find(robot => robot.id === robotId)
    if (robotConfig) {
      robotConfig.status = ROBOT_STATUS.IDLE
      robotConfig.task = '待命'
    }
    batteryManager.stopEventReport(robotId)

    const hasRunning = robots.value.some(robot =>
      robot.status === ROBOT_STATUS.RUNNING
    )
    if (!hasRunning) {
      isRunning.value = false
      if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = 0 }
      lastTickTime = 0
    }
  }

  /** 召回指定机器人 */
  async function recallRobot(robotId) {
    init()

    const controller = robotEngine?.getController(robotId)
    const robotState = robots.value.find(robot => robot.id === robotId)
    if (!controller || !robotState) return

    // ★ 设置返回标记，让 executePatrolTask 通过 isReturning 检查自动中断巡逻
    batteryManager.returningRobotIds.add(robotId)

    // 取消当前任务
    controller.cancelCurrentTask()
    // 移除路线（召回意味着当前巡逻路线不再有效）
    removeRobotRoute(robotId)

    const currentPosition = controller.getPosition()
    const standbyCartPosition = computeStandbyCartesianPosition(robotId)
    if (!standbyCartPosition) {
      batteryManager.clearReturningMark(robotId)
      return
    }

    robotState.status = ROBOT_STATUS.RETURNING
    robotState.task = '召回中'
    batteryManager.stopEventReport(robotId)

    // 通过 RouteController 规划返回路径（沿道路网络，含建筑碰撞检测）
    const returnWaypoints = routeController.planReturnPath(
      PARK_GRAPH,
      currentPosition,
      standbyCartPosition
    )

    if (!returnWaypoints || returnWaypoints.length < 2) {
      robotState.status = ROBOT_STATUS.ERROR
      robotState.task = '返回路径规划失败'
      batteryManager.clearReturningMark(robotId)
      return
    }

    // 逐个路点移动（waypoints 已是笛卡尔坐标 [x, y]）
    for (let pointIndex = 0; pointIndex < returnWaypoints.length; pointIndex++) {
      try {
        await controller.moveTo(returnWaypoints[pointIndex], { tolerance: 0.5 })
      } catch (error) {
        break
      }
    }

    batteryManager?.clearReturningMark(robotId)

    robotState.status = ROBOT_STATUS.IDLE
    robotState.task = '待命'
  }

  /** 清空模拟事件 */
  function clearSimulatedEvents() {
    simulatedEvents.value = []
  }

  function fitBounds() {
    const mapInstance = getMap()
    if (!mapInstance) return
    mapInstance.fitBounds([[116.3990, 39.9010], [116.4110, 39.9100]], { padding: 60, duration: 800 })
  }

  function cleanup() {
    stopAll()
    // 确保所有路线图层被移除
    removeAllRoutes()

    // 清理电池管理器
    if (batteryManager) {
      batteryManager.cleanup()
    }

    // 清理引擎
    if (robotEngine) {
      robotEngine.cleanup()
      robotEngine = null
    }

    nodeIndex = {}
    robotMarkerController?.remove?.()
    robotMarkerController = null
    iotBubbles?.remove?.()
    iotBubbles = null
    initialized = false
    lastTickTime = 0
    routeController = null
    batteryManager = null
  }

  onBeforeUnmount(cleanup)

  // --- 计算属性 ---------------------------------------------------------------------

  const alertCount = computed(() => alerts.value.length)

  return {
    // 状态
    robots,
    isRunning,
    alerts,
    alertCount,
    simulatedEvents,
    // 控制
    init,
    startAll,
    stopAll,
    startSingle,
    stopSingle,
    recallRobot,
    clearSimulatedEvents,
    fitBounds,
    cleanup,
  }
}
