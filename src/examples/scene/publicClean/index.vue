<!--
 * @Author: houser.hao@humanoid.com
 * @Date: Do not edit
 * @LastEditTime: Do not edit
 * @LastEditors: houser.hao@humanoid.com
 * @Description: 公共区域清洁场景（服务区）：地图框选清洁区域 → 弓字形覆盖轨迹规划（基于 SLAM 占据栅格 + 净空距离场避让建筑物边缘，转移段 A* 绕障） → 机器人沿轨迹清洁并实时渲染已清洁区域
 * @FilePath: Do not edit
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="app-root">
    <canvas id="publicCleanCanvas" class="canvas-hidden"></canvas>

    <AppHeader title="公共区域清洁 框选区域 · 覆盖清洁" />

    <!-- 框选提示条 -->
    <Transition name="hint-fade">
      <div v-if="selecting" class="nav-overlay">
        <div class="hint-pill">
          <Brush class="hint-icon" :size="15" />
          <span>在地图上按住拖拽，框选一块需要清洁的公共区域</span>
          <button class="cancel-btn" @click="cancelSelect">
            <X :size="13" /> 取消
          </button>
        </div>
      </div>
    </Transition>

    <!-- 完成提示 -->
    <Transition name="toast-fade">
      <div v-if="navSuccess" class="success-toast">
        <CheckCircle :size="15" />
        <span>区域清洁完成</span>
      </div>
    </Transition>

    <main class="map-area">
      <div class="grid-bg"></div>

      <div class="map-container" :class="{ 'nav-mode': selecting }">
        <div id="publicCleanMap" class="map-gl"></div>

        <aside class="overlay-panel" aria-label="清洁信息">
          <div class="panel-title">清洁状态</div>
          <p v-if="!slamReady" class="hint-wait">正在加载 SLAM 底图…</p>
          <template v-else>
            <dl class="stat-grid">
              <div><dt>状态</dt><dd>{{ statusLabel }}</dd></div>
              <div><dt>进度</dt><dd class="tabular">{{ progressPercent }}%</dd></div>
              <div><dt>框选面积</dt><dd class="tabular">{{ selectedAreaM2.toFixed(1) }} m²</dd></div>
              <div><dt>轨迹总长</dt><dd class="tabular">{{ plannedLengthM.toFixed(1) }} m</dd></div>
              <div><dt>已清洁</dt><dd class="tabular">{{ cleanedLengthM.toFixed(1) }} m</dd></div>
              <div><dt>清洁宽度</dt><dd class="tabular">{{ SWATH_M.toFixed(1) }} m</dd></div>
            </dl>
            <div class="legend">
              <span class="dot dot--route"></span>规划清洁轨迹（弓字形覆盖）
            </div>
            <div class="legend">
              <span class="dot dot--cleaned"></span>已清洁区域（清洁带）
            </div>
            <div class="legend">
              <span class="dot dot--area"></span>框选清洁区域
            </div>
          </template>
        </aside>
      </div>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { Brush, CheckCircle, Frame, Pause, Play, RotateCcw, X } from 'lucide-vue-next'

import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'

import bicMap from '../../../bicMap/core/bicmap-gl'
import baseMapImage from '../../assets/home-thum/scene_servicearea.png'
import robotIcon from '../../assets/bicmap_robot.png'

// ===== SLAM 底图参数（与 slam_transparent.png 对齐） =====
const MAP_START_X = -58.999993705749512
const MAP_START_Y = -21.349997329711914
const MAP_X_GRID_COUNT = 2752
const MAP_Y_GRID_COUNT = 1536
const MAP_RESOLUTION = 0.05
const MAP_CENTER = [116.4074, 39.9042]
const MAP_ZOOM = 18

// ===== 占据栅格参数（与 pathPlanning / singleNavigation 对齐） =====
const MAP_ZOOM_FACTOR = 2
const GRID_STRIDE = 6             // 逻辑栅格步长（像素），单格 = 6 × 0.05 = 0.3 m，较细以贴合墙体轮廓
const LUMA_THRESHOLD = 120        // 硬障碍亮度阈值：墙体/边框/深色线（亮度低于此值）
// 地面亮度阈值：可行驶车道亮度≈244，浅蓝色实心填充（绿化岛/隔离带/座椅区/房间）亮度≈222，
// 介于 [LUMA_THRESHOLD, FLOOR_LUMA) 之间判为「软障碍」，使深色/浅蓝填充区域同样被避让
const FLOOR_LUMA = 235
// 单格内硬障碍像素占比超过该值即判为障碍：整格采样而非仅取中心像素，
// 可靠识别细墙线/建筑边缘，避免薄墙落在采样缝隙被漏判
const OBSTACLE_FILL = 0.18
// 单格内软障碍（浅色实心填充）像素占比阈值：实心填充区（≈100%）判为障碍，
// 而车位线等细标线占比低，不会被误判，避免可行驶车道被切碎
const TINT_FILL = 0.55

// ===== 覆盖清洁参数 =====
const CELL_METERS = GRID_STRIDE * MAP_RESOLUTION   // 单逻辑格边长（米）= 0.3
const SWATH_M = 0.3               // 清洁带宽度（米），贴近真实清洁机器人刷盘宽度
// 行间距 = 1 格 = 0.3 m，与清洁带等宽，相邻清洁带恰好拼接、无遗漏
const ROW_STRIDE = 1
// 清洁覆盖与建筑物边缘的最小安全净空（格）：约半个清洁带宽 + 安全余量 ≈ 0.9 m，
// 保证整条清洁带明显避让 SLAM 底图的墙体/建筑物边缘
const CLEAR_CELLS = 3
// 转移寻路（行间/段间绕行）的最小净空（格）≈ 0.3 m：仅需保证机身不贴墙，
// 比 CLEAR_CELLS 宽松以保持走廊连通，避免 A* 找不到路而退化为直线穿墙
const TRAVERSE_CLEAR = 1

// ===== 动画参数 =====
const ROBOT_SPEED = 0.8           // m/s
const ANIM_FRAME_MS = 40          // ms
const ICON_HEAD_OFFSET = 90       // 机器人图标默认朝向（正右 = 东 = 90°）

// ===== 图层样式 =====
const ROUTE_STYLE = { id: 'clean-route', color: '#00C2FF', width: 1.8, opacity: 0.9, dashType: 'dashed', showArrow: false }
const CLEANED_STYLE = { color: '#00e1a0', opacity: 0.32 }
const SELECTION_STYLE = {
  id: 'clean-area',
  fillColor: '#0066ff',
  outlineColor: '#0066ff',
  highlightColor: '#0066ff',
  fillOpacity: 0.08,
  outlineWidth: 2,
  filled: true
}

// ===== 响应式状态 =====
const slamReady = ref(false)
const selecting = ref(false)
const navSuccess = ref(false)
const playState = ref('idle')     // idle | planned | playing | paused | finished
const progress = ref(0)
const selectedAreaM2 = ref(0)
const plannedLengthM = ref(0)

// ===== computed =====
const cleanedLengthM = computed(() => plannedLengthM.value * progress.value)
const progressPercent = computed(() => Math.round(progress.value * 1000) / 10)
const hasPlan = computed(() => playState.value !== 'idle' && coverage.length > 1)
const statusLabel = computed(() => {
  const MAP = { idle: '待框选', planned: '待清洁', playing: '清洁中', paused: '已暂停', finished: '已完成' }
  if (selecting.value) return '框选中'
  return MAP[playState.value] ?? playState.value
})

const footerButtons = computed(() => {
  if (selecting.value) {
    return [{ label: '取消框选', active: true, icon: X, onClick: cancelSelect }]
  }
  const buttons = [{
    label: hasPlan.value ? '重新框选' : '框选清洁区域',
    active: false,
    icon: Frame,
    disabled: !slamReady.value,
    onClick: startSelect
  }]
  if (playState.value === 'planned' || playState.value === 'finished') {
    buttons.push({ label: '开始清洁', active: true, icon: Play, disabled: !hasPlan.value, onClick: startCleaning })
  } else if (playState.value === 'playing') {
    buttons.push({ label: '暂停', active: false, icon: Pause, onClick: pauseCleaning })
  } else if (playState.value === 'paused') {
    buttons.push({ label: '继续', active: true, icon: Play, onClick: resumeCleaning })
  }
  buttons.push({ label: '重置', active: false, icon: RotateCcw, disabled: !hasPlan.value, onClick: resetCleaning })
  return buttons
})

// ===== 非响应式实例 / 状态 =====
let map = null
let drawCtrl = null
let routeCtrl = null
let cleanedCtrl = null
let selectionCtrl = null
let robotCtrl = null
let successTimer = null

// 覆盖轨迹（弓字形航点，[lng, lat]）与动画游标
let coverage = []
let segIdx = 0
let curPos = null
let animId = null

// 占据栅格
let walkableGrid = null
let clearanceGrid = null   // 各可走格到最近障碍的距离（格），用于避让建筑物边缘
let logicalCols = 0
let logicalRows = 0

// ===== 生命周期 =====
onMounted(() => { initMap() })

onBeforeUnmount(() => {
  stopAnim()
  clearTimeout(successTimer)
  drawCtrl?.disable?.()
  robotCtrl?.remove?.()
  routeCtrl?.remove?.()
  cleanedCtrl?.remove?.()
  selectionCtrl?.remove?.()
  map?.remove?.()
  map = null
})

// ===== 地图初始化 =====
async function initMap() {
  try {
    await bicMap.init()
    map = bicMap.createMap({
      container: 'publicCleanMap',
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      backgroundColor: '#fff'
    })
    bicMap.addZoomControl(map, 'bottom-right')
    map.on('load', () => { loadSlamMap() })
  } catch (err) {
    console.error('[publicClean] 初始化地图失败:', err)
  }
}

async function loadSlamMap() {
  if (!map) return
  try {
    await bicMap.loadSlamMap(map, {
      startX: MAP_START_X,
      startY: MAP_START_Y,
      xGridCount: MAP_X_GRID_COUNT,
      yGridCount: MAP_Y_GRID_COUNT,
      resolution: MAP_RESOLUTION,
      imagePath: baseMapImage,
      canvasId: 'publicCleanCanvas',
      fitBounds: true
    })
    rebuildOccupancy()
    initLayers()
    slamReady.value = true
  } catch (err) {
    console.error('[publicClean] 加载底图失败:', err)
  }
}

function initLayers() {
  selectionCtrl = bicMap.createPolygons(map, [], { ...SELECTION_STYLE })
  cleanedCtrl = bicMap.createWideLines(map, [], { showOutline: false, defaultColor: CLEANED_STYLE.color })
  routeCtrl = bicMap.createPolylines(map, [], { showArrow: false })
}

// ============================================================
//   占据栅格构建（从 SLAM 画布读取像素亮度）
// ============================================================
function rebuildOccupancy() {
  const canvas = document.getElementById('publicCleanCanvas')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)

  const s = GRID_STRIDE
  logicalCols = Math.ceil(MAP_X_GRID_COUNT / s)
  logicalRows = Math.ceil(MAP_Y_GRID_COUNT / s)

  const w = canvas.width, h = canvas.height
  walkableGrid = []
  for (let cj = 0; cj < logicalRows; cj++) {
    const row = []
    for (let ci = 0; ci < logicalCols; ci++) {
      // 整格采样（步长 2px）：分别统计硬障碍（墙体/深色线）与软障碍（浅色实心填充）占比
      let hard = 0, soft = 0, total = 0
      const px0 = ci * s, py0 = cj * s
      for (let yy = 0; yy < s; yy += 2) {
        const py = Math.min(h - 1, py0 + yy)
        for (let xx = 0; xx < s; xx += 2) {
          const px = Math.min(w - 1, px0 + xx)
          const base = (py * w + px) * 4
          total++
          if (data[base + 3] < 10) { hard++; continue }
          const luma = 0.2126 * data[base] + 0.7152 * data[base + 1] + 0.0722 * data[base + 2]
          if (luma < LUMA_THRESHOLD) hard++
          else if (luma < FLOOR_LUMA) soft++
        }
      }
      // 硬障碍少量像素即判障碍（细墙线），软障碍需大面积实心填充才判障碍（避开车位标线误判）
      const obstacle = total > 0 && (hard / total > OBSTACLE_FILL || soft / total > TINT_FILL)
      row.push(!obstacle)
    }
    walkableGrid.push(row)
  }

  // 多源 BFS 距离场：每个可走格到最近障碍（墙体/建筑边缘）的距离，供轨迹避让使用
  clearanceGrid = computeClearanceGrid(walkableGrid, logicalCols, logicalRows)
}

/**
 * 计算每个格子到最近障碍的距离（格子单位），多源 BFS
 * @param {boolean[][]} grid
 * @param {number} cols
 * @param {number} rows
 * @returns {Uint16Array}
 */
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

/** 该格是否可清洁：可通行且与建筑边缘保持安全净空 */
function isCleanable(ci, cj) {
  if (!walkableGrid[cj]?.[ci]) return false
  if (!clearanceGrid) return true
  return clearanceGrid[cj * logicalCols + ci] >= CLEAR_CELLS
}

/** 该格是否可通行（用于行间/段间转移绕行）：可通行且机身不贴墙，比可清洁条件宽松 */
function isTraversable(ci, cj) {
  if (!walkableGrid[cj]?.[ci]) return false
  if (!clearanceGrid) return true
  return clearanceGrid[cj * logicalCols + ci] >= TRAVERSE_CLEAR
}

// ===== 坐标转换 =====
/** GPS (lng, lat) → 图像像素 {px, py} */
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

/** 图像像素 → 逻辑栅格 {ci, cj} */
function pixelToLogical(px, py) {
  const s = GRID_STRIDE
  return {
    ci: Math.min(logicalCols - 1, Math.max(0, Math.floor(px / s))),
    cj: Math.min(logicalRows - 1, Math.max(0, Math.floor(py / s)))
  }
}

/** 逻辑栅格中心 → GPS [lng, lat] */
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

// ============================================================
//   弓字形（boustrophedon）覆盖轨迹规划
// ============================================================
/**
 * 在框选区域内生成弓字形覆盖清洁轨迹
 * @param {number[][]} ring 选区闭合环 [[lng, lat], ...]
 * @returns {number[][]} 覆盖航点 [[lng, lat], ...]
 */
function buildCoveragePath(ring) {
  if (!walkableGrid || !ring?.length) return []

  // 选区四角 → 像素包围盒 → 逻辑栅格包围盒
  let pxMin = Infinity, pxMax = -Infinity, pyMin = Infinity, pyMax = -Infinity
  for (const [lng, lat] of ring) {
    const p = lngLatToPixel(lng, lat)
    if (!p) continue
    pxMin = Math.min(pxMin, p.px); pxMax = Math.max(pxMax, p.px)
    pyMin = Math.min(pyMin, p.py); pyMax = Math.max(pyMax, p.py)
  }
  if (!Number.isFinite(pxMin)) return []

  const a = pixelToLogical(pxMin, pyMin)
  const b = pixelToLogical(pxMax, pyMax)
  const ciMin = Math.min(a.ci, b.ci), ciMax = Math.max(a.ci, b.ci)
  const cjMin = Math.min(a.cj, b.cj), cjMax = Math.max(a.cj, b.cj)

  // 逐行扫描得到弓字形「停靠点」（每段可清洁区间的两端），逐行交替方向
  const stops = []
  let dir = 1
  for (let cj = cjMin; cj <= cjMax; cj += ROW_STRIDE) {
    const runs = []
    let runStart = -1
    for (let ci = ciMin; ci <= ciMax; ci++) {
      const ok = isCleanable(ci, cj)
      if (ok && runStart < 0) runStart = ci
      if ((!ok || ci === ciMax) && runStart >= 0) {
        const runEnd = ok ? ci : ci - 1
        if (runEnd >= runStart) runs.push([runStart, runEnd])
        runStart = -1
      }
    }
    if (!runs.length) continue

    const ordered = dir === 1 ? runs : runs.slice().reverse()
    for (const [s, e] of ordered) {
      const head = dir === 1 ? s : e
      const tail = dir === 1 ? e : s
      stops.push({ ci: head, cj })
      if (tail !== head) stops.push({ ci: tail, cj })
    }
    dir *= -1
  }
  if (stops.length < 2) return []

  // 串联停靠点：行内整段直接连（必为可清洁直线）；跨行/跨段转移用 A* 绕行。
  // 转移寻路先在「可清洁」栅格上找路（尽量远离墙体），找不到再放宽到「可通行」栅格，
  // 保证总能找到一条不穿墙的连通路径，避免退化成直线穿越建筑物。
  const cells = [stops[0]]
  let cur = stops[0]
  for (let i = 1; i < stops.length; i++) {
    const to = stops[i]
    if (cur.ci === to.ci && cur.cj === to.cj) continue
    if (cur.cj === to.cj && rowRunClear(cur, to)) {
      cells.push(to)
      cur = to
      continue
    }
    const seg = astarCells(cur, to, isCleanable) || astarCells(cur, to, isTraversable)
    if (seg && seg.length > 1) {
      for (let k = 1; k < seg.length; k++) cells.push(seg[k])
      cur = to
    }
    // 否则该停靠点与当前位置不连通（极少数）：跳过它，从 cur 继续连接下一个，避免直线穿墙
  }
  if (cells.length < 2) return []

  const simplified = simplifyCellPath(cells)
  return dedupePath(simplified.map(c => logicalCenterToLngLat(c.ci, c.cj)))
}

/** 同一行内两端之间是否全程可清洁（直线段） */
function rowRunClear(a, b) {
  const lo = Math.min(a.ci, b.ci), hi = Math.max(a.ci, b.ci)
  for (let ci = lo; ci <= hi; ci++) {
    if (!isCleanable(ci, a.cj)) return false
  }
  return true
}

const NEI8 = []
for (let dy = -1; dy <= 1; dy++) {
  for (let dx = -1; dx <= 1; dx++) {
    if (dx !== 0 || dy !== 0) NEI8.push([dx, dy])
  }
}

/**
 * 在指定可通行栅格上做 A* 寻路，用于停靠点之间的避障转移
 * @param {{ci:number,cj:number}} start
 * @param {{ci:number,cj:number}} goal
 * @param {(ci:number,cj:number)=>boolean} passable 该格是否可通行
 * @returns {{ci:number,cj:number}[]|null}
 */
function astarCells(start, goal, passable) {
  if (!walkableGrid) return null
  const cols = logicalCols, rows = logicalRows
  if (!passable(start.ci, start.cj) || !passable(goal.ci, goal.cj)) return null

  const idx = (c, r) => r * cols + c
  const inf = 1e30
  const gScore = new Float64Array(rows * cols).fill(inf)
  const came = new Int32Array(rows * cols).fill(-1)
  const closed = new Uint8Array(rows * cols)
  const h = (c, r) => Math.hypot(goal.ci - c, goal.cj - r)
  // 远离墙体的格子代价更低，转移段也倾向走在空旷处（走廊中央）
  const wallCost = (c, r) => (clearanceGrid ? 2.0 / (clearanceGrid[idx(c, r)] + 0.35) : 0)

  // 二叉小顶堆（按 fScore 排序）：避免线性扫描，保证细栅格下寻路性能
  const heapIdx = []
  const heapF = []
  const heapPush = (node, f) => {
    let i = heapIdx.length
    heapIdx.push(node); heapF.push(f)
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heapF[p] <= heapF[i]) break
      ;[heapF[p], heapF[i]] = [heapF[i], heapF[p]]
      ;[heapIdx[p], heapIdx[i]] = [heapIdx[i], heapIdx[p]]
      i = p
    }
  }
  const heapPop = () => {
    const top = heapIdx[0]
    const lastNode = heapIdx.pop(), lastF = heapF.pop()
    if (heapIdx.length) {
      heapIdx[0] = lastNode; heapF[0] = lastF
      let i = 0
      const n = heapIdx.length
      for (;;) {
        const l = i * 2 + 1, r = l + 1
        let s = i
        if (l < n && heapF[l] < heapF[s]) s = l
        if (r < n && heapF[r] < heapF[s]) s = r
        if (s === i) break
        ;[heapF[s], heapF[i]] = [heapF[i], heapF[s]]
        ;[heapIdx[s], heapIdx[i]] = [heapIdx[i], heapIdx[s]]
        i = s
      }
    }
    return top
  }

  const si = idx(start.ci, start.cj)
  gScore[si] = 0
  heapPush(si, h(start.ci, start.cj))

  while (heapIdx.length) {
    const cur = heapPop()
    if (closed[cur]) continue
    closed[cur] = 1
    const cr = Math.floor(cur / cols), cc = cur % cols
    if (cc === goal.ci && cr === goal.cj) {
      const path = []
      let p = cur
      while (p !== -1) { path.push({ ci: p % cols, cj: Math.floor(p / cols) }); p = came[p] }
      return path.reverse()
    }
    for (const [dx, dy] of NEI8) {
      const nc = cc + dx, nr = cr + dy
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
      if (!passable(nc, nr)) continue
      // 防止斜向「擦角穿墙」：对角移动要求两个正交相邻格也可通行
      if (dx !== 0 && dy !== 0 && (!passable(cc + dx, cr) || !passable(cc, cr + dy))) continue
      const ni = idx(nc, nr)
      if (closed[ni]) continue
      const tentative = gScore[cur] + Math.hypot(dx, dy) + wallCost(nc, nr)
      if (tentative < gScore[ni]) {
        came[ni] = cur
        gScore[ni] = tentative
        heapPush(ni, tentative + h(nc, nr))
      }
    }
  }
  return null
}

/** 合并共线/同方向的连续格点，降低航点数量 */
function simplifyCellPath(cells) {
  if (cells.length < 3) return cells.slice()
  const out = [cells[0]]
  let pdx = Math.sign(cells[1].ci - cells[0].ci)
  let pdy = Math.sign(cells[1].cj - cells[0].cj)
  for (let i = 1; i < cells.length - 1; i++) {
    const dx = Math.sign(cells[i + 1].ci - cells[i].ci)
    const dy = Math.sign(cells[i + 1].cj - cells[i].cj)
    if (dx !== pdx || dy !== pdy) {
      out.push(cells[i])
      pdx = dx; pdy = dy
    }
  }
  out.push(cells[cells.length - 1])
  return out
}

/** 去除相邻重复航点 */
function dedupePath(points) {
  const out = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (last && last[0] === p[0] && last[1] === p[1]) continue
    out.push(p)
  }
  return out
}

// ===== 几何工具 =====
/** Haversine 距离（米） */
function haversineMeters(p, q) {
  const R = 6371000
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(q[1] - p[1])
  const dLng = toRad(q[0] - p[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p[1])) * Math.cos(toRad(q[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** 路径总长（米） */
function pathLengthMeters(path) {
  let sum = 0
  for (let i = 0; i < path.length - 1; i++) sum += haversineMeters(path[i], path[i + 1])
  return sum
}

/** 屏幕方位角（0° = 屏幕正上，顺时针）；纬度轴与屏幕 y 轴相反，故 dy 取反 */
function calcBearing(from, to) {
  const dx = to[0] - from[0]
  const dy = -(to[1] - from[1])
  return (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360
}

/** 按物理距离换算帧数，保持恒定速度 */
function calcSteps(from, to) {
  const distM = haversineMeters(from, to)
  const durationMs = Math.max(80, (distM / ROBOT_SPEED) * 1000)
  return Math.max(2, Math.round(durationMs / ANIM_FRAME_MS))
}

// ============================================================
//   框选交互
// ============================================================
function startSelect() {
  if (!slamReady.value || !map) return
  clearAll()
  selecting.value = true
  drawCtrl = bicMap.enableRectangleDrawing(map, {
    fillColor: '#0066ff',
    fillOpacity: 0.12,
    lineColor: '#0066ff',
    lineWidth: 2,
    onDrawComplete: onAreaDrawn
  })
}

function cancelSelect() {
  drawCtrl?.disable?.()
  drawCtrl = null
  selecting.value = false
  if (map) map.getCanvas().style.cursor = ''
}

/**
 * 框选完成回调：固化选区 → 规划覆盖轨迹 → 落位机器人
 * @param {Object} feature GeoJSON 多边形
 */
function onAreaDrawn(feature) {
  drawCtrl?.disable?.()
  drawCtrl = null
  selecting.value = false
  if (map) map.getCanvas().style.cursor = ''

  const ring = feature?.geometry?.coordinates?.[0]
  if (!ring || ring.length < 4) return

  // 渲染持久选区多边形
  selectionCtrl?.removePolygon?.(SELECTION_STYLE.id)
  selectionCtrl?.addPolygon?.({ points: ring, ...SELECTION_STYLE })
  try {
    selectedAreaM2.value = bicMap.turf.area(bicMap.turf.polygon([ring]))
  } catch (e) {
    selectedAreaM2.value = 0
  }

  // 规划弓字形覆盖轨迹
  coverage = buildCoveragePath(ring)
  if (coverage.length < 2) {
    plannedLengthM.value = 0
    playState.value = 'idle'
    return
  }
  plannedLengthM.value = pathLengthMeters(coverage)

  // 绘制规划轨迹（青色虚线）
  routeCtrl?.clear?.()
  routeCtrl?.addPolyline?.({ path: coverage, ...ROUTE_STYLE })

  // 落位机器人到起点
  segIdx = 0
  curPos = [...coverage[0]]
  progress.value = 0
  placeRobot(curPos, calcBearing(coverage[0], coverage[1]))

  playState.value = 'planned'
}

function placeRobot(lngLat, bearing = ICON_HEAD_OFFSET) {
  if (robotCtrl) {
    robotCtrl.setPosition(lngLat)
    robotCtrl.setRotation(bearing - ICON_HEAD_OFFSET)
  } else {
    robotCtrl = bicMap.addDirectionalMarker(map, lngLat, {
      imagePath: robotIcon,
      size: 42,
      initialRotation: 0,
      draggable: false,
      rotationControl: false,
      initialEditMode: false
    })
    robotCtrl.setRotation(bearing - ICON_HEAD_OFFSET)
  }
}

// ============================================================
//   清洁动画
// ============================================================
function startCleaning() {
  if (coverage.length < 2) return
  // 从完成态重新开始时先归零
  if (playState.value === 'finished') {
    segIdx = 0
    curPos = [...coverage[0]]
    progress.value = 0
    cleanedCtrl?.clear?.()
    placeRobot(curPos, calcBearing(coverage[0], coverage[1]))
  }
  navSuccess.value = false
  clearTimeout(successTimer)
  playState.value = 'playing'
  runSegment()
}

function runSegment() {
  if (playState.value !== 'playing') return
  if (segIdx >= coverage.length - 1) { finishCleaning(); return }

  const from = [...curPos]
  const to = coverage[segIdx + 1]
  const steps = calcSteps(from, to)
  robotCtrl?.setRotation(calcBearing(from, to) - ICON_HEAD_OFFSET)
  let step = 0

  animId = setInterval(() => {
    if (playState.value !== 'playing') { stopAnim(); return }
    step++
    const t = step / steps
    curPos = [
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t
    ]
    robotCtrl?.setPosition(curPos)
    paintCleaned()
    updateProgress()

    if (step >= steps) {
      stopAnim()
      segIdx++
      runSegment()
    }
  }, ANIM_FRAME_MS)
}

function pauseCleaning() {
  if (playState.value !== 'playing') return
  playState.value = 'paused'
  stopAnim()
}

function resumeCleaning() {
  if (playState.value !== 'paused') return
  playState.value = 'playing'
  runSegment()
}

function resetCleaning() {
  stopAnim()
  clearTimeout(successTimer)
  navSuccess.value = false
  if (coverage.length < 2) return
  segIdx = 0
  curPos = [...coverage[0]]
  progress.value = 0
  cleanedCtrl?.clear?.()
  placeRobot(curPos, calcBearing(coverage[0], coverage[1]))
  playState.value = 'planned'
}

function finishCleaning() {
  stopAnim()
  curPos = [...coverage[coverage.length - 1]]
  segIdx = coverage.length - 1
  progress.value = 1
  paintCleaned()
  playState.value = 'finished'
  navSuccess.value = true
  clearTimeout(successTimer)
  successTimer = setTimeout(() => { navSuccess.value = false }, 3000)
}

/** 用清洁带（wideline）渲染已清洁区域：已过航点 + 当前点 */
function paintCleaned() {
  if (!cleanedCtrl) return
  const traveled = coverage.slice(0, segIdx + 1)
  traveled.push(curPos)
  if (traveled.length < 2) return
  cleanedCtrl.update([{ path: traveled, width: SWATH_M, color: CLEANED_STYLE.color, opacity: CLEANED_STYLE.opacity }])
}

function updateProgress() {
  if (plannedLengthM.value <= 0) return
  const traveled = coverage.slice(0, segIdx + 1)
  traveled.push(curPos)
  progress.value = Math.min(1, pathLengthMeters(traveled) / plannedLengthM.value)
}

function stopAnim() {
  if (animId != null) { clearInterval(animId); animId = null }
}

/** 清空选区 / 轨迹 / 清洁带 / 机器人，恢复初始态 */
function clearAll() {
  stopAnim()
  clearTimeout(successTimer)
  navSuccess.value = false
  coverage = []
  segIdx = 0
  curPos = null
  progress.value = 0
  plannedLengthM.value = 0
  selectedAreaM2.value = 0
  playState.value = 'idle'
  routeCtrl?.clear?.()
  cleanedCtrl?.clear?.()
  selectionCtrl?.removePolygon?.(SELECTION_STYLE.id)
  robotCtrl?.remove?.()
  robotCtrl = null
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
  box-shadow:
    0 4px 30px rgba(14, 165, 233, 0.06),
    0 0 0 1px rgba(255, 255, 255, 0.8) inset;
  transition: border-color 0.25s, box-shadow 0.25s;

  &.nav-mode {
    border-color: rgba(0, 102, 255, 0.35);
    box-shadow: 0 4px 30px rgba(0, 102, 255, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;
  }
}

.map-gl {
  width: 100%;
  height: 100%;
}

.canvas-hidden {
  display: none;
}

.overlay-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 20;
  max-width: min(300px, calc(100% - 24px));
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(14, 165, 233, 0.22);
  box-shadow:
    0 8px 32px rgba(14, 165, 233, 0.08),
    0 0 0 1px rgba(255, 255, 255, 0.6) inset;
  font-size: 13px;
  line-height: 1.45;
  color: #0c4a6e;
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #0369a1;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(14, 165, 233, 0.15);
}

.hint-wait {
  color: #64748b;
  font-size: 11px;
  margin: 0;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 10px;
  margin: 0 0 10px;
  font-size: 11px;

  dt { color: #64748b; margin: 0; }
  dd { margin: 0; font-weight: 600; color: #0c4a6e; }
}

.legend {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #475569;
  margin-top: 4px;
}

.dot {
  display: inline-block;
  width: 14px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;

  &--cleaned { background: #00e1a0; opacity: 0.9; }
  &--route   { background: #00C2FF; opacity: 0.9; }
  &--area    { background: rgba(0, 102, 255, 0.25); border: 1px solid #0066ff; }
}

.tabular {
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, 'SF Mono', monospace;
}

// ===== 框选提示条 =====
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

.hint-icon { color: #7eb8ff; flex-shrink: 0; }

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

  &:hover { background: rgba(255, 255, 255, 0.22); }
}

// ===== 完成提示 =====
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

.hint-fade-enter-active, .hint-fade-leave-active { transition: opacity 0.25s, transform 0.25s; }
.hint-fade-enter-from, .hint-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(-8px); }
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.toast-fade-enter-from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
.toast-fade-leave-to   { opacity: 0; transform: translateX(-50%) translateY(-6px); }
</style>
