<!--
 * @Author: houser.hao@humanoid.com
 * @Date: 2026-06-16 15:00:00
 * @LastEditTime: 2026-06-16 15:00:00
 * @LastEditors: houser.hao@humanoid.com
 * @Description: 社区24h无人值守巡检场景 —— 机器人巡检路线动画 + 终点违停告警
 * @FilePath: /bic-map/src/examples/scene/communityInspect/index.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="app-root">
    <canvas id="communityCanvas" class="canvas-hidden"></canvas>

    <AppHeader title="社区 24h 无人值守/无人化巡检" />

    <main class="map-area">
      <div class="grid-bg"></div>
      <div class="map-container">
        <div id="communityMap" class="map-gl"></div>

        <!-- 巡检状态面板 -->
        <aside class="status-panel" :class="{ 'status-panel--collapsed': panelCollapsed }" aria-label="巡检状态">
          <div class="panel-title" @click="panelCollapsed = !panelCollapsed">
            <span class="panel-title__icon">📡</span>
            <span class="panel-title__text">巡检状态</span>
            <span
              v-if="slamMapReady && panelCollapsed"
              class="panel-status-chip"
              :class="{ 'chip--warn': playState === 'finished', 'chip--active': playState === 'playing' }"
            >{{ statusLabel }}</span>
            <span class="panel-toggle">{{ panelCollapsed ? '▾' : '▴' }}</span>
          </div>

          <Transition name="panel-body">
            <div v-show="!panelCollapsed" class="panel-body">
              <p v-if="!slamMapReady" class="hint-wait">正在加载 SLAM 底图…</p>

              <template v-else>
                <dl class="stat-grid">
                  <div>
                    <dt>状态</dt>
                    <dd :class="{ 'dd--warn': playState === 'finished', 'dd--active': playState === 'playing' }">
                      {{ statusLabel }}
                    </dd>
                  </div>
                  <div><dt>进度</dt><dd class="dd--mono">{{ progressPercent }}%</dd></div>
                  <div><dt>路线点</dt><dd class="dd--mono">{{ PATROL_PATH.length }} 个</dd></div>
                  <div><dt>已用时</dt><dd class="dd--mono">{{ elapsedLabel }}</dd></div>
                </dl>

                <div class="legend-group">
                  <div class="legend">
                    <span class="legend-dot legend-dot--route"></span>待巡检路线
                  </div>
                  <div class="legend">
                    <span class="legend-dot legend-dot--traveled"></span>已巡检轨迹
                  </div>
                  <div class="legend">
                    <span class="legend-dot legend-dot--endpoint"></span>违停告警点
                  </div>
                </div>
              </template>
            </div>
          </Transition>
        </aside>

        <!-- 违停告警浮层 -->
        <Transition name="alert-slide">
          <div v-if="violationAlert" class="violation-alert" role="alert">
            <div class="alert-header">
              <span class="alert-icon">⚠</span>
              <span class="alert-title">车辆违停告警</span>
              <button class="alert-close" @click="violationAlert = false" aria-label="关闭">✕</button>
            </div>
            <div class="alert-body">
              <div class="alert-row">
                <span class="alert-label">告警类型</span>
                <span class="alert-val alert-val--warn">非法停车</span>
              </div>
              <div class="alert-row">
                <span class="alert-label">识别车牌</span>
                <span class="alert-val alert-val--plate">{{ detectedPlate }}</span>
              </div>
              <div class="alert-row">
                <span class="alert-label">发现时间</span>
                <span class="alert-val">{{ alertTime }}</span>
              </div>
              <div class="alert-row">
                <span class="alert-label">告警位置</span>
                <span class="alert-val">社区东入口</span>
              </div>
              <div class="alert-row">
                <span class="alert-label">巡检机器人</span>
                <span class="alert-val">INS-001</span>
              </div>
            </div>
            <div class="alert-capture">
              <div class="capture-placeholder">
                <span class="capture-icon">📷</span>
                <span>抓拍图像已上传至云端</span>
              </div>
            </div>
          </div>
        </Transition>

      </div>
    </main>

    <AppFooter>
      <template #left>
        <div class="toolbar-actions" role="toolbar" aria-label="巡检控制">
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!slamMapReady || playState === 'playing'"
            @click="onStart"
          >
            开始巡检
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
              min="5"
              max="120"
              step="1"
              :disabled="!slamMapReady || playState === 'playing'"
            >
          </label>
        </div>
      </template>
    </AppFooter>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'
import bicMap from '../../../bicMap/core/bicmap-gl'
import { createRobot3DLayer } from '../../utils/robot/visual/robot3DLayer'
import slamImage from '../../assets/slam_quarter_transparent.png'
import inspectionRobotUrl from './assets/inspection_robot.glb?url'

// ===== SLAM 底图参数（来自地图配置界面） =====
const MAP_START_X = -58.99999370574951
const MAP_START_Y = -21.349997329711915
const MAP_X_GRID_COUNT = 2752
const MAP_Y_GRID_COUNT = 1536
const MAP_RESOLUTION = 0.05
const MAP_CENTER = [116.4074, 39.9042]
const MAP_ZOOM = 18

// ===== 机器人 3D 模型配置 =====
const ROBOT_MODEL_CONFIG = {
  url: inspectionRobotUrl,
  scale: 0.3,
  metersScale: 1,
  rotateX: Math.PI / 2,
  rotateY: 0,
  rotateZ: 0,
  animations: { idle: 'Idle', walk: 'Walk', patrol: 'Patrol' },
  defaultAnimation: 'walk',
}

const ROBOT_ID = 'inspect-bot-01'

// ===== 巡检路线坐标（37个点） =====
const PATROL_PATH_RAW = [
  [116.40736094575277, 39.904199491718686],
  [116.40736219723703, 39.904199491718686],
  [116.40736322118005, 39.904199491718686],
  [116.407364245123, 39.904199491718686],
  [116.4073657241509, 39.904199491718686],
  [116.40736686186449, 39.904199491718686],
  [116.40736788580745, 39.904199491718686],
  [116.40736925106472, 39.904199491718686],
  [116.40737027500535, 39.90419957899468],
  [116.40737141271893, 39.90419957899468],
  [116.40737266420552, 39.90419957899468],
  [116.40737380191916, 39.90419957899468],
  [116.40737619111934, 39.90419957899468],
  [116.40737903540224, 39.904199491718686],
  [116.40738096951753, 39.904199491718686],
  [116.40738381380265, 39.90419940444272],
  [116.4073877957992, 39.90419940444272],
  [116.40739052631375, 39.90419940444272],
  [116.40739405322756, 39.904199491718686],
  [116.40739689751041, 39.904199491718686],
  [116.40739951425428, 39.904199491718686],
  [116.40740281362446, 39.90419940444272],
  [116.40740508905162, 39.904199317166274],
  [116.4074073644789, 39.90419922989028],
  [116.40740918482118, 39.90419914261432],
  [116.40741157402141, 39.90419922989028],
  [116.40741350813425, 39.90419914261432],
  [116.40741555602011, 39.90419914261432],
  [116.40741703504813, 39.90419914261432],
  [116.40741908293165, 39.90419957899468],
  [116.4074203344183, 39.904200364479465],
  [116.40742204098984, 39.904200364479465],
  [116.40742431641706, 39.90420027720347],
  [116.40742625053002, 39.90420027720347],
  [116.40742841218656, 39.904200364479465],
  [116.40742989121452, 39.904200364479465],
  [116.40742989121452, 39.904200364479465],
]

const PATROL_PATH = deduplicatePath(PATROL_PATH_RAW)
const ENDPOINT = PATROL_PATH[PATROL_PATH.length - 1]

// ===== 路线 ID（与 PathReplay 对齐） =====
const ROUTE_POLYLINE_ID = 'community-inspect-route'
const TRAVERSED_POLYLINE_ID = 'community-inspect-traversed'

// ===== 工具函数（与 PathReplay 完全对齐） =====
/**
 * 去除相邻重复坐标点
 * @param {Array} points
 * @returns {Array}
 */
function deduplicatePath(points) {
  const result = []
  for (const p of points) {
    const last = result[result.length - 1]
    if (last && last[0] === p[0] && last[1] === p[1]) continue
    result.push([p[0], p[1]])
  }
  return result
}

/**
 * Haversine 距离（米）
 * @param {number[]} a [lng, lat]
 * @param {number[]} b [lng, lat]
 * @returns {number}
 */
function haversineMeters(a, b) {
  const R = 6371000
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * 以像素为单位计算各线段长度
 * @param {Object} mapInstance
 * @param {Array} path
 * @returns {{ segmentLengths: number[], totalPixelLength: number }}
 */
function buildPixelSegmentMetrics(mapInstance, path) {
  const segmentLengths = []
  let total = 0
  for (let i = 0; i < path.length - 1; i++) {
    const a = mapInstance.project(path[i])
    const b = mapInstance.project(path[i + 1])
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    segmentLengths.push(len)
    total += len
  }
  return { segmentLengths, totalPixelLength: total }
}

/**
 * 沿路径按像素距离插值
 * @param {Array} path
 * @param {number[]} segmentLengths
 * @param {number} totalLen
 * @param {number} distAlong
 * @returns {{ lngLat: number[], segIndex: number, t: number }}
 */
function interpolateAlongPath(path, segmentLengths, totalLen, distAlong) {
  if (!path.length) return { lngLat: [0, 0], segIndex: 0 }
  if (path.length < 2 || totalLen <= 0) return { lngLat: [...path[0]], segIndex: 0 }
  let d = Math.min(Math.max(0, distAlong), totalLen)
  let i = 0
  while (i < segmentLengths.length && d > segmentLengths[i]) {
    d -= segmentLengths[i]
    i++
  }
  if (i >= path.length - 1) {
    return { lngLat: [...path[path.length - 1]], segIndex: path.length - 2, t: 1 }
  }
  const segLen = segmentLengths[i]
  const t = segLen > 0 ? d / segLen : 0
  const p0 = path[i]
  const p1 = path[i + 1]
  return {
    lngLat: [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t],
    segIndex: i,
    t,
  }
}

/**
 * 地理方位角（正北 0°，顺时针 0-360°）
 * @param {number[]} from [lng, lat]
 * @param {number[]} to   [lng, lat]
 * @returns {number}
 */
function geographicBearingDegrees(from, to) {
  const φ1 = (from[1] * Math.PI) / 180
  const φ2 = (to[1] * Math.PI) / 180
  const Δλ = ((to[0] - from[0]) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/**
 * 获取指定段的地理方位角（距离过短则返回 null，与 PathReplay 一致）
 * @param {Array} path
 * @param {number} segIndex
 * @returns {number|null}
 */
function segmentGeographicBearing(path, segIndex) {
  if (segIndex < 0 || segIndex >= path.length - 1) return null
  const a = path[segIndex]
  const b = path[segIndex + 1]
  if (haversineMeters(a, b) < 0.02) return null
  return geographicBearingDegrees(a, b)
}

/**
 * 颜色线性插值 hex（与 PathReplay interpolateColor 完全一致）
 * @param {string} color1
 * @param {string} color2
 * @param {number} ratio 0-1
 * @returns {string}
 */
function interpolateColor(color1, color2, ratio) {
  const hex2rgb = hex => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [0, 0, 0]
  }
  const rgb2hex = (r, g, b) =>
    '#' + [r, g, b].map(x => { const h = Math.round(x).toString(16); return h.length === 1 ? '0' + h : h }).join('')
  const [r1, g1, b1] = hex2rgb(color1)
  const [r2, g2, b2] = hex2rgb(color2)
  return rgb2hex(r1 + (r2 - r1) * ratio, g1 + (g2 - g1) * ratio, b1 + (b2 - b1) * ratio)
}

/**
 * 已走过路径顶点列表（与 PathReplay buildTraversedPath 完全一致）
 * @param {Array} path
 * @param {number} segIndex
 * @param {number[]} lngLat
 * @returns {Array}
 */
function buildTraversedPath(path, segIndex, lngLat) {
  const out = []
  for (let j = 0; j <= segIndex; j++) {
    out.push([path[j][0], path[j][1]])
  }
  const last = out[out.length - 1]
  if (!last || last[0] !== lngLat[0] || last[1] !== lngLat[1]) {
    out.push([lngLat[0], lngLat[1]])
  }
  if (out.length < 2 && path.length >= 2) {
    const p0 = path[0]
    const p1 = path[1]
    const dx = p1[0] - p0[0]
    const dy = p1[1] - p0[1]
    const len = Math.hypot(dx, dy)
    const k = len > 1e-15 ? 1e-7 / len : 1e-7
    out.push([p0[0] + dx * k, p0[1] + dy * k])
  }
  return out
}

/**
 * 路线回放 polylines payload（与 PathReplay buildReplayPolylinesPayload 完全一致）
 * - 前方路径：渐变 #00F5FF → #00EE00，宽 5，带方向箭头
 * - 已走轨迹：灰色 #94a3b8，宽 6，无箭头，叠于上层
 * @param {Array} path          完整/剩余路径
 * @param {Array} traversedPath 已走过的轨迹点
 * @returns {Array}
 */
function buildReplayPolylinesPayload(path, traversedPath) {
  const gradientSegments = []
  if (path.length >= 2) {
    const totalSegments = path.length - 1
    for (let i = 0; i < totalSegments; i++) {
      const ratio = i / (totalSegments - 1)
      gradientSegments.push({
        id: `${ROUTE_POLYLINE_ID}-seg-${i}`,
        path: [path[i], path[i + 1]],
        color: interpolateColor('#00F5FF', '#00EE00', ratio),
        width: 5,
        opacity: 0.85,
        showArrow: true,
        arrowSize: 0.5,
        arrowSpacing: 35,
      })
    }
  }
  return [
    ...gradientSegments,
    {
      id: TRAVERSED_POLYLINE_ID,
      path: traversedPath,
      color: '#94a3b8',
      width: 6,
      opacity: 1,
      showArrow: false,
    },
  ]
}

// ===== 常量 =====
const MOCK_PLATE = '京A·12345'

// ===== 响应式状态 =====
const map = ref(null)
const slamMapReady = ref(false)
const polylinesCtrl = ref(null)
const endpointCircleCtrl = ref(null)
const robot3DLayer = ref(null)

const playState = ref('idle')
const loop = ref(false)
const durationSeconds = ref(25)
const progress = ref(0)
const violationAlert = ref(false)
const alertTime = ref('')
const detectedPlate = ref('识别中…')
const panelCollapsed = ref(false)

// ===== computed =====
const progressPercent = computed(() => Math.round(progress.value * 1000) / 10)
const durationMs = computed(() => Math.max(1000, durationSeconds.value * 1000))
const statusLabel = computed(() => {
  const MAP = {
    idle: '待命',
    playing: '巡检中',
    paused: '已暂停',
    finished: '告警！违停检测',
  }
  return MAP[playState.value] ?? playState.value
})

const elapsedLabel = computed(() => {
  const ms = progress.value * durationMs.value
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
})

// ===== RAF 动画变量（非响应式） =====
let segmentLengths = []
let totalPixelLength = 0
let rafId = null
let playStartPerf = 0
let pausedElapsedMs = 0
let lastBearingDeg = 0
let endpointCircleAdded = false
let plateTimers = []
let bubbleCtrl = null

/**
 * 注入气泡动画关键帧（幂等，每页只执行一次）
 */
function ensureBubbleStyles() {
  const id = 'bic-vb-styles'
  if (document.getElementById(id)) return
  const s = document.createElement('style')
  s.id = id
  s.textContent = `
    @keyframes bicvb-pop {
      0%   { opacity: 0; transform: translateY(10px) scale(0.9); }
      65%  { transform: translateY(-3px) scale(1.03); }
      100% { opacity: 1; transform: none; }
    }
    @keyframes bicvb-blink { 0%,100%{opacity:1} 50%{opacity:.35} }
    @keyframes bicvb-reveal { from{letter-spacing:.35em;opacity:.4} to{letter-spacing:.22em;opacity:1} }
  `
  document.head.appendChild(s)
}

/**
 * 生成违停告警气泡的 HTML（内联样式，无外部依赖）
 */
function buildViolationBubbleHTML() {
  return `
    <div style="
      position: relative;
      width: 172px;
      background: rgba(255,255,255,0.97);
      border-radius: 12px;
      border: 1.5px solid rgba(239,68,68,0.55);
      box-shadow: 0 6px 24px rgba(239,68,68,0.22),0 2px 8px rgba(0,0,0,0.1);
      font-family: PingFang SC,Microsoft YaHei,system-ui,sans-serif;
      animation: bicvb-pop 0.42s cubic-bezier(0.34,1.56,0.64,1) both;
    ">
      <div style="background:linear-gradient(135deg,#ef4444,#dc2626);border-radius:10px 10px 0 0;padding:6px 10px;display:flex;align-items:center;gap:5px;">
        <span style="font-size:13px;">⚠</span>
        <span style="color:#fff;font-size:11px;font-weight:700;letter-spacing:.06em;">违停告警</span>
        <span style="margin-left:auto;background:rgba(255,255,255,.22);color:#fff;font-size:9px;font-weight:600;padding:1px 5px;border-radius:4px;">INS-001</span>
      </div>
      <div style="padding:8px 10px 4px;">
        <div style="font-size:9px;color:#94a3b8;margin-bottom:4px;letter-spacing:.04em;">车牌识别</div>
        <div style="background:#003087;border-radius:5px;padding:4px 8px;display:flex;align-items:center;justify-content:center;gap:3px;border:1.5px solid #1a4fa0;">
          <span style="color:#fff;background:#e8a000;border-radius:2px;font-size:9px;font-weight:800;padding:1px 3px;line-height:1.3;">京</span>
          <span class="bic-vb-plate" style="color:#fff;font-size:13px;font-weight:800;letter-spacing:.22em;font-family:ui-monospace,'SF Mono',monospace;animation:bicvb-blink .5s linear infinite;">识别中…</span>
        </div>
      </div>
      <div style="padding:0 10px 8px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:9px;color:#94a3b8;">社区东入口</span>
        <span class="bic-vb-status" style="font-size:9px;color:#f59e0b;font-weight:600;">扫描中</span>
      </div>
      <div style="position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:10px solid rgba(239,68,68,.55);"></div>
      <div style="position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid rgba(255,255,255,.97);"></div>
    </div>
  `
}

/**
 * 显示机器人头顶气泡并启动车牌逐字识别动画
 */
function showViolationBubble() {
  if (!bubbleCtrl) return
  ensureBubbleStyles()
  bubbleCtrl.show(ENDPOINT, buildViolationBubbleHTML())

  const wrapper = bubbleCtrl.getElement()
  const plateEl = wrapper.querySelector('.bic-vb-plate')
  const statusEl = wrapper.querySelector('.bic-vb-status')

  const chars = MOCK_PLATE.split('')
  let revealed = ''
  plateTimers.forEach(t => clearTimeout(t))
  plateTimers = []

  chars.forEach((ch, i) => {
    const t = setTimeout(() => {
      revealed += ch
      if (plateEl) plateEl.textContent = revealed + (i < chars.length - 1 ? '_' : '')
      if (i === chars.length - 1) {
        if (plateEl) plateEl.style.animation = 'bicvb-reveal .4s ease both'
        if (statusEl) { statusEl.textContent = '已锁定'; statusEl.style.color = '#ef4444' }
        detectedPlate.value = MOCK_PLATE
      }
    }, 600 + i * 220)
    plateTimers.push(t)
  })
}

/**
 * 隐藏机器人头顶气泡并清理
 */
function removeViolationBubble() {
  plateTimers.forEach(t => clearTimeout(t))
  plateTimers = []
  bubbleCtrl?.hide()
  detectedPlate.value = '识别中…'
}

// ===== 动画逻辑 =====
function refreshPathMetrics() {
  const m = map.value
  if (!m || PATROL_PATH.length < 2) {
    segmentLengths = []
    totalPixelLength = 0
    return
  }
  const metrics = buildPixelSegmentMetrics(m, PATROL_PATH)
  segmentLengths = metrics.segmentLengths
  totalPixelLength = metrics.totalPixelLength
}

function applyFrame(distAlong) {
  const m = map.value
  const r3d = robot3DLayer.value
  if (!m || !r3d || PATROL_PATH.length < 2) return

  const { lngLat, segIndex } = interpolateAlongPath(
    PATROL_PATH, segmentLengths, totalPixelLength, distAlong
  )

  const b = segmentGeographicBearing(PATROL_PATH, segIndex)
  if (b != null) lastBearingDeg = b

  r3d.updateRobot(ROBOT_ID, { lngLat, heading: lastBearingDeg })

  const polyCtrl = polylinesCtrl.value
  if (polyCtrl?.update) {
    const traversed = buildTraversedPath(PATROL_PATH, segIndex, lngLat)
    polyCtrl.update(buildReplayPolylinesPayload(PATROL_PATH, traversed))
  }
}

function stopRaf() {
  if (rafId != null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

function tick() {
  if (playState.value !== 'playing' || !map.value) return
  const elapsed = performance.now() - playStartPerf
  const p = Math.min(1, elapsed / durationMs.value)
  progress.value = p
  applyFrame(p * totalPixelLength)

  if (p >= 1) {
    if (loop.value) {
      playStartPerf = performance.now()
      pausedElapsedMs = 0
      progress.value = 0
      rafId = requestAnimationFrame(tick)
    } else {
      playState.value = 'finished'
      applyFrame(totalPixelLength)
      progress.value = 1
      stopRaf()
      triggerViolationAlert()
    }
    return
  }
  rafId = requestAnimationFrame(tick)
}

function triggerViolationAlert() {
  const epCtrl = endpointCircleCtrl.value
  if (epCtrl && !endpointCircleAdded) {
    epCtrl.addCircle({
      center: ENDPOINT,
      radiusM: 0.6,
      fillColor: '#ef4444',
      fillOpacity: 0.35,
      outlineColor: '#ef4444',
      outlineWidth: 3,
    })
    endpointCircleAdded = true
  }

  const now = new Date()
  alertTime.value = now.toLocaleTimeString('zh-CN', { hour12: false })
  violationAlert.value = true

  showViolationBubble()
}

// ===== 控制函数 =====
function onStart() {
  if (!slamMapReady.value || !robot3DLayer.value) return
  refreshPathMetrics()
  stopRaf()
  pausedElapsedMs = 0
  progress.value = 0
  violationAlert.value = false
  removeViolationBubble()

  if (endpointCircleAdded) {
    endpointCircleCtrl.value?.clear()
    endpointCircleAdded = false
  }

  lastBearingDeg = segmentGeographicBearing(PATROL_PATH, 0) ?? 0
  applyFrame(0)
  playState.value = 'playing'
  playStartPerf = performance.now()
  rafId = requestAnimationFrame(tick)
}

function onPause() {
  if (playState.value !== 'playing') return
  pausedElapsedMs = performance.now() - playStartPerf
  playState.value = 'paused'
  stopRaf()
}

function onResume() {
  if (playState.value !== 'paused') return
  playState.value = 'playing'
  playStartPerf = performance.now() - pausedElapsedMs
  rafId = requestAnimationFrame(tick)
}

function onReset() {
  stopRaf()
  playState.value = 'idle'
  pausedElapsedMs = 0
  progress.value = 0
  violationAlert.value = false
  removeViolationBubble()

  if (endpointCircleAdded) {
    endpointCircleCtrl.value?.clear()
    endpointCircleAdded = false
  }

  refreshPathMetrics()
  lastBearingDeg = segmentGeographicBearing(PATROL_PATH, 0) ?? 0
  applyFrame(0)
}

// ===== 初始化图层 =====
function initLayers() {
  const m = map.value
  if (!m) return

  refreshPathMetrics()

  const traversed0 = buildTraversedPath(PATROL_PATH, 0, PATROL_PATH[0])
  polylinesCtrl.value = bicMap.createPolylines(
    m,
    buildReplayPolylinesPayload(PATROL_PATH, traversed0),
    { showArrow: true, arrowSpacing: 35, arrowSize: 0.5, arrowImagePath: '/bicMap/assets/svg/arrow.svg' }
  )

  endpointCircleCtrl.value = bicMap.createCircles(m, [], {
    fillColor: '#ef4444',
    fillOpacity: 0.35,
    outlineColor: '#ef4444',
    outlineWidth: 3,
  })

  robot3DLayer.value = createRobot3DLayer(m, ROBOT_MODEL_CONFIG, {
    layerId: 'community-inspect-robot-layer',
    movementThreshold: 0.01,
    idleDebounceMs: 600,
    headingOffset3D: 90,
  })

  lastBearingDeg = segmentGeographicBearing(PATROL_PATH, 0) ?? 0
  robot3DLayer.value.addRobot({
    id: ROBOT_ID,
    lngLat: PATROL_PATH[0],
    heading: lastBearingDeg,
  })

  bubbleCtrl = bicMap.createLabelBubble(m, { anchor: 'bottom', offset: [0, -80] })

  m.once('moveend', () => { refreshPathMetrics() })
}

// ===== 生命周期 =====
onMounted(() => { initMap() })

onBeforeUnmount(() => {
  stopRaf()
  removeViolationBubble()
  bubbleCtrl?.remove()
  bubbleCtrl = null
  robot3DLayer.value?.destroy?.()
  polylinesCtrl.value?.remove?.()
  endpointCircleCtrl.value?.remove?.()
  map.value?.remove?.()
  map.value = null
})

async function initMap() {
  try {
    await bicMap.init()
    map.value = bicMap.createMap({
      container: 'communityMap',
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      pitch: 45,
      backgroundColor: '#fff',
    })
    bicMap.addZoomControl(map.value, 'bottom-right')
    map.value.on('load', () => { loadSlamMap() })
  } catch (err) {
    console.error('[communityUnattended] 初始化地图失败:', err)
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
      canvasId: 'communityCanvas',
      fitBounds: true,
    })
    initLayers()
    slamMapReady.value = true
  } catch (err) {
    console.error('[communityUnattended] 加载底图失败:', err)
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
  pointer-events: none;
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

.canvas-hidden { display: none; }

/* ── 状态面板 ── */
.status-panel {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 20;
  width: 220px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(14, 165, 233, 0.20);
  box-shadow:
    0 4px 20px rgba(14, 165, 233, 0.10),
    0 0 0 1px rgba(255, 255, 255, 0.7) inset;
  font-size: 12px;
  color: #0c4a6e;
  overflow: hidden;
  transition: box-shadow 0.2s;

  &:hover { box-shadow: 0 6px 24px rgba(14, 165, 233, 0.14), 0 0 0 1px rgba(255, 255, 255, 0.8) inset; }

  &--collapsed .panel-title {
    border-bottom: none;
  }
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid rgba(14, 165, 233, 0.12);
  transition: background 0.15s;

  &:hover { background: rgba(14, 165, 233, 0.05); }

  &__icon { font-size: 13px; line-height: 1; flex-shrink: 0; }

  &__text {
    flex: 1;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #0369a1;
  }
}

.panel-status-chip {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(14, 165, 233, 0.10);
  color: #0369a1;
  white-space: nowrap;

  &.chip--warn { background: rgba(220, 38, 38, 0.10); color: #dc2626; }
  &.chip--active { background: rgba(5, 150, 105, 0.10); color: #059669; }
}

.panel-toggle {
  font-size: 11px;
  color: #94a3b8;
  flex-shrink: 0;
  line-height: 1;
  transition: color 0.15s;

  .panel-title:hover & { color: #0369a1; }
}

.panel-body {
  padding: 10px 10px 8px;
}

/* Transition */
.panel-body-enter-active,
.panel-body-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
  transform-origin: top;
}

.panel-body-enter-from,
.panel-body-leave-to {
  opacity: 0;
  transform: scaleY(0.9);
}

.hint-wait {
  color: #64748b;
  font-size: 11px;
  margin: 0;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 10px;
  margin: 0 0 8px;
  font-size: 11px;

  dt { color: #64748b; margin: 0; }
  dd {
    margin: 0;
    font-weight: 600;
    color: #0c4a6e;

    &.dd--mono {
      font-family: ui-monospace, 'SF Mono', monospace;
      font-variant-numeric: tabular-nums;
    }

    &.dd--warn { color: #dc2626; }
    &.dd--active { color: #059669; }
  }
}

.legend-group {
  border-top: 1px solid rgba(14, 165, 233, 0.10);
  padding-top: 7px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.legend {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 10px;
  color: #64748b;
}

.legend-dot {
  display: inline-block;
  width: 14px;
  height: 5px;
  border-radius: 3px;
  flex-shrink: 0;

  &--route {
    background: linear-gradient(to right, #00F5FF, #00EE00);
  }

  &--traveled { background: #94a3b8; }

  &--endpoint {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ef4444;
  }
}

/* ── 违停告警浮层 ── */
.violation-alert {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 30;
  width: 260px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1.5px solid rgba(239, 68, 68, 0.4);
  box-shadow:
    0 8px 32px rgba(239, 68, 68, 0.18),
    0 0 0 1px rgba(255, 255, 255, 0.9) inset;
  overflow: hidden;
}

.alert-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(220, 38, 38, 0.06));
  border-bottom: 1px solid rgba(239, 68, 68, 0.18);
}

.alert-icon {
  font-size: 16px;
  animation: pulse-icon 1.2s ease-in-out infinite;
}

.alert-title {
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  color: #dc2626;
  letter-spacing: 0.04em;
}

.alert-close {
  background: none;
  border: none;
  font-size: 12px;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  line-height: 1;

  &:hover { color: #dc2626; background: rgba(239, 68, 68, 0.08); }
}

.alert-body {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.alert-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}

.alert-label { color: #64748b; }

.alert-val {
  font-weight: 600;
  color: #1e293b;
  font-family: ui-monospace, 'SF Mono', monospace;
  font-size: 11px;

  &.alert-val--warn {
    color: #dc2626;
    font-family: inherit;
  }

  &.alert-val--plate {
    background: #003087;
    color: #fff;
    padding: 1px 7px;
    border-radius: 4px;
    letter-spacing: 0.1em;
    font-size: 11px;
  }
}

.alert-capture {
  margin: 0 12px 10px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.06);
  border: 1px dashed rgba(239, 68, 68, 0.3);
  padding: 10px;
}

.capture-placeholder {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #94a3b8;
}

.capture-icon { font-size: 18px; }

/* ── Transition 动画 ── */
.alert-slide-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.alert-slide-leave-active {
  transition: all 0.2s ease;
}

.alert-slide-enter-from {
  opacity: 0;
  transform: translateX(30px) scale(0.95);
}

.alert-slide-leave-to {
  opacity: 0;
  transform: translateX(20px) scale(0.97);
}

@keyframes pulse-icon {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.25); }
}

/* ── 底部工具栏 ── */
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
  gap: 6px;
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

  &:active:not(:disabled) { transform: scale(0.97); }

  &:hover:not(:disabled) {
    transform: translateY(-1px) scale(1.03);
    border-color: rgba(14, 165, 233, 0.35);
    box-shadow: 0 4px 15px rgba(14, 165, 233, 0.1);
  }

  &:disabled { opacity: 0.45; cursor: not-allowed; }
}

.btn-primary {
  border: none;
  color: #fff;
  background: linear-gradient(to right, #0167ff, #40bbe9, #c3e8ff);
  box-shadow: 0 4px 15px rgba(14, 165, 233, 0.3);
}

.opt {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #0369a1;

  input[type='number'] {
    width: 60px;
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid rgba(14, 165, 233, 0.35);
    font-size: 12px;
  }
}

.opt-check input { width: auto; }

@media (max-width: 768px) {
  .map-container { inset: 8px; }

  .status-panel {
    left: 8px;
    right: 8px;
    max-width: none;
    top: 8px;
  }

  .violation-alert {
    right: 8px;
    width: calc(100% - 16px);
  }
}

</style>
