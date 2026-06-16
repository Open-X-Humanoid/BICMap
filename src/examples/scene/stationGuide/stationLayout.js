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
  concourse: '#e2eefa',
  corridor: '#c2e1fe',
  service: '#e4ebf3',
  gate: '#c2e1fe',
  security: '#c2e1fe',
  platform: '#e6efff',
  transfer: '#edf1fc',
  facility: '#e0f2fe',
  retail: '#e2d6fa',
  plaza: '#edf1fc',
  transport: '#fefce8',
  robotStandby: '#e2d6fa',
  outline: '#b8cbe0',
  route: '#3b82f6',
}

function rectCorners(x1, y1, x2, y2) {
  return [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]
}

function polygonFeature(id, name, color, polygon) {
  return {
    type: 'Feature',
    properties: { id, name, color },
    geometry: {
      type: 'Polygon',
      coordinates: [polygon],
    },
  }
}

export const STATION_AREAS = [
  { id: 'front-plaza', name: '站前广场', passable: true, color: STATION_COLORS.plaza, polygon: rectCorners(0.09, 0.05, 0.91, 0.15) },
  { id: 'taxi-area', name: '出租车乘车处', passable: false, color: STATION_COLORS.transport, polygon: rectCorners(0.09, 0.19, 0.23, 0.29) },
  { id: 'bus-dropoff', name: '公交接驳区', passable: false, color: STATION_COLORS.transport, polygon: rectCorners(0.77, 0.19, 0.91, 0.29) },
  { id: 'west-entry', name: '西进站口', passable: true, color: STATION_COLORS.corridor, polygon: rectCorners(0.09, 0.35, 0.19, 0.55) },
  { id: 'east-entry', name: '东进站口', passable: true, color: STATION_COLORS.corridor, polygon: rectCorners(0.81, 0.35, 0.91, 0.55) },
  { id: 'main-hall', name: '中央候车大厅', passable: true, color: STATION_COLORS.concourse, polygon: rectCorners(0.21, 0.31, 0.79, 0.61) },
  { id: 'manual-ticket', name: '售票服务区', passable: false, color: STATION_COLORS.service, polygon: rectCorners(0.25, 0.19, 0.39, 0.29) },
  { id: 'self-ticket', name: '自助取票厅', passable: false, color: STATION_COLORS.service, polygon: rectCorners(0.43, 0.19, 0.57, 0.29) },
  { id: 'refund-office', name: '退票处', passable: false, color: STATION_COLORS.service, polygon: rectCorners(0.61, 0.19, 0.73, 0.29) },
  { id: 'security', name: '安检通道', passable: false, color: STATION_COLORS.security, polygon: rectCorners(0.32, 0.65, 0.42, 0.73) },
  { id: 'gate', name: '检票闸机', passable: false, color: STATION_COLORS.gate, polygon: rectCorners(0.58, 0.65, 0.68, 0.73) },
  { id: 'supermarket', name: '便利超市', passable: false, color: STATION_COLORS.retail, polygon: rectCorners(0.09, 0.63, 0.25, 0.75) },
  { id: 'robot-standby', name: '机器人待机区', passable: false, color: STATION_COLORS.robotStandby, polygon: rectCorners(0.65, 0.51, 0.73, 0.59) },
  { id: 'restroom', name: '卫生间', passable: false, color: STATION_COLORS.facility, polygon: rectCorners(0.75, 0.63, 0.91, 0.75) },
  { id: 'platform-1', name: '1 站台', passable: true, color: STATION_COLORS.platform, polygon: rectCorners(0.11, 0.83, 0.43, 0.93) },
  { id: 'platform-2', name: '2 站台', passable: true, color: STATION_COLORS.platform, polygon: rectCorners(0.57, 0.83, 0.89, 0.93) },
  { id: 'transfer-hall', name: '换乘通道', passable: true, color: STATION_COLORS.transfer, polygon: rectCorners(0.45, 0.75, 0.55, 0.97) },
]

export const STATION_POIS = [
  { id: 'poi-front-plaza', icon: 'icon-front-plaza', name: '站前广场', type: '广场', xFrac: 0.50, yFrac: 0.10, description: '车站主入口外部集散空间，连接落客区与进站口。' },
  { id: 'poi-taxi', icon: 'icon-taxi', name: '出租车乘车处', type: '交通', xFrac: 0.16, yFrac: 0.24, description: '出租车排队与上客区域，适合离站旅客快速接驳。' },
  { id: 'poi-west-entry', icon: 'icon-entry', name: '西进站口', type: '入口', xFrac: 0.14, yFrac: 0.45, description: '靠近出租车与公交接驳区，适合快速进站。' },
  { id: 'poi-service-center', icon: 'icon-service-center', name: '售票服务区', type: '服务', xFrac: 0.32, yFrac: 0.24, description: '提供人工售票、问询、失物招领和重点旅客协助。' },
  { id: 'poi-self-ticket', icon: 'icon-self-ticket', name: '自助取票厅', type: '票务', xFrac: 0.50, yFrac: 0.24, description: '旅客可在此使用身份证或订单号自助取票。' },
  { id: 'poi-refund', icon: 'icon-refund', name: '退票处', type: '票务', xFrac: 0.67, yFrac: 0.24, description: '办理退票、改签及异常票务处理。' },
  { id: 'poi-waiting', icon: 'icon-waiting', name: '候车大厅', type: '候车', xFrac: 0.50, yFrac: 0.46, description: '车站核心公共空间，可查看列车信息与候车引导。' },
  { id: 'poi-security', icon: 'icon-security', name: '安检口', type: '安检', xFrac: 0.37, yFrac: 0.69, description: '旅客进入站台区前的行李安检区域。' },
  { id: 'poi-gate', icon: 'icon-gate', name: '检票口', type: '闸机', xFrac: 0.63, yFrac: 0.69, description: '前往站台前完成车票核验。' },
  { id: 'poi-supermarket', icon: 'icon-supermarket', name: '便利超市', type: '商业', xFrac: 0.17, yFrac: 0.69, description: '提供饮用水、简餐、旅行用品和应急商品。' },
  { id: 'poi-robot-standby', icon: 'icon-robot-standby', name: '机器人待机区', type: '机器人', xFrac: 0.69, yFrac: 0.55, description: '导览机器人充电、待命和任务派发区域。' },
  { id: 'poi-restroom', icon: 'icon-restroom', name: '卫生间', type: '设施', xFrac: 0.83, yFrac: 0.69, description: '含无障碍卫生间与母婴室指引。' },
  { id: 'poi-platform-1', icon: 'icon-platform', name: '1 站台', type: '站台', xFrac: 0.27, yFrac: 0.88, description: '1 站台候车与乘车区域。' },
  { id: 'poi-platform-2', icon: 'icon-platform', name: '2 站台', type: '站台', xFrac: 0.73, yFrac: 0.88, description: '2 站台候车与乘车区域。' },
  { id: 'poi-transfer', icon: 'icon-transfer', name: '换乘通道', type: '换乘', xFrac: 0.50, yFrac: 0.90, description: '连接地铁、出租车和停车场方向。' },
  { id: 'poi-east-entry', icon: 'icon-entry', name: '东进站口', type: '入口', xFrac: 0.86, yFrac: 0.45, description: '靠近停车场和网约车落客区。' },
  { id: 'poi-bus-dropoff', icon: 'icon-bus-dropoff', name: '公交接驳区', type: '交通', xFrac: 0.84, yFrac: 0.24, description: '公交接驳区，适合离站旅客快速接驳。' },

]

export const GUIDE_ROUTE = [
  [0.50, 0.10],
  [0.50, 0.24],
  [0.32, 0.24],
  [0.50, 0.24],
  [0.67, 0.24],
  [0.50, 0.24],
  [0.50, 0.46],
  [0.37, 0.46],
  [0.37, 0.69],
  [0.63, 0.69],
  [0.50, 0.69],
  [0.50, 0.90],
  [0.27, 0.90],
  [0.73, 0.90],
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

export function buildStationAreasGeoJSON(toGPS) {
  return {
    type: 'FeatureCollection',
    features: STATION_AREAS.map(area => polygonFeature(
      area.id,
      area.name,
      area.color,
      area.polygon.map(([x, y]) => toGPS(x, y))
    )),
  }
}

export function buildStationRouteGeoJSON(toGPS) {
  return {
    type: 'Feature',
    properties: { id: 'station-guide-route' },
    geometry: {
      type: 'LineString',
      coordinates: GUIDE_ROUTE.map(([x, y]) => toGPS(x, y)),
    },
  }
}
