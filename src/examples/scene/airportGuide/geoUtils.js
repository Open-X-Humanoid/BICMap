/*
 * @Author: Ella ella.yin@x-humanoid.com
 * @Date: 2026-06-09
 * @Description: 飞机场导览 — 地图坐标换算工具
 * @FilePath: /bic-map-plugin/src/examples/scene/airportGuide/geoUtils.js
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 */

import {
  MAP_START_X,
  MAP_START_Y,
  MAP_WIDTH_M,
  MAP_HEIGHT_M,
  MAP_RESOLUTION,
  MAP_ZOOM_FACTOR,
} from './constants.js'

/**
 * 地图经纬度 → 归一化比例坐标 [xFrac, yFrac]
 * @param {[number, number]} lngLat
 * @returns {[number, number]}
 */
export function lngLatToFrac(lngLat) {
  const Mu = window.MapUtils
  if (!Mu?.GPSToCartesian || !lngLat?.length) return [0, 0]
  const c = Mu.GPSToCartesian({
    longitude: lngLat[0],
    latitude: lngLat[1],
    scale: MAP_RESOLUTION,
    zoomFactor: MAP_ZOOM_FACTOR,
  })
  const xFrac = (c.x - MAP_START_X) / MAP_WIDTH_M
  const yFrac = (c.y - MAP_START_Y) / MAP_HEIGHT_M
  return [
    Math.round(xFrac * 10000) / 10000,
    Math.round(yFrac * 10000) / 10000,
  ]
}

/**
 * 将折线路径点转为预设路径点结构
 * @param {Array<[number, number]>} path
 * @returns {Array<{ index: number, lng: number, lat: number, xFrac: number, yFrac: number }>}
 */
export function buildWaypointList(path) {
  return path.map((point, index) => {
    const [xFrac, yFrac] = lngLatToFrac(point)
    return {
      index: index + 1,
      lng: Math.round(point[0] * 1e6) / 1e6,
      lat: Math.round(point[1] * 1e6) / 1e6,
      xFrac,
      yFrac,
    }
  })
}

/**
 * 在控制台打印可粘贴的预设路径点
 * @param {Array<{ index: number, xFrac: number, yFrac: number }>} waypoints
 * @param {number} routeIndex
 */
export function logPresetWaypoints(waypoints, routeIndex = 1) {
  const fracPairs = waypoints.map((wp) => [wp.xFrac, wp.yFrac])
  console.group(`%c[AirportGuide] 预设路径点 — 路线 ${routeIndex}`, 'color:#0284c7;font-weight:bold')
  console.log('▶ 比例坐标（可粘贴到 GUIDE_ROUTE）:')
  console.log(JSON.stringify(fracPairs, null, 2))
  console.log('▶ 完整路径点:')
  console.table(waypoints)
  console.groupEnd()
}
