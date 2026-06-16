<template>
  <div class="app-root">
    <canvas id="canvasMap" style="display: none"></canvas>

    <!-- ===== TOP HEADER BAR ===== -->
    <AppHeader title="图形绘制工具" />

    <!-- ===== MODE HINT OVERLAY ===== -->
    <Transition name="hint-fade">
      <div v-if="currentMode !== 'idle'" class="mode-overlay">
        <div class="hint-pill">
          <component :is="currentModeIcon" class="hint-icon" :size="15" />
          <span>{{ currentModeHint }}</span>
          <button class="cancel-btn" @click="cancelCurrentMode">
            <X :size="13" />
            取消
          </button>
        </div>
      </div>
    </Transition>

    <!-- ===== SUCCESS TOAST ===== -->
    <Transition name="toast-fade">
      <div v-if="showToast" class="success-toast">
        <CheckCircle :size="15" />
        <span>{{ toastMessage }}</span>
      </div>
    </Transition>

    <!-- ===== MAIN MAP AREA ===== -->
    <main class="map-area">
      <div class="grid-bg"></div>
      <div class="map-container" :class="currentModeClass">
        <div id="semanticMap" class="map-gl"></div>

        <!-- ===== LEGEND PANEL ===== -->
        <aside class="overlay-panel overlay-legend" aria-label="图例说明">
          <div class="panel-title">图层图例</div>
          <div class="legend-list">
            <div v-for="layer in legendLayers" :key="layer.type" class="legend-item">
              <div class="legend-color" :style="{ background: layer.color }"></div>
              <span class="legend-label">{{ layer.label }}</span>
              <span v-if="layer.count > 0" class="legend-count">{{ layer.count }}</span>
            </div>
          </div>
        </aside>

        <!-- ===== INFO PANEL ===== -->
        <aside class="overlay-panel overlay-info" aria-label="操作说明">
          <div class="panel-title">操作说明</div>
          <ol class="info-steps">
            <li>选择底部工具绘制对应图形，可连续绘制多个</li>
            <li>折线：单击添加顶点，双击结束</li>
            <li>多边形：单击添加顶点，双击闭合</li>
            <li>圆形：点击确定圆心，拖拽调整半径完成</li>
            <li>矩形：拖拽绘制矩形区域</li>
            <li>切换工具会保留已画图形，仅「清空全部」会清除</li>
          </ol>
        </aside>
      </div>
    </main>

    <!-- ===== BOTTOM TOOLBAR ===== -->
    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { X, CheckCircle, Square, Minus, Circle, Trash2 } from 'lucide-vue-next'
import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'
import bicMap from '../../../bicMap/core/bicmap-gl'
import slamImage from '../../assets/slam_transparent.png'

// ===== SLAM 地图参数 =====
const MAP_START_X = -58.999993705749512
const MAP_START_Y = -21.349997329711914
const MAP_X_GRID_COUNT = 2752
const MAP_Y_GRID_COUNT = 1536
const MAP_RESOLUTION = 0.05

/* TODO:打印SLAM地图参数到控制台，方便复制粘贴到 zoneMockData.js 的 points / rect 字段 */
const MAP_WIDTH_M = MAP_X_GRID_COUNT * MAP_RESOLUTION   // 137.6 m
const MAP_HEIGHT_M = MAP_Y_GRID_COUNT * MAP_RESOLUTION  // 76.8 m
const MAP_ZOOM_FACTOR = 2

/**
 * 经纬度 → SLAM 分数坐标 [xFrac, yFrac]（0~1）
 * 打印结果可直接粘贴到 zoneMockData.js 的 points / rect 字段
 * @param {[number, number]} lngLat
 * @returns {[number, number]}
 */
function lngLatToFrac(lngLat) {
  const Mu = window.MapUtils
  if (!Mu?.GPSToCartesian) return [0, 0]
  const c = Mu.GPSToCartesian({
    longitude: lngLat[0],
    latitude: lngLat[1],
    scale: MAP_RESOLUTION,
    zoomFactor: MAP_ZOOM_FACTOR
  })
  const xFrac = (c.x - MAP_START_X) / MAP_WIDTH_M
  const yFrac = (c.y - MAP_START_Y) / MAP_HEIGHT_M
  return [
    Math.round(xFrac * 10000) / 10000,
    Math.round(yFrac * 10000) / 10000
  ]
}

/**
 * 多边形顶点（lng/lat 数组）→ 打印可粘贴的 points 格式
 * @param {Array<[number, number]>} lngLatPoints
 * @param {string} [id] - 区域 ID 提示
 */
function logPolygonFracs(lngLatPoints, id = 'my-zone') {
  const fracs = lngLatPoints.map(lngLatToFrac)
  console.group(`%c[SemanticMap] 多边形坐标 — ${id}`, 'color:#0ea5e9;font-weight:bold')
  console.log('▶ 粘贴到 zoneMockData.js 的 points 字段:')
  console.log('points: [\n' + fracs.map(([x, y]) => `  [${x}, ${y}],`).join('\n') + '\n]')
  console.groupEnd()
}

/**
 * 矩形四角（corners 对象）→ 打印可粘贴的 rect 格式
 * @param {{ northWest, northEast, southEast, southWest: [number, number] }} corners
 * @param {string} [id]
 */
function logRectFracs(corners, id = 'my-zone') {
  const nw = lngLatToFrac(corners.northWest)
  const se = lngLatToFrac(corners.southEast)
  // rect: [x1, y1, x2, y2] → 左上(nw) 到 右下(se)
  // 注意 yFrac：northWest 的纬度更大，转换后 yFrac 更小（地图北侧）
  const x1 = Math.min(nw[0], se[0])
  const y1 = Math.min(nw[1], se[1])
  const x2 = Math.max(nw[0], se[0])
  const y2 = Math.max(nw[1], se[1])
  console.group(`%c[SemanticMap] 矩形坐标 — ${id}`, 'color:#f59e0b;font-weight:bold')
  console.log('▶ 粘贴到 zoneMockData.js 的 rect 字段:')
  console.log(`rect: [${x1}, ${y1}, ${x2}, ${y2}]`)
  console.groupEnd()
}

/* -------------------------------- */

// ===== 模式定义 =====
const MODES = {
  IDLE: 'idle',
  POLYLINE: 'polyline',
  POLYGON: 'polygon',
  CIRCLE: 'circle',
  RECTANGLE: 'rectangle'
}

const DRAWING_MODES = [
  MODES.POLYLINE,
  MODES.POLYGON,
  MODES.CIRCLE,
  MODES.RECTANGLE
]

const MODE_META = {
  [MODES.POLYLINE]: { icon: Minus, hint: '绘制折线：单击添加顶点，双击结束' },
  [MODES.POLYGON]: { icon: Square, hint: '绘制多边形：单击添加顶点，双击闭合' },
  [MODES.CIRCLE]: { icon: Circle, hint: '绘制圆形：点击确定圆心，拖拽调整半径完成' },
  [MODES.RECTANGLE]: { icon: Square, hint: '绘制矩形：拖拽绘制矩形区域' }
}

// ===== 图层样式配置 =====
const LAYER_STYLES = {
  polyline: {
    color: '#06b6d4',
    width: 3,
    label: '折线'
  },
  polygon: {
    fillColor: '#00e1a0',
    fillOpacity: 0.15,
    lineColor: '#00e1a0',
    lineWidth: 2,
    label: '多边形'
  },
  circle: {
    fillColor: '#c34646',
    fillOpacity: 0.15,
    lineColor: '#c34646',
    lineWidth: 2,
    label: '圆形'
  },
  rectangle: {
    fillColor: '#ffbb00',
    fillOpacity: 0.15,
    lineColor: '#ffbb00',
    lineWidth: 2,
    label: '矩形'
  }
}

const INITIAL_ELEMENT_COUNTS = {
  polyline: 0,
  polygon: 0,
  circle: 0,
  rectangle: 0
}

/** 已提交图形的持久展示层（与交互绘制层分离） */
const DISPLAY_LAYER_PREFIX = 'graphic-drawing'
const displayLayers = {
  polyline: null,
  polygon: null,
  rectangle: null,
  circle: null
}

// ===== 状态 =====
const map = ref(null)
const slamMapReady = ref(false)
const currentMode = ref(MODES.IDLE)
const showToast = ref(false)
const toastMessage = ref('')
let toastTimer = null

// ===== 绘制控制器 =====
const controllerRefs = {
  [MODES.POLYLINE]: ref(null),
  [MODES.POLYGON]: ref(null),
  [MODES.CIRCLE]: ref(null),
  [MODES.RECTANGLE]: ref(null)
}

// ===== 已绘制要素计数 =====
const elementCounts = ref({ ...INITIAL_ELEMENT_COUNTS })

// ===== 折线绘制选项 =====
const drawingOptions = {
  // enablePolylineDrawing 的交互层颜色要与默认样式保持一致（折线）
  fillColor: LAYER_STYLES.polyline.color,
  fillOpacity: 0.45,
  lineColor: LAYER_STYLES.polyline.color,
  lineWidth: 2,
  pointColor: '#0369a1',
  pointRadius: 5,
  minPoints: 2
}

// 圆形展示层/交互层统一使用 core 的基础能力（createCircles / enableCircleDrawing）

const hasAnyElements = computed(() => Object.values(elementCounts.value).some((count) => count > 0))

// ===== 当前模式图标和提示 =====
const currentModeIcon = computed(() => MODE_META[currentMode.value]?.icon || Circle)
const currentModeHint = computed(() => MODE_META[currentMode.value]?.hint || '')
const currentModeClass = computed(() => (currentMode.value === MODES.IDLE ? '' : `mode-${currentMode.value}`))

// ===== 图例数据 =====
const legendLayers = computed(() => [
  { type: 'polyline', color: LAYER_STYLES.polyline.color, label: LAYER_STYLES.polyline.label, count: elementCounts.value.polyline },
  { type: 'polygon', color: LAYER_STYLES.polygon.fillColor, label: LAYER_STYLES.polygon.label, count: elementCounts.value.polygon },
  { type: 'circle', color: LAYER_STYLES.circle.fillColor, label: LAYER_STYLES.circle.label, count: elementCounts.value.circle },
  {
    type: 'rectangle',
    color: LAYER_STYLES.rectangle.fillColor,
    label: LAYER_STYLES.rectangle.label,
    count: elementCounts.value.rectangle
  }
])

// ===== Footer 按钮配置 =====
const footerButtons = computed(() => [
  createModeButton('折线', MODES.POLYLINE, Minus),
  createModeButton('多边形', MODES.POLYGON, Square),
  createModeButton('圆形', MODES.CIRCLE, Circle),
  createModeButton('矩形', MODES.RECTANGLE, Square),
  {
    label: '清空全部',
    active: false,
    icon: Trash2,
    onClick: clearAllElements,
    disabled: !slamMapReady.value || !hasAnyElements.value
  }
])

onMounted(() => {
  initMap()
})

onBeforeUnmount(() => {
  clearTimeout(toastTimer)
  disableAllDrawings()
  destroyDisplayLayers()
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})

function createModeButton(label, mode, icon) {
  return {
    label,
    active: currentMode.value === mode,
    icon,
    onClick: () => toggleMode(mode),
    disabled: !slamMapReady.value
  }
}

function showMessage(message) {
  toastMessage.value = message
  showToast.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    showToast.value = false
  }, 3000)
}

function getController(mode) {
  return controllerRefs[mode]?.value || null
}

function setController(mode, controller) {
  if (controllerRefs[mode]) {
    controllerRefs[mode].value = controller
  }
}

function toggleMode(mode) {
  if (!slamMapReady.value) return
  if (currentMode.value === mode) {
    cancelCurrentMode()
    return
  }
  disableCurrentDrawing()
  currentMode.value = mode
  enableDrawingForMode(mode)
}

function cancelCurrentMode() {
  disableCurrentDrawing()
  currentMode.value = MODES.IDLE
}

function disableController(mode) {
  getController(mode)?.disable?.()
}

function disableCurrentDrawing() {
  disableController(currentMode.value)
}

function disableAllDrawings() {
  DRAWING_MODES.forEach(disableController)
}

function enableDrawingForMode(mode) {
  if (!map.value || !slamMapReady.value || mode === MODES.IDLE) return
  const controller = getController(mode)
  if (controller?.enable) {
    controller.enable()
    return
  }
  const created = createDrawingController(mode)
  if (created) {
    setController(mode, created)
  }
}

/**
 * 初始化各类型图形的持久展示层（只创建一次）
 */
function ensureDisplayLayers() {
  if (!map.value || displayLayers.polyline) return

  const m = map.value
  const prefix = DISPLAY_LAYER_PREFIX

  displayLayers.polyline = bicMap.createPolylines(m, [], {
    sourceId: `${prefix}-polyline-src`,
    layerId: `${prefix}-polyline-layer`,
    defaultColor: LAYER_STYLES.polyline.color,
    defaultWidth: LAYER_STYLES.polyline.width
  })

  displayLayers.polygon = bicMap.createPolygons(m, [], {
    sourceId: `${prefix}-polygon-src`,
    layerId: `${prefix}-polygon-layer`,
    outlineLayerId: `${prefix}-polygon-outline`,
    fillColor: LAYER_STYLES.polygon.fillColor,
    fillOpacity: LAYER_STYLES.polygon.fillOpacity,
    outlineColor: LAYER_STYLES.polygon.lineColor,
    outlineWidth: LAYER_STYLES.polygon.lineWidth
  })

  displayLayers.rectangle = bicMap.createRectangles(m, [], {
    sourceId: `${prefix}-rectangle-src`,
    layerId: `${prefix}-rectangle-layer`,
    outlineLayerId: `${prefix}-rectangle-outline`,
    fillColor: LAYER_STYLES.rectangle.fillColor,
    fillOpacity: LAYER_STYLES.rectangle.fillOpacity,
    outlineColor: LAYER_STYLES.rectangle.lineColor,
    outlineWidth: LAYER_STYLES.rectangle.lineWidth
  })

  displayLayers.circle = bicMap.createCircles(m, [], {
    sourceId: `${prefix}-circle-src`,
    fillLayerId: `${prefix}-circle-fill`,
    outlineLayerId: `${prefix}-circle-outline`,
    fillColor: LAYER_STYLES.circle.fillColor,
    fillOpacity: LAYER_STYLES.circle.fillOpacity,
    outlineColor: LAYER_STYLES.circle.lineColor,
    outlineWidth: LAYER_STYLES.circle.lineWidth
  })
}

/**
 * 销毁持久展示层
 */
function destroyDisplayLayers() {
  Object.keys(displayLayers).forEach((key) => {
    displayLayers[key]?.remove?.()
    displayLayers[key] = null
  })
}

/**
 * 将一次绘制结果提交到持久展示层（切换工具/取消模式不会清除）
 * @param {string} mode 绘制模式
 * @param {Object} payload 绘制结果数据
 * @param {number} [extra] 附加信息（如圆半径）
 */
function commitDrawnShape(mode, payload, extra) {
  ensureDisplayLayers()

  if (mode === MODES.POLYLINE && payload?.path?.length >= 2) {
    displayLayers.polyline?.addPolyline({
      path: payload.path,
      color: LAYER_STYLES.polyline.color,
      width: LAYER_STYLES.polyline.width
    })
  } else if (mode === MODES.POLYGON && payload?.geometry?.coordinates?.[0]) {
    const ring = payload.geometry.coordinates[0]
    const points = ring.length > 1 ? ring.slice(0, -1) : ring
    displayLayers.polygon?.addPolygon({ points })
  } else if (mode === MODES.RECTANGLE && payload?.corners) {
    displayLayers.rectangle?.addRectangle({
      coordinates: [payload.corners.southWest, payload.corners.northEast]
    })
  } else if (mode === MODES.CIRCLE && payload?.center && typeof payload?.radiusM === 'number') {
    displayLayers.circle?.addCircle?.({ center: payload.center, radiusM: payload.radiusM })
  }

  addElement(mode, extra)
}

/**
 * 清空所有已提交的持久图形
 */
function clearDisplayLayers() {
  displayLayers.polyline?.clear?.()
  displayLayers.polygon?.setData?.([])
  displayLayers.rectangle?.setData?.([])
  displayLayers.circle?.clear?.()
}

function createDrawingController(mode) {
  if (!map.value) return null
  ensureDisplayLayers()

  if (mode === MODES.POLYGON) {
    const style = LAYER_STYLES.polygon
    const controller = bicMap.enablePolygonDrawing(map.value, {
      fillColor: style.fillColor,
      fillOpacity: style.fillOpacity,
      lineColor: style.lineColor,
      lineWidth: style.lineWidth,
      onDrawComplete: (polygon) => {
        commitDrawnShape(MODES.POLYGON, polygon)
        // enablePolygonDrawing 内部不会在完成后清空临时 source（updatePolygon 会早退）
        // 导致“持久层 + 临时层叠加”看起来更深，切换工具时临时层被清掉就会变浅
        controller?.clearDrawing?.()
        reEnableModeIfActive(MODES.POLYGON)
        const ring = polygon?.geometry?.coordinates?.[0] ?? []
        logPolygonFracs(ring.length > 1 ? ring.slice(0, -1) : ring)
      }
    })
    return controller
  }

  if (mode === MODES.RECTANGLE) {
    const style = LAYER_STYLES.rectangle
    const controller = bicMap.enableRectangleDrawing(map.value, {
      fillColor: style.fillColor,
      fillOpacity: style.fillOpacity,
      lineColor: style.lineColor,
      lineWidth: style.lineWidth,
      onDrawComplete: (_rect, corners) => {
        commitDrawnShape(MODES.RECTANGLE, { corners })
        controller?.clearDrawing?.()
        reEnableModeIfActive(MODES.RECTANGLE)
        logRectFracs(corners)
      }
    })
    return controller
  }

  if (mode === MODES.POLYLINE) {
    const controller = bicMap.enablePolylineDrawing(map.value, {
      ...drawingOptions,
      defaultWidth: 0,
      onDrawComplete: (polylineData) => {
        commitDrawnShape(MODES.POLYLINE, polylineData)
        controller?.clearDrawing?.()
        reEnableModeIfActive(MODES.POLYLINE)
      }
    })
    return controller
  }

  if (mode === MODES.CIRCLE) {
    const style = LAYER_STYLES.circle
    const controller = bicMap.enableCircleDrawing(map.value, {
      sourceId: `${DISPLAY_LAYER_PREFIX}-circle-draw-src`,
      fillLayerId: `${DISPLAY_LAYER_PREFIX}-circle-draw-fill`,
      outlineLayerId: `${DISPLAY_LAYER_PREFIX}-circle-draw-outline`,
      fillColor: style.fillColor,
      fillOpacity: style.fillOpacity,
      lineColor: style.lineColor,
      lineWidth: style.lineWidth,
      onDrawComplete: ({ center, radiusM }) => {
        commitDrawnShape(MODES.CIRCLE, { center, radiusM }, radiusM)
        controller?.clearDrawing?.()
        reEnableModeIfActive(MODES.CIRCLE)
      }
    })
    return controller
  }

  return null
}

function reEnableModeIfActive(mode) {
  if (currentMode.value !== mode) return
  getController(mode)?.enable?.()
}

function addElement(mode, extra) {
  if (!elementCounts.value[mode] && elementCounts.value[mode] !== 0) return
  elementCounts.value[mode] += 1
  showMessage(buildAddMessage(mode, extra))
}

function buildAddMessage(mode, extra) {
  if (mode === MODES.CIRCLE) {
    const radius = typeof extra === 'number' ? extra.toFixed(2) : '--'
    return `已添加${LAYER_STYLES.circle.label}（半径${radius}m）`
  }
  return `已添加${LAYER_STYLES[mode].label}`
}

function clearAllElements() {
  DRAWING_MODES.forEach((mode) => getController(mode)?.clearDrawing?.())
  clearDisplayLayers()
  elementCounts.value = { ...INITIAL_ELEMENT_COUNTS }
  showMessage('已清空所有图形')
}

async function initMap() {
  try {
    await bicMap.init()
    map.value = bicMap.createMap({
      container: 'semanticMap',
      center: [116.4074, 39.9042],
      zoom: 18,
      backgroundColor: '#fff'
    })
    bicMap.addZoomControl(map.value, 'bottom-right')
    map.value.on('load', () => {
      loadSlamMap()
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
      fitBounds: true
    })
    slamMapReady.value = true
    ensureDisplayLayers()
  } catch (error) {
    console.error('加载SLAM地图失败:', error)
  }
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
}

.map-container.mode-polyline {
  border-color: rgba(0, 102, 255, 0.35);
  box-shadow:
    0 4px 30px rgba(0, 102, 255, 0.12),
    0 0 0 1px rgba(255, 255, 255, 0.8) inset;
}

.map-container.mode-polygon {
  border-color: rgba(0, 102, 255, 0.35);
  box-shadow:
    0 4px 30px rgba(0, 102, 255, 0.12),
    0 0 0 1px rgba(255, 255, 255, 0.8) inset;
}

.map-container.mode-circle {
  border-color: rgba(0, 225, 160, 0.35);
  box-shadow:
    0 4px 30px rgba(0, 225, 160, 0.12),
    0 0 0 1px rgba(255, 255, 255, 0.8) inset;
}

.map-container.mode-rectangle {
  border-color: rgba(245, 158, 11, 0.35);
  box-shadow:
    0 4px 30px rgba(245, 158, 11, 0.12),
    0 0 0 1px rgba(255, 255, 255, 0.8) inset;
}

.map-gl {
  width: 100%;
  height: 100%;
}

/* ===== MODE HINT OVERLAY ===== */
.mode-overlay {
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
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.22);
}

/* ===== SUCCESS TOAST ===== */
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

/* ===== OVERLAY PANELS ===== */
.overlay-panel {
  position: absolute;
  z-index: 20;
  max-width: min(300px, calc(100% - 20px));
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

.overlay-legend {
  top: 12px;
  right: 12px;
}

.legend-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex-shrink: 0;
}

.legend-label {
  flex: 1;
  font-size: 12px;
}

.legend-count {
  font-size: 11px;
  font-weight: 600;
  color: #0369a1;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(14, 165, 233, 0.1);
  font-family: 'Space Mono', monospace;
}

.overlay-info {
  top: 12px;
  left: 12px;
}

.info-steps {
  margin: 0;
  padding-left: 10px;
  font-size: 12px;
}

.info-steps li {
  margin: 4px 0;
  text-align: left;
}

/* ===== TRANSITIONS ===== */
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

@media (max-width: 768px) {
  .map-container {
    inset: 8px;
  }

  .overlay-legend,
  .overlay-info {
    left: 8px;
    right: 8px;
    max-width: none;
    max-height: 30vh;
    overflow-y: auto;
  }

  .overlay-legend {
    top: auto;
    bottom: 120px;
  }

  .overlay-info {
    top: 8px;
  }
}
</style>