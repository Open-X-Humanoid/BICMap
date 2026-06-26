import { Task } from './task.js'
import { TaskStatus } from './taskStatus.js'
import { RobotPhase } from '../../core/robotPhase.js'

/**
 * 移动任务 — 控制机器人从当前位置移动到目标位置
 */
export class MoveTask extends Task {
  /**
   * @param {Object} config
   * @param {[number,number]} config.target - 目标分数坐标 [xFrac, yFrac]
   * @param {Object} config.kinematics - 运动学参数 { maxSpeed, acceleration, rotationSpeed }
   * @param {number} [config.tolerance=0.5] - 到达判定容差(米)
   * @param {Object} [config.batteryConfig] - 电池消耗配置
   * @param {Function} [config.onArrive] - 到达回调
   */
  constructor(config = {}) {
    super(config)
    this.target = config.target || [0, 0]
    this.kinematics = config.kinematics || { maxSpeed: 1.0, acceleration: 0.5, rotationSpeed: 90 }
    this.tolerance = config.tolerance || 0.5
    this.batteryConfig = config.batteryConfig || { drainMove: 0.0017, drainRotate: 0.0008 }
    this.onArriveCallback = config.onArrive || null

    this._started = false
  }

  start(context) {
    super.start(context)
    this._started = true
  }

  update(deltaTime, context) {
    if (this._status === TaskStatus.COMPLETED || this._status === TaskStatus.FAILED) {
      return this._status
    }

    if (!this._started) {
      this.start(context)
    }

    const deltaSeconds = deltaTime / 1000
    const targetX = this.target[0]
    const targetY = this.target[1]
    const currentPosition = context.position
    const currentHeading = context.heading

    const deltaX = targetX - currentPosition.x
    const deltaY = targetY - currentPosition.y
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    if (distance < this.tolerance) {
      currentPosition.x = targetX
      currentPosition.y = targetY
      this._status = TaskStatus.COMPLETED
      context.phase = RobotPhase.ARRIVED
      if (typeof this.onArriveCallback === 'function') {
        this.onArriveCallback(context)
      }
      return TaskStatus.COMPLETED
    }

    const targetHeading = (Math.atan2(deltaX, deltaY) * 180 / Math.PI + 360) % 360
    const maxRotation = this.kinematics.rotationSpeed * deltaSeconds
    const headingDiff = ((targetHeading - currentHeading + 540) % 360) - 180
    const absDiff = Math.abs(headingDiff)

    if (absDiff > 1) {
      context.phase = RobotPhase.ROTATING
      context.heading = absDiff <= maxRotation
        ? targetHeading
        : (currentHeading + Math.sign(headingDiff) * maxRotation + 360) % 360
      if (context.battery !== undefined) {
        context.battery = Math.max(0, context.battery - this.batteryConfig.drainRotate * deltaTime)
      }
      return TaskStatus.RUNNING
    }

    context.phase = RobotPhase.MOVING
    context.heading = targetHeading
    const step = Math.min(this.kinematics.maxSpeed * deltaSeconds, distance)
    const headingRadians = (context.heading * Math.PI) / 180
    currentPosition.x += Math.sin(headingRadians) * step
    currentPosition.y += Math.cos(headingRadians) * step
    if (context.battery !== undefined) {
      context.battery = Math.max(0, context.battery - this.batteryConfig.drainMove * deltaTime)
    }

    return TaskStatus.RUNNING
  }

  cancel() {
    this._started = false
    super.cancel()
  }

  reset() {
    super.reset()
    this._started = false
  }
}

/**
 * WaitTask — 等待条件满足
 *
 * 每帧调用 condition.evaluate(context)，条件满足后完成。
 * 超过 timeout(ms) 后返回 FAILED。
 */
export class WaitTask extends Task {
  /**
   * @param {Object} config
   * @param {Object} config.condition - WaitCondition 实例
   * @param {number} [config.timeout=30000] - 超时时间(ms)，0 表示不超时
   */
  constructor({ condition, timeout = 30000 } = {}) {
    super({ condition, timeout })
    this._condition = condition
    this._timeout = timeout
    this._elapsed = 0
  }

  start(context) {
    super.start(context)
    this._elapsed = 0
    if (this._condition && typeof this._condition.reset === 'function') {
      this._condition.reset()
    }
    context.phase = RobotPhase.WAITING
  }

  update(deltaTime, context) {
    if (this._status !== TaskStatus.RUNNING) return this._status

    this._elapsed += deltaTime

    if (this._timeout > 0 && this._elapsed >= this._timeout) {
      this._status = TaskStatus.FAILED
      return this._status
    }

    const evalContext = { ...context, elapsed: this._elapsed }
    const result = this._condition.evaluate(evalContext)

    if (result.met) {
      this._status = TaskStatus.COMPLETED
    }

    return this._status
  }

  cancel(context) {
    super.cancel(context)
  }

  reset() {
    super.reset()
    this._elapsed = 0
    if (this._condition && typeof this._condition.reset === 'function') {
      this._condition.reset()
    }
  }
}

/**
 * ActionTask — 执行自定义异步动作
 *
 * 首帧启动 action(context, params) 异步调用。
 * 使用 resolved/failed flag 在后续 update 中返回对应状态。
 */
export class ActionTask extends Task {
  /**
   * @param {Object} config
   * @param {Function} config.action - async (context, params) => void
   * @param {*} [config.params] - 传入 action 的参数
   */
  constructor({ action, params } = {}) {
    super({ action, params })
    this._action = action
    this._params = params
    this._resolved = false
    this._failed = false
    this._launched = false
  }

  start(context) {
    super.start(context)
    this._resolved = false
    this._failed = false
    this._launched = false
  }

  update(deltaTime, context) {
    if (this._status !== TaskStatus.RUNNING) return this._status

    if (!this._launched) {
      this._launched = true
      Promise.resolve()
        .then(() => this._action(context, this._params))
        .then(() => { this._resolved = true })
        .catch(() => { this._failed = true })
    }

    if (this._failed) {
      this._status = TaskStatus.FAILED
      return this._status
    }

    if (this._resolved) {
      this._status = TaskStatus.COMPLETED
      return this._status
    }

    return TaskStatus.RUNNING
  }

  reset() {
    super.reset()
    this._resolved = false
    this._failed = false
    this._launched = false
  }
}

/**
 * AnnounceTask — 广播消息
 *
 * 首帧通过 context.eventBus 发布消息，随后立即完成。
 * 若 context.eventBus 不存在则静默完成（不报错）。
 */
export class AnnounceTask extends Task {
  /**
   * @param {Object} config
   * @param {string} config.message - 消息内容
   * @param {string} [config.channel='announce'] - 事件通道名
   * @param {*} [config.meta] - 附加数据
   */
  constructor({ message, channel = 'announce', meta } = {}) {
    super({ message, channel, meta })
    this._message = message
    this._channel = channel
    this._meta = meta
    this._emitted = false
  }

  start(context) {
    super.start(context)
    this._emitted = false
  }

  update(deltaTime, context) {
    if (this._status !== TaskStatus.RUNNING) return this._status

    if (!this._emitted) {
      this._emitted = true
      if (context.eventBus && typeof context.eventBus.emit === 'function') {
        context.eventBus.emit(this._channel, {
          message: this._message,
          meta: this._meta,
        })
      }
      this._status = TaskStatus.COMPLETED
    }

    return this._status
  }

  reset() {
    super.reset()
    this._emitted = false
  }
}

/**
 * ChargeTask — 充电任务
 *
 * 将机器人阶段切换为 CHARGING，每帧按 chargeRate 增加电量，
 * 达到 minCharge 后完成。
 */
export class ChargeTask extends Task {
  /**
   * @param {Object} config
   * @param {string} [config.stationId] - 充电站 ID（仅记录，不触发移动）
   * @param {number} [config.minCharge=100] - 充至目标电量(%)
   * @param {number} [config.chargeRate=0.02] - 每毫秒充电量
   */
  constructor({ stationId, minCharge = 100, chargeRate = 0.02 } = {}) {
    super({ stationId, minCharge, chargeRate })
    this._stationId = stationId
    this._minCharge = minCharge
    this._chargeRate = chargeRate
  }

  start(context) {
    super.start(context)
    context.phase = RobotPhase.CHARGING
  }

  update(deltaTime, context) {
    if (this._status !== TaskStatus.RUNNING) return this._status

    context.phase = RobotPhase.CHARGING

    if (context.battery !== undefined) {
      context.battery = Math.min(
        this._minCharge,
        (context.battery || 0) + this._chargeRate * deltaTime
      )

      if (context.battery >= this._minCharge) {
        this._status = TaskStatus.COMPLETED
        return this._status
      }
    } else {
      // 无电量数据时直接完成
      this._status = TaskStatus.COMPLETED
      return this._status
    }

    return TaskStatus.RUNNING
  }
}

/**
 * DockTask — 停靠任务
 *
 * 将机器人阶段切换为 DOCKING，等待固定时长后完成。
 */
export class DockTask extends Task {
  /**
   * @param {Object} config
   * @param {string} [config.stationId] - 停靠站 ID
   * @param {number} [config.duration=3000] - 停靠耗时(ms)
   */
  constructor({ stationId, duration = 3000 } = {}) {
    super({ stationId, duration })
    this._stationId = stationId
    this._duration = duration
    this._elapsed = 0
  }

  start(context) {
    super.start(context)
    this._elapsed = 0
    context.phase = RobotPhase.DOCKING
  }

  update(deltaTime, context) {
    if (this._status !== TaskStatus.RUNNING) return this._status

    context.phase = RobotPhase.DOCKING
    this._elapsed += deltaTime

    if (this._elapsed >= this._duration) {
      this._status = TaskStatus.COMPLETED
    }

    return this._status
  }

  reset() {
    super.reset()
    this._elapsed = 0
  }
}

/**
 * SignalTask — 发射信号任务
 *
 * 调用 context.eventBus.emit(signal, data) 后立即完成。
 */
export class SignalTask extends Task {
  /**
   * @param {Object} config
   * @param {string} config.signal - 信号名
   * @param {*} [config.data] - 信号数据
   */
  constructor({ signal, data } = {}) {
    super({ signal, data })
    this._signal = signal
    this._data = data
    this._emitted = false
  }

  start(context) {
    super.start(context)
    this._emitted = false
  }

  update(deltaTime, context) {
    if (this._status !== TaskStatus.RUNNING) return this._status

    if (!this._emitted) {
      this._emitted = true
      if (context.eventBus && typeof context.eventBus.emit === 'function') {
        context.eventBus.emit(this._signal, this._data)
      }
      this._status = TaskStatus.COMPLETED
    }

    return this._status
  }

  reset() {
    super.reset()
    this._emitted = false
  }
}

/**
 * SensorTask — 传感器动作任务
 *
 * 调用 action(context, sensor) 同步或异步执行后完成。
 * 异步失败时标记为 FAILED。
 */
export class SensorTask extends Task {
  /**
   * @param {Object} config
   * @param {string} config.sensor - 传感器类型标识
   * @param {Function} config.action - (context, sensor) => void | Promise<void>
   */
  constructor({ sensor, action } = {}) {
    super({ sensor, action })
    this._sensor = sensor
    this._action = action
    this._launched = false
    this._resolved = false
    this._failed = false
  }

  start(context) {
    super.start(context)
    this._launched = false
    this._resolved = false
    this._failed = false
  }

  update(deltaTime, context) {
    if (this._status !== TaskStatus.RUNNING) return this._status

    if (!this._launched) {
      this._launched = true
      try {
        const ret = this._action(context, this._sensor)
        if (ret && typeof ret.then === 'function') {
          ret
            .then(() => { this._resolved = true })
            .catch(() => { this._failed = true })
        } else {
          this._resolved = true
        }
      } catch {
        this._failed = true
      }
    }

    if (this._failed) {
      this._status = TaskStatus.FAILED
      return this._status
    }

    if (this._resolved) {
      this._status = TaskStatus.COMPLETED
      return this._status
    }

    return TaskStatus.RUNNING
  }

  reset() {
    super.reset()
    this._launched = false
    this._resolved = false
    this._failed = false
  }
}
