<template>
  <div class="app-root">
    <canvas id="canvasMap" style="display: none"></canvas>

    <AppHeader title="矩形绘制示例" />

    <main class="map-area">
      <div class="grid-bg" />

      <div
        class="map-container"
        :class="{ 'drawing-mode': isDrawing }"
      >
        <div id="mapRectangleDrawMain" class="map-gl" />

        <aside class="overlay-panel overlay-hint" aria-label="操作说明">
          <div class="panel-title">操作说明</div>
          <p v-if="!slamMapReady" class="hint-wait">正在加载 SLAM 地图底图…</p>
          <ol class="hint-steps">
            <li>底图加载完成后，点击底部「{{ isDrawing ? '停止绘制' : '开始绘制' }}」进入或退出绘制模式</li>
            <li>PC：按住鼠标左键拖拽绘制矩形；松开鼠标完成</li>
            <li>移动端：单指按住拖拽绘制；双指拖动地图；松开完成</li>
          </ol>
        </aside>

        <aside class="overlay-panel overlay-stats" aria-label="矩形信息">
          <div class="panel-title">矩形信息</div>
          <template v-if="rectangleInfo">
            <dl class="stat-grid stat-grid-compact">
              <div><dt>面积</dt><dd class="tabular">{{ rectangleInfo.area.toFixed(2) }} m²</dd></div>
              <div><dt>周长</dt><dd class="tabular">{{ rectangleInfo.perimeter.toFixed(2) }} m</dd></div>
              <div><dt>中心</dt><dd class="tabular center-dd">
                X {{ rectangleInfo.center.x.toFixed(2) }} m，Y {{ rectangleInfo.center.y.toFixed(2) }} m
              </dd></div>
            </dl>

            <div class="points-block">
              <div class="points-head">角点坐标</div>
              <div class="points-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>角点</th>
                      <th>X (m)</th>
                      <th>Y (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(coords, name) in rectangleInfo.corners" :key="name">
                      <td>{{ formatCornerName(name) }}</td>
                      <td class="tabular">{{ coords.x.toFixed(2) }}</td>
                      <td class="tabular">{{ coords.y.toFixed(2) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
          <p v-else class="stats-empty">在地图上绘制矩形后，将在此显示面积与角点列表</p>
        </aside>
      </div>
    </main>

    <AppFooter>
      <template #left>
        <div class="footer-toolbar" role="toolbar" aria-label="绘制工具">
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
              :disabled="!hasRectangle"
              @click="clearRectangle"
            >
              清除矩形
            </button>
          </div>
          <div class="toolbar-options">
            <label class="opt"><span>填充</span>
              <input
                v-model="drawingOptions.fillColor"
                type="color"
                :disabled="!slamMapReady"
                @change="updateDrawingOptions"
              >
            </label>
            <label class="opt"><span>边线</span>
              <input
                v-model="drawingOptions.lineColor"
                type="color"
                :disabled="!slamMapReady"
                @change="updateDrawingOptions"
              >
            </label>
            <label class="opt opt-check\"><span>触摸（移动端）</span>
              <input
                v-model="drawingOptions.enableTouch"
                type="checkbox"
                :disabled="!slamMapReady"
                @change="updateDrawingOptions"
              >
            </label>
          </div>
        </div>
      </template>
    </AppFooter>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

import { SquareDashedMousePointer } from 'lucide-vue-next'

import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'

import bicMap from '../../../bicMap/core/bicmap-gl.js'
import { LAYER_IDS } from '../../../bicMap/core/layers/layerConfig.js'
import slamImage from '../../assets/slam_transparent.png'

const MAP_CONTAINER_ID = 'mapRectangleDrawMain'
const CANVAS_ID = 'canvasMap'

const MAP_START_X = -58.999993705749512
const MAP_START_Y = -21.349997329711914
const MAP_X_GRID_COUNT = 2752
const MAP_Y_GRID_COUNT = 1536
const MAP_RESOLUTION = 0.05
const MAP_ZOOM_FACTOR = 2
const MAP_IMAGE_PATH = slamImage

/** 经纬度 [lng, lat] → SLAM 笛卡尔坐标（米） */
function lngLatToCartesian(lngLat) {
  const Mu = window.MapUtils
  if (!Mu?.GPSToCartesian || !lngLat?.length) return null
  const c = Mu.GPSToCartesian({
    longitude: lngLat[0],
    latitude: lngLat[1],
    scale: MAP_RESOLUTION,
    zoomFactor: MAP_ZOOM_FACTOR
  })
  return { x: Number(c.x), y: Number(c.y) }
}

const map = ref(null)
const slamMapReady = ref(false)
const drawingController = ref(null)
const isDrawing = ref(false)
const hasRectangle = ref(false)
const rectangleInfo = ref(null)

const drawingOptions = ref({
  fillColor: '#ffbb00',
  fillOpacity: 0.12,
  lineColor: '#ffbb00',
  lineWidth: 3,
  enableTouch: true
})

async function initMap() {
  try {
    await bicMap.init()
    map.value = bicMap.createMap({
      container: MAP_CONTAINER_ID,
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
      imagePath: MAP_IMAGE_PATH,
      canvasId: CANVAS_ID,
      fitBounds: true
    })
    slamMapReady.value = true
  } catch (error) {
    console.error('加载SLAM地图失败:', error)
  }
}

function toggleDrawing() {
  if (!slamMapReady.value) return
  if (isDrawing.value) {
    if (drawingController.value) {
      drawingController.value.disable()
    }
    isDrawing.value = false
  } else {
    enableDrawing()
    isDrawing.value = true
  }
}

function enableDrawing() {
  if (!map.value || !slamMapReady.value) return

  if (drawingController.value) {
    drawingController.value.disable()
    drawingController.value = null
  }

  drawingController.value = bicMap.enableRectangleDrawing(map.value, {
    ...drawingOptions.value,
    onDrawComplete: (rectangle, corners) => {
      console.log('矩形绘制完成:', rectangle);
      console.log('矩形角点:', corners);
      hasRectangle.value = true;
      calculateRectangleInfo(rectangle, corners);
    }
  })

  syncDrawingStyle()
}

function syncDrawingStyle() {
  const m = map.value
  const o = drawingOptions.value
  if (!m || typeof m.isStyleLoaded !== 'function' || !m.isStyleLoaded()) return
  try {
    if (m.getLayer(LAYER_IDS.RECTANGLE_DRAW_FILL)) {
      m.setPaintProperty(LAYER_IDS.RECTANGLE_DRAW_FILL, 'fill-color', o.fillColor)
      m.setPaintProperty(LAYER_IDS.RECTANGLE_DRAW_FILL, 'fill-opacity', o.fillOpacity)
      m.setPaintProperty(LAYER_IDS.RECTANGLE_DRAW_FILL, 'fill-outline-color', o.lineColor)
    }
    if (m.getLayer(LAYER_IDS.RECTANGLE_DRAW_LINE)) {
      m.setPaintProperty(LAYER_IDS.RECTANGLE_DRAW_LINE, 'line-color', o.lineColor)
      m.setPaintProperty(LAYER_IDS.RECTANGLE_DRAW_LINE, 'line-width', o.lineWidth)
    }
  } catch (e) {
    console.warn('syncDrawingStyle:', e)
  }
}

function updateDrawingOptions() {
  syncDrawingStyle()
  if (!isDrawing.value) return

  if (drawingController.value) {
    drawingController.value.disable()
    drawingController.value = null
  }
  enableDrawing()
  isDrawing.value = true
}

function clearRectangle() {
  if (drawingController.value?.clearDrawing) {
    drawingController.value.clearDrawing()
  }
  hasRectangle.value = false
  rectangleInfo.value = null
}

// 计算矩形信息
const calculateRectangleInfo = (rectangle, corners) => {
  if (!bicMap.turf) return;
  
  try {
    // 计算面积（平方米）
    const area = bicMap.turf.area(rectangle)
    
    // 计算周长
    const coordinates = rectangle.geometry.coordinates[0];
    let perimeter = 0;
    
    for (let i = 0; i < coordinates.length - 1; i++) {
      const from = bicMap.turf.point(coordinates[i]);
      const to = bicMap.turf.point(coordinates[i + 1]);
      perimeter += bicMap.turf.distance(from, to, { units: 'meters' });
    }
    
    const centerLngLat = bicMap.turf.center(rectangle).geometry.coordinates
    const center = lngLatToCartesian(centerLngLat)
    const cartCorners = {}
    for (const [name, lngLat] of Object.entries(corners)) {
      const cart = lngLatToCartesian(lngLat)
      if (cart) cartCorners[name] = cart
    }

    if (!center || Object.keys(cartCorners).length < 4) {
      console.warn('笛卡尔坐标转换失败，请确认 MapUtils 已加载')
      return
    }

    rectangleInfo.value = {
      area,
      perimeter,
      center,
      corners: cartCorners
    }
  } catch (error) {
    console.error('计算矩形信息时出错:', error);
  }
};

function formatCornerName(name) {
  switch (name) {
    case 'northWest': return '西北 (左上)'
    case 'northEast': return '东北 (右上)'
    case 'southEast': return '东南 (右下)'
    case 'southWest': return '西南 (左下)'
    default: return name
  }
}

onMounted(() => {
  initMap()
})

onBeforeUnmount(() => {
  slamMapReady.value = false
  if (drawingController.value) {
    drawingController.value.disable()
    drawingController.value = null
  }
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})
</script>

<style lang="scss" scoped>
.app-root {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: fixed;
  inset: 0;
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

.map-container.drawing-mode {
  border-color: rgba(0, 102, 255, 0.35);
  box-shadow:
    0 4px 30px rgba(0, 102, 255, 0.12),
    0 0 0 1px rgba(255, 255, 255, 0.8) inset;
}

.map-gl {
  width: 100%;
  height: 100%;
}

.draw-overlay {
  position: absolute;
  top: 70px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  pointer-events: none;
  max-width: min(960px, calc(100vw - 32px));
}

.hint-pill {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(0, 51, 153, 0.88);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(100, 160, 255, 0.3);
  border-radius: 99px;
  color: #e8f0ff;
  font-size: 13px;
  box-shadow: 0 4px 20px rgba(0, 51, 153, 0.35);
  pointer-events: all;
}

.hint-icon {
  color: #7eb8ff;
  flex-shrink: 0;
}

.hint-pill__badge {
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
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

.overlay-panel {
  position: absolute;
  z-index: 20;
  max-width: min(350px, calc(100% - 20px));
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
  max-height: min(42vh, 380px);
  overflow-y: auto;
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
}

.hint-steps li {
  margin: 4px 0;
  text-align: left;
}

.hint-tips {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(14, 165, 233, 0.08);
  border-left: 3px solid #0ea5e9;
  font-size: 12px;
  font-weight: 500;
}

.overlay-stats {
  top: 12px;
  right: 12px;
  max-width: min(320px, calc(100% - 24px));
  max-height: min(52vh, 440px);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.stats-empty {
  margin: 0;
  padding: 12px 8px;
  text-align: center;
  color: #64748b;
  font-size: 12px;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 8px;
  margin: 0 0 8px;
}

.stat-grid dt {
  margin: 0;
  font-size: 10px;
  color: #64748b;
}

.stat-grid dd {
  margin: 2px 0 0;
  font-weight: 600;
  color: #0c4a6e;
  font-size: 11px;
}

.center-dd {
  grid-column: 1 / -1;
  font-weight: 500;
  font-size: 10px;
  word-break: break-all;
}

.points-block {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.points-head {
  font-size: 10px;
  font-weight: 600;
  color: #0369a1;
  margin-bottom: 4px;
}

.points-scroll {
  max-height: min(28vh, 200px);
  overflow: auto;
  border-radius: 6px;
  border: 1px solid rgba(14, 165, 233, 0.18);
  background: rgba(255, 255, 255, 0.5);
}

.points-scroll table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
}

.points-scroll th,
.points-scroll td {
  padding: 4px 6px;
  text-align: left;
  border-bottom: 1px solid rgba(14, 165, 233, 0.1);
}

.points-scroll th {
  position: sticky;
  top: 0;
  background: rgba(224, 242, 254, 0.95);
  font-weight: 600;
  color: #0369a1;
  z-index: 1;
}

.points-scroll tbody tr:nth-child(even) {
  background: rgba(14, 165, 233, 0.04);
}

.tabular {
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, 'SF Mono', monospace;
}

.footer-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn {
  font-size: 13px;
  font-weight: 500;
  color: #0369a1;
  background: rgba(14, 165, 233, 0.12);
  border: 1px solid rgba(14, 165, 233, 0.35);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  padding: 8px 14px;
}

.btn:hover:not(:disabled) {
  background: rgba(14, 165, 233, 0.2);
  border-color: rgba(14, 165, 233, 0.5);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-primary {
  background: rgba(14, 165, 233, 0.22);
  color: #0c4a6e;
}

.btn-primary.danger {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
  color: #b91c1c;
}

.btn-primary.danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.22);
}

.toolbar-options {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  font-size: 12px;
  color: #0c4a6e;
}

.opt {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.opt span {
  color: #64748b;
  white-space: nowrap;
}

.opt input[type='color'] {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid rgba(14, 165, 233, 0.35);
  border-radius: 6px;
  cursor: pointer;
}

.opt-check input {
  width: 16px;
  height: 16px;
  accent-color: #0ea5e9;
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
    max-height: min(34vh, 280px);
  }

  .overlay-stats {
    left: 8px;
    right: 8px;
    top: auto;
    bottom: 120px;
    max-width: none;
    max-height: min(34vh, 260px);
  }

  .draw-overlay {
    top: 62px;
  }
}
</style>