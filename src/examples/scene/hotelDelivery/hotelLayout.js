import { ZONE_TYPE } from '@/bicMap/core/mapFeatures'

// ─── 配色方案（极浅粉彩系，通透清爽）──────────────────────────────────
// 色彩策略：极浅灰为基底 + 微暖粉彩色调区分功能区；墙体浅灰轻盈
// 各区间通过极微妙的色相/明度差异保持可辨识度
// 标签可读性：所有区域均为浅色基底，统一使用深色标签
const C = {
  corridor:  '#F5F5F5',   // 走廊      — 极浅灰白，最亮层级
  guestRoom: '#FFFDF5',   // 标准客房  — 近乎白，微暖
  suite:     '#FFF8E1',   // 套间      — 极浅米黄
  banquet:   '#FFF3E0',   // 宴会厅    — 极浅杏色
  service:   '#ECEFF1',   // 服务用房  — 浅蓝灰
  lobby:     '#F5EDE0',   // 前台大堂  — 极浅米棕
  amenity:   '#E8F5E9',   // 康乐设施  — 极浅鼠尾草绿
  elevator:  '#E0E0E0',   // 电梯厅    — 浅灰
  elevShaft: '#BDBDBD',   // 电梯轿厢  — 中灰，最深层级
}

const WALL_COLOR = '#CDD0D6'   // 墙体色：浅灰，轻盈通透

const FLOOR_H = 3.0   // 单层层高（m）

// 墙体厚度（分数单位）
const WALL_T      = 0.010
// 地板内缩量（略大于墙厚，保证地板在墙体之内）
const FLOOR_INSET = 0.010
// 门洞宽度（分数单位，约为房间宽的 1/3）
const DOOR_GAP    = 0.030

/**
 * 生成 fill-extrusion 墙体 GeoJSON FeatureCollection
 * 每间房通过 skip 参数选择性生成四面墙，避免相邻房间在共享边界产生双重墙体。
 * @param {string}   activeFloorId - 当前激活楼层 ID（'1F' | '2F'），保留参数以备差异化
 * @param {Function} fracToGPS     - (xFrac, yFrac) => [lng, lat]
 * @returns {Object} GeoJSON FeatureCollection（墙体条形 Feature）
 */
export function buildHotelGeoJSON(activeFloorId, fracToGPS) {
  const t = WALL_T

  function roomWalls(x1, y1, x2, y2, props, skip = {}, doors = {}) {
    function splitWall(ax1, ay1, ax2, ay2, hasDoor) {
      if (!hasDoor) return [[ax1, ay1, ax2, ay2]]
      const isHoriz = (ay2 - ay1) < (ax2 - ax1)
      if (isHoriz) {
        const mid  = (ax1 + ax2) / 2
        const half = DOOR_GAP / 2
        return [
          [ax1,        ay1, mid - half, ay2],
          [mid + half, ay1, ax2,        ay2],
        ]
      } else {
        const mid  = (ay1 + ay2) / 2
        const half = DOOR_GAP / 2
        return [
          [ax1, ay1,        ax2, mid - half],
          [ax1, mid + half, ax2, ay2       ],
        ]
      }
    }

    const segs = []
    if (!skip.S) splitWall(x1,     y1,     x2,     y1 + t, !!doors.S).forEach(s => segs.push(s))
    if (!skip.N) splitWall(x1,     y2 - t, x2,     y2,     !!doors.N).forEach(s => segs.push(s))
    if (!skip.W) splitWall(x1,     y1,     x1 + t, y2,     !!doors.W).forEach(s => segs.push(s))
    if (!skip.E) splitWall(x2 - t, y1,     x2,     y2,     !!doors.E).forEach(s => segs.push(s))

    return segs.map(([ax1, ay1, ax2, ay2]) => ({
      type: 'Feature',
      properties: { ...props, color: WALL_COLOR },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          fracToGPS(ax1, ay1),
          fracToGPS(ax2, ay1),
          fracToGPS(ax2, ay2),
          fracToGPS(ax1, ay2),
          fracToGPS(ax1, ay1),
        ]]
      }
    }))
  }

  const rooms = (activeFloorId === '2F' ? [
    { x1: 0.10, y1: 0.44, x2: 0.96, y2: 0.56, props: { name: '主走廊', height: FLOOR_H, base_height: 0 }, skip: { N: true, S: true, W: true } },
    { x1: 0.10, y1: 0.56, x2: 0.28, y2: 0.96, props: { name: '209 号房', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { S: true } },
    { x1: 0.28, y1: 0.56, x2: 0.37, y2: 0.96, props: { name: '210 号房', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { S: true } },
    { x1: 0.37, y1: 0.56, x2: 0.46, y2: 0.96, props: { name: '211 号房', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { S: true } },
    { x1: 0.46, y1: 0.56, x2: 0.60, y2: 0.96, props: { name: '电梯厅', height: FLOOR_H, base_height: 0 }, skip: { S: true, E: true } },
    { x1: 0.46, y1: 0.83, x2: 0.53, y2: 0.96, props: { name: '电梯', height: FLOOR_H, base_height: 0 }, skip: { N: true, W: true } },
    { x1: 0.60, y1: 0.56, x2: 0.69, y2: 0.96, props: { name: '212 号房', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { S: true } },
    { x1: 0.69, y1: 0.56, x2: 0.78, y2: 0.96, props: { name: '213 号房', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { S: true } },
    { x1: 0.78, y1: 0.56, x2: 0.87, y2: 0.96, props: { name: '214 号房', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { S: true } },
    { x1: 0.87, y1: 0.56, x2: 0.96, y2: 0.96, props: { name: '215 号房', height: FLOOR_H, base_height: 0 }, doors: { S: true } },
    { x1: 0.10, y1: 0.08, x2: 0.28, y2: 0.44, props: { name: '201 号房', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { N: true } },
    { x1: 0.28, y1: 0.08, x2: 0.37, y2: 0.44, props: { name: '202 号房', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { N: true } },
    { x1: 0.37, y1: 0.08, x2: 0.46, y2: 0.44, props: { name: '203 号房', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { N: true } },
    { x1: 0.46, y1: 0.08, x2: 0.64, y2: 0.44, props: { name: '204 商务套间', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { N: true } },
    { x1: 0.64, y1: 0.08, x2: 0.82, y2: 0.44, props: { name: '205 豪华套间', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { N: true } },
    { x1: 0.82, y1: 0.08, x2: 0.96, y2: 0.44, props: { name: '206 号房', height: FLOOR_H, base_height: 0 }, doors: { N: true } },
  ] : [
    { x1: 0.10, y1: 0.44, x2: 0.96, y2: 0.56, props: { name: '主走廊', height: FLOOR_H, base_height: 0 }, skip: { N: true, S: true, W: true } },
    { x1: 0.10, y1: 0.56, x2: 0.28, y2: 0.96, props: { name: '服务间', height: FLOOR_H, base_height: 0 }, skip: { E: true } },
    { x1: 0.28, y1: 0.56, x2: 0.37, y2: 0.96, props: { name: '107 号房', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { S: true } },
    { x1: 0.37, y1: 0.56, x2: 0.46, y2: 0.96, props: { name: '108 号房', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { S: true } },
    { x1: 0.46, y1: 0.56, x2: 0.60, y2: 0.96, props: { name: '电梯厅', height: FLOOR_H, base_height: 0 }, skip: { S: true, E: true } },
    { x1: 0.46, y1: 0.83, x2: 0.53, y2: 0.96, props: { name: '电梯', height: FLOOR_H, base_height: 0 }, skip: { N: true, W: true } },
    { x1: 0.60, y1: 0.56, x2: 0.69, y2: 0.96, props: { name: '109 号房', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { S: true } },
    { x1: 0.69, y1: 0.56, x2: 0.78, y2: 0.96, props: { name: '110 号房', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { S: true } },
    { x1: 0.78, y1: 0.56, x2: 0.87, y2: 0.96, props: { name: '111 号房', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { S: true } },
    { x1: 0.87, y1: 0.56, x2: 0.96, y2: 0.96, props: { name: '112 号房', height: FLOOR_H, base_height: 0 }, doors: { S: true } },
    { x1: 0.10, y1: 0.08, x2: 0.28, y2: 0.44, props: { name: '前台大堂', height: FLOOR_H, base_height: 0 }, skip: { N: true, E: true } },
    { x1: 0.28, y1: 0.08, x2: 0.37, y2: 0.44, props: { name: '101 号房', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { N: true } },
    { x1: 0.37, y1: 0.08, x2: 0.46, y2: 0.44, props: { name: '102 号房', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { N: true } },
    { x1: 0.46, y1: 0.08, x2: 0.64, y2: 0.44, props: { name: '103 商务套间', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { N: true } },
    { x1: 0.64, y1: 0.08, x2: 0.82, y2: 0.44, props: { name: '104 豪华套间', height: FLOOR_H, base_height: 0 }, skip: { E: true }, doors: { N: true } },
    { x1: 0.82, y1: 0.08, x2: 0.87, y2: 0.44, props: { name: '过道', height: FLOOR_H, base_height: 0 }, skip: { N: true, E: true } },
    { x1: 0.87, y1: 0.26, x2: 0.96, y2: 0.44, props: { name: '健身中心', height: FLOOR_H, base_height: 0 }, doors: { W: true } },
    { x1: 0.87, y1: 0.08, x2: 0.96, y2: 0.26, props: { name: '洗衣房', height: FLOOR_H, base_height: 0 }, skip: { N: true }, doors: { W: true } },
  ])

  return {
    type: 'FeatureCollection',
    features: rooms.flatMap(r => roomWalls(r.x1, r.y1, r.x2, r.y2, r.props, r.skip || {}, r.doors || {}))
  }
}

/**
 * 生成平面地板 GeoJSON FeatureCollection（用于 fill 图层，展示房间颜色）
 * @param {Function} fracToGPS - (xFrac, yFrac) => [lng, lat]
 * @param {string}   [floorId='1F'] - 当前楼层 ID
 * @returns {Object} GeoJSON FeatureCollection
 */
export function buildHotelFloorsGeoJSON(fracToGPS, floorId = '1F') {
  const i = FLOOR_INSET

  function floor(x1, y1, x2, y2, color, name, label = name) {
    return {
      type: 'Feature',
      properties: { color, name, label },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          fracToGPS(x1 + i, y1 + i),
          fracToGPS(x2 - i, y1 + i),
          fracToGPS(x2 - i, y2 - i),
          fracToGPS(x1 + i, y2 - i),
          fracToGPS(x1 + i, y1 + i),
        ]]
      }
    }
  }

  const floors2F = [
    { x1: 0.10, y1: 0.44, x2: 0.96, y2: 0.56, color: C.corridor, name: '主走廊' },
    { x1: 0.10, y1: 0.56, x2: 0.28, y2: 0.96, color: C.guestRoom, name: '209 号房', label: '209号房' },
    { x1: 0.28, y1: 0.56, x2: 0.37, y2: 0.96, color: C.guestRoom, name: '210 号房', label: '210号房' },
    { x1: 0.37, y1: 0.56, x2: 0.46, y2: 0.96, color: C.guestRoom, name: '211 号房', label: '211号房' },
    { x1: 0.46, y1: 0.56, x2: 0.60, y2: 0.96, color: C.elevator, name: '电梯厅' },
    { x1: 0.46, y1: 0.83, x2: 0.53, y2: 0.96, color: C.elevShaft, name: '电梯' },
    { x1: 0.60, y1: 0.56, x2: 0.69, y2: 0.96, color: C.guestRoom, name: '212 号房', label: '212号房' },
    { x1: 0.69, y1: 0.56, x2: 0.78, y2: 0.96, color: C.guestRoom, name: '213 号房', label: '213号房' },
    { x1: 0.78, y1: 0.56, x2: 0.87, y2: 0.96, color: C.guestRoom, name: '214 号房', label: '214号房' },
    { x1: 0.87, y1: 0.56, x2: 0.96, y2: 0.96, color: C.guestRoom, name: '215 号房', label: '215号房' },
    { x1: 0.10, y1: 0.08, x2: 0.28, y2: 0.44, color: C.guestRoom, name: '201 号房', label: '201号房' },
    { x1: 0.28, y1: 0.08, x2: 0.37, y2: 0.44, color: C.guestRoom, name: '202 号房', label: '202号房' },
    { x1: 0.37, y1: 0.08, x2: 0.46, y2: 0.44, color: C.guestRoom, name: '203 号房', label: '203号房' },
    { x1: 0.46, y1: 0.08, x2: 0.64, y2: 0.44, color: C.suite, name: '204 商务套间', label: '204商务套间' },
    { x1: 0.64, y1: 0.08, x2: 0.82, y2: 0.44, color: C.suite, name: '205 豪华套间', label: '205豪华套间' },
    { x1: 0.82, y1: 0.08, x2: 0.96, y2: 0.44, color: C.guestRoom, name: '206 号房', label: '206号房' },
  ]

  const floors1F = [
    { x1: 0.10, y1: 0.44, x2: 0.96, y2: 0.56, color: C.corridor, name: '主走廊' },
    { x1: 0.10, y1: 0.56, x2: 0.28, y2: 0.96, color: C.service, name: '服务间' },
    { x1: 0.28, y1: 0.56, x2: 0.37, y2: 0.96, color: C.guestRoom, name: '107 号房', label: '107号房' },
    { x1: 0.37, y1: 0.56, x2: 0.46, y2: 0.96, color: C.guestRoom, name: '108 号房', label: '108号房' },
    { x1: 0.46, y1: 0.56, x2: 0.60, y2: 0.96, color: C.elevator, name: '电梯厅' },
    { x1: 0.46, y1: 0.83, x2: 0.53, y2: 0.96, color: C.elevShaft, name: '电梯' },
    { x1: 0.60, y1: 0.56, x2: 0.69, y2: 0.96, color: C.guestRoom, name: '109 号房', label: '109号房' },
    { x1: 0.69, y1: 0.56, x2: 0.78, y2: 0.96, color: C.guestRoom, name: '110 号房', label: '110号房' },
    { x1: 0.78, y1: 0.56, x2: 0.87, y2: 0.96, color: C.guestRoom, name: '111 号房', label: '111号房' },
    { x1: 0.87, y1: 0.56, x2: 0.96, y2: 0.96, color: C.guestRoom, name: '112 号房', label: '112号房' },
    { x1: 0.10, y1: 0.08, x2: 0.28, y2: 0.44, color: C.lobby, name: '前台大堂' },
    { x1: 0.28, y1: 0.08, x2: 0.37, y2: 0.44, color: C.guestRoom, name: '101 号房', label: '101号房' },
    { x1: 0.37, y1: 0.08, x2: 0.46, y2: 0.44, color: C.guestRoom, name: '102 号房', label: '102号房' },
    { x1: 0.46, y1: 0.08, x2: 0.64, y2: 0.44, color: C.suite, name: '103 商务套间', label: '103商务套间' },
    { x1: 0.64, y1: 0.08, x2: 0.82, y2: 0.44, color: C.suite, name: '104 豪华套间', label: '104豪华套间' },
    { x1: 0.82, y1: 0.08, x2: 0.87, y2: 0.44, color: C.corridor, name: '过道' },
    { x1: 0.87, y1: 0.26, x2: 0.96, y2: 0.44, color: C.amenity, name: '健身中心' },
    { x1: 0.87, y1: 0.08, x2: 0.96, y2: 0.26, color: C.service, name: '洗衣房' },
  ]

  const selected = floorId === '2F' ? floors2F : floors1F

  if (floorId === '2F') {
    return {
      type: 'FeatureCollection',
      features: selected.map(r => floor(r.x1, r.y1, r.x2, r.y2, r.color, r.name, r.label))
    }
  }

  return {
    type: 'FeatureCollection',
    features: [
      ...selected.map(r => floor(r.x1, r.y1, r.x2, r.y2, r.color, r.name, r.label)),
      { type: 'Feature', properties: { label: '机器人待机区' }, geometry: { type: 'Point', coordinates: fracToGPS(0.135, 0.29) } }
    ]
  }
}

/**
 * 生成房间名称标注点 GeoJSON（Point，置于各房间中心）
 * 用于 MapLibre symbol 图层显示房间名称。
 * @param {Function} fracToGPS  - (xFrac, yFrac) => [lng, lat]
 * @param {string}   [floorId='1F'] - 当前楼层 ID
 * @returns {Object} GeoJSON FeatureCollection（Point Feature）
 */
export function buildHotelRoomLabelsGeoJSON(fracToGPS, floorId = '1F') {
  const rooms = floorId === '2F'
    ? [
        // 走廊
        { x1: 0.10, y1: 0.44, x2: 0.96, y2: 0.56, name: '主走廊' },
        // 北侧
        { x1: 0.10, y1: 0.56, x2: 0.28, y2: 0.96, name: '209号房' },
        { x1: 0.28, y1: 0.56, x2: 0.37, y2: 0.96, name: '210号房' },
        { x1: 0.37, y1: 0.56, x2: 0.46, y2: 0.96, name: '211号房' },
        { x1: 0.46, y1: 0.56, x2: 0.60, y2: 0.96, name: '电梯厅' },
        { x1: 0.46, y1: 0.83, x2: 0.53, y2: 0.96, name: '电梯' },
        { x1: 0.60, y1: 0.56, x2: 0.69, y2: 0.96, name: '212号房' },
        { x1: 0.69, y1: 0.56, x2: 0.78, y2: 0.96, name: '213号房' },
        { x1: 0.78, y1: 0.56, x2: 0.87, y2: 0.96, name: '214号房' },
        { x1: 0.87, y1: 0.56, x2: 0.96, y2: 0.96, name: '215号房' },
        // 南侧
        { x1: 0.10, y1: 0.08, x2: 0.28, y2: 0.44, name: '201号房' },
        { x1: 0.28, y1: 0.08, x2: 0.37, y2: 0.44, name: '202号房' },
        { x1: 0.37, y1: 0.08, x2: 0.46, y2: 0.44, name: '203号房' },
        { x1: 0.46, y1: 0.08, x2: 0.64, y2: 0.44, name: '204商务套间' },
        { x1: 0.64, y1: 0.08, x2: 0.82, y2: 0.44, name: '205豪华套间' },
        { x1: 0.82, y1: 0.08, x2: 0.96, y2: 0.44, name: '206号房' },
      ]
    : [
        // 走廊（合并为全宽）
        { x1: 0.10, y1: 0.44, x2: 0.96, y2: 0.56, name: '主走廊' },
        // 北侧
        { x1: 0.10, y1: 0.56, x2: 0.28, y2: 0.96, name: '服务间' },
        { x1: 0.28, y1: 0.56, x2: 0.37, y2: 0.96, name: '107号房' },
        { x1: 0.37, y1: 0.56, x2: 0.46, y2: 0.96, name: '108号房' },
        { x1: 0.46, y1: 0.56, x2: 0.60, y2: 0.96, name: '电梯厅' },
        { x1: 0.46, y1: 0.83, x2: 0.53, y2: 0.96, name: '电梯' },
        { x1: 0.60, y1: 0.56, x2: 0.69, y2: 0.96, name: '109号房' },
        { x1: 0.69, y1: 0.56, x2: 0.78, y2: 0.96, name: '110号房' },
        { x1: 0.78, y1: 0.56, x2: 0.87, y2: 0.96, name: '111号房' },
        { x1: 0.87, y1: 0.56, x2: 0.96, y2: 0.96, name: '112号房' },
        // 南侧
        { x1: 0.10, y1: 0.08, x2: 0.28, y2: 0.44, name: '前台大堂' },
        { x1: 0.10, y1: 0.19, x2: 0.17, y2: 0.39, name: '机器人待机区' },
        { x1: 0.28, y1: 0.08, x2: 0.37, y2: 0.44, name: '101号房' },
        { x1: 0.37, y1: 0.08, x2: 0.46, y2: 0.44, name: '102号房' },
        { x1: 0.46, y1: 0.08, x2: 0.64, y2: 0.44, name: '103商务套间' },
        { x1: 0.64, y1: 0.08, x2: 0.82, y2: 0.44, name: '104豪华套间' },
        { x1: 0.82, y1: 0.08, x2: 0.87, y2: 0.44, name: '过道' },
        { x1: 0.87, y1: 0.26, x2: 0.96, y2: 0.44, name: '健身中心' },
        { x1: 0.87, y1: 0.08, x2: 0.96, y2: 0.26, name: '洗衣房' },
      ]

  return {
    type: 'FeatureCollection',
    features: rooms.map(r => ({
      type: 'Feature',
      properties: { label: r.name },
      geometry: {
        type: 'Point',
        coordinates: fracToGPS((r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2)
      }
    }))
  }
}

/**
 * 生成酒店楼层语义区域数组
 * @param {Function} fracToGPS  - (xFrac, yFrac) => [lng, lat]
 * @param {string}   [floorId='1F'] - 当前楼层 ID
 * @returns {Array} 语义区域配置数组
 */
export function buildHotelZones(fracToGPS, floorId = '1F') {
  const s = 0.010

  const zones = (floorId === '2F' ? [
    { type: ZONE_TYPE.SERVICE_AREA, id: 'zone-corridor', name: '主走廊', x1: 0.10, y1: 0.44, x2: 0.96, y2: 0.56 },
    { type: ZONE_TYPE.ELEVATOR, id: 'zone-elevator', name: '电梯厅', x1: 0.46, y1: 0.56, x2: 0.60, y2: 0.96, inset: true },
    { type: ZONE_TYPE.ELEVATOR, id: 'zone-elevator-shaft', name: '电梯', x1: 0.46, y1: 0.83, x2: 0.53, y2: 0.96, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-209', name: '209号房', x1: 0.10, y1: 0.56, x2: 0.28, y2: 0.96, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-210', name: '210号房', x1: 0.28, y1: 0.56, x2: 0.37, y2: 0.96, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-211', name: '211号房', x1: 0.37, y1: 0.56, x2: 0.46, y2: 0.96, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-212', name: '212号房', x1: 0.60, y1: 0.56, x2: 0.69, y2: 0.96, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-213', name: '213号房', x1: 0.69, y1: 0.56, x2: 0.78, y2: 0.96, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-214', name: '214号房', x1: 0.78, y1: 0.56, x2: 0.87, y2: 0.96, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-215', name: '215号房', x1: 0.87, y1: 0.56, x2: 0.96, y2: 0.96, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-201', name: '201号房', x1: 0.10, y1: 0.08, x2: 0.28, y2: 0.44, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-202', name: '202号房', x1: 0.28, y1: 0.08, x2: 0.37, y2: 0.44, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-203', name: '203号房', x1: 0.37, y1: 0.08, x2: 0.46, y2: 0.44, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-204', name: '204商务套间', x1: 0.46, y1: 0.08, x2: 0.64, y2: 0.44, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-205', name: '205豪华套间', x1: 0.64, y1: 0.08, x2: 0.82, y2: 0.44, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-206', name: '206号房', x1: 0.82, y1: 0.08, x2: 0.96, y2: 0.44, inset: true },
  ] : [
    { type: ZONE_TYPE.WAITING, id: 'zone-lobby', name: '前台大堂', x1: 0.10, y1: 0.08, x2: 0.28, y2: 0.44, inset: true },
    { type: ZONE_TYPE.CHARGING, id: 'zone-standby', name: '机器人待机区', x1: 0.10, y1: 0.19, x2: 0.17, y2: 0.39, inset: true },
    { type: ZONE_TYPE.ELEVATOR, id: 'zone-elevator', name: '电梯厅', x1: 0.46, y1: 0.56, x2: 0.60, y2: 0.96, inset: true },
    { type: ZONE_TYPE.ELEVATOR, id: 'zone-elevator-shaft', name: '电梯', x1: 0.46, y1: 0.83, x2: 0.53, y2: 0.96, inset: true },
    { type: ZONE_TYPE.FORBIDDEN, id: 'zone-service', name: '服务间', x1: 0.10, y1: 0.56, x2: 0.28, y2: 0.96, inset: true },
    { type: ZONE_TYPE.SERVICE_AREA, id: 'zone-corridor', name: '主走廊', x1: 0.10, y1: 0.44, x2: 0.96, y2: 0.56 },
    { type: ZONE_TYPE.WAITING, id: 'zone-107', name: '107号房', x1: 0.28, y1: 0.56, x2: 0.37, y2: 0.96, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-108', name: '108号房', x1: 0.37, y1: 0.56, x2: 0.46, y2: 0.96, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-109', name: '109号房', x1: 0.60, y1: 0.56, x2: 0.69, y2: 0.96, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-110', name: '110号房', x1: 0.69, y1: 0.56, x2: 0.78, y2: 0.96, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-111', name: '111号房', x1: 0.78, y1: 0.56, x2: 0.87, y2: 0.96, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-112', name: '112号房', x1: 0.87, y1: 0.56, x2: 0.96, y2: 0.96, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-101', name: '101号房', x1: 0.28, y1: 0.08, x2: 0.37, y2: 0.44, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-102', name: '102号房', x1: 0.37, y1: 0.08, x2: 0.46, y2: 0.44, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-103', name: '103商务套间', x1: 0.46, y1: 0.08, x2: 0.64, y2: 0.44, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-104', name: '104豪华套间', x1: 0.64, y1: 0.08, x2: 0.82, y2: 0.44, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-fitness', name: '健身中心', x1: 0.87, y1: 0.26, x2: 0.96, y2: 0.44, inset: true },
    { type: ZONE_TYPE.WAITING, id: 'zone-laundry', name: '洗衣房', x1: 0.87, y1: 0.08, x2: 0.96, y2: 0.26, inset: true },
    { type: ZONE_TYPE.SERVICE_AREA, id: 'zone-passage', name: '过道', x1: 0.82, y1: 0.08, x2: 0.87, y2: 0.44 },
  ])

  return zones.map(z => ({
    type: z.type,
    id: z.id,
    name: z.name,
    points: [
      fracToGPS(z.x1 + (z.inset ? s : 0), z.y1 + (z.inset ? s : 0)),
      fracToGPS(z.x2 - (z.inset ? s : 0), z.y1 + (z.inset ? s : 0)),
      fracToGPS(z.x2 - (z.inset ? s : 0), z.y2 - (z.inset ? s : 0)),
      fracToGPS(z.x1 + (z.inset ? s : 0), z.y2 - (z.inset ? s : 0)),
    ]
  }))
}
