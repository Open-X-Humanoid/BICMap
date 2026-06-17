<!--
 * @Date: 2026-04-28 19:20:00
 * @LastEditTime: 2026-04-28 19:20:00
 * @Description: 圆形绘制示例（BicMap-GL），UI 风格对齐矩形/多边形绘制
 * @FilePath: /bic-map/src/examples/base/circleDraw/index.vue
-->
<template>
  <div class="app-root">
    <canvas id="canvasMap" style="display: none"></canvas>

    <AppHeader title="圆形绘制示例" />

    <main class="map-area">
      <div class="grid-bg" />

      <div
        class="map-container"
        :class="{ 'drawing-mode': isDrawing }"
      >
        <div id="mapCircleDrawMain" class="map-gl" />

        <aside class="overlay-panel overlay-hint" aria-label="操作说明">
          <div class="panel-title">操作说明</div>
          <p v-if="!slamMapReady" class="hint-wait">正在加载 SLAM 地图底图…</p>
          <ol class="hint-steps">
            <li>底图加载完成后，点击底部「{{ isDrawing ? '停止绘制' : '开始绘制' }}」进入或退出绘制模式</li>
            <li>PC：按下确定圆心，拖拽确定半径；松开完成</li>
            <li>移动端：单指按住拖拽绘制；双指拖动地图；松开完成</li>
          </ol>
        </aside>

        <aside class="overlay-panel overlay-stats" aria-label="圆形信息">
          <div class="panel-title">圆形信息</div>
          <template v-if="circleInfo">
            <dl class="stat-grid stat-grid-compact">
              <div><dt>面积</dt><dd class="tabular">{{ circleInfo.area.toFixed(2) }} m²</dd></div>
              <div><dt>周长</dt><dd class="tabular">{{ circleInfo.perimeter.toFixed(2) }} m</dd></div>
              <div><dt>半径</dt><dd class="tabular">{{ circleInfo.radius.toFixed(2) }} m</dd></div>
              <div><dt>中心</dt><dd class="tabular center-dd">
                {{ circleInfo.center[0].toFixed(6) }}, {{ circleInfo.center[1].toFixed(6) }}
              </dd></div>
            </dl>
          </template>
          <p v-else class="stats-empty">在地图上绘制圆形后，将在此显示面积、周长与半径</p>
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
              :disabled="!hasCircle"
              @click="clearCircle"
            >
              清除圆形
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
            <label class="opt opt-check"><span>触摸（移动端）</span>
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

import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'

import bicMap from '../../../bicMap/core/bicmap-gl.js'
import slamImage from '../../assets/slam_transparent.png'

const MAP_CONTAINER_ID = 'mapCircleDrawMain'
const CANVAS_ID = 'canvasMap'

const MAP_START_X = -58.999993705749512
const MAP_START_Y = -21.349997329711914
const MAP_X_GRID_COUNT = 2752
const MAP_Y_GRID_COUNT = 1536
const MAP_RESOLUTION = 0.05
const MAP_IMAGE_PATH = slamImage

// 持久展示层（最终圆）
const CIRCLE_DISPLAY_SOURCE_ID = 'circle_display_source'
const CIRCLE_DISPLAY_FILL_ID = 'circle_display_fill'
const CIRCLE_DISPLAY_OUTLINE_ID = 'circle_display_outline'

// 交互绘制层（拖拽预览圆）
const CIRCLE_DRAW_SOURCE_ID = 'circle_draw_source'
const CIRCLE_DRAW_FILL_ID = 'circle_draw_fill'
const CIRCLE_DRAW_OUTLINE_ID = 'circle_draw_outline'

const map = ref(null)
const slamMapReady = ref(false)
const isDrawing = ref(false)
const hasCircle = ref(false)
const circleInfo = ref(null)

const drawingController = ref(null)
const displayLayer = ref(null)

const drawingOptions = ref({
  fillColor: '#c34646',
  fillOpacity: 0.12,
  lineColor: '#c34646',
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
    initDisplayLayer()
  } catch (error) {
    console.error('加载SLAM地图失败:', error)
  }
}

function initDisplayLayer() {
  if (!map.value) return
  displayLayer.value = bicMap.createCircles(map.value, [], {
    sourceId: CIRCLE_DISPLAY_SOURCE_ID,
    fillLayerId: CIRCLE_DISPLAY_FILL_ID,
    outlineLayerId: CIRCLE_DISPLAY_OUTLINE_ID,
    fillColor: drawingOptions.value.fillColor,
    fillOpacity: drawingOptions.value.fillOpacity,
    outlineColor: drawingOptions.value.lineColor,
    outlineWidth: drawingOptions.value.lineWidth
  })
}

function toggleDrawing() {
  if (!slamMapReady.value) return
  if (isDrawing.value) {
    drawingController.value?.disable?.()
    isDrawing.value = false
  } else {
    enableDrawing()
    isDrawing.value = true
  }
}

function enableDrawing() {
  if (!map.value || !slamMapReady.value) return
  if (!displayLayer.value) initDisplayLayer()

  if (!drawingController.value) {
    drawingController.value = bicMap.enableCircleDrawing(map.value, {
      sourceId: CIRCLE_DRAW_SOURCE_ID,
      fillLayerId: CIRCLE_DRAW_FILL_ID,
      outlineLayerId: CIRCLE_DRAW_OUTLINE_ID,
      fillColor: drawingOptions.value.fillColor,
      fillOpacity: drawingOptions.value.fillOpacity,
      lineColor: drawingOptions.value.lineColor,
      lineWidth: drawingOptions.value.lineWidth,
      enableTouch: drawingOptions.value.enableTouch,
      onDrawStart: () => {
        // 开始绘制第二个圆时立刻清掉上一个圆
        displayLayer.value?.clear?.()
        hasCircle.value = false
        circleInfo.value = null
        syncDrawingStyle()
      },
      onDrawComplete: (payload, info) => {
        // 单圆：替换展示层数据
        displayLayer.value?.clear?.()
        displayLayer.value?.addCircle?.({ center: payload.center, radiusM: payload.radiusM })

        hasCircle.value = true
        circleInfo.value = info
      }
    })
  }

  syncDrawingStyle()
}

function syncDrawingStyle() {
  const m = map.value
  const o = drawingOptions.value
  if (!m || typeof m.isStyleLoaded !== 'function' || !m.isStyleLoaded()) return
  try {
    if (m.getLayer(CIRCLE_DISPLAY_FILL_ID)) {
      m.setPaintProperty(CIRCLE_DISPLAY_FILL_ID, 'circle-color', o.fillColor)
      m.setPaintProperty(CIRCLE_DISPLAY_FILL_ID, 'circle-opacity', hasCircle.value ? o.fillOpacity : 0)
    }
    if (m.getLayer(CIRCLE_DISPLAY_OUTLINE_ID)) {
      m.setPaintProperty(CIRCLE_DISPLAY_OUTLINE_ID, 'circle-stroke-color', o.lineColor)
      m.setPaintProperty(CIRCLE_DISPLAY_OUTLINE_ID, 'circle-stroke-width', o.lineWidth)
      m.setPaintProperty(CIRCLE_DISPLAY_OUTLINE_ID, 'circle-stroke-opacity', hasCircle.value ? 1 : 0)
    }
  } catch (e) {
    console.warn('syncDrawingStyle:', e)
  }
}

function updateDrawingOptions() {
  syncDrawingStyle()
  if (!isDrawing.value) return
  // 重新创建 controller 以应用 enableTouch 选项
  drawingController.value?.disable?.()
  drawingController.value = null
  enableDrawing()
}

function clearCircle() {
  displayLayer.value?.clear?.()
  hasCircle.value = false
  circleInfo.value = null
  syncDrawingStyle()
}

onMounted(() => {
  initMap()
})

onBeforeUnmount(() => {
  slamMapReady.value = false
  drawingController.value?.disable?.()
  drawingController.value = null
  displayLayer.value?.remove?.()
  displayLayer.value = null
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
.map-area { flex: 1; position: relative; overflow: hidden; z-index: 10; }
.grid-bg {
  position: absolute; inset: 0; opacity: 0.04;
  background-image:
    linear-gradient(rgba(14, 165, 233, 1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14, 165, 233, 1) 1px, transparent 1px);
  background-size: 40px 40px;
}
.map-container {
  position: absolute; inset: 12px; border-radius: 16px; overflow: hidden;
  background: rgb(129 182 220 / 49%);
  box-shadow: 0 4px 30px rgba(14, 165, 233, 0.06), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;
  transition: border-color 0.25s, box-shadow 0.25s;
}
.map-container.drawing-mode {
  border-color: rgba(0, 102, 255, 0.35);
  box-shadow: 0 4px 30px rgba(0, 102, 255, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;
}
.map-gl { width: 100%; height: 100%; }
.overlay-panel {
  position: absolute; z-index: 20;
  max-width: min(350px, calc(100% - 20px));
  padding: 12px; border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(14, 165, 233, 0.22);
  box-shadow: 0 8px 32px rgba(14, 165, 233, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.6) inset;
  font-size: 13px; line-height: 1.45; color: #0c4a6e;
}
.panel-title {
  font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
  color: #0369a1; margin-bottom: 8px; padding-bottom: 6px;
  border-bottom: 1px solid rgba(14, 165, 233, 0.15);
}
.overlay-hint { top: 12px; left: 12px; max-height: min(42vh, 380px); overflow-y: auto; }
.hint-wait { color: #64748b; font-size: 11px; margin: 0 0 8px; }
.hint-steps { margin: 0; padding-left: 10px; font-size: 12px; }
.hint-steps li { margin: 4px 0; text-align: left; }
.overlay-stats {
  top: 12px; right: 12px;
  max-width: min(320px, calc(100% - 24px));
  max-height: min(52vh, 440px);
  display: flex; flex-direction: column; min-height: 0;
}
.stats-empty { margin: 0; padding: 12px 8px; text-align: center; color: #64748b; font-size: 12px; }
.stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px; margin: 0 0 8px; }
.stat-grid dt { margin: 0; font-size: 10px; color: #64748b; }
.stat-grid dd { margin: 2px 0 0; font-weight: 600; color: #0c4a6e; font-size: 11px; }
.center-dd { grid-column: 1 / -1; font-weight: 500; font-size: 10px; word-break: break-all; }
.tabular { font-variant-numeric: tabular-nums; font-family: ui-monospace, 'SF Mono', monospace; }
.footer-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.toolbar-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.btn {
  font-size: 13px; font-weight: 500; color: #0369a1;
  background: rgba(14, 165, 233, 0.12);
  border: 1px solid rgba(14, 165, 233, 0.35);
  border-radius: 8px; cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  padding: 8px 14px;
}
.btn:hover:not(:disabled) { background: rgba(14, 165, 233, 0.2); border-color: rgba(14, 165, 233, 0.5); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-primary { background: rgba(14, 165, 233, 0.22); color: #0c4a6e; }
.btn-primary.danger { background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.4); color: #b91c1c; }
.btn-primary.danger:hover:not(:disabled) { background: rgba(239, 68, 68, 0.22); }
.toolbar-options { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; font-size: 12px; color: #0c4a6e; }
.opt { display: inline-flex; align-items: center; gap: 6px; }
.opt span { color: #64748b; white-space: nowrap; }
.opt input[type='color'] { width: 28px; height: 28px; padding: 0; border: 1px solid rgba(14, 165, 233, 0.35); border-radius: 6px; cursor: pointer; }
.opt-check input { width: 16px; height: 16px; accent-color: #0ea5e9; }
@media (max-width: 768px) {
  .map-container { inset: 8px; }
  .overlay-hint { left: 8px; right: 8px; max-width: none; top: 8px; max-height: min(34vh, 280px); }
  .overlay-stats { left: 8px; right: 8px; top: auto; bottom: 120px; max-width: none; max-height: min(34vh, 260px); }
}
</style>