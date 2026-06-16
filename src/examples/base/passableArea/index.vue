<!--
 * @Author: Ella ella.yin@x-humanoid.com
 * @Date: 2026-05-09 17:26:00
 * @LastEditTime: 2026-05-28 16:39:16
 * @LastEditors: Ella ella.yin@x-humanoid.com
 * @Description: 可通行区域示例：SLAM 底图上按管理端 config 轨道线流程绘制中心线、配置宽度并渲染宽线与缓冲带多边形
 * @FilePath: /bic-map/src/examples/base/passableArea/index.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="app-root">
    <canvas id="canvasMap" class="canvas-hidden"></canvas>

    <AppHeader title="可通行区域示例" />

    <main class="map-area">
      <div class="grid-bg"></div>

      <div
        class="map-container"
        :class="{ 'drawing-mode': isDrawing }"
      >
        <div id="passableAreaMap" class="map-gl"></div>

        <aside class="overlay-panel overlay-hint" aria-label="操作说明">
          <div class="panel-title">操作说明</div>
          <p v-if="!slamMapReady" class="hint-wait">正在加载 SLAM 地图底图…</p>
          <ol v-else class="hint-steps">
            <li>点击底部「开始绘制」，在图上连续单击标定中心线，双击结束当前条。</li>
            <li>结束一条后填写宽度（米）并「确认添加」，或「放弃本条」重新画。</li>
            <li>「清空全部」移除已添加的宽线与可通行区域。</li>
          </ol>
          <div v-if="endDrawingLine && activeNewElement" class="pending-panel">
            <div class="panel-title">待确认</div>
            <p class="pending-meta">
              线 ID：{{ activeNewElement.properties.id }} · 顶点数 {{ activeNewElement.path.length }}
            </p>
          </div>
        </aside>
      </div>
    </main>

    <AppFooter>
      <template #left>
        <div class="footer-toolbar" role="toolbar" aria-label="可通行区域工具">
          <div class="toolbar-actions">
            <button
              type="button"
              class="btn btn-primary"
              :class="{ danger: isDrawing }"
              :disabled="!slamMapReady"
              @click="toggleDrawing"
            >
              {{ isDrawing ? '停止绘制' : '开始绘制' }}
            </button>
            <button
              type="button"
              class="btn"
              :disabled="!slamMapReady || !hasSavedLines"
              @click="clearAllRendered"
            >
              清空全部
            </button>
            <!-- <button
              type="button"
              class="btn"
              :disabled="!slamMapReady"
              @click="loadSlamMap"
            >
              <Upload class="btn-icon" :size="18" stroke-width="2" />
              加载底图
            </button> -->
          </div>
          <div class="toolbar-options">
            <template v-if="endDrawingLine && activeNewElement">
              <label class="opt">
                <span title="可通行区域宽度，范围 0.1～3.0 米，支持一位小数">可通行区域宽度(m)</span>
                <input
                  v-model="laneWidthInput"
                  type="text"
                  inputmode="decimal"
                  :class="{ 'opt-input--error': lineWidthError }"
                  @input="onLaneWidthInput"
                >
                <p v-if="lineWidthError" class="width-error">请输入0.1～3.0之间的数字，仅支持一位小数</p>
              </label>
              <button
                type="button"
                class="btn btn-sm"
                @click="discardPendingLine"
              >
                放弃本条
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                :disabled="lineWidthError"
                @click="confirmPendingLine"
              >
                确认添加
              </button>
            </template>
          </div>
        </div>
      </template>
    </AppFooter>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import AppFooter from '../../components/AppFooter.vue'
import AppHeader from '../../components/AppHeader.vue'

import slamImage from '../../assets/slam_transparent.png'
import { LAYER_IDS } from '../../../bicMap/core/layers/layerConfig.js'
import bicMap from '../../../bicMap/core/bicmap-gl'

/** 与 resource 地图 config.vue 轨道线绘制样式一致 */
const DRAWING_LINE_STYLE = {
  lineColor: '#00E1A0',
  lineWidth: 2,
  pointColor: '#0066ff',
  pointRadius: 4,
  defaultWidth: 0,
  minPoints: 2
}

/** 与 config.vue defaultLineStyle 一致；渲染宽线时传入 width（米） */
const DEFAULT_LINE_STYLE = {
  color: '#00E1A0',
  dashType: 'solid',
  opacity: 1,
  width: 0,
  outlineColor: '#00E1A0',
  showArrow: false
}

/** 与 config.vue defaultPolyLineStyle 一致（可通行带半透明填充） */
const DEFAULT_POLYLINE_AREA_STYLE = {
  fillColor: '#00e1a0',
  highlightColor: '#fff',
  outlineColor: '#00e1a0',
  fillOpacity: 0.1,
  outlineWidth: 0,
  filled: true
}

const LANE_WIDTH_MIN = 0.1
const LANE_WIDTH_MAX = 3

/** 待确认阶段用于展示中心线的临时折线 id（与绘制图层分离，避免 disable 清空后不可见） */
const PENDING_CENTERLINE_ID = 'passable-pending-centerline'

const MAP_START_X = -58.999993705749512
const MAP_START_Y = -21.349997329711914
const MAP_X_GRID_COUNT = 2752
const MAP_Y_GRID_COUNT = 1536
const MAP_RESOLUTION = 0.05
const MAP_CENTER = [116.4074, 39.9042]
const MAP_ZOOM = 18

const map = ref(null)
const cacheCameraBound = ref(null)
const slamMapReady = ref(false)

const lineController = ref(null)
const pendingPolylineController = ref(null)
const viewCenterlineController = ref(null)
const viewPolygonController = ref(null)

const isDrawing = ref(false)
const savedPassableLines = ref([])
const activeNewElement = ref(null)
const endDrawingLine = ref(false)

const laneWidthInput = ref('0.1')
const lineWidthError = ref(false)

const hasSavedLines = computed(() => savedPassableLines.value.length > 0)

onMounted(() => {
  initMap()
})

onBeforeUnmount(() => {
  teardownDrawing()
  if (viewCenterlineController.value?.remove) {
    viewCenterlineController.value.remove()
    viewCenterlineController.value = null
  }
  if (viewPolygonController.value?.remove) {
    viewPolygonController.value.remove()
    viewPolygonController.value = null
  }
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})

/**
 * 与 config.vue 一致的宽度校验：0.1～3，至多一位小数
 * @param {string|number} value
 * @returns {boolean} 是否合法
 */
function validateLaneWidth(value) {
  const s = value === null || value === undefined ? '' : String(value).trim()
  if (!/^\d*\.?\d{0,1}$/.test(s)) return false
  const n = Number(s)
  if (Number.isNaN(n)) return false
  return n >= LANE_WIDTH_MIN && n <= LANE_WIDTH_MAX
}

function onLaneWidthInput() {
  lineWidthError.value = !validateLaneWidth(laneWidthInput.value)
}

function resetLaneWidthField() {
  laneWidthInput.value = '0.1'
  lineWidthError.value = false
}

/**
 * @param {Array<{ properties: { id: string } }>} lines
 * @returns {string} 下一轨道线序号片段，如 001
 */
function getNextTrackLineSuffix(lines) {
  let maxId = 0
  for (const item of lines) {
    const id = item.properties?.id
    if (!id || !id.startsWith('trk-')) continue
    const n = Number(id.split('-')[1])
    if (!Number.isNaN(n) && n > maxId) maxId = n
  }
  let index = maxId + 1
  if (index < 10) return `00${index}`
  if (index < 100) return `0${index}`
  return String(index)
}

function syncDrawingStyle() {
  const m = map.value
  if (!m || typeof m.isStyleLoaded !== 'function' || !m.isStyleLoaded()) return
  try {
    if (m.getLayer(LAYER_IDS.POLYLINE_DRAW_FILL)) {
      m.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_FILL, 'fill-color', DRAWING_LINE_STYLE.lineColor)
      m.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_FILL, 'fill-opacity', 0.35)
      m.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_FILL, 'fill-outline-color', DRAWING_LINE_STYLE.lineColor)
    }
    if (m.getLayer(LAYER_IDS.POLYLINE_DRAW_LINE)) {
      m.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_LINE, 'line-color', DRAWING_LINE_STYLE.lineColor)
      m.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_LINE, 'line-width', DRAWING_LINE_STYLE.lineWidth)
    }
    if (m.getLayer(LAYER_IDS.POLYLINE_DRAW_POINTS)) {
      m.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_POINTS, 'circle-color', DRAWING_LINE_STYLE.pointColor)
      m.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_POINTS, 'circle-radius', DRAWING_LINE_STYLE.pointRadius)
    }
  } catch {
    /* style 尚未就绪时忽略 */
  }
}

function teardownDrawing() {
  clearPendingCenterline()
  if (lineController.value) {
    lineController.value.disable()
    lineController.value = null
  }
  isDrawing.value = false
  activeNewElement.value = null
  endDrawingLine.value = false
  resetLaneWidthField()
}

function ensurePendingPolylineController() {
  if (!map.value || pendingPolylineController.value) return
  pendingPolylineController.value = bicMap.createPolylines(map.value, [], {
    showArrow: false,
    defaultColor: DRAWING_LINE_STYLE.lineColor,
    defaultWidth: 4,
    defaultOpacity: 1
  })
}

/**
 * 双击结束后绘制数据源会被清空：用独立折线图层保留中心线，直到确认或放弃
 * @param {number[][]} pathLngLat
 */
function showPendingCenterline(pathLngLat) {
  if (!map.value || pathLngLat.length < 2) return
  ensurePendingPolylineController()
  const ctl = pendingPolylineController.value
  if (!ctl) return
  ctl.removePolyline(PENDING_CENTERLINE_ID)
  const path = pathLngLat.map((p) => [...p])
  ctl.addPolyline({
    id: PENDING_CENTERLINE_ID,
    path,
    color: DRAWING_LINE_STYLE.lineColor,
    width: 2,
    opacity: 1,
    dashType: 'solid',
    showArrow: false
  })
}

function clearPendingCenterline() {
  pendingPolylineController.value?.removePolyline(PENDING_CENTERLINE_ID)
}

function resumeLineDrawingIfNeeded() {
  if (!isDrawing.value || !map.value || !slamMapReady.value) return
  if (lineController.value) {
    lineController.value.enable()
  } else {
    lineController.value = bicMap.enablePolylineDrawing(map.value, {
      ...DRAWING_LINE_STYLE,
      onDrawComplete: onPolylineDrawComplete
    })
  }
  syncDrawingStyle()
}

/**
 * 折线绘制完成：去重末点、生成 trk id，并暂时 disable，避免待确认期间继续打点
 * @param {object} polylineData
 */
function onPolylineDrawComplete(polylineData) {
  let path = polylineData.path.map((p) => [...p])
  if (path.length >= 2) {
    const a = path[path.length - 1]
    const b = path[path.length - 2]
    if (a[0] === b[0] && a[1] === b[1]) {
      path = path.slice(0, -1)
    }
  }
  const suffix = getNextTrackLineSuffix(savedPassableLines.value)
  activeNewElement.value = {
    ...polylineData,
    path,
    properties: {
      id: `trk-${suffix}`,
      type: 'trackLine',
      lane_width: Number(laneWidthInput.value) || LANE_WIDTH_MIN
    }
  }
  endDrawingLine.value = true
  laneWidthInput.value = String(activeNewElement.value.properties.lane_width)
  onLaneWidthInput()
  showPendingCenterline(path)
  lineController.value?.disable()
}

function enableLineDrawing() {
  if (!map.value || !slamMapReady.value) return

  if (lineController.value) {
    lineController.value.disable()
    lineController.value = null
  }

  lineController.value = bicMap.enablePolylineDrawing(map.value, {
    ...DRAWING_LINE_STYLE,
    onDrawComplete: onPolylineDrawComplete
  })
  syncDrawingStyle()
}

function toggleDrawing() {
  if (!slamMapReady.value) return
  if (isDrawing.value) {
    if (endDrawingLine.value) {
      discardPendingLine()
    }
    teardownDrawing()
    return
  }
  if (endDrawingLine.value) {
    discardPendingLine()
  }
  isDrawing.value = true
  enableLineDrawing()
}

function discardPendingLine() {
  clearPendingCenterline()
  activeNewElement.value = null
  endDrawingLine.value = false
  resetLaneWidthField()
  resumeLineDrawingIfNeeded()
}

/**
 * 由中心线与宽度生成可通行带多边形环（与 config 语义一致，使用米制 buffer）
 * @param {number[][]} path
 * @param {number} widthMeters
 * @returns {number[][]|null}
 */
function bufferLineToRing(path, widthMeters) {
  const turf = bicMap.turf
  if (!turf || !path?.length || path.length < 2) return null
  const line = turf.lineString(path)
  const half = widthMeters / 2
  const buffered = turf.buffer(line, half, { units: 'meters' })
  if (!buffered?.geometry) return null
  if (buffered.geometry.type === 'Polygon') {
    return buffered.geometry.coordinates[0]
  }
  if (buffered.geometry.type === 'MultiPolygon') {
    return buffered.geometry.coordinates[0]?.[0] || null
  }
  return null
}

function confirmPendingLine() {
  if (!map.value || !activeNewElement.value || lineWidthError.value) return

  clearPendingCenterline()

  const width = Number(laneWidthInput.value)
  const path = activeNewElement.value.path
  const lineId = activeNewElement.value.properties.id
  const ring = bufferLineToRing(path, width)
  if (!ring || ring.length < 3) {
    return
  }

  const centerline = {
    id: lineId,
    path,
    color: DEFAULT_LINE_STYLE.color,
    width: DRAWING_LINE_STYLE.lineWidth,
    opacity: DEFAULT_LINE_STYLE.opacity,
    dashType: 'solid',
    showArrow: false
  }

  if (!viewCenterlineController.value) {
    viewCenterlineController.value = bicMap.createPolylines(map.value, [centerline], {
      showArrow: false
    })
  } else {
    viewCenterlineController.value.addPolyline(centerline)
  }

  const polyPayload = {
    ...DEFAULT_POLYLINE_AREA_STYLE,
    id: `line-polygon-${lineId}`,
    points: ring
  }
  if (!viewPolygonController.value) {
    viewPolygonController.value = bicMap.createPolygons(map.value, [], {
      ...DEFAULT_POLYLINE_AREA_STYLE
    })
  }
  viewPolygonController.value.addPolygon(polyPayload)

  savedPassableLines.value = [
    ...savedPassableLines.value,
    {
      type: 'Feature',
      path,
      properties: {
        ...activeNewElement.value.properties,
        lane_width: width
      },
      geometry: { coordinates: path }
    }
  ]

  activeNewElement.value = null
  endDrawingLine.value = false
  resetLaneWidthField()

  resumeLineDrawingIfNeeded()
}

function clearAllRendered() {
  if (viewCenterlineController.value?.clear) {
    viewCenterlineController.value.clear()
  }
  if (viewPolygonController.value) {
    const ids = viewPolygonController.value.getPolygonIds?.() || []
    for (const id of ids) {
      viewPolygonController.value.removePolygon(id)
    }
  }
  savedPassableLines.value = []
}

async function initMap() {
  try {
    await bicMap.init()
    map.value = bicMap.createMap({
      container: 'passableAreaMap',
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      pitch: 0,
      backgroundColor: '#fff',
      antialias: true
    })
    bicMap.addZoomControl(map.value, 'bottom-right')
    map.value.on('load', async () => {
      await loadSlamMap()
    })
  } catch (error) {
    console.error('初始化地图失败:', error)
  }
}

async function loadSlamMap() {
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
    slamMapReady.value = true
    syncDrawingStyle()
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

  &.drawing-mode {
    box-shadow:
      0 0 0 2px rgba(14, 165, 233, 0.35),
      0 4px 30px rgba(14, 165, 233, 0.08),
      0 0 0 1px rgba(255, 255, 255, 0.8) inset;
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
  z-index: 20;
  max-width: min(360px, calc(100% - 20px));
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

.overlay-hint {
  top: 12px;
  left: 12px;
}

.hint-wait {
  color: #64748b;
  font-size: 11px;
  margin: 0 0 8px;
}

.hint-steps {
  margin: 0;
  padding-left: 10px;
  font-size: 12px;

  li {
    margin: 4px 0;
    text-align: left;
  }
}

.pending-panel {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(14, 165, 233, 0.12);
}

.pending-meta {
  margin: 0;
  font-size: 11px;
  color: #64748b;
}

kbd {
  display: inline-block;
  padding: 1px 6px;
  margin: 0 1px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  color: #0c4a6e;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(14, 165, 233, 0.35);
  border-radius: 4px;
  box-shadow: 0 1px 0 rgba(14, 165, 233, 0.2);
}

.footer-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  font-size: 12px;
  color: #0c4a6e;
}

.opt {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  span {
    color: #64748b;
    white-space: nowrap;
  }

  input[type='text'] {
    width: 64px;
    padding: 4px 8px;
    border: 1px solid rgba(14, 165, 233, 0.35);
    border-radius: 6px;
    font-size: 12px;
  }
}

.opt-input--error {
  border-color: #dc2626 !important;
  background: rgba(254, 226, 226, 0.35);
}

.width-error {
  margin: 0;
  font-size: 11px;
  color: #b91c1c;
  width: 100%;
}

.btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 12px;
  border: 1px solid rgba(14, 165, 233, 0.2);
  font-size: 14px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.7);
  color: #0369a1;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.06);
  cursor: pointer;
  user-select: none;
  outline: none;
  transition: all 0.3s ease;

  &:focus-visible {
    box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.5), 0 2px 8px rgba(14, 165, 233, 0.06);
  }

  &:active:not(:disabled) {
    transform: scale(0.97);
  }

  &:hover:not(:disabled) {
    transform: translateY(-1px) scale(1.03);
    border-color: rgba(14, 165, 233, 0.35);
    box-shadow: 0 4px 15px rgba(14, 165, 233, 0.1);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 10px;
}

.btn-primary {
  border: none;
  color: #ffffff;
  background: linear-gradient(to right, #0167ff, #40bbe9, #c3e8ff);
  box-shadow: 0 4px 15px rgba(14, 165, 233, 0.3);

  &.danger {
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #b91c1c;
    background: rgba(255, 255, 255, 0.7);
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.06);
  }

  &.danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.45);
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.1);
  }
}

.btn-icon {
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .map-container {
    inset: 8px;
  }

  .overlay-hint {
    left: 8px;
    right: 8px;
    max-width: none;
    top: 8px;
    max-height: 38vh;
    overflow-y: auto;
  }
}
</style>
