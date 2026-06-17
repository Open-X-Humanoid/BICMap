<!--
 * @Date: 2026-04-22 15:45:00
 * @LastEditTime: 2026-06-09 14:32:22
 * @Description: 智能移动机器人激光雷达点云示例（SLAM 像素射线追踪版）。
 *   从 SLAM 底图 canvas 像素中提取占据栅格，机器人沿规划路径行进时
 *   360° 发射激光射线（DDA 步进），命中暗色像素（实体墙 / 家具轮廓）
 *   即生成足迹点，点云与底图逐像素对齐。2D = 平面轮廓；3D = 沿障碍
 *   真实高度拉伸的立面（深色→实墙 2.5 m，浅色→家具 0.88 m）。
 * @FilePath: /bic-map/src/examples/indoor/pointCloud/index.vue
-->
<template>
  <div class="app-root">
    <canvas id="canvasMap" style="display:none"></canvas>

    <AppHeader title="智能移动机器人-雷达点云" />

    <main class="map-area">
      <div class="grid-bg"></div>

      <div class="map-container">
        <div id="pointCloudMap" class="map-gl"></div>

        <!-- HUD 状态面板 -->
        <div class="hud-panel">
          <div class="hud-title">
            <span class="hud-bar"></span>
            激光雷达扫描
          </div>

          <div class="hud-row">
            <span class="hud-label">模式</span>
            <span class="hud-value" :class="{ 'hud-value--accent': is3D }">
              {{ is3D ? '3D 立面' : '2D 轮廓' }}
            </span>
          </div>
          <div class="hud-row">
            <span class="hud-label">状态</span>
            <span class="hud-value">{{ statusLabel }}</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">进度</span>
            <span class="hud-value">{{ progressPercent }}%</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">已识别点</span>
            <span class="hud-value">{{ currentPoints.length }}</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">渲染耗时</span>
            <span class="hud-value">{{ lastCost }} ms</span>
          </div>

          <div class="hud-divider"></div>

          <div class="hud-slider">
            <label>扫描时长</label>
            <input
              v-model.number="durationSeconds"
              type="range"
              min="4"
              max="40"
              step="1"
              :disabled="playState === 'playing'"
            />
            <span>{{ durationSeconds }}s</span>
          </div>


          <div class="hud-slider">
            <label>点显示数</label>
            <input
              v-model.number="pointCount"
              type="range"
              min="1000"
              max="100000"
              step="500"
            />
            <span>{{ pointCount }}</span>
          </div>

          <div class="hud-slider">
            <label>点大小</label>
            <input
              v-model.number="pointSize"
              type="range"
              min="1"
              max="10"
              step="0.5"
              @change="applyOptions"
            />
            <span>{{ pointSize }}px</span>
          </div>

          <div class="hud-slider">
            <label>不透明度</label>
            <input
              v-model.number="pointOpacity"
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              @change="applyOptions"
            />
            <span>{{ pointOpacity.toFixed(2) }}</span>
          </div>

          <template v-if="is3D">
            <div class="hud-slider">
              <label>高度系数</label>
              <input
                v-model.number="heightScale"
                type="range"
                min="0.5"
                max="1"
                step="0.1"
                @change="applyOptions"
              />
              <span>{{ heightScale }}</span>
            </div>
          </template>

          <div class="hud-divider"></div>
          <div class="hud-legend-row">
            <span class="hud-label">高度着色</span>
          </div>
          <div class="hud-gradient-bar">
            <span>0 m</span>
            <div class="gradient-strip"></div>
            <span>{{ colorZMax }} m</span>
          </div>
        </div>
      </div>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  Eye,
  EyeOff,
  Maximize,
  Pause,
  Play,
  RefreshCcw,
  RotateCcw
} from 'lucide-vue-next'

import AppFooter from '../../components/AppFooter.vue'
import AppHeader from '../../components/AppHeader.vue'

import slamImage from '../../assets/slam_transparent.png'
import bicMap from '../../../bicMap/core/bicmap-gl'
import { createRobot3DLayer } from '@/bicMap/core/robot/visual/robot3DLayer'
import smartRobotGlbUrl from './assets/smart_mobile_robot_under_10mb.glb?url'
import { simulateLidarFromCanvas, clearOccCache } from './mockOfficeData'
import { ROBOT_PATH } from './mockRobotPath'

// ===== 智能移动机器人 GLB 模型配置 =====
const SMART_ROBOT_CONFIG = {
  url:          smartRobotGlbUrl,
  scale:        0.06,      // 缩小机器人至合适室内比例
  metersScale:  1,
  rotateX:      0,   // step-1: 先清零，确认模型原始姿态
  rotateY:      0,
  rotateZ:      0,
  animations:   { idle: 'idle', walk: 'walk', drive: 'drive' },
  defaultAnimation: 'walk',
}

// ===== SLAM 底图参数（与扫地机器人清扫场景对齐，确保路径与底图像素一致） =====
const MAP_START_X = -58.999993705749512
const MAP_START_Y = -21.349997329711914
const MAP_X_GRID_COUNT = 2048
const MAP_Y_GRID_COUNT = 1143
const MAP_RESOLUTION = 0.05
const MAP_ZOOM_FACTOR = 2
const MAP_WIDTH = MAP_X_GRID_COUNT * MAP_RESOLUTION   // 102.4 m
const MAP_HEIGHT = MAP_Y_GRID_COUNT * MAP_RESOLUTION  // 57.15 m
const MAP_CENTER = [116.40739053610389, 39.90420311909196]
const MAP_ZOOM = 22.223507696372238
const MAP_BEARING = 145.60000000000036
const PITCH_3D = 38.000000000000014

// 渐变色映射（按 z 高度，阈值为 zRange 的归一化分数 0~1）
const COLOR_MAP = [
  [0,    '#1e90ff'],
  [0.2, '#00e1a0'],
  [0.4, '#ffd400'],
  [0.6,  '#ff4d4d']
]
const Z_MAX = 2.5  // 最大高度（实墙）

// ===== 响应式状态 =====
const map = ref(null)
const pathBounds = ref(null)
const pointCloud2D = ref(null)
const pointCloud3D = ref(null)
const currentPoints = ref([])
const lastCost = ref(0)
const sceneReady = ref(false)

const is3D = ref(true)
const cloudVisible = ref(true)
const useColorMap = ref(true)
const pointOpacity = ref(0.95)
const heightScale = ref(0.6)

// 分模式独立参数，切换时自动 save/restore
const modeConfig = {
  '3d': { pointSize: 4,   pointColor: '#00e1ff', pointCount: 100000 },
  '2d': { pointSize: 2, pointColor: '#4fff6e', pointCount: 2000  }
}
const pointSize  = ref(modeConfig['3d'].pointSize)
const pointColor = ref(modeConfig['3d'].pointColor)
const pointCount = ref(modeConfig['3d'].pointCount)

const LIDAR_RANGE = 6  // 激光量程（米），固定参数
const durationSeconds = ref(16)
const playState = ref('idle')
const progress = ref(0)

// ===== 非响应式缓存 =====
let surface2D = []  // [x, y, 0, s][] 按 s 升序
let surface3D = []  // [x, y, z, s][] 按 s 升序
let robotLayer = null
let rafId = null
let playStartPerf = 0
let pausedElapsedMs = 0
let lastRenderPerf = 0
let lastBearingDeg = 0
const RENDER_INTERVAL_MS = 50

// ===== 路径（lng/lat）与累积长度 =====
const FULL_PATH = dedupeLngLat(ROBOT_PATH)
let pathSegLen = []
let pathTotalLen = 0

// ===== Computed =====
const activeCloud = computed(() => (is3D.value ? pointCloud3D.value : pointCloud2D.value))
const colorZMax = computed(() => (Z_MAX * heightScale.value).toFixed(1))
const progressPercent = computed(() => Math.round(progress.value * 1000) / 10)
const statusLabel = computed(() => {
  const MAP = { idle: '待扫描', playing: '扫描中', paused: '已暂停', finished: '已完成' }
  return MAP[playState.value] ?? playState.value
})
const durationMs = computed(() => Math.max(2000, durationSeconds.value * 1000))

const scanButton = computed(() => {
  if (playState.value === 'playing') return { label: '暂停', icon: Pause, onClick: pauseScan }
  if (playState.value === 'paused') return { label: '继续', icon: Play, onClick: resumeScan }
  return { label: '开始扫描', icon: Play, onClick: startScan }
})

const footerButtons = computed(() => [
  scanButton.value,
  { label: '重置', icon: RotateCcw, onClick: resetScan },
  { label: is3D.value ? '切到 2D' : '切到 3D', icon: RefreshCcw, onClick: toggleDimension },
  {
    label: cloudVisible.value ? '隐藏点云' : '显示点云',
    icon: cloudVisible.value ? EyeOff : Eye,
    onClick: toggleVisibility
  },
  { label: '适应路径', icon: Maximize, onClick: zoomToPath }
])

watch(pointCount, () => { renderCloud() })

onMounted(() => initMap())
onBeforeUnmount(() => {
  stopRaf()
  robotLayer?.destroy?.()
  robotLayer = null
  pointCloud2D.value?.remove?.()
  pointCloud3D.value?.remove?.()
  pointCloud2D.value = null
  pointCloud3D.value = null
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})

// ===== 坐标 / 路径工具 =====

function dedupeLngLat(pts) {
  const out = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last && last[0] === p[0] && last[1] === p[1]) continue
    out.push([p[0], p[1]])
  }
  return out
}

/**
 * 笛卡尔坐标（米）→ [lng, lat]
 */
function cartToLngLat(x, y) {
  const fn = window.MapUtils?.cartesianToGPS ?? window.cartesianToGPS
  const g = fn({ x, y, scale: MAP_RESOLUTION, zoomFactor: MAP_ZOOM_FACTOR })
  return [g.longitude, g.latitude]
}

/**
 * [lng, lat] → 笛卡尔坐标（米）
 */
function lngLatToCart(lng, lat) {
  const fn = window.MapUtils?.GPSToCartesian ?? window.GPSToCartesian
  const p = fn({ longitude: lng, latitude: lat, scale: MAP_RESOLUTION, zoomFactor: MAP_ZOOM_FACTOR })
  return [Number(p.x), Number(p.y)]
}

/**
 * Haversine 距离（米）
 */
function haversineMeters(a, b) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function buildPathMetrics() {
  pathSegLen = []
  pathTotalLen = 0
  for (let i = 0; i < FULL_PATH.length - 1; i++) {
    const d = haversineMeters(FULL_PATH[i], FULL_PATH[i + 1])
    pathSegLen.push(d)
    pathTotalLen += d
  }
}

/**
 * 按进度 p∈[0,1] 取路径位置和段索引
 */
function lngLatAtProgress(p) {
  if (FULL_PATH.length < 2) return { lngLat: FULL_PATH[0] ?? MAP_CENTER, segIndex: 0 }
  let d = Math.min(1, Math.max(0, p)) * pathTotalLen
  for (let i = 0; i < pathSegLen.length; i++) {
    if (d <= pathSegLen[i] || i === pathSegLen.length - 1) {
      const t = pathSegLen[i] > 1e-9 ? Math.min(1, d / pathSegLen[i]) : 0
      const a = FULL_PATH[i]
      const b = FULL_PATH[i + 1] ?? a
      return { lngLat: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], segIndex: i }
    }
    d -= pathSegLen[i]
  }
  return { lngLat: FULL_PATH[FULL_PATH.length - 1], segIndex: FULL_PATH.length - 2 }
}

/**
 * 地理方位角（0=北 顺时针，单位°）
 */
function geoBearing(from, to) {
  const φ1 = (from[1] * Math.PI) / 180
  const φ2 = (to[1] * Math.PI) / 180
  const Δλ = ((to[0] - from[0]) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

// ===== 初始化 =====

async function initMap() {
  try {
    await bicMap.init()
    map.value = bicMap.createMap({
      container: 'pointCloudMap',
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      bearing: MAP_BEARING,
      pitch: is3D.value ? PITCH_3D : 0,
      backgroundColor: '#fff',
      antialias: true
    })
    bicMap.addZoomControl(map.value, 'bottom-right')
    map.value.on('load', async () => {
      await loadSlamMap()
      buildPathMetrics()
      setup3DRobot()
      rebuildScan()
      // zoomToPath()
    })
  } catch (error) {
    console.error('初始化地图失败:', error)
  }
}

async function loadSlamMap() {
  if (!map.value) return
  try {
    await bicMap.loadSlamMap(map.value, {
      startX: MAP_START_X,
      startY: MAP_START_Y,
      xGridCount: MAP_X_GRID_COUNT,
      yGridCount: MAP_Y_GRID_COUNT,
      resolution: MAP_RESOLUTION,
      imagePath: slamImage,
      canvasId: 'canvasMap',
      fitBounds: false
    })
    // 底图重绘后清除占据栅格缓存
    const canvasEl = document.getElementById('canvasMap')
    if (canvasEl) clearOccCache(canvasEl)
  } catch (error) {
    console.error('加载SLAM地图失败:', error)
  }
}

function setup3DRobot() {
  if (!map.value || robotLayer) return
  const start = FULL_PATH[0] ?? MAP_CENTER
  lastBearingDeg = FULL_PATH.length > 1 ? geoBearing(FULL_PATH[0], FULL_PATH[1]) : 0
  robotLayer = createRobot3DLayer(map.value, SMART_ROBOT_CONFIG, {
    layerId:        'smart-robot-3d',
    headingOffset3D: 0,   // step-2: 等姿态对了再调朝向
  })
  robotLayer?.addRobot({ id: 'robot', lngLat: start, heading: lastBearingDeg })
}

// ===== 扫描构建 =====

/**
 * 将 canvas 的 SLAM 像素射线追踪结果转换为 [lng, lat, z, s][]。
 * 内部：
 *   1. 路径 GPS → 笛卡尔（与 canvas 坐标系一致）
 *   2. DDA 射线追踪（mockOfficeData.js）→ {pts2D, pts3D}（笛卡尔，含 s）
 *   3. 笛卡尔 → GPS（cartToLngLat）→ 存入 surface2D / surface3D
 */
function rebuildScan() {
  const canvasEl = document.getElementById('canvasMap')
  if (!map.value || !canvasEl || !canvasEl.width) return

  const t0 = performance.now()

  // GPS 路径 → 笛卡尔（单位与 mapStartX 一致）
  const pathCart = FULL_PATH.map(([lng, lat]) => lngLatToCart(lng, lat))

  const { pts2D, pts3D } = simulateLidarFromCanvas({
    canvas: canvasEl,
    pathCart,
    mapStartX: MAP_START_X,
    mapStartY: MAP_START_Y,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    range: LIDAR_RANGE,
    angleStepDeg: 1.2,
    stationStepM: 0.09,
    zLayers: 10,
    cell: 0.035
  })

  // 笛卡尔 → GPS，拼入 s
  surface2D = pts2D.map(([x, y, , s]) => {
    const [lng, lat] = cartToLngLat(x, y)
    return [lng, lat, 0, s]
  })
  surface3D = pts3D.map(([x, y, z, s]) => {
    const [lng, lat] = cartToLngLat(x, y)
    return [lng, lat, z, s]
  })

  sceneReady.value = true
  lastCost.value = Math.round(performance.now() - t0)
  renderCloud()
}

// ===== 渲染 =====

/**
 * 二分查找：surface 数组中 s ≤ p 的元素个数
 */
function visibleCount(arr, p) {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid][3] <= p) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * 按当前进度截取并更新点云（含预算抽稀）
 */
function renderCloud() {
  if (!map.value || !sceneReady.value) return
  const t0 = performance.now()

  const arr = is3D.value ? surface3D : surface2D
  const n = visibleCount(arr, progress.value)
  const budget = pointCount.value

  let pts
  if (n <= budget) {
    pts = arr.slice(0, n)
  } else {
    const rate = budget / n
    pts = arr.slice(0, n).filter(() => Math.random() < rate)
  }
  currentPoints.value = pts

  if (is3D.value) {
    pointCloud2D.value?.hide?.()
    if (pointCloud3D.value) {
      pointCloud3D.value.update(pts, build3DOptions())
    } else {
      pointCloud3D.value = bicMap.createPointCloud3D(map.value, pts, build3DOptions())
    }
    if (cloudVisible.value) pointCloud3D.value?.show?.()
  } else {
    pointCloud3D.value?.hide?.()
    if (pointCloud2D.value) {
      pointCloud2D.value.update(pts, build2DOptions())
    } else {
      pointCloud2D.value = bicMap.createPointCloud(map.value, pts, build2DOptions())
    }
    if (cloudVisible.value) pointCloud2D.value?.show?.()
  }

  lastCost.value = Math.round(performance.now() - t0)
}

function build2DOptions() {
  return {
    pointSize: pointSize.value,
    pointColor: pointColor.value,
    pointOpacity: pointOpacity.value,
    is3D: false,
    useColorMap: false,
    colorMap: COLOR_MAP,
    zRange: [0, Z_MAX],
    heightScale: 0,
    heightOffset: 0
  }
}

function build3DOptions() {
  return {
    pointSize: pointSize.value,
    pointColor: pointColor.value,
    pointOpacity: pointOpacity.value,
    useColorMap: useColorMap.value,
    colorMap: COLOR_MAP,
    zRange: [0, Z_MAX * heightScale.value],
    heightScale: heightScale.value,
    heightOffset: 0
  }
}

/**
 * 仅同步样式（不重算场景）
 */
function applyOptions() {
  if (is3D.value && pointCloud3D.value) {
    pointCloud3D.value.update(currentPoints.value, build3DOptions())
  }
  if (!is3D.value && pointCloud2D.value) {
    pointCloud2D.value.update(currentPoints.value, build2DOptions())
  }
}

// ===== 动画 =====

function stopRaf() {
  if (rafId != null) { cancelAnimationFrame(rafId); rafId = null }
}

function updateRobot(p) {
  if (!robotLayer) return
  const { lngLat, segIndex } = lngLatAtProgress(p)
  if (segIndex >= 0 && segIndex < FULL_PATH.length - 1) {
    const a = FULL_PATH[segIndex]
    const b = FULL_PATH[segIndex + 1] ?? a
    if (haversineMeters(a, b) > 0.0005) lastBearingDeg = geoBearing(a, b)
  }
  robotLayer.updateRobot('robot', { lngLat, heading: lastBearingDeg })
  map.value?.triggerRepaint()
}

function tick() {
  if (playState.value !== 'playing' || !map.value) return
  const elapsed = performance.now() - playStartPerf
  const p = Math.min(1, elapsed / durationMs.value)
  progress.value = p
  updateRobot(p)

  const now = performance.now()
  if (now - lastRenderPerf >= RENDER_INTERVAL_MS || p >= 1) {
    lastRenderPerf = now
    renderCloud()
  }

  if (p >= 1) {
    playState.value = 'finished'
    progress.value = 1
    renderCloud()
    stopRaf()
    return
  }
  rafId = requestAnimationFrame(tick)
}

function startScan() {
  if (!sceneReady.value) return
  stopRaf()
  progress.value = 0
  pausedElapsedMs = 0
  updateRobot(0)
  renderCloud()
  playState.value = 'playing'
  playStartPerf = performance.now()
  lastRenderPerf = 0
  rafId = requestAnimationFrame(tick)
}

function pauseScan() {
  if (playState.value !== 'playing') return
  pausedElapsedMs = performance.now() - playStartPerf
  playState.value = 'paused'
  stopRaf()
}

function resumeScan() {
  if (playState.value !== 'paused') return
  playState.value = 'playing'
  playStartPerf = performance.now() - pausedElapsedMs
  rafId = requestAnimationFrame(tick)
}

function resetScan() {
  stopRaf()
  playState.value = 'idle'
  progress.value = 0
  pausedElapsedMs = 0
  updateRobot(0)
  renderCloud()
}

// ===== 视图 =====

function toggleDimension() {
  // 保存当前模式的 slider 值
  const fromKey = is3D.value ? '3d' : '2d'
  modeConfig[fromKey] = { pointSize: pointSize.value, pointColor: pointColor.value, pointCount: pointCount.value }

  is3D.value = !is3D.value

  // 恢复目标模式的 slider 值
  const cfg = modeConfig[is3D.value ? '3d' : '2d']
  pointSize.value  = cfg.pointSize
  pointColor.value = cfg.pointColor
  pointCount.value = cfg.pointCount

  map.value?.easeTo({ pitch: is3D.value ? PITCH_3D : 0, duration: 800 })
  renderCloud()
}

function toggleVisibility() {
  const cloud = activeCloud.value
  if (!cloud) return
  if (cloudVisible.value) cloud.hide()
  else cloud.show()
  cloudVisible.value = !cloudVisible.value
}

function computePathBounds() {
  let minLng = Infinity, minLat = Infinity
  let maxLng = -Infinity, maxLat = -Infinity
  for (const [lng, lat] of FULL_PATH) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  pathBounds.value = [[minLng, minLat], [maxLng, maxLat]]
}

function zoomToPath() {
  if (!map.value) return
  if (!pathBounds.value) computePathBounds()
  const pitch = is3D.value ? PITCH_3D : 0
  // 先瞬时贴合（duration:0）拿到拟合 zoom，再在其基础上加 boost 平滑拉近。
  // 不用 cameraForBounds：load 阶段容器尺寸未就绪时它返回 null，导致 boost 失效。
  // map.value.fitBounds(pathBounds.value, { padding: 100, pitch, duration: 0 })
  map.value.easeTo({
    center: map.value.getCenter(),
    zoom: 22,
    pitch,
    duration: 800
  })
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
}

.map-gl {
  width: 100%;
  height: 100%;
}

.hud-panel {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 30;
  width: 258px;
  max-height: calc(100% - 36px);
  overflow-y: auto;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(5, 18, 48, 0.80);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(80, 140, 255, 0.28);
  box-shadow: 0 6px 24px rgba(0, 20, 80, 0.35);
  color: #cfe4ff;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 9px;

  .hud-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.08em;
    color: #fff;
  }

  .hud-bar {
    width: 4px;
    height: 14px;
    border-radius: 2px;
    background: linear-gradient(180deg, #06b6d4 0%, #3b82f6 100%);
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
  }

  .hud-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .hud-label { color: #8eb4e6; }

  .hud-value {
    font-family: 'Space Mono', 'Courier New', monospace;
    color: #fff;

    &--accent {
      color: #67e8f9;
      text-shadow: 0 0 8px rgba(103, 232, 249, 0.5);
    }
  }

  .hud-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(120, 160, 220, 0.35) 50%, transparent 100%);
  }

  .hud-slider {
    display: flex;
    align-items: center;
    gap: 8px;

    label { width: 64px; color: #8eb4e6; flex-shrink: 0; }

    input[type='range'] { flex: 1; accent-color: #3b82f6; }

    span {
      width: 52px;
      text-align: right;
      font-family: 'Space Mono', 'Courier New', monospace;
      color: #fff;
    }
  }

  .hud-legend-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .hud-gradient-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #8eb4e6;

    .gradient-strip {
      flex: 1;
      height: 8px;
      border-radius: 4px;
      background: linear-gradient(to right, #1e90ff, #00e1a0, #ffd400, #ff4d4d);
    }
  }
}
</style>
