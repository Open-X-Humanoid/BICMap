<!--
 * @Author: houser.hao@humanoid.com
 * @Date: 2026-05-29 15:30:00
 * @LastEditTime: 2026-05-29 18:33:14
 * @LastEditors: houser.hao@humanoid.com
 * @Description: SLAM 建图动态演示 - 使用真实逐帧扫图 BMP 数据驱动 bicMap 地图引擎实时更新
 * @FilePath: /bic-map/src/examples/indoor/slam/buildMap.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="app-root">
    <canvas id="canvasMap" style="display:none"></canvas>

    <AppHeader title="SLAM 建图演示" />

    <main class="map-area">
      <div class="map-container">
        <div id="buildMap" class="map-gl"></div>

        <!-- 左上角常驻缩略图 -->
        <div class="thumb-hint" @click="showSheet = true" title="点击全屏查看帧序列">
          <div class="thumb-label">建图说明</div>
          <img
            src="./map-data/preview_contact_sheet_50.png"
            alt="帧序列缩略图"
            class="thumb-img"
          />
          <div class="thumb-expand">⤢ 全屏</div>
        </div>

        <div class="status-panel">
          <div class="status-header">
            <span class="status-dot" :class="{ active: isPlaying, done: isDone }"></span>
            <span class="status-label">{{ statusText }}</span>
          </div>

          <div class="progress-wrap">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progressPct + '%' }">
                <span class="progress-shine"></span>
              </div>
            </div>
            <span class="progress-pct">{{ progressPct.toFixed(1) }}%</span>
          </div>

          <div class="stage-row">
            <span class="stage-label">帧</span>
            <span class="stage-num">{{ String(currentStage).padStart(2, '0') }}</span>
            <span class="stage-sep">/</span>
            <span class="stage-total">{{ TOTAL_STAGES }}</span>
          </div>

          <div class="stat-row">
            <div class="stat-item">
              <div class="stat-val">{{ elapsedStr }}</div>
              <div class="stat-lbl">用时</div>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <div class="stat-val">{{ scannedAreaStr }}</div>
              <div class="stat-lbl">已扫 m²</div>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <div class="stat-val">{{ lastIntervalMs > 0 ? lastIntervalMs + 'ms' : '—' }}</div>
              <div class="stat-lbl">上帧间隔</div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <AppFooter>
      <template #left>
        <div class="toolbar-actions">
          <button
            class="btn btn-primary"
            :class="{ danger: isPlaying }"
            :disabled="!mapReady"
            @click="togglePlay"
          >{{ btnLabel }}</button>
          <button class="btn" :disabled="isPlaying || !mapReady" @click="resetPlay">重置</button>
          <button class="btn" :disabled="!mapReady" @click="zoomToFit">适应地图</button>

          <label class="auto-play-toggle">
            <input type="checkbox" v-model="autoPlay" :disabled="!mapReady" />
            <span>自动更新帧</span>
          </label>

          <div class="interval-inline" v-if="autoPlay && currentStage > 43">
            <span class="interval-unit" style="white-space:nowrap;color:#64748b;font-size:12px;">余帧</span>
            <input
              type="number"
              class="interval-num"
              min="50" max="9999" step="50"
              v-model.number="autoIntervalMs"
            />
            <span class="interval-unit">ms</span>
          </div>

          <button
            class="btn"
            :disabled="autoPlay || !isPlaying || currentStage >= TOTAL_STAGES"
            @click="nextFrame"
          >下一帧 ›</button>
        </div>
      </template>
    </AppFooter>

    <!-- 全屏灯箱 -->
    <transition name="lb-fade">
      <div v-if="showSheet" class="lightbox" @click.self="showSheet = false">
        <div class="lb-panel">
          <div class="lb-header">
            <span class="lb-title">建图帧序列 · 50 帧示意</span>
            <button class="lb-close" @click="showSheet = false">✕</button>
          </div>
          <div class="lb-body">
            <img
              src="./map-data/preview_contact_sheet_50.png"
              alt="50帧建图示意图"
              class="lb-img"
            />
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'

import bicMap from '../../../bicMap/core/bicmap-gl'

// ─── SLAM 地图参数（匹配 BMP 文件实际尺寸 2048×1143）──────────────────────
const MAP_START_X      = -58.999993705749512
const MAP_START_Y      = -21.349997329711914
const MAP_X_GRID_COUNT = 2048
const MAP_Y_GRID_COUNT = 1143
const MAP_RESOLUTION   = 0.05
const CANVAS_ID        = 'canvasMap'
const TOTAL_STAGES     = 50
const TOTAL_AREA_M2    = 2840

// ─── 录制的帧间隔时间轴（ms）
// RECORDED_INTERVALS[i] = 从 stage(i+1) 推进到 stage(i+2) 的等待时长
// 来源：手动点击"下一帧"测量的真实建图节奏（取第三次完整回放数据）
// 未录制的 stage 43→50 回退到 autoIntervalMs 兜底
const RECORDED_INTERVALS = [
  //  01→02   02→03   03→04   04→05   05→06   06→07   07→08   08→09   09→10
    2000,      400,    383,    295,   1213,    241,    626,   1655,   1119,
  //  10→11   11→12   12→13   13→14   14→15   15→16   16→17   17→18   18→19
     187,    1349,    186,    174,    212,    160,    134,    267,    145,
  //  19→20   20→21   21→22   22→23   23→24   24→25   25→26   26→27   27→28
     188,     519,    161,    120,    147,    132,    121,    147,    133,
  //  28→29   29→30   30→31   31→32   32→33   33→34   34→35   35→36   36→37
     147,     120,    146,    133,    348,    401,    373,    148,    132,
  //  37→38   38→39   39→40   40→41   41→42   42→43
     281,     426,    507,    761,    186,    213,
]   // 索引 0–41 覆盖 stage01→43；stage43→50 由 autoIntervalMs 兜底

// ─── 批量导入全部 stage BMP 文件（URL 字符串）────────────────────────────
const rawModules = import.meta.glob(
  './map-data/scan_accum_stage_*.bmp',
  { query: '?url', import: 'default', eager: true }
)

// 按 stage 编号升序排列，得到长度 50 的 URL 数组（索引 0 = stage 01）
const STAGE_URLS = Object.entries(rawModules)
  .sort(([a], [b]) => {
    const n = (s) => parseInt(s.match(/stage_(\d+)/)?.[1] ?? '0', 10)
    return n(a) - n(b)
  })
  .map(([, url]) => url)

// ─── 机器人真实 GPS 路径（136 个采样点，线性插值映射到 50 帧）──────────
// 来源：实际建图过程中采集的机器人定位数据
const ROBOT_PATH_GPS = [
  [116.40735228620696, 39.90420454895417],
  [116.40735453575843, 39.90420446267083],
  [116.40735566053422, 39.90420446267083],
  [116.40735667283099, 39.90420446267083],
  [116.40735667283099, 39.904205929491155],
  [116.4073571227417,  39.90420731002814],
  [116.40735723521885, 39.9042086905651],
  [116.40735734769612, 39.90420981225145],
  [116.40735746017504, 39.904211020221084],
  [116.40735757265224, 39.904211710489534],
  [116.40735835999465, 39.90421205562342],
  [116.40735757265224, 39.9042105025199],
  [116.40735746017504, 39.904208949415704],
  [116.40735746017504, 39.90420575692386],
  [116.40735835999465, 39.904204203819575],
  [116.40736207175354, 39.904204203819575],
  [116.40736488369288, 39.904203858685634],
  [116.40736724572162, 39.904203858685634],
  [116.40736882040625, 39.90420472152144],
  [116.4073691578397,  39.90420661975966],
  [116.4073696077503,  39.904208949415704],
  [116.40737095748051, 39.90421076137051],
  [116.40737163234559, 39.904212487041235],
  [116.40737028261543, 39.90420912198297],
  [116.40736994518204, 39.90420739631148],
  [116.40736983270483, 39.90420523922268],
  [116.40737005766096, 39.90420411753624],
  [116.40737365694099, 39.90420403125293],
  [116.40737646888027, 39.90420411753624],
  [116.40737725622262, 39.90420601577449],
  [116.40737725622262, 39.90420739631148],
  [116.4073779310894,  39.90420981225145],
  [116.40737973073021, 39.90421265960853],
  [116.40737883090901, 39.90421127907169],
  [116.40737815604388, 39.9042085179978],
  [116.40737770613327, 39.90420679232693],
  [116.40737759365607, 39.904204807804746],
  [116.40737939329688, 39.90420472152144],
  [116.4073825426679,  39.904204203819575],
  [116.40738681681478, 39.904204203819575],
  [116.40738771663604, 39.904204807804746],
  [116.40738782911319, 39.90420687861027],
  [116.40738782911319, 39.90420817286389],
  [116.40738782911319, 39.904210329952605],
  [116.40738782911319, 39.90421214190738],
  [116.40738782911319, 39.90421352244422],
  [116.40738782911319, 39.904210157385336],
  [116.40738794159046, 39.90420912198297],
  [116.40738782911319, 39.90420601577449],
  [116.40738861645559, 39.90420463523748],
  [116.40739109096324, 39.90420463523748],
  [116.40739457776596, 39.90420463523748],
  [116.40739581501896, 39.90420498037204],
  [116.40739581501896, 39.904207223744834],
  [116.40739581501896, 39.9042086905651],
  [116.40739581501896, 39.904210157385336],
  [116.40739581501896, 39.90421110650442],
  [116.40739581501896, 39.90421265960853],
  [116.40739592749782, 39.90420739631148],
  [116.40739592749782, 39.90420558435662],
  [116.4073998642113,  39.90420472152144],
  [116.40740323853845, 39.90420463523748],
  [116.40740818755035, 39.90420463523748],
  [116.40741167435476, 39.90420437638687],
  [116.40741516115929, 39.904204203819575],
  [116.40740447579145, 39.90420506665538],
  [116.40740380092632, 39.904206447192365],
  [116.40740357597019, 39.90420903569901],
  [116.40740357597019, 39.90421127907169],
  [116.40740357597019, 39.9042102436693],
  [116.40740346349293, 39.9042086905651],
  [116.40740256367337, 39.904206447192365],
  [116.40740188880824, 39.904206274625096],
  [116.40739648988574, 39.904205325505984],
  [116.4073912034404,  39.904204290103564],
  [116.40738209275901, 39.90420403125293],
  [116.40737736870159, 39.90420446267083],
  [116.40737095748051, 39.90420446267083],
  [116.40737050756991, 39.904202736999224],
  [116.40737017013817, 39.90419988964172],
  [116.40737005766096, 39.90419738741804],
  [116.4073679205867,  39.9041968697168],
  [116.40736488369288, 39.904196697149445],
  [116.40736859545189, 39.90419678343278],
  [116.4073691578397,  39.90419600688088],
  [116.40737017013817, 39.90419419492568],
  [116.40737005766096, 39.90419238297045],
  [116.40737017013817, 39.9041968697168],
  [116.40737017013817, 39.90420057991025],
  [116.40737185730012, 39.90420411753624],
  [116.40737444428498, 39.90420411753624],
  [116.4073824301907,  39.90420403125293],
  [116.40738625442685, 39.904204290103564],
  [116.40739266564788, 39.904204290103564],
  [116.40740132642037, 39.904204807804746],
  [116.40741032462455, 39.90420506665538],
  [116.40741876044092, 39.90420463523748],
  [116.40742415936347, 39.90420403125293],
  [116.40742933332984, 39.904203772402326],
  [116.40743012067384, 39.90420170159672],
  [116.40743000819492, 39.90420014849232],
  [116.40742989571771, 39.90419894052249],
  [116.4074285459875,  39.90419738741804],
  [116.4074251716603,  39.90419643829878],
  [116.40742224724374, 39.90419592059689],
  [116.4074202226484,  39.90419592059689],
  [116.40741932282884, 39.90419894052249],
  [116.40741932282884, 39.90420299584983],
  [116.40741763566524, 39.90420454895417],
  [116.40741324903956, 39.90420454895417],
  [116.40740728772914, 39.904205325505984],
  [116.40740560056713, 39.90421127907169],
  [116.40740627543227, 39.9042147304138],
  [116.40740627543227, 39.90421662865174],
  [116.40740661286401, 39.904219648575804],
  [116.40740706277467, 39.90422258221642],
  [116.40740852498374, 39.90422594727471],
  [116.40740976223674, 39.90422681011023],
  [116.40741313656224, 39.90422715524406],
  [116.40741797309693, 39.90422715524406],
  [116.4074235969756,  39.90422689639348],
  [116.40742877094198, 39.90422698267682],
  [116.4074302331511,  39.90422594727471],
  [116.40743124544798, 39.904223272484785],
  [116.40743135792678, 39.904221029112506],
  [116.40743169535858, 39.904217405204065],
  [116.40743124544798, 39.9042149892644],
  [116.40743068306006, 39.904213177309714],
  [116.40743113297071, 39.90421671493567],
  [116.40742944580711, 39.90421904459137],
  [116.4074264089133,  39.90421904459137],
  [116.40742123494692, 39.90421921715861],
  [116.40741426133803, 39.90421947600919],
  [116.40741178683203, 39.90421947600919],
  [116.40741032462455, 39.904219389725256],
  [116.40741032462455, 39.904219389725256],
]

// ─── 响应式状态 ────────────────────────────────────────────────────────────
const mapReady        = ref(false)
const isPlaying       = ref(false)
const isDone          = ref(false)
const currentStage    = ref(1)
const elapsedMs       = ref(0)
const lastIntervalMs  = ref(0)   // 上次帧间隔（自动或手动）
const autoPlay        = ref(true)  // 是否自动推帧（默认开启）
const autoIntervalMs  = ref(300)   // 自动推帧间隔（ms）
const showSheet       = ref(false) // 帧序列预览抽屉

// ─── 计算属性 ──────────────────────────────────────────────────────────────
const progressPct    = computed(() => ((currentStage.value - 1) / (TOTAL_STAGES - 1)) * 100)
const scannedAreaStr = computed(() => Math.floor(progressPct.value / 100 * TOTAL_AREA_M2).toLocaleString())
const elapsedStr     = computed(() => {
  const s = Math.floor(elapsedMs.value / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
})
const statusText = computed(() => {
  if (isDone.value)      return '建图完成 ✓'
  if (isPlaying.value)   return '扫描中…'
  return mapReady.value  ? '待机' : '地图加载中…'
})
const btnLabel   = computed(() => isPlaying.value ? '暂停' : isDone.value ? '重新建图' : '开始建图')

// 机器人沿路径的移动速度（路径采样点 / 秒），与 BMP 帧率完全无关
const ROBOT_POINTS_PER_SEC = 8   // 136 点 / 8 ≈ 17 秒走完全程

// ─── 内部状态 ──────────────────────────────────────────────────────────────
let mapInst          = null
let robotController  = null
let cameraBound      = null
let timerId          = null   // 自动推帧定时器
let rafId            = 0
let startTs          = 0
const imageCache     = new Map()   // stage(number) → HTMLImageElement

// 机器人 RAF 状态（浮点路径索引，独立于 BMP 帧）
let robotPathT  = 0   // 当前在 ROBOT_PATH_GPS 中的浮点索引 0..135
let robotLastTs = 0   // 上一次 RAF 时间戳（毫秒）

// robo.png 默认朝东（偏移 -90°），与 useRobotFollow 保持相同公式
const ICON_HEADING_OFFSET = -90

// ─── 辅助：根据浮点路径索引 t 插值 GPS 坐标 ──────────────────────────────
function getGPSAtT(t) {
  const last = ROBOT_PATH_GPS.length - 1
  const ct   = Math.min(Math.max(t, 0), last)
  const i    = Math.min(Math.floor(ct), last - 1)
  const fr   = ct - i
  const [lng0, lat0] = ROBOT_PATH_GPS[i]
  const [lng1, lat1] = ROBOT_PATH_GPS[i + 1]
  return [lng0 + (lng1 - lng0) * fr, lat0 + (lat1 - lat0) * fr]
}

// ─── 辅助：根据浮点路径索引 t 计算朝向（返回 icon-rotate 度数）────────
function getRotationAtT(t) {
  const last = ROBOT_PATH_GPS.length - 1
  const ct   = Math.min(Math.max(t, 0), last - 1)
  const i    = Math.floor(ct)
  const [lng0, lat0] = ROBOT_PATH_GPS[i]
  const [lng1, lat1] = ROBOT_PATH_GPS[Math.min(i + 1, last)]
  const dLng = lng1 - lng0
  const dLat = lat1 - lat0
  if (Math.abs(dLng) < 1e-9 && Math.abs(dLat) < 1e-9) return null
  let bearing = Math.atan2(dLng, dLat) * 180 / Math.PI
  if (bearing < 0) bearing += 360
  return (bearing + ICON_HEADING_OFFSET + 360) % 360
}

// 初始化时按 stage 定位机器人（保持对外接口不变）
function getRobotGPS(stage) {
  return getGPSAtT((stage - 1) / (TOTAL_STAGES - 1) * (ROBOT_PATH_GPS.length - 1))
}
function getRobotRotation(stage) {
  return getRotationAtT((stage - 1) / (TOTAL_STAGES - 1) * (ROBOT_PATH_GPS.length - 1))
}

// ─── 辅助：加载单张图片（缓存复用）──────────────────────────────────────
function loadStageImage(stage) {
  if (imageCache.has(stage)) return Promise.resolve(imageCache.get(stage))
  const url = STAGE_URLS[stage - 1]
  if (!url) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload  = () => { imageCache.set(stage, img); resolve(img) }
    img.onerror = () => resolve(null)
    img.src     = url
  })
}

// 向前预加载若干帧
function preloadAhead(from, count = 5) {
  for (let i = 1; i <= count; i++) {
    const s = from + i
    if (s <= TOTAL_STAGES) loadStageImage(s)
  }
}

// ─── 核心：将 BMP 帧绘制到地图 canvas，MapLibre 自动读取（animate:true）──
function drawStageToCanvas(imgEl) {
  const canvas = document.getElementById(CANVAS_ID)
  if (!canvas || !imgEl) return
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height)
}

// ─── 机器人 RAF：独立速度，与 BMP 帧率完全无关 ───────────────────────────
function robotAnimTick(ts) {
  if (!robotController || !isPlaying.value) { rafId = 0; return }

  if (robotLastTs === 0) robotLastTs = ts
  const delta   = (ts - robotLastTs) / 1000   // 秒
  robotLastTs   = ts
  robotPathT    = Math.min(robotPathT + delta * ROBOT_POINTS_PER_SEC, ROBOT_PATH_GPS.length - 1)

  if (startTs > 0) elapsedMs.value = Date.now() - startTs

  const lngLat   = getGPSAtT(robotPathT)
  const rotation = getRotationAtT(robotPathT)
  const update   = rotation !== null ? { lngLat, rotation } : { lngLat }
  robotController.updateRobot('slam-robot-01', update)

  rafId = robotPathT < ROBOT_PATH_GPS.length - 1
    ? requestAnimationFrame(robotAnimTick)
    : 0
}

function startRobotAnim() {
  if (rafId) cancelAnimationFrame(rafId)
  robotLastTs = 0
  rafId = requestAnimationFrame(robotAnimTick)
}

// ─── 应用指定 stage（只更新 BMP 画布，机器人由 RAF 独立驱动）────────────
async function applyStage(stage) {
  const img = await loadStageImage(stage)
  drawStageToCanvas(img)
}

// ─── 推进 BMP 帧（自动 & 手动共用）──────────────────────────────────────
let _lastFrameTs = 0   // 上一次推帧的时间戳

async function advanceFrame(source = 'auto') {
  if (!isPlaying.value || isDone.value) return

  const now = Date.now()
  const gap = _lastFrameTs > 0 ? now - _lastFrameTs : 0
  _lastFrameTs = now

  const next = currentStage.value + 1

  if (next > TOTAL_STAGES) {
    isDone.value = true
    clearTimeout(timerId); timerId = null
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0 }
    // eslint-disable-next-line no-console
    console.log(`[SLAM] 建图完成，共 ${TOTAL_STAGES} 帧`)
    return
  }

  lastIntervalMs.value = gap

  currentStage.value = next
  const imgStart = Date.now()
  await applyStage(next)
  const imgMs = Date.now() - imgStart

  // eslint-disable-next-line no-console
  console.log(
    `[SLAM] stage ${String(next).padStart(2, '0')}/${TOTAL_STAGES}` +
    `  [${source === 'auto' ? '自动' : '手动'}]` +
    (gap > 0 ? `  间隔: ${gap}ms` : '  (首帧)') +
    `  图片渲染: ${imgMs}ms`
  )

  preloadAhead(next, 5)
}

// 手动点击下一帧
function nextFrame() { advanceFrame('manual') }

// ─── 自动推帧定时器循环（按录制时间轴推进）──────────────────────────────
function scheduleAutoNext() {
  clearTimeout(timerId)
  // 当前 stage → 下一 stage 的录制间隔；超出录制范围则用输入框兜底
  const delay = RECORDED_INTERVALS[currentStage.value - 1] ?? autoIntervalMs.value
  timerId = setTimeout(async () => {
    if (!isPlaying.value || !autoPlay.value || isDone.value) return
    await advanceFrame('auto')
    if (isPlaying.value && autoPlay.value && !isDone.value) scheduleAutoNext()
  }, delay)
}

// 切换自动/手动模式时响应
watch(autoPlay, (val) => {
  if (val && isPlaying.value && !isDone.value) {
    _lastFrameTs = 0
    scheduleAutoNext()
  } else {
    clearTimeout(timerId); timerId = null
  }
})

// ─── 控制：开始播放 ────────────────────────────────────────────────────────
function startPlay() {
  if (!mapReady.value) return
  isPlaying.value = true
  isDone.value    = false
  if (startTs === 0) startTs = Date.now() - elapsedMs.value
  startRobotAnim()
  if (autoPlay.value) { _lastFrameTs = 0; scheduleAutoNext() }
}

// ─── 控制：开始 / 暂停 ────────────────────────────────────────────────────
function togglePlay() {
  if (isDone.value) { resetPlay(); startPlay(); return }
  if (isPlaying.value) {
    isPlaying.value = false
    clearTimeout(timerId); timerId = null
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0 }
  } else {
    startPlay()
  }
}

// ─── 控制：重置 ────────────────────────────────────────────────────────────
async function resetPlay() {
  clearTimeout(timerId); timerId = null
  if (rafId) { cancelAnimationFrame(rafId); rafId = 0 }
  isPlaying.value    = false
  isDone.value       = false
  currentStage.value = 1
  elapsedMs.value    = 0
  lastIntervalMs.value = 0
  startTs            = 0
  robotPathT         = 0
  robotLastTs        = 0
  _lastFrameTs       = 0
  await applyStage(1)
  if (robotController) {
    const lngLat   = getGPSAtT(0)
    const rotation = getRotationAtT(0) ?? 0
    robotController.updateRobot('slam-robot-01', { lngLat, rotation })
  }
}

// ─── 适应地图视图 ──────────────────────────────────────────────────────────
function zoomToFit() {
  if (!mapInst || !cameraBound) return
  mapInst.jumpTo(cameraBound)
}

// ─── 地图初始化 ────────────────────────────────────────────────────────────
async function initMap() {
  await bicMap.init()

  mapInst = bicMap.createMap({
    container: 'buildMap',
    center:    [116.4074, 39.9042],
    zoom:      18,
    backgroundColor: '#a6a6a6',
  })

  bicMap.addZoomControl(mapInst, 'bottom-right')

  mapInst.on('load', async () => {
    // 1. 预加载前 5 帧
    preloadAhead(0, 5)

    // 2. 用第一帧初始化地图 canvas source
    const result = await bicMap.loadSlamMap(mapInst, {
      startX:      MAP_START_X,
      startY:      MAP_START_Y,
      xGridCount:  MAP_X_GRID_COUNT,
      yGridCount:  MAP_Y_GRID_COUNT,
      resolution:  MAP_RESOLUTION,
      imagePath:   STAGE_URLS[0],
      canvasId:    CANVAS_ID,
      fitBounds:   true,
    })

    cameraBound = result.cameraBound

    // 3. 添加机器人标记
    const initPos = getRobotGPS(1)
    if (initPos) {
      const initRotation = getRobotRotation(1) ?? 0
      robotController = bicMap.addRobotMarkers(mapInst, [
        { id: 'slam-robot-01', name: '建图机器人', lngLat: initPos, rotation: initRotation },
      ], { size: 32, showLabels: true })
    }

    mapReady.value = true
    preloadAhead(1, 8)
  })
}

// ─── 生命周期 ──────────────────────────────────────────────────────────────
onMounted(() => { initMap() })

onBeforeUnmount(() => {
  clearTimeout(timerId)
  if (rafId) cancelAnimationFrame(rafId)
  if (mapInst) { mapInst.remove(); mapInst = null }
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

.map-container {
  position: absolute;
  inset: 12px;
  border-radius: 16px;
  overflow: hidden;
  background: rgb(129 182 220 / 49%);
  box-shadow: 0 4px 30px rgba(14, 165, 233, 0.06), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;
}

.map-gl {
  width: 100%;
  height: 100%;
}

// ─── 状态面板 ───────────────────────────────────────────────────────────────
.status-panel {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 30;
  min-width: 216px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(10, 20, 45, 0.78);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(0, 200, 255, 0.22);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  color: #c8eeff;
  font-size: 12px;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #475569;
  flex-shrink: 0;
  transition: background 0.3s;

  &.active {
    background: #00d4ff;
    box-shadow: 0 0 8px rgba(0, 212, 255, 0.8);
    animation: pulse-dot 1.2s ease-in-out infinite;
  }

  &.done {
    background: #22d3ee;
    box-shadow: 0 0 8px rgba(34, 211, 238, 0.7);
  }
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}

.status-label {
  font-size: 12px;
  font-weight: 600;
  color: #7dd3fc;
  letter-spacing: 0.06em;
}

// 进度条
.progress-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.progress-bar {
  flex: 1;
  height: 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  position: relative;
  overflow: hidden;
  background: linear-gradient(to right, #0ea5e9, #22d3ee);
  transition: width 0.25s linear;
}

.progress-shine {
  position: absolute;
  top: 0;
  left: -60%;
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent);
  animation: shine 1.8s linear infinite;
}

@keyframes shine {
  0%   { left: -60%; }
  100% { left: 110%; }
}

.progress-pct {
  font-size: 11px;
  font-weight: 700;
  color: #38bdf8;
  min-width: 36px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

// 帧数行
.stage-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 10px;
  color: #94a3b8;
  font-size: 11px;
}

.stage-label { color: #64748b; }

.stage-num {
  font-size: 20px;
  font-weight: 700;
  color: #e0f6ff;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.stage-sep,
.stage-total { color: #64748b; font-size: 11px; }

// 统计行
.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-item {
  text-align: center;
  flex: 1;
}

.stat-val {
  font-size: 13px;
  font-weight: 700;
  color: #e0f6ff;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.stat-lbl {
  font-size: 10px;
  color: #64748b;
  margin-top: 2px;
}

.stat-divider {
  width: 1px;
  height: 28px;
  background: rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

// ─── Footer 工具栏 ──────────────────────────────────────────────────────────
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 20px;
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
  transition: all 0.25s ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px) scale(1.03);
    border-color: rgba(14, 165, 233, 0.35);
    box-shadow: 0 4px 15px rgba(14, 165, 233, 0.1);
  }

  &:active:not(:disabled) { transform: scale(0.97); }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.btn-primary {
  background: linear-gradient(135deg, #1a94f0, #38bdf8);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #fff;
  box-shadow: 0 4px 15px rgba(14, 165, 233, 0.3);

  &.danger {
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #b91c1c;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.06);
  }
}

// ─── 下一帧按钮 ─────────────────────────────────────────────────────────────

// ─── 自动更新帧控件 ──────────────────────────────────────────────────────────
.auto-play-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  height: 34px;
  border-radius: 10px;
  border: 1px solid rgba(14, 165, 233, 0.2);
  background: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;

  input[type='checkbox'] {
    width: 14px;
    height: 14px;
    accent-color: #1a94f0;
    cursor: pointer;
    flex-shrink: 0;
  }

  span {
    font-size: 13px;
    font-weight: 600;
    color: #374151;
  }

  &:has(input:checked) {
    border-color: rgba(14, 165, 233, 0.45);
    background: rgba(26, 148, 240, 0.08);
    span { color: #0369a1; }
  }
}

.interval-inline {
  display: flex;
  align-items: center;
  gap: 4px;
}

.interval-num {
  width: 60px;
  height: 34px;
  padding: 0 8px;
  border-radius: 8px;
  border: 1px solid rgba(14, 165, 233, 0.25);
  background: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  font-weight: 600;
  color: #0369a1;
  text-align: center;
  font-variant-numeric: tabular-nums;
  outline: none;

  &:focus { border-color: #1a94f0; box-shadow: 0 0 0 2px rgba(26, 148, 240, 0.15); }
  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button { -webkit-appearance: none; }
}

.interval-unit {
  font-size: 11px;
  color: #94a3b8;
}

// ─── 左上角常驻缩略图 ────────────────────────────────────────────────────────
.thumb-hint {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 100;
  width: 130px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(14, 165, 233, 0.22);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);
  cursor: pointer;
  overflow: hidden;
  transition: box-shadow 0.2s, transform 0.2s;
  backdrop-filter: blur(6px);

  &:hover {
    box-shadow: 0 6px 24px rgba(14, 165, 233, 0.28);
    transform: translateY(-1px);

    .thumb-expand { opacity: 1; }
  }
}

.thumb-label {
  font-size: 11px;
  font-weight: 700;
  color: #0369a1;
  letter-spacing: 0.04em;
  padding: 6px 8px 4px;
  text-transform: uppercase;
}

.thumb-img {
  display: block;
  width: 100%;
  height: auto;
}

.thumb-expand {
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: rgba(14, 165, 233, 0.82);
  text-align: center;
  padding: 4px 0;
  opacity: 0;
  transition: opacity 0.18s;
  letter-spacing: 0.05em;
}

// ─── 全屏灯箱 ────────────────────────────────────────────────────────────────
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 500;
  background: rgba(0, 0, 0, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(3px);
}

.lb-panel {
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  max-width: min(780px, 92vw);
  max-height: 90vh;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
}

.lb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
  border-bottom: 1px solid rgba(14, 165, 233, 0.15);
  flex-shrink: 0;
}

.lb-title {
  font-size: 14px;
  font-weight: 700;
  color: #0369a1;
  letter-spacing: 0.01em;
}

.lb-close {
  width: 30px;
  height: 30px;
  border: none;
  background: rgba(14, 165, 233, 0.12);
  border-radius: 8px;
  color: #0369a1;
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;

  &:hover { background: rgba(14, 165, 233, 0.25); }
}

.lb-body {
  overflow-y: auto;
  padding: 16px;

  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-thumb { background: rgba(14, 165, 233, 0.3); border-radius: 3px; }
}

.lb-img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 8px;
}

// ─── 灯箱淡入动画 ─────────────────────────────────────────────────────────────
.lb-fade-enter-active,
.lb-fade-leave-active {
  transition: opacity 0.2s ease;
  .lb-panel { transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1); }
}
.lb-fade-enter-from,
.lb-fade-leave-to {
  opacity: 0;
  .lb-panel { transform: scale(0.93); }
}
</style>
