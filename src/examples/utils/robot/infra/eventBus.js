/**
 * 事件总线 — 支持机器人间通信和外部事件通知
 */
export class EventBus {
  constructor() {
    this._handlers = new Map() // eventName -> Set<handler>
  }

  /**
   * 订阅事件
   * @param {string} eventName
   * @param {Function} handler
   * @returns {Function} 取消订阅的函数
   */
  on(eventName, handler) {
    if (!this._handlers.has(eventName)) {
      this._handlers.set(eventName, new Set())
    }
    this._handlers.get(eventName).add(handler)
    return () => this.off(eventName, handler)
  }

  /**
   * 取消订阅
   * @param {string} eventName
   * @param {Function} handler
   */
  off(eventName, handler) {
    const handlers = this._handlers.get(eventName)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this._handlers.delete(eventName)
      }
    }
  }

  /**
   * 一次性订阅
   * @param {string} eventName
   * @param {Function} handler
   * @returns {Function} 取消订阅的函数
   */
  once(eventName, handler) {
    const wrapper = (...args) => {
      this.off(eventName, wrapper)
      handler(...args)
    }
    return this.on(eventName, wrapper)
  }

  /**
   * 发射事件
   * @param {string} eventName
   * @param {*} data
   */
  emit(eventName, data) {
    const handlers = this._handlers.get(eventName)
    if (handlers) {
      for (const handler of handlers) {
        handler(data, eventName)
      }
    }
  }

  /**
   * 等待事件触发（返回 Promise）
   * @param {string} eventName
   * @param {number} [timeout] - 超时毫秒，超时返回 null
   * @returns {Promise<*>}
   */
  waitFor(eventName, timeout) {
    return new Promise((resolve) => {
      let timer = null
      const unsub = this.once(eventName, (data) => {
        if (timer) clearTimeout(timer)
        resolve(data)
      })
      if (timeout && timeout > 0) {
        timer = setTimeout(() => {
          unsub()
          resolve(null)
        }, timeout)
      }
    })
  }

  /**
   * 移除所有订阅
   */
  clear() {
    this._handlers.clear()
  }

  /**
   * 获取某个事件的订阅者数量
   * @param {string} eventName
   * @returns {number}
   */
  listenerCount(eventName) {
    const handlers = this._handlers.get(eventName)
    return handlers ? handlers.size : 0
  }
}
