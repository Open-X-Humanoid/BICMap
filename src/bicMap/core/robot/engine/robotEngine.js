import { RobotPhase } from '../core/robotPhase.js'
import { RobotController } from './robotController.js'
import { EventBus } from '../infra/eventBus.js'
import { ResourceManager } from '../infra/resourceManager.js'
import { WaypointTypeRegistry } from '../core/waypointTypes.js'

/**
 * 机器人活动编排引擎核心
 */
export class RobotEngine {
  constructor(config = {}) {
    this._config = config
    this._robots = new Map() // robotId -> RobotController
    this._eventBus = new EventBus()
    this._resourceManager = new ResourceManager()
    this._waypointRegistry = new WaypointTypeRegistry()
    this._running = false
    this._paused = false
    this._lastTickTime = 0
    this._maxDeltaTime = config.maxDeltaTime || 100 // 最大帧间隔(ms)
    this._animationFrameId = null
  }

  // ── 生命周期控制 ──

  start() {
    if (this._running) return
    this._running = true
    this._paused = false
    this._lastTickTime = performance.now()
    this._tickLoop()
  }

  stop() {
    this._running = false
    this._paused = false
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId)
      this._animationFrameId = null
    }
  }

  pause() {
    this._paused = true
  }

  resume() {
    if (!this._running) return
    this._paused = false
    this._lastTickTime = performance.now()
  }

  isRunning() {
    return this._running
  }

  isPaused() {
    return this._paused
  }

  // ── 主循环 ──

  _tickLoop() {
    if (!this._running) return
    const now = performance.now()
    const deltaTime = Math.min(now - this._lastTickTime, this._maxDeltaTime)
    this._lastTickTime = now

    if (!this._paused) {
      this.tick(deltaTime)
    }

    this._animationFrameId = requestAnimationFrame(() => this._tickLoop())
  }

  /**
   * 手动触发 tick（供外部主循环使用）
   * @param {number} deltaTime - 帧间隔(ms)
   */
  tick(deltaTime) {
    // 构建上下文（包含当前信号和资源状态）
    const context = this._buildTickContext()

    for (const [robotId, controller] of this._robots) {
      try {
        controller.tick(deltaTime)
      } catch (error) {
        console.error(`[RobotEngine] Error in robot "${robotId}":`, error)
      }
    }
  }

  /**
   * 构建 tick 上下文
   * @returns {Object}
   * @private
   */
  _buildTickContext() {
    const robotStates = {}
    for (const [robotId, controller] of this._robots) {
      robotStates[robotId] = {
        position: controller.getPosition(),
        heading: controller.getHeading(),
        phase: controller.getPhase(),
        battery: controller.getBattery(),
      }
    }
    return {
      robotStates,
      timestamp: Date.now(),
    }
  }

  // ── 机器人管理 ──

  /**
   * 添加机器人
   * @param {string} robotId
   * @param {string|Object} profile - 画像类型名或配置对象
   * @param {Object} [initialState]
   * @returns {RobotController}
   */
  addRobot(robotId, profile, initialState = {}) {
    if (this._robots.has(robotId)) {
      throw new Error(`Robot "${robotId}" already exists`)
    }
    const controller = new RobotController(robotId, profile, initialState)
    controller.setEventBus(this._eventBus)
    controller.setResourceManager(this._resourceManager)
    this._robots.set(robotId, controller)
    return controller
  }

  /**
   * 移除机器人
   * @param {string} robotId
   */
  removeRobot(robotId) {
    const controller = this._robots.get(robotId)
    if (controller) {
      controller.cancelCurrentTask()
      this._robots.delete(robotId)
    }
  }

  /**
   * 获取机器人控制器
   * @param {string} robotId
   * @returns {RobotController|undefined}
   */
  getRobot(robotId) {
    return this._robots.get(robotId)
  }

  /**
   * 获取所有机器人
   * @returns {Map<string, RobotController>}
   */
  getRobots() {
    return new Map(this._robots)
  }

  /**
   * 获取所有机器人的 ID
   * @returns {string[]}
   */
  getRobotIds() {
    return Array.from(this._robots.keys())
  }

  // ── 任务管理 ──

  /**
   * 分配任务给机器人
   * @param {string} robotId
   * @param {Object} task - 任务对象
   */
  assignMission(robotId, task) {
    const controller = this._robots.get(robotId)
    if (!controller) {
      throw new Error(`Robot "${robotId}" not found`)
    }
    controller.execute(task)
  }

  /**
   * 取消机器人的任务
   * @param {string} robotId
   */
  cancelMission(robotId) {
    const controller = this._robots.get(robotId)
    if (controller) {
      controller.cancelCurrentTask()
    }
  }

  /**
   * 获取任务状态
   * @param {string} robotId
   * @returns {string}
   */
  getMissionStatus(robotId) {
    const controller = this._robots.get(robotId)
    return controller ? controller.getTaskStatus() : 'unknown'
  }

  // ── 事件/信号 ──

  /**
   * 发射引擎级信号
   * @param {string} signalName
   * @param {*} data
   */
  emitSignal(signalName, data) {
    this._eventBus.emit(signalName, data)
  }

  /**
   * 监听引擎级信号
   * @param {string} signalName
   * @param {Function} handler
   */
  onSignal(signalName, handler) {
    return this._eventBus.on(signalName, handler)
  }

  /**
   * 获取事件总线实例
   * @returns {EventBus}
   */
  getEventBus() {
    return this._eventBus
  }

  // ── 子系统访问 ──

  /**
   * 获取资源管理器
   * @returns {ResourceManager}
   */
  getResourceManager() {
    return this._resourceManager
  }

  // ── 插件注册 ──

  /**
   * 注册自定义航点类型
   * @param {string} type - WaypointType 值
   * @param {Object} handler - 处理器
   */
  registerWaypointType(type, handler) {
    this._waypointRegistry.register(type, handler)
  }

  /**
   * 获取航点类型注册表
   * @returns {WaypointTypeRegistry}
   */
  getWaypointRegistry() {
    return this._waypointRegistry
  }

  // ── 条件类型注册 (预留插件接口) ──

  /**
   * 注册自定义条件类型
   * @param {string} type - 条件类型标识
   * @param {Function} factory - 条件工厂函数 (config) => Condition
   */
  registerConditionType(type, factory) {
    if (!this._conditionFactories) {
      this._conditionFactories = new Map()
    }
    this._conditionFactories.set(type, factory)
  }

  /**
   * 获取条件类型工厂
   * @param {string} type
   * @returns {Function|undefined}
   */
  getConditionFactory(type) {
    return this._conditionFactories?.get(type)
  }

  // ── 动作类型注册（供 ActionTask 使用） ──

  /**
   * 注册自定义动作类型
   * @param {string} type - 动作类型标识
   * @param {Function} handler - async (context, params) => void
   */
  registerActionType(type, handler) {
    if (!this._actionHandlers) {
      this._actionHandlers = new Map()
    }
    this._actionHandlers.set(type, handler)
  }

  /**
   * 获取已注册的动作处理器
   * @param {string} type
   * @returns {Function|undefined}
   */
  getActionHandler(type) {
    return this._actionHandlers?.get(type)
  }
}
