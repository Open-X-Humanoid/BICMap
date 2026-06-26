import {
  HD_INTERSECTION_LANE_COUNT,
  LANE_HALF_WIDTH,
  MAP_BEARING,
  MAP_CENTER,
  MAP_PITCH,
  MAP_ZOOM,
} from './mockBasemapData.js'

export { MAP_CENTER, MAP_ZOOM, MAP_PITCH, MAP_BEARING, LANE_HALF_WIDTH }

/** 高精路口车道总数（含最外侧两条自行车道） */
const HD_LANE_COUNT = HD_INTERSECTION_LANE_COUNT

/** 创业路 × 东环路交叉口中心 */
const INTERSECTION_LNG = 116.4103
const INTERSECTION_LAT = 39.9030

/** 路缘硬边界偏移（与 solid_white 标线、停止线一致） */
const ROAD_HARD_EDGE = LANE_HALF_WIDTH * HD_LANE_COUNT
/** 停止线跨度相对路缘硬边界的比例（居中缩短） */
const STOP_LINE_LENGTH_RATIO = 0.93
const STOP_LINE_HALF_SPAN = ROAD_HARD_EDGE * STOP_LINE_LENGTH_RATIO

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
 * 计算车道中心线相对道路轴线的偏移
 * @param {number} laneIndex
 * @param {number} laneCount
 * @returns {number}
 */
function laneCenterOffset(laneIndex, laneCount) {
  return (laneIndex - (laneCount - 1) / 2) * LANE_HALF_WIDTH * 2
}

/**
 * 是否为最外侧自行车道
 * @param {number} laneIndex
 * @param {number} laneCount
 * @returns {boolean}
 */
function isBicycleLane(laneIndex, laneCount) {
  return laneIndex === 0 || laneIndex === laneCount - 1
}

/**
 * 生成东环路各车道南/北两段面
 */
function dhNsLaneFeatures() {
  return Array.from({ length: HD_LANE_COUNT }, (_, i) => {
    const southbound = i < HD_LANE_COUNT / 2
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
          lane_type: isBicycleLane(i, HD_LANE_COUNT) ? 'bicycle' : 'driving',
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
  return Array.from({ length: HD_LANE_COUNT }, (_, i) => {
    const westbound = i < HD_LANE_COUNT / 2
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
          lane_type: isBicycleLane(i, HD_LANE_COUNT) ? 'bicycle' : 'driving',
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
  const offset = laneCenterOffset(laneIndex, HD_LANE_COUNT)
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
  const offset = laneCenterOffset(laneIndex, HD_LANE_COUNT)
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
    // 创业路（东西向，6 车道 × 西/东两段）
    ...cyEwLaneFeatures(),
    // 东环路（南北向，6 车道 × 南/北两段）
    ...dhNsLaneFeatures(),
  ]
}

/** 自行车道图标沿线路间隔（像素） */
export const BIKE_ICON_SPACING = 200

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
    // 创业路 - 机动车道分隔虚线
    ...cyEwMarkingPair(CY_ROAD_LAT_CENTER - LANE_HALF_WIDTH * 2, {
      marking_type: 'dashed_white',
      direction: 'westbound'
    }),
    ...cyEwMarkingPair(CY_ROAD_LAT_CENTER + LANE_HALF_WIDTH * 2, {
      marking_type: 'dashed_white',
      direction: 'eastbound'
    }),
    // 创业路 - 自行车道与机动车道分隔虚线
    ...cyEwMarkingPair(CY_ROAD_LAT_CENTER - LANE_HALF_WIDTH * 4, {
      marking_type: 'dashed_white',
      direction: 'westbound'
    }),
    ...cyEwMarkingPair(CY_ROAD_LAT_CENTER + LANE_HALF_WIDTH * 4, {
      marking_type: 'dashed_white',
      direction: 'eastbound'
    }),
    // 创业路 - 路缘硬边界（路口截断）
    ...cyEwMarkingPair(CY_ROAD_LAT_CENTER - ROAD_HARD_EDGE, { marking_type: 'solid_white' }),
    ...cyEwMarkingPair(CY_ROAD_LAT_CENTER + ROAD_HARD_EDGE, { marking_type: 'solid_white' }),
    // 东环路 - 中央双黄线（南/北两段截断）
    ...dhNsMarkingPair(INTERSECTION_LNG - LANE_HALF_WIDTH * 0.3, { marking_type: 'double_yellow' }),
    ...dhNsMarkingPair(INTERSECTION_LNG + LANE_HALF_WIDTH * 0.3, { marking_type: 'double_yellow' }),
    // 东环路 - 机动车道分隔虚线
    ...dhNsMarkingPair(INTERSECTION_LNG - LANE_HALF_WIDTH * 2, {
      marking_type: 'dashed_white',
      direction: 'southbound'
    }),
    ...dhNsMarkingPair(INTERSECTION_LNG + LANE_HALF_WIDTH * 2, {
      marking_type: 'dashed_white',
      direction: 'northbound'
    }),
    // 东环路 - 自行车道与机动车道分隔虚线
    ...dhNsMarkingPair(INTERSECTION_LNG - LANE_HALF_WIDTH * 4, {
      marking_type: 'dashed_white',
      direction: 'southbound'
    }),
    ...dhNsMarkingPair(INTERSECTION_LNG + LANE_HALF_WIDTH * 4, {
      marking_type: 'dashed_white',
      direction: 'northbound'
    }),
    // 东环路 - 路缘硬边界（南/北两段）
    ...dhNsMarkingPair(INTERSECTION_LNG - ROAD_HARD_EDGE, { marking_type: 'solid_white' }),
    ...dhNsMarkingPair(INTERSECTION_LNG + ROAD_HARD_EDGE, { marking_type: 'solid_white' })
  ]
}

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
          [INTERSECTION_LNG - ROAD_HARD_EDGE, INTERSECTION_LAT - STOP_LINE_HALF_SPAN],
          [INTERSECTION_LNG - ROAD_HARD_EDGE, INTERSECTION_LAT + STOP_LINE_HALF_SPAN]
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
          [INTERSECTION_LNG + ROAD_HARD_EDGE, INTERSECTION_LAT - STOP_LINE_HALF_SPAN],
          [INTERSECTION_LNG + ROAD_HARD_EDGE, INTERSECTION_LAT + STOP_LINE_HALF_SPAN]
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
          [INTERSECTION_LNG - STOP_LINE_HALF_SPAN, INTERSECTION_LAT - ROAD_HARD_EDGE],
          [INTERSECTION_LNG + STOP_LINE_HALF_SPAN, INTERSECTION_LAT - ROAD_HARD_EDGE]
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
          [INTERSECTION_LNG - STOP_LINE_HALF_SPAN, INTERSECTION_LAT + ROAD_HARD_EDGE],
          [INTERSECTION_LNG + STOP_LINE_HALF_SPAN, INTERSECTION_LAT + ROAD_HARD_EDGE]
        ]
      },
      properties: { road_name: '创业路×东环路', direction: 'southbound', placement: 'hard_boundary' }
    }
  ]
}

/** 人行横道区域深度（自停止线向路口内侧，为默认深度的 1/3） */
const CROSSWALK_DEPTH = (LANE_HALF_WIDTH * 2.5) / 3
/** 人行横道与相邻停止线之间的留白（向路口内侧偏移） */
const CROSSWALK_STOP_LINE_GAP = LANE_HALF_WIDTH / 5
/** 斑马线条纹数量（沿排布方向，越多越密） */
const CROSSWALK_STRIPE_COUNT = 10
/** 条纹短边（排布方向）占间距的比例 */
const CROSSWALK_STRIPE_BAR_RATIO = 0.5 / 3
/** 条纹长边（行人过街方向）占横道宽度的比例 */
const CROSSWALK_STRIPE_BAR_LENGTH_RATIO = 0.42 * 2
/** 路口角落留白，避免两条横道区域重叠 */
const CROSSWALK_CORNER_INSET = CROSSWALK_DEPTH + CROSSWALK_STOP_LINE_GAP
/** 人行横道沿停止线方向的长度比例（居中缩短） */
const CROSSWALK_LENGTH_RATIO = 0.8
const CROSSWALK_HALF_SPAN = ROAD_HARD_EDGE * CROSSWALK_LENGTH_RATIO

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
  const repeatDepth = lngMax - lngMin
  const crossDepth = latMax - latMin
  const pitch = repeatDepth / count
  const barHalfLng = (pitch * CROSSWALK_STRIPE_BAR_RATIO) / 2
  const barHalfLat = (crossDepth / 2) * CROSSWALK_STRIPE_BAR_LENGTH_RATIO
  const cy = (latMin + latMax) / 2
  return Array.from({ length: count }, (_, i) => {
    const lng = lngMin + (i + 0.5) * pitch
    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: crosswalkRect(lng, cy, barHalfLng, barHalfLat) },
      properties: { feature_type: 'stripe', direction }
    }
  })
}

/**
 * 条纹沿纬度方向排布：每条为南北向白条（穿越南北向道路时使用）
 */
function zebraBarsAlongLat(lngMin, lngMax, latMin, latMax, count, direction) {
  const repeatDepth = latMax - latMin
  const crossDepth = lngMax - lngMin
  const pitch = repeatDepth / count
  const barHalfLat = (pitch * CROSSWALK_STRIPE_BAR_RATIO) / 2
  const barHalfLng = (crossDepth / 2) * CROSSWALK_STRIPE_BAR_LENGTH_RATIO
  const cx = (lngMin + lngMax) / 2
  return Array.from({ length: count }, (_, i) => {
    const lat = latMin + (i + 0.5) * pitch
    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: crosswalkRect(cx, lat, barHalfLng, barHalfLat) },
      properties: { feature_type: 'stripe', direction }
    }
  })
}

/** 路口四处人行横道（西/东、南/北进口成对对称），角落内缩避免重叠 */
const HD_CROSSWALK_SPECS = [
  {
    direction: 'westbound',
    bounds: {
      lngMin: INTERSECTION_LNG + ROAD_HARD_EDGE - CROSSWALK_DEPTH - CROSSWALK_STOP_LINE_GAP,
      lngMax: INTERSECTION_LNG + ROAD_HARD_EDGE - CROSSWALK_STOP_LINE_GAP,
      latMin: INTERSECTION_LAT - CROSSWALK_HALF_SPAN,
      latMax: INTERSECTION_LAT + CROSSWALK_HALF_SPAN
    },
    stripes: (b) => zebraBarsAlongLat(
      b.lngMin, b.lngMax, b.latMin, b.latMax, CROSSWALK_STRIPE_COUNT, 'westbound'
    )
  },
  {
    direction: 'eastbound',
    bounds: {
      lngMin: INTERSECTION_LNG - ROAD_HARD_EDGE + CROSSWALK_STOP_LINE_GAP,
      lngMax: INTERSECTION_LNG - ROAD_HARD_EDGE + CROSSWALK_DEPTH + CROSSWALK_STOP_LINE_GAP,
      latMin: INTERSECTION_LAT - CROSSWALK_HALF_SPAN,
      latMax: INTERSECTION_LAT + CROSSWALK_HALF_SPAN
    },
    stripes: (b) => zebraBarsAlongLat(
      b.lngMin, b.lngMax, b.latMin, b.latMax, CROSSWALK_STRIPE_COUNT, 'eastbound'
    )
  },
  {
    direction: 'southbound',
    bounds: {
      lngMin: INTERSECTION_LNG - CROSSWALK_HALF_SPAN,
      lngMax: INTERSECTION_LNG + CROSSWALK_HALF_SPAN - CROSSWALK_CORNER_INSET,
      latMin: INTERSECTION_LAT + ROAD_HARD_EDGE - CROSSWALK_DEPTH - CROSSWALK_STOP_LINE_GAP,
      latMax: INTERSECTION_LAT + ROAD_HARD_EDGE - CROSSWALK_STOP_LINE_GAP
    },
    stripes: (b) => zebraBarsAlongLng(
      b.lngMin, b.lngMax, b.latMin, b.latMax, CROSSWALK_STRIPE_COUNT, 'southbound'
    )
  },
  {
    direction: 'northbound',
    bounds: {
      lngMin: INTERSECTION_LNG - CROSSWALK_HALF_SPAN + CROSSWALK_CORNER_INSET,
      lngMax: INTERSECTION_LNG + CROSSWALK_HALF_SPAN,
      latMin: INTERSECTION_LAT - ROAD_HARD_EDGE + CROSSWALK_STOP_LINE_GAP,
      latMax: INTERSECTION_LAT - ROAD_HARD_EDGE + CROSSWALK_DEPTH + CROSSWALK_STOP_LINE_GAP
    },
    stripes: (b) => zebraBarsAlongLng(
      b.lngMin, b.lngMax, b.latMin, b.latMax, CROSSWALK_STRIPE_COUNT, 'northbound'
    )
  }
]

/** 路口人行横道处数 */
export const HD_CROSSWALK_LOCATION_COUNT = HD_CROSSWALK_SPECS.length

export const MOCK_HD_CROSSWALKS = {
  type: 'FeatureCollection',
  features: HD_CROSSWALK_SPECS.flatMap((spec) => spec.stripes(spec.bounds))
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

/** 行驶方向对应图标旋转角（SVG 默认朝上） */
const TRAVEL_BEARING = {
  east: 90,
  west: 270,
  north: 0,
  south: 180
}

/** 路口进口直行导向图标固定点位（由地图点击标定） */
const CY_STRAIGHT_ICON_POSITIONS = [
  { coordinates: [116.410168, 39.903019], travel: 'east', bearing: TRAVEL_BEARING.east + 180 },
  { coordinates: [116.410174, 39.903051], travel: 'east', bearing: TRAVEL_BEARING.east + 180 },
  { coordinates: [116.410431, 39.903049], travel: 'west', bearing: TRAVEL_BEARING.west },
  { coordinates: [116.410174, 39.902941], travel: 'east' },
  { coordinates: [116.410429, 39.902973], travel: 'west', bearing: TRAVEL_BEARING.west + 180},
  { coordinates: [116.410426, 39.902943], travel: 'west', bearing: TRAVEL_BEARING.west + 180},
  { coordinates: [116.410243, 39.903130], travel: 'south' },
  { coordinates: [116.410322, 39.903125], travel: 'south', bearing: TRAVEL_BEARING.south + 180 },
  { coordinates: [116.410356, 39.902872], travel: 'north' },
  { coordinates: [116.410244, 39.902878], travel: 'north', bearing: TRAVEL_BEARING.north + 180 },
  { coordinates: [116.410277, 39.902874], travel: 'north', bearing: TRAVEL_BEARING.north + 180 },
  { coordinates: [116.410356, 39.903120], travel: 'north' },
]

/** 路口进口直行左转导向图标固定点位（由地图点击标定） */
const LEFT_TURN_ICON_POSITIONS = [
  { coordinates: [116.410430, 39.903013], travel: 'west', bearing: TRAVEL_BEARING.west },
  { coordinates: [116.410170, 39.902978], travel: 'east' },
  { coordinates: [116.410281, 39.903126], travel: 'south' },
  { coordinates: [116.410322, 39.902871], travel: 'north' },
]

/**
 * 生成路口进口导向图标点位（标定经纬度处的直行 / 直行左转图标）
 * @returns {Array}
 */
function buildLaneTurnMarkerFeatures() {
  const straightFeatures = CY_STRAIGHT_ICON_POSITIONS.map((item, index) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: item.coordinates },
    properties: {
      road_name: item.road_name ?? '创业路',
      marker_id: `straight-${index + 1}`,
      turn_type: 'straight',
      bearing: item.bearing ?? TRAVEL_BEARING[item.travel]
    }
  }))

  const leftTurnFeatures = LEFT_TURN_ICON_POSITIONS.map((item, index) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: item.coordinates },
    properties: {
      road_name: item.road_name ?? '创业路',
      marker_id: `left-${index + 1}`,
      turn_type: 'straight_left',
      bearing: item.bearing ?? TRAVEL_BEARING[item.travel]
    }
  }))

  return [...straightFeatures, ...leftTurnFeatures]
}

/** 路口进口车道导向图标 */
export const MOCK_HD_LANE_TURN_MARKERS = {
  type: 'FeatureCollection',
  features: buildLaneTurnMarkerFeatures()
}

/** 路口中央信号灯（图标点位） */
export const MOCK_HD_TRAFFIC_LIGHTS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [...HD_INTERSECTION_CENTER]
      },
      properties: {
        road_name: '创业路×东环路',
        signal_state: 'red'
      }
    }
  ]
}

/**
 * 路口信号灯图标尺寸（随地图缩放线性插值）
 * zoom 14→0.28，16→0.5，18→0.72，20→0.95
 */
export const TRAFFIC_LIGHT_ICON_SIZE = [
  'interpolate',
  ['linear'],
  ['zoom'],
  14, 0.34,
  16, 0.6,
  18, 0.86,
  20, 1.14
]

/**
 * 车道导向图标尺寸（随地图缩放线性插值）
 */
export const LANE_TURN_ICON_SIZE = [
  'interpolate',
  ['linear'],
  ['zoom'],
  14, 0.9,
  16, 1.56,
  18, 2.24,
  20, 2.84
]

/** 高精地图图层 ID 常量 */
export const HD_LAYER_IDS = {
  DRIVING_LANES: 'hd-driving-lanes-fill',
  BICYCLE_LANES: 'hd-bicycle-lanes-fill',
  BICYCLE_ICONS: 'hd-bicycle-icons',
  MARKINGS_SOLID: 'hd-markings-solid',
  MARKINGS_DASHED: 'hd-markings-dashed',
  MARKINGS_DOUBLE: 'hd-markings-double',
  LANE_TURN_MARKERS: 'hd-lane-turn-markers',
  STOP_LINES: 'hd-stop-lines',
  CROSSWALK_STRIPES: 'hd-crosswalk-stripes',
  TRAFFIC_LIGHTS: 'hd-traffic-lights',
  SIGNS: 'hd-signs'
}

export const BIKE_ICON_ID = 'hd-bike-icon'
export const TRAFFIC_LIGHT_ICON_ID = 'hd-traffic-light-icon'
export const LANE_TURN_STRAIGHT_ICON_ID = 'hd-lane-turn-straight-icon'
export const LANE_TURN_LEFT_ICON_ID = 'hd-lane-turn-left-icon'

export const HD_SOURCE_IDS = {
  LANES: 'hd-lanes-source',
  BICYCLE_LANE_LINES: 'hd-bicycle-lane-lines-source',
  MARKINGS: 'hd-markings-source',
  LANE_TURN_MARKERS: 'hd-lane-turn-markers-source',
  STOP_LINES: 'hd-stop-lines-source',
  CROSSWALKS: 'hd-crosswalks-source',
  TRAFFIC_LIGHTS: 'hd-traffic-lights-source',
  SIGNS: 'hd-signs-source'
}
