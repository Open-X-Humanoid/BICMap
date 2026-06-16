import {
  LANE_HALF_WIDTH,
  MAP_BEARING,
  MAP_CENTER,
  MAP_PITCH,
  MAP_ZOOM,
  PRIMARY_LANE_COUNT
} from './mockBasemapData.js'

export { MAP_CENTER, MAP_ZOOM, MAP_PITCH, MAP_BEARING, LANE_HALF_WIDTH }

/** 创业路 × 东环路交叉口中心 */
const INTERSECTION_LNG = 116.4103
const INTERSECTION_LAT = 39.9030

/** 路缘硬边界偏移（与 solid_white 标线、停止线一致） */
const ROAD_HARD_EDGE = LANE_HALF_WIDTH * 4

/** 东环路北向停止线纬度（北向路段在此截断） */
const DH_RING_NORTH_BOUNDARY = INTERSECTION_LAT - ROAD_HARD_EDGE
/** 东环路南向停止线纬度（南向路段从此开始） */
const DH_RING_SOUTH_BOUNDARY = INTERSECTION_LAT + ROAD_HARD_EDGE
/** 东环路北向路段终点纬度 */
const DH_RING_LAT_MAX = 39.9076
/** 东环路南向路段起点纬度 */
const DH_RING_LAT_MIN = 39.9010

/**
 * 东环路南北向标线段（按停止线在路口截断为南/北两段）
 * @param {number} lng
 * @param {'south'|'north'} segment
 * @returns {Array<[number, number]>}
 */
function dhNsLineCoords(lng, segment) {
  if (segment === 'south') {
    return [[lng, DH_RING_SOUTH_BOUNDARY], [lng, DH_RING_LAT_MAX]]
  }
  return [[lng, DH_RING_LAT_MIN], [lng, DH_RING_NORTH_BOUNDARY]]
}

/**
 * 生成东环路双侧标线段（双黄线、虚线、硬边界等）
 */
function dhNsMarkingPair(lng, props) {
  return ['south', 'north'].map((segment) => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: dhNsLineCoords(lng, segment) },
    properties: { road_name: '东环路', segment, ...props }
  }))
}

/**
 * 生成东环路各车道南/北两段面
 */
function dhNsLaneFeatures() {
  return Array.from({ length: PRIMARY_LANE_COUNT }, (_, i) => {
    const southbound = i < PRIMARY_LANE_COUNT / 2
    return ['south', 'north'].map((segment) => {
      const latMin = segment === 'south' ? DH_RING_SOUTH_BOUNDARY : DH_RING_LAT_MIN
      const latMax = segment === 'south' ? DH_RING_LAT_MAX : DH_RING_NORTH_BOUNDARY
      return {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: nsLanePolygon(latMin, latMax, INTERSECTION_LNG, i) },
        properties: {
          lane_id: `DH-L${i + 1}`,
          road_name: '东环路',
          segment,
          lane_type: i === 0 ? 'bicycle' : 'driving',
          direction: southbound ? 'southbound' : 'northbound',
          speed_limit: 50
        }
      }
    })
  }).flat()
}

/** 创业路东西向路段起止经度 */
const CY_ROAD_LNG_WEST = 116.4032
const CY_ROAD_LNG_EAST = 116.4118
const CY_ROAD_LAT_CENTER = 39.9030
/** 创业路东向停止线经度（西侧路段在此截断） */
const CY_STOP_LNG_WEST = INTERSECTION_LNG - ROAD_HARD_EDGE
/** 创业路西向停止线经度（东侧路段从此开始） */
const CY_STOP_LNG_EAST = INTERSECTION_LNG + ROAD_HARD_EDGE

/**
 * 创业路东西向标线段（按停止线在路口截断为西/东两段）
 * @param {number} lat
 * @param {'west'|'east'} segment
 * @returns {Array<[number, number]>}
 */
function cyEwLineCoords(lat, segment) {
  if (segment === 'west') {
    return [[CY_ROAD_LNG_WEST, lat], [CY_STOP_LNG_WEST, lat]]
  }
  return [[CY_STOP_LNG_EAST, lat], [CY_ROAD_LNG_EAST, lat]]
}

/**
 * 生成创业路双侧标线段（双黄线、虚线、硬边界等）
 */
function cyEwMarkingPair(lat, props) {
  return ['west', 'east'].map((segment) => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: cyEwLineCoords(lat, segment) },
    properties: { road_name: '创业路', segment, ...props }
  }))
}

/**
 * 生成创业路各车道东西两段面
 */
function cyEwLaneFeatures() {
  return Array.from({ length: PRIMARY_LANE_COUNT }, (_, i) => {
    const westbound = i < PRIMARY_LANE_COUNT / 2
    return ['west', 'east'].map((segment) => {
      const lngMin = segment === 'west' ? CY_ROAD_LNG_WEST : CY_STOP_LNG_EAST
      const lngMax = segment === 'west' ? CY_STOP_LNG_WEST : CY_ROAD_LNG_EAST
      return {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: ewLanePolygon(lngMin, lngMax, CY_ROAD_LAT_CENTER, i) },
        properties: {
          lane_id: `CY-L${i + 1}`,
          road_name: '创业路',
          segment,
          lane_type: i === 0 ? 'bicycle' : 'driving',
          direction: westbound ? 'westbound' : 'eastbound',
          speed_limit: 60
        }
      }
    })
  }).flat()
}

/**
 * 沿东西向道路生成车道面矩形
 * @param {number} lngMin
 * @param {number} lngMax
 * @param {number} latCenter
 * @param {number} laneIndex 0=最南车道
 * @returns {Array}
 */
function ewLanePolygon(lngMin, lngMax, latCenter, laneIndex) {
  const offset = (laneIndex - 1.5) * LANE_HALF_WIDTH * 2
  const cy = latCenter + offset
  return [[
    [lngMin, cy - LANE_HALF_WIDTH],
    [lngMax, cy - LANE_HALF_WIDTH],
    [lngMax, cy + LANE_HALF_WIDTH],
    [lngMin, cy + LANE_HALF_WIDTH],
    [lngMin, cy - LANE_HALF_WIDTH]
  ]]
}

/**
 * 沿南北向道路生成车道面矩形
 * @param {number} latMin
 * @param {number} latMax
 * @param {number} lngCenter
 * @param {number} laneIndex
 * @returns {Array}
 */
function nsLanePolygon(latMin, latMax, lngCenter, laneIndex) {
  const offset = (laneIndex - 1.5) * LANE_HALF_WIDTH * 2
  const cx = lngCenter + offset
  return [[
    [cx - LANE_HALF_WIDTH, latMin],
    [cx + LANE_HALF_WIDTH, latMin],
    [cx + LANE_HALF_WIDTH, latMax],
    [cx - LANE_HALF_WIDTH, latMax],
    [cx - LANE_HALF_WIDTH, latMin]
  ]]
}

/** 可通行车道面 */
export const MOCK_HD_LANES = {
  type: 'FeatureCollection',
  features: [
    // 创业路（东西向，4 车道 × 西/东两段）
    ...cyEwLaneFeatures(),
    // 东环路（南北向，4 车道 × 南/北两段）
    ...dhNsLaneFeatures(),
  ]
}

/** 自行车道图标沿线路间隔（像素） */
export const BIKE_ICON_SPACING = 80

/**
 * 从轴对齐矩形车道面提取中心线
 * @param {Array} polygonCoords
 * @returns {Array<[number, number]>}
 */
function getPolygonCenterline(polygonCoords) {
  const ring = polygonCoords[0]
  const lngs = ring.map((p) => p[0])
  const lats = ring.map((p) => p[1])
  const lngMin = Math.min(...lngs)
  const lngMax = Math.max(...lngs)
  const latMin = Math.min(...lats)
  const latMax = Math.max(...lats)
  const cx = (lngMin + lngMax) / 2
  const cy = (latMin + latMax) / 2

  if (lngMax - lngMin >= latMax - latMin) {
    return [[lngMin, cy], [lngMax, cy]]
  }
  return [[cx, latMin], [cx, latMax]]
}

/**
 * 按行驶方向定向线段坐标
 * @param {Array<[number, number]>} coords
 * @param {string} direction
 * @returns {Array<[number, number]>}
 */
function orientLineCoords(coords, direction) {
  const reverse = direction === 'westbound' || direction === 'southbound'
  return reverse ? [coords[1], coords[0]] : coords
}

/**
 * 东环路车道方向箭头与标线方向对调（南向/北向互换）
 * @param {string} direction
 * @param {string} roadName
 * @returns {string}
 */
function getLaneArrowDirection(direction, roadName) {
  if (roadName !== '东环路') return direction
  if (direction === 'southbound') return 'northbound'
  if (direction === 'northbound') return 'southbound'
  return direction
}

/**
 * 按行驶方向定向车道中心线坐标
 * @param {Array} polygonCoords
 * @param {string} direction
 * @returns {Array<[number, number]>}
 */
function getOrientedLaneCenterline(polygonCoords, direction) {
  const line = getPolygonCenterline(polygonCoords)
  return orientLineCoords(line, direction)
}

/** 自行车道中心线（用于沿线放置图标） */
export const MOCK_HD_BICYCLE_LANE_LINES = {
  type: 'FeatureCollection',
  features: MOCK_HD_LANES.features
    .filter((f) => f.properties.lane_type === 'bicycle')
    .map((f) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: getOrientedLaneCenterline(f.geometry.coordinates, f.properties.direction)
      },
      properties: { ...f.properties }
    }))
}

/** 车道标线（实线 / 虚线 / 双黄线） */
export const MOCK_HD_MARKINGS = {
  type: 'FeatureCollection',
  features: [
    // 创业路 - 中央双黄线（路口截断）
    ...cyEwMarkingPair(CY_ROAD_LAT_CENTER - LANE_HALF_WIDTH * 0.3, { marking_type: 'double_yellow' }),
    ...cyEwMarkingPair(CY_ROAD_LAT_CENTER + LANE_HALF_WIDTH * 0.3, { marking_type: 'double_yellow' }),
    // 创业路 - 车道分隔虚线（西/东两段，与硬边界一致）
    ...cyEwMarkingPair(CY_ROAD_LAT_CENTER - LANE_HALF_WIDTH * 2, {
      marking_type: 'dashed_white',
      direction: 'westbound'
    }),
    ...cyEwMarkingPair(CY_ROAD_LAT_CENTER + LANE_HALF_WIDTH * 2, {
      marking_type: 'dashed_white',
      direction: 'eastbound'
    }),
    // 创业路 - 路缘硬边界（路口截断）
    ...cyEwMarkingPair(CY_ROAD_LAT_CENTER - LANE_HALF_WIDTH * 4, { marking_type: 'solid_white' }),
    ...cyEwMarkingPair(CY_ROAD_LAT_CENTER + LANE_HALF_WIDTH * 4, { marking_type: 'solid_white' }),
    // 东环路 - 中央双黄线（南/北两段截断）
    ...dhNsMarkingPair(INTERSECTION_LNG - LANE_HALF_WIDTH * 0.3, { marking_type: 'double_yellow' }),
    ...dhNsMarkingPair(INTERSECTION_LNG + LANE_HALF_WIDTH * 0.3, { marking_type: 'double_yellow' }),
    // 东环路 - 车道分隔虚线（南/北两段）
    ...dhNsMarkingPair(INTERSECTION_LNG - LANE_HALF_WIDTH * 2, {
      marking_type: 'dashed_white',
      direction: 'southbound'
    }),
    ...dhNsMarkingPair(INTERSECTION_LNG + LANE_HALF_WIDTH * 2, {
      marking_type: 'dashed_white',
      direction: 'northbound'
    }),
    // 东环路 - 路缘硬边界（南/北两段）
    ...dhNsMarkingPair(INTERSECTION_LNG - ROAD_HARD_EDGE, { marking_type: 'solid_white' }),
    ...dhNsMarkingPair(INTERSECTION_LNG + ROAD_HARD_EDGE, { marking_type: 'solid_white' })
  ]
}

/** 车道分隔虚线（按行驶方向定向，用于方向箭头） */
export const MOCK_HD_DASHED_LANE_LINES = {
  type: 'FeatureCollection',
  features: MOCK_HD_MARKINGS.features
    .filter((f) => f.properties.marking_type === 'dashed_white')
    .map((f) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: orientLineCoords(
          f.geometry.coordinates,
          getLaneArrowDirection(f.properties.direction, f.properties.road_name)
        )
      },
      properties: { ...f.properties }
    }))
}

/** 车道方向箭头沿线路间隔（像素） */
export const LANE_ARROW_SPACING = 60
/** 车道方向箭头图标缩放 */
export const LANE_ARROW_ICON_SIZE = 0.9

/** 停止线 */
export const MOCK_HD_STOP_LINES = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        // 创业路东向：位于东环路西缘边界，跨度覆盖至南北路缘硬边界
        coordinates: [
          [INTERSECTION_LNG - ROAD_HARD_EDGE, INTERSECTION_LAT - ROAD_HARD_EDGE],
          [INTERSECTION_LNG - ROAD_HARD_EDGE, INTERSECTION_LAT + ROAD_HARD_EDGE]
        ]
      },
      properties: { road_name: '创业路×东环路', direction: 'eastbound', placement: 'intersection' }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        // 创业路西向：位于东环路东缘边界（与东向停止线对称）
        coordinates: [
          [INTERSECTION_LNG + ROAD_HARD_EDGE, INTERSECTION_LAT - ROAD_HARD_EDGE],
          [INTERSECTION_LNG + ROAD_HARD_EDGE, INTERSECTION_LAT + ROAD_HARD_EDGE]
        ]
      },
      properties: { road_name: '创业路×东环路', direction: 'westbound', placement: 'intersection' }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        // 东环路北向：位于创业路南缘硬边界，跨度覆盖交叉口东西路缘
        coordinates: [
          [INTERSECTION_LNG - ROAD_HARD_EDGE, INTERSECTION_LAT - ROAD_HARD_EDGE],
          [INTERSECTION_LNG + ROAD_HARD_EDGE, INTERSECTION_LAT - ROAD_HARD_EDGE]
        ]
      },
      properties: { road_name: '创业路×东环路', direction: 'northbound', placement: 'hard_boundary' }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        // 东环路南向：位于创业路北缘硬边界（与北向停止线对称）
        coordinates: [
          [INTERSECTION_LNG - ROAD_HARD_EDGE, INTERSECTION_LAT + ROAD_HARD_EDGE],
          [INTERSECTION_LNG + ROAD_HARD_EDGE, INTERSECTION_LAT + ROAD_HARD_EDGE]
        ]
      },
      properties: { road_name: '创业路×东环路', direction: 'southbound', placement: 'hard_boundary' }
    }
  ]
}

/** 人行横道区域深度（自停止线向路口内侧） */
const CROSSWALK_DEPTH = LANE_HALF_WIDTH * 2.5
/** 单处横道斑马线条纹数 */
const CROSSWALK_STRIPE_COUNT = 5
/** 单条白色条纹宽度占间距的比例 */
const CROSSWALK_STRIPE_BAR_RATIO = 0.35
/** 单条白色条纹半宽（地理坐标），两条横道共用 */
const CROSSWALK_STRIPE_BAR_HALF_WIDTH = (CROSSWALK_DEPTH / CROSSWALK_STRIPE_COUNT) * CROSSWALK_STRIPE_BAR_RATIO
/** 路口角落留白，避免两条横道区域重叠 */
const CROSSWALK_CORNER_INSET = CROSSWALK_DEPTH

/**
 * 生成横道区域多边形坐标环
 */
function crosswalkRect(cx, cy, halfLng, halfLat) {
  return [[
    [cx - halfLng, cy - halfLat],
    [cx + halfLng, cy - halfLat],
    [cx + halfLng, cy + halfLat],
    [cx - halfLng, cy + halfLat],
    [cx - halfLng, cy - halfLat]
  ]]
}

/**
 * 条纹沿经度方向排布：每条为东西向白条（穿越东西向道路时使用）
 */
function zebraBarsAlongLng(lngMin, lngMax, latMin, latMax, count, direction) {
  const depth = lngMax - lngMin
  const pitch = depth / count
  const barHalfLng = CROSSWALK_STRIPE_BAR_HALF_WIDTH
  const cy = (latMin + latMax) / 2
  const halfLat = (latMax - latMin) / 2
  return Array.from({ length: count }, (_, i) => {
    const lng = lngMin + (i + 0.5) * pitch
    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: crosswalkRect(lng, cy, barHalfLng, halfLat) },
      properties: { feature_type: 'stripe', direction }
    }
  })
}

/**
 * 条纹沿纬度方向排布：每条为南北向白条（穿越南北向道路时使用）
 */
function zebraBarsAlongLat(lngMin, lngMax, latMin, latMax, count, direction) {
  const depth = latMax - latMin
  const pitch = depth / count
  const barHalfLat = CROSSWALK_STRIPE_BAR_HALF_WIDTH
  const cx = (lngMin + lngMax) / 2
  const halfLng = (lngMax - lngMin) / 2
  return Array.from({ length: count }, (_, i) => {
    const lat = latMin + (i + 0.5) * pitch
    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: crosswalkRect(cx, lat, halfLng, barHalfLat) },
      properties: { feature_type: 'stripe', direction }
    }
  })
}

/** 路口两处人行横道（西向、南向进口），角落内缩避免重叠 */
const HD_CROSSWALK_SPECS = [
  {
    direction: 'westbound',
    bounds: {
      lngMin: INTERSECTION_LNG + ROAD_HARD_EDGE - CROSSWALK_DEPTH,
      lngMax: INTERSECTION_LNG + ROAD_HARD_EDGE,
      latMin: INTERSECTION_LAT - ROAD_HARD_EDGE,
      latMax: INTERSECTION_LAT + ROAD_HARD_EDGE
    },
    stripes: (b) => zebraBarsAlongLat(
      b.lngMin, b.lngMax, b.latMin, b.latMax, CROSSWALK_STRIPE_COUNT, 'westbound'
    )
  },
  {
    direction: 'southbound',
    bounds: {
      lngMin: INTERSECTION_LNG - ROAD_HARD_EDGE,
      lngMax: INTERSECTION_LNG + ROAD_HARD_EDGE - CROSSWALK_CORNER_INSET,
      latMin: INTERSECTION_LAT + ROAD_HARD_EDGE - CROSSWALK_DEPTH,
      latMax: INTERSECTION_LAT + ROAD_HARD_EDGE
    },
    stripes: (b) => zebraBarsAlongLng(
      b.lngMin, b.lngMax, b.latMin, b.latMax, CROSSWALK_STRIPE_COUNT, 'southbound'
    )
  }
]

export const MOCK_HD_CROSSWALKS = {
  type: 'FeatureCollection',
  features: HD_CROSSWALK_SPECS.flatMap((spec) => {
    const { lngMin, lngMax, latMin, latMax } = spec.bounds
    const cx = (lngMin + lngMax) / 2
    const cy = (latMin + latMax) / 2
    return [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: crosswalkRect(cx, cy, (lngMax - lngMin) / 2, (latMax - latMin) / 2)
        },
        properties: {
          feature_type: 'zone',
          road_name: '创业路×东环路',
          direction: spec.direction
        }
      },
      ...spec.stripes(spec.bounds)
    ]
  })
}

/** 创业路 × 东环路交叉口中心 */
export const HD_INTERSECTION_CENTER = [INTERSECTION_LNG, INTERSECTION_LAT]

/** 路口人行横道聚焦视野（含停止线与相邻车道上下文） */
const CROSSWALK_FOCUS_PAD = LANE_HALF_WIDTH * 10
export const HD_CROSSWALK_FOCUS_BOUNDS = [
  [
    INTERSECTION_LNG - ROAD_HARD_EDGE - CROSSWALK_FOCUS_PAD,
    INTERSECTION_LAT - ROAD_HARD_EDGE - CROSSWALK_FOCUS_PAD
  ],
  [
    INTERSECTION_LNG + ROAD_HARD_EDGE + CROSSWALK_FOCUS_PAD,
    INTERSECTION_LAT + ROAD_HARD_EDGE + CROSSWALK_FOCUS_PAD
  ]
]

/** 交通标志点位 */
export const MOCK_HD_SIGNS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [116.4098, 39.9030 + LANE_HALF_WIDTH * 4.5] },
      properties: { sign_type: 'speed_limit', value: '60', road_name: '创业路' }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [116.4103 + LANE_HALF_WIDTH * 4.5, 39.9045] },
      properties: { sign_type: 'yield', value: '让行', road_name: '东环路' }
    }
  ]
}

/** 路口信号灯：停止线前偏移（距停止线距离为原先一半） */
const TL_APPROACH_OFFSET = LANE_HALF_WIDTH * 1
const TL_LANE_OFFSET = LANE_HALF_WIDTH * 2.5

/** 路口四处停止线信号灯 */
export const MOCK_HD_TRAFFIC_LIGHTS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          INTERSECTION_LNG - ROAD_HARD_EDGE - TL_APPROACH_OFFSET,
          INTERSECTION_LAT - TL_LANE_OFFSET
        ]
      },
      properties: {
        direction: 'eastbound',
        signal_state: 'red',
        road_name: '创业路×东环路',
        bearing: 90
      }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          INTERSECTION_LNG + ROAD_HARD_EDGE + TL_APPROACH_OFFSET,
          INTERSECTION_LAT + TL_LANE_OFFSET
        ]
      },
      properties: {
        direction: 'westbound',
        signal_state: 'green',
        road_name: '创业路×东环路',
        bearing: 270
      }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          INTERSECTION_LNG - TL_LANE_OFFSET,
          INTERSECTION_LAT - ROAD_HARD_EDGE - TL_APPROACH_OFFSET
        ]
      },
      properties: {
        direction: 'northbound',
        signal_state: 'red',
        road_name: '创业路×东环路',
        bearing: 0
      }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          INTERSECTION_LNG + TL_LANE_OFFSET,
          INTERSECTION_LAT + ROAD_HARD_EDGE + TL_APPROACH_OFFSET
        ]
      },
      properties: {
        direction: 'southbound',
        signal_state: 'yellow',
        road_name: '创业路×东环路',
        bearing: 180
      }
    }
  ]
}

/** 信号灯杆高度（米） */
export const TRAFFIC_LIGHT_POLE_HEIGHT = 5.2
/** 信号灯灯箱高度（米） */
export const TRAFFIC_LIGHT_HEAD_HEIGHT = 1.1

const SIGNAL_LAMP_COLORS = {
  red: { lit: '#ef5350', dim: '#3e2723' },
  yellow: { lit: '#fdd835', dim: '#3e3a20' },
  green: { lit: '#66bb6a', dim: '#1b3320' }
}

/**
 * 生成信号灯点位周围的小方形 footprint
 */
function trafficLightFootprint(lng, lat, half) {
  return [[
    [lng - half, lat - half],
    [lng + half, lat - half],
    [lng + half, lat + half],
    [lng - half, lat + half],
    [lng - half, lat - half]
  ]]
}

/**
 * 由信号灯点位生成灯杆、灯箱与三色灯面拉伸体
 */
function buildTrafficLightPoleFeatures(light) {
  const [lng, lat] = light.geometry.coordinates
  const { signal_state, direction, road_name, bearing } = light.properties
  const poleHalf = LANE_HALF_WIDTH * 0.08
  const headHalf = LANE_HALF_WIDTH * 0.26
  const lampHalf = LANE_HALF_WIDTH * 0.17
  const poleH = TRAFFIC_LIGHT_POLE_HEIGHT
  const headH = TRAFFIC_LIGHT_HEAD_HEIGHT
  const lampStep = headH / 3

  const mk = (featureType, half, height, baseHeight, color, extra = {}) => ({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: trafficLightFootprint(lng, lat, half) },
    properties: {
      feature_type: featureType,
      height,
      base_height: baseHeight,
      color,
      direction,
      road_name,
      bearing,
      signal_state,
      ...extra
    }
  })

  return [
    mk('pole', poleHalf, poleH, 0, '#78909c'),
    mk('head', headHalf, poleH + headH, poleH, '#263238'),
    ...['red', 'yellow', 'green'].map((lamp, i) => mk(
      'lamp',
      lampHalf,
      poleH + (i + 1) * lampStep,
      poleH + i * lampStep + lampStep * 0.12,
      lamp === signal_state ? SIGNAL_LAMP_COLORS[lamp].lit : SIGNAL_LAMP_COLORS[lamp].dim,
      { lamp_state: lamp }
    ))
  ]
}

/** 路口信号灯三维灯杆（fill-extrusion） */
export const MOCK_HD_TRAFFIC_LIGHT_POLES = {
  type: 'FeatureCollection',
  features: MOCK_HD_TRAFFIC_LIGHTS.features.flatMap(buildTrafficLightPoleFeatures)
}

/** 高精地图图层 ID 常量 */
export const HD_LAYER_IDS = {
  DRIVING_LANES: 'hd-driving-lanes-fill',
  BICYCLE_LANES: 'hd-bicycle-lanes-fill',
  BICYCLE_ICONS: 'hd-bicycle-icons',
  MARKINGS_SOLID: 'hd-markings-solid',
  MARKINGS_DASHED: 'hd-markings-dashed',
  MARKINGS_DOUBLE: 'hd-markings-double',
  LANE_ARROWS: 'hd-lane-arrows',
  STOP_LINES: 'hd-stop-lines',
  CROSSWALKS: 'hd-crosswalks-fill',
  CROSSWALK_STRIPES: 'hd-crosswalk-stripes',
  TRAFFIC_LIGHTS: 'hd-traffic-lights',
  SIGNS: 'hd-signs'
}

export const BIKE_ICON_ID = 'hd-bike-icon'
export const LANE_ARROW_ICON_ID = 'hd-lane-arrow-icon'

export const HD_SOURCE_IDS = {
  LANES: 'hd-lanes-source',
  BICYCLE_LANE_LINES: 'hd-bicycle-lane-lines-source',
  LANE_LINES: 'hd-lane-lines-source',
  MARKINGS: 'hd-markings-source',
  STOP_LINES: 'hd-stop-lines-source',
  CROSSWALKS: 'hd-crosswalks-source',
  TRAFFIC_LIGHTS: 'hd-traffic-lights-source',
  SIGNS: 'hd-signs-source'
}
