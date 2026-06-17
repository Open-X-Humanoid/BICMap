/**
 * 显示模式
 */
export const DisplayMode = {
  MODE_2D: '2d',
  MODE_3D: '3d',
  BOTH: 'both',
}

/**
 * 显示管理器 — 统一编排 2D/3D 渲染器，对外暴露与 addStatusRobotMarkers 完全相同的接口。
 *
 * 渲染器约定（renderer2d / renderer3d 均须实现）：
 *   addRobot(robot)            → number（返回 index）
 *   updateRobot(id, patch)     → boolean
 *   updateRobots(robots)       → void
 *   removeRobot(id)            → boolean
 *   clearRobots()              → void
 *   getRobots()                → Robot[]
 *   toggleLabels(show?)        → void
 *   remove()                   → void
 *
 * 内置实现：
 *   - addStatusRobotMarkers()    满足 2D 渲染器约定
 *   - createRobot3DStatusLayer() 满足 3D 渲染器约定
 */
export class DisplayManager {
  /**
   * @param {Object} config
   * @param {'2d'|'3d'|'both'} [config.mode='2d']
   * @param {Object} [config.renderer2d] - addStatusRobotMarkers 兼容渲染器
   * @param {Object} [config.renderer3d] - createRobot3DStatusLayer 兼容渲染器
   */
  constructor(config = {}) {
    this._mode = config.mode || DisplayMode.MODE_2D
    this._renderer2d = config.renderer2d || null
    this._renderer3d = config.renderer3d || null
    this._robots = []
  }

  // ── 模式管理 ──────────────────────────────────────────────────────────────

  /**
   * 切换显示模式，自动将当前机器人数据同步到新激活的渲染器，
   * 并清空从活跃变为非活跃的渲染器。
   * @param {'2d'|'3d'|'both'} mode
   */
  setMode(mode) {
    const was2d = this._mode === '2d' || this._mode === 'both'
    const was3d = this._mode === '3d' || this._mode === 'both'
    this._mode = mode
    const is2d = mode === '2d' || mode === 'both'
    const is3d = mode === '3d' || mode === 'both'

    if (this._renderer2d) {
      if (was2d && !is2d) this._renderer2d.clearRobots()
      if (!was2d && is2d) this._renderer2d.updateRobots([...this._robots])
    }
    if (this._renderer3d) {
      if (was3d && !is3d) this._renderer3d.clearRobots()
      if (!was3d && is3d) this._renderer3d.updateRobots([...this._robots])
    }
  }

  /** @returns {'2d'|'3d'|'both'} */
  getMode() {
    return this._mode
  }

  /**
   * 注册 2D 渲染器（需满足 addStatusRobotMarkers 接口）
   * @param {Object} renderer
   */
  setRenderer2d(renderer) {
    this._renderer2d = renderer
  }

  /**
   * 注册 3D 渲染器（需满足 createRobot3DStatusLayer 接口）
   * @param {Object} renderer
   */
  setRenderer3d(renderer) {
    this._renderer3d = renderer
  }

  // ── 内部辅助 ──────────────────────────────────────────────────────────────

  _r2d() {
    return (this._mode === '2d' || this._mode === 'both') ? this._renderer2d : null
  }

  _r3d() {
    return (this._mode === '3d' || this._mode === 'both') ? this._renderer3d : null
  }

  _findIdx(identifier) {
    return typeof identifier === 'number'
      ? identifier
      : this._robots.findIndex(r => r.id === identifier)
  }

  // ── addStatusRobotMarkers 同构接口 ────────────────────────────────────────

  /** 追加一个机器人，同步到活跃渲染器 */
  addRobot(robot) {
    this._robots.push(robot)
    this._r2d()?.addRobot(robot)
    this._r3d()?.addRobot(robot)
    return this._robots.length - 1
  }

  /**
   * 更新单个机器人（可通过 index 或 id）
   * @param {number|string} identifier
   * @param {Object} patch
   */
  updateRobot(identifier, patch) {
    const idx = this._findIdx(identifier)
    if (idx < 0 || idx >= this._robots.length) return false
    this._robots[idx] = { ...this._robots[idx], ...patch }
    this._r2d()?.updateRobot(identifier, patch)
    this._r3d()?.updateRobot(identifier, patch)
    return true
  }

  /** 整体替换机器人数组，同步到活跃渲染器 */
  updateRobots(newRobots = []) {
    this._robots = [...newRobots]
    this._r2d()?.updateRobots(newRobots)
    this._r3d()?.updateRobots(newRobots)
  }

  /** 删除一个机器人（可通过 index 或 id） */
  removeRobot(identifier) {
    const idx = this._findIdx(identifier)
    if (idx < 0 || idx >= this._robots.length) return false
    this._r2d()?.removeRobot(identifier)
    this._r3d()?.removeRobot(identifier)
    this._robots.splice(idx, 1)
    return true
  }

  /** 清空所有机器人 */
  clearRobots() {
    this._robots = []
    this._r2d()?.clearRobots()
    this._r3d()?.clearRobots()
  }

  /** 获取所有机器人数据（只读副本） */
  getRobots() {
    return [...this._robots]
  }

  /**
   * 显示/隐藏标签（透传给 2D 渲染器；3D 层无 HTML 标签，静默忽略）
   * @param {boolean} [show]
   */
  toggleLabels(show) {
    this._r2d()?.toggleLabels(show)
    this._r3d()?.toggleLabels(show)
  }

  /** 销毁全部渲染器资源 */
  remove() {
    this._renderer2d?.remove()
    this._renderer3d?.remove()
    this._robots = []
  }
}
