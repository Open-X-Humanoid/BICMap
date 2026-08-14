<!--
 * @Description: PCD 点云示例。空白地图上叠加 three.js 点云，可导入本地 PCD。
 * @FilePath: src/examples/expand/PcdViewer/index.vue
-->
<template>
  <div class="app-root">
    <AppHeader title="PCD点云加载" />

    <main class="viewer-area">
      <div class="grid-bg"></div>

      <div class="viewer-container">
        <div id="pcdSlamMap" class="viewer-surface"></div>

        <div v-if="loading" class="viewer-mask">
          <span class="viewer-mask__spinner"></span>
          <span>{{ loadingText }}</span>
        </div>

        <div v-else-if="errorText" class="viewer-mask viewer-mask--error">{{ errorText }}</div>

        <div class="hud-panel">
          <div class="hud-title">
            <span class="hud-bar"></span>
            点云信息
          </div>

          <!-- <div class="hud-legend-row">
            <span class="hud-label">内置场景</span>
          </div>
          <div class="hud-modes">
            <button
              v-for="preset in scenePresets"
              :key="preset.url"
              class="hud-mode"
              :class="{ 'hud-mode--active': preset.url === activeSceneUrl }"
              :disabled="loading"
              @click="loadScene(preset.url)"
            >
              {{ preset.label }}
            </button>
          </div> -->

          <div class="hud-divider"></div>

          <div class="hud-row">
            <span class="hud-label">文件</span>
            <span class="hud-value hud-value--ellipsis" :title="fileName">{{ fileName || '-' }}</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">存储格式</span>
            <span class="hud-value">{{ stats.dataType }}</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">字段</span>
            <span class="hud-value hud-value--ellipsis">{{ stats.fields }}</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">原始点数</span>
            <span class="hud-value">{{ formatCount(stats.rawCount) }}</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">渲染点数</span>
            <span class="hud-value" :class="{ 'hud-value--accent': isDownsampled }">
              {{ formatCount(renderedCount) }}
            </span>
          </div>
          <div class="hud-row">
            <span class="hud-label">解析耗时</span>
            <span class="hud-value">{{ stats.cost }} ms</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">包围盒</span>
            <span class="hud-value">{{ stats.size }}</span>
          </div>

          <p v-if="strideTip" class="hud-tip">{{ strideTip }}</p>

          <div class="hud-divider"></div>

          <div class="hud-slider">
            <label>点大小</label>
            <input
              v-model.number="pointSize"
              type="range"
              :min="MIN_POINT_SIZE"
              :max="MAX_POINT_SIZE"
              :step="POINT_SIZE_STEP"
            />
            <span>{{ pointSize.toFixed(1) }}px</span>
          </div>

          <div class="hud-legend-row">
            <span class="hud-label">着色模式</span>
          </div>
          <div class="hud-modes">
            <button
              v-for="mode in colorModes"
              :key="mode"
              class="hud-mode"
              :class="{ 'hud-mode--active': mode === colorMode }"
              @click="changeColorMode(mode)"
            >
              {{ COLOR_MODE_LABEL[mode] }}
            </button>
          </div>

          <div v-if="colorMode === COLOR_MODE.HEIGHT" class="hud-gradient-bar">
            <span>{{ stats.zMin }}</span>
            <div class="gradient-strip" :style="{ background: heightLegend }"></div>
            <span>{{ stats.zMax }}</span>
          </div>

          <div class="hud-divider"></div>

          <div class="hud-slider">
            <label>体素降采样</label>
            <input
              v-model.number="leafSize"
              type="range"
              min="0"
              :max="MAX_LEAF_SIZE"
              :step="LEAF_SIZE_STEP"
              :disabled="loading"
              @change="reprocess"
            />
            <span>{{ leafSize > 0 ? `${leafSize.toFixed(2)}m` : '关闭' }}</span>
          </div>

          <label class="hud-check">
            <input v-model="denoise" type="checkbox" :disabled="loading" @change="reprocess" />
            统计离群点去除
          </label>

          <div class="hud-divider"></div>
<!-- 
          <div class="hud-legend-row">
            <span class="hud-label">对齐到 SLAM</span>
            <span class="hud-links">
              <button class="hud-link" @click="resetAlign">复位</button>
            </span>
          </div>

          <div class="hud-slider">
            <label>东向 X</label>
            <input
              v-model.number="align.x"
              type="range"
              :min="OFFSET_X_RANGE[0]"
              :max="OFFSET_X_RANGE[1]"
              :step="ALIGN_STEP"
            />
            <span>{{ align.x.toFixed(1) }}m</span>
          </div> -->

          <!-- <div class="hud-slider">
            <label>北向 Y</label>
            <input
              v-model.number="align.y"
              type="range"
              :min="OFFSET_Y_RANGE[0]"
              :max="OFFSET_Y_RANGE[1]"
              :step="ALIGN_STEP"
            />
            <span>{{ align.y.toFixed(1) }}m</span>
          </div>

          <div class="hud-slider">
            <label>离地高度</label>
            <input
              v-model.number="align.z"
              type="range"
              :min="HEIGHT_RANGE[0]"
              :max="HEIGHT_RANGE[1]"
              :step="HEIGHT_STEP"
            />
            <span>{{ align.z.toFixed(1) }}m</span>
          </div>

          <div class="hud-slider">
            <label>绕 Z 旋转</label>
            <input v-model.number="align.rotation" type="range" min="0" max="360" :step="ROTATION_STEP" />
            <span>{{ align.rotation }}°</span>
          </div>

          <div class="hud-slider">
            <label>缩放</label>
            <input
              v-model.number="align.scale"
              type="range"
              :min="SCALE_RANGE[0]"
              :max="SCALE_RANGE[1]"
              :step="SCALE_STEP"
            />
            <span>{{ align.scale.toFixed(1) }}×</span>
          </div> -->
        </div>
      </div>
    </main>

    <input ref="fileInput" type="file" accept=".pcd" class="file-input" @change="openLocalFile" />

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { Eye, EyeOff, FolderOpen, Maximize } from 'lucide-vue-next'

import AppFooter from '../../components/AppFooter.vue'
import AppHeader from '../../components/AppHeader.vue'

import campusPcdUrl from './samples/samples.pcd?url'
import bicMap from '../../../bicMap/core/bicmap-gl'
import {
  ALIGN_STEP,
  BG_COLOR,
  COLOR_MODE,
  COLOR_MODE_LABEL,
  DEFAULT_ALIGN,
  DEFAULT_COLOR_MODE,
  DEFAULT_LEAF_SIZE,
  DEFAULT_POINT_SIZE,
  HEIGHT_COLOR_STOPS,
  HEIGHT_RANGE,
  HEIGHT_STEP,
  LEAF_SIZE_STEP,
  MAP_VIEW,
  MAX_LEAF_SIZE,
  MAX_POINT_SIZE,
  MIN_POINT_SIZE,
  OFFSET_X_RANGE,
  OFFSET_Y_RANGE,
  POINT_SIZE_STEP,
  ROTATION_STEP,
  SCALE_RANGE,
  SCALE_STEP,
  SCENE_PRESETS,
  SINGLE_COLOR,
  SLAM_CENTER
} from './constants'
import { parsePcd } from './pclLoader'
import { availableColorModes, buildColors } from './pointColors'
import { placeOnSlamMap, slamMapBounds, slamToLngLat } from './slamPlacement'

const SCENE_PCD_URLS = { campus: campusPcdUrl }
const scenePresets = SCENE_PRESETS.map((preset) => ({
  ...preset,
  url: SCENE_PCD_URLS[preset.id]
}))
const SCENE_PCD_URL = scenePresets[0].url

// 对齐参数一变就要重投影全部点位，拖动滑块时做一次合并，避免每帧重算
const ALIGN_DEBOUNCE_MS = 150
const MAP_FIT_PADDING = 30
const SLAM_BOUNDS = slamMapBounds()

const fileInput = ref(null)

const loading = ref(false)
const loadingText = ref('正在初始化 PCL 运行时…')
const errorText = ref('')
const fileName = ref('')

const pointSize = ref(DEFAULT_POINT_SIZE)
const leafSize = ref(DEFAULT_LEAF_SIZE)
const denoise = ref(false)
const colorMode = ref(DEFAULT_COLOR_MODE)
const colorModes = ref([COLOR_MODE.RGB, COLOR_MODE.HEIGHT, COLOR_MODE.SINGLE])
const cloudVisible = ref(true)
const align = reactive({ ...DEFAULT_ALIGN })

const renderedCount = ref(0)
const mapStride = ref(1)
// 导入本地文件后置空，内置场景按钮就不会有高亮项
const activeSceneUrl = ref('')

const stats = reactive({
  rawCount: 0,
  cost: 0,
  dataType: '-',
  fields: '-',
  size: '-',
  zMin: '-',
  zMax: '-'
})

// 点云数据与渲染器都不进响应式系统：TypedArray 很大，代理化只会拖慢遍历
let cloud = null
let activeColors = null
let sourceBuffer = null
let map = null
let mapCloud = null
let alignTimer = null

const heightLegend = `linear-gradient(to right, ${HEIGHT_COLOR_STOPS.map(([, color]) => color).join(', ')})`

const isDownsampled = computed(() => stats.rawCount > 0 && renderedCount.value < stats.rawCount)

const strideTip = computed(() => {
  if (mapStride.value <= 1) return ''
  return `点数过多，已按 1/${mapStride.value} 抽稀显示；开启体素降采样可保留全部细节`
})

const footerButtons = computed(() => [
  { label: '导入 PCD 文件', icon: FolderOpen, disabled: loading.value, onClick: pickLocalFile },
  { label: '重置视角', icon: Maximize, onClick: resetView }
])

watch(pointSize, (size) => {
  mapCloud?.update(null, { pointSize: size })
})

watch(align, () => {
  clearTimeout(alignTimer)
  alignTimer = setTimeout(() => renderMapCloud(), ALIGN_DEBOUNCE_MS)
})

onMounted(async () => {
  try {
    await nextTick()
    await initMap()
    await loadScenePcd()
  } catch (error) {
    fail(error)
  }
})

onBeforeUnmount(() => {
  clearTimeout(alignTimer)
  mapCloud?.remove()
  mapCloud = null
  map?.remove()
  map = null
  cloud = null
  sourceBuffer = null
})

/** 创建空白地图，只用来承载点云，不加载 SLAM 栅格底图 */
async function initMap() {
  loadingText.value = '正在初始化地图…'
  loading.value = true

  await bicMap.init()
  map = bicMap.createMap({
    container: 'pcdSlamMap',
    center: slamToLngLat(SLAM_CENTER),
    zoom: MAP_VIEW.zoom ?? 18,
    pitch: MAP_VIEW.pitch,
    bearing: MAP_VIEW.bearing,
    backgroundColor: BG_COLOR,
    antialias: true
  })
  bicMap.addZoomControl(map, 'bottom-right')

  await new Promise((resolve) => map.on('load', resolve))
  applyView({ animate: false })

  loading.value = false
}

/**
 * 加载内置场景点云。XY 用文件自带坐标，离地高度用场景预设（压到和平面底图共面）。
 * @param {string} url 场景 PCD 地址
 */
async function loadScenePcd(url = SCENE_PCD_URL) {
  loading.value = true
  errorText.value = ''
  loadingText.value = '正在下载场景点云…'

  const response = await fetch(url)
  if (!response.ok) throw new Error(`场景点云下载失败：${response.status}`)

  sourceBuffer = await response.arrayBuffer()
  fileName.value = url.split('/').pop()
  activeSceneUrl.value = url
  resetAlign()
  await renderBuffer()
}

/**
 * 切换内置场景
 * @param {string} url 场景 PCD 地址
 */
async function loadScene(url) {
  if (loading.value || url === activeSceneUrl.value) return
  try {
    await loadScenePcd(url)
  } catch (error) {
    fail(error)
  }
}

/** 打开系统文件选择框 */
function pickLocalFile() {
  fileInput.value?.click()
}

/**
 * 读取用户选择的本地 .pcd 文件
 * @param {Event} event input[type=file] 的 change 事件
 */
async function openLocalFile(event) {
  const file = event.target.files?.[0]
  // 重置 input，保证连续选择同一个文件也能触发 change
  event.target.value = ''
  if (!file) return

  try {
    loading.value = true
    errorText.value = ''
    loadingText.value = '正在读取本地文件…'
    sourceBuffer = await file.arrayBuffer()
    fileName.value = file.name
    activeSceneUrl.value = ''
    resetAlign()
    await renderBuffer()
  } catch (error) {
    fail(error)
  }
}

/** 滤波参数变化后基于已有数据重新解析 */
async function reprocess() {
  if (!sourceBuffer || loading.value) return
  try {
    loading.value = true
    errorText.value = ''
    await renderBuffer()
  } catch (error) {
    fail(error)
  }
}

/** 走一遍 PCL 解析管线，并把结果投到地图上 */
async function renderBuffer() {
  loadingText.value = '正在解析点云…'
  // WASM 解析是同步的，先让 loading 态完成一次绘制，否则整段过程界面都是卡住的
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))

  cloud = await parsePcd(sourceBuffer, { leafSize: leafSize.value, denoise: denoise.value })

  colorModes.value = availableColorModes(cloud)
  if (!colorModes.value.includes(colorMode.value)) colorMode.value = COLOR_MODE.HEIGHT

  updateStats(cloud)
  applyCloud()
  loading.value = false
}

/** 重算着色并把当前点云投到地图上 */
function applyCloud() {
  if (!cloud) return
  activeColors = buildColors(cloud, colorMode.value)
  renderMapCloud()
  resetView()
}

/** 按当前对齐参数把点云投到 SLAM 地图上 */
function renderMapCloud() {
  if (!map || !cloud) return

  const placed = placeOnSlamMap(cloud, align, activeColors)
  mapStride.value = placed.stride
  renderedCount.value = placed.points.length

  const options = {
    pointSize: pointSize.value,
    pointColor: SINGLE_COLOR,
    pointOpacity: 0.95,
    useColorMap: false,
    colors: placed.colors,
    visible: cloudVisible.value
  }

  if (mapCloud) mapCloud.update(placed.points, options)
  else mapCloud = bicMap.createPointCloud3D(map, placed.points, options)
}

/** 切换点云图层显隐，底图保持不动 */
function toggleCloudVisible() {
  cloudVisible.value = !cloudVisible.value
  if (cloudVisible.value) mapCloud?.show()
  else mapCloud?.hide()
}

/**
 * 套上 MAP_VIEW 的俯仰 / 旋转 / 缩放。
 * @param {{ animate?: boolean }} [options]
 */
function applyView({ animate = true } = {}) {
  if (!map) return
  const camera = map.cameraForBounds(SLAM_BOUNDS, { padding: MAP_FIT_PADDING })
  if (!camera) return

  const next = {
    ...camera,
    pitch: MAP_VIEW.pitch,
    bearing: MAP_VIEW.bearing
  }
  if (MAP_VIEW.zoom != null) next.zoom = MAP_VIEW.zoom

  if (animate) map.easeTo({ ...next, duration: 800 })
  else map.jumpTo(next)
}

/**
 * 相机回到底图正中央，并恢复配置的初始视角
 */
function resetView() {
  applyView({ animate: true })
}

/**
 * 切换着色模式
 * @param {string} mode COLOR_MODE 之一
 */
function changeColorMode(mode) {
  colorMode.value = mode
  activeColors = buildColors(cloud, mode)
  renderMapCloud()
}

/** 对齐参数回到当前场景的默认值（内置场景带离地高度，外部文件清零） */
function resetAlign() {
  const preset = scenePresets.find((item) => item.url === activeSceneUrl.value)
  Object.assign(align, DEFAULT_ALIGN, preset?.align ?? {})
}

/** 把点云整体平移到 SLAM 底图中心，用于坐标系完全对不上的外部 PCD */
function centerOnSlam() {
  if (!cloud) return
  const radians = (align.rotation * Math.PI) / 180
  const [localX, localY] = cloud.bounds.center
  const scaledX = localX * align.scale
  const scaledY = localY * align.scale

  align.x = round(SLAM_CENTER[0] - (scaledX * Math.cos(radians) - scaledY * Math.sin(radians)))
  align.y = round(SLAM_CENTER[1] - (scaledX * Math.sin(radians) + scaledY * Math.cos(radians)))
}

/**
 * 同步 HUD 面板展示的点云统计信息
 * @param {object} parsed parsePcd 的返回值
 */
function updateStats(parsed) {
  const { bounds } = parsed
  stats.rawCount = parsed.rawCount
  stats.cost = parsed.cost
  stats.dataType = parsed.dataType
  stats.fields = parsed.fields.join(' ') || '-'
  stats.size = bounds.size.map((value) => value.toFixed(1)).join(' × ')
  stats.zMin = `${bounds.min[2].toFixed(1)}m`
  stats.zMax = `${bounds.max[2].toFixed(1)}m`
}

/**
 * 统一的失败兜底
 * @param {unknown} error 捕获到的异常
 */
function fail(error) {
  loading.value = false
  errorText.value =
    error instanceof Error
      ? error.message
      : typeof error === 'number'
        ? `PCD 解析失败（PCL ${error}）`
        : String(error)
  console.error('加载 PCD 点云失败:', error)
}

/**
 * 点数千分位格式化
 * @param {number} value 点数
 * @returns {string}
 */
function formatCount(value) {
  return value.toLocaleString('en-US')
}

/**
 * 对齐到滑块步进，避免滑块因为小数尾巴显示成非整格
 * @param {number} value 米
 * @returns {number}
 */
function round(value) {
  return Math.round(value / ALIGN_STEP) * ALIGN_STEP
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

.viewer-area {
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

.viewer-container {
  position: absolute;
  inset: 12px;
  border-radius: 16px;
  overflow: hidden;
  background: #000;
  box-shadow:
    0 4px 30px rgba(14, 165, 233, 0.06),
    0 0 0 1px rgba(255, 255, 255, 0.8) inset;
}

.viewer-surface {
  width: 100%;
  height: 100%;
}

.file-input {
  display: none;
}

.viewer-mask {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(5, 18, 48, 0.62);
  backdrop-filter: blur(4px);
  color: #cfe4ff;
  font-size: 13px;
  letter-spacing: 0.08em;

  &--error {
    color: #ff9d9d;
  }

  &__spinner {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid rgba(120, 180, 255, 0.25);
    border-top-color: #67e8f9;
    animation: spin 0.8s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.hud-panel {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 30;
  width: 258px;
  max-height: calc(100% - 36px);
  overflow-y: auto;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(5, 18, 48, 0.8);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(80, 140, 255, 0.28);
  box-shadow: 0 6px 24px rgba(0, 20, 80, 0.35);
  color: #cfe4ff;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 9px;

  .hud-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.08em;
    color: #fff;
  }

  .hud-bar {
    width: 4px;
    height: 14px;
    border-radius: 2px;
    background: linear-gradient(180deg, #06b6d4 0%, #3b82f6 100%);
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
  }

  .hud-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .hud-label {
    color: #8eb4e6;
    flex-shrink: 0;
  }

  .hud-value {
    font-family: 'Space Mono', 'Courier New', monospace;
    color: #fff;

    &--accent {
      color: #67e8f9;
      text-shadow: 0 0 8px rgba(103, 232, 249, 0.5);
    }

    &--ellipsis {
      // flex 子项默认 min-width:auto，不重置就撑不出省略号
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .hud-tip {
    margin: 0;
    padding: 6px 8px;
    border-radius: 6px;
    background: rgba(244, 208, 63, 0.12);
    color: #f6d97a;
    line-height: 1.5;
  }

  .hud-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(120, 160, 220, 0.35) 50%, transparent 100%);
  }

  .hud-slider {
    display: flex;
    align-items: center;
    gap: 8px;

    label {
      width: 64px;
      color: #8eb4e6;
      flex-shrink: 0;
    }

    input[type='range'] {
      flex: 1;
      min-width: 0;
      accent-color: #3b82f6;
    }

    span {
      width: 48px;
      text-align: right;
      font-family: 'Space Mono', 'Courier New', monospace;
      color: #fff;
    }
  }

  .hud-check {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #8eb4e6;
    cursor: pointer;

    input {
      accent-color: #3b82f6;
    }
  }

  .hud-legend-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .hud-links {
    display: flex;
    gap: 10px;
  }

  .hud-link {
    padding: 0;
    border: none;
    background: none;
    color: #67e8f9;
    font-size: 11px;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }

  .hud-modes {
    display: flex;
    gap: 6px;
  }

  .hud-mode {
    flex: 1;
    padding: 5px 0;
    border-radius: 6px;
    border: 1px solid rgba(120, 160, 220, 0.3);
    background: rgba(20, 40, 80, 0.5);
    color: #8eb4e6;
    font-size: 11px;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s, background 0.2s;

    &:hover {
      color: #fff;
      border-color: rgba(103, 232, 249, 0.6);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &--active {
      color: #fff;
      border-color: #3b82f6;
      background: rgba(59, 130, 246, 0.35);
    }
  }

  .hud-gradient-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #8eb4e6;

    .gradient-strip {
      flex: 1;
      height: 8px;
      border-radius: 4px;
    }
  }
}
</style>
