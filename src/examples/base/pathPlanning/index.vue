<!--
 * @Description: SLAM 栅格地图 + A* 路径规划示例（点击起终点，避障折线）
 * @FilePath: /bic-map/src/examples/base/pathPlanning/index.vue
-->
<template>
  <div class="app-root">
    <canvas id="canvasMap" style="display: none"></canvas>

    <AppHeader title="路径规划" />

    <main class="map-area">
      <div class="grid-bg"></div>

      <div class="map-container">
        <div id="slamMap" class="map-gl"></div>

        <aside class="overlay-panel overlay-hint" aria-label="规划说明">
          <div class="panel-title">路径规划</div>
          <p v-if="!slamMapReady" class="hint-wait">正在加载地图底图…</p>
          <template v-else>
            <dl class="stat-grid">
              <div><dt>选点</dt><dd>{{ pickHint }}</dd></div>
              <div><dt>栅格</dt><dd class="tabular">{{ gridSummary }}</dd></div>
              <div><dt>路径长</dt><dd class="tabular">{{ pathLengthLabel }}</dd></div>
              <div><dt>状态</dt><dd>{{ planStatus }}</dd></div>
            </dl>
            <ol class="hint-steps">
              <li>点击底部「绘制点位」后，可在地图连续点击添加 2 个及以上点位</li>
              <li>第一个点为起点，最后一个点为终点，中间点为途径点</li>
              <li>点击「规划路径」后按点位顺序规划成一条路线</li>
              <li>点击「重置」清除点位与路线，回到初始状态</li>
            </ol>
            <div class="opt-grid" aria-label="规划参数">
              <label class="opt">
                <span class="opt-label">
                  贴墙惩罚
                  <span class="help" data-tip="越靠近墙/障碍代价越高；值越大越偏向走廊中间（0 为关闭）建议范围 2.0～3.0">
                    <Info class="help-icon" :size="14" />
                  </span>
                </span>
                <input
                  v-model.number="wallPenalty"
                  type="number"
                  min="0"
                  max="8"
                  step="0.2"
                >
              </label>
              <label class="opt">
                <span class="opt-label">
                  拐弯惩罚
                  <span class="help" data-tip="方向变化会增加代价；值越大越少拐弯、更像手绘直线段（0 为关闭）建议范围 3.0～5.0">
                    <Info class="help-icon" :size="14" />
                  </span>
                </span>
                <input
                  v-model.number="turnPenalty"
                  type="number"
                  min="0"
                  max="10"
                  step="0.2"
                >
              </label>
              <label class="opt">
                <span class="opt-label">
                  斜走惩罚
                  <span class="help" data-tip="对角线移动额外加代价；值越大越偏水平/垂直行走（0 为关闭）建议范围 0.8～1.5">
                    <Info class="help-icon" :size="14" />
                  </span>
                </span>
                <input
                  v-model.number="diagonalPenalty"
                  type="number"
                  min="0"
                  max="6"
                  step="0.2"
                >
              </label>
              <label class="opt">
                <span class="opt-label">
                  平滑净空
                  <span class="help" data-tip="平滑拉直时要求与障碍保持的最小距离（格子单位）；值越大越不贴墙角（0 为关闭）建议范围 1～3">
                    <Info class="help-icon" :size="14" />
                  </span>
                </span>
                <input
                  v-model.number="minSmoothClearance"
                  type="number"
                  min="0"
                  max="6"
                  step="1"
                >
              </label>
            </div>
          </template>
        </aside>
      </div>
    </main>

    <AppFooter>
      <template #left>
        <div class="toolbar-actions" role="toolbar" aria-label="路径规划工具">
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!slamMapReady"
            @click="beginPickStart"
          >
            绘制点位
          </button>
          <button
            type="button"
            class="btn"
            :disabled="!canPlan"
            @click="runPlan"
          >
            规划路径
          </button>
          <button
            type="button"
            class="btn"
            :disabled="!slamMapReady"
            @click="resetAll"
          >
            重置
          </button>
        </div>
      </template>
    </AppFooter>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { Info } from "lucide-vue-next";
import AppHeader from "../../components/AppHeader.vue";
import AppFooter from "../../components/AppFooter.vue";
import bicMap from "../../../bicMap/core/bicmap-gl.js";
import slamImage from "../../assets/slam_transparent.png";

const MAP_START_X = -58.999993705749512;
const MAP_START_Y = -21.349997329711914;
const MAP_X_GRID_COUNT = 2752;
const MAP_Y_GRID_COUNT = 1536;
const MAP_RESOLUTION = 0.05;
const MAP_ZOOM_FACTOR = 2;
const MAP_IMAGE_PATH = slamImage;

const ROUTE_POLYLINE_ID = "path-planning-route";

const map = ref(null);
const slamMapReady = ref(false);
const polylineController = ref(null);
const poiController = ref(null);

const gridStride = ref(10);
const lumaThreshold = ref(120);
const invertObstacle = ref(false);
// 贴墙惩罚：越靠近障碍代价越高，使路径更倾向走廊中间
const wallPenalty = ref(2.6); // 0 关闭；建议 1~4
// 拐弯惩罚：降低“贴墙锯齿”和频繁转向，更接近人为画直线段
const turnPenalty = ref(4.0); // 0 关闭；建议 0.5~5
// 斜走惩罚：弱化对角线的偏好（更像人沿走廊方向行走）
const diagonalPenalty = ref(1.2); // 0 关闭；建议 0~2
// 平滑时的最小净空（格子距离），避免拉直后贴墙角
const minSmoothClearance = ref(2); // 0 关闭；建议 1~3

/** @type {boolean[][] | null} walkable[cj][ci] */
let walkableGrid = null;
let logicalCols = 0;
let logicalRows = 0;
/** @type {Uint16Array | null} clearance (cell distance to nearest obstacle) */
let clearanceGrid = null;

const startCell = ref(null);
const endCell = ref(null);
const viaCells = ref([]); // 中间途径点（不含起终点）
const pickedCells = ref([]); // 全部点位（按点击顺序）
const pathLngLats = ref([]);
const planStatus = ref("—");
const pickMode = ref("none"); // 'none' | 'start'

const pickHint = computed(() => {
  if (!slamMapReady.value) return "—";
  if (pickMode.value === "start") {
    if (pickedCells.value.length === 0) return "正在选点：请在地图点击起点";
    if (pickedCells.value.length === 1) return "继续点击添加终点或途径点";
    return `已添加 ${pickedCells.value.length} 个点（可继续添加）`;
  }
  if (pickedCells.value.length < 2) return "请点击「绘制点位」添加至少 2 个点";
  return `已选 ${pickedCells.value.length} 个点，点击「规划路径」开始规划`;
});

const gridSummary = computed(() => {
  if (!walkableGrid) return "—";
  return `${logicalCols}×${logicalRows}（步长 ${gridStride.value}）`;
});

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

const pathLengthLabel = computed(() => {
  const p = pathLngLats.value;
  if (p.length < 2) return "—";
  return `${pathLengthMeters(p).toFixed(1)} m`;
});

const canPlan = computed(
  () =>
    slamMapReady.value &&
    pickedCells.value.length >= 2 &&
    walkableGrid
);

function setMapCursor(cursor) {
  const m = map.value;
  if (!m?.getCanvas) return;
  m.getCanvas().style.cursor = cursor || "";
}

watch(
  () => pickMode.value,
  (mode) => {
    setMapCursor(mode === "start" ? "crosshair" : "");
  }
);

function getMapUtils() {
  return window.MapUtils;
}

function lngLatToPixel(lng, lat) {
  const Mu = getMapUtils();
  if (!Mu?.GPSToCartesian) return null;
  const c = Mu.GPSToCartesian({
    longitude: lng,
    latitude: lat,
    scale: MAP_RESOLUTION,
    zoomFactor: MAP_ZOOM_FACTOR,
  });
  const px = Math.floor((c.x - MAP_START_X) / MAP_RESOLUTION);
  const py = Math.floor(
    (MAP_START_Y + MAP_Y_GRID_COUNT * MAP_RESOLUTION - c.y) / MAP_RESOLUTION
  );
  const cx = Math.min(MAP_X_GRID_COUNT - 1, Math.max(0, px));
  const cy = Math.min(MAP_Y_GRID_COUNT - 1, Math.max(0, py));
  return { px: cx, py: cy };
}

function logicalCenterToLngLat(ci, cj) {
  const Mu = getMapUtils();
  if (!Mu?.cartesianToGPS) return [0, 0];
  const pxCenter = ci * gridStride.value + Math.floor(gridStride.value / 2);
  const pyCenter = cj * gridStride.value + Math.floor(gridStride.value / 2);
  const px = Math.min(MAP_X_GRID_COUNT - 1, Math.max(0, pxCenter));
  const py = Math.min(MAP_Y_GRID_COUNT - 1, Math.max(0, pyCenter));
  const cx = MAP_START_X + (px + 0.5) * MAP_RESOLUTION;
  const cy = MAP_START_Y + (MAP_Y_GRID_COUNT - py - 0.5) * MAP_RESOLUTION;
  const gps = Mu.cartesianToGPS({
    x: cx,
    y: cy,
    scale: MAP_RESOLUTION,
    zoomFactor: MAP_ZOOM_FACTOR,
  });
  return [gps.longitude, gps.latitude];
}

function pixelToLogical(px, py) {
  const s = gridStride.value;
  return {
    ci: Math.min(logicalCols - 1, Math.max(0, Math.floor(px / s))),
    cj: Math.min(logicalRows - 1, Math.max(0, Math.floor(py / s))),
  };
}

function rebuildOccupancy() {
  const canvas = document.getElementById("canvasMap");
  if (!canvas) return;
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { data } = ctx.getImageData(0, 0, w, h);

  const s = gridStride.value;
  logicalCols = Math.ceil(MAP_X_GRID_COUNT / s);
  logicalRows = Math.ceil(MAP_Y_GRID_COUNT / s);

  walkableGrid = [];
  for (let cj = 0; cj < logicalRows; cj++) {
    const row = [];
    for (let ci = 0; ci < logicalCols; ci++) {
      const px = Math.min(w - 1, ci * s + Math.floor(s / 2));
      const py = Math.min(h - 1, cj * s + Math.floor(s / 2));
      const base = (py * w + px) * 4;
      const r = data[base];
      const g = data[base + 1];
      const b = data[base + 2];
      const a = data[base + 3];

      // 该底图多数区域为不透明，alpha 无法区分可走/障碍；改用亮度判定：
      // - 墙线/外部黑底亮度更低 → 视为障碍
      // - 室内浅色区域亮度更高 → 视为可走
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      // 极低透明度直接当障碍（避免透明背景被误判为可走）
      const obstacleByLuma = a < 10 ? true : luma < lumaThreshold.value;
      const obstacle = invertObstacle.value ? !obstacleByLuma : obstacleByLuma;
      row.push(!obstacle);
    }
    walkableGrid.push(row);
  }

  // 计算每个可走格子到最近障碍的距离（格子单位），用于“贴墙惩罚”
  clearanceGrid = computeClearanceGrid(walkableGrid, logicalCols, logicalRows);

  startCell.value = null;
  endCell.value = null;
  pickMode.value = "none";
  pathLngLats.value = [];
  planStatus.value = "栅格已更新，请重新选点";
  syncPoiMarkers();
  if (polylineController.value) {
    polylineController.value.clear();
  }
}

function computeClearanceGrid(grid, cols, rows) {
  const dist = new Uint16Array(rows * cols);
  dist.fill(65535);
  const q = new Int32Array(rows * cols);
  let qh = 0;
  let qt = 0;

  const idx = (c, r) => r * cols + c;

  // 多源 BFS：所有障碍作为源，距离=0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) {
        const i = idx(c, r);
        dist[i] = 0;
        q[qt++] = i;
      }
    }
  }

  // 极端情况：无障碍
  if (qt === 0) {
    dist.fill(999);
    return dist;
  }

  const DIR4 = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (qh < qt) {
    const cur = q[qh++];
    const r = Math.floor(cur / cols);
    const c = cur % cols;
    const base = dist[cur];
    const nd = base + 1;
    for (const [dc, dr] of DIR4) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ni = idx(nc, nr);
      if (nd < dist[ni]) {
        dist[ni] = nd;
        q[qt++] = ni;
      }
    }
  }

  return dist;
}

function nearestWalkable(ci, cj) {
  if (!walkableGrid) return null;
  if (walkableGrid[cj]?.[ci]) return { ci, cj };

  const key = (x, y) => `${x},${y}`;
  const q = [[ci, cj]];
  let qh = 0;
  const seen = new Set([key(ci, cj)]);
  let steps = 0;
  const maxSteps = 12000;

  while (qh < q.length && steps < maxSteps) {
    const [x, y] = q[qh++];
    steps++;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= logicalCols || ny >= logicalRows) continue;
        const k = key(nx, ny);
        if (seen.has(k)) continue;
        seen.add(k);
        if (walkableGrid[ny][nx]) return { ci: nx, cj: ny };
        q.push([nx, ny]);
      }
    }
  }
  return null;
}

const NEI8 = [];
for (let dy = -1; dy <= 1; dy++) {
  for (let dx = -1; dx <= 1; dx++) {
    if (dx !== 0 || dy !== 0) NEI8.push([dx, dy]);
  }
}

function astar(start, goal) {
  if (!walkableGrid) return null;
  const { ci: sc, cj: sr } = start;
  const { ci: gc, cj: gr } = goal;
  if (!walkableGrid[sr]?.[sc] || !walkableGrid[gr]?.[gc]) return null;

  const rows = logicalRows;
  const cols = logicalCols;
  const inf = 1e30;
  const gScore = new Float64Array(rows * cols).fill(inf);
  const fScore = new Float64Array(rows * cols).fill(inf);
  const came = new Int32Array(rows * cols).fill(-1);
  const cameDir = new Int8Array(rows * cols).fill(-1); // 0..7 for NEI8, -1 start

  const idx = (c, r) => r * cols + c;
  const h = (c, r) => Math.hypot(gc - c, gr - r);

  const baseStep = gridStride.value * MAP_RESOLUTION * MAP_ZOOM_FACTOR;
  const stepCost = (dx, dy) => {
    const diag = dx !== 0 && dy !== 0;
    return Math.hypot(dx, dy) * baseStep + (diag ? diagonalPenalty.value : 0);
  };

  const clearanceAt = (c, r) => {
    if (!clearanceGrid) return 999;
    return clearanceGrid[idx(c, r)];
  };

  // 贴墙惩罚：与障碍距离越小惩罚越大（走廊更宽时会自然靠中间）
  const wallPenaltyCost = (c, r) => {
    const w = wallPenalty.value;
    if (!w) return 0;
    const d = clearanceAt(c, r);
    return w * (1 / (d + 0.35));
  };

  const open = [];
  const si = idx(sc, sr);
  gScore[si] = 0;
  fScore[si] = h(sc, sr);
  open.push(si);

  const inOpen = new Set([si]);

  while (open.length) {
    let bestI = 0;
    let bestF = fScore[open[0]];
    for (let i = 1; i < open.length; i++) {
      const fi = fScore[open[i]];
      if (fi < bestF) {
        bestF = fi;
        bestI = i;
      }
    }
    const cur = open[bestI];
    open.splice(bestI, 1);
    inOpen.delete(cur);

    const cr = Math.floor(cur / cols);
    const cc = cur % cols;

    if (cc === gc && cr === gr) {
      const path = [];
      let p = cur;
      while (p !== -1) {
        const r = Math.floor(p / cols);
        const c = p % cols;
        path.push({ ci: c, cj: r });
        p = came[p];
      }
      path.reverse();
      return path;
    }

    for (let dir = 0; dir < NEI8.length; dir++) {
      const [dx, dy] = NEI8[dir];
      const nc = cc + dx;
      const nr = cr + dy;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      if (!walkableGrid[nr][nc]) continue;
      // 对角线移动时，检查两个轴向相邻格必须均可走，防止切角穿墙
      if (dx !== 0 && dy !== 0) {
        if (!walkableGrid[cr][nc] || !walkableGrid[nr][cc]) continue;
      }
      const ni = idx(nc, nr);
      const prevDir = cameDir[cur];
      const turnCost = prevDir === -1 || prevDir === dir ? 0 : turnPenalty.value;
      const tentative =
        gScore[cur] + stepCost(dx, dy) + wallPenaltyCost(nc, nr) + turnCost;
      if (tentative < gScore[ni]) {
        came[ni] = cur;
        cameDir[ni] = dir;
        gScore[ni] = tentative;
        fScore[ni] = tentative + h(nc, nr);
        if (!inOpen.has(ni)) {
          open.push(ni);
          inOpen.add(ni);
        }
      }
    }
  }
  return null;
}

function hasLineOfSight(a, b) {
  if (!walkableGrid) return false;
  const cols = logicalCols;
  let x0 = a.ci;
  let y0 = a.cj;
  const x1 = b.ci;
  const y1 = b.cj;

  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (!walkableGrid[y0]?.[x0]) return false;
    if (minSmoothClearance.value > 0 && clearanceGrid) {
      const d = clearanceGrid[y0 * cols + x0];
      if (d < minSmoothClearance.value) return false;
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return true;
}

function smoothPathCells(path) {
  if (!path || path.length < 3) return path;
  const out = [];
  let i = 0;
  while (i < path.length) {
    out.push(path[i]);
    if (i === path.length - 1) break;
    let j = path.length - 1;
    for (; j > i + 1; j--) {
      if (hasLineOfSight(path[i], path[j])) break;
    }
    i = j;
  }
  return out;
}

function buildPolylinePayload(path) {
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
        opacity: 0.92,
        showArrow: false,
      });
    }
  }
  return gradientSegments;
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

function ensurePolylineController(path) {
  const m = map.value;
  if (!m || path.length < 2) return;
  if (!polylineController.value) {
    polylineController.value = bicMap.createPolylines(
      m,
      buildPolylinePayload(path),
      { showArrow: false }
    );
  } else {
    polylineController.value.update(buildPolylinePayload(path));
  }
}

function runPlan() {
  if (!canPlan.value) return;
  if (pickedCells.value.length < 2) return;
  planStatus.value = "正在规划…";

  // 以点击顺序分段规划：起点 -> 途径点... -> 终点
  const nodes = pickedCells.value;
  const merged = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const raw = astar(a, b);
    const seg = raw ? smoothPathCells(raw) : null;
    if (!seg || seg.length < 2) {
      planStatus.value = `无可行路径（第 ${i + 1} 段失败）`;
      pathLngLats.value = [];
      if (polylineController.value) polylineController.value.clear();
      return;
    }
    // 拼接时避免重复点
    if (merged.length === 0) merged.push(...seg);
    else merged.push(...seg.slice(1));
  }

  const lngLats = merged.map((c) => logicalCenterToLngLat(c.ci, c.cj));
  pathLngLats.value = lngLats;
  ensurePolylineController(lngLats);
  planStatus.value = `已生成 ${merged.length} 个路径点`;
}

function syncPoiMarkers() {
  const pts = [];
  const cells = pickedCells.value;
  if (cells.length > 0) {
    const s = cells[0];
    const [lng, lat] = logicalCenterToLngLat(s.ci, s.cj);
    pts.push({ id: "pp-start", lngLat: [lng, lat], rotation: 0, name: "起点" });
  }
  if (cells.length > 2) {
    for (let i = 1; i < cells.length - 1; i++) {
      const v = cells[i];
      const [lng, lat] = logicalCenterToLngLat(v.ci, v.cj);
      pts.push({
        id: `pp-via-${i}`,
        lngLat: [lng, lat],
        rotation: 0,
        name: `途径${i}`,
      });
    }
  }
  if (cells.length > 1) {
    const e = cells[cells.length - 1];
    const [lng, lat] = logicalCenterToLngLat(e.ci, e.cj);
    pts.push({ id: "pp-end", lngLat: [lng, lat], rotation: 0, name: "终点" });
  }
  if (poiController.value) {
    poiController.value.updateMarkers(pts);
  }
}

function resetAll() {
  startCell.value = null;
  endCell.value = null;
  viaCells.value = [];
  pickedCells.value = [];
  pickMode.value = "none";
  pathLngLats.value = [];
  planStatus.value = "已重置";
  setMapCursor("");
  syncPoiMarkers();
  if (polylineController.value) {
    polylineController.value.clear();
  }
}

function beginPickStart() {
  pickMode.value = "start";
  planStatus.value = "已进入绘制点位状态";
  setMapCursor("crosshair");
}

let mapClickHandler = null;
let mapDblClickHandler = null;
let _clickTimer = null;
let _isDblClick = false;

function attachMapClick() {
  const m = map.value;
  if (!m || mapClickHandler) return;

  mapDblClickHandler = () => {
    _isDblClick = true;
    if (_clickTimer) {
      clearTimeout(_clickTimer);
      _clickTimer = null;
    }
    planStatus.value = "支持鼠标单击绘制";
  };

  mapClickHandler = (e) => {
    if (!slamMapReady.value || !walkableGrid) return;
    if (pickMode.value === "none") return;

    _isDblClick = false;
    if (_clickTimer) clearTimeout(_clickTimer);

    _clickTimer = setTimeout(() => {
      _clickTimer = null;
      if (_isDblClick) return;

      const { lng, lat } = e.lngLat;
      const pixel = lngLatToPixel(lng, lat);
      if (!pixel) {
        planStatus.value = "坐标转换失败";
        return;
      }
      const { ci, cj } = pixelToLogical(pixel.px, pixel.py);
      const snapped = nearestWalkable(ci, cj);
      if (!snapped) {
        planStatus.value = "附近无可走栅格";
        return;
      }

      // 连续添加点位：第一个为起点，最后一个为终点，中间为途径点
      pickedCells.value = [...pickedCells.value, snapped];
      if (pickedCells.value.length === 1) {
        startCell.value = snapped;
        endCell.value = null;
        viaCells.value = [];
        planStatus.value = "已添加起点，继续点击添加途径点/终点";
      } else {
        startCell.value = pickedCells.value[0];
        endCell.value = pickedCells.value[pickedCells.value.length - 1];
        viaCells.value = pickedCells.value.slice(1, -1);
        planStatus.value = `已添加 ${pickedCells.value.length} 个点，可继续添加或点击「规划路径」`;
      }
      // 点位变化后不自动规划，只清除旧路线
      pathLngLats.value = [];
      if (polylineController.value) polylineController.value.clear();
      syncPoiMarkers();
    }, 170);
  };

  m.on("dblclick", mapDblClickHandler);
  m.on("click", mapClickHandler);
}

function detachMapClick() {
  const m = map.value;
  if (m && mapClickHandler) {
    m.off("click", mapClickHandler);
    mapClickHandler = null;
  }
  if (m && mapDblClickHandler) {
    m.off("dblclick", mapDblClickHandler);
    mapDblClickHandler = null;
  }
  if (_clickTimer) {
    clearTimeout(_clickTimer);
    _clickTimer = null;
  }
  _isDblClick = false;
}

function initPoiLayer() {
  const m = map.value;
  if (!m) return;
  if (poiController.value) {
    poiController.value.remove();
    poiController.value = null;
  }
  poiController.value = bicMap.addBatchPOIMarkers(m, [], {
    imagePath: "/bicMap/assets/img/pos.png",
    size: 28,
    showLabels: true,
    selectable: false,
  });
}

async function loadSlamMapLayer() {
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
      zoomFactor: MAP_ZOOM_FACTOR,
    });
    // 先标记 ready，确保栅格构建/点击监听不会被短路
    slamMapReady.value = true;
    initPoiLayer();
    rebuildOccupancy();
    attachMapClick();
  } catch (error) {
    console.error("加载SLAM地图失败:", error);
    planStatus.value = "地图加载失败";
  }
}

onMounted(() => {
  initMap();
});

onBeforeUnmount(() => {
  detachMapClick();
  setMapCursor("");
  if (poiController.value?.remove) {
    poiController.value.remove();
    poiController.value = null;
  }
  if (polylineController.value?.remove) {
    polylineController.value.remove();
    polylineController.value = null;
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
      loadSlamMapLayer();
    });
  } catch (error) {
    console.error("初始化地图失败:", error);
    planStatus.value = "MapUtils 或地图脚本未就绪";
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
  max-width: min(365px, calc(100% - 20px));
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
  max-height: min(52vh, 480px);
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

.opt {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #0369a1;
  margin-top: 8px;
}

.opt-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
}

.opt-grid .opt {
  margin-top: 0;
}

.opt-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 72px;
}

.help {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: help;
  color: rgba(3, 105, 161, 0.75);
}

.help-icon {
  display: block;
}

.help:hover {
  color: rgba(3, 105, 161, 1);
}

.help::after {
  content: attr(data-tip);
  position: absolute;
  left: 50%;
  transform: translateX(-25%);
  top: calc(100% + 8px);
  width: max-content;
  max-width: 240px;
  white-space: normal;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(14, 165, 233, 0.22);
  box-shadow: 0 10px 30px rgba(2, 132, 199, 0.12);
  color: #0c4a6e;
  font-size: 12px;
  line-height: 1.35;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
  z-index: 999;
}

.help:hover::after {
  opacity: 1;
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
    max-height: min(40vh, 360px);
    overflow-y: auto;
  }

  .opt-grid {
    grid-template-columns: 1fr;
  }
}
</style>
