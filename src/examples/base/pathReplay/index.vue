<!--
 * @Description: SLAM 地图 + 路径回放（方向标记沿路径移动，参考腾讯 markerMoveAlong）
 * @FilePath: /bic-map-plugin/src/examples/base/pathReplay/index.vue
-->
<template>
  <div class="app-root">
    <canvas id="canvasMap" style="display: none"></canvas>

    <AppHeader title="路径回放" />

    <main class="map-area">
      <div class="grid-bg"></div>

      <div class="map-container">
        <div id="slamMap" class="map-gl"></div>

        <aside class="overlay-panel overlay-hint" aria-label="回放信息">
          <div class="panel-title">回放信息</div>
          <p v-if="!slamMapReady" class="hint-wait">正在加载地图底图…</p>
          <template v-else>
            <dl class="stat-grid">
              <div><dt>状态</dt><dd>{{ statusLabel }}</dd></div>
              <div><dt>进度</dt><dd class="tabular">{{ progressPercent }}%</dd></div>
              <div><dt>路径总长</dt><dd class="tabular">{{ totalPathMeters.toFixed(1) }} m</dd></div>
              <div><dt>朝向</dt><dd class="tabular">{{ bearingDisplay }}°</dd></div>
            </dl>
            <div class="coords-line tabular">
              当前：{{ currentLng.toFixed(6) }}, {{ currentLat.toFixed(6) }}
            </div>
            <ol class="hint-steps">
              <li>蓝色为完整规划路径；灰色为已走过的轨迹</li>
              <li>点「开始」沿路径平滑移动；可暂停、继续、重置</li>
              <li>开启「循环」到达终点后自动从头播放</li>
            </ol>
          </template>
        </aside>
      </div>
    </main>

    <AppFooter>
      <template #left>
        <div class="toolbar-actions" role="toolbar" aria-label="路径回放控制">
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!slamMapReady || playState === 'playing'"
            @click="onStart"
          >
            开始播放
          </button>
          <button
            type="button"
            class="btn"
            :disabled="!slamMapReady || playState !== 'playing'"
            @click="onPause"
          >
            暂停
          </button>
          <button
            type="button"
            class="btn"
            :disabled="!slamMapReady || playState !== 'paused'"
            @click="onResume"
          >
            继续
          </button>
          <button
            type="button"
            class="btn"
            :disabled="!slamMapReady"
            @click="onReset"
          >
            重置
          </button>
          <label class="opt opt-check">
            <span>循环</span>
            <input v-model="loop" type="checkbox" :disabled="!slamMapReady">
          </label>
          <label class="opt">
            <span>时长(s)</span>
            <input
              v-model.number="durationSeconds"
              type="number"
              min="1"
              max="120"
              step="0.5"
              :disabled="!slamMapReady || playState === 'playing'"
            >
          </label>
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

/** 用户给定路径点 [lng, lat] */
const RAW_PATH_POINTS = [
  [116.40736091700944, 39.9042128136341],
  [116.40736605074909, 39.9042077321063],
  [116.40737052207186, 39.904209764717194],
  [116.40737085327919, 39.904212432519245],
  [116.4073797959224, 39.90421255955769],
  [116.40739519714128, 39.904212686595685],
  [116.40741192319643, 39.904212686595685],
  [116.40742980848279, 39.9042128136341],
  [116.40742931166835, 39.90422284965018],
  [116.40743825431156, 39.90422335780289],
  [116.40744156640068, 39.90422488226105],
  [116.40744156640068, 39.90422488226105],
];

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

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function pathLengthMeters(path) {
  let sum = 0;
  for (let i = 0; i < path.length - 1; i++) {
    sum += haversineMeters(path[i], path[i + 1]);
  }
  return sum;
}

function buildPixelSegmentMetrics(mapInstance, path) {
  const segmentLengths = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = mapInstance.project(path[i]);
    const b = mapInstance.project(path[i + 1]);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segmentLengths.push(len);
    total += len;
  }
  return { segmentLengths, totalPixelLength: total };
}

function interpolateAlongPath(path, segmentLengths, totalLen, distAlong) {
  if (!path.length) return { lngLat: [0, 0], segIndex: 0 };
  if (path.length < 2 || totalLen <= 0) {
    return { lngLat: [...path[0]], segIndex: 0 };
  }
  let d = Math.min(Math.max(0, distAlong), totalLen);
  let i = 0;
  while (i < segmentLengths.length && d > segmentLengths[i]) {
    d -= segmentLengths[i];
    i++;
  }
  if (i >= path.length - 1) {
    return { lngLat: [...path[path.length - 1]], segIndex: path.length - 2, t: 1 };
  }
  const segLen = segmentLengths[i];
  const t = segLen > 0 ? d / segLen : 0;
  const p0 = path[i];
  const p1 = path[i + 1];
  return {
    lngLat: [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t],
    segIndex: i,
    t,
  };
}

/**
 * 地理方位角：正北为 0°，顺时针 0–360°（与屏幕 atan2 无关，与 pos.svg 默认朝上一致）
 */
function geographicBearingDegrees(from, to) {
  const φ1 = (from[1] * Math.PI) / 180;
  const φ2 = (to[1] * Math.PI) / 180;
  const Δλ = ((to[0] - from[0]) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

/**
 * pos.svg 尖端默认朝北；addDirectionalMarker 内部对图片使用 rotate(-rotation)。
 * 使尖端朝向 bearing（北起顺时针）时：rotation = (360 - bearing) % 360 icon图片默认朝右 + 90°偏转
 */
function markerRotationForBearing(bearingDeg) {
  return (360 - bearingDeg + 360 + 90) % 360;
}

function segmentGeographicBearing(path, segIndex) {
  if (segIndex < 0 || segIndex >= path.length - 1) return null;
  const a = path[segIndex];
  const b = path[segIndex + 1];
  const m = haversineMeters(a, b);
  if (m < 0.02) return null;
  return geographicBearingDegrees(a, b);
}

/** 已走过的折线顶点：经过的折点 + 当前插值位置 */
function buildTraversedPath(path, segIndex, lngLat) {
  const out = [];
  for (let j = 0; j <= segIndex; j++) {
    out.push([path[j][0], path[j][1]]);
  }
  const last = out[out.length - 1];
  if (!last || last[0] !== lngLat[0] || last[1] !== lngLat[1]) {
    out.push([lngLat[0], lngLat[1]]);
  }
  if (out.length < 2 && path.length >= 2) {
    const p0 = path[0];
    const p1 = path[1];
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy);
    const k = len > 1e-15 ? 1e-7 / len : 1e-7;
    out.push([p0[0] + dx * k, p0[1] + dy * k]);
  }
  return out;
}

const ROUTE_POLYLINE_ID = "path-replay-route";
const TRAVERSED_POLYLINE_ID = "path-replay-traversed";

function buildReplayPolylinesPayload(path, traversedPath) {
  const gradientSegments = [];
  if (path.length >= 2) {
    const totalSegments = path.length - 1;
    for (let i = 0; i < totalSegments; i++) {
      const ratio = i / (totalSegments - 1);
      const color = interpolateColor("#00F5FF", "#00EE00", ratio);
      gradientSegments.push({
        id: `${ROUTE_POLYLINE_ID}-seg-${i}`,
        path: [path[i], path[i + 1]],
        color,
        width: 5,
        opacity: 0.85,
        showArrow: true,
        arrowSize: 0.5,
        arrowSpacing: 35,
      });
    }
  }
  
  return [
    ...gradientSegments,
    {
      id: TRAVERSED_POLYLINE_ID,
      path: traversedPath,
      color: "#94a3b8",
      width: 6,
      opacity: 1,
      showArrow: false,
    },
  ];
}

function interpolateColor(color1, color2, ratio) {
  const hex2rgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  };
  
  const rgb2hex = (r, g, b) => {
    return '#' + [r, g, b].map(x => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  };
  
  const rgb1 = hex2rgb(color1);
  const rgb2 = hex2rgb(color2);
  
  const r = rgb1[0] + (rgb2[0] - rgb1[0]) * ratio;
  const g = rgb1[1] + (rgb2[1] - rgb1[1]) * ratio;
  const b = rgb1[2] + (rgb2[2] - rgb1[2]) * ratio;
  
  return rgb2hex(r, g, b);
}

const map = ref(null);
const slamMapReady = ref(false);
const polylinesController = ref(null);
const markerController = ref(null);

const pathPoints = ref(buildWideLinePath(RAW_PATH_POINTS));

const playState = ref("idle");
const loop = ref(false);
const durationSeconds = ref(10);

const progress = ref(0);
const currentLng = ref(pathPoints.value[0]?.[0] ?? 0);
const currentLat = ref(pathPoints.value[0]?.[1] ?? 0);
const currentBearing = ref(0);

let segmentLengths = [];
let totalPixelLength = 0;
let rafId = null;
let playStartPerf = 0;
let pausedElapsedMs = 0;
let lastBearingDeg = 0;

const durationMs = computed(() => Math.max(500, durationSeconds.value * 1000));

const progressPercent = computed(() => Math.round(progress.value * 1000) / 10);

const totalPathMeters = computed(() => pathLengthMeters(pathPoints.value));

const statusLabel = computed(() => {
  switch (playState.value) {
    case "idle":
      return "待播放";
    case "playing":
      return "播放中";
    case "paused":
      return "已暂停";
    case "finished":
      return "已结束";
    default:
      return playState.value;
  }
});

const bearingDisplay = computed(() => Math.round(currentBearing.value));

function refreshPathMetrics() {
  const m = map.value;
  const path = pathPoints.value;
  if (!m || path.length < 2) {
    segmentLengths = [];
    totalPixelLength = 0;
    return;
  }
  const metrics = buildPixelSegmentMetrics(m, path);
  segmentLengths = metrics.segmentLengths;
  totalPixelLength = metrics.totalPixelLength;
}

function applyFrame(distAlong) {
  const m = map.value;
  const path = pathPoints.value;
  const ctrl = markerController.value;
  if (!m || !ctrl || path.length < 2) return;

  const { lngLat, segIndex } = interpolateAlongPath(path, segmentLengths, totalPixelLength, distAlong);
  currentLng.value = lngLat[0];
  currentLat.value = lngLat[1];

  const b = segmentGeographicBearing(path, segIndex);
  if (b != null) {
    lastBearingDeg = b;
  }
  currentBearing.value = lastBearingDeg;
  ctrl.setPosition(lngLat);
  ctrl.setRotation(markerRotationForBearing(lastBearingDeg));

  const traversed = buildTraversedPath(path, segIndex, lngLat);
  const polyCtrl = polylinesController.value;
  if (polyCtrl?.update) {
    polyCtrl.update(buildReplayPolylinesPayload(path, traversed));
  }
}

function stopRaf() {
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function tick() {
  if (playState.value !== "playing" || !map.value) {
    return;
  }
  const elapsed = performance.now() - playStartPerf;
  let p = Math.min(1, elapsed / durationMs.value);
  progress.value = p;

  const distAlong = p * totalPixelLength;
  applyFrame(distAlong);

  if (p >= 1) {
    if (loop.value) {
      playStartPerf = performance.now();
      pausedElapsedMs = 0;
      progress.value = 0;
      rafId = requestAnimationFrame(tick);
    } else {
      playState.value = "finished";
      applyFrame(totalPixelLength);
      progress.value = 1;
      stopRaf();
    }
    return;
  }

  rafId = requestAnimationFrame(tick);
}

function onStart() {
  if (!slamMapReady.value || !markerController.value) return;
  refreshPathMetrics();
  stopRaf();
  /** 「开始」始终从路径起点重新播放（含 idle / finished / paused） */
  pausedElapsedMs = 0;
  progress.value = 0;
  lastBearingDeg = segmentGeographicBearing(pathPoints.value, 0) ?? 0;
  applyFrame(0);
  playState.value = "playing";
  playStartPerf = performance.now();
  rafId = requestAnimationFrame(tick);
}

function onPause() {
  if (playState.value !== "playing") return;
  pausedElapsedMs = performance.now() - playStartPerf;
  playState.value = "paused";
  stopRaf();
}

function onResume() {
  if (playState.value !== "paused") return;
  playState.value = "playing";
  playStartPerf = performance.now() - pausedElapsedMs;
  rafId = requestAnimationFrame(tick);
}

function onReset() {
  stopRaf();
  playState.value = "idle";
  pausedElapsedMs = 0;
  progress.value = 0;
  refreshPathMetrics();
  lastBearingDeg = segmentGeographicBearing(pathPoints.value, 0) ?? 0;
  applyFrame(0);
}

function initPathAndMarker() {
  const m = map.value;
  if (!m) return;

  refreshPathMetrics();

  const path = pathPoints.value;
  if (path.length >= 2) {
    const traversed0 = buildTraversedPath(path, 0, path[0]);
    polylinesController.value = bicMap.createPolylines(
      m,
      buildReplayPolylinesPayload(path, traversed0),
      { showArrow: true, arrowSpacing: 35, arrowSize: 0.5, arrowImagePath: "/bicMap/assets/svg/arrow.svg" }
    );
  }

  lastBearingDeg = segmentGeographicBearing(path, 0) ?? 0;
  markerController.value = bicMap.addDirectionalMarker(m, path[0] || [116.4074, 39.9042], {
    rotationControl: false,
    draggable: false,
    initialEditMode: false,
    initialRotation: markerRotationForBearing(lastBearingDeg),
  });

  markerController.value.setRotation(markerRotationForBearing(lastBearingDeg));
  currentLng.value = path[0][0];
  currentLat.value = path[0][1];
  currentBearing.value = lastBearingDeg;
}

onMounted(() => {
  initMap();
});

onBeforeUnmount(() => {
  stopRaf();
  if (markerController.value?.remove) {
    markerController.value.remove();
    markerController.value = null;
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
    initPathAndMarker();
    map.value.once("moveend", () => {
      refreshPathMetrics();
    });
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

.coords-line {
  margin-top: 8px;
  font-size: 11px;
  color: #0369a1;
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

.opt {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #0369a1;
}
.opt input[type="number"] {
  width: 64px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid rgba(14, 165, 233, 0.35);
  font-size: 12px;
}
.opt-check input {
  width: auto;
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
