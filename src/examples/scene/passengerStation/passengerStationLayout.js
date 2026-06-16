/*
 * @Author: Ella ella.yin@x-humanoid.com
 * @Date: 2026-06-05
 * @Description: 客运站布局：区域多边形、POI、发车位网格与登车接近点
 * @FilePath: /bic-map-plugin/src/examples/scene/passengerStation/passengerStationLayout.js
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 */
import { TRIP_STATUS } from './constants.js'
import { SLAM_MAP_CONFIG } from '../robotGuideTour/constants.js'

const { startX, startY, xGridCount, yGridCount, resolution } = SLAM_MAP_CONFIG

export const MAP_START_X = startX
export const MAP_START_Y = startY
export const MAP_WIDTH_M = xGridCount * resolution
export const MAP_HEIGHT_M = yGridCount * resolution
export const MAP_RESOLUTION = resolution

export const MAP_CENTER = [116.4074, 39.9042]
export const MAP_ZOOM = 25
export const MAP_MAX_ZOOM = 25
export const LAYOUT_SCALE = 1

export const STATION_COLORS = {
  plaza: '#edf1fc',
  corridor: '#c2e1fe',
  waiting: '#e2eefa',
  service: '#e4ebf3',
  retail: '#e2d6fa',
  facility: '#e0f2fe',
  robotStandby: '#e2d6fa',
  police: '#fee2e2',
  parking: '#f1f5f9',
  checkGate: '#c2e1fe',
  driveLane: '#f8fafc',
  bayPassable: '#e6efff',
  bayNotPassable: '#c8d8f0',
  bayOccupied: '#94a3b8',
  outline: '#b8cbe0',
  route: '#3b82f6',
  highlight: '#f59e0b',
}

function rectCorners(x1, y1, x2, y2) {
  return [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]
}

function polygonFeature(id, name, color, polygon, extra = {}) {
  return {
    type: 'Feature',
    properties: { id, name, color, ...extra },
    geometry: { type: 'Polygon', coordinates: [polygon] },
  }
}

/** 4×4 发车位通行矩阵：true 表示空位时机器人可穿行 */
const BAY_PASSABLE_GRID = [
  [true, true, false, true],
  [true, false, false, false],
  [true, false, false, false],
  [true, true, true, false],
]

function getBayPassable(row, col) {
  return BAY_PASSABLE_GRID[row]?.[col] ?? false
}

function getBayColor(row, col) {
  return getBayPassable(row, col) ? STATION_COLORS.bayPassable : STATION_COLORS.bayNotPassable
}

function buildBoardingBays() {
  const bays = []
  const xStarts = [0.52, 0.62, 0.72, 0.82]
  const yStarts = [0.27, 0.40, 0.53, 0.66]
  const w = 0.07
  const h = 0.05
  let bayNo = 1
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x1 = xStarts[col]
      const y1 = yStarts[row]
      bays.push({
        id: `boarding-bay-${bayNo}`,
        name: `${bayNo} 号位`,
        type: 'boarding-bay',
        bayNo,
        passable: getBayPassable(row, col),
        occupied: false,
        occupiedBy: null,
        color: getBayColor(row, col),
        occupiedColor: STATION_COLORS.bayOccupied,
        polygon: rectCorners(x1, y1, x1 + w, y1 + h),
      })
      bayNo += 1
    }
  }
  return bays
}

function buildDriveLanes() {
  return [
    { id: 'drive-lane-main', name: '主通道', passable: true, color: STATION_COLORS.driveLane, polygon: rectCorners(0.46, 0.20, 0.50, 0.82) },
    // { id: 'drive-lane-n', name: '南车道', passable: true, color: STATION_COLORS.driveLane, polygon: rectCorners(0.50, 0.22, 0.90, 0.24) },
    // { id: 'drive-lane-mid', name: '中车道', passable: true, color: STATION_COLORS.driveLane, polygon: rectCorners(0.50, 0.49, 0.90, 0.51) },
    // { id: 'drive-lane-s', name: '北车道', passable: true, color: STATION_COLORS.driveLane, polygon: rectCorners(0.50, 0.80, 0.90, 0.82) },
  ]
}

function buildCheckGates() {
  return [
    {
      id: 'check-gate-1',
      name: '1 号检票口',
      type: 'check-gate',
      gateNo: 1,
      passable: false,
      color: STATION_COLORS.checkGate,
      polygon: rectCorners(0.36, 0.62, 0.44, 0.72),
    },
    {
      id: 'check-gate-2',
      name: '2 号检票口',
      type: 'check-gate',
      gateNo: 2,
      passable: false,
      color: STATION_COLORS.checkGate,
      polygon: rectCorners(0.36, 0.35, 0.44, 0.43),
    },
  ]
}

export const STATION_AREAS = [
  { id: 'front-plaza', name: '站前广场', passable: true, color: STATION_COLORS.plaza, polygon: rectCorners(0.08, 0.05, 0.92, 0.14) },
  { id: 'entry-south', name: '进站口', passable: true, color: STATION_COLORS.corridor, polygon: rectCorners(0.08, 0.42, 0.16, 0.64) },
  { id: 'exit-gate', name: '出站口', passable: true, color: STATION_COLORS.corridor, polygon: rectCorners(0.44, 0.14, 0.56, 0.20) },
  { id: 'police-station', name: '警务工作站', passable: false, color: STATION_COLORS.police, polygon: rectCorners(0.74, 0.05, 0.88, 0.13) },
  { id: 'parking-n', name: '停车场', passable: false, color: STATION_COLORS.parking, polygon: rectCorners(0.08, 0.05, 0.18, 0.14) },
  { id: 'ticket-hall', name: '取票厅', passable: false, color: STATION_COLORS.service, polygon: rectCorners(0.16, 0.20, 0.34, 0.30) },
  { id: 'waiting-hall', name: '候车厅', passable: true, color: STATION_COLORS.waiting, polygon: rectCorners(0.16, 0.32, 0.34, 0.74) },
  { id: 'supermarket', name: '超市', passable: false, color: STATION_COLORS.retail, polygon: rectCorners(0.36, 0.48, 0.44, 0.58) },
  { id: 'dispatch', name: '调度室', passable: false, color: STATION_COLORS.service, polygon: rectCorners(0.36, 0.20, 0.44, 0.26) },
  { id: 'restroom', name: '卫生间', passable: false, color: STATION_COLORS.facility, polygon: rectCorners(0.36, 0.26, 0.44, 0.30) },
  { id: 'robot-standby', name: '机器人待机区', passable: false, color: STATION_COLORS.robotStandby, polygon: rectCorners(0.08, 0.30, 0.16, 0.42) },
  ...buildCheckGates(),
  ...buildDriveLanes(),
  ...buildBoardingBays(),
]

export const BOARDING_BAY_ACCESS_OFFSET = 0.015
export const CHECK_GATE_X_OFFSET = 0.015

export const BOARDING_BAY_ACCESS_POINTS = {}
STATION_AREAS.filter(a => a.type === 'boarding-bay').forEach(bay => {
  const xs = bay.polygon.map(p => p[0])
  const ys = bay.polygon.map(p => p[1])
  BOARDING_BAY_ACCESS_POINTS[bay.bayNo] = {
    xFrac: Math.min(...xs) - BOARDING_BAY_ACCESS_OFFSET,
    yFrac: (Math.min(...ys) + Math.max(...ys)) / 2,
  }
})

export const CHECK_GATE_ACCESS_POINTS = {}
STATION_AREAS.filter(a => a.type === 'check-gate').forEach(gate => {
  const xs = gate.polygon.map(p => p[0])
  const ys = gate.polygon.map(p => p[1])
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2
  CHECK_GATE_ACCESS_POINTS[gate.gateNo] = {
    center: { xFrac: centerX, yFrac: centerY },
    arrival: { xFrac: centerX - CHECK_GATE_X_OFFSET, yFrac: centerY },
    departure: { xFrac: centerX + CHECK_GATE_X_OFFSET, yFrac: centerY },
  }
})

export function getEffectivePassable(area) {
  if (area.type === 'boarding-bay') {
    if (!area.passable) return false
    return !area.occupied
  }
  return area.passable
}

export function getAreaFillColor(area) {
  if (area.type === 'boarding-bay' && area.occupied) return area.occupiedColor
  return area.color
}

export const STATION_POIS = [
  { id: 'poi-exit-gate', icon: 'icon-entry', name: '出站口', type: '出口', xFrac: 0.50, yFrac: 0.17, description: '出站口。' },
  { id: 'poi-entry-south', icon: 'icon-entry', name: '进站口', type: '入口', xFrac: 0.12, yFrac: 0.53, description: '南侧进站通道。' },
  { id: 'poi-police', icon: 'icon-police', name: '警务工作站', type: '警务', xFrac: 0.81, yFrac: 0.09, description: '站内警务与求助服务。' },
  { id: 'poi-parking-n', icon: 'icon-parking', name: '北停车场', type: '停车', xFrac: 0.13, yFrac: 0.10, description: '社会车辆停放区。' },
  { id: 'poi-ticket-hall', icon: 'icon-self-ticket', name: '取票厅', type: '票务', xFrac: 0.25, yFrac: 0.25, description: '自助取票与人工售票。' },
  { id: 'poi-waiting-hall', icon: 'icon-waiting', name: '候车厅', type: '候车', xFrac: 0.25, yFrac: 0.53, description: '站内统一候车区域。' },
  { id: 'poi-supermarket', icon: 'icon-supermarket', name: '超市', type: '商业', xFrac: 0.40, yFrac: 0.53, description: '简餐与旅行用品。' },
  { id: 'poi-restroom', icon: 'icon-restroom', name: '卫生间', type: '设施', xFrac: 0.40, yFrac: 0.28, description: '含无障碍卫生间。' },
  { id: 'poi-robot-standby', icon: 'icon-robot-standby', name: '机器人待机区', type: '机器人', xFrac: 0.12, yFrac: 0.36, description: '导览机器人充电待命。' },
  ...STATION_AREAS.filter(a => a.type === 'check-gate').map(gate => ({
    id: `poi-check-gate-${gate.gateNo}`,
    icon: 'icon-gate',
    name: `${gate.gateNo} 号检票口`,
    type: '检票',
    gateNo: gate.gateNo,
    xFrac: CHECK_GATE_ACCESS_POINTS[gate.gateNo].center.xFrac,
    yFrac: CHECK_GATE_ACCESS_POINTS[gate.gateNo].center.yFrac,
    description: `${gate.gateNo} 号检票通道。`,
  })),
  ...STATION_AREAS.filter(a => a.type === 'boarding-bay').map(bay => ({
    id: `poi-boarding-bay-${bay.bayNo}`,
    icon: 'icon-bus-bay',
    name: `${bay.bayNo} 号发车位`,
    type: '发车位',
    bayNo: bay.bayNo,
    xFrac: BOARDING_BAY_ACCESS_POINTS[bay.bayNo].xFrac,
    yFrac: BOARDING_BAY_ACCESS_POINTS[bay.bayNo].yFrac,
    description: `${bay.bayNo} 号发车位登车点。`,
  })),
]

export const LEGEND_ITEMS = [
  { label: '候车区', color: STATION_COLORS.waiting },
  { label: '检票口', color: STATION_COLORS.checkGate },
  { label: '可穿行车位', color: STATION_COLORS.bayPassable },
  { label: '不可穿行车位', color: STATION_COLORS.bayOccupied },
  { label: '服务设施', color: STATION_COLORS.service },
  { label: '停车场', color: STATION_COLORS.parking },
]

export function fracToCart(xFrac, yFrac) {
  return {
    x: MAP_START_X + xFrac * MAP_WIDTH_M * LAYOUT_SCALE,
    y: MAP_START_Y + yFrac * MAP_HEIGHT_M * LAYOUT_SCALE,
  }
}

export function fracToGPS(xFrac, yFrac) {
  const cart = fracToCart(xFrac, yFrac)
  const gps = window.MapUtils.cartesianToGPS({
    x: cart.x,
    y: cart.y,
    scale: MAP_RESOLUTION,
    zoomFactor: 2,
  })
  return [gps.longitude, gps.latitude]
}

export function buildAreasGeoJSON(toGPS, areas = STATION_AREAS) {
  return {
    type: 'FeatureCollection',
    features: areas.map(area => polygonFeature(
      area.id,
      area.name,
      getAreaFillColor(area),
      area.polygon.map(([x, y]) => toGPS(x, y)),
      { occupied: area.occupied ?? false, bayNo: area.bayNo ?? null },
    )),
  }
}

export function getBoardingAccessPoint(bayNo) {
  return BOARDING_BAY_ACCESS_POINTS[bayNo] || null
}

export function getWaitingPoi() {
  return STATION_POIS.find(p => p.id === 'poi-waiting-hall')
}

export function getCheckGateAccessPoint(gateNo) {
  return CHECK_GATE_ACCESS_POINTS[gateNo] || null
}

export function getCheckGateArrivalPoint(gateNo) {
  return CHECK_GATE_ACCESS_POINTS[gateNo]?.arrival || null
}

export function getCheckGateDeparturePoint(gateNo) {
  return CHECK_GATE_ACCESS_POINTS[gateNo]?.departure || null
}

export function getCheckGatePoi(gateNo) {
  return STATION_POIS.find(p => p.id === `poi-check-gate-${gateNo}`)
}

export function getBoardingBayPoi(bayNo) {
  return STATION_POIS.find(p => p.id === `poi-boarding-bay-${bayNo}`)
}

export function getStageTargetPoi(trip, stage) {
  if (!trip) return null
  switch (stage) {
    case 'ticket':
      return STATION_POIS.find(p => p.id === 'poi-ticket-hall')
    case 'waiting':
      return getWaitingPoi()
    case 'check': {
      const poi = getCheckGatePoi(trip.checkGate)
      const arrival = getCheckGateArrivalPoint(trip.checkGate)
      return poi && arrival ? { ...poi, xFrac: arrival.xFrac, yFrac: arrival.yFrac } : poi
    }
    case 'boarding': {
      const access = getBoardingAccessPoint(trip.boardingBay)
      const poi = getBoardingBayPoi(trip.boardingBay)
      return poi && access ? { ...poi, xFrac: access.xFrac, yFrac: access.yFrac } : poi
    }
    default:
      return null
  }
}

export function syncBayOccupancyFromTrips(areas, trips) {
  areas.filter(a => a.type === 'boarding-bay').forEach(bay => {
    bay.occupied = false
    bay.occupiedBy = null
  })
  trips.forEach(trip => {
    if (trip.status === TRIP_STATUS.CHECKING || trip.status === TRIP_STATUS.BOARDING) {
      const bay = areas.find(a => a.type === 'boarding-bay' && a.bayNo === trip.boardingBay)
      if (bay) {
        bay.occupied = true
        bay.occupiedBy = trip.id
      }
    }
  })
}
