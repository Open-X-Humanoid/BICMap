<!--
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-04-23 16:35:30
 * @LastEditTime: 2026-06-03 15:52:20
 * @LastEditors: houser.hao@humanoid.com
 * @Description: SLAM地图显示 + 线段绘制示例
 * @FilePath: /bic-map/src/examples/base/polylineDraw/index.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 * lucide-vue-next预览地址: https://lucide.dev/icons/
-->
<template>
  <div class="app-root">
    <canvas id="canvasMap" style="display: none"></canvas>

    <AppHeader title="折线绘制示例" />

    <main class="map-area">
      <div class="grid-bg"></div>

      <div class="map-container">
        <div id="slamMap" class="map-gl"></div>

        <!-- 操作说明（固定步骤，与是否开始绘制无关） -->
        <aside class="overlay-panel overlay-hint" aria-label="绘制说明">
          <div class="panel-title">操作说明</div>
          <p v-if="!slamMapReady" class="hint-wait">正在加载地图底图…</p>
          <ol class="hint-steps">
            <li>点击底部「开始绘制」，在 SLAM 地图上绘制宽线段</li>
            <li>单击地图添加路径点；移动鼠标可预览当前笔划</li>
            <li>双击或按 <kbd>Enter</kbd> 完成当前一条线段；完成后可直接继续点击绘制下一条</li>
            <li>按 <kbd>Esc</kbd> 仅取消当前未完成的笔划，已完成的线段保留</li>
            <li>点击「停止绘制」结束交互；「清除线段」清空全部已画线段</li>
          </ol>
          <!-- <p class="hint-section-label">移动端</p>
          <ul class="hint-mobile">
            <li>单指点击添加点，双击完成当前线段。</li>
          </ul> -->
        </aside>

        <!-- 线段信息（紧凑：条数 + 最近一条摘要 + 可滚动坐标表） -->
        <!-- <aside class="overlay-panel overlay-stats" aria-label="线段信息">
          <div class="panel-title">线段信息</div>
          <div v-if="latestPolyline" class="polyline-detail">
            <p class="stats-count">共 {{ polylineList.length }} 条（展示最近一条）</p>
            <dl class="stat-grid stat-grid-compact">
              <div><dt>宽度</dt><dd>{{ latestPolyline.width }} m</dd></div>
              <div><dt>长度</dt><dd class="tabular">{{ latestPolyline.length.toFixed(2) }} km</dd></div>
              <div><dt>面积</dt><dd class="tabular">{{ latestPolyline.area.toFixed(4) }} km²</dd></div>
              <div><dt>点数</dt><dd>{{ latestPolyline.pointCount }}</dd></div>
            </dl>
            <div class="points-block">
              <div class="points-head">最近一条 · 路径点</div>
              <div class="points-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>经度</th>
                      <th>纬度</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(point, index) in latestPolyline.path" :key="index">
                      <td>{{ index + 1 }}</td>
                      <td class="tabular">{{ point[0].toFixed(6) }}</td>
                      <td class="tabular">{{ point[1].toFixed(6) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <p v-else class="stats-empty">完成绘制后将显示条数与最近一条详情</p>
        </aside> -->
      </div>
    </main>

    <AppFooter>
      <template #left>
        <div class="toolbar-actions" role="toolbar" aria-label="绘制工具">
          <button
            type="button"
            class="btn btn-primary"
            :class="{ danger: isDrawing }"
            :disabled="!slamMapReady"
            @click="toggleDrawing"
          >
            {{ isDrawing ? "停止绘制" : "开始绘制" }}
          </button>
          <!-- <button type="button" class="btn" @click="finishDrawing" :disabled="!isDrawing || !canFinish">完成当前绘制</button> -->
          <button
            type="button"
            class="btn"
            :disabled="!hasPolyline"
            @click="clearPolyline"
          >
            清除线段
          </button>
        </div>
        <div class="toolbar-options">
          <!-- <label class="opt"><span>填充</span>
            <input v-model="drawingOptions.fillColor" type="color" @input="syncDrawingStyle">
          </label> -->
          <label class="opt"><span>线段</span>
            <input v-model="drawingOptions.lineColor" type="color" @input="syncDrawingStyle">
          </label>
          <label class="opt"><span>顶点</span>
            <input v-model="drawingOptions.pointColor" type="color" @input="syncDrawingStyle">
          </label>
          <!-- <label class="opt"><span>宽度(m)</span>
            <input
              v-model.number="drawingOptions.defaultWidth"
              type="number"
              min="1"
              max="200"
              step="0.1"
              @input="updateWidth"
            >
          </label> -->
          <label class="opt"><span>最少点数</span>
            <input
              v-model.number="drawingOptions.minPoints"
              type="number"
              min="2"
              @change="restartDrawingIfActive"
            >
          </label>
          <!-- <label class="opt opt-check"><span>触摸</span>
            <input v-model="drawingOptions.enableTouch" type="checkbox" @change="restartDrawingIfActive">
          </label> -->
        </div>
      </template>
    </AppFooter>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import AppHeader from "../../components/AppHeader.vue";
import AppFooter from "../../components/AppFooter.vue";
import bicMap from "../../../bicMap/core/bicmap-gl.js";
import { LAYER_IDS } from "../../../bicMap/core/layers/layerConfig.js";
import slamImage from "../../assets/slam_transparent.png";

const MAP_START_X = -58.999993705749512;
const MAP_START_Y = -21.349997329711914;
const MAP_X_GRID_COUNT = 2048;
const MAP_Y_GRID_COUNT = 1143;
const MAP_RESOLUTION = 0.05;
const MAP_IMAGE_PATH = slamImage;

const map = ref(null);
const cacheCameraBound = ref(null);
const slamMapReady = ref(false);

const drawingController = ref(null);
const isDrawing = ref(false);
const polylineList = ref([]);
const currentPointCount = ref(0);

const hasPolyline = computed(() => polylineList.value.length > 0);

/** 与 pathReplay 路线渐变色一致 */
const ROUTE_COLOR_START = "#00F5FF";
const ROUTE_COLOR_END = "#00EE00";
const ROUTE_LINE_WIDTH = 5;
const ROUTE_LINE_OPACITY = 0.85;

const drawingOptions = ref({
  fillColor: ROUTE_COLOR_START,
  fillOpacity: 0.35,
  lineColor: ROUTE_COLOR_START,
  lineWidth: ROUTE_LINE_WIDTH,
  pointColor: "#09E9F1",
  pointRadius: 6,
  defaultWidth: 0,
  enableTouch: true,
  minPoints: 2,
});

const polylinesController = ref(null);

function interpolateColor(color1, color2, ratio) {
  const hex2rgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [0, 0, 0];
  };
  const rgb2hex = (r, g, b) =>
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("");
  const [r1, g1, b1] = hex2rgb(color1);
  const [r2, g2, b2] = hex2rgb(color2);
  return rgb2hex(
    r1 + (r2 - r1) * ratio,
    g1 + (g2 - g1) * ratio,
    b1 + (b2 - b1) * ratio
  );
}

function buildGradientSegments(path, baseId) {
  if (!path || path.length < 2) return [];
  const totalSegments = path.length - 1;
  return Array.from({ length: totalSegments }, (_, i) => ({
    id: `${baseId}-seg-${i}`,
    path: [path[i], path[i + 1]],
    color: interpolateColor(
      ROUTE_COLOR_START,
      ROUTE_COLOR_END,
      i / Math.max(totalSegments - 1, 1)
    ),
    width: ROUTE_LINE_WIDTH,
    opacity: ROUTE_LINE_OPACITY,
    showArrow: true,
    arrowSize: 0.5,
    arrowSpacing: 35,
  }));
}

function rebuildCompletedPolylines() {
  const m = map.value;
  if (!m) return;
  const segments = polylineList.value.flatMap((item, index) =>
    buildGradientSegments(item.path, `polyline-draw-${index}`)
  );
  if (!segments.length) {
    polylinesController.value?.remove?.();
    polylinesController.value = null;
    return;
  }
  if (!polylinesController.value) {
    polylinesController.value = bicMap.createPolylines(m, segments, {
      showArrow: true,
      arrowSpacing: 35,
      arrowSize: 0.5,
      arrowImagePath: "/bicMap/assets/svg/arrow.svg",
    });
  } else {
    polylinesController.value.update(segments);
  }
}

function updatePointCount() {
  if (drawingController.value && drawingController.value.getPoints) {
    const points = drawingController.value.getPoints();
    currentPointCount.value = points.length;
  } else {
    currentPointCount.value = 0;
  }
}

function toggleDrawing() {
  if (isDrawing.value) {
    if (drawingController.value) {
      drawingController.value.disable();
    }
    isDrawing.value = false;
    currentPointCount.value = 0;
  } else {
    enableDrawing();
    isDrawing.value = true;
  }
}

function enableDrawing() {
  if (!map.value) return;

  if (drawingController.value) {
    drawingController.value.disable();
    drawingController.value = null;
  }

  drawingController.value = bicMap.enablePolylineDrawing(map.value, {
    ...drawingOptions.value,
    onDrawComplete: (polylineData) => {
      polylineList.value = [...polylineList.value, polylineData];
      rebuildCompletedPolylines();
      // 清除绘制层预览，避免与 pathReplay 渐变路线叠影
      const source = map.value?.getSource("polyline-draw-source");
      source?.setData?.({ type: "FeatureCollection", features: [] });
      const allCoords = polylineList.value.map((item, i) => ({
        index: i + 1,
        path: item.path,
      }));
      console.log("[polylineDraw] 线段集合坐标：", allCoords);
      currentPointCount.value = 0;
    },
  });

  syncDrawingStyle();

  const updateInterval = setInterval(() => {
    if (!isDrawing.value) {
      clearInterval(updateInterval);
      return;
    }
    updatePointCount();
  }, 100);
}

function syncDrawingStyle() {
  const m = map.value;
  const o = drawingOptions.value;
  if (!m || typeof m.isStyleLoaded !== "function" || !m.isStyleLoaded()) {
    return;
  }
  try {
    if (m.getLayer(LAYER_IDS.POLYLINE_DRAW_FILL)) {
      m.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_FILL, "fill-color", o.fillColor);
      m.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_FILL, "fill-opacity", o.fillOpacity);
      m.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_FILL, "fill-outline-color", o.lineColor);
    }
    if (m.getLayer(LAYER_IDS.POLYLINE_DRAW_LINE)) {
      m.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_LINE, "line-color", o.lineColor);
      m.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_LINE, "line-width", o.lineWidth);
    }
    if (m.getLayer(LAYER_IDS.POLYLINE_DRAW_POINTS)) {
      m.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_POINTS, "circle-color", o.pointColor);
      m.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_POINTS, "circle-radius", o.pointRadius);
    }
  } catch (e) {
    console.warn("syncDrawingStyle:", e);
  }
}

function updateWidth() {
  syncDrawingStyle();
  if (
    isDrawing.value &&
    drawingController.value &&
    drawingController.value.setWidth
  ) {
    drawingController.value.setWidth(drawingOptions.value.defaultWidth);
  }
}

/** 最少点数、触摸等需重新挂载交互时 */
function restartDrawingIfActive() {
  if (!isDrawing.value || !map.value) return;
  if (drawingController.value) {
    drawingController.value.disable();
    drawingController.value = null;
  }
  currentPointCount.value = 0;
  enableDrawing();
  isDrawing.value = true;
}

function clearPolyline() {
  if (drawingController.value?.clearDrawing) {
    drawingController.value.clearDrawing();
  }
  polylineList.value = [];
  rebuildCompletedPolylines();
  currentPointCount.value = 0;
}

onMounted(() => {
  initMap();
});

onBeforeUnmount(() => {
  if (drawingController.value) {
    drawingController.value.disable();
    drawingController.value = null;
  }
  if (polylinesController.value?.remove) {
    polylinesController.value.remove();
    polylinesController.value = null;
  }
  if (map.value) {
    map.value.remove();
    map.value = null;
  }
});

async function initMap() {
  try {
    await bicMap.init();
    map.value = bicMap.createMap({
      container: "slamMap",
      center: [116.4074, 39.9042],
      zoom: 18,
      backgroundColor: "#fff",
    });
    bicMap.addZoomControl(map.value, "bottom-right");
    map.value.on("load", () => {
      loadSlamMap();
    });
  } catch (error) {
    console.error("初始化地图失败:", error);
  }
}

async function loadSlamMap() {
  if (!map.value) return;
  try {
    const result = await bicMap.loadSlamMap(map.value, {
      startX: MAP_START_X,
      startY: MAP_START_Y,
      xGridCount: MAP_X_GRID_COUNT,
      yGridCount: MAP_Y_GRID_COUNT,
      resolution: MAP_RESOLUTION,
      imagePath: MAP_IMAGE_PATH,
      canvasId: "canvasMap",
      fitBounds: true,
    });
    cacheCameraBound.value = result.cameraBound;
    slamMapReady.value = true;
  } catch (error) {
    console.error("加载SLAM地图失败:", error);
  }
}
</script>

<style scoped>
.app-root {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  background: linear-gradient(
    160deg,
    #e8f4fc 0%,
    #eef1f8 30%,
    #f0f6fb 60%,
    #e6f0fa 100%
  );
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

/* —— 浮层通用 —— */
.overlay-panel {
  position: absolute;
  z-index: 20;
  max-width: min(330px, calc(100% - 20px));
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
}
.hint-steps li {
  margin: 4px 0;
  text-align: left;
}

.hint-mobile {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 11px;
}

.hint-section-label {
  margin: 10px 0 4px;
  font-size: 11px;
  font-weight: 600;
  color: #0284c7;
}

.hint-tips {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(14, 165, 233, 0.08);
  border-left: 3px solid #0ea5e9;
  font-size: 12px;
  font-weight: 500;
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

.overlay-stats {
  top: 12px;
  right: 12px;
  max-width: min(240px, calc(100% - 24px));
  max-height: min(40vh, 320px);
  padding: 8px 10px;
  font-size: 11px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.stats-count {
  margin: 0 0 6px;
  font-size: 10px;
  color: #64748b;
}

.stats-empty {
  margin: 0;
  padding: 10px 6px;
  text-align: center;
  color: #64748b;
  font-size: 11px;
}

.polyline-detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  flex: 1;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 8px;
  margin: 0;
}
.stat-grid-compact dt {
  font-size: 10px;
}
.stat-grid-compact dd {
  font-size: 11px;
}
.stat-grid dt {
  margin: 0;
  font-size: 11px;
  color: #64748b;
}
.stat-grid dd {
  margin: 2px 0 0;
  font-weight: 600;
  color: #0c4a6e;
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
  max-height: min(22vh, 140px);
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
  padding: 3px 5px;
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
.points-scroll tr:last-child td {
  border-bottom: none;
}
.points-scroll tbody tr:nth-child(even) {
  background: rgba(14, 165, 233, 0.04);
}

.tabular {
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, "SF Mono", monospace;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
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
}
.btn:focus-visible {
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.5), 0 2px 8px rgba(14, 165, 233, 0.06);
}
.btn:active:not(:disabled) {
  transform: scale(0.97);
}
.btn:hover:not(:disabled) {
  transform: translateY(-1px) scale(1.03);
  border-color: rgba(14, 165, 233, 0.35);
  box-shadow: 0 4px 15px rgba(14, 165, 233, 0.1);
}
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.btn-primary {
  border: none;
  color: #ffffff;
  background: linear-gradient(to right, #0167ff, #40bbe9, #c3e8ff);
  box-shadow: 0 4px 15px rgba(14, 165, 233, 0.3);
}
.btn-primary.danger {
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: #b91c1c;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.06);
}
.btn-primary.danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.45);
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.10);
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
.opt input[type="color"] {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid rgba(14, 165, 233, 0.35);
  border-radius: 6px;
  cursor: pointer;
}
.opt input[type="number"] {
  width: 56px;
  padding: 4px 6px;
  border: 1px solid rgba(14, 165, 233, 0.35);
  border-radius: 6px;
  font-size: 12px;
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
    max-height: 38vh;
    overflow-y: auto;
  }

  .overlay-stats {
    left: 8px;
    right: 8px;
    top: auto;
    bottom: 120px;
    max-width: none;
    max-height: min(36vh, 280px);
  }
}
</style>
