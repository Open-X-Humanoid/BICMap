import { RobotPhase, canTransition } from '../core/robotPhase.js'
import { createRobotProfile } from '../core/robotProfile.js'
import { MoveTask, WaitTask, ActionTask } from './tasks/atomics.js'
import { TaskStatus } from './tasks/taskStatus.js'

/**
 * 机器人控制器 — 管理单个机器人的状态、行为和任务
 */
export class RobotController {
  /**
   * @param {string} robotId
   * @param {string|Object} profile - 画像类型名或画像配置对象
   * @param {Object} [initialState={}] - 初始状态
   */
  constructor(robotId, profile, initialState = {}) {
    this._id = robotId
    this._profile = typeof profile === 'string' ? createRobotProfile(profile) : profile

    // 状态
    this._phase = initialState.phase || RobotPhase.IDLE
    this._position = initialState.position || { x: 0, y: 0 }
    this._heading = initialState.heading || 0
    this._battery = initialState.battery !== undefined ? initialState.battery : this._profile.battery.capacity
    this._floor = initialState.floor || '1F'
    this._taskStatus = TaskStatus.IDLE

    // 当前执行的任务
    this._currentTask = null
    this._taskPromise = null
    this._taskResolve = null
    this._taskReject = null

    // 事件回调
    this._phaseChangeHandlers = new Set()
    this._errorHandlers = new Set()
    this._signalHandlers = new Map()

    // 上下文（传递给 task.update）
    this._context = {
      position: this._position,
      heading: this._heading,
      battery: this._battery,
      phase: this._phase,
      elapsed: 0,
      signals: {},
      robotStates: {},
      // 基础设施引用（由 RobotEngine 注入）
      eventBus: null,
      resourceManager: null,
      // 环境感知数据（由外部每帧更新）
      sensors: {},
      zones: {},
      elevators: {},
      trafficLights: {},
    }
  }

  // ── 状态访问器 ──

  getId() { return this._id }
  getProfile() { return this._profile }
  getPhase() { return this._phase }
  getPosition() { return { ...this._position } }
  getHeading() { return this._heading }
  getBattery() { return this._battery }
  getFloor() { return this._floor }
  getTaskStatus() { return this._taskStatus }

  /**
   * 设置位置
   * @param {number} x
   * @param {number} y
   */
  setPosition(x, y) {
    this._position.x = x
    this._position.y = y
  }

  /**
   * 设置朝向
   * @param {number} heading
   */
  setHeading(heading) {
    this._heading = heading
  }

  /**
   * 注入事件总线（由 RobotEngine 在 addRobot 后调用）
   * @param {EventBus} bus
   */
  setEventBus(bus) {
    this._context.eventBus = bus
  }

  /**
   * 注入资源管理器（由 RobotEngine 在 addRobot 后调用）
   * @param {ResourceManager} rm
   */
  setResourceManager(rm) {
    this._context.resourceManager = rm
  }

  /**
   * 更新环境感知数据（传感器、区域、电梯、红绿灯）
   * 可由外部每帧推入最新状态
   * @param {Object} env
   * @param {Object} [env.sensors]
   * @param {Object} [env.zones]
   * @param {Object} [env.elevators]
   * @param {Object} [env.trafficLights]
   */
  updateEnv(env = {}) {
    if (env.sensors)      Object.assign(this._context.sensors, env.sensors)
    if (env.zones)        Object.assign(this._context.zones, env.zones)
    if (env.elevators)    Object.assign(this._context.elevators, env.elevators)
    if (env.trafficLights) Object.assign(this._context.trafficLights, env.trafficLights)
  }

  // ── 阶段管理 ──

  /**
   * 阶段转移
   * @param {string} newPhase
   * @returns {boolean} 是否转移成功
   */
  _transitionTo(newPhase) {
    if (!canTransition(this._phase, newPhase)) {
      console.warn(`[RobotController] Invalid phase transition: ${this._phase} -> ${newPhase}`)
      return false
    }
    const oldPhase = this._phase
    this._phase = newPhase
    this._context.phase = newPhase
    this._notifyPhaseChange(oldPhase, newPhase)
    return true
  }

  // ── 任务控制 ──

  /**
   * 移动到目标位置
   * @param {[number, number]} target - 分数坐标 [xFrac, yFrac]
   * @param {Object} [options]
   * @param {number} [options.tolerance]
   * @param {Function} [options.onArrive]
   * @returns {Promise<void>}
   */
  moveTo(target, options = {}) {
    const task = new MoveTask({
      target,
      tolerance: options.tolerance || 0.5,
      kinematics: this._profile.kinematics,
      batteryConfig: this._profile.battery,
      onArrive: options.onArrive,
    })
    return this._executeTask(task)
  }

  /**
   * 等待条件满足（由 RAF tick 驱动，与任务系统完全集成）
   * @param {Object} condition - WaitCondition 实例
   * @param {Object} [options]
   * @param {number} [options.timeout=30000]
   * @returns {Promise<void>}
   */
  waitFor(condition, options = {}) {
    const task = new WaitTask({
      condition,
      timeout: options.timeout !== undefined ? options.timeout : 30000,
    })
    return this._executeTask(task)
  }

  /**
   * 执行自定义动作
   * @param {Function} action - async (context, params) => void
   * @param {*} [params]
   * @returns {Promise<void>}
   */
  performAction(action, params) {
    const task = new ActionTask({ action, params })
    return this._executeTask(task)
  }

  /**
   * 执行任意 Task 实例（原子任务或组合任务均可）
   * 供 RobotEngine.assignMission 及外部直接调用
   * @param {Task} task
   * @returns {Promise<void>}
   */
  execute(task) {
    return this._executeTask(task)
  }

  /**
   * 执行一个任务
   * @param {Task} task
   * @returns {Promise<void>}
   * @private
   */
  _executeTask(task) {
    if (this._currentTask) {
      this._currentTask.cancel()
    }
    this._currentTask = task
    this._taskPromise = new Promise((resolve, reject) => {
      this._taskResolve = resolve
      this._taskReject = reject
    })
    task.start(this._context)
    this._taskStatus = TaskStatus.RUNNING
    return this._taskPromise
  }

  /**
   * 每帧更新（由 RobotEngine 调用）
   * @param {number} deltaTime
   * @returns {string} 任务状态
   */
  tick(deltaTime) {
    if (!this._currentTask || this._taskStatus !== TaskStatus.RUNNING) {
      return this._taskStatus
    }

    // 更新上下文
    this._context.elapsed += deltaTime
    this._context.position = this._position
    this._context.heading = this._heading
    this._context.battery = this._battery
    this._context.phase = this._phase

    const status = this._currentTask.update(deltaTime, this._context)

    // 从上下文同步回状态
    this._phase = this._context.phase
    this._heading = this._context.heading
    this._battery = this._context.battery

    if (status === TaskStatus.COMPLETED) {
      this._taskStatus = TaskStatus.COMPLETED
      this._currentTask = null
      if (this._taskResolve) {
        this._taskResolve()
        this._taskResolve = null
        this._taskReject = null
      }
    } else if (status === TaskStatus.FAILED) {
      this._taskStatus = TaskStatus.FAILED
      this._currentTask = null
      if (this._taskReject) {
        this._taskReject(new Error('Task failed'))
        this._taskResolve = null
        this._taskReject = null
      }
    } else if (status === TaskStatus.CANCELLED) {
      this._taskStatus = TaskStatus.CANCELLED
      this._currentTask = null
      if (this._taskReject) {
        this._taskReject(new Error('Task cancelled'))
        this._taskResolve = null
        this._taskReject = null
      }
    }

    return this._taskStatus
  }

  /**
   * 取消当前任务
   */
  cancelCurrentTask() {
    if (this._currentTask) {
      this._currentTask.cancel()
      this._currentTask = null
    }
    this._taskStatus = TaskStatus.CANCELLED
    if (this._taskReject) {
      this._taskReject(new Error('Task cancelled'))
      this._taskResolve = null
      this._taskReject = null
    }
    this._transitionTo(RobotPhase.IDLE)
  }

  /**
   * 紧急停止
   */
  emergencyStop() {
    this.cancelCurrentTask()
    this._transitionTo(RobotPhase.MANUAL)
  }

  /**
   * 恢复运行
   */
  resume() {
    if (this._phase === RobotPhase.PAUSED || this._phase === RobotPhase.MANUAL) {
      this._transitionTo(RobotPhase.IDLE)
    }
  }

  // ── 信号 ──

  /**
   * 发送信号
   * @param {string} signalName
   * @param {*} data
   */
  emitSignal(signalName, data) {
    const handlers = this._signalHandlers.get(signalName)
    if (handlers) {
      for (const handler of handlers) {
        handler(data, signalName)
      }
    }
  }

  /**
   * 监听信号
   * @param {string} signalName
   * @param {Function} handler
   */
  onSignal(signalName, handler) {
    if (!this._signalHandlers.has(signalName)) {
      this._signalHandlers.set(signalName, new Set())
    }
    this._signalHandlers.get(signalName).add(handler)
  }

  // ── 事件 ──

  onPhaseChange(handler) {
    this._phaseChangeHandlers.add(handler)
    return () => this._phaseChangeHandlers.delete(handler)
  }

  onError(handler) {
    this._errorHandlers.add(handler)
    return () => this._errorHandlers.delete(handler)
  }

  _notifyPhaseChange(oldPhase, newPhase) {
    for (const handler of this._phaseChangeHandlers) {
      handler(this._id, oldPhase, newPhase)
    }
  }

  _notifyError(error) {
    for (const handler of this._errorHandlers) {
      handler(this._id, error)
    }
  }
}
