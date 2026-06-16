<!--
 * @Description: 可通行区域编辑示例
 * @FilePath: /bic-map-plugin/src/examples/base/editPassableArea/index.vue
-->
<template>
  <div class="app-root">
    <canvas id="canvasMap" style="display: none"></canvas>

    <AppHeader title="可通行区域编辑" />

    <main class="map-area">
      <div class="grid-bg"></div>

      <div class="map-container">
        <div id="slamMap" class="map-gl"></div>

        <aside class="overlay-panel overlay-hint" aria-label="编辑说明">
          <div class="panel-title">中心线编辑</div>
          <p v-if="!slamMapReady" class="hint-wait">正在加载地图底图…</p>
          <template v-else>
            <dl class="stat-grid">
              <div><dt>状态</dt><dd>{{ editStatusLabel }}</dd></div>
              <div><dt>折点数量</dt><dd class="tabular">{{ centerLine.path.length }}</dd></div>
            </dl>
            <ol class="hint-steps">
              <li>页面加载后默认显示一条中心线</li>
              <li>点击「开始编辑」按钮进入编辑模式</li>
              <li>在编辑模式下可拖动顶点修改折线形状</li>
              <li>点击「完成编辑」退出编辑模式</li>
            </ol>
          </template>
        </aside>
      </div>
    </main>

    <AppFooter>
      <template #left>
        <div class="toolbar-actions" role="toolbar" aria-label="可通行区域编辑控制">
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!slamMapReady || isEditing"
            @click="onStartEdit"
          >
            开始编辑
          </button>
          <div v-if="isEditing" class="width-input-wrapper">
            <span class="input-label">宽度(米):</span>
            <input
              type="number"
              v-model.number="laneWidth"
              min="0.1"
              max="10"
              step="0.1"
              class="width-input"
            />
          </div>
          <button
            type="button"
            class="btn"
            :disabled="!slamMapReady || !isEditing"
            @click="onFinishEdit"
          >
            完成编辑
          </button>
          <button
            type="button"
            class="btn"
            :disabled="!slamMapReady"
            @click="onReset"
          >
            重置
          </button>
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
import slamImage from "../../assets/slam_transparent.png";

const MAP_START_X = -58.999993705749512;
const MAP_START_Y = -21.349997329711914;
const MAP_X_GRID_COUNT = 2752;
const MAP_Y_GRID_COUNT = 1536;
const MAP_RESOLUTION = 0.05;
const MAP_IMAGE_PATH = slamImage;

/** 默认中心线（折线坐标） */
const DEFAULT_CENTER_LINE = [
  [116.40736641581213, 39.904212253430586],
  [116.4073990702347, 39.904212362818356],
  [116.40742915793516, 39.904212690981666],
  [116.40744912133704, 39.904212690981666],
  [116.40744954912492, 39.90420109587896],
  [116.40745040469938, 39.90419420444897],
  [116.40746252533586, 39.90419442322454],
  [116.40746765878265, 39.90419453261234],
];

const laneWidth = ref(0.3); // 轨道宽度（米）

const defaultLineStyle = {
  color: '#00E1A0',
  dashType: 'solid',
  opacity: 1,
  width: 0,
  outlineColor: '#00E1A0',
  showArrow: false,
};

const defaultPolyLineStyle = {
  fillColor: '#00e1a0',
  highlightColor: '#fff',
  outlineColor: '#00e1a0',
  fillOpacity: 0.1,
  outlineWidth: 0,
  filled: true,
};

const map = ref(null);
const slamMapReady = ref(false);
const viewLineController = ref(null);
const viewPolygonController = ref(null);
const isEditing = ref(false);

const centerLine = ref({
  id: 'center-line-1',
  path: DEFAULT_CENTER_LINE
});

const updateLine = ref(null);

/** 轨道线外围多边形 */
const linePolygon = ref(null);

const editStatusLabel = computed(() => {
  if (!slamMapReady.value) return '加载中';
  return isEditing.value ? '编辑中' : '就绪';
});

function initCenterLine() {
  const m = map.value;
  if (!m) return;

  // 绘制中心线
  const line = {
    ...defaultLineStyle,
    id: centerLine.value.id,
    path: centerLine.value.path,
  };
  viewLineController.value = bicMap.createWideLines(m, [line], {});

  // 生成并绘制轨道线外围多边形
  drawTrackLinePolygon(centerLine.value.path);
}

/**
 * 绘制轨道线外围多边形
 * @param {number[][]} path 中心线坐标
 */
function drawTrackLinePolygon(path) {
  const m = map.value;
  if (!m) return;

  // 使用 bufferLineToRing 生成多边形
  const polygonPoints = bufferLineToRing(path, laneWidth.value);

  if (!polygonPoints || polygonPoints.length < 3) return;

  linePolygon.value = {
    id: 'line-polygon-' + centerLine.value.id,
    points: polygonPoints,
  };

  const polygon = {
    ...defaultPolyLineStyle,
    id: linePolygon.value.id,
    points: linePolygon.value.points,
  };

  if (!viewPolygonController.value) {
    viewPolygonController.value = bicMap.createPolygons(m, polygon, {
      ...defaultPolyLineStyle,
    });
  }
  viewPolygonController.value.addPolygon(polygon);
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

function onStartEdit() {
  if (!viewLineController.value) return;
  
  isEditing.value = true;
  viewLineController.value.enterEditMode(centerLine.value.id, {
    onEditStart: () => {
      // 编辑开始时移除多边形
      if (viewPolygonController.value && linePolygon.value?.id) {
        viewPolygonController.value.removePolygon(linePolygon.value.id);
      }
    },
    onEditEnd: (data) => {
      // 如果编辑完成，更新数据并触发回调
      if (data && data.points) {
        updateLine.value = data.points;
        viewLineController.value.updateWideLine(centerLine.value.id, 
            {
            path: data.points,
            ...defaultLineStyle,
            }
        );
      }
    },
  });
}

function onFinishEdit() {
  if (!viewLineController.value) return;
  viewLineController.value.exitEditMode();
  
  // 根据编辑后的中心线重新绘制可通行区域多边形
  drawTrackLinePolygon(updateLine.value);
  
  isEditing.value = false;
}

function onReset() {
  if (!viewLineController.value) return;
  
  viewLineController.value.exitEditMode();
  isEditing.value = false;

  // 清空地图上所有绘制的多边形
  viewLineController.value.removeWideLine(centerLine.value.id);
  viewPolygonController.value.removePolygon('line-polygon-' + centerLine.value.id);
  // 等待地图更新完成
  setTimeout(() => {
    linePolygon.value = null;
    initCenterLine();
  }, 0);
}

onMounted(() => {
  initMap();
});

onBeforeUnmount(() => {
  if (viewLineController.value?.remove) {
    viewLineController.value.remove();
    viewLineController.value = null;
  }
  if (viewPolygonController.value?.remove) {
    viewPolygonController.value.remove();
    viewPolygonController.value = null;
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
    await bicMap.loadSlamMap(map.value, {
      startX: MAP_START_X,
      startY: MAP_START_Y,
      xGridCount: MAP_X_GRID_COUNT,
      yGridCount: MAP_Y_GRID_COUNT,
      resolution: MAP_RESOLUTION,
      imagePath: MAP_IMAGE_PATH,
      canvasId: "canvasMap",
      fitBounds: true,
    });
    initCenterLine();
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
  max-height: min(46vh, 420px);
  overflow-y: auto;
}

.hint-wait {
  color: #64748b;
  font-size: 11px;
  margin: 0 0 8px;
}

.hint-steps {
  margin: 10px 0 0;
  padding-left: 10px;
  font-size: 12px;
}
.hint-steps li {
  margin: 4px 0;
  text-align: left;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 10px;
  margin: 0;
  font-size: 11px;
}
.stat-grid dt {
  color: #64748b;
  margin: 0;
}
.stat-grid dd {
  margin: 0;
  font-weight: 600;
  color: #0c4a6e;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
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

.width-input-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(14, 165, 233, 0.2);
  border-radius: 12px;
}

.input-label {
  font-size: 13px;
  color: #0369a1;
  font-weight: 500;
}

.width-input {
  width: 60px;
  padding: 6px 8px;
  border: 1px solid rgba(14, 165, 233, 0.3);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #0c4a6e;
  background: rgba(255, 255, 255, 0.9);
  text-align: center;
  outline: none;
  transition: all 0.2s ease;
}

.width-input:focus {
  border-color: #0ea5e9;
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.2);
}

.width-input::-webkit-outer-spin-button,
.width-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.width-input[type=number] {
  -moz-appearance: textfield;
}

.tabular {
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, "SF Mono", monospace;
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
    max-height: min(36vh, 300px);
    overflow-y: auto;
  }
}
</style>