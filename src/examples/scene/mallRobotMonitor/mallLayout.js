import { ZONE_TYPE } from '@/examples/utils/map'

// 百度地图POI类型配色方案（浅色版）
const C = {
  // 餐饮类 - 淡黄色
  food: '#FFF4D9ff',
  // 购物类 - 淡紫色
  shopping: '#E6D9F0ff',
  // 娱乐类 - 淡紫色
  entertainment: '#E6D9F0ff',
  // 生活服务 - 淡紫色
  service: '#E6D9F0ff',
  // 卫生间 - 淡蓝色
  wc: '#85d1feff',
  // 休息区 - 淡紫色
  restZone: '#E6D9F0ff',
  // 机器人待机区 - 淡紫色
  robotZone: '#E6D9F0ff',
}

function rectCorners(x1, y1, x2, y2) {
  return [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]
}

function buildEllipsePoints(cx, cy, rx, ry, segments) {
  segments = segments || 32
  const pts = []
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    pts.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)])
  }
  pts.push(pts[0])
  return pts
}

function buildLShapePolygon(x, y, w, h, cutRatioX, cutRatioY) {
  const cx = cutRatioX * w
  const cy = cutRatioY * h
  return [
    [x, y],
    [x + w, y],
    [x + w, y + cy],
    [x + cx, y + cy],
    [x + cx, y + h],
    [x, y + h],
    [x, y],
  ]
}

function buildTShapePolygon(x, y, barW, barH, stemW, stemH) {
  const stemLeft = x + (barW - stemW) / 2
  const stemRight = stemLeft + stemW
  return [
    [x, y],
    [x + barW, y],
    [x + barW, y + barH],
    [stemRight, y + barH],
    [stemRight, y + barH + stemH],
    [stemLeft, y + barH + stemH],
    [stemLeft, y + barH],
    [x, y + barH],
    [x, y],
  ]
}

export const SHOPS = [
  // ── 左列（x=0.05–0.19）──────────────────────────────────────────────────
  // 间距统一 0.03，高度 0.10→0.09（顶部小店 0.05→0.04），国际名品馆 L 形保持 0.11
  { id: 'sicis', name: '智能数码馆', color: C.shopping, icon: 'icon-shopping',
    polygon: rectCorners(0.05, -0.045, 0.19, 0.045) },
  { id: 'ligneroset', name: '美妆集合店', color: C.shopping, icon: 'icon-shopping',
    polygon: rectCorners(0.05, 0.075, 0.19, 0.165) },
  { id: 'rugiano', name: '休闲书吧', color: C.entertainment, icon: 'icon-book',
    polygon: rectCorners(0.05, 0.195, 0.19, 0.285) },
  { id: 'chiwinglo', name: '品牌咖啡馆', color: C.food, icon: 'icon-food',
    polygon: rectCorners(0.05, 0.315, 0.19, 0.405) },
  { id: 'wc-left', name: '卫生间', color: C.wc, icon: 'icon-restroom',
    polygon: rectCorners(0.05, 0.4175, 0.12, 0.4675) },
  { id: 'hulsta', name: '儿童游乐场', color: C.entertainment, icon: 'icon-entertainment',
    polygon: rectCorners(0.05, 0.48, 0.19, 0.57) },
  { id: 'chubbsafes', name: '珠宝首饰馆', color: C.shopping, icon: 'icon-shopping',
    polygon: rectCorners(0.05, 0.60, 0.19, 0.69) },
  { id: 'casadesus', name: '潮流服饰店', color: C.shopping, icon: 'icon-shopping',
    polygon: rectCorners(0.05, 0.72, 0.19, 0.81) },
  { id: 'ra', name: '国际名品馆', color: C.shopping, icon: 'icon-shopping',
    polygon: buildLShapePolygon(0.05, 0.84, 0.14, 0.11, 0.5, 0.55) },

  // ── 中列（x=0.22–0.37，整体右移 0.01 使列间距达 0.03）───────────────────
  // 间距 0.03，高度 0.10→0.09（顶部小店 0.05→0.04），数码体验中心 0.11 不变
  { id: 'visionnaire', name: '家用电器馆', color: C.shopping, icon: 'icon-shopping',
    polygon: rectCorners(0.22, -0.045, 0.37, 0.045) },
  { id: 'thomasville', name: '电玩娱乐城', color: C.entertainment, icon: 'icon-entertainment',
    polygon: rectCorners(0.22, 0.075, 0.37, 0.165) },
  { id: 'theshouter', name: '潮玩手办店', color: C.entertainment, icon: 'icon-entertainment',
    polygon: rectCorners(0.22, 0.195, 0.37, 0.285) },
  { id: 'smania', name: '母婴生活馆', color: C.shopping, icon: 'icon-shopping',
    polygon: buildLShapePolygon(0.22, 0.315, 0.15, 0.09, 0.6, 0.5) },
  { id: 'gessi', name: '运动户外馆', color: C.shopping, icon: 'icon-shopping',
    polygon: rectCorners(0.22, 0.48, 0.37, 0.57) },
  { id: 'visping', name: '火锅料理馆', color: C.food, icon: 'icon-food',
    polygon: rectCorners(0.22, 0.60, 0.37, 0.69) },
  { id: 'smeg', name: '特色小吃街', color: C.food, icon: 'icon-food',
    polygon: buildLShapePolygon(0.22, 0.72, 0.15, 0.09, 0.55, 0.5) },
  { id: 'feimei', name: '数码体验中心', color: C.shopping, icon: 'icon-shopping',
    polygon: rectCorners(0.22, 0.84, 0.37, 0.95) },

  // ── 影院上方新行：品牌眼镜店 + 鲜花礼品店（对齐影院 x=0.64–0.95）───────
  { id: 'desede', name: '品牌眼镜店', color: C.shopping, icon: 'icon-shopping',
    polygon: rectCorners(0.64, 0.315, 0.78, 0.405) },
  { id: 'londonart', name: '鲜花礼品店', color: C.shopping, icon: 'icon-shopping',
    polygon: rectCorners(0.81, 0.315, 0.95, 0.405) },

  // ── 右区（x=0.64–0.95）────────────────────────────────────────────────
  // 列间距：左子列 x=0.64–0.79，右子列 x=0.82–0.95（间距 0.03）
  // 行间距 0.03，高度 0.10→0.09；品牌钟表馆/黄金珠宝馆底行保持 0.11
  { id: '73space', name: '大型综合超市', color: C.shopping, icon: 'icon-supermarket',
    polygon: rectCorners(0.64, -0.045, 0.95, 0.285) },
  { id: 'lidea', name: '巨幕电影院', color: C.entertainment, icon: 'icon-movie',
    polygon: rectCorners(0.64, 0.48, 0.95, 0.57) },
  { id: 'wc-right', name: '卫生间', color: C.wc, icon: 'icon-restroom',
    polygon: rectCorners(0.88, 0.4175, 0.95, 0.4675) },
  { id: 'swissflex', name: '日式料理店', color: C.food, icon: 'icon-food',
    polygon: buildTShapePolygon(0.64, 0.60, 0.15, 0.038, 0.0825, 0.052) },
  { id: 'rochebobois', name: '健身运动中心', color: C.entertainment, icon: 'icon-sport',
    polygon: rectCorners(0.82, 0.60, 0.95, 0.81) },
  { id: 'stressless', name: '烘焙甜品坊', color: C.food, icon: 'icon-food',
    polygon: rectCorners(0.64, 0.72, 0.79, 0.81) },
  { id: 'huangshi', name: '品牌钟表馆', color: C.shopping, icon: 'icon-watch',
    polygon: rectCorners(0.64, 0.84, 0.79, 0.95) },
  { id: 'benjamin', name: '黄金珠宝馆', color: C.shopping, icon: 'icon-shopping',
    polygon: rectCorners(0.82, 0.84, 0.95, 0.95) },

  // ── 中央中庭内部功能区（从北到南，左右对称）─────────────────────────
  { id: 'atrium-rest', name: '休息区', color: C.restZone, icon: 'icon-rest',
    polygon: rectCorners(0.44, 0.64, 0.56, 0.74) },
  { id: 'atrium-robot', name: '机器人待机区', color: C.robotZone, icon: 'icon-robot-standby',
    polygon: rectCorners(0.42, 0.44, 0.58, 0.62) },
  { id: 'atrium-service', name: '服务台', color: C.service, icon: 'icon-service-center',
    polygon: rectCorners(0.44, 0.26, 0.56, 0.41) },
]

// ─────────────────────────────────────────────────────────────────────────────
// B1 停车场配色（百度地图室内停车场标准配色）
// ─────────────────────────────────────────────────────────────────────────────
const P = {
  parkingSpace:    '#E8F4F8', // 普通停车位 - 淡青色
  driveLane:       '#F5F5F5', // 行车通道   - 浅灰色
  evCharging:      '#D7F1D7', // 充电区     - 淡绿色
  disabledParking: '#DDE9F7', // 无障碍车位 - 淡蓝色
  entrance:        '#FEF3E2', // 出入口坡道 - 淡橙色
  elevator:        '#E8EAF6', // 电梯厅     - 淡靛色
  fireLane:        '#FDECEA', // 消防通道   - 淡红色
}

// B1 停车场区域（分数坐标 0-1，基于整体 SLAM 地图空间）
// 布局：上方出入口区 → 中部左中右三列停车区（行车通道分隔）→ 下方功能区
export const PARKING_ZONES = [
  // ── 出入口坡道（顶部两端）──────────────────────────────────────────────────
  { id: 'b1-exit-ramp',  name: '出口坡道', color: P.entrance, icon: 'icon-entrance',
    polygon: rectCorners(0.05, 0.00, 0.18, 0.08) },
  { id: 'b1-entry-ramp', name: '入口坡道', color: P.entrance, icon: 'icon-entrance',
    polygon: rectCorners(0.82, 0.00, 0.95, 0.08) },

  // ── 顶部主行车通道（横向）───────────────────────────────────────────────────
  { id: 'b1-lane-top', name: '行车通道', color: P.driveLane, icon: 'icon-entrance',
    polygon: rectCorners(0.18, 0.00, 0.82, 0.08) },

  // ── 左列停车区（x=0.05–0.21）────────────────────────────────────────────────
  { id: 'b1-park-a1', name: '停车区 A', color: P.parkingSpace, icon: 'icon-parking',
    polygon: rectCorners(0.05, 0.10, 0.21, 0.30) },
  { id: 'b1-park-a2', name: '停车区 B', color: P.parkingSpace, icon: 'icon-parking',
    polygon: rectCorners(0.05, 0.34, 0.21, 0.54) },
  { id: 'b1-park-a3', name: '停车区 C', color: P.parkingSpace, icon: 'icon-parking',
    polygon: rectCorners(0.05, 0.58, 0.21, 0.78) },

  // ── 左纵向行车通道（x=0.22–0.28）────────────────────────────────────────────
  { id: 'b1-lane-left', name: '行车通道', color: P.driveLane, icon: 'icon-entrance',
    polygon: rectCorners(0.22, 0.08, 0.28, 0.85) },

  // ── 中左列停车区（x=0.29–0.46）──────────────────────────────────────────────
  { id: 'b1-park-b1', name: '停车区 D', color: P.parkingSpace, icon: 'icon-parking',
    polygon: rectCorners(0.29, 0.10, 0.46, 0.30) },
  { id: 'b1-park-b2', name: '停车区 E', color: P.parkingSpace, icon: 'icon-parking',
    polygon: rectCorners(0.29, 0.34, 0.46, 0.54) },
  { id: 'b1-park-b3', name: '停车区 F', color: P.parkingSpace, icon: 'icon-parking',
    polygon: rectCorners(0.29, 0.58, 0.46, 0.78) },

  // ── 中央纵向行车通道（x=0.47–0.53）─────────────────────────────────────────
  { id: 'b1-lane-center', name: '行车通道', color: P.driveLane, icon: 'icon-entrance',
    polygon: rectCorners(0.47, 0.08, 0.53, 0.85) },

  // ── 中右列停车区（x=0.54–0.71）──────────────────────────────────────────────
  { id: 'b1-park-c1', name: '停车区 G', color: P.parkingSpace, icon: 'icon-parking',
    polygon: rectCorners(0.54, 0.10, 0.71, 0.30) },
  { id: 'b1-park-c2', name: '停车区 H', color: P.parkingSpace, icon: 'icon-parking',
    polygon: rectCorners(0.54, 0.34, 0.71, 0.54) },
  { id: 'b1-park-c3', name: '停车区 I', color: P.parkingSpace, icon: 'icon-parking',
    polygon: rectCorners(0.54, 0.58, 0.71, 0.78) },

  // ── 右纵向行车通道（x=0.72–0.78）────────────────────────────────────────────
  { id: 'b1-lane-right', name: '行车通道', color: P.driveLane, icon: 'icon-entrance',
    polygon: rectCorners(0.72, 0.08, 0.78, 0.85) },

  // ── 右列停车区（x=0.79–0.95）────────────────────────────────────────────────
  { id: 'b1-park-d1', name: '停车区 J', color: P.parkingSpace, icon: 'icon-parking',
    polygon: rectCorners(0.79, 0.10, 0.95, 0.30) },
  { id: 'b1-park-d2', name: '停车区 K', color: P.parkingSpace, icon: 'icon-parking',
    polygon: rectCorners(0.79, 0.34, 0.95, 0.54) },
  { id: 'b1-park-d3', name: '停车区 L', color: P.parkingSpace, icon: 'icon-parking',
    polygon: rectCorners(0.79, 0.58, 0.95, 0.78) },

  // ── 底部横向行车通道──────────────────────────────────────────────────────────
  { id: 'b1-lane-bottom', name: '行车通道', color: P.driveLane, icon: 'icon-entrance',
    polygon: rectCorners(0.05, 0.80, 0.95, 0.87) },

  // ── 底部功能区（从左到右）───────────────────────────────────────────────────
  { id: 'b1-elevator', name: '电梯厅', color: P.elevator, icon: 'icon-elevator-b1',
    polygon: rectCorners(0.05, 0.88, 0.18, 0.97) },
  { id: 'b1-disabled', name: '无障碍车位', color: P.disabledParking, icon: 'icon-disabled-parking',
    polygon: rectCorners(0.20, 0.88, 0.40, 0.97) },
  { id: 'b1-ev', name: '新能源充电区', color: P.evCharging, icon: 'icon-ev-charging',
    polygon: rectCorners(0.42, 0.88, 0.68, 0.97) },
  { id: 'b1-elevator2', name: '电梯厅', color: P.elevator, icon: 'icon-elevator-b1',
    polygon: rectCorners(0.70, 0.88, 0.82, 0.97) },
  { id: 'b1-fire-lane', name: '消防通道', color: P.fireLane, icon: 'icon-fire-lane',
    polygon: rectCorners(0.84, 0.88, 0.95, 0.97) },
]

const B1_ACTIVITY_BOUNDS = { x1: 0.05, y1: 0.00, x2: 0.95, y2: 0.97 }

export function buildB1FloorsGeoJSON(toGPS) {
  const features = PARKING_ZONES.map(zone => ({
    type: 'Feature',
    properties: { name: zone.name, color: zone.color, icon: zone.icon },
    geometry: {
      type: 'Polygon',
      coordinates: [zone.polygon.map(([x, y]) => toGPS(x, y))]
    }
  }))
  return { type: 'FeatureCollection', features }
}

export function buildB1ZoneLabelsGeoJSON(toGPS) {
  const features = PARKING_ZONES.map(zone => {
    const xs = zone.polygon.map(p => p[0])
    const ys = zone.polygon.map(p => p[1])
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2
    return {
      type: 'Feature',
      properties: { label: zone.name, icon: zone.icon, color: zone.color },
      geometry: { type: 'Point', coordinates: toGPS(centerX, centerY) }
    }
  })
  return { type: 'FeatureCollection', features }
}

export function buildB1Zones(toGPS) {
  return [
    {
      type: ZONE_TYPE.ACTIVITY_AREA,
      id: 'b1-activity-area',
      name: 'B1活动区域',
      points: rectCorners(B1_ACTIVITY_BOUNDS.x1, B1_ACTIVITY_BOUNDS.y1, B1_ACTIVITY_BOUNDS.x2, B1_ACTIVITY_BOUNDS.y2)
        .map(([x, y]) => toGPS(x, y)),
      style: { outlineColor: '#59a6eeff', outlineWidth: 2, fillOpacity: 0, lineDash: [8, 4] },
    },
    ...PARKING_ZONES.map(zone => ({
      type: ZONE_TYPE.FORBIDDEN,
      id: `b1-forbidden-${zone.id}`,
      name: zone.name,
      icon: zone.icon,
      points: zone.polygon.map(([x, y]) => toGPS(x, y)),
      style: { outlineWidth: 0, fillOpacity: 0 },
    })),
  ]
}

export function buildMallGeoJSON(activeFloorId, toGPS) {
  return { type: 'FeatureCollection', features: [] }
}

export function buildMallFloorsGeoJSON(toGPS, activeFloorId) {
  const features = []

  for (const shop of SHOPS) {
    features.push({
      type: 'Feature',
      properties: { name: shop.name, color: shop.color, icon: shop.icon },
      geometry: {
        type: 'Polygon',
        coordinates: [shop.polygon.map(([x, y]) => toGPS(x, y))]
      }
    })
  }

  const atriumPoints = buildEllipsePoints(0.5, 0.5, 0.12, 0.30)
  features.push({
    type: 'Feature',
    properties: { name: '中央中庭', color: '#e8e8e8', icon: 'icon-atrium' },
    geometry: {
      type: 'Polygon',
      coordinates: [atriumPoints.map(([x, y]) => toGPS(x, y))]
    }
  })

  return { type: 'FeatureCollection', features }
}

// 活动区域矩形边界（分数坐标）
const ACTIVITY_BOUNDS = { x1: 0.05, y1: -0.045, x2: 0.95, y2: 0.95 }

export function isInActiveArea(xFrac, yFrac) {
  return xFrac >= ACTIVITY_BOUNDS.x1 && xFrac <= ACTIVITY_BOUNDS.x2
    && yFrac >= ACTIVITY_BOUNDS.y1 && yFrac <= ACTIVITY_BOUNDS.y2
}

export function buildMallZones(toGPS, activeFloorId) {
  const zones = [
    // 活动区域：商场内部整体范围（机器人不可超出此区域）- 仅作为语义数据，不叠加显示
    {
      type: ZONE_TYPE.ACTIVITY_AREA,
      id: 'activity-area',
      name: '活动区域',
      points: rectCorners(ACTIVITY_BOUNDS.x1, ACTIVITY_BOUNDS.y1, ACTIVITY_BOUNDS.x2, ACTIVITY_BOUNDS.y2).map(([x, y]) => toGPS(x, y)),
      style: { outlineColor: '#59a6eeff', outlineWidth: 2, fillOpacity: 0, lineDash: [8, 4] },
    },
    // 禁行区：所有商铺（含卫生间）- 仅作为语义数据，不叠加显示
    ...SHOPS.map(shop => ({
      type: ZONE_TYPE.FORBIDDEN,
      id: `forbidden-${shop.id}`,
      name: shop.name,
      icon: shop.icon,
      points: shop.polygon.map(([x, y]) => toGPS(x, y)),
      style: { outlineWidth: 0, fillOpacity: 0 },
    })),
  ]
  return zones
}

// 生成商店标签 GeoJSON（用于 symbol 图层）
export function buildMallShopLabelsGeoJSON(toGPS) {
  const features = []
  for (const shop of SHOPS) {
    // 计算多边形中心点
    const xs = shop.polygon.map(p => p[0])
    const ys = shop.polygon.map(p => p[1])
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2

    features.push({
      type: 'Feature',
      properties: { label: shop.name, icon: shop.icon, color: shop.color },
      geometry: {
        type: 'Point',
        coordinates: toGPS(centerX, centerY)
      }
    })
  }
  return { type: 'FeatureCollection', features }
}
