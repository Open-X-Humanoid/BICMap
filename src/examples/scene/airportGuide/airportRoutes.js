/*
 * @Author: Ella ella.yin@x-humanoid.com
 * @Date: 2026-06-09
 * @Description: 飞机场导览 — 预设路线与 POI 查询
 * @FilePath: /bic-map-plugin/src/examples/scene/airportGuide/airportRoutes.js
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 */

import { AIRPORT_POIS } from './airportLayout.js'
import { ARRIVAL_SCRIPTS, GUIDE_ROUTE_STYLE } from './constants.js'

/** @param {Array<[number, number]>} fracPairs */
export function toPathPoints(fracPairs) {
  return fracPairs.map(([xFrac, yFrac]) => ({ xFrac, yFrac }))
}

/**
 * 取路径终点坐标，无路径时回退到 POI 坐标
 * @param {Array<{ xFrac: number, yFrac: number }>} route
 * @param {{ xFrac: number, yFrac: number } | null} [fallback]
 */
export function getRouteEndPoint(route, fallback = null) {
  if (route?.length) {
    const last = route[route.length - 1]
    return { xFrac: last.xFrac, yFrac: last.yFrac }
  }
  if (fallback) {
    return { xFrac: fallback.xFrac, yFrac: fallback.yFrac }
  }
  return null
}

/**
 * 合并多段路径点，跳过相邻重复点
 * @param {Array<Array<{ xFrac: number, yFrac: number }>>} segments
 */
export function mergeRoutePointLists(...segments) {
  const points = []
  segments.forEach(segment => {
    segment.forEach(p => {
      const last = points[points.length - 1]
      if (last && Math.abs(last.xFrac - p.xFrac) < 1e-4 && Math.abs(last.yFrac - p.yFrac) < 1e-4) {
        return
      }
      points.push(p)
    })
  })
  return points
}

/** 上海赶时间：快速值机链路 */
export const ROUTE_SHANGHAI_FAST = [
  {
    poiId: 'poi-fast-checkin',
    path: [
      [0.1318, 0.6469],
      [0.1335, 0.5495],
      [0.1367, 0.4695],
      [0.1361, 0.3808],
      [0.1361, 0.2853],
      [0.1738, 0.2844],
      [0.2115, 0.2844],
      [0.2438, 0.2824],
      [0.2594, 0.2834],
      [0.2583, 0.3104],
    ],
  },
  {
    poiId: 'poi-security-b',
    path: [
      [0.2686, 0.3133],
      [0.2804, 0.2998],
      [0.2928, 0.2998],
      [0.2928, 0.349],
      [0.2912, 0.4001],
      [0.2906, 0.4714],
      [0.2922, 0.4927],
      [0.3331, 0.4946],
      [0.352, 0.4965],
      [0.3514, 0.4676],
      [0.352, 0.4541],
    ],
  },
  {
    poiId: 'poi-boarding-b',
    path: [
      [0.3294, 0.43],
      [0.3304, 0.3818],
      [0.3859, 0.3789],
      [0.4117, 0.3721],
      [0.4322, 0.3731],
      [0.4419, 0.374],
    ],
  },
]

/** 登机口 B → 机器人等待区（导览结束后返回） */
export const ROUTE_RETURN_BOARDING_B_TO_STANDBY = [
  [0.4376, 0.3831],
  [0.4125, 0.3786],
  [0.3983, 0.3771],
  [0.4008, 0.2903],
  [0.3908, 0.2425],
  [0.3766, 0.217],
  [0.3499, 0.223],
  [0.3182, 0.2245],
  [0.2839, 0.223],
  [0.2472, 0.226],
  [0.2414, 0.2514],
  [0.243, 0.2769],
  [0.1871, 0.2784],
  [0.1821, 0.4429],
  [0.1838, 0.57],
  [0.1829, 0.7062],
  [0.1729, 0.7211],
  [0.1537, 0.7211],
  [0.1387, 0.7181],
  [0.1353, 0.6792],
  [0.1362, 0.6493],
  [0.1211, 0.6508],
]

/** 登机口 A → 机器人等待区（导览结束后返回） */
export const ROUTE_RETURN_BOARDING_A_TO_STANDBY = [
  [0.4284, 0.6282],
  [0.4016, 0.6393],
  [0.3986, 0.7131],
  [0.3996, 0.7869],
  [0.3996, 0.8128],
  [0.3769, 0.8294],
  [0.345, 0.8257],
  [0.3193, 0.8128],
  [0.3131, 0.7629],
  [0.2966, 0.7408],
  [0.2935, 0.7168],
  [0.2595, 0.7223],
  [0.2101, 0.7205],
  [0.1823, 0.7187],
  [0.1586, 0.7187],
  [0.138, 0.7223],
  [0.1318, 0.6965],
  [0.1287, 0.6817],
]

/** 杭州 + 托运 */
export const ROUTE_HANGZHOU_BAGGAGE = [
  {
    poiId: 'poi-checkin-a',
    path: [
      [0.1205, 0.6522],
      [0.1339, 0.6541],
      [0.1349, 0.7113],
      [0.1617, 0.715],
      [0.1864, 0.715],
      [0.2369, 0.7168],
      [0.2369, 0.702],
    ],
  },
  {
    poiId: 'poi-security-a',
    path: [
      [0.2389, 0.702],
      [0.2945, 0.7057],
      [0.2945, 0.4991],
      [0.3574, 0.4991],
      [0.3563, 0.5526],
    ],
  },
  {
    poiId: 'poi-waiting-a',
    path: [
      [0.3306, 0.5526],
      [0.3285, 0.6264],
      [0.3491, 0.6264],
      [0.3512, 0.6928],
      [0.3512, 0.7057],
    ],
  },
  {
    poiId: 'poi-boarding-a',
    path: [
      [0.3677, 0.6928],
      [0.4109, 0.6928],
      [0.4109, 0.6504],
      [0.4295, 0.6522],
      [0.4284, 0.6301],
    ],
  },
]

/** 杭州 + 不托运 */
export const ROUTE_HANGZHOU_NO_BAGGAGE = [
  {
    poiId: 'poi-auto-ticket',
    path: [
      [0.1226, 0.667],
      [0.1359, 0.6688],
      [0.1359, 0.7113],
      [0.137, 0.7279],
      [0.1648, 0.7242],
      [0.1802, 0.7223],
      [0.1792, 0.6651],
      [0.1802, 0.6098],
      [0.1792, 0.5323],
      [0.1679, 0.5341],
    ],
  },
  {
    poiId: 'poi-security-a',
    path: [
      [0.1679, 0.584],
      [0.1668, 0.5212],
      [0.1957, 0.5194],
      [0.2266, 0.5194],
      [0.2688, 0.5212],
      [0.2904, 0.5231],
      [0.2904, 0.4935],
      [0.3162, 0.4972],
      [0.3543, 0.5009],
      [0.3522, 0.5507],
      [0.3512, 0.5673],
    ],
  },
  {
    poiId: 'poi-waiting-a',
    path: [
      [0.3306, 0.5526],
      [0.3285, 0.6264],
      [0.3491, 0.6264],
      [0.3512, 0.6928],
      [0.3512, 0.7057],
    ],
  },
  {
    poiId: 'poi-boarding-a',
    path: [
      [0.3677, 0.6928],
      [0.4109, 0.6928],
      [0.4109, 0.6504],
      [0.4295, 0.6522],
      [0.4284, 0.6301],
    ],
  },
]

/**
 * @param {string} poiId
 */
export function getPoiById(poiId) {
  return AIRPORT_POIS.find(p => p.id === poiId) || null
}

/**
 * 将阶段定义解析为带坐标的 POI 列表
 * @param {Array<{ poiId: string }>} legs
 */
export function resolveRouteLegs(legs) {
  return legs.map((leg, index) => {
    const poi = getPoiById(leg.poiId)
    if (!poi) return null
    const script = ARRIVAL_SCRIPTS[leg.poiId] || { title: poi.name, body: poi.description }
    return {
      index,
      poiId: poi.id,
      name: poi.name,
      xFrac: poi.xFrac,
      yFrac: poi.yFrac,
      path: leg.path ? toPathPoints(leg.path) : null,
      arrivalTitle: script.title,
      arrivalBody: script.body,
    }
  }).filter(Boolean)
}

/**
 * 两点直连路径（后续可在 leg 上扩展 waypoints 数组）
 * @param {{ xFrac: number, yFrac: number }} from
 * @param {{ xFrac: number, yFrac: number }} to
 * @param {Array<{ xFrac: number, yFrac: number }>} [waypoints]
 */
export function buildDirectRoute(from, to, waypoints = []) {
  const points = [
    { xFrac: from.xFrac, yFrac: from.yFrac },
    ...waypoints,
    { xFrac: to.xFrac, yFrac: to.yFrac },
  ]
  return points
}

/**
 * 导览结束后返回等待区的路径
 * @param {string | null} lastPoiId 最后到达的 POI
 * @param {{ xFrac: number, yFrac: number }} from
 * @param {{ xFrac: number, yFrac: number }} to
 */
export function buildReturnStandbyRoute(lastPoiId, from, to) {
  if (lastPoiId === 'poi-boarding-b') {
    return toPathPoints(ROUTE_RETURN_BOARDING_B_TO_STANDBY)
  }
  if (lastPoiId === 'poi-boarding-a') {
    return toPathPoints(ROUTE_RETURN_BOARDING_A_TO_STANDBY)
  }
  return buildDirectRoute(from, to)
}

/**
 * 颜色插值（与 indoorCleaning / pathReplay 一致）
 * @param {string} color1
 * @param {string} color2
 * @param {number} ratio
 */
function interpolateColor(color1, color2, ratio) {
  const hex2rgb = hex => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [0, 0, 0]
  }
  const rgb2hex = (r, g, b) =>
    `#${[r, g, b].map(x => {
      const h = Math.round(x).toString(16)
      return h.length === 1 ? `0${h}` : h
    }).join('')}`
  const [r1, g1, b1] = hex2rgb(color1)
  const [r2, g2, b2] = hex2rgb(color2)
  return rgb2hex(r1 + (r2 - r1) * ratio, g1 + (g2 - g1) * ratio, b1 + (b2 - b1) * ratio)
}

/**
 * 构建导览路径线段（渐变色 + 方向箭头，对齐清扫区 demo）
 * @param {Array<{ xFrac: number, yFrac: number }>} routePoints
 * @param {(x:number,y:number)=>[number,number]} fracToGPS
 * @param {typeof GUIDE_ROUTE_STYLE} [style]
 */
export function buildGuideRouteSegments(routePoints, fracToGPS, style = GUIDE_ROUTE_STYLE) {
  if (!routePoints?.length || routePoints.length < 2) return []
  const path = routePoints.map(p => fracToGPS(p.xFrac, p.yFrac))
  const total = path.length - 1
  return Array.from({ length: total }, (_, i) => ({
    id: `guide-route-seg-${i}`,
    path: [path[i], path[i + 1]],
    color: interpolateColor(style.colorStart, style.colorEnd, i / Math.max(total - 1, 1)),
    width: style.width,
    opacity: style.opacity,
    showArrow: style.showArrow,
    arrowSize: style.arrowSize,
    arrowSpacing: style.arrowSpacing,
  }))
}

/**
 * 构建完整旅程折线（各段首尾相连）
 * @param {Array<Array<{ xFrac: number, yFrac: number }>>} completedLegRoutes
 * @param {Array<{ xFrac: number, yFrac: number }>} [currentLegRoute]
 */
export function buildJourneyPolyline(completedLegRoutes, currentLegRoute = []) {
  return mergeRoutePointLists(...completedLegRoutes, currentLegRoute)
}
