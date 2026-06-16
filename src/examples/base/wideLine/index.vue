<!--
 * @Description: SLAM 地图 + 宽轨道线示例（融合 widthLineDraw 壳与 WidelineExample 功能）
 * @FilePath: /bic-map/src/examples/base/wideLine/index.vue
-->
<template>
  <div class="app-root">
    <canvas id="canvasMap" style="display: none"></canvas>

    <AppHeader title="轨道线示例" />

    <main class="map-area">
      <div class="grid-bg"></div>

      <div class="map-container">
        <div id="slamMap" class="map-gl"></div>

        <aside class="overlay-panel overlay-hint" aria-label="操作说明">
          <div class="panel-title">操作说明</div>
          <p v-if="!slamMapReady" class="hint-wait">正在加载地图底图…</p>
          <ol v-else class="hint-steps">
            <li>地图加载后自动生成一条闭合宽轨道</li>
            <li>点击可高亮对应轨道；点「编辑」拖拽顶点控制点调整</li>
          </ol>

          <div v-if="isEditMode && editData" class="edit-info">
            <div class="panel-title">编辑中</div>
            <div class="kv"><span>轨道 ID</span><span>{{ editData.widelineId }}</span></div>
            <div
              v-if="editData.isDragging && editData.dragPointIndex >= 0"
              class="kv"
            >
              <span>当前顶点</span><span>第 {{ editData.dragPointIndex + 1 }} 个</span>
            </div>
            <div class="coordinates-block">
              <div class="coords-title">顶点坐标</div>
              <div class="coordinates-list">
                <div
                  v-for="(point, index) in editData.points"
                  :key="index"
                  :class="{ dragging: editData.isDragging && editData.dragPointIndex === index }"
                >
                  <span class="point-index">{{ index + 1 }}.</span>
                  <span class="coordinates tabular">[{{ point[0].toFixed(6) }}, {{ point[1].toFixed(6) }}]</span>
                </div>
              </div>
            </div>
            <p class="edit-tip">拖拽顶点圆点调整形状，完成后在底部点「退出编辑」。</p>
          </div>
        </aside>
      </div>
    </main>

    <AppFooter>
      <template #left>
        <div class="toolbar-actions" role="toolbar" aria-label="宽轨道工具">
          <button
            type="button"
            class="btn"
            :disabled="!slamMapReady || currentWideLines.length === 0"
            @click="startEditSelected"
          >
            开始编辑
          </button>
          <button
            type="button"
            class="btn"
            :disabled="!slamMapReady"
            @click="resetWideLines"
          >
            重置轨道
          </button>
          <button
            v-if="isEditMode"
            type="button"
            class="btn btn-danger-outline"
            :disabled="!slamMapReady"
            @click="exitEditMode"
          >
            退出编辑
          </button>
        </div>
      </template>
    </AppFooter>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
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

/**
 * 默认宽轨道中心线顶点（可按需增删改）；相邻重复点会忽略；首尾不自动闭合。
 * 坐标系为地图经纬度。
 */
const DEFAULT_WIDE_LINE_PATH_POINTS = [
  [116.40736349280502, 39.904211901894286],
  [116.40738939197729, 39.904211426020794],
  [116.40739280384508, 39.90421344848315],
  [116.40742164963001, 39.90421332951482],
  [116.40743002421283, 39.90421344848315],
  [116.40743312591206, 39.90421547094593],
  [116.40743297082554, 39.90422379873269],
  [116.40743312591206, 39.904234624853586],
  [116.40743312591206, 39.90423498175858],
];

/** 与浅蓝 SLAM 栅格底图协调的宽轨道样式（createWideLines）；描边与填充同色系略深，层次清晰不发灰 */
const DEFAULT_WIDE_LINE_STYLE = {
  color: "#7dd3fc",
  width: 0.35,
  opacity: 0.88,
  outlineColor: "#0284c7",
  outlineWidth: 2,
  name: "区域边界轨道",
};

/** 初始化默认宽轨道 feature id，与 widelinesController.enterEditMode(widelineId) 一致 */
const DEFAULT_WIDE_LINE_ID = "default-region-wide-line";

/** 去相邻重复点；不追加首点，轨道首尾不闭合 */
function buildWideLinePath(points) {
  if (!points.length) return [];
  const deduped = [];
  for (const p of points) {
    const last = deduped[deduped.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) continue;
    deduped.push([p[0], p[1]]);
  }
  return deduped;
}

const map = ref(null);
const slamMapReady = ref(false);

const widelinesController = ref(null);

const currentWideLines = ref([]);
const selectedWideline = ref(null);
const isEditMode = ref(false);
const editData = ref(null);

function initDefaultWideLineFromPath() {
  const ctrl = widelinesController.value;
  if (!ctrl || !map.value) return;

  const path = buildWideLinePath(DEFAULT_WIDE_LINE_PATH_POINTS);
  if (path.length < 2) return;

  const line = {
    id: DEFAULT_WIDE_LINE_ID,
    path,
    ...DEFAULT_WIDE_LINE_STYLE,
  };

  const addedId = ctrl.addWideLine(line);
  if (addedId) {
    currentWideLines.value = [line];
    selectedWideline.value = line;
  }
}

function initWideLinesLayer() {
  if (!map.value) return;

  widelinesController.value = bicMap.createWideLines(map.value, []);

  initDefaultWideLineFromPath();
}

/** 恢复为初始默认轨道（清空当前编辑与图上全部宽线后重新添加默认线） */
function resetWideLines() {
  const ctrl = widelinesController.value;
  if (!ctrl || !map.value) return;
  if (isEditMode.value) {
    exitEditMode();
  }
  ctrl.clear();
  currentWideLines.value = [];
  selectedWideline.value = null;
  initDefaultWideLineFromPath();
}

/**
 * 开始编辑：优先进入初始化默认轨道的编辑模式（enterEditMode + callbacks）；
 * 若已在编辑同一条则不再重复进入；若正在编辑其他线则先 exitEditMode。
 */
function startEditSelected() {
  const ctrl = widelinesController.value;
  if (!ctrl) return;

  const defaultLine = currentWideLines.value.find((l) => l.id === DEFAULT_WIDE_LINE_ID);
  const line = defaultLine || selectedWideline.value || currentWideLines.value[0];
  if (!line) return;

  if (ctrl.isEditMode()) {
    const editingId = ctrl.getSelectedWidelineId();
    if (editingId === line.id) {
      return;
    }
    exitEditMode();
  }

  editWideline(line);
}

function editWideline(line) {
  const ctrl = widelinesController.value;
  if (!ctrl) return;

  selectedWideline.value = line;

  const widelineId = line.id;

  const callbacks = {
    onEditStart: () => {
      editData.value = ctrl.getEditData();
      isEditMode.value = ctrl.isEditMode();
    },
    onEditUpdate: () => {
      editData.value = ctrl.getEditData();
      const data = editData.value;
      if (data?.points) {
        const index = currentWideLines.value.findIndex((l) => l.id === widelineId);
        if (index !== -1) {
          currentWideLines.value[index].path = [...data.points];
        }
      }
    },
    /** 库在每次拖拽结束（mouseup）时触发，非 exitEditMode；保持编辑态并同步 getEditData */
    onEditEnd: (data) => {
      if (data && data.points) {
        const updatedLine = {
          ...line,
          path: data.points,
        };
        const index = currentWideLines.value.findIndex((l) => l.id === widelineId);
        if (index !== -1) {
          currentWideLines.value[index] = updatedLine;
          ctrl.updateWideLine(widelineId, updatedLine);
        }
        selectedWideline.value = updatedLine;
      }
      if (ctrl.isEditMode()) {
        editData.value = ctrl.getEditData();
        isEditMode.value = true;
      }
    },
  };

  const ok = ctrl.enterEditMode(widelineId, callbacks);
  if (!ok) {
    console.warn("enterEditMode 失败，请确认宽线 id 存在:", widelineId);
    return;
  }
  // 进入编辑模式后，提升顶点可见性（颜色/大小）
  if (typeof ctrl.setEditPointStyle === "function") {
    const pointColor = line.outlineColor || line.color || "#0284c7";
    ctrl.setEditPointStyle({
      color: pointColor,
      radius: 6,
      strokeColor: "#ffffff",
      strokeWidth: 2,
    });
  }
  editData.value = ctrl.getEditData();
  isEditMode.value = ctrl.isEditMode();
}

function exitEditMode() {
  const ctrl = widelinesController.value;
  if (ctrl?.isEditMode()) {
    ctrl.exitEditMode();
  }
  isEditMode.value = false;
  editData.value = null;
}

onMounted(() => {
  initMap();
});

onBeforeUnmount(() => {
  if (widelinesController.value && typeof widelinesController.value.remove === "function") {
    widelinesController.value.remove();
    widelinesController.value = null;
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
    initWideLinesLayer();
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
  margin: 0;
  padding-left: 10px;
  font-size: 12px;
}
.hint-steps li {
  margin: 4px 0;
  text-align: left;
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
  background: rgba(14, 165, 233, 0.08);
  border-color: rgba(14, 165, 233, 0.35);
  box-shadow: 0 4px 15px rgba(14, 165, 233, 0.1);
}
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-danger-outline {
  color: #b91c1c;
  border-color: rgba(239, 68, 68, 0.35);
  background: rgba(255, 255, 255, 0.7);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.06);
}
.btn-danger-outline:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.45);
  box-shadow: 0 4px 15px rgba(239, 68, 68, 0.10);
}

.edit-info {
  margin-top: 10px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid rgba(34, 197, 94, 0.35);
  background: rgba(240, 253, 244, 0.5);
}

.kv {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  margin-bottom: 4px;
}

.kv span:first-child {
  color: #64748b;
}

.coordinates-block {
  margin-top: 8px;
}

.coords-title {
  font-size: 10px;
  font-weight: 600;
  color: #0369a1;
  margin-bottom: 4px;
}

.coordinates-list {
  max-height: 120px;
  overflow-y: auto;
  font-size: 10px;
  padding: 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(14, 165, 233, 0.15);
}

.coordinates-list > div {
  display: flex;
  gap: 6px;
  padding: 2px 0;
}

.coordinates-list > div.dragging {
  background: rgba(250, 204, 21, 0.25);
  border-radius: 4px;
}

.point-index {
  color: #64748b;
  min-width: 22px;
}

.edit-tip {
  font-size: 10px;
  color: #64748b;
  margin: 8px 0 0;
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
