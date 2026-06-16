<!--
 * @Description: 机器人实时位置监控 + 手动生成固定巡逻路径（A* 路径规划）
 * @FilePath: /bic-map-plugin/src/examples/indoor/location/index.vue
-->
<template>
  <div class="app-root">
    <canvas id="canvasMap" style="display:none"></canvas>

    <AppHeader title="机器人实时位置监控" />

    <main class="map-area">
      <div class="grid-bg"></div>

      <div class="map-container">
        <div id="locationMap" class="map-gl"></div>

        <!-- 路径生成面板（生成模式下显示） -->
        <aside v-if="genMode" class="gen-panel">
          <div class="gen-panel-title">
            <Route :size="15" />
            手动生成巡逻路径
          </div>

          <!-- 机器人选择标签 -->
          <div class="robot-tabs">
            <button
              v-for="(cfg, i) in ROBOT_CONFIGS"
              :key="cfg.id"
              class="robot-tab"
              :class="{
                active: genRobotIdx === i,
                done: genPlannedPaths[i].length > 0
              }"
              @click="switchToRobot(i)"
            >
              <span class="tab-dot" :style="{ background: cfg.color }"></span>
              {{ cfg.name.replace('机器人-', '') }}
              <span v-if="genPlannedPaths[i].length > 0" class="tab-check">✓</span>
            </button>
          </div>

          <!-- 当前机器人信息 -->
          <div class="gen-info">
            <div class="gen-robot-name">
              <span class="robot-dot" :style="{ background: ROBOT_CONFIGS[genRobotIdx].color }"></span>
              {{ ROBOT_CONFIGS[genRobotIdx].name }}
            </div>
            <div class="gen-status">{{ genStatus }}</div>
          </div>

          <!-- 步骤说明 -->
          <ol class="gen-steps">
            <li>点击「绘制点位」，在地图上依次点击多个路点</li>
            <li>点击「规划 A* 路径」生成绕障路径</li>
            <li>对所有机器人完成后点击「导出路径代码」</li>
          </ol>

          <!-- 操作按钮 -->
          <div class="gen-actions">
            <button
              class="gen-btn"
              :class="{ active: genPickActive }"
              @click="togglePick"
            >
              <MapPin :size="13" />
              {{ genPickActive ? '停止绘制' : '绘制点位' }}
            </button>
            <button
              class="gen-btn"
              :disabled="genPickedLngLats.length < 2"
              @click="planCurrentRobotPath"
            >
              <Zap :size="13" />
              规划 A* 路径
            </button>
            <button class="gen-btn danger" @click="clearCurrentRobot">
              <X :size="13" />
              清除此机器人
            </button>
          </div>

          <!-- 导航 -->
          <div class="gen-nav">
            <button
              class="gen-btn secondary"
              :disabled="genRobotIdx === 0"
              @click="switchToRobot(genRobotIdx - 1)"
            >
              ← 上一个
            </button>
            <button
              class="gen-btn secondary"
              :disabled="genRobotIdx === ROBOT_CONFIGS.length - 1"
              @click="switchToRobot(genRobotIdx + 1)"
            >
              下一个 →
            </button>
          </div>

          <!-- 导出 -->
          <div class="gen-export">
            <div class="export-progress">
              已完成 {{ genPlannedPaths.filter(p => p.length > 0).length }} / {{ ROBOT_CONFIGS.length }} 个机器人
            </div>
            <button class="gen-btn export" @click="exportPaths">
              <Download :size="13" />
              导出路径代码
            </button>
          </div>

          <button class="gen-close" @click="exitGenMode" title="退出生成模式">
            <X :size="14" />
          </button>
        </aside>
      </div>
    </main>

    <AppFooter :left-buttons="footerButtons" />

    <!-- 代码导出模态框 -->
    <div v-if="showCodeModal" class="code-modal-overlay" @click.self="showCodeModal = false">
      <div class="code-modal">
        <div class="code-modal-header">
          <div class="code-modal-title">
            <Code :size="16" />
            生成的路径代码
          </div>
          <button class="code-close" @click="showCodeModal = false"><X :size="16" /></button>
        </div>
        <div class="code-modal-desc">
          将以下常量粘贴到文件顶部，替换 <code>ROBOT_FIXED_PATHS</code>，机器人将按固定路径巡逻：
        </div>
        <div class="code-area-wrap">
          <textarea ref="codeTextarea" class="code-area" readonly :value="generatedCode" />
        </div>
        <div class="code-modal-footer">
          <span class="copy-hint">{{ copyHint }}</span>
          <button class="code-btn" @click="copyCode">
            <Copy :size="13" />
            复制代码
          </button>
          <button class="code-btn secondary" @click="showCodeModal = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Download, MapPin, Route, X, Zap, Code, Copy } from 'lucide-vue-next'
import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'
import bicMap from '../../../bicMap/core/bicmap-gl'
import slamImage from '../../assets/slam_transparent.png'
import icon1 from '../../assets/robot_heading_1.png'
import icon2 from '../../assets/robot_heading_2.png'
import icon3 from '../../assets/robot_heading_3.png'
import icon4 from '../../assets/robot_heading_4.png'
import icon5 from '../../assets/robot_heading_5.png'

// ===== SLAM 地图参数 =====
const MAP_START_X      = -58.999993705749512
const MAP_START_Y      = -21.349997329711914
const MAP_X_GRID_COUNT = 2752
const MAP_Y_GRID_COUNT = 1536
const MAP_RESOLUTION   = 0.05
const MAP_WIDTH        = MAP_X_GRID_COUNT * MAP_RESOLUTION  // 137.6 m
const MAP_HEIGHT       = MAP_Y_GRID_COUNT * MAP_RESOLUTION  // 76.8 m
const MAP_ZOOM_FACTOR  = 2

// ===== A* 栅格参数 =====
const GRID_STRIDE         = 8     // 每个逻辑格 = 8 像素
const LUMA_THRESHOLD      = 200   // 亮度阈值：低于此值视为障碍
const WALL_PENALTY_VAL    = 2.5
const TURN_PENALTY_VAL    = 4.0
const DIAGONAL_PENALTY_VAL = 1.2
const MIN_SMOOTH_CLEARANCE = 2

// ===== 机器人配置 =====
const ROBOT_CONFIGS = [
  { id: 'r1', name: '机器人-A', icon: icon1, color: '#FF6B35', speed: 2.5 },
  { id: 'r2', name: '机器人-B', icon: icon2, color: '#4169E1', speed: 3.2 },
  { id: 'r3', name: '机器人-C', icon: icon3, color: '#00BFFF', speed: 2.0 },
  { id: 'r4', name: '机器人-D', icon: icon4, color: '#9B59B6', speed: 3.8 },
  { id: 'r5', name: '机器人-E', icon: icon5, color: '#1ABC9C', speed: 2.8 },
]

const ARRIVAL_THRESHOLD = 6
const UPDATE_MS         = 500

// ===== Mock 巡逻路线（备用：未设定固定路径时使用）=====
const SAFE_MIN_FRAC = 0.22
const SAFE_MAX_FRAC = 0.68
const PATROL_ROUTES = [
  [[0.20, 0.50], [0.22, 0.51], [0.24, 0.43], [0.20, 0.44]],
  [[0.45, 0.25], [0.58, 0.38], [0.58, 0.46], [0.40, 0.46]],
  [[0.70, 0.70], [0.64, 0.56], [0.64, 0.64], [0.56, 0.64]],
  [[0.80, 0.30], [0.62, 0.58], [0.54, 0.58], [0.54, 0.42]],
  [[0.50, 0.55], [0.56, 0.50], [0.50, 0.56], [0.44, 0.50]],
]

// ===== 预计算固定路径（由下方「生成路径代码」功能生成后粘贴替换）=====
// 格式：每个机器人对应一个 [[lng, lat], ...] 数组（完整巡逻圈）
// 若某机器人数组为空，则该机器人使用上方 PATROL_ROUTES 做简单线性移动
// ===== 预计算固定路径 =====
// 将此常量粘贴到 location/index.vue 文件顶部，替换原有的 ROBOT_FIXED_PATHS 常量
const ROBOT_FIXED_PATHS = [
  // 机器人-A（7 个路点）
  [
    [116.4073658, 39.9042155],
    [116.4073663, 39.9042119],
    [116.4073719, 39.9042112],
    [116.4073785, 39.9042112],
    [116.4073850, 39.9042112],
    [116.4073743, 39.9042148],
    [116.4073658, 39.9042155],
  ],
  // 机器人-B（9 个路点）
  [
    [116.4073996, 39.9042011],
    [116.4074024, 39.9042068],
    [116.4074094, 39.9042090],
    [116.4074071, 39.9042126],
    [116.4074033, 39.9042126],
    [116.4074085, 39.9042104],
    [116.4074085, 39.9042101],
    [116.4074085, 39.9042097],
    [116.4073996, 39.9042011],
  ],
  // 机器人-C（13 个路点）
  [
    [116.4074146, 39.9042209],
    [116.4074178, 39.9042194],
    [116.4074178, 39.9042166],
    [116.4074188, 39.9042158],
    [116.4074206, 39.9042137],
    [116.4074211, 39.9042137],
    [116.4074244, 39.9042180],
    [116.4074216, 39.9042148],
    [116.4074211, 39.9042148],
    [116.4074206, 39.9042148],
    [116.4074202, 39.9042148],
    [116.4074197, 39.9042148],
    [116.4074146, 39.9042209],
  ],
  // 机器人-D（7 个路点）
  [
    [116.4074384, 39.9042313],
    [116.4074323, 39.9042352],
    [116.4074314, 39.9042306],
    [116.4074309, 39.9042259],
    [116.4074295, 39.9042212],
    [116.4074361, 39.9042241],
    [116.4074384, 39.9042313],
  ],
  // 机器人-E（13 个路点）
  [
    [116.4074562, 39.9042025],
    [116.4074534, 39.9042004],
    [116.4074530, 39.9042004],
    [116.4074501, 39.9042022],
    [116.4074483, 39.9042101],
    [116.4074431, 39.9042126],
    [116.4074366, 39.9042133],
    [116.4074516, 39.9042090],
    [116.4074525, 39.9042015],
    [116.4074539, 39.9042015],
    [116.4074544, 39.9042015],
    [116.4074548, 39.9042015],
    [116.4074562, 39.9042025],
  ],
]

// ===== 运行时（非响应式）=====
const runtimes = []
let map = null
let cacheCameraBound = null
let simIntervalId = null
let walkableGrid = null
let clearanceGrid = null
let logicalCols = 0
let logicalRows = 0
const mapReady = ref(false)

// ===== 路径生成模式状态 =====
const genMode          = ref(false)
const genRobotIdx      = ref(0)
const genPickActive    = ref(false)
const genPickedLngLats = ref([])
const genPlannedPaths  = ref([[], [], [], [], []])
const genStatus        = ref('点击「绘制点位」在地图上添加路点')
const showCodeModal    = ref(false)
const generatedCode    = ref('')
const copyHint         = ref('')
const codeTextarea     = ref(null)
let genClickHandler    = null
let genPolylineIds     = [] // MapLibre source/layer IDs for current robot preview

// ===== Footer 按钮 =====
const footerButtons = computed(() => [
  // {
  //   label:    genMode.value ? '退出生成模式' : '生成路径数据',
  //   icon:     Route,
  //   onClick:  genMode.value ? exitGenMode : enterGenMode,
  //   disabled: !mapReady.value,
  //   active:   genMode.value,
  // }
])

onMounted(() => { initMap() })
onBeforeUnmount(() => {
  exitGenMode()
  if (simIntervalId) { clearInterval(simIntervalId); simIntervalId = null }
  runtimes.forEach(rt => rt.controller?.remove())
  runtimes.length = 0
  if (map) { map.remove(); map = null }
})

// ===== 坐标转换 =====
function cartToGPS(x, y) {
  const g = window.MapUtils.cartesianToGPS({ x, y, scale: MAP_RESOLUTION, zoomFactor: MAP_ZOOM_FACTOR })
  return [g.longitude, g.latitude]
}

function gpsToCart(lngLat) {
  const g = window.MapUtils.GPSToCartesian({ longitude: lngLat[0], latitude: lngLat[1], scale: MAP_RESOLUTION, zoomFactor: MAP_ZOOM_FACTOR })
  return { x: g.x, y: g.y }
}

function fracToCartPos(xFrac, yFrac) {
  return { x: MAP_START_X + xFrac * MAP_WIDTH, y: MAP_START_Y + yFrac * MAP_HEIGHT }
}

function clampCartPos(p) {
  const minX = MAP_START_X + SAFE_MIN_FRAC * MAP_WIDTH
  const maxX = MAP_START_X + SAFE_MAX_FRAC * MAP_WIDTH
  const minY = MAP_START_Y + SAFE_MIN_FRAC * MAP_HEIGHT
  const maxY = MAP_START_Y + SAFE_MAX_FRAC * MAP_HEIGHT
  return { x: Math.max(minX, Math.min(maxX, p.x)), y: Math.max(minY, Math.min(maxY, p.y)) }
}

function cartDist(a, b) { return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2) }

function cartBearing(from, to) {
  return (Math.atan2(to.x - from.x, to.y - from.y) * (180 / Math.PI) + 360) % 360
}

function formatCoord(lngLat) {
  return `${lngLat[0].toFixed(6)}, ${lngLat[1].toFixed(6)}`
}

// ===== A* 坐标转换 =====
function lngLatToPixel(lng, lat) {
  const Mu = window.MapUtils
  if (!Mu?.GPSToCartesian) return null
  const c = Mu.GPSToCartesian({ longitude: lng, latitude: lat, scale: MAP_RESOLUTION, zoomFactor: MAP_ZOOM_FACTOR })
  const px = Math.floor((c.x - MAP_START_X) / MAP_RESOLUTION)
  const py = Math.floor((MAP_START_Y + MAP_Y_GRID_COUNT * MAP_RESOLUTION - c.y) / MAP_RESOLUTION)
  return {
    px: Math.min(MAP_X_GRID_COUNT - 1, Math.max(0, px)),
    py: Math.min(MAP_Y_GRID_COUNT - 1, Math.max(0, py))
  }
}

function pixelToLogical(px, py) {
  return {
    ci: Math.min(logicalCols - 1, Math.max(0, Math.floor(px / GRID_STRIDE))),
    cj: Math.min(logicalRows - 1, Math.max(0, Math.floor(py / GRID_STRIDE)))
  }
}

function logicalCenterToLngLat(ci, cj) {
  const Mu = window.MapUtils
  if (!Mu?.cartesianToGPS) return [0, 0]
  const pxC = Math.min(MAP_X_GRID_COUNT - 1, Math.max(0, ci * GRID_STRIDE + Math.floor(GRID_STRIDE / 2)))
  const pyC = Math.min(MAP_Y_GRID_COUNT - 1, Math.max(0, cj * GRID_STRIDE + Math.floor(GRID_STRIDE / 2)))
  const cx = MAP_START_X + (pxC + 0.5) * MAP_RESOLUTION
  const cy = MAP_START_Y + (MAP_Y_GRID_COUNT - pyC - 0.5) * MAP_RESOLUTION
  const gps = Mu.cartesianToGPS({ x: cx, y: cy, scale: MAP_RESOLUTION, zoomFactor: MAP_ZOOM_FACTOR })
  return [gps.longitude, gps.latitude]
}

// ===== 栅格构建 =====
function rebuildOccupancy() {
  const canvas = document.getElementById('canvasMap')
  if (!canvas) return
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)

  logicalCols = Math.ceil(MAP_X_GRID_COUNT / GRID_STRIDE)
  logicalRows = Math.ceil(MAP_Y_GRID_COUNT / GRID_STRIDE)
  walkableGrid = []

  for (let cj = 0; cj < logicalRows; cj++) {
    const row = []
    for (let ci = 0; ci < logicalCols; ci++) {
      const px = Math.min(canvas.width - 1, ci * GRID_STRIDE + Math.floor(GRID_STRIDE / 2))
      const py = Math.min(canvas.height - 1, cj * GRID_STRIDE + Math.floor(GRID_STRIDE / 2))
      const base = (py * canvas.width + px) * 4
      const a = data[base + 3]
      const luma = 0.2126 * data[base] + 0.7152 * data[base + 1] + 0.0722 * data[base + 2]
      row.push(a < 10 ? false : luma >= LUMA_THRESHOLD)
    }
    walkableGrid.push(row)
  }

  clearanceGrid = computeClearanceGrid(walkableGrid, logicalCols, logicalRows)
}

function computeClearanceGrid(grid, cols, rows) {
  const dist = new Uint16Array(rows * cols)
  dist.fill(65535)
  const q = new Int32Array(rows * cols)
  let qh = 0, qt = 0
  const idx = (c, r) => r * cols + c
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) { dist[idx(c, r)] = 0; q[qt++] = idx(c, r) }
    }
  }
  if (qt === 0) { dist.fill(999); return dist }
  const D4 = [[1,0],[-1,0],[0,1],[0,-1]]
  while (qh < qt) {
    const cur = q[qh++], r = Math.floor(cur / cols), c = cur % cols, nd = dist[cur] + 1
    for (const [dc, dr] of D4) {
      const nc = c + dc, nr = r + dr
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
      const ni = idx(nc, nr)
      if (nd < dist[ni]) { dist[ni] = nd; q[qt++] = ni }
    }
  }
  return dist
}

function nearestWalkable(ci, cj) {
  if (!walkableGrid) return null
  if (walkableGrid[cj]?.[ci]) return { ci, cj }
  const seen = new Set([`${ci},${cj}`])
  const q = [[ci, cj]]
  let qh = 0, steps = 0
  while (qh < q.length && steps < 12000) {
    const [x, y] = q[qh++]
    steps++
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= logicalCols || ny >= logicalRows) continue
        const k = `${nx},${ny}`
        if (seen.has(k)) continue
        seen.add(k)
        if (walkableGrid[ny][nx]) return { ci: nx, cj: ny }
        q.push([nx, ny])
      }
    }
  }
  return null
}

// ===== A* 算法 =====
const NEI8 = []
for (let dy = -1; dy <= 1; dy++)
  for (let dx = -1; dx <= 1; dx++)
    if (dx || dy) NEI8.push([dx, dy])

function astar(start, goal) {
  if (!walkableGrid) return null
  const { ci: sc, cj: sr } = start, { ci: gc, cj: gr } = goal
  if (!walkableGrid[sr]?.[sc] || !walkableGrid[gr]?.[gc]) return null

  const cols = logicalCols, rows = logicalRows, inf = 1e30
  const idx = (c, r) => r * cols + c
  const gScore = new Float64Array(rows * cols).fill(inf)
  const fScore = new Float64Array(rows * cols).fill(inf)
  const came  = new Int32Array(rows * cols).fill(-1)
  const cameDir = new Int8Array(rows * cols).fill(-1)

  const h = (c, r) => Math.hypot(gc - c, gr - r)
  const baseStep = GRID_STRIDE * MAP_RESOLUTION * MAP_ZOOM_FACTOR
  const clearAt = (c, r) => clearanceGrid ? clearanceGrid[idx(c, r)] : 999
  const wallCost = (c, r) => WALL_PENALTY_VAL / (clearAt(c, r) + 0.35)

  const si = idx(sc, sr)
  gScore[si] = 0; fScore[si] = h(sc, sr)
  const open = [si]
  const inOpen = new Set([si])

  while (open.length) {
    let bestI = 0, bestF = fScore[open[0]]
    for (let i = 1; i < open.length; i++) { if (fScore[open[i]] < bestF) { bestF = fScore[open[i]]; bestI = i } }
    const cur = open.splice(bestI, 1)[0]
    inOpen.delete(cur)
    const cr = Math.floor(cur / cols), cc = cur % cols
    if (cc === gc && cr === gr) {
      const path = []; let p = cur
      while (p !== -1) { const r = Math.floor(p / cols), c = p % cols; path.push({ ci: c, cj: r }); p = came[p] }
      return path.reverse()
    }
    for (let dir = 0; dir < NEI8.length; dir++) {
      const [dx, dy] = NEI8[dir], nc = cc + dx, nr = cr + dy
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || !walkableGrid[nr][nc]) continue
      if (dx && dy && (!walkableGrid[cr][nc] || !walkableGrid[nr][cc])) continue
      const ni = idx(nc, nr)
      const diag = dx && dy
      const cost = Math.hypot(dx, dy) * baseStep + (diag ? DIAGONAL_PENALTY_VAL : 0)
      const turn = (cameDir[cur] === -1 || cameDir[cur] === dir) ? 0 : TURN_PENALTY_VAL
      const tentative = gScore[cur] + cost + wallCost(nc, nr) + turn
      if (tentative < gScore[ni]) {
        came[ni] = cur; cameDir[ni] = dir
        gScore[ni] = tentative; fScore[ni] = tentative + h(nc, nr)
        if (!inOpen.has(ni)) { open.push(ni); inOpen.add(ni) }
      }
    }
  }
  return null
}

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
    if (MIN_SMOOTH_CLEARANCE > 0 && clearanceGrid && clearanceGrid[y0 * cols + x0] < MIN_SMOOTH_CLEARANCE) return false
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x0 += sx }
    if (e2 < dx)  { err += dx; y0 += sy }
  }
  return true
}

function smoothPathCells(path) {
  if (!path || path.length < 3) return path
  const out = []; let i = 0
  while (i < path.length) {
    out.push(path[i])
    if (i === path.length - 1) break
    let j = path.length - 1
    for (; j > i + 1; j--) { if (hasLineOfSight(path[i], path[j])) break }
    i = j
  }
  return out
}

// ===== 徽章 =====
function attachBadge(controller, cfg, lngLat) {
  const el = controller.marker.getElement()
  el.style.width = '48px'; el.style.height = '48px'; el.style.overflow = 'visible'
  const badge = document.createElement('div')
  badge.className = 'robot-info-badge'
  badge.innerHTML = `
    <div class="badge-name"><span class="badge-dot" style="background:${cfg.color}"></span>${cfg.name}</div>
    <div class="badge-coord">${formatCoord(lngLat)}</div>`
  el.appendChild(badge)
  return badge.querySelector('.badge-coord')
}

// ===== 核心地图 =====
async function initMap() {
  await bicMap.init()
  map = bicMap.createMap({ container: 'locationMap', center: [116.4074, 39.9042], zoom: 18, backgroundColor: '#fff' })
  bicMap.addZoomControl(map, 'bottom-right')
  map.on('load', () => loadSlamAndRobots())
}

async function loadSlamAndRobots() {
  try {
    const result = await bicMap.loadSlamMap(map, {
      startX: MAP_START_X, startY: MAP_START_Y,
      xGridCount: MAP_X_GRID_COUNT, yGridCount: MAP_Y_GRID_COUNT,
      resolution: MAP_RESOLUTION, imagePath: slamImage,
      canvasId: 'canvasMap', fitBounds: true, zoomFactor: MAP_ZOOM_FACTOR
    })
    cacheCameraBound = result.cameraBound
    rebuildOccupancy()
    mapReady.value = true
    spawnRobots()
    startSimulation()
  } catch (e) {
    console.error('加载地图失败:', e)
  }
}

function routeToCartPoints(route) {
  return route.map(([fx, fy]) => fracToCartPos(fx, fy))
}

// ===== 创建机器人 =====
function spawnRobots() {
  ROBOT_CONFIGS.forEach((cfg, i) => {
    // 优先使用预计算的固定路径，否则用 PATROL_ROUTES
    let route
    if (ROBOT_FIXED_PATHS[i]?.length > 0) {
      route = ROBOT_FIXED_PATHS[i].map(gpsToCart)
    } else {
      route = routeToCartPoints(PATROL_ROUTES[i])
    }

    const cartPos    = { ...route[0] }
    const nextIdx    = 1 % route.length
    const cartTarget = { ...route[nextIdx] }
    const heading    = cartBearing(cartPos, cartTarget)
    const lngLat     = cartToGPS(cartPos.x, cartPos.y)

    const controller = bicMap.addDirectionalMarker(map, lngLat, {
      imagePath: cfg.icon, initialRotation: -heading,
      draggable: false, rotationControl: false, initialEditMode: false, size: 48
    })

    const useFixedPath = ROBOT_FIXED_PATHS[i]?.length > 0
    const coordEl = attachBadge(controller, cfg, lngLat)
    runtimes.push({ cartPos, cartTarget, heading, controller, coordEl, route, routeIndex: nextIdx, useFixedPath })
  })
}

// ===== 模拟巡逻（循环） =====
function startSimulation() {
  simIntervalId = setInterval(() => {
    const dt = UPDATE_MS / 1000
    runtimes.forEach((rt, i) => {
      const cfg  = ROBOT_CONFIGS[i]
      const dist = cartDist(rt.cartPos, rt.cartTarget)
      const step = cfg.speed * dt

      // 固定路径：到达判定 = 当前步长能走完剩余距离（细粒度路点专用）
      // 备用路线：用固定阈值（路点间距较大）
      const arrived = rt.useFixedPath ? (dist <= step) : (dist < ARRIVAL_THRESHOLD)
      if (arrived) {
        rt.routeIndex = (rt.routeIndex + 1) % rt.route.length
        rt.cartTarget = { ...rt.route[rt.routeIndex] }
      }

      const bearing  = cartBearing(rt.cartPos, rt.cartTarget)
      const actualStep = Math.min(step, cartDist(rt.cartPos, rt.cartTarget))
      const rad      = Math.atan2(rt.cartTarget.x - rt.cartPos.x, rt.cartTarget.y - rt.cartPos.y)
      const newPos   = { x: rt.cartPos.x + Math.sin(rad) * actualStep, y: rt.cartPos.y + Math.cos(rad) * actualStep }

      // 固定路径已保证坐标合法，不做 clamp；备用路线仍 clamp 防止越界
      rt.cartPos = rt.useFixedPath ? newPos : clampCartPos(newPos)
      rt.heading = bearing

      const lngLat = cartToGPS(rt.cartPos.x, rt.cartPos.y)
      rt.controller.setPosition(lngLat)
      rt.controller.setRotation(-bearing)
      rt.coordEl.textContent = formatCoord(lngLat)
    })
  }, UPDATE_MS)
}

// ===== 路径生成模式 =====
function enterGenMode() {
  if (!mapReady.value || !walkableGrid) return
  genMode.value = true
  genRobotIdx.value = 0
  genPickedLngLats.value = []
  genStatus.value = '点击「绘制点位」在地图上添加路点'
}

function exitGenMode() {
  detachGenClick()
  genPickActive.value = false
  genMode.value = false
  setMapCursor('')
  removeAllGenLayers()
}

function switchToRobot(idx) {
  saveCurrentPickedToBuffer()
  genRobotIdx.value = idx
  genPickedLngLats.value = []
  genStatus.value = `已切换至 ${ROBOT_CONFIGS[idx].name}，点击「绘制点位」添加路点`
  if (genPickActive.value) {
    genPickActive.value = false
    detachGenClick()
    setMapCursor('')
  }
  drawAllPlannedPaths()
}

function saveCurrentPickedToBuffer() {
  // picked waypoints are planning inputs; they are cleared on robot switch
}

function togglePick() {
  if (!genPickActive.value) {
    genPickActive.value = true
    attachGenClick()
    setMapCursor('crosshair')
    genStatus.value = '绘制中：单击地图添加路点，再次点击「停止绘制」结束'
  } else {
    genPickActive.value = false
    detachGenClick()
    setMapCursor('')
    genStatus.value = `已记录 ${genPickedLngLats.value.length} 个路点，点击「规划 A* 路径」生成路径`
  }
}

function attachGenClick() {
  if (genClickHandler || !map) return
  genClickHandler = (e) => {
    const { lng, lat } = e.lngLat
    const pixel = lngLatToPixel(lng, lat)
    if (!pixel) return
    const lc = pixelToLogical(pixel.px, pixel.py)
    const cell = nearestWalkable(lc.ci, lc.cj)
    if (!cell) { genStatus.value = '附近无可走区域，请换个位置'; return }
    genPickedLngLats.value = [...genPickedLngLats.value, [lng, lat]]
    genStatus.value = `已添加 ${genPickedLngLats.value.length} 个路点`
    updateWaypointLayer()
  }
  map.on('click', genClickHandler)
}

function detachGenClick() {
  if (genClickHandler && map) { map.off('click', genClickHandler); genClickHandler = null }
}

function setMapCursor(cursor) {
  if (map?.getCanvas) map.getCanvas().style.cursor = cursor || ''
}

// 规划当前机器人的 A* 路径
function planCurrentRobotPath() {
  if (genPickedLngLats.value.length < 2) {
    genStatus.value = '请至少添加 2 个路点'; return
  }
  if (!walkableGrid) { genStatus.value = '地图栅格未就绪'; return }

  const pts = genPickedLngLats.value
  const allWaypoints = []
  let failed = false

  for (let k = 0; k < pts.length - 1; k++) {
    const fromPx = lngLatToPixel(pts[k][0], pts[k][1])
    const toPx   = lngLatToPixel(pts[k + 1][0], pts[k + 1][1])
    if (!fromPx || !toPx) { failed = true; break }

    const fromLC = pixelToLogical(fromPx.px, fromPx.py)
    const toLC   = pixelToLogical(toPx.px, toPx.py)
    const fromCell = nearestWalkable(fromLC.ci, fromLC.cj)
    const toCell   = nearestWalkable(toLC.ci, toLC.cj)
    if (!fromCell || !toCell) { failed = true; break }

    const rawPath = astar(fromCell, toCell)
    if (!rawPath) { failed = true; break }

    const smoothed = smoothPathCells(rawPath)
    const segment  = smoothed.map(({ ci, cj }) => logicalCenterToLngLat(ci, cj))
    // 去掉首点（与上一段的末点重叠），首段保留
    if (k === 0) allWaypoints.push(...segment)
    else allWaypoints.push(...segment.slice(1))
  }

  if (failed) {
    genStatus.value = '路径规划失败，部分区域不可达，请重新选点'; return
  }

  // 补一个回到起点的闭合路段
  const lastPt  = pts[pts.length - 1]
  const firstPt = pts[0]
  const lastPx  = lngLatToPixel(lastPt[0], lastPt[1])
  const firstPx = lngLatToPixel(firstPt[0], firstPt[1])
  if (lastPx && firstPx) {
    const lastLC    = pixelToLogical(lastPx.px, lastPx.py)
    const firstLC   = pixelToLogical(firstPx.px, firstPx.py)
    const lastCell  = nearestWalkable(lastLC.ci, lastLC.cj)
    const firstCell = nearestWalkable(firstLC.ci, firstLC.cj)
    if (lastCell && firstCell) {
      const raw = astar(lastCell, firstCell)
      if (raw) {
        const seg = smoothPathCells(raw).map(({ ci, cj }) => logicalCenterToLngLat(ci, cj))
        allWaypoints.push(...seg.slice(1))
      }
    }
  }

  const newPaths = [...genPlannedPaths.value]
  newPaths[genRobotIdx.value] = allWaypoints
  genPlannedPaths.value = newPaths

  genStatus.value = `✓ 规划完成，共 ${allWaypoints.length} 个路点（已包含闭合路段）`

  // 停止绘制模式
  if (genPickActive.value) {
    genPickActive.value = false
    detachGenClick()
    setMapCursor('')
  }

  drawAllPlannedPaths()
}

function clearCurrentRobot() {
  genPickedLngLats.value = []
  const newPaths = [...genPlannedPaths.value]
  newPaths[genRobotIdx.value] = []
  genPlannedPaths.value = newPaths
  genStatus.value = '已清除，重新添加路点'
  drawAllPlannedPaths()
  removeWaypointLayer()
}

// ===== MapLibre 可视化（路径预览）=====
const SRC_WP   = 'gen-waypoints-src'
const LYR_WP   = 'gen-waypoints-lyr'
const SRC_PATH = (i) => `gen-path-src-${i}`
const LYR_PATH = (i) => `gen-path-lyr-${i}`

function ensureSource(srcId, data) {
  if (!map) return
  if (map.getSource(srcId)) map.getSource(srcId).setData(data)
  else map.addSource(srcId, { type: 'geojson', data })
}

function ensureLayer(lyrId, srcId, type, paint, layout = {}) {
  if (!map || map.getLayer(lyrId)) return
  map.addLayer({ id: lyrId, type, source: srcId, paint, layout })
}

function updateWaypointLayer() {
  const pts = genPickedLngLats.value
  const fc = { type: 'FeatureCollection', features: pts.map((pt, i) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: pt },
    properties: { idx: i + 1 }
  }))}
  ensureSource(SRC_WP, fc)
  if (!map.getLayer(LYR_WP)) {
    ensureLayer(LYR_WP, SRC_WP, 'circle', {
      'circle-radius': 6, 'circle-color': ROBOT_CONFIGS[genRobotIdx.value].color,
      'circle-stroke-width': 2, 'circle-stroke-color': '#fff'
    })
  }
}

function removeWaypointLayer() {
  if (!map) return
  if (map.getLayer(LYR_WP)) map.removeLayer(LYR_WP)
  if (map.getSource(SRC_WP)) map.removeSource(SRC_WP)
}

function drawAllPlannedPaths() {
  if (!map) return
  genPlannedPaths.value.forEach((path, i) => {
    const srcId = SRC_PATH(i), lyrId = LYR_PATH(i)
    const coords = path.length > 1 ? path : []
    const fc = {
      type: 'FeatureCollection',
      features: coords.length > 1 ? [{
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {}
      }] : []
    }
    ensureSource(srcId, fc)
    if (!map.getLayer(lyrId)) {
      ensureLayer(lyrId, srcId, 'line',
        { 'line-color': ROBOT_CONFIGS[i].color, 'line-width': 2, 'line-opacity': 0.85 },
        { 'line-cap': 'round', 'line-join': 'round' }
      )
    }
  })
}

function removeAllGenLayers() {
  if (!map) return
  removeWaypointLayer()
  ROBOT_CONFIGS.forEach((_, i) => {
    const lyrId = LYR_PATH(i), srcId = SRC_PATH(i)
    if (map.getLayer(lyrId)) map.removeLayer(lyrId)
    if (map.getSource(srcId)) map.removeSource(srcId)
  })
}

// ===== 导出路径代码 =====
function exportPaths() {
  const paths = genPlannedPaths.value
  const hasSome = paths.some(p => p.length > 0)
  if (!hasSome) { genStatus.value = '请先规划至少一个机器人的路径'; return }

  const lines = [
    '// ===== 预计算固定路径 =====',
    '// 将此常量粘贴到 location/index.vue 文件顶部，替换原有的 ROBOT_FIXED_PATHS 常量',
    'const ROBOT_FIXED_PATHS = [',
  ]

  paths.forEach((path, i) => {
    const name = ROBOT_CONFIGS[i].name
    if (path.length === 0) {
      lines.push(`  [], // ${name}（未生成，将使用默认 PATROL_ROUTES）`)
    } else {
      lines.push(`  // ${name}（${path.length} 个路点）`)
      lines.push('  [')
      path.forEach(([lng, lat]) => {
        lines.push(`    [${lng.toFixed(7)}, ${lat.toFixed(7)}],`)
      })
      lines.push('  ],')
    }
  })
  lines.push(']')

  generatedCode.value = lines.join('\n')
  showCodeModal.value = true

  console.log('[location] 生成的固定路径数据：')
  console.log(generatedCode.value)
}

function copyCode() {
  if (codeTextarea.value) {
    codeTextarea.value.select()
    document.execCommand('copy')
    copyHint.value = '已复制！'
    setTimeout(() => { copyHint.value = '' }, 2000)
  }
}
</script>

<style scoped>
.app-root {
  width: 100vw; height: 100vh;
  display: flex; flex-direction: column;
  overflow: hidden; position: fixed; top: 0; left: 0;
  background: linear-gradient(160deg, #e8f4fc 0%, #eef1f8 30%, #f0f6fb 60%, #e6f0fa 100%);
}

/* ===== MAP ===== */
.map-area { flex: 1; position: relative; overflow: hidden; z-index: 10; }
.grid-bg {
  position: absolute; inset: 0; opacity: 0.04;
  background-image:
    linear-gradient(rgba(14,165,233,1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14,165,233,1) 1px, transparent 1px);
  background-size: 40px 40px;
}
.map-container { position: absolute; inset: 12px; border-radius: 16px; overflow: hidden;
  background: rgb(129 182 220 / 49%);
  box-shadow: 0 4px 30px rgba(14,165,233,0.06), 0 0 0 1px rgba(255,255,255,0.8) inset;
}
.map-gl { width: 100%; height: 100%; }

/* ===== 路径生成面板 ===== */
.gen-panel {
  position: absolute; top: 12px; left: 12px; z-index: 30;
  width: 240px;
  background: rgba(5, 15, 40, 0.92);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(80, 140, 255, 0.25);
  border-radius: 12px;
  padding: 14px 14px 12px;
  color: #c8dff8;
  font-size: 12px;
  box-shadow: 0 8px 32px rgba(0, 10, 50, 0.5);
  display: flex; flex-direction: column; gap: 10px;
}
.gen-panel-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 700; color: #e0eeff;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(80, 140, 255, 0.2);
}
.gen-close {
  position: absolute; top: 10px; right: 10px;
  background: none; border: none; color: #7090b0; cursor: pointer; padding: 2px;
  border-radius: 4px; transition: color 0.2s;
}
.gen-close:hover { color: #c8dff8; }

/* 机器人标签 */
.robot-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.robot-tab {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(80, 140, 255, 0.2);
  background: rgba(255,255,255,0.04); cursor: pointer; color: #8aaac8; font-size: 11px;
  transition: all 0.2s;
}
.robot-tab:hover { background: rgba(255,255,255,0.08); color: #c8dff8; }
.robot-tab.active { background: rgba(80, 140, 255, 0.2); border-color: rgba(80, 140, 255, 0.5); color: #e0eeff; }
.robot-tab.done { border-color: rgba(0, 200, 120, 0.4); }
.tab-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.tab-check { color: #00c878; font-size: 10px; }

/* 当前机器人信息 */
.gen-info { display: flex; flex-direction: column; gap: 4px; }
.gen-robot-name { display: flex; align-items: center; gap: 6px; font-weight: 600; color: #d0e8ff; }
.robot-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.gen-status { color: #7090b0; font-size: 11px; line-height: 1.4; min-height: 28px; }

/* 步骤说明 */
.gen-steps { margin: 0; padding-left: 16px; color: #607090; font-size: 11px; line-height: 1.6; }

/* 操作按钮 */
.gen-actions, .gen-nav { display: flex; gap: 6px; flex-wrap: wrap; }
.gen-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 5px 10px; border-radius: 7px; border: 1px solid rgba(80, 140, 255, 0.25);
  background: rgba(255,255,255,0.06); color: #a0c0e0; font-size: 11px;
  cursor: pointer; transition: all 0.2s; white-space: nowrap;
}
.gen-btn:hover:not(:disabled) { background: rgba(80, 140, 255, 0.2); color: #e0eeff; border-color: rgba(80, 140, 255, 0.5); }
.gen-btn.active { background: rgba(80, 140, 255, 0.25); border-color: rgba(80, 140, 255, 0.6); color: #b0d8ff; }
.gen-btn.danger { border-color: rgba(255, 80, 80, 0.3); }
.gen-btn.danger:hover:not(:disabled) { background: rgba(255, 80, 80, 0.2); border-color: rgba(255, 80, 80, 0.5); color: #ffb0b0; }
.gen-btn.secondary { background: rgba(255,255,255,0.03); color: #7090b0; }
.gen-btn.secondary:hover:not(:disabled) { color: #c8dff8; }
.gen-btn.export { background: rgba(0, 200, 120, 0.12); border-color: rgba(0, 200, 120, 0.3); color: #80e8b0; width: 100%; justify-content: center; }
.gen-btn.export:hover:not(:disabled) { background: rgba(0, 200, 120, 0.2); }
.gen-btn:disabled { opacity: 0.35; cursor: not-allowed; }

/* 导出区 */
.gen-export { display: flex; flex-direction: column; gap: 6px; padding-top: 6px; border-top: 1px solid rgba(80, 140, 255, 0.15); }
.export-progress { font-size: 11px; color: #5080a0; text-align: center; }

/* ===== 代码导出模态框 ===== */
.code-modal-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0, 5, 20, 0.7); backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
}
.code-modal {
  width: min(90vw, 720px); max-height: 80vh;
  background: rgba(5, 15, 45, 0.97);
  border: 1px solid rgba(80, 140, 255, 0.3);
  border-radius: 16px;
  padding: 20px;
  display: flex; flex-direction: column; gap: 12px;
  box-shadow: 0 20px 60px rgba(0, 10, 50, 0.6);
  color: #c8dff8;
}
.code-modal-header { display: flex; align-items: center; justify-content: space-between; }
.code-modal-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 15px; font-weight: 700; color: #e0eeff;
}
.code-close {
  background: none; border: none; color: #607090; cursor: pointer; padding: 4px;
  border-radius: 6px; transition: color 0.2s;
}
.code-close:hover { color: #c8dff8; }
.code-modal-desc {
  font-size: 12px; color: #6080a0; line-height: 1.5;
}
.code-modal-desc code {
  background: rgba(80, 140, 255, 0.15); border-radius: 3px; padding: 1px 5px; color: #90c0ff;
}
.code-area-wrap { flex: 1; overflow: hidden; min-height: 0; }
.code-area {
  width: 100%; height: 340px; resize: none;
  background: rgba(0, 5, 20, 0.8); border: 1px solid rgba(80, 140, 255, 0.2);
  border-radius: 8px; padding: 12px; color: #90c8f0;
  font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
  font-size: 11.5px; line-height: 1.6; outline: none; box-sizing: border-box;
}
.code-modal-footer {
  display: flex; align-items: center; gap: 8px; justify-content: flex-end;
}
.copy-hint { font-size: 12px; color: #00c878; margin-right: auto; min-height: 18px; }
.code-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 12px;
  border: 1px solid rgba(80, 140, 255, 0.35);
  background: rgba(80, 140, 255, 0.15); color: #a0c8f0; transition: all 0.2s;
}
.code-btn:hover { background: rgba(80, 140, 255, 0.28); color: #e0eeff; }
.code-btn.secondary { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12); color: #7090b0; }
.code-btn.secondary:hover { background: rgba(255,255,255,0.08); color: #c8dff8; }

/* ===== 机器人信息徽章 ===== */
:global(.robot-info-badge) {
  position: absolute;
  bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  background: rgba(5, 18, 48, 0.86); backdrop-filter: blur(10px);
  border: 1px solid rgba(80, 140, 255, 0.28); border-radius: 8px;
  padding: 5px 9px; white-space: nowrap; pointer-events: none;
  box-shadow: 0 4px 16px rgba(0, 20, 80, 0.4);
}
:global(.robot-info-badge::after) {
  content: ''; position: absolute;
  bottom: -6px; left: 50%; transform: translateX(-50%);
  border: 6px solid transparent; border-top-color: rgba(5, 18, 48, 0.86); border-bottom: none;
}
:global(.badge-name) { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; color: #ddeeff; }
:global(.badge-dot) { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
:global(.badge-coord) { font-size: 10px; color: #7aacdd; font-family: 'Space Mono', 'Courier New', monospace; }
</style>
