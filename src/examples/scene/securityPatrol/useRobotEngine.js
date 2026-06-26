/**
 * RobotEngine / RobotController / FOV 生命周期管理 Vue composable
 *
 * 负责 RobotEngine、RobotController 和 createRobotFOV 的创建与生命周期管理。
 * 从 useENURoutePlanner 中提取引擎/控制器/FOV 相关逻辑。
 *
 * @module useRobotEngine
 */

import { shallowRef } from 'vue'
import { RobotEngine, RobotController, createRobotFOV, createRobotProfile } from '@/bicMap/core/robot'
import { Pathfinder } from '@/bicMap/core/navigation'

/**
 * 创建 RobotEngine composable
 *
 * @param {Object} options
 * @param {() => import('maplibre-gl').Map | null} options.getMap - 返回地图实例的回调
 * @param {Object} options.mapConfig - 地图配置 { startX, startY, width, height, scale }
 * @param {Object[]} [options.obstacles=[]] - Pathfinder 障碍物列表
 * @returns {Object} 引擎/控制器/FOV 控制接口
 */
export function useRobotEngine({ getMap, mapConfig, obstacles = [] }) {
  // ─── 内部状态 ─────────────────────────────────────────────────────────────

  /** @type {RobotEngine|null} */
  let engine = null

  /** @type {Object.<string, RobotController>} */
  const controllers = {}

  /** @type {Object.<string, Object>} createRobotFOV 返回的控制器 */
  const fovInstances = {}

  /** @type {Pathfinder|null} */
  let pathfinder = null

  /** @type {number} RAF 循环 ID */
  let animationFrameId = 0

  /** @type {boolean} 是否已初始化 */
  let initialized = false

  /** @type {Object.<string, { position: { x: number, y: number }, heading: number }>} 机器人运行时状态快照 */
  const robotStates = shallowRef({})

  /** @type {import('vue').Ref<boolean>} */
  const isRunning = shallowRef(false)

  // ─── 初始化 ───────────────────────────────────────────────────────────────

  /**
   * 初始化引擎和控制器
   *
   * @param {Object[]} robotConfigs - 机器人配置列表 [{ id, name, speed, ... }]
   * @param {Object} [pathfinderOptions] - Pathfinder 额外选项
   */
  function init(robotConfigs, pathfinderOptions = {}) {
    if (initialized) return
    const mapInstance = getMap()
    if (!mapInstance || !mapConfig) return

    // 创建 Pathfinder
    pathfinder = new Pathfinder({
      widthMeters: mapConfig.width,
      heightMeters: mapConfig.height,
      ...pathfinderOptions,
    })
    pathfinder.setObstacles(obstacles)

    // 创建 RobotEngine
    engine = new RobotEngine({ maxDeltaTime: 100 })

    // 为每台机器人创建 RobotController
    for (const config of robotConfigs) {
      const profile = createRobotProfile('patrol-outdoor', {
        kinematics: {
          maxSpeed: 12.0,         // 移动速度 12 m/s
          acceleration: 4.0,      // 加速度 4 m/s²
          rotationSpeed: 120,     // 转向速度 120°/s
        },
        battery: {
          drainMove: 0.000003,   // 移动：~10 分钟/1%
          drainRotate: 0.000002,  // 旋转：~15 分钟/1%
          drainIdle: 0.000001,    // 待机：~33 分钟/1%
          drainWait: 0.000001,    // 等待：~33 分钟/1%
        },
      })
      const initialState = {
        position: { x: 0.5, y: 0.5 },
        heading: 0,
        battery: config.battery !== undefined ? config.battery : 100,
      }
      const controller = engine.addRobot(config.id, profile, initialState)
      controllers[config.id] = controller
    }

    initialized = true
  }

  // ─── 机器人控制器 ─────────────────────────────────────────────────────────

  /**
   * 获取指定机器人的 RobotController
   *
   * @param {string} robotId
   * @returns {RobotController|undefined}
   */
  function getController(robotId) {
    return controllers[robotId]
  }

  /**
   * 获取所有机器人控制器
   *
   * @returns {Object.<string, RobotController>}
   */
  function getAllControllers() {
    return { ...controllers }
  }

  // ─── FOV 管理 ─────────────────────────────────────────────────────────────

  /**
   * 为指定机器人创建 FOV 视野
   *
   * @param {string} robotId - 机器人 ID
   * @param {Object} [fovOptions] - FOV 配置选项
   */
  function createFOVForRobot(robotId, fovOptions = {}) {
    const mapInstance = getMap()
    if (!mapInstance || fovInstances[robotId]) return

    const fovInstance = createRobotFOV(mapInstance, {
      id: robotId,
      mapConfig,
      enabled: true,
      ...fovOptions,
    })
    fovInstances[robotId] = fovInstance
  }

  /**
   * 更新指定机器人的 FOV
   *
   * @param {string} robotId - 机器人 ID
   * @param {{ x: number, y: number }} cartesianPos - 笛卡尔坐标
   * @param {number} heading - 朝向角（度）
   */
  function updateFOV(robotId, cartesianPos, heading) {
    const fovInstance = fovInstances[robotId]
    if (!fovInstance) return
    fovInstance.update(cartesianPos, heading)
  }

  /**
   * 移除指定机器人的 FOV
   *
   * @param {string} robotId
   */
  function removeFOV(robotId) {
    const fovInstance = fovInstances[robotId]
    if (fovInstance) {
      fovInstance.remove()
      delete fovInstances[robotId]
    }
  }

  // ─── 工具 ─────────────────────────────────────────────────────────────────

  /**
   * 获取 Pathfinder 实例
   *
   * @returns {Pathfinder|null}
   */
  function getPathfinder() {
    return pathfinder
  }

  // ─── 主循环 ───────────────────────────────────────────────────────────────

  /**
   * 执行一帧更新（由外部 RAF 循环调用）
   *
   * @param {number} deltaTime - 帧间隔（毫秒）
   * @returns {Object.<string, { position: { x: number, y: number }, heading: number, phase: string, battery: number, taskStatus: string }>}
   *   各机器人当前状态快照
   */
  function tick(deltaTime) {
    if (!engine) return {}

    engine.tick(deltaTime)

    // 收集所有机器人当前状态
    const snapshot = {}
    for (const [robotId, controller] of Object.entries(controllers)) {
      snapshot[robotId] = {
        position: controller.getPosition(),
        heading: controller.getHeading(),
        phase: controller.getPhase(),
        battery: controller.getBattery(),
        taskStatus: controller.getTaskStatus(),
      }
    }
    robotStates.value = snapshot
    return snapshot
  }

  // ─── 清理 ─────────────────────────────────────────────────────────────────

  /**
   * 清理所有资源
   */
  function cleanup() {
    // 停止引擎
    if (engine && engine.isRunning()) {
      engine.stop()
    }

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = 0
    }

    // 移除所有 FOV
    for (const robotId of Object.keys(fovInstances)) {
      removeFOV(robotId)
    }

    // 移除所有控制器
    if (engine) {
      for (const robotId of Object.keys(controllers)) {
        engine.removeRobot(robotId)
      }
      engine = null
    }

    // 清空控制器
    for (const robotId of Object.keys(controllers)) {
      delete controllers[robotId]
    }

    // 清空状态
    robotStates.value = {}
    isRunning.value = false
    initialized = false
  }

  // ─── 导出 ─────────────────────────────────────────────────────────────────

  return {
    // 初始化
    init,

    // 引擎
    engine,
    controllers,
    robotStates,
    isRunning,

    // 控制器
    getController,
    getAllControllers,

    // FOV
    createFOVForRobot,
    updateFOV,
    removeFOV,

    // 工具
    getPathfinder,

    // 主循环
    tick,

    // 清理
    cleanup,
  }
}
