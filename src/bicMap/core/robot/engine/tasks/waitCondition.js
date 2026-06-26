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
 * 传感器条件 — 等待传感器值满足指定条件
 *
 * context.sensors 格式：{ [type]: number | string }
 * operator 支持：'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
 */
class SensorCondition extends Condition {
  constructor(type, options = {}) {
    super()
    this._type = type
    this._targetValue = options.value
    this._operator = options.operator || 'eq'
  }

  evaluate(context) {
    const sensors = context.sensors
    if (!sensors || !(this._type in sensors)) {
      return { met: false }
    }
    const current = sensors[this._type]
    const target = this._targetValue
    switch (this._operator) {
      case 'eq':  this._met = current === target; break
      case 'neq': this._met = current !== target; break
      case 'gt':  this._met = current > target;   break
      case 'gte': this._met = current >= target;  break
      case 'lt':  this._met = current < target;   break
      case 'lte': this._met = current <= target;  break
      default:    this._met = false
    }
    return { met: this._met }
  }
}

/**
 * 区域占用条件 — 等待区域进入指定状态
 *
 * context.zones 格式：{ [zoneId]: 'free' | 'occupied' }
 * state 默认 'free'
 */
class OccupancyCondition extends Condition {
  constructor(zoneId, state = 'free') {
    super()
    this._zoneId = zoneId
    this._state = state
  }

  evaluate(context) {
    const zones = context.zones
    if (!zones) return { met: false }
    this._met = zones[this._zoneId] === this._state
    return { met: this._met }
  }
}

/**
 * 电梯条件 — 等待指定电梯到达目标楼层且方向匹配
 *
 * context.elevators 格式：
 *   { [elevatorId]: { floor: string, direction: 'up' | 'down' | 'idle', doorsOpen: boolean } }
 *
 * elevatorId 省略时匹配任意电梯。direction 省略时只匹配楼层。
 */
class ElevatorCondition extends Condition {
  constructor(floor, options = {}) {
    super()
    this._floor = floor
    this._direction = options.direction || null
    this._elevatorId = options.elevatorId || null
    this._requireDoorsOpen = options.requireDoorsOpen !== false
  }

  evaluate(context) {
    const elevators = context.elevators
    if (!elevators) return { met: false }

    const entries = this._elevatorId
      ? (elevators[this._elevatorId] ? [[this._elevatorId, elevators[this._elevatorId]]] : [])
      : Object.entries(elevators)

    for (const [, state] of entries) {
      const floorMatch = state.floor === this._floor
      const dirMatch = !this._direction || state.direction === this._direction
      const doorsMatch = !this._requireDoorsOpen || state.doorsOpen === true
      if (floorMatch && dirMatch && doorsMatch) {
        this._met = true
        return { met: true }
      }
    }

    this._met = false
    return { met: false }
  }
}

/**
 * 红绿灯条件 — 等待指定信号灯变为目标颜色
 *
 * context.trafficLights 格式：{ [lightId]: 'red' | 'yellow' | 'green' }
 *
 * lightId 省略时匹配任意灯。
 */
class TrafficLightCondition extends Condition {
  constructor(color, options = {}) {
    super()
    this._color = color
    this._lightId = options.lightId || null
  }

  evaluate(context) {
    const lights = context.trafficLights
    if (!lights) return { met: false }

    if (this._lightId) {
      this._met = lights[this._lightId] === this._color
      return { met: this._met }
    }

    // 匹配任意灯
    this._met = Object.values(lights).some(c => c === this._color)
    return { met: this._met }
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

  /**
   * 等待传感器值满足条件
   * @param {string} type - 传感器类型，对应 context.sensors[type]
   * @param {Object} options
   * @param {*} options.value - 目标值
   * @param {string} [options.operator='eq'] - 'eq'|'neq'|'gt'|'gte'|'lt'|'lte'
   */
  static sensor(type, options = {}) {
    return new SensorCondition(type, options)
  }

  /**
   * 等待区域进入指定占用状态
   * @param {string} zoneId - 区域 ID，对应 context.zones[zoneId]
   * @param {string} [state='free'] - 'free' | 'occupied'
   */
  static occupancy(zoneId, state = 'free') {
    return new OccupancyCondition(zoneId, state)
  }

  /**
   * 等待电梯到达指定楼层
   * @param {string} floor - 目标楼层，如 '2F'
   * @param {Object} [options]
   * @param {string} [options.direction] - 'up' | 'down' | 'idle'，省略不限方向
   * @param {string} [options.elevatorId] - 指定电梯 ID，省略匹配任意电梯
   * @param {boolean} [options.requireDoorsOpen=true] - 是否要求门已打开
   */
  static elevator(floor, options = {}) {
    return new ElevatorCondition(floor, options)
  }

  /**
   * 等待红绿灯变为指定颜色
   * @param {string} color - 'red' | 'yellow' | 'green'
   * @param {Object} [options]
   * @param {string} [options.lightId] - 指定灯 ID，省略匹配任意灯
   */
  static trafficLight(color, options = {}) {
    return new TrafficLightCondition(color, options)
  }
}
