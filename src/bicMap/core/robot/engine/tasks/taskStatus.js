/**
 * 任务状态枚举
 * @enum {string}
 */
export const TaskStatus = {
  /** 已创建但尚未启动 */
  PENDING: 'pending',
  /** 无活跃任务（初始状态） */
  IDLE: 'idle',
  /** 任务执行中 */
  RUNNING: 'running',
  /** 任务已完成（到达目标） */
  COMPLETED: 'completed',
  /** 任务失败 */
  FAILED: 'failed',
  /** 任务已取消 */
  CANCELLED: 'cancelled',
}
