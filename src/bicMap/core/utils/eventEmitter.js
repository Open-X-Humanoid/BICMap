/**
 * 创建一个轻量发布订阅实例
 *
 * @returns {{
 *   on:      (event: string, handler: Function) => Function,
 *   off:     (event: string, handler: Function) => void,
 *   once:    (event: string, handler: Function) => Function,
 *   emit:    (event: string, data?: any) => void,
 *   destroy: () => void,
 * }}
 */
export function createEventEmitter() {
  const listeners = new Map() // Map<event, Set<handler>>

  /**
   * 订阅事件
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} unsubscribe — 调用即可取消订阅
   */
  function on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set())
    listeners.get(event).add(handler)
    return () => off(event, handler)
  }

  /**
   * 取消订阅
   * @param {string} event
   * @param {Function} handler
   */
  function off(event, handler) {
    listeners.get(event)?.delete(handler)
  }

  /**
   * 一次性订阅，首次触发后自动移除
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} unsubscribe
   */
  function once(event, handler) {
    const wrapper = (data) => { handler(data); off(event, wrapper) }
    return on(event, wrapper)
  }

  /**
   * 触发事件
   * @param {string} event
   * @param {*} data
   */
  function emit(event, data) {
    listeners.get(event)?.forEach(fn => fn(data))
  }

  /**
   * 销毁所有订阅（在控制器 remove() 时调用，防止内存泄漏）
   */
  function destroy() {
    listeners.clear()
  }

  return { on, off, once, emit, destroy }
}
