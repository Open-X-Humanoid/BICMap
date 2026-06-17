import { ref, onBeforeUnmount } from 'vue'
import { ROBOT_STATUS } from '@/bicMap/core/robot'
import { IOT_EVENT_TYPE } from '@/bicMap/core/overlay'
import {
  UPDATE_MS,
  ARRIVAL_DIST,
  IDLE_HEADING,
  ROTATE_DPS,
  ROBOT_SPEED,
  MAP_START_X,
  MAP_START_Y,
  MAP_RESOLUTION,
  MAP_WIDTH,
  MAP_HEIGHT
} from './constants.js'
import { createGeoUtils, cartDist, cartHeading, lerpAngle, iconRot } from '@/bicMap/core/navigation'
const { fracToCart, cartToGPS, fracToGPS } = createGeoUtils({
  startX: MAP_START_X,
  startY: MAP_START_Y,
  width: MAP_WIDTH,
  height: MAP_HEIGHT,
  scale: MAP_RESOLUTION
})
import { buildReturnRoute, ROOM_ROUTES } from './routeConfig.js'
import { RobotEngine, WaitCondition, createRobotProfile, ROBOT_PROFILE_TYPES } from '@/bicMap/core/robot'

// ===== 配送模拟 Composable =====

/**
 * useDeliverySimulation
 *
 * 配置驱动的配送状态机：路线由 RoomDeliveryConfig.forwardRoute 描述，
 * 引擎通过 RouteWaypoint.type 自动分派动作，无需关心同层/跨层细节。
 *
 * @param {object} options
 * @param {() => object}          options.getRobotCtrl    - 返回 robotCtrl 实例
 * @param {() => object}          options.getRobot3DCtrl  - 返回 3D robotCtrl 实例
 * @param {() => object}          options.getFov          - 返回 fov 实例
 * @param {() => object}          options.getIot          - 返回 iot 实例
 * @param {() => object}          options.getFloorManager - 返回 floorManager 实例
 * @param {(lngLat: [number,number], heading: number) => void} [options.onPositionChange] - 位置更新回调（供外部相机跟随等使用）
 * @param {import('./routeConfig.js').RoomDeliveryConfig} [options.missionConfig]
 *
 * @returns {{
 *   isRunning:      import('vue').Ref<boolean>,
 *   isPaused:       import('vue').Ref<boolean>,
 *   deliveryPhase:  import('vue').Ref<string>,
 *   robotFloor:     import('vue').Ref<string>,
 *   followCam:      import('vue').Ref<boolean>,
 *   robotHeading:   import('vue').Ref<number>,
 *   toggleDelivery: () => void,
 *   resetDelivery:  () => void,
 *   stopTimers:     () => void,
 * }}
 */
export function useDeliverySimulation(options) {
  const {
    getRobotCtrl,
    getRobot3DCtrl,
    getFov,
    getIot,
    getFloorManager,
    onPositionChange,
    missionConfig = ROOM_ROUTES['215']
  } = options

  const cfg = missionConfig

  // 预解析返程路线（'auto' → buildReturnRoute，否则直接使用）
  const resolvedReturnRoute = cfg.returnRoute === 'auto' ? buildReturnRoute(cfg.forwardRoute) : cfg.returnRoute

  // IoT 事件 ID 前缀（以 robotId 命名空间，避免多机器人事件互相覆盖）
  const iotId = (name) => `${cfg.robotId}-${name}`

  // ── 引擎运行时 ────────────────────────────────────────────────────────────
  let engine = null // RobotEngine 实例
  let controller = null // RobotController 实例
  let syncRafId = 0 // 同步循环 RAF 句柄
  let isReturning = false
  let routeQueue = [] // RouteWaypoint[]，当前正在执行的路线段
  let queueHead = 0 // 当前目标航点在 routeQueue 中的索引

  // 响应式状态
  const robotHeading = ref(IDLE_HEADING)
  const isRunning = ref(false)
  const isPaused = ref(false)
  const deliveryPhase = ref('idle') // idle | moving | elevator | riding | delivered | returning
  const robotFloor = ref(cfg.homeFloor)
  const followCam = ref(true)

  // ── 同步循环 RAF 清理 ─────────────────────────────────────────────────────
  // 只停止同步循环，不影响 rotateToHeading 自身的独立 RAF
  function stopTimers() {
    if (syncRafId) {
      cancelAnimationFrame(syncRafId)
      syncRafId = 0
    }
  }

  // ── 从 controller 同步状态到外部 ──────────────────────────────────────────
  function syncFromController(extraProps = {}) {
    if (!controller) return
    const pos = controller.getPosition()
    const heading = controller.getHeading()
    const lngLat = cartToGPS(pos.x, pos.y)
    getRobotCtrl().updateRobot(cfg.robotId, { lngLat, rotation: iconRot(heading), ...extraProps })

    const robot3DCtrl = getRobot3DCtrl?.()
    if (robot3DCtrl) {
      robot3DCtrl.updateRobot(cfg.robotId, { lngLat, heading })
    }

    getFov().update(pos, heading)
    robotHeading.value = heading
    onPositionChange?.(lngLat, heading)
  }

  // ── 原地旋转辅助 ──────────────────────────────────────────────────────────
  // 用独立的 RAF 逐帧微调 controller 的 heading，不涉及移动。
  // 使用局部 rotationRafId，不与同步循环的 syncRafId 冲突。
  // resolve 时机：当前朝向与 targetHeading 偏差 ≤ 单步旋转角度。
  function rotateToHeading(targetHeading) {
    return new Promise((resolve, reject) => {
      let lastTs = 0
      let rotationRafId = 0
      function tick(ts) {
        if (!isRunning.value) {
          cancelAnimationFrame(rotationRafId)
          reject('cancelled')
          return
        }
        const dt = lastTs ? Math.min(ts - lastTs, 100) : UPDATE_MS
        lastTs = ts
        const currentHeading = controller.getHeading()
        const diff = ((targetHeading - currentHeading + 540) % 360) - 180
        const stepDeg = ROTATE_DPS * (dt / 1000)
        if (Math.abs(diff) <= stepDeg) {
          controller.setHeading(targetHeading)
          syncFromController()
          resolve()
          return
        }
        controller.setHeading((currentHeading + Math.sign(diff) * stepDeg + 360) % 360)
        syncFromController()
        rotationRafId = requestAnimationFrame(tick)
      }
      rotationRafId = requestAnimationFrame(tick)
    })
  }

  // ── 引擎同步循环 ───────────────────────────────────────────────────────────
  // 从自己的 RAF 循环驱动 engine.tick(dt)，使引擎的 MoveTask 得以推进，
  // 并在同一帧将最新状态同步到地图。
  // 使用独立的 syncRafId，不与 rotateToHeading 的 rotationRafId 冲突。
  function startSyncLoop() {
    let lastTs = performance.now()
    function tick(ts) {
      if (!isRunning.value) {
        syncRafId = 0
        return
      }
      const dt = Math.min(ts - lastTs, 100)
      lastTs = ts
      if (!isPaused.value) {
        engine.tick(dt)
      }
      syncFromController()
      syncRafId = requestAnimationFrame(tick)
    }
    syncRafId = requestAnimationFrame(tick)
  }

  // ── 导航到指定航点 ────────────────────────────────────────────────────────
  // 1. 原地旋转对准目标方向
  // 2. 通过 controller.moveTo() 直线移动至目标（引擎内部处理旋转+平移，到达后自动吸附到精确坐标）
  // 3. 到达后同步状态并分派 onWaypointReached
  async function navigateToWaypoint(waypoint) {
    const target = fracToCart(...waypoint.frac)
    const currentPos = controller.getPosition()
    const targetHeading = cartHeading(currentPos, target)
    try {
      await rotateToHeading(targetHeading)
      await controller.moveTo([target.x, target.y], { tolerance: ARRIVAL_DIST })
      syncFromController()
      onWaypointReached(waypoint)
    } catch (err) {
      if (isRunning.value) {
        console.warn('[Delivery] navigateToWaypoint failed:', { waypoint, error: err?.message ?? err })
      }
    }
  }

  // ── 到达航点事件分派（按 type 路由）────────────────────────────────────────
  function onWaypointReached(wp) {
    switch (wp.type) {
      case 'elevator':
        handleElevator(wp)
        return

      case 'destination':
        handleDelivered(wp)
        return

      case 'home':
        rotateToHeading(IDLE_HEADING)
          .then(onReturnComplete)
          .catch((err) => {
            if (isRunning.value) console.warn('[Delivery] home rotation failed:', err?.message ?? err)
          })
        return

      default: {
        const nextIdx = queueHead + 1
        if (nextIdx < routeQueue.length) {
          queueHead++
          navigateToWaypoint(routeQueue[queueHead])
        } else {
          console.warn('[useDeliverySimulation] route ends with default type waypoint, stopping')
          if (isReturning) onReturnComplete()
          else {
            stopTimers()
            isRunning.value = false
            deliveryPhase.value = 'idle'
          }
        }
      }
    }
  }

  // ── 电梯序列（async/await 展平 10 层嵌套）──────────────────────────────────
  //
  // 完整动画链：
  //   转朝电梯门 → 呼梯 IoT → 电梯到达 IoT → 开门 IoT
  //   → 进入轿厢 → 轿厢内 180° 转身 → 等待 2s（模拟运行）
  //   → 切换楼层 → 走出轿厢 → 转向走廊 → 走出电梯厅
  //   → 关门 IoT → 转向下一目标 → 恢复主路线
  //
  async function handleElevator(wp) {
    deliveryPhase.value = 'elevator'

    const elevCfg = wp.elevatorConfig
    const elevCart = fracToCart(...wp.frac)
    const elevLngLat = cartToGPS(elevCart.x, elevCart.y)
    const interiorCart = fracToCart(...elevCfg.interiorFrac)
    const hallExitCart = fracToCart(...elevCfg.hallExitFrac)
    const corridorCart = fracToCart(...elevCfg.corridorFrac)
    const suffix = `to-${elevCfg.toFloor}`

    controller.setPosition(elevCart.x, elevCart.y)

    try {
      // 1. 转朝电梯门，状态切为等待电梯
      await rotateToHeading(elevCfg.facingAngle)
      getRobotCtrl().updateRobot(cfg.robotId, { status: ROBOT_STATUS.IDLE, task: '等待电梯' })
      getIot().emit({
        id: iotId(`elev-call-${suffix}`),
        lngLat: elevLngLat,
        type: IOT_EVENT_TYPE.ELEVATOR_CALL,
        deviceName: elevCfg.name,
        duration: 3500
      })

      // 2. 等 2s → 电梯到达
      await controller.waitFor(WaitCondition.duration(2000))
      getIot().emit({
        id: iotId(`elev-arrived-${suffix}`),
        lngLat: elevLngLat,
        type: IOT_EVENT_TYPE.ELEVATOR_ARRIVED,
        deviceName: elevCfg.name,
        duration: 2500
      })

      // 3. 等 2s → 开门，进入轿厢
      await controller.waitFor(WaitCondition.duration(2000))
      getIot().emit({
        id: iotId(`elev-open-${suffix}`),
        lngLat: elevLngLat,
        type: IOT_EVENT_TYPE.ELEVATOR_OPEN,
        deviceName: elevCfg.name,
        duration: 2000
      })
      await controller.moveTo([interiorCart.x, interiorCart.y], { tolerance: ARRIVAL_DIST })

      // 4. 轿厢内 180° 转身面向门内侧，切换乘梯状态
      deliveryPhase.value = 'riding'
      await rotateToHeading((elevCfg.facingAngle + 180) % 360)
      getRobotCtrl().updateRobot(cfg.robotId, { status: ROBOT_STATUS.RUNNING, task: '电梯运行中' })

      // 5. 等 2s（模拟电梯运行）→ 切换楼层
      await controller.waitFor(WaitCondition.duration(2000))
      robotFloor.value = elevCfg.toFloor
      getFloorManager().switchTo(elevCfg.toFloor)
      const postElevTask = isReturning ? cfg.returnTask : cfg.missionTask
      getRobotCtrl().updateRobot(cfg.robotId, { status: ROBOT_STATUS.RUNNING, task: postElevTask })
      deliveryPhase.value = isReturning ? 'returning' : 'moving'
      getIot().emit({
        id: iotId(`elev-arrived-dest-${suffix}`),
        lngLat: elevLngLat,
        type: IOT_EVENT_TYPE.ELEVATOR_ARRIVED,
        deviceName: `${elevCfg.name} · ${elevCfg.toFloor}`,
        duration: 2500
      })

      // 6. 走出轿厢 → 转向走廊 → 走出电梯厅
      await controller.moveTo([hallExitCart.x, hallExitCart.y], { tolerance: ARRIVAL_DIST })
      await rotateToHeading(cartHeading(hallExitCart, corridorCart))
      await controller.moveTo([corridorCart.x, corridorCart.y], { tolerance: ARRIVAL_DIST })
      getIot().emit({
        id: iotId(`elev-close-${suffix}`),
        lngLat: elevLngLat,
        type: IOT_EVENT_TYPE.ELEVATOR_CLOSE,
        deviceName: elevCfg.name,
        duration: 2000
      })

      // 7. 转向下一目标，恢复主路线
      // 若 corridorFrac 与下一航点坐标重合（去程 corridorFrac 已被显式列为航点时），
      // 跳过该重复航点，直接处理再下一个航点，避免多余转向
      queueHead++
      if (queueHead < routeQueue.length) {
        const nextWaypoint = routeQueue[queueHead]
        const nextWaypointCart = fracToCart(...nextWaypoint.frac)
        const isSamePosition =
          Math.abs(corridorCart.x - nextWaypointCart.x) < ARRIVAL_DIST &&
          Math.abs(corridorCart.y - nextWaypointCart.y) < ARRIVAL_DIST

        if (isSamePosition) {
          // 坐标重合，跳过该航点，直接处理再下一个
          queueHead++
          if (queueHead < routeQueue.length) {
            await navigateToWaypoint(routeQueue[queueHead])
          }
        } else {
          await navigateToWaypoint(nextWaypoint)
        }
      }
    } catch (err) {
      if (isRunning.value) {
        console.warn('[Delivery] elevator sequence cancelled:', err?.message ?? err)
      }
    }
  }

  // ── 配送完成序列（async/await 展平 4 层嵌套）──────────────────────────────
  //
  //   ① 吸附到目的地 → ② 转向房门 → ③ 触发 IoT（门开 + 配送到达）
  //   ④ 等待 → ⑤ 自动启动返程
  //
  async function handleDelivered(wp) {
    deliveryPhase.value = 'delivered'

    const destCfg = wp.destinationConfig ?? {}
    const wpCart = fracToCart(...wp.frac)
    const doorCart = destCfg.doorFrac ? fracToCart(...destCfg.doorFrac) : wpCart
    const doorLngLat = cartToGPS(doorCart.x, doorCart.y)

    controller.setPosition(wpCart.x, wpCart.y)
    getRobotCtrl().updateRobot(cfg.robotId, { status: ROBOT_STATUS.IDLE, task: '配送完成' })
    syncFromController()

    try {
      // 1. 转向房门
      await rotateToHeading(destCfg.facingAngle ?? 0)
      getIot().emit({
        id: iotId('room-door'),
        lngLat: doorLngLat,
        type: IOT_EVENT_TYPE.DOOR_OPEN,
        deviceName: cfg.roomName,
        duration: 3000
      })

      // 2. 等 2s → 配送到达 IoT
      await controller.waitFor(WaitCondition.duration(2000))
      const pos = controller.getPosition()
      getIot().emit({
        id: iotId('delivery-done'),
        lngLat: cartToGPS(pos.x, pos.y),
        type: IOT_EVENT_TYPE.DELIVERY_ARRIVED,
        deviceName: cfg.roomName,
        duration: 5000
      })

      // 3. 等 3s → 自动返程
      await controller.waitFor(WaitCondition.duration(3000))
      startReturn()
    } catch (err) {
      if (isRunning.value) {
        console.warn('[Delivery] delivery complete sequence cancelled:', err?.message ?? err)
      }
    }
  }

  // ── 开始返程 ────────────────────────────────────────────────────────────────
  function startReturn() {
    if (!isRunning.value) return
    isReturning = true
    routeQueue = resolvedReturnRoute
    queueHead = 1 // index 0 = 目的地（出发点），从 index 1 开始导航
    deliveryPhase.value = 'returning'

    getRobotCtrl().updateRobot(cfg.robotId, { status: ROBOT_STATUS.RUNNING, task: cfg.returnTask })

    if (queueHead >= routeQueue.length) {
      onReturnComplete()
      return
    }

    navigateToWaypoint(routeQueue[queueHead])
  }

  // ── 返程完成 ────────────────────────────────────────────────────────────────
  function onReturnComplete() {
    stopTimers()
    isRunning.value = false
    isPaused.value = false
    deliveryPhase.value = 'idle'
    isReturning = false

    const homeWp = cfg.forwardRoute[0]
    const homeCart = fracToCart(...homeWp.frac)
    controller.setPosition(homeCart.x, homeCart.y)
    controller.setHeading(IDLE_HEADING)
    syncFromController({ status: ROBOT_STATUS.IDLE, battery: cfg.idleBattery, task: cfg.idleTask })
  }

  // ── 开始配送 ────────────────────────────────────────────────────────────────
  function startDelivery() {
    const homeWp = cfg.forwardRoute[0]
    const homeCart = fracToCart(...homeWp.frac)

    // 创建引擎和机器人控制器（使用 ROBOT_SPEED 覆盖默认速度）
    engine = new RobotEngine()
    const robotProfile = createRobotProfile(ROBOT_PROFILE_TYPES.DELIVERY_INDOOR, {
      kinematics: { maxSpeed: ROBOT_SPEED }
    })
    controller = engine.addRobot(cfg.robotId, robotProfile, {
      position: homeCart,
      heading: IDLE_HEADING,
      floor: cfg.homeFloor
    })

    routeQueue = cfg.forwardRoute
    queueHead = 1 // index 0 = home（出发点），从 index 1 开始导航
    isReturning = false

    isRunning.value = true
    isPaused.value = false
    deliveryPhase.value = 'moving'

    getRobotCtrl().updateRobot(cfg.robotId, {
      status: ROBOT_STATUS.RUNNING,
      battery: cfg.idleBattery,
      task: cfg.missionTask
    })

    // 启动同步循环，然后导航至第一个目标航点
    startSyncLoop()
    navigateToWaypoint(routeQueue[queueHead])
  }

  // ── 暂停 / 恢复 / 切换 ──────────────────────────────────────────────────────
  function pauseDelivery() {
    isPaused.value = true
    if (engine) engine.pause()
    stopTimers()
  }

  function resumeDelivery() {
    isPaused.value = false
    if (engine) engine.resume()
    startSyncLoop()
  }

  function toggleDelivery() {
    if (!isRunning.value) startDelivery()
    else if (isPaused.value) resumeDelivery()
    else pauseDelivery()
  }

  // ── 重置模拟（由外部 resetScene 调用）──────────────────────────────────────
  function resetDelivery() {
    stopTimers()
    if (engine) {
      engine.stop()
      if (controller) {
        engine.removeRobot(cfg.robotId)
      }
      engine = null
      controller = null
    }
    isRunning.value = false
    isPaused.value = false
    deliveryPhase.value = 'idle'
    isReturning = false
    followCam.value = false
    robotFloor.value = cfg.homeFloor
    robotHeading.value = IDLE_HEADING
  }

  // ── 组件卸载自动清理 ────────────────────────────────────────────────────────
  onBeforeUnmount(() => {
    stopTimers()
    if (engine) {
      engine.stop()
      engine = null
      controller = null
    }
  })

  return {
    isRunning,
    isPaused,
    deliveryPhase,
    robotFloor,
    followCam,
    robotHeading,
    toggleDelivery,
    resetDelivery,
    stopTimers
  }
}
