<!--
 * @Date: Do not edit
 * @LastEditTime: Do not edit
 * @Description: 单点导航示例：点击地图放置目标点，机器人移动至该位置
 * @FilePath: Do not edit
-->
<template>
  <div class="app-root">
    <canvas id="canvasMap" style="display:none"></canvas>

    <AppHeader title="单点导航示例" />

    <Transition name="hint-fade">
      <div v-if="isNavigating" class="nav-overlay">
        <div class="hint-pill">
          <MapPin class="hint-icon" :size="15" />
          <span>点击地图选择目标点，机器人将移动至该位置</span>
          <button class="cancel-btn" @click="stopNavigation">
            <X :size="13" />
            退出
          </button>
        </div>
      </div>
    </Transition>

    <Transition name="toast-fade">
      <div v-if="navSuccess" class="success-toast">
        <CheckCircle :size="15" />
        <span>已到达目标点</span>
      </div>
    </Transition>

    <Transition name="toast-fade">
      <div v-if="navError" class="error-toast" role="alert">
        <TriangleAlert :size="15" />
        <span>{{ navError }}</span>
      </div>
    </Transition>

    <main class="map-area">
      <div class="grid-bg"></div>
      <div class="map-container" :class="{ 'nav-mode': isNavigating }">
        <div id="singleNavigationMap" class="map-gl"></div>
      </div>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

import { CheckCircle, MapPin, Navigation, TriangleAlert, X } from 'lucide-vue-next'

import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'

import bicMap from '../../../bicMap/core/bicmap-gl'
import slamImage from '../../assets/slam_pathplan.png'
import robotIcon from '../../assets/bicmap_robot.png'

// ===== SLAM 地图参数 =====
const MAP_START_X = -58.999993705749512
const MAP_START_Y = -21.349997329711914
const MAP_X_GRID_COUNT = 2752
const MAP_Y_GRID_COUNT = 1536
const MAP_RESOLUTION = 0.05

const ROBOT_SPEED = 1   // 机器人移动速度（m/s），调大变快，调小变慢
const ANIM_FRAME_MS = 50  // 动画帧间隔（ms），越小越流畅

// 图标头部相对正北的偏移（正右 = 东 = 90°）；换图标时只改这里
const ICON_HEAD_OFFSET = 90

// ===== 路径规划参数（与 pathPlanning 示例对齐） =====
const MAP_ZOOM_FACTOR = 2
const GRID_STRIDE = 10         // 逻辑栅格步长（像素）
// 像素颜色与可通行背景色的距离平方超过此值即视为障碍
const OBSTACLE_COLOR_DISTANCE = 600
const WALL_PENALTY = 2.6       // 贴墙惩罚：离障碍越近代价越高
const TURN_PENALTY = 4.0       // 拐弯惩罚：减少频繁转向
const DIAGONAL_PENALTY = 1.2   // 斜走惩罚：偏向水平/垂直行走
const MIN_SMOOTH_CLEARANCE = 2 // 平滑净空（格），防止路径贴墙角

// ===== 状态 =====
const map = ref(null)
const cacheCameraBound = ref(null)
const robotController = ref(null)
const isNavigating = ref(false)
const navSuccess = ref(false)
const navError = ref('')

let currentRobotLngLat = null
let currentRobotRotation = 0
let animIntervalId = null
let targetMarkerCtrl = null
let successTimer = null
let errorTimer = null
// 路径进度追踪（用于已走/待走双色渲染）
let navStartPos = null
let navWaypoints = []
let navSegIdx = 0
/** @type {boolean[][] | null} walkable[cj][ci] */
let walkableGrid = null
let logicalCols = 0
let logicalRows = 0
/** @type {Uint16Array | null} 各格子到最近障碍的距离（格子单位） */
let clearanceGrid = null

const footerButtons = computed(() => [
  {
    label: isNavigating.value ? '退出单点导航' : '开始单点导航',
    active: isNavigating.value,
    icon: Navigation,
    onClick: () => toggleNavigation()
  }
])

onMounted(() => { initMap() })

onBeforeUnmount(() => {
  clearTimeout(successTimer)
  clearTimeout(errorTimer)
  if (animIntervalId) {
    clearInterval(animIntervalId)
    animIntervalId = null
  }
  removeTargetMarker()
  map.value?.off('click', handleMapClick)
  if (robotController.value) {
    robotController.value.remove()
    robotController.value = null
  }
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})

function toGPS(x, y) {
  const gpsCoords = window.MapUtils.cartesianToGPS({
    x,
    y,
    scale: MAP_RESOLUTION,
    zoomFactor: 2
  })
  return [gpsCoords.longitude, gpsCoords.latitude]
}

function getMapCenterPosition() {
  const centerX = MAP_START_X + (MAP_X_GRID_COUNT * MAP_RESOLUTION) / 2
  const centerY = MAP_START_Y + (MAP_Y_GRID_COUNT * MAP_RESOLUTION) / 2
  return toGPS(centerX, centerY)
}

async function initMap() {
  try {
    await bicMap.init()
    map.value = bicMap.createMap({
      container: 'singleNavigationMap',
      center: [116.4074, 39.9042],
      zoom: 18,
      backgroundColor: '#fff'
    })
    bicMap.addZoomControl(map.value, 'bottom-right')
    map.value.on('load', () => {
      loadSlamMapData()
    })
  } catch (error) {
    console.error('初始化地图失败:', error)
  }
}

async function loadSlamMapData() {
  if (!map.value) return
  try {
    const result = await bicMap.loadSlamMap(map.value, {
      startX: MAP_START_X,
      startY: MAP_START_Y,
      xGridCount: MAP_X_GRID_COUNT,
      yGridCount: MAP_Y_GRID_COUNT,
      resolution: MAP_RESOLUTION,
      imagePath: slamImage,
      canvasId: 'canvasMap',
      fitBounds: true
    })
    cacheCameraBound.value = result.cameraBound
    placeRobot()
    // 构建可通行栅格（与 pathPlanning 示例相同的算法）
    rebuildOccupancy()
    startNavigation()
  } catch (error) {
    console.error('加载SLAM地图失败:', error)
  }
}


function placeRobot(lngLat = null) {
  if (!map.value) return

  const pos = lngLat ?? getMapCenterPosition()
  currentRobotLngLat = pos
  currentRobotRotation = ICON_HEAD_OFFSET  // 初始朝向与图标默认方向一致（正右）

  if (robotController.value) {
    robotController.value.setPosition(pos)
    robotController.value.setRotation(0)
  } else {
    robotController.value = bicMap.addDirectionalMarker(map.value, pos, {
      imagePath: robotIcon,
      size:            48,
      initialRotation: 0,
      draggable: false,
      rotationControl: false,
      initialEditMode: false
    })
  }
}

/** Haversine 距离（米），用于计算每段动画时长 */
function haversineMeters(a, b) {
  const R = 6371000
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** 计算两点间屏幕方位角（0° = 屏幕正上，顺时针）
 *  SLAM 地图 y 轴向下（纬度向上时为负方向），故对 dy 取反以匹配屏幕方向。
 */
function calcBearing(from, to) {
  const dx = to[0] - from[0]
  const dy = -(to[1] - from[1])  // 纬度轴与屏幕 y 轴相反，取反对齐屏幕方向
  return (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360
}

/** 根据物理距离计算帧数，确保机器人以恒定速度（ROBOT_SPEED m/s）移动 */
function calcSteps(from, to) {
  const distM = haversineMeters(from, to)
  const durationMs = Math.max(80, (distM / ROBOT_SPEED) * 1000)
  return Math.max(2, Math.round(durationMs / ANIM_FRAME_MS))
}

// 多航点动画（每段按真实距离计算步数，全程匀速，头部朝向当前路段方向）
function animateRobotAlongPath(waypoints) {
  if (!robotController.value || !currentRobotLngLat || !waypoints?.length) return

  // 清除上次导航的到达定时器，防止它在本次移动结束前触发
  clearTimeout(successTimer)
  navSuccess.value = false

  if (animIntervalId) {
    clearInterval(animIntervalId)
    animIntervalId = null
  }

  let segIdx = 0

  const runSegment = () => {
    if (segIdx >= waypoints.length) {
      showSuccessToast()
      return
    }

    const targetLngLat = waypoints[segIdx]
    segIdx++
    navSegIdx = segIdx  // 同步模块级索引，updatePathProgress 依赖它

    const startPos = [...currentRobotLngLat]
    const segBearing = calcBearing(startPos, targetLngLat)
    const steps = calcSteps(startPos, targetLngLat)
    let step = 0

    // 出发前立即朝向本段方向
    currentRobotRotation = segBearing
    robotController.value?.setRotation(currentRobotRotation - ICON_HEAD_OFFSET)

    animIntervalId = setInterval(() => {
      step++
      const t = step / steps
      const isLast = step >= steps

      currentRobotLngLat = [
        startPos[0] + (targetLngLat[0] - startPos[0]) * t,
        startPos[1] + (targetLngLat[1] - startPos[1]) * t
      ]

      robotController.value?.setPosition(currentRobotLngLat)
      updatePathProgress(currentRobotLngLat)  // 实时更新已走/待走颜色

      if (isLast) {
        clearInterval(animIntervalId)
        animIntervalId = null
        runSegment()
      }
    }, ANIM_FRAME_MS)
  }

  runSegment()
}

// ============================================================
//   路径规划（与 pathPlanning 示例共用同一套算法）
// ============================================================

/** GPS (lng, lat) → 图像像素坐标 {px, py} */
function lngLatToPixel(lng, lat) {
  const Mu = window.MapUtils
  if (!Mu?.GPSToCartesian) return null
  const c = Mu.GPSToCartesian({
    longitude: lng,
    latitude: lat,
    scale: MAP_RESOLUTION,
    zoomFactor: MAP_ZOOM_FACTOR
  })
  const px = Math.floor((c.x - MAP_START_X) / MAP_RESOLUTION)
  const py = Math.floor((MAP_START_Y + MAP_Y_GRID_COUNT * MAP_RESOLUTION - c.y) / MAP_RESOLUTION)
  return {
    px: Math.min(MAP_X_GRID_COUNT - 1, Math.max(0, px)),
    py: Math.min(MAP_Y_GRID_COUNT - 1, Math.max(0, py))
  }
}

/** 图像像素 → 逻辑栅格 {ci, cj} */
function pixelToLogical(px, py) {
  const s = GRID_STRIDE
  return {
    ci: Math.min(logicalCols - 1, Math.max(0, Math.floor(px / s))),
    cj: Math.min(logicalRows - 1, Math.max(0, Math.floor(py / s)))
  }
}

/** 逻辑栅格 (ci, cj) 中心 → GPS [lng, lat] */
function logicalCenterToLngLat(ci, cj) {
  const Mu = window.MapUtils
  if (!Mu?.cartesianToGPS) return [0, 0]
  const pxC = Math.min(MAP_X_GRID_COUNT - 1, ci * GRID_STRIDE + Math.floor(GRID_STRIDE / 2))
  const pyC = Math.min(MAP_Y_GRID_COUNT - 1, cj * GRID_STRIDE + Math.floor(GRID_STRIDE / 2))
  const cx = MAP_START_X + (pxC + 0.5) * MAP_RESOLUTION
  const cy = MAP_START_Y + (MAP_Y_GRID_COUNT - pyC - 0.5) * MAP_RESOLUTION
  const gps = Mu.cartesianToGPS({ x: cx, y: cy, scale: MAP_RESOLUTION, zoomFactor: MAP_ZOOM_FACTOR })
  return [gps.longitude, gps.latitude]
}

/**
 * 从非透明像素中统计主色，自动识别 SLAM 图的可通行区域背景色。
 * 颜色按每通道高 6 位量化，减少抗锯齿产生的相近色碎片。
 */
function detectBackgroundColor(data, w, h) {
  const freq = new Map()
  const step = 6

  for (let y = 0; y < h; y += step) {
    const rowBase = y * w
    for (let x = 0; x < w; x += step) {
      const i = (rowBase + x) * 4
      if (data[i + 3] < 10) continue
      const key = ((data[i] >> 2) << 12) | ((data[i + 1] >> 2) << 6) | (data[i + 2] >> 2)
      freq.set(key, (freq.get(key) || 0) + 1)
    }
  }

  let bestKey = -1
  let bestCount = -1
  for (const [key, count] of freq) {
    if (count > bestCount) {
      bestKey = key
      bestCount = count
    }
  }

  if (bestKey < 0) return [255, 255, 255]
  return [
    ((bestKey >> 12) & 0x3f) << 2,
    ((bestKey >> 6) & 0x3f) << 2,
    (bestKey & 0x3f) << 2
  ]
}

/** 从 canvasMap 构建可通行栅格 + clearance 距离场 */
function rebuildOccupancy() {
  const canvas = document.getElementById('canvasMap')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  const { data } = ctx.getImageData(0, 0, w, h)

  const s = GRID_STRIDE
  logicalCols = Math.ceil(MAP_X_GRID_COUNT / s)
  logicalRows = Math.ceil(MAP_Y_GRID_COUNT / s)

  const bg = detectBackgroundColor(data, w, h)
  const isObstaclePixel = (px, py) => {
    const i = (py * w + px) * 4
    if (data[i + 3] < 10) return true
    const dr = data[i] - bg[0]
    const dg = data[i + 1] - bg[1]
    const db = data[i + 2] - bg[2]
    return dr * dr + dg * dg + db * db > OBSTACLE_COLOR_DISTANCE
  }

  walkableGrid = []
  for (let cj = 0; cj < logicalRows; cj++) {
    const row = []
    const y0 = cj * s
    const yEnd = Math.min(h, y0 + s)
    for (let ci = 0; ci < logicalCols; ci++) {
      const x0 = ci * s
      const xEnd = Math.min(w, x0 + s)

      // 扫描整个逻辑格：命中任意墙体、家具描边或透明区即判为障碍，
      // 避免只取中心像素时漏掉细线，导致路径穿墙。
      let obstacle = false
      for (let py = y0; py < yEnd && !obstacle; py++) {
        for (let px = x0; px < xEnd; px++) {
          if (isObstaclePixel(px, py)) {
            obstacle = true
            break
          }
        }
      }
      row.push(!obstacle)
    }
    walkableGrid.push(row)
  }

  clearanceGrid = computeClearanceGrid(walkableGrid, logicalCols, logicalRows)
  console.log(`[路径规划] 栅格已构建 ${logicalCols}×${logicalRows}（步长 ${s}px）`)
}

/** 多源 BFS 计算每个可走格子到最近障碍的距离 */
function computeClearanceGrid(grid, cols, rows) {
  const dist = new Uint16Array(rows * cols)
  dist.fill(65535)
  const q = new Int32Array(rows * cols)
  let qh = 0, qt = 0
  const idx = (c, r) => r * cols + c

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) {
        const i = idx(c, r)
        dist[i] = 0
        q[qt++] = i
      }
    }
  }
  if (qt === 0) { dist.fill(999); return dist }

  const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  while (qh < qt) {
    const cur = q[qh++]
    const r = Math.floor(cur / cols), c = cur % cols
    const nd = dist[cur] + 1
    for (const [dc, dr] of DIR4) {
      const nc = c + dc, nr = r + dr
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
      const ni = idx(nc, nr)
      if (nd < dist[ni]) { dist[ni] = nd; q[qt++] = ni }
    }
  }
  return dist
}

/** 从 (ci, cj) 出发 BFS 找最近的可通行格子 */
function nearestWalkable(ci, cj) {
  if (!walkableGrid) return null
  if (walkableGrid[cj]?.[ci]) return { ci, cj }
  const key = (x, y) => `${x},${y}`
  const q = [[ci, cj]]
  let qh = 0
  const seen = new Set([key(ci, cj)])
  let steps = 0
  while (qh < q.length && steps++ < 12000) {
    const [x, y] = q[qh++]
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= logicalCols || ny >= logicalRows) continue
        const k = key(nx, ny)
        if (seen.has(k)) continue
        seen.add(k)
        if (walkableGrid[ny][nx]) return { ci: nx, cj: ny }
        q.push([nx, ny])
      }
    }
  }
  return null
}

const NEI8 = []
for (let dy = -1; dy <= 1; dy++) {
  for (let dx = -1; dx <= 1; dx++) {
    if (dx !== 0 || dy !== 0) NEI8.push([dx, dy])
  }
}

/**
 * A* 寻路（贴墙惩罚 + 拐弯惩罚 + 斜走惩罚）
 * 与 pathPlanning 示例完全一致
 */
function astar(start, goal) {
  if (!walkableGrid) return null
  const { ci: sc, cj: sr } = start
  const { ci: gc, cj: gr } = goal
  if (!walkableGrid[sr]?.[sc] || !walkableGrid[gr]?.[gc]) return null

  const rows = logicalRows, cols = logicalCols
  const inf = 1e30
  const gScore = new Float64Array(rows * cols).fill(inf)
  const fScore = new Float64Array(rows * cols).fill(inf)
  const came = new Int32Array(rows * cols).fill(-1)
  const cameDir = new Int8Array(rows * cols).fill(-1)

  const idx = (c, r) => r * cols + c
  const h = (c, r) => Math.hypot(gc - c, gr - r)

  const baseStep = GRID_STRIDE * MAP_RESOLUTION * MAP_ZOOM_FACTOR
  const stepCost = (dx, dy) => Math.hypot(dx, dy) * baseStep + (dx !== 0 && dy !== 0 ? DIAGONAL_PENALTY : 0)

  const clearanceAt = (c, r) => clearanceGrid ? clearanceGrid[idx(c, r)] : 999
  const wallCost = (c, r) => WALL_PENALTY / (clearanceAt(c, r) + 0.35)

  const open = []
  const si = idx(sc, sr)
  gScore[si] = 0
  fScore[si] = h(sc, sr)
  open.push(si)
  const inOpen = new Set([si])

  while (open.length) {
    let bestI = 0, bestF = fScore[open[0]]
    for (let i = 1; i < open.length; i++) {
      if (fScore[open[i]] < bestF) { bestF = fScore[open[i]]; bestI = i }
    }
    const cur = open[bestI]
    open.splice(bestI, 1)
    inOpen.delete(cur)

    const cr = Math.floor(cur / cols), cc = cur % cols
    if (cc === gc && cr === gr) {
      const path = []
      let p = cur
      while (p !== -1) {
        path.push({ ci: p % cols, cj: Math.floor(p / cols) })
        p = came[p]
      }
      path.reverse()
      return path
    }

    for (let dir = 0; dir < NEI8.length; dir++) {
      const [dx, dy] = NEI8[dir]
      const nc = cc + dx, nr = cr + dy
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
      if (!walkableGrid[nr][nc]) continue
      // 斜向移动时两侧正交格都必须可走，禁止从墙角缝隙切过。
      if (dx !== 0 && dy !== 0) {
        if (!walkableGrid[cr][nc] || !walkableGrid[nr][cc]) continue
      }
      const ni = idx(nc, nr)
      const prevDir = cameDir[cur]
      const turnCost = (prevDir === -1 || prevDir === dir) ? 0 : TURN_PENALTY
      const tentative = gScore[cur] + stepCost(dx, dy) + wallCost(nc, nr) + turnCost
      if (tentative < gScore[ni]) {
        came[ni] = cur
        cameDir[ni] = dir
        gScore[ni] = tentative
        fScore[ni] = tentative + h(nc, nr)
        if (!inOpen.has(ni)) { open.push(ni); inOpen.add(ni) }
      }
    }
  }
  return null
}

/** Bresenham 视线检查（同时检查最小净空） */
function hasLineOfSight(a, b) {
  if (!walkableGrid) return false
  const cols = logicalCols
  let x0 = a.ci, y0 = a.cj
  const x1 = b.ci, y1 = b.cj
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  while (true) {
    if (!walkableGrid[y0]?.[x0]) return false
    if (MIN_SMOOTH_CLEARANCE > 0 && clearanceGrid) {
      if (clearanceGrid[y0 * cols + x0] < MIN_SMOOTH_CLEARANCE) return false
    }
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x0 += sx }
    if (e2 < dx) { err += dx; y0 += sy }
  }
  return true
}

/** 路径平滑：视线法去除冗余中间点（与 pathPlanning 一致） */
function smoothPathCells(path) {
  if (!path || path.length < 3) return path
  const out = []
  let i = 0
  while (i < path.length) {
    out.push(path[i])
    if (i === path.length - 1) break
    let j = path.length - 1
    for (; j > i + 1; j--) {
      if (hasLineOfSight(path[i], path[j])) break
    }
    i = j
  }
  return out
}

const EMPTY_LINE = { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }

/**
 * 初始化双色路径：
 *   remaining（橙色虚线）= 完整规划路径，设定后坐标不再修改，虚线不会流动
 *   traveled（灰色实线） = 每帧增长覆盖在橙色上方，已走部分显示为灰色
 */
function drawPathLine(startPos, waypoints) {
  if (!map.value || !waypoints?.length) return

  // 记录导航起始状态
  navStartPos  = [...startPos]
  navWaypoints = [...waypoints]
  navSegIdx    = 0

  const fullLine = { type: 'Feature', geometry: { type: 'LineString', coordinates: [startPos, ...waypoints] } }

  if (map.value.getSource('nav-remaining')) {
    map.value.getSource('nav-remaining').setData(fullLine)
    map.value.getSource('nav-traveled').setData(EMPTY_LINE)
  } else {
    // 待行走：橙色虚线（只在航点切换时更新，避免每帧重绘导致虚线流动）
    map.value.addSource('nav-remaining', { type: 'geojson', data: fullLine })
    map.value.addLayer({
      id: 'nav-remaining-layer', type: 'line', source: 'nav-remaining',
      paint: { 'line-color': '#FF6B35', 'line-width': 2.5, 'line-dasharray': [4, 3], 'line-opacity': 0.85 }
    })
    // 已走过：灰色实线
    map.value.addSource('nav-traveled', { type: 'geojson', data: EMPTY_LINE })
    map.value.addLayer({
      id: 'nav-traveled-layer', type: 'line', source: 'nav-traveled',
      paint: { 'line-color': '#9CA3AF', 'line-width': 2.5, 'line-opacity': 0.7 }
    })
  }
}

/** 每帧更新灰色已走线（平滑生长）；橙色线坐标始终保持完整路径，不做修改。 */
function updatePathProgress(currentPos) {
  if (!map.value || !navStartPos || !navWaypoints.length) return

  const seg = navSegIdx
  const traveledCoords = [navStartPos, ...navWaypoints.slice(0, seg - 1), currentPos]
  map.value.getSource('nav-traveled')?.setData(
    { type: 'Feature', geometry: { type: 'LineString', coordinates: traveledCoords } }
  )
}

/** 清除双色路径线并重置状态 */
function clearPathLine() {
  if (!map.value) return
  map.value.getSource('nav-remaining')?.setData(EMPTY_LINE)
  map.value.getSource('nav-traveled')?.setData(EMPTY_LINE)
  navStartPos = null
  navWaypoints = []
  navSegIdx = 0
}

// ============================================================

function toggleNavigation() {
  if (isNavigating.value) {
    stopNavigation()
  } else {
    startNavigation()
  }
}

function startNavigation() {
  if (!map.value) return
  navError.value = ''
  isNavigating.value = true
  map.value.on('click', handleMapClick)
  map.value.getCanvas().style.cursor = 'crosshair'
}

function stopNavigation() {
  clearTimeout(errorTimer)
  navError.value = ''
  if (animIntervalId) {
    clearInterval(animIntervalId)
    animIntervalId = null
  }
  removeTargetMarker()
  clearPathLine()
  map.value?.off('click', handleMapClick)
  if (map.value) map.value.getCanvas().style.cursor = ''
  isNavigating.value = false
}

function handleMapClick(e) {
  if (!isNavigating.value || !map.value) return

  const lngLat = [e.lngLat.lng, e.lngLat.lat]
  clearTimeout(errorTimer)
  navError.value = ''
  navSuccess.value = false

  // 使用与 pathPlanning 相同的 A* 流程：当前位置 → 目标点
  if (walkableGrid && currentRobotLngLat) {
    const startPixel = lngLatToPixel(currentRobotLngLat[0], currentRobotLngLat[1])
    const goalPixel  = lngLatToPixel(lngLat[0], lngLat[1])

    if (startPixel && goalPixel) {
      const startLogical = pixelToLogical(startPixel.px, startPixel.py)
      const goalLogical  = pixelToLogical(goalPixel.px, goalPixel.py)

      const startCell = nearestWalkable(startLogical.ci, startLogical.cj)
      const goalCell  = nearestWalkable(goalLogical.ci, goalLogical.cj)

      if (startCell && goalCell) {
        const rawPath = astar(startCell, goalCell)
        if (rawPath?.length) {
          const smoothed = smoothPathCells(rawPath)
          // 保留首个安全格中心，并把点击目标吸附到最终安全格中心。
          const waypoints = smoothed.map(c => logicalCenterToLngLat(c.ci, c.cj))
          if (waypoints.length > 0) {
            const safeTarget = waypoints[waypoints.length - 1]
            placeTargetMarker(safeTarget)
            drawPathLine(currentRobotLngLat, waypoints)
            animateRobotAlongPath(waypoints)
            return
          }
        }
      }
    }
  }

  // 规划失败时禁止退化为直线移动，否则机器人会穿过墙体或家具。
  removeTargetMarker()
  showNavigationError(walkableGrid ? '目标点不可达，请选择可通行区域' : '路径栅格尚未就绪，请稍后重试')
}

function placeTargetMarker(lngLat) {
  removeTargetMarker()

  targetMarkerCtrl = bicMap.addDirectionalMarker(map.value, lngLat, {
    imagePath: '/bicMap/assets/img/pos.png',
    size: 28,
    initialRotation: 0,
    draggable: false,
    rotationControl: false,
    initialEditMode: false
  })
}

function removeTargetMarker() {
  if (targetMarkerCtrl) {
    targetMarkerCtrl.remove()
    targetMarkerCtrl = null
  }
}

function showSuccessToast() {
  navSuccess.value = true
  clearTimeout(successTimer)
  successTimer = setTimeout(() => {
    navSuccess.value = false
    removeTargetMarker()
    clearPathLine()
  }, 3000)
}

function showNavigationError(message) {
  navError.value = message
  clearTimeout(errorTimer)
  errorTimer = setTimeout(() => {
    navError.value = ''
  }, 3000)
}
</script>


<style lang="scss" scoped>
.app-root {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  background: linear-gradient(160deg, #e8f4fc 0%, #eef1f8 30%, #f0f6fb 60%, #e6f0fa 100%);
}

.map-area {
  flex: 1;
  position: relative;
  overflow: hidden;
  z-index: 10;
}

.grid-bg {
  position: absolute;
  inset: 0;
  opacity: 0.04;
  background-image:
    linear-gradient(rgba(14, 165, 233, 1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14, 165, 233, 1) 1px, transparent 1px);
  background-size: 40px 40px;
}

.map-container {
  position: absolute;
  inset: 12px;
  border-radius: 16px;
  overflow: hidden;
  background: rgb(129 182 220 / 49%);
  box-shadow: 0 4px 30px rgba(14, 165, 233, 0.06), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;
  transition: border-color 0.25s, box-shadow 0.25s;
}

.map-container.nav-mode {
  border-color: rgba(0, 102, 255, 0.35);
  box-shadow: 0 4px 30px rgba(0, 102, 255, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;
}

.map-gl {
  width: 100%;
  height: 100%;
}

.nav-overlay {
  position: absolute;
  top: 70px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  pointer-events: none;
}

.hint-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(0, 51, 153, 0.88);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(100, 160, 255, 0.3);
  border-radius: 99px;
  color: #e8f0ff;
  font-size: 13px;
  white-space: nowrap;
  box-shadow: 0 4px 20px rgba(0, 51, 153, 0.35);
  pointer-events: all;
}

.hint-icon {
  color: #7eb8ff;
  flex-shrink: 0;
}

.cancel-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  margin-left: 4px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 99px;
  color: #c8daff;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.22);
  }
}

.success-toast {
  position: absolute;
  top: 70px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: rgba(10, 120, 60, 0.88);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(80, 220, 140, 0.3);
  border-radius: 99px;
  color: #d0ffe8;
  font-size: 13px;
  white-space: nowrap;
  box-shadow: 0 4px 20px rgba(10, 120, 60, 0.35);
  pointer-events: none;
}

.error-toast {
  position: absolute;
  top: 70px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 31;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: rgba(180, 55, 40, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 150, 130, 0.35);
  border-radius: 99px;
  color: #fff1ee;
  font-size: 13px;
  white-space: nowrap;
  box-shadow: 0 4px 20px rgba(160, 40, 25, 0.32);
  pointer-events: none;
}

.hint-fade-enter-active,
.hint-fade-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.hint-fade-enter-from,
.hint-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.toast-fade-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-6px);
}
</style>
