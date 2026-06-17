/**
 * Waypoint 类型系统。
 *
 * 定义 Waypoint 类型枚举、Waypoint 数据类以及类型注册表。
 *
 * @module waypointTypes
 */

/**
 * Waypoint 类型枚举。
 *
 * @enum {string}
 * @readonly
 */
export const WaypointType = {
  /** 常规巡逻点 */
  PATROL: 'patrol',
  /** POI 兴趣点 */
  POI: 'poi',
  /** 等待电梯 */
  WAIT_ELEVATOR: 'wait_elevator',
  /** 等待通行（如交通管制） */
  WAIT_TRAFFIC: 'wait_traffic',
  /** 等待开门 */
  WAIT_DOOR: 'wait_door',
  /** 等待信号 */
  WAIT_SIGNAL: 'wait_signal',
  /** 充电点 */
  CHARGING: 'charging',
  /** 归位/回桩点 */
  DOCK: 'dock',
  /** 跨楼层中转点 */
  FLOOR_TRANSITION: 'floor_transition',
  /** 服务点（如配送点） */
  SERVICE: 'service',
  /** 悬停等待点 */
  HOLD: 'hold',
  /** 交接点 */
  HANDOVER: 'handover',
}

/**
 * Waypoint 数据类。
 *
 * 表示机器人路径中的一个路径点，支持生命周期的钩子回调。
 */
export class Waypoint {
  /**
   * @param {Object} config - 配置对象
   * @param {string} config.id - 路径点唯一标识
   * @param {string} [config.type=WaypointType.PATROL] - 路径点类型
   * @param {Object} [config.position={ xFrac: 0, yFrac: 0 }] - 坐标位置
   * @param {string} [config.floor='1F'] - 所在楼层
   * @param {Object} [config.meta={}] - 额外元数据
   * @param {Function} [config.onApproach] - 接近时回调
   * @param {Function} [config.onArrive] - 到达时回调
   * @param {Function} [config.onDepart] - 离开时回调
   * @param {Function} [config.onWaitStart] - 开始等待时回调
   * @param {Function} [config.onWaitEnd] - 等待结束时回调
   * @param {Function} [config.onTimeout] - 等待超时时回调
   * @param {Function} [config.waitCondition] - 等待条件函数
   * @param {number} [config.waitTimeout=30000] - 等待超时时间（毫秒）
   */
  constructor(config) {
    this.id = config.id
    this.type = config.type || WaypointType.PATROL
    this.position = config.position || { xFrac: 0, yFrac: 0 }
    this.floor = config.floor || '1F'
    this.meta = config.meta || {}
    this.onApproach = config.onApproach || null
    this.onArrive = config.onArrive || null
    this.onDepart = config.onDepart || null
    this.onWaitStart = config.onWaitStart || null
    this.onWaitEnd = config.onWaitEnd || null
    this.onTimeout = config.onTimeout || null
    this.waitCondition = config.waitCondition || null
    this.waitTimeout = config.waitTimeout || 30000
  }

  /**
   * 调用指定名称的生命周期钩子。
   *
   * @param {string} hookName - 钩子名称（如 'onArrive'）
   * @param {Object} robot - 机器人实例引用
   * @param {Object} context - 执行上下文
   * @returns {Promise<*>} 钩子返回值
   */
  async callHook(hookName, robot, context) {
    const hook = this[hookName]
    if (typeof hook === 'function') {
      return hook(robot, context)
    }
  }
}

/**
 * Waypoint 类型注册表。
 *
 * 用于注册和管理各类型 Waypoint 对应的处理器函数。
 */
export class WaypointTypeRegistry {
  constructor() {
    /** @type {Map<string, Function>} */
    this._handlers = new Map()
  }

  /**
   * 注册指定类型的处理器。
   *
   * @param {string} type - Waypoint 类型
   * @param {Function} handler - 处理器函数
   */
  register(type, handler) {
    this._handlers.set(type, handler)
  }

  /**
   * 获取指定类型的处理器。
   *
   * @param {string} type - Waypoint 类型
   * @returns {Function|undefined} 处理器函数
   */
  get(type) {
    return this._handlers.get(type)
  }

  /**
   * 判断指定类型是否已注册。
   *
   * @param {string} type - Waypoint 类型
   * @returns {boolean} 是否已注册
   */
  has(type) {
    return this._handlers.has(type)
  }

  /**
   * 注销指定类型的处理器。
   *
   * @param {string} type - Waypoint 类型
   */
  unregister(type) {
    this._handlers.delete(type)
  }
}
