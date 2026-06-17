/**
 * 条件基类
 */
class Condition {
  constructor() {
    this._met = false
  }

  /**
   * 评估条件是否满足
   * @param {Object} context - 评估上下文 { elapsed, signals, sensors, robotStates, resources }
   * @returns {{ met: boolean, remaining?: number }}
   */
  evaluate(context) {
    throw new Error('Subclass must implement evaluate()')
  }

  reset() {
    this._met = false
  }

  isMet() {
    return this._met
  }
}

/**
 * 定时条件 — 等待固定时长
 */
class DurationCondition extends Condition {
  constructor(ms) {
    super()
    this._targetMs = ms
    this._started = false
  }

  evaluate(context) {
    if (!this._started) {
      this._startTime = context.elapsed
      this._started = true
    }
    const remaining = this._targetMs - (context.elapsed - this._startTime)
    this._met = remaining <= 0
    return { met: this._met, remaining: Math.max(0, remaining) }
  }

  reset() {
    super.reset()
    this._started = false
  }
}

/**
 * 信号条件 — 等待外部信号
 */
class SignalCondition extends Condition {
  constructor(signalName, options = {}) {
    super()
    this._signalName = signalName
    this._timeout = options.timeout || 0
    this._signalData = null
    this._received = false
  }

  evaluate(context) {
    // 检查是否收到信号
    if (context.signals && context.signals[this._signalName]) {
      this._received = true
      this._signalData = context.signals[this._signalName]
    }
    this._met = this._received
    return { met: this._met }
  }

  getSignalData() {
    return this._signalData
  }

  reset() {
    super.reset()
    this._received = false
    this._signalData = null
  }
}

/**
 * 距离条件 — 等待与其他机器人的距离
 */
class DistanceCondition extends Condition {
  constructor(robotId, minDistance) {
    super()
    this._robotId = robotId
    this._minDistance = minDistance
  }

  evaluate(context) {
    const robotState = context.robotStates && context.robotStates[this._robotId]
    if (!robotState || !context.currentPosition) {
      return { met: false }
    }
    const dx = context.currentPosition.x - robotState.position.x
    const dy = context.currentPosition.y - robotState.position.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    this._met = dist >= this._minDistance
    return { met: this._met, remaining: Math.max(0, this._minDistance - dist) }
  }
}

/**
 * 资源条件 — 等待资源可用
 */
class ResourceCondition extends Condition {
  constructor(resourceType, resourceId, options = {}) {
    super()
    this._resourceType = resourceType
    this._resourceId = resourceId
    this._shared = options.shared || false
  }

  evaluate(context) {
    const resourceManager = context.resourceManager
    if (!resourceManager) return { met: false }
    const status = resourceManager.getStatus(this._resourceType, this._resourceId)
    this._met = status === 'free' || (this._shared && status === 'shared')
    return { met: this._met }
  }
}

/**
 * 组合条件 — AND
 */
class AllCondition extends Condition {
  constructor(...conditions) {
    super()
    this._conditions = conditions
  }

  evaluate(context) {
    for (const cond of this._conditions) {
      const result = cond.evaluate(context)
      if (!result.met) {
        this._met = false
        return { met: false }
      }
    }
    this._met = true
    return { met: true }
  }

  reset() {
    super.reset()
    for (const cond of this._conditions) {
      cond.reset()
    }
  }
}

/**
 * 组合条件 — OR
 */
class RaceCondition extends Condition {
  constructor(...conditions) {
    super()
    this._conditions = conditions
  }

  evaluate(context) {
    for (const cond of this._conditions) {
      const result = cond.evaluate(context)
      if (result.met) {
        this._met = true
        return { met: true }
      }
    }
    this._met = false
    return { met: false }
  }

  reset() {
    super.reset()
    for (const cond of this._conditions) {
      cond.reset()
    }
  }
}

/**
 * 组合条件 — NOT
 */
class NotCondition extends Condition {
  constructor(condition) {
    super()
    this._condition = condition
  }

  evaluate(context) {
    const result = this._condition.evaluate(context)
    this._met = !result.met
    return { met: this._met }
  }

  reset() {
    super.reset()
    this._condition.reset()
  }
}

/**
 * WaitCondition 静态工厂 - 统一的对外接口
 */
export class WaitCondition {
  /** 等待固定时长 */
  static duration(ms) {
    return new DurationCondition(ms)
  }

  /** 等待外部信号 */
  static signal(name, options = {}) {
    return new SignalCondition(name, options)
  }

  /** 等待与其他机器人的距离 */
  static distance(robotId, minDist) {
    return new DistanceCondition(robotId, minDist)
  }

  /** 等待资源可用 */
  static resource(type, id, options = {}) {
    return new ResourceCondition(type, id, options)
  }

  /** AND 组合：所有条件满足 */
  static all(...conditions) {
    return new AllCondition(...conditions)
  }

  /** OR 组合：任一条件满足 */
  static race(...conditions) {
    return new RaceCondition(...conditions)
  }

  /** NOT 取反 */
  static not(condition) {
    return new NotCondition(condition)
  }
}
