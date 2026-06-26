import { Task } from './task.js'
import { TaskStatus } from './taskStatus.js'

/**
 * Sequence — 顺序执行一组子任务
 *
 * 当前子任务 COMPLETED 后自动推进到下一个，所有子任务完成后返回 COMPLETED。
 * 任意子任务 FAILED 则立即返回 FAILED。
 */
export class Sequence extends Task {
  /**
   * @param {Task[]} tasks
   */
  constructor(tasks = []) {
    super({ tasks })
    this._tasks = tasks
    this._currentIndex = 0
  }

  start(context) {
    super.start(context)
    this._currentIndex = 0
    if (this._tasks.length === 0) {
      this._status = TaskStatus.COMPLETED
      return
    }
    this._tasks[0].start(context)
  }

  update(deltaTime, context) {
    if (this._status !== TaskStatus.RUNNING) return this._status

    if (this._tasks.length === 0) {
      this._status = TaskStatus.COMPLETED
      return this._status
    }

    const current = this._tasks[this._currentIndex]
    const result = current.update(deltaTime, context)

    if (result === TaskStatus.FAILED || result === TaskStatus.CANCELLED) {
      this._status = TaskStatus.FAILED
      return this._status
    }

    if (result === TaskStatus.COMPLETED) {
      this._currentIndex++
      if (this._currentIndex >= this._tasks.length) {
        this._status = TaskStatus.COMPLETED
        return this._status
      }
      // 启动下一个子任务
      this._tasks[this._currentIndex].start(context)
    }

    return TaskStatus.RUNNING
  }

  cancel(context) {
    if (this._currentIndex < this._tasks.length) {
      this._tasks[this._currentIndex].cancel(context)
    }
    super.cancel(context)
  }

  reset() {
    super.reset()
    this._currentIndex = 0
    for (const t of this._tasks) t.reset()
  }

  /**
   * 当前执行到第几个子任务（0-based）
   * @returns {number}
   */
  getCurrentIndex() {
    return this._currentIndex
  }
}

/**
 * Parallel — 并行执行一组子任务
 *
 * 所有子任务同时 update，全部 COMPLETED 后返回 COMPLETED。
 * failFast=true（默认）时任意子任务 FAILED 立即返回 FAILED。
 */
export class Parallel extends Task {
  /**
   * @param {Task[]} tasks
   * @param {Object} [options]
   * @param {boolean} [options.failFast=true]
   */
  constructor(tasks = [], options = {}) {
    super({ tasks, ...options })
    this._tasks = tasks
    this._failFast = options.failFast !== false
  }

  start(context) {
    super.start(context)
    for (const t of this._tasks) t.start(context)
  }

  update(deltaTime, context) {
    if (this._status !== TaskStatus.RUNNING) return this._status

    let allCompleted = true

    for (const t of this._tasks) {
      const s = t.getStatus()
      if (s === TaskStatus.COMPLETED) continue
      if (s === TaskStatus.FAILED || s === TaskStatus.CANCELLED) {
        if (this._failFast) {
          this._cancelAll(context)
          this._status = TaskStatus.FAILED
          return this._status
        }
        continue
      }

      const result = t.update(deltaTime, context)
      if (result === TaskStatus.FAILED || result === TaskStatus.CANCELLED) {
        if (this._failFast) {
          this._cancelAll(context)
          this._status = TaskStatus.FAILED
          return this._status
        }
      }
      if (result !== TaskStatus.COMPLETED) {
        allCompleted = false
      }
    }

    if (allCompleted) {
      this._status = TaskStatus.COMPLETED
    }

    return this._status
  }

  cancel(context) {
    this._cancelAll(context)
    super.cancel(context)
  }

  reset() {
    super.reset()
    for (const t of this._tasks) t.reset()
  }

  _cancelAll(context) {
    for (const t of this._tasks) {
      const s = t.getStatus()
      if (s === TaskStatus.RUNNING || s === TaskStatus.PENDING) {
        t.cancel(context)
      }
    }
  }
}

/**
 * Loop — 循环执行一个子任务
 *
 * times=-1 表示无限循环。每次子任务完成后 reset 并重新 start。
 */
export class Loop extends Task {
  /**
   * @param {Object} config
   * @param {Task} config.task
   * @param {number} [config.times=-1] - 循环次数，-1 为无限
   */
  constructor({ task, times = -1 } = {}) {
    super({ task, times })
    this._task = task
    this._times = times
    this._iteration = 0
  }

  start(context) {
    super.start(context)
    this._iteration = 0
    if (this._times === 0) {
      this._status = TaskStatus.COMPLETED
      return
    }
    this._task.start(context)
  }

  update(deltaTime, context) {
    if (this._status !== TaskStatus.RUNNING) return this._status

    const result = this._task.update(deltaTime, context)

    if (result === TaskStatus.FAILED || result === TaskStatus.CANCELLED) {
      this._status = TaskStatus.FAILED
      return this._status
    }

    if (result === TaskStatus.COMPLETED) {
      this._iteration++
      if (this._times !== -1 && this._iteration >= this._times) {
        this._status = TaskStatus.COMPLETED
        return this._status
      }
      // 重置并继续
      this._task.reset()
      this._task.start(context)
    }

    return TaskStatus.RUNNING
  }

  cancel(context) {
    this._task.cancel(context)
    super.cancel(context)
  }

  reset() {
    super.reset()
    this._iteration = 0
    this._task.reset()
  }

  /**
   * 当前已完成的迭代次数
   * @returns {number}
   */
  getIteration() {
    return this._iteration
  }
}

/**
 * Conditional — 条件分支任务
 *
 * start() 时调用 condition(context) 决定执行 then 还是 else 分支。
 */
export class Conditional extends Task {
  /**
   * @param {Object} config
   * @param {Function} config.condition - (context) => boolean
   * @param {Task} config.then
   * @param {Task} [config.else]
   */
  constructor({ condition, then: thenTask, else: elseTask } = {}) {
    super({ condition, then: thenTask, else: elseTask })
    this._condition = condition
    this._thenTask = thenTask
    this._elseTask = elseTask || null
    this._activeTask = null
  }

  start(context) {
    super.start(context)
    const branch = this._condition(context)
    this._activeTask = branch ? this._thenTask : this._elseTask
    if (!this._activeTask) {
      // 无 else 分支时直接完成
      this._status = TaskStatus.COMPLETED
      return
    }
    this._activeTask.start(context)
  }

  update(deltaTime, context) {
    if (this._status !== TaskStatus.RUNNING) return this._status
    if (!this._activeTask) {
      this._status = TaskStatus.COMPLETED
      return this._status
    }

    const result = this._activeTask.update(deltaTime, context)
    if (result === TaskStatus.COMPLETED) {
      this._status = TaskStatus.COMPLETED
    } else if (result === TaskStatus.FAILED || result === TaskStatus.CANCELLED) {
      this._status = TaskStatus.FAILED
    }
    return this._status
  }

  cancel(context) {
    if (this._activeTask) this._activeTask.cancel(context)
    super.cancel(context)
  }

  reset() {
    super.reset()
    this._activeTask = null
    if (this._thenTask) this._thenTask.reset()
    if (this._elseTask) this._elseTask.reset()
  }
}

/**
 * Retry — 失败重试任务
 *
 * 子任务 FAILED 后 reset 并重试，超过 maxRetries 才返回 FAILED。
 */
export class Retry extends Task {
  /**
   * @param {Object} config
   * @param {Task} config.task
   * @param {number} [config.maxRetries=3]
   */
  constructor({ task, maxRetries = 3 } = {}) {
    super({ task, maxRetries })
    this._task = task
    this._maxRetries = maxRetries
    this._attempts = 0
  }

  start(context) {
    super.start(context)
    this._attempts = 0
    this._task.start(context)
  }

  update(deltaTime, context) {
    if (this._status !== TaskStatus.RUNNING) return this._status

    const result = this._task.update(deltaTime, context)

    if (result === TaskStatus.COMPLETED) {
      this._status = TaskStatus.COMPLETED
      return this._status
    }

    if (result === TaskStatus.FAILED || result === TaskStatus.CANCELLED) {
      this._attempts++
      if (this._attempts > this._maxRetries) {
        this._status = TaskStatus.FAILED
        return this._status
      }
      // 重试
      this._task.reset()
      this._task.start(context)
    }

    return TaskStatus.RUNNING
  }

  cancel(context) {
    this._task.cancel(context)
    super.cancel(context)
  }

  reset() {
    super.reset()
    this._attempts = 0
    this._task.reset()
  }

  /**
   * 当前已尝试次数（包含初次执行）
   * @returns {number}
   */
  getAttempts() {
    return this._attempts
  }
}

/**
 * Race — 竞速任务
 *
 * 全部子任务并行执行，任一 COMPLETED 后取消其余并返回 COMPLETED。
 * 所有子任务均 FAILED 时返回 FAILED。
 */
export class Race extends Task {
  /**
   * @param {Task[]} tasks
   */
  constructor(tasks = []) {
    super({ tasks })
    this._tasks = tasks
  }

  start(context) {
    super.start(context)
    for (const t of this._tasks) t.start(context)
  }

  update(deltaTime, context) {
    if (this._status !== TaskStatus.RUNNING) return this._status

    let allFailed = true

    for (const t of this._tasks) {
      const s = t.getStatus()
      if (s === TaskStatus.COMPLETED) {
        // 有任务已完成（可能发生在当前 tick 之前的帧）
        this._cancelOthers(t, context)
        this._status = TaskStatus.COMPLETED
        return this._status
      }
      if (s !== TaskStatus.FAILED && s !== TaskStatus.CANCELLED) {
        allFailed = false
      }
    }

    // 并行更新尚未结束的任务
    for (const t of this._tasks) {
      const s = t.getStatus()
      if (s === TaskStatus.RUNNING || s === TaskStatus.PENDING) {
        const result = t.update(deltaTime, context)
        if (result === TaskStatus.COMPLETED) {
          this._cancelOthers(t, context)
          this._status = TaskStatus.COMPLETED
          return this._status
        }
      }
    }

    // 重新检查是否全部失败
    allFailed = this._tasks.every(t => {
      const s = t.getStatus()
      return s === TaskStatus.FAILED || s === TaskStatus.CANCELLED
    })
    if (allFailed) {
      this._status = TaskStatus.FAILED
    }

    return this._status
  }

  cancel(context) {
    for (const t of this._tasks) {
      const s = t.getStatus()
      if (s === TaskStatus.RUNNING || s === TaskStatus.PENDING) {
        t.cancel(context)
      }
    }
    super.cancel(context)
  }

  reset() {
    super.reset()
    for (const t of this._tasks) t.reset()
  }

  _cancelOthers(winner, context) {
    for (const t of this._tasks) {
      if (t === winner) continue
      const s = t.getStatus()
      if (s === TaskStatus.RUNNING || s === TaskStatus.PENDING) {
        t.cancel(context)
      }
    }
  }
}
