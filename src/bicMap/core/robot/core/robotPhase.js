/**
 * 机器人阶段枚举与状态转移映射表。
 *
 * @module robotPhase
 */

/**
 * 机器人运行阶段枚举。
 *
 * @enum {string}
 * @readonly
 */
export const RobotPhase = {
  /** 空闲 */
  IDLE: 'idle',
  /** 移动中 */
  MOVING: 'moving',
  /** 原地旋转 */
  ROTATING: 'rotating',
  /** 到达目标点 */
  ARRIVED: 'arrived',
  /** 停留中（如执行任务） */
  DWELLING: 'dwelling',
  /** 等待中（如等待门、电梯等外部条件） */
  WAITING: 'waiting',
  /** 充电中 */
  CHARGING: 'charging',
  /** 归位/回桩中 */
  DOCKING: 'docking',
  /** 异常 */
  ERROR: 'error',
  /** 恢复中 */
  RECOVERING: 'recovering',
  /** 返航中 */
  RETURNING: 'returning',
  /** 人工干预 */
  MANUAL: 'manual',
  /** 暂停 */
  PAUSED: 'paused',
}

/**
 * 阶段转移白名单。
 * 键为当前阶段（from），值为允许转移的目标阶段集合（Set\<to\>）。
 *
 * @type {Object<string, Set<string>>}
 */
export const PHASE_TRANSITIONS = {
  // IDLE：MoveTask 可直接开始旋转；WaitTask 可直接等待；支持紧急停止 → MANUAL
  [RobotPhase.IDLE]: new Set([
    RobotPhase.MOVING, RobotPhase.ROTATING, RobotPhase.WAITING,
    RobotPhase.CHARGING, RobotPhase.DOCKING,
    RobotPhase.ERROR, RobotPhase.MANUAL,
  ]),
  // MOVING：正常抵达/旋转/等待，以及取消 → IDLE
  [RobotPhase.MOVING]: new Set([
    RobotPhase.ARRIVED, RobotPhase.ROTATING, RobotPhase.WAITING,
    RobotPhase.IDLE, RobotPhase.RETURNING, RobotPhase.PAUSED, RobotPhase.ERROR,
  ]),
  // ROTATING：旋转完成 → MOVING；取消 → IDLE
  [RobotPhase.ROTATING]: new Set([
    RobotPhase.MOVING, RobotPhase.IDLE, RobotPhase.ERROR,
  ]),
  // ARRIVED：停靠 / 充电 / 等待 / 继续移动 / 取消
  [RobotPhase.ARRIVED]: new Set([
    RobotPhase.IDLE, RobotPhase.MOVING,
    RobotPhase.DWELLING, RobotPhase.WAITING,
    RobotPhase.CHARGING, RobotPhase.DOCKING,
    RobotPhase.ERROR, RobotPhase.PAUSED,
  ]),
  // DWELLING：任务完成 → MOVING / IDLE；取消 → IDLE
  [RobotPhase.DWELLING]: new Set([
    RobotPhase.MOVING, RobotPhase.IDLE, RobotPhase.ERROR, RobotPhase.PAUSED,
  ]),
  // WAITING：条件满足 → MOVING；取消 → IDLE
  [RobotPhase.WAITING]: new Set([
    RobotPhase.MOVING, RobotPhase.IDLE, RobotPhase.ERROR, RobotPhase.PAUSED,
  ]),
  // CHARGING：充满 → IDLE；Sequence 中接 MoveTask → MOVING；取消 → IDLE
  [RobotPhase.CHARGING]: new Set([
    RobotPhase.IDLE, RobotPhase.MOVING, RobotPhase.ERROR, RobotPhase.PAUSED,
  ]),
  // DOCKING：停靠完成 → CHARGING / IDLE；Sequence 接续 → MOVING
  [RobotPhase.DOCKING]: new Set([
    RobotPhase.CHARGING, RobotPhase.IDLE, RobotPhase.MOVING,
    RobotPhase.ERROR, RobotPhase.PAUSED,
  ]),
  [RobotPhase.ERROR]: new Set([
    RobotPhase.RECOVERING, RobotPhase.IDLE, RobotPhase.MANUAL,
  ]),
  [RobotPhase.RECOVERING]: new Set([
    RobotPhase.MOVING, RobotPhase.ERROR, RobotPhase.IDLE,
  ]),
  // RETURNING：取消 → IDLE
  [RobotPhase.RETURNING]: new Set([
    RobotPhase.DOCKING, RobotPhase.CHARGING,
    RobotPhase.IDLE, RobotPhase.ERROR, RobotPhase.PAUSED,
  ]),
  [RobotPhase.MANUAL]: new Set([
    RobotPhase.IDLE, RobotPhase.MOVING, RobotPhase.ERROR, RobotPhase.RECOVERING,
  ]),
  // PAUSED：恢复 → 原活跃阶段或 IDLE（取消时）
  [RobotPhase.PAUSED]: new Set([
    RobotPhase.MOVING, RobotPhase.DWELLING, RobotPhase.WAITING, RobotPhase.IDLE,
  ]),
}

/**
 * 判断是否允许从 fromPhase 转移到 toPhase。
 *
 * @param {string} fromPhase - 当前阶段
 * @param {string} toPhase - 目标阶段
 * @returns {boolean} 是否允许该转移
 */
export function canTransition(fromPhase, toPhase) {
  const allowed = PHASE_TRANSITIONS[fromPhase]
  return allowed ? allowed.has(toPhase) : false
}

/**
 * 判断指定阶段是否为终止阶段（空闲、异常或人工干预）。
 *
 * @param {string} phase - 阶段值
 * @returns {boolean} 是否为终止阶段
 */
export function isTerminal(phase) {
  return phase === RobotPhase.IDLE || phase === RobotPhase.ERROR || phase === RobotPhase.MANUAL || phase === RobotPhase.PAUSED
}

/**
 * 判断指定阶段是否为活跃阶段（非空闲、非异常、非人工干预、非暂停）。
 *
 * @param {string} phase - 阶段值
 * @returns {boolean} 是否处于活跃状态
 */
export function isActive(phase) {
  return phase !== RobotPhase.IDLE && phase !== RobotPhase.ERROR && phase !== RobotPhase.MANUAL && phase !== RobotPhase.PAUSED
}
