/*
 * @Author: kai.lee kai.lee@x-humanoid.com
 * @Date: 2026-05-08 14:29:00
 * @LastEditTime: 2026-06-09 11:16:00
 * @LastEditors: kai.lee@x-humanoid.com
 * @Description: 通用 MapLibre 图层事件路由模块：将图层事件分发到精准 id / 属性匹配 / 通配三张路由表
 * @FilePath: /bic-map-plugin/src/examples/utils/map/layerEvents.js
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 */

import { createEventEmitter } from '@/bicMap/core/utils/eventEmitter.js'

const _EVENTS = ['click', 'mouseenter', 'mouseleave', 'mousemove']

/**
 * 创建图层事件路由器
 *
 * 内部维护三张独立路由表，并将 MapLibre 图层事件统一分发：
 *  1. 精准 id 路由   — exactHandlers
 *  2. 属性匹配路由   — propHandlers
 *  3. 通配路由       — wildcardHandlers
 *  4. 全局 emitter   — on / off / once
 *
 * @param {Object} map     - MapLibre 地图实例
 * @param {string} layerId - 需要监听的图层 id
 * @returns {{
 *   on:         Function,
 *   off:        Function,
 *   once:       Function,
 *   onFeature:  Function,
 *   offFeature: Function,
 *   destroy:    Function,
 * }}
 */
export function createLayerEvents(map, layerId) {
  const emitter = createEventEmitter()

  // 精准 id 匹配：Map<featureId, Map<event, Set<handler>>>
  const exactHandlers = new Map()
  // 属性匹配列表：Array<{ match, event, handler }>
  const propHandlers = []
  // 通配（有 feature 即触发）：Map<event, Set<handler>>
  const wildcardHandlers = new Map()

  const _mapHandlers = {}

  /**
   * 注册 MapLibre 图层级事件，统一分发到三张注册表 + 全局 emitter
   */
  const _initEvents = () => {
    _EVENTS.forEach(type => {
      const handler = (e) => {
        const feature = e.features?.[0] ?? null
        const payload = { feature, lngLat: e.lngLat, originalEvent: e }

        if (feature != null) {
          // 1. 精准 id 分发
          exactHandlers.get(String(feature.id))?.get(type)?.forEach(fn => fn(payload))

          // 2. 属性匹配分发
          const props = feature.properties ?? {}
          propHandlers.forEach(({ match, event: ev, handler: fn }) => {
            if (ev !== type) return
            if (Object.entries(match).every(([k, v]) => props[k] === v)) fn(payload)
          })

          // 3. 通配分发
          wildcardHandlers.get(type)?.forEach(fn => fn(payload))
        }

        // 4. 全局分发（feature 可能为 null，如 mouseleave）
        emitter.emit(type, payload)
      }
      map.on(type, layerId, handler)
      _mapHandlers[type] = handler
    })
    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = '' })
  }

  /**
   * 监听 feature 事件，支持三种匹配模式：
   *
   * - onFeature(event, handler)           通配：任意 feature 触发，feature 一定非 null
   * - onFeature({k:v}, event, handler)    属性匹配：feature.properties 满足条件时触发
   * - onFeature('id', event, handler)     精准 id 匹配：仅指定 feature 触发
   *
   * @returns {Function} unsubscribe — 调用即可取消该监听
   */
  function onFeature(matcherOrEvent, eventOrHandler, handler) {
    // 2 个参数 → 通配模式
    if (handler === undefined) {
      const [event, cb] = [matcherOrEvent, eventOrHandler]
      if (!wildcardHandlers.has(event)) wildcardHandlers.set(event, new Set())
      wildcardHandlers.get(event).add(cb)
      return () => wildcardHandlers.get(event)?.delete(cb)
    }

    const [matcher, event, cb] = [matcherOrEvent, eventOrHandler, handler]

    // 属性对象匹配
    if (typeof matcher === 'object' && matcher !== null) {
      const entry = { match: matcher, event, handler: cb }
      propHandlers.push(entry)
      return () => {
        const i = propHandlers.indexOf(entry)
        if (i !== -1) propHandlers.splice(i, 1)
      }
    }

    // 精准 id 匹配
    const fid = String(matcher)
    if (!exactHandlers.has(fid)) exactHandlers.set(fid, new Map())
    const eventMap = exactHandlers.get(fid)
    if (!eventMap.has(event)) eventMap.set(event, new Set())
    eventMap.get(event).add(cb)
    return () => exactHandlers.get(fid)?.get(event)?.delete(cb)
  }

  /**
   * 取消 feature 事件监听，签名与 onFeature 一一对应
   */
  function offFeature(matcherOrEvent, eventOrHandler, handler) {
    if (handler === undefined) {
      wildcardHandlers.get(matcherOrEvent)?.delete(eventOrHandler)
    } else if (typeof matcherOrEvent === 'object' && matcherOrEvent !== null) {
      const i = propHandlers.findIndex(
        e => e.match === matcherOrEvent && e.event === eventOrHandler && e.handler === handler
      )
      if (i !== -1) propHandlers.splice(i, 1)
    } else {
      exactHandlers.get(String(matcherOrEvent))?.get(eventOrHandler)?.delete(handler)
    }
  }

  /**
   * 解绑所有 MapLibre 图层事件并清空三张路由表
   */
  function destroy() {
    _EVENTS.forEach(type => {
      if (_mapHandlers[type]) map.off(type, layerId, _mapHandlers[type])
    })
    emitter.destroy()
    exactHandlers.clear()
    propHandlers.length = 0
    wildcardHandlers.clear()
  }

  _initEvents()

  return {
    on:        emitter.on,
    off:       emitter.off,
    once:      emitter.once,
    onFeature,
    offFeature,
    destroy,
  }
}
