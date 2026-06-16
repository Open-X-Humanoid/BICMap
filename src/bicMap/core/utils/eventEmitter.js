/*
 * @Author: kai.lee kai.lee@x-humanoid.com
 * @Date: 2026-05-08 14:20:00
 * @LastEditTime: 2026-05-08 14:20:00
 * @LastEditors: kai.lee kai.lee@x-humanoid.com
 * @Description: 轻量通用发布订阅工具，与地图框架无关，可在任意 core 模块中复用
 * @FilePath: /bic-map-plugin/src/bicMap/core/utils/eventEmitter.js
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 */

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
