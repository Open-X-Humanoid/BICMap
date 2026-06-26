import { ref, reactive, shallowReactive, computed, onBeforeUnmount } from 'vue'
import { ROBOT_STATUS, createRobotFOV } from '@/bicMap/core/robot'
import {
  ROBOT_CONFIGS,
  PATROL_ROUTES,
  IDLE_HEADING,
  MAP_START_X,
  MAP_START_Y,
  MAP_WIDTH_M,
  MAP_HEIGHT_M,
  MAP_RESOLUTION,
  LAYOUT_SCALE,
  DWELL_MS,
  ARRIVAL_DIST,
  ROBOT_SPEED,
  ROTATE_DPS,
  GUIDE_PHASE
} from './constants.js'
import {
  createGeoUtils,
  iconRot,
  findAnnouncementPoint,
  initPathfinder,
  buildPathfindingRoute,
  routeIdsToCoords
} from '@/bicMap/core/navigation'
import { SHOPS, PARKING_ZONES } from './mallLayout.js'
import { RobotEngine, createRobotProfile } from '@/bicMap/core/robot'

const { fracToCart, cartToGPS } = createGeoUtils({
  startX: MAP_START_X,
  startY: MAP_START_Y,
  width: MAP_WIDTH_M * (LAYOUT_SCALE || 1),
  height: MAP_HEIGHT_M * (LAYOUT_SCALE || 1),
  scale: MAP_RESOLUTION,
  zoomFactor: 2
})

// ==================== 模块级常量 ====================

const STORAGE_KEYS = { CONFIGS: 'mall_robot_configs', ROUTES: 'mall_patrol_routes' }
const FOV_COLORS = ['#00FFFF', '#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181']
const FOV_INDEX_MAP = new Map()

const BUSINESS_SHOPS = SHOPS

// B1 禁行区：只包含停车位区域（行车通道除外，机器人需沿通道行驶）
const B1_FORBIDDEN_ZONES = PARKING_ZONES.filter((zone) => !zone.id.startsWith('b1-lane-') && zone.id !== 'b1-park-d1')

function getForbiddenZones(robotFloor) {
  return robotFloor === 'B1' ? B1_FORBIDDEN_ZONES : BUSINESS_SHOPS
}
const STATUS_COLORS = {
  [ROBOT_STATUS.IDLE]: '#1CD5A4',
  [ROBOT_STATUS.RUNNING]: '#0066FF',
  [ROBOT_STATUS.CHARGING]: '#F7A800',
  [ROBOT_STATUS.ERROR]: '#FF3B30'
}

const SPREAD_RADIUS_M = 2.0
const MAP_W = MAP_WIDTH_M * LAYOUT_SCALE
const MAP_H = MAP_HEIGHT_M * LAYOUT_SCALE

// 初始化 Pathfinder（外部传入有效地图尺寸）
initPathfinder(MAP_W, MAP_H)

// RobotEngine 实例 — 替代 simulationStep 驱动运动学模拟
const robotEngine = new RobotEngine()
// 引擎控制器映射 (robotId → RobotController)
const engineControllerMap = new Map()

// ── DEBUG 标志 ──
let _debugLoggedFirstFrame = false
let _debugSyncedFirstFrame = false
let _debugFrameCount = 0

// ==================== 模块级工具函数 ====================

function getFovColor(robotId, robotIndex) {
  if (!FOV_INDEX_MAP.has(robotId)) FOV_INDEX_MAP.set(robotId, robotIndex % FOV_COLORS.length)
  return FOV_COLORS[FOV_INDEX_MAP.get(robotId)]
}

function getBatteryColor(percentage) {
  return percentage >= 60 ? '#1CD5A4' : percentage >= 20 ? '#F7A800' : '#FF3B30'
}

function phaseToTask(phase) {
  if (phase === GUIDE_PHASE.MOVE) return '导览中'
  if (phase === GUIDE_PHASE.DWELL) return '讲解中'
  if (phase === GUIDE_PHASE.RETURNING) return '返程中'
  if (phase === GUIDE_PHASE.ROTATING_TO_NORTH) return '归位中'
  return '待导览'
}

// 将共享同一起始 POI 的机器人分散到周围，避免叠在一起
function spreadPositions(basePositions, allPois) {
  const result = new Map(),
    robotEntries = Object.entries(basePositions),
    poiIdCount = new Map()
  for (const [, robotEntry] of robotEntries) {
    if (robotEntry.startPoiId) poiIdCount.set(robotEntry.startPoiId, (poiIdCount.get(robotEntry.startPoiId) || 0) + 1)
  }
  for (const [robotId, robotEntry] of robotEntries) {
    const poi = robotEntry.startPoiId ? allPois.find((p) => p.id === robotEntry.startPoiId) : null
    if (!poi) {
      result.set(robotId, robotEntry.position)
      continue
    }
    const count = poiIdCount.get(robotEntry.startPoiId) || 1
    if (count <= 1) {
      result.set(robotId, [poi.xFrac, poi.yFrac])
      continue
    }
    const index = robotEntries
      .filter(([, routeEntry]) => routeEntry.startPoiId === robotEntry.startPoiId)
      .findIndex(([routeId]) => routeId === robotId)
    const angle = (index / count) * Math.PI * 2,
      spreadFactor = SPREAD_RADIUS_M / MAP_W
    result.set(robotId, [
      Math.max(0, Math.min(1, poi.xFrac + Math.cos(angle) * spreadFactor)),
      Math.max(0, Math.min(1, poi.yFrac + Math.sin(angle) * spreadFactor))
    ])
  }
  return result
}

// 创建巡逻状态对象（路线、位置、朝向、电量等）
function createPatrolState(
  config,
  routeIds,
  routeCoords,
  poiIndices,
  announcementPoints,
  initFrac,
  phase = GUIDE_PHASE.IDLE
) {
  const initialCartesian = fracToCart(...initFrac)
  return {
    route: routeCoords,
    routeIds,
    poiIndices,
    announcementPoints,
    waypointIndex: 0,
    cartPos: { ...initialCartesian },
    lngLat: cartToGPS(initialCartesian.x, initialCartesian.y),
    heading: IDLE_HEADING,
    smoothHeading: IDLE_HEADING,
    phase,
    dwellTimer: 0,
    floor: config.floor || '1F',
    battery: config.battery ?? 100,
    batteryLowWarned: false,
    initFrac: [...initFrac] // 分散后的出发坐标，导览结束后回归用
  }
}

// localStorage 读写辅助
function loadFromStorage(storageKey, defaultValue) {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || defaultValue
  } catch {
    return defaultValue
  }
}
function saveToStorage(storageKey, storageValue) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(storageValue))
  } catch (error) {
    console.warn('[RM] save fail:', error)
  }
}

// ==================== useRobotManager ====================

export function useRobotManager(options) {
  const { getMap, getRobotCtrl, getPois, getRoutes, getCurrentFloor } = options

  // ==================== 响应式状态 ====================

  const robots = ref([]),
    isRunning = ref(false),
    followCam = ref(false),
    followRobotId = ref(null),
    robotHeading = ref(IDLE_HEADING)

  const patrolState = reactive(new Map()),
    fovSet = reactive(new Set()),
    fovMap = shallowReactive(new Map())

  const onPoiArrival = ref(null),
    lowBatteryCallback = ref(null),
    onAnnouncementChanged = ref(null),
    onTourComplete = ref(null),
    rafId = ref(0),
    lastTimestamp = ref(0)

  const patrolRoutes = ref({ ...PATROL_ROUTES })
  const robotConfigs = ref([...ROBOT_CONFIGS])

  // 气泡状态缓存：避免 status/battery/task 无变化时重建 DOM（key: robotId, value: cacheKey 字符串）
  const _prevStatusCache = new Map()

  // ==================== 计算属性 ====================

  // 根据机器人配置和路线自动计算机器人分散位置
  const spreadPositionsMap = computed(() => {
    const allPois = getPois?.() || []
    const routeMap = getRoutes?.() || patrolRoutes.value
    const basePositions = {}
    for (const config of robotConfigs.value) {
      const routeIdList = routeMap[config.id] || []
      const routeCoords = routeIdsToCoords(routeIdList, allPois)
      basePositions[config.id] = {
        startPoiId: config.startPoiId,
        position: routeCoords[0] || config.initialFrac || [0.5, 0.5]
      }
    }
    return spreadPositions(basePositions, allPois)
  })

  // 根据机器人配置和路线自动计算各机器人的播报点
  const robotAnnouncementPoints = computed(() => {
    const allPois = getPois?.() || []
    const routeMap = getRoutes?.() || patrolRoutes.value
    const spreadMap = spreadPositionsMap.value
    const result = {}
    for (const config of robotConfigs.value) {
      const routeIdList = routeMap[config.id] || []
      // 支持单导航点路线（至少1个POI）
      if (!routeIdList || routeIdList.length < 1) continue
      const initFrac = spreadMap.get(config.id) || config.initialFrac || [0.5, 0.5]
      const poiMap = new Map(allPois.map((poi) => [poi.id, poi]))
      const announcementList = []
      const firstPoi = poiMap.get(routeIdList[0])
      if (!firstPoi) continue
      const firstTarget = [firstPoi.xFrac, firstPoi.yFrac]
      let lastAnchorPoint = initFrac || firstTarget
      const forbiddenZones = getForbiddenZones(config.floor)
      const firstAnnouncement = findAnnouncementPoint({
        poiXFrac: firstPoi.xFrac,
        poiYFrac: firstPoi.yFrac,
        prevXFrac: lastAnchorPoint[0],
        prevYFrac: lastAnchorPoint[1],
        forbiddenZones
      })
      announcementList.push({ frac: firstAnnouncement, status: 'pending' })
      lastAnchorPoint = firstAnnouncement
      for (let poiIndex = 0; poiIndex < routeIdList.length - 1; poiIndex++) {
        const nextPoi = poiMap.get(routeIdList[poiIndex + 1])
        if (!nextPoi) continue
        const nextAnnouncement = findAnnouncementPoint({
          poiXFrac: nextPoi.xFrac,
          poiYFrac: nextPoi.yFrac,
          prevXFrac: lastAnchorPoint[0],
          prevYFrac: lastAnchorPoint[1],
          forbiddenZones
        })
        announcementList.push({ frac: nextAnnouncement, status: 'pending' })
        lastAnchorPoint = nextAnnouncement
      }
      result[config.id] = announcementList
    }
    return result
  })

  // 计算机器人寻路路径（起点使用 spreadMap 分散位置）
  const robotPaths = computed(() => {
    const allPois = getPois?.() || []
    const routeMap = getRoutes?.() || patrolRoutes.value
    const spreadMap = spreadPositionsMap.value
    const announcementsMap = robotAnnouncementPoints.value
    const currentFloor = getCurrentFloor?.()
    const all = {}
    const displayData = {}
    for (const config of robotConfigs.value) {
      const routeIdList = routeMap[config.id] || []
      // 支持单导航点路线（至少1个POI）
      if (!routeIdList || routeIdList.length < 1) continue
      const initFrac = spreadMap.get(config.id) || config.initialFrac || [0.5, 0.5]
      const annPoints = announcementsMap[config.id] || []
      const waypointCoords = routeIdsToCoords(routeIdList, allPois)
      const pathPoints = [initFrac, ...waypointCoords.map((coord, i) => annPoints[i]?.frac || coord)]
      const { coords, poiIndices } = buildPathfindingRoute(pathPoints, getForbiddenZones(config.floor))
      all[config.id] = { coords, poiIndices }
      const firstPoi = allPois.find((poi) => poi.id === routeIdList[0])
      // 单导航点时，路径至少包含起点和终点两个点
      if (firstPoi && (!currentFloor || firstPoi.floor === currentFloor) && coords.length >= 2) {
        displayData[config.id] = coords
      }
    }
    return { all, displayData }
  })

  // 当前楼层各机器人的路线坐标（供路线图层展示）
  const routeDisplayData = computed(() => robotPaths.value.displayData)

  // ==================== FOV 操作 ====================

  function updateFov(robotId, state) {
    const fovInstance = fovMap.get(robotId)
    if (fovInstance && state) fovInstance.update(state.cartPos, state.smoothHeading)
  }

  function showFov(robotId, state) {
    const fovInstance = fovMap.get(robotId)
    if (fovInstance) {
      fovInstance.show()
      if (state) fovInstance.update(state.cartPos, state.smoothHeading)
    }
  }

  // 为所有机器人创建 FOV 扇形实例（懒加载）
  function initFovInstances() {
    if (fovMap.size > 0) return
    const mapInstance = getMap()
    robotConfigs.value.forEach((config, index) => {
      try {
        fovMap.set(
          config.id,
          createRobotFOV(mapInstance, {
            id: `mall-fov-${config.id}`,
            angle: 45,
            radiusMeters: 6,
            fillColor: getFovColor(config.id, index),
            mapConfig: {
              startX: MAP_START_X,
              startY: MAP_START_Y,
              width: MAP_WIDTH_M * (LAYOUT_SCALE || 1),
              height: MAP_HEIGHT_M * (LAYOUT_SCALE || 1),
              scale: MAP_RESOLUTION
            }
          })
        )
      } catch (error) {
        console.error('[RM] FOV fail:', config.id, error)
      }
    })
  }

  // ==================== 地图同步 ====================

  // 向地图添加机器人标记
  function addRobotToMap(robotId, initFrac, name, battery, status, task) {
    const initialCartesian = fracToCart(...initFrac)
    getRobotCtrl().addRobot({
      id: robotId,
      lngLat: cartToGPS(initialCartesian.x, initialCartesian.y),
      rotation: iconRot(IDLE_HEADING),
      name,
      battery: battery ?? 100,
      status: status ?? ROBOT_STATUS.IDLE,
      task: task ?? '待导览'
    })
  }

  // 同步所有机器人标记位置、朝向到地图（仅传 lngLat/rotation 走快速路径，避免每帧重建气泡 DOM）
  function syncRobotMarkers() {
    const currentFloor = getCurrentFloor?.() || '1F'
    for (const [robotId, state] of patrolState) {
      if (state.floor !== currentFloor) continue
      const lngLat = cartToGPS(state.cartPos.x, state.cartPos.y)
      state.lngLat = lngLat
      const rotation = iconRot(state.smoothHeading)
      // ── DEBUG: 启动后首次推送到地图层 ──
      if (!_debugSyncedFirstFrame && _debugLoggedFirstFrame) {
        _debugSyncedFirstFrame = true
        // console.log(`[DEBUG] syncMarkers robot=${robotId} lngLat=(${lngLat[0].toFixed(6)},${lngLat[1].toFixed(6)}) rotation=${rotation} smoothHeading=${state.smoothHeading}`)
      }
      // 只传位置和旋转，触发 robotStatus.js 快速路径（仅移动 CSS，不重建气泡 DOM）
      getRobotCtrl().updateRobot(robotId, { lngLat, rotation })
      if (fovSet.has(robotId) && fovMap.has(robotId)) fovMap.get(robotId).update(state.cartPos, state.smoothHeading)
    }
  }

  // 跟随相机：跳转到当前关注机器人位置
  function applyFollowCam() {
    if (!followCam.value) return
    let state =
      followRobotId.value && patrolState.has(followRobotId.value)
        ? patrolState.get(followRobotId.value)
        : patrolState.size > 0
          ? patrolState.values().next().value
          : null
    if (state) getMap().jumpTo({ center: state.lngLat, bearing: 0, pitch: 0, zoom: 24 })
  }

  // 更新侧边栏机器人列表状态，同时将 status/battery/task 同步给地图气泡（非位置字段，低频更新）
  function updateSidebarStatus() {
    const currentFloor = getCurrentFloor?.() || '1F'
    robots.value = Array.from(patrolState)
      .filter(([, state]) => state.floor === currentFloor)
      .map(([robotId, state]) => {
        const config = robotConfigs.value.find((configItem) => configItem.id === robotId) || {},
          battery = state.battery,
          patrolStatus = state.phase === GUIDE_PHASE.IDLE ? ROBOT_STATUS.IDLE : ROBOT_STATUS.RUNNING,
          task = phaseToTask(state.phase)
        // 将非位置字段推给 robotCtrl，robotStatus.js 会检测 onlyPosition=false 并重建气泡
        // 此处每帧调用代价依然存在，通过 _prevStatusCache 缓存跳过无变化帧
        const cacheKey = `${patrolStatus}|${Math.round(battery)}|${task}`
        if (_prevStatusCache.get(robotId) !== cacheKey) {
          _prevStatusCache.set(robotId, cacheKey)
          getRobotCtrl()?.updateRobot(robotId, { status: patrolStatus, battery, task })
        }
        return {
          id: robotId,
          name: config.name || robotId,
          status: patrolStatus,
          statusColor: STATUS_COLORS[patrolStatus] || STATUS_COLORS[ROBOT_STATUS.IDLE],
          battery: battery,
          batteryColor: getBatteryColor(battery),
          task,
          floor: state.floor || '1F',
          fovActive: fovSet.has(robotId)
        }
      })
  }

  // ── 循环控制辅助 ──

  function stopLoop() {
    isRunning.value = false
    followCam.value = false
    if (rafId.value) {
      cancelAnimationFrame(rafId.value)
      rafId.value = 0
    }
  }

  function checkAndStopIfAllIdle() {
    if (!Array.from(patrolState.values()).some((s) => s.phase !== GUIDE_PHASE.IDLE)) stopLoop()
  }

  // ── 引擎辅助函数 ──

  // 为机器人下发下一个路点的 MoveTask
  function issueNextWaypoint(robotId, state) {
    const routeLen = state.route.length
    if (routeLen < 2) return false
    const engineCtrl = engineControllerMap.get(robotId)
    if (!engineCtrl) return false
    const targetCoord = state.route[state.waypointIndex]
    const targetCart = fracToCart(...targetCoord)
    engineCtrl.moveTo([targetCart.x, targetCart.y], {
      tolerance: ARRIVAL_DIST
    })
    return true
  }

  // 前进到下一个路径点（跳过已到达的路径点）
  // 注意：此函数只负责推进 waypointIndex 并下发 MoveTask，不处理 POI 逻辑，不修改 phase。
  // POI 的 DWELLING 触发统一由 processRobotTasks 在引擎任务完成时处理。
  function advanceToNextWaypoint(robotId, state) {
    const routeLen = state.route.length
    if (routeLen <= 1) return
    for (let skip = 0; skip < routeLen; skip++) {
      // 防止回绕到 route 开头，到达末尾即停止
      if (state.waypointIndex >= routeLen - 1) break
      state.waypointIndex++
      const targetCoord = state.route[state.waypointIndex]
      const targetCart = fracToCart(...targetCoord)
      if (engineControllerMap.has(robotId)) {
        const enginePos = engineControllerMap.get(robotId).getPosition()
        const dx = targetCart.x - enginePos.x
        const dy = targetCart.y - enginePos.y
        if (Math.sqrt(dx * dx + dy * dy) >= ARRIVAL_DIST) break
        // 注意：不在此处 setPosition 跳转引擎位置
        // 让后续的 issueNextWaypoint → MoveTask 自然地平滑移动到目标
      } else {
        break
      }
      if (state.poiIndices?.includes(state.waypointIndex)) {
        state.phase = GUIDE_PHASE.DWELL
        state.dwellTimer = 0
        const poiIndex = state.poiIndices.indexOf(state.waypointIndex)
        if (state.announcementPoints?.[poiIndex]) {
          state.announcementPoints[poiIndex].status = 'arrived'
          if (onAnnouncementChanged.value) onAnnouncementChanged.value(robotId, state.announcementPoints)
        }
        if (onPoiArrival.value) onPoiArrival.value(robotId, poiIndex)
        return
      }
    }
    // state.phase = GUIDE_PHASE.MOVE
    issueNextWaypoint(robotId, state)
  }

  // 引擎 tick 后处理：完成的路点 → POI dwell / 前进
  function processRobotTasks(deltaTime) {
    for (const [robotId, state] of patrolState) {
      const engineCtrl = engineControllerMap.get(robotId)
      if (!engineCtrl) continue

      if (state.phase === GUIDE_PHASE.MOVE) {
        if (state.route.length < 2) {
          state.phase = GUIDE_PHASE.IDLE
          continue
        }
        const taskStatus = engineCtrl.getTaskStatus()
        if (taskStatus === 'completed' || taskStatus === 'idle') {
          const currentWaypointIndex = state.waypointIndex
          const isPoi = state.poiIndices?.includes(currentWaypointIndex)
          if (isPoi) {
            state.phase = GUIDE_PHASE.DWELL
            state.dwellTimer = 0
            const poiIndex = state.poiIndices.indexOf(currentWaypointIndex)
            if (state.announcementPoints?.[poiIndex]) {
              state.announcementPoints[poiIndex].status = 'arrived'
              if (onAnnouncementChanged.value) onAnnouncementChanged.value(robotId, state.announcementPoints)
            }
            if (onPoiArrival.value) onPoiArrival.value(robotId, poiIndex)
          } else {
            advanceToNextWaypoint(robotId, state)
          }
        }
      } else if (state.phase === GUIDE_PHASE.DWELL) {
        state.dwellTimer += deltaTime
        if (state.dwellTimer >= DWELL_MS) {
          const poiIndex = state.poiIndices?.indexOf(state.waypointIndex)
          if (poiIndex >= 0 && state.announcementPoints?.[poiIndex]) {
            state.announcementPoints[poiIndex].status = 'left'
            if (onAnnouncementChanged.value) onAnnouncementChanged.value(robotId, state.announcementPoints)
          }
          // 最后一个 POI dwell 完成 → 继续沿 route 返回出发点
          const isLastPoi = poiIndex >= 0 && poiIndex === (state.poiIndices?.length ?? 0) - 1
          if (isLastPoi) {
            state.phase = GUIDE_PHASE.RETURNING
            advanceToNextWaypoint(robotId, state)
          } else {
            // 非最后一个 POI：切回 move 阶段，等待引擎到达下一个路点
            state.phase = GUIDE_PHASE.MOVE
            advanceToNextWaypoint(robotId, state)
          }
        }
      } else if (state.phase === GUIDE_PHASE.RETURNING) {
        const taskStatus = engineCtrl.getTaskStatus()
        if (taskStatus === 'completed' || taskStatus === 'idle') {
          // 检查是否已回到起点（最后一个路径点）
          const isBackAtStart = state.waypointIndex === state.route.length - 1
          if (isBackAtStart) {
            // 回到出发点，直接设置朝向北向并结束
            state.phase = GUIDE_PHASE.IDLE
            state.waypointIndex = 0
            state.dwellTimer = 0
            state.smoothHeading = IDLE_HEADING
            state.heading = IDLE_HEADING
            engineCtrl.setHeading(IDLE_HEADING)
            engineCtrl.cancelCurrentTask()

            // 同步到地图
            getRobotCtrl().updateRobot(robotId, { lngLat: state.lngLat, rotation: iconRot(IDLE_HEADING) })
            if (fovSet.has(robotId)) {
              if (fovMap.has(robotId)) {
                fovMap.get(robotId).update(state.cartPos, IDLE_HEADING)
              }
              showFov(robotId, state)
            }
            if (state.announcementPoints) {
              state.announcementPoints.forEach((ap) => {
                ap.status = 'pending'
              })
            }
            // 检查是否所有机器人都已完成（需包含 dwell 等所有活跃 phase，避免其他机器人正在讲解时 RAF 被提前取消）
            checkAndStopIfAllIdle()
            updateSidebarStatus()
            if (onTourComplete.value) onTourComplete.value(robotId)
          } else {
            // 继续沿路径返回
            advanceToNextWaypoint(robotId, state)
          }
        }
      }
    }
  }

  // 同步引擎状态 → patrolState（位置/朝向/电量）
  function syncEngineToPatrolState() {
    let anyHeadingChanged = false
    for (const [robotId, state] of patrolState) {
      const engineCtrl = engineControllerMap.get(robotId)
      if (!engineCtrl) continue
      const enginePos = engineCtrl.getPosition()
      state.cartPos.x = enginePos.x
      state.cartPos.y = enginePos.y
      // 只有非空闲状态才同步引擎朝向，避免覆盖手动设置的朝向
      if (state.phase !== GUIDE_PHASE.IDLE) {
        state.smoothHeading = engineCtrl.getHeading()
        state.heading = engineCtrl.getHeading()
      }
      state.battery = engineCtrl.getBattery()

      if (!anyHeadingChanged) {
        robotHeading.value = state.smoothHeading
        anyHeadingChanged = true
      }

      // 低电量告警
      if (state.battery < 20 && !state.batteryLowWarned && lowBatteryCallback.value) {
        state.batteryLowWarned = true
        lowBatteryCallback.value(robotId, Math.round(state.battery))
      }
    }
  }

  // requestAnimationFrame 驱动：计算 dt → 引擎 tick → 路点处理 → 同步 → 跟随 → 标记 → 侧栏
  function mainLoop(timestamp) {
    if (!isRunning.value) {
      rafId.value = 0
      return
    }
    rafId.value = requestAnimationFrame(mainLoop)
    const deltaTime = lastTimestamp.value ? Math.min(timestamp - lastTimestamp.value, 100) : 16
    lastTimestamp.value = timestamp

    // ── DEBUG: 启动后第一次 tick 打印引擎状态 ──
    if (!_debugLoggedFirstFrame) {
      _debugLoggedFirstFrame = true
      for (const [robotId, state] of patrolState) {
        const ctrl = engineControllerMap.get(robotId)
        if (ctrl) {
          const pos = ctrl.getPosition()
          // console.log(`[DEBUG] firstTick robot=${robotId} 引擎位置=(${pos.x.toFixed(4)},${pos.y.toFixed(4)}) 朝向=${ctrl.getHeading().toFixed(1)}° taskStatus=${ctrl.getTaskStatus()}`)
        }
        // console.log(`[DEBUG] firstTick robot=${robotId} patrolState 位置=(${state.cartPos.x.toFixed(4)},${state.cartPos.y.toFixed(4)}) 朝向=${state.smoothHeading} route[0]=${JSON.stringify(state.route[0])} route[1]=${JSON.stringify(state.route[1])} waypointIndex=${state.waypointIndex}`)
      }
    }

    // ① 引擎驱动移动（MoveTask 运动学）
    robotEngine.tick(deltaTime)

    // ② 处理路点完成 — POI dwell / 前进寻路 / 播报回调
    processRobotTasks(deltaTime)

    // ③ 引擎状态 → patrolState 同步
    syncEngineToPatrolState()

    // ④ 原有 UI 同步
    applyFollowCam()
    syncRobotMarkers()
    updateSidebarStatus()

    // ── DEBUG: 追踪前 10 帧的引擎位置变化 ──
    _debugFrameCount++
    if (_debugFrameCount <= 10) {
      for (const [robotId, state] of patrolState) {
        const ctrl = engineControllerMap.get(robotId)
        if (ctrl) {
          const pos = ctrl.getPosition()
          // console.log(`[DEBUG] frame=${_debugFrameCount} robot=${robotId} 引擎位置=(${pos.x.toFixed(4)},${pos.y.toFixed(4)}) 朝向=${ctrl.getHeading().toFixed(1)}° phase=${state.phase} wptIndex=${state.waypointIndex}`)
        }
      }
    }
  }

  // ==================== 批量控制 ====================

  // 创建引擎控制器并注册（空闲态，不下发任务）
  function createEngineController(robotId, config, initFrac) {
    const { x, y } = fracToCart(...initFrac)
    const profile = createRobotProfile('guide-indoor', {
      kinematics: { maxSpeed: ROBOT_SPEED, acceleration: 0.5, rotationSpeed: ROTATE_DPS },
      battery: { capacity: config.battery ?? 100, drainMove: 0.0000017, drainIdle: 0.00000085, drainRotate: 0.0000008 }
    })
    const controller = robotEngine.addRobot(robotId, profile, {
      position: { x, y },
      heading: IDLE_HEADING,
      battery: config.battery ?? 100
    })
    engineControllerMap.set(robotId, controller)
    return controller
  }

  // 创建引擎控制器并下发初始 MoveTask
  function setupEngineController(robotId, config, initFrac, routeCoords) {
    const controller = createEngineController(robotId, config, initFrac)
    if (routeCoords && routeCoords.length >= 2) {
      const firstTarget = fracToCart(...routeCoords[0])
      controller.moveTo([firstTarget.x, firstTarget.y], { tolerance: ARRIVAL_DIST })
    }
  }

  // 启动所有机器人（清除旧状态）
  function startAll(routeMap) {
    const savedFov = new Set(fovSet)
    stopAll()
    savedFov.forEach((robotId) => fovSet.add(robotId))
    patrolRoutes.value = { ...routeMap }
    const spreadMap = spreadPositionsMap.value
    const announcementsMap = robotAnnouncementPoints.value
    const paths = robotPaths.value
    for (const [robotId, routeIdList] of Object.entries(routeMap)) {
      const config = robotConfigs.value.find((configItem) => configItem.id === robotId) || { id: robotId }
      const initFrac = spreadMap.get(robotId) || config.initialFrac || [0.5, 0.5]
      const path = paths.all[robotId]
      // 支持单导航点路线，路径至少包含起点和终点两个点
      if (!path || path.coords.length < 2) continue
      const announcementPoints = announcementsMap[robotId] || []
      patrolState.set(
        robotId,
        createPatrolState(config, routeIdList, path.coords, path.poiIndices, announcementPoints, initFrac, 'move')
      )

      // 创建引擎控制器（含运动学 + 电量模拟）
      setupEngineController(robotId, config, initFrac, path.coords)

      addRobotToMap(robotId, initFrac, config.name || robotId)
      if (fovSet.has(robotId)) {
        const initialCartesian = fracToCart(...initFrac)
        showFov(robotId, { cartPos: initialCartesian, smoothHeading: IDLE_HEADING })
      }
    }
    if (patrolState.size === 0) return
    isRunning.value = true
    followCam.value = false
    lastTimestamp.value = 0
    rafId.value = requestAnimationFrame(mainLoop)
    updateSidebarStatus()
  }

  // 停止所有机器人
  function stopAll() {
    stopLoop()
    for (const [robotId] of patrolState) getRobotCtrl().removeRobot(robotId)
    // 清理引擎控制器
    for (const [robotId] of engineControllerMap) robotEngine.removeRobot(robotId)
    engineControllerMap.clear()
    patrolState.clear()
    robots.value = []
    _prevStatusCache.clear()
  }

  // 暂停所有巡逻
  function pauseAll() {
    stopLoop()
    for (const [robotId, state] of patrolState) {
      state.phase = GUIDE_PHASE.IDLE
      const engineCtrl = engineControllerMap.get(robotId)
      if (engineCtrl) engineCtrl.cancelCurrentTask()
    }
    syncRobotMarkers()
    updateSidebarStatus()
  }

  // 恢复所有机器人巡逻
  function resumeAll() {
    if (!Array.from(patrolState.values()).some((state) => state.route.length >= 2)) return
    isRunning.value = true
    lastTimestamp.value = 0
    rafId.value = requestAnimationFrame(mainLoop)
    for (const [robotId, state] of patrolState) {
      if (state.route.length >= 2) {
        state.phase = GUIDE_PHASE.MOVE
        issueNextWaypoint(robotId, state)
      }
    }
    updateSidebarStatus()
  }

  // ==================== 单机器人控制 ====================

  function startSingle(robotId) {
    const state = patrolState.get(robotId)
    if (!state) {
      console.warn('[RM] startSingle: robot not found', robotId)
      return false
    }
    if (state.route.length < 2) {
      console.warn('[RM] startSingle: no valid route', robotId)
      return false
    }
    state.phase = GUIDE_PHASE.MOVE
    state.batteryLowWarned = false
    // 确保引擎控制器存在
    if (!engineControllerMap.has(robotId)) {
      const config = robotConfigs.value.find((configItem) => configItem.id === robotId)
      if (config) {
        const spreadMap = spreadPositionsMap.value
        const initFrac = spreadMap.get(robotId) || config.initialFrac || [0.5, 0.5]
        setupEngineController(robotId, config, initFrac, state.route)
      }
    }
    // 下发当前路点
    issueNextWaypoint(robotId, state)
    getRobotCtrl().updateRobot(robotId, { lngLat: state.lngLat, rotation: iconRot(state.smoothHeading) })
    if (fovSet.has(robotId)) showFov(robotId, state)
    if (!isRunning.value) {
      isRunning.value = true
      lastTimestamp.value = 0
      rafId.value = requestAnimationFrame(mainLoop)
    }
    updateSidebarStatus()
    return true
  }

  function stopSingle(robotId) {
    const state = patrolState.get(robotId)
    if (!state) {
      console.warn('[RM] stopSingle: robot not found', robotId)
      return false
    }
    state.phase = GUIDE_PHASE.IDLE
    const engineCtrl = engineControllerMap.get(robotId)
    if (engineCtrl) engineCtrl.cancelCurrentTask()
    getRobotCtrl().updateRobot(robotId, { lngLat: state.lngLat, rotation: iconRot(state.smoothHeading) })
    if (fovSet.has(robotId)) showFov(robotId, state)
    checkAndStopIfAllIdle()
    updateSidebarStatus()
    return true
  }

  // ==================== 交互操作 ====================

  function hideAllFov() {
    fovMap.forEach((fov) => fov.hide())
  }

  function restoreFov() {
    const currentFloor = getCurrentFloor?.() || '1F'
    for (const [robotId, fov] of fovMap) {
      if (fovSet.has(robotId)) {
        const state = patrolState.get(robotId)
        if (!state || state.floor !== currentFloor) continue
        fov.show()
        fov.update(state.cartPos, state.smoothHeading)
      }
    }
  }

  function toggleFov(robotId) {
    if (!robotId || typeof robotId !== 'string') {
      console.warn('[RM] toggleFov: invalid', robotId)
      return
    }
    if (!fovMap.has(robotId)) {
      console.warn('[RM] toggleFov: not in map', robotId)
      return
    }
    if (fovSet.has(robotId)) {
      fovSet.delete(robotId)
      fovMap.get(robotId).hide()
    } else {
      fovSet.add(robotId)
      showFov(robotId, patrolState.get(robotId))
    }
    updateSidebarStatus()
  }

  function setFollowRobot(robotId) {
    if (!robotId || typeof robotId !== 'string') {
      followRobotId.value = null
      followCam.value = false
      return
    }
    followRobotId.value = robotId
    followCam.value = true
    applyFollowCam()
  }

  function getPatrolState(robotId) {
    return patrolState.get(robotId) || null
  }

  // ==================== 持久化与编辑 ====================

  function loadFromStorageAndMerge(configDefinitions, routesDefinition) {
    const savedConfigs = loadFromStorage(STORAGE_KEYS.CONFIGS, configDefinitions),
      savedRoutes = loadFromStorage(STORAGE_KEYS.ROUTES, routesDefinition)
    return {
      configs: configDefinitions.map((config) => {
        const savedConfig = savedConfigs.find((savedItem) => savedItem.id === config.id)
        return savedConfig ? { ...config, ...savedConfig } : config
      }),
      routes: { ...routesDefinition, ...savedRoutes }
    }
  }

  // 初始化机器人（从配置创建巡逻状态 + 创建引擎控制器 + 添加到地图 + 初始化 FOV）
  function initRobots(configDefinitions, routeMap = {}) {
    const { configs, routes } = loadFromStorageAndMerge(configDefinitions, routeMap)
    robotConfigs.value = configs
    patrolRoutes.value = { ...routes }
    _prevStatusCache.clear()
    const spreadMap = spreadPositionsMap.value
    const announcementsMap = robotAnnouncementPoints.value
    const paths = robotPaths.value
    const currentFloor = getCurrentFloor?.() || '1F'
    for (const config of configs) {
      const routeIdList = routes[config.id] || []
      const initFrac = spreadMap.get(config.id) || config.initialFrac || [0.5, 0.5]
      const path = paths.all[config.id]
      const pathCoords = path?.coords || []
      const pathPoiIndices = path?.poiIndices || []
      const announcementPoints = announcementsMap[config.id] || []
      patrolState.set(
        config.id,
        createPatrolState(config, routeIdList, pathCoords, pathPoiIndices, announcementPoints, initFrac, 'idle')
      )

      // 创建引擎控制器（空闲态，无活跃任务）
      createEngineController(config.id, config, initFrac)
      // 只将当前楼层的机器人加入地图，其余楼层在切换时按需添加
      if (config.floor === currentFloor) {
        addRobotToMap(config.id, initFrac, config.name || config.id)
      }
    }
    initFovInstances()
    const isFirst = fovSet.size === 0
    for (const robotId of patrolState.keys()) {
      const state = patrolState.get(robotId),
        fovInstance = fovMap.get(robotId)
      if (!fovInstance) continue
      if ((fovSet.has(robotId) || isFirst) && state.floor === currentFloor) {
        fovInstance.show()
        fovSet.add(robotId)
        if (state) fovInstance.update(state.cartPos, state.smoothHeading)
      } else fovInstance.hide()
    }
    updateSidebarStatus()
  }

  // 编辑模式下设置机器人路线
  function setRobotRoute(robotId, routeIds) {
    const state = patrolState.get(robotId)
    if (!state) return false
    patrolRoutes.value = { ...patrolRoutes.value, [robotId]: routeIds }
    const announcementPoints = robotAnnouncementPoints.value[robotId] || []
    const path = robotPaths.value.all[robotId]
    if (!routeIds?.length || routeIds.length < 2) {
      state.route = []
      state.routeIds = []
      state.poiIndices = []
      state.announcementPoints = []
      state.waypointIndex = 0
      state.phase = GUIDE_PHASE.IDLE
    } else if (path) {
      state.route = path.coords
      state.routeIds = routeIds
      state.poiIndices = path.poiIndices
      state.announcementPoints = announcementPoints
      state.waypointIndex = 0
      state.phase = GUIDE_PHASE.IDLE
      const initialCartesian = fracToCart(...path.coords[0])
      state.cartPos = { ...initialCartesian }
      state.lngLat = cartToGPS(initialCartesian.x, initialCartesian.y)
      // 同步引擎控制器位置
      const engineCtrl = engineControllerMap.get(robotId)
      if (engineCtrl) engineCtrl.setPosition(initialCartesian.x, initialCartesian.y)
      getRobotCtrl().updateRobot(robotId, { lngLat: state.lngLat, rotation: iconRot(state.smoothHeading) })
    }
    const currentRoutes = loadFromStorage(STORAGE_KEYS.ROUTES, { ...PATROL_ROUTES })
    currentRoutes[robotId] = routeIds
    saveToStorage(STORAGE_KEYS.ROUTES, currentRoutes)
    updateSidebarStatus()
    return true
  }

  // 编辑模式下设置机器人出发点 POI ID
  function setRobotStartPoi(robotId, startPoiId) {
    const config = robotConfigs.value.find((configItem) => configItem.id === robotId)
    if (config) {
      config.startPoiId = startPoiId
      // 触发响应式更新，使 spreadPositionsMap / robotPaths 等 computed 重新计算
      robotConfigs.value = [...robotConfigs.value]
      // 同步保存到 localStorage
      const currentConfigs = loadFromStorage(STORAGE_KEYS.CONFIGS, [...ROBOT_CONFIGS])
      const savedIndex = currentConfigs.findIndex((configItem) => configItem.id === robotId)
      if (savedIndex >= 0) {
        currentConfigs[savedIndex].startPoiId = startPoiId
        saveToStorage(STORAGE_KEYS.CONFIGS, currentConfigs)
      }
    }
  }

  // 编辑模式下设置机器人位置
  function setRobotPosition(robotId, position) {
    const state = patrolState.get(robotId)
    if (!state || !position || position.length !== 2) return false
    const [xFrac, yFrac] = position
    if (xFrac < 0 || xFrac > 1 || yFrac < 0 || yFrac > 1) return false
    const cartPosition = fracToCart(xFrac, yFrac),
      lngLat = cartToGPS(cartPosition.x, cartPosition.y)
    state.cartPos = { ...cartPosition }
    state.lngLat = lngLat
    state.initialFrac = position
    // 同步引擎控制器位置
    const engineCtrl = engineControllerMap.get(robotId)
    if (engineCtrl) engineCtrl.setPosition(cartPosition.x, cartPosition.y)
    getRobotCtrl().updateRobot(robotId, { lngLat: lngLat, rotation: state.rotation || iconRot(state.smoothHeading) })
    const currentConfigs = loadFromStorage(STORAGE_KEYS.CONFIGS, [...ROBOT_CONFIGS]),
      configIndex = currentConfigs.findIndex((configItem) => configItem.id === robotId)
    if (configIndex >= 0) {
      currentConfigs[configIndex].initialFrac = position
      saveToStorage(STORAGE_KEYS.CONFIGS, currentConfigs)
    }
    const existing = robotConfigs.value.find((configItem) => configItem.id === robotId)
    if (existing) existing.initialFrac = position
    if (fovSet.has(robotId)) updateFov(robotId, state)
    updateSidebarStatus()
    return true
  }

  // ==================== 生命周期 ====================

  onBeforeUnmount(() => {
    robotEngine.stop()
    fovMap.forEach((fovInstance) => fovInstance.remove())
    fovMap.clear()
    fovSet.clear()
    stopAll()
  })

  // ==================== 返回值 ====================

  return {
    robots,
    isRunning,
    followCam,
    followRobotId,
    robotHeading,
    startAll,
    stopAll,
    pauseAll,
    resumeAll,
    startSingle,
    stopSingle,
    hideAllFov,
    restoreFov,
    toggleFov,
    setFollowRobot,
    getPatrolState,
    initRobots,
    setRobotRoute,
    routeDisplayData,
    setRobotPosition,
    setRobotStartPoi,
    updateSidebarStatus,
    get onPoiArrival() {
      return onPoiArrival.value
    },
    set onPoiArrival(callback) {
      onPoiArrival.value = typeof callback === 'function' ? callback : null
    },
    get lowBatteryCallback() {
      return lowBatteryCallback.value
    },
    set lowBatteryCallback(callback) {
      lowBatteryCallback.value = typeof callback === 'function' ? callback : null
    },
    get onAnnouncementChanged() {
      return onAnnouncementChanged.value
    },
    set onAnnouncementChanged(callback) {
      onAnnouncementChanged.value = typeof callback === 'function' ? callback : null
    },
    get onTourComplete() {
      return onTourComplete.value
    },
    set onTourComplete(callback) {
      onTourComplete.value = typeof callback === 'function' ? callback : null
    }
  }
}
export { getFovColor }
