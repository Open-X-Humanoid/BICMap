import { TaskStatus } from './taskStatus.js'
import { RobotPhase } from '../core/robotPhase.js'

/**
 * 移动任务 — 控制机器人从当前位置移动到目标位置
 */
export class MoveTask {
  /**
   * @param {Object} config
   * @param {[number,number]} config.target - 目标分数坐标 [xFrac, yFrac]
   * @param {Object} config.kinematics - 运动学参数 { maxSpeed, acceleration, rotationSpeed }
   * @param {number} [config.tolerance=0.5] - 到达判定容差(米)
   * @param {Object} [config.batteryConfig] - 电池消耗配置
   * @param {Function} [config.onArrive] - 到达回调
   */
  constructor(config = {}) {
    this.target = config.target || [0, 0]
    this.kinematics = config.kinematics || { maxSpeed: 1.0, acceleration: 0.5, rotationSpeed: 90 }
    this.tolerance = config.tolerance || 0.5
    this.batteryConfig = config.batteryConfig || { drainMove: 0.0017, drainRotate: 0.0008 }
    this.onArriveCallback = config.onArrive || null

    this._started = false
    this._completed = false
    this._status = TaskStatus.PENDING
  }

  /**
   * 开始任务
   * @param {Object} context - { position, heading, battery, phase }
   */
  start(context) {
    this._started = true
    this._status = TaskStatus.RUNNING
  }

  /**
   * 每帧更新
   * @param {number} deltaTime - 帧间隔(ms)
   * @param {Object} context - { position: {x,y}, heading, battery, phase }
   * @returns {string} 'running' | 'completed' | 'failed'
   */
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

    // 计算到目标的距离和朝向
    const deltaX = targetX - currentPosition.x
    const deltaY = targetY - currentPosition.y
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    // 到达判定
    if (distance < this.tolerance) {
      currentPosition.x = targetX
      currentPosition.y = targetY
      this._status = TaskStatus.COMPLETED
      this._completed = true
      context.phase = RobotPhase.ARRIVED
      if (typeof this.onArriveCallback === 'function') {
        this.onArriveCallback(context)
      }
      return TaskStatus.COMPLETED
    }

    // 计算目标朝向 (degrees)
    const targetHeading = (Math.atan2(deltaX, deltaY) * 180 / Math.PI + 360) % 360

    // 朝向平滑插值
    const maxRotation = this.kinematics.rotationSpeed * deltaSeconds
    const headingDiff = ((targetHeading - currentHeading + 540) % 360) - 180
    const absDiff = Math.abs(headingDiff)

    if (absDiff > 1) {
      // 正在旋转
      context.phase = RobotPhase.ROTATING
      context.heading = Math.abs(headingDiff) <= maxRotation
        ? targetHeading
        : (currentHeading + Math.sign(headingDiff) * maxRotation + 360) % 360

      // 旋转时的电池消耗
      if (context.battery !== undefined) {
        context.battery = Math.max(0, context.battery - this.batteryConfig.drainRotate * deltaTime)
      }
      return TaskStatus.RUNNING
    }

    // 移动阶段
    context.phase = RobotPhase.MOVING
    context.heading = targetHeading

    const step = Math.min(this.kinematics.maxSpeed * deltaSeconds, distance)
    const headingRadians = (context.heading * Math.PI) / 180
    currentPosition.x += Math.sin(headingRadians) * step
    currentPosition.y += Math.cos(headingRadians) * step

    // 移动时的电池消耗
    if (context.battery !== undefined) {
      context.battery = Math.max(0, context.battery - this.batteryConfig.drainMove * deltaTime)
    }

    return TaskStatus.RUNNING
  }

  /**
   * 取消任务
   */
  cancel() {
    this._status = TaskStatus.FAILED
    this._completed = false
  }

  /**
   * 获取任务状态
   * @returns {string}
   */
  getStatus() {
    return this._status
  }

  /**
   * 任务是否完成
   * @returns {boolean}
   */
  isCompleted() {
    return this._completed
  }

  /**
   * 重置任务
   */
  reset() {
    this._started = false
    this._completed = false
    this._status = TaskStatus.PENDING
  }
}
