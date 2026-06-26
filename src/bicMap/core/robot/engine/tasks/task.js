import { TaskStatus } from './taskStatus.js'

/**
 * Task 抽象基类
 *
 * 所有活动树节点（组合任务与原子任务）均继承此类。
 * update() 返回值统一使用 TaskStatus 字符串常量。
 * MoveTask 及所有原子/组合任务均继承此类。
 */
export class Task {
  /**
   * @param {Object} [config={}]
   */
  constructor(config = {}) {
    this.config = config
    this._status = TaskStatus.PENDING
  }

  /**
   * 开始执行任务
   * @param {Object} context
   */
  start(context) {
    this._status = TaskStatus.RUNNING
  }

  /**
   * 每帧更新（由 RobotController.tick 驱动）
   * @param {number} deltaTime - 帧间隔(ms)
   * @param {Object} context
   * @returns {string} TaskStatus
   */
  update(deltaTime, context) {
    return this._status
  }

  /**
   * 取消任务，向子任务递归传播
   * @param {Object} [context]
   */
  cancel(context) {
    this._status = TaskStatus.CANCELLED
  }

  /**
   * 获取当前状态
   * @returns {string} TaskStatus
   */
  getStatus() {
    return this._status
  }

  /**
   * 任务是否已完成
   * @returns {boolean}
   */
  isCompleted() {
    return this._status === TaskStatus.COMPLETED
  }

  /**
   * 重置到初始状态（供 Loop / Retry 复用）
   */
  reset() {
    this._status = TaskStatus.PENDING
  }
}
