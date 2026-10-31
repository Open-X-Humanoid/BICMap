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

          <div class="hud-legend-row">
            <span class="hud-label">内置场景</span>
          </div>
          <div class="hud-modes">
            <button
              v-for="preset in SCENE_PRESETS"
              :key="preset.id"
              class="hud-mode"
              :class="{ 'hud-mode--active': preset.id === activeSceneId }"
              :disabled="loading"
              @click="loadScene(preset.id)"
            >
              {{ preset.label }}
            </button>
          </div>

          <div class="hud-divider"></div>

          <div class="hud-row">
            <span class="hud-label">文件</span>
            <span class="hud-value hud-value--ellipsis" :title="fileName">{{ fileName || '-' }}</span>
          </div>
          <div v-if="isWorldScene" class="hud-row">
            <span class="hud-label">地理锚点</span>
            <span class="hud-value hud-value--ellipsis" :title="anchorText">{{ anchorText }}</span>
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

        <!-- 合规声明挂在地图上而不是 HUD 里：HUD 内容超高会滚动，声明会被折到看不见的地方 -->
        <div v-if="isWorldScene" class="map-legal">
          <div class="map-legal__title">⚠ 合规声明</div>
          <p>
            底图为 <strong>OpenStreetMap</strong> 第三方公开瓦片服务，<strong>仅供示例演示</strong>，不得用于生产环境；使用须遵守
            ODbL 协议并保留归因信息。
          </p>
          <p>在中国境内使用网络地图服务须取得相应<strong>测绘资质</strong>，并确保符合《测绘法》坐标系要求。</p>
          <p>叠加的点云由程序<strong>模拟生成</strong>，非真实采集数据，不代表现场实际地物。</p>
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

import intersectionPcdUrl from './samples/intersection.pcd?url'
import campusPcdUrl from './samples/samples.pcd?url'
import bicMap from '../../../bicMap/core/bicmap-gl'
import {
  ALIGN_STEP,
  BASEMAP,
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
  OSM_ATTRIBUTION,
  OSM_MAX_ZOOM,
  OSM_TILES,
  PLACEMENT,
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
import { placeOnWorldMap, worldSceneBounds } from './worldPlacement'

const SCENE_PCD_URLS = { campus: campusPcdUrl, intersection: intersectionPcdUrl }
const DEFAULT_SCENE = SCENE_PRESETS[0]

// 对齐参数一变就要重投影全部点位，拖动滑块时做一次合并，避免每帧重算
const ALIGN_DEBOUNCE_MS = 150
const MAP_FIT_PADDING = 30
const SLAM_BOUNDS = slamMapBounds()

// createPointCloud3D 内部固定用这个图层 id，底图必须插在它下面才不会盖住点云
const CLOUD_LAYER_ID = 'point-cloud-3d-layer'
const OSM_SOURCE_ID = 'pcd-osm-source'
const OSM_LAYER_ID = 'pcd-osm-layer'

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
const activeSceneId = ref('')
// 决定摆放模式、锚点与底图。导入本地文件时保持不变，这样自带的 PCD
// 也能直接落在当前场景（例如叠在 OSM 底图的真实路口上）
const activeScene = ref(DEFAULT_SCENE)

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

const isWorldScene = computed(() => activeScene.value?.placement === PLACEMENT.WORLD)

const anchorText = computed(() => {
  const anchor = activeScene.value?.anchor
  return anchor ? `${anchor.lng.toFixed(6)}, ${anchor.lat.toFixed(6)}` : '-'
})

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

/** 创建地图容器。底图由场景决定：SLAM 场景留空，世界地图场景挂 OSM 栅格瓦片 */
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
    antialias: true,
    // 栅格瓦片相关：关掉淡入并放开并发，切到世界地图场景时出图更快
    fadeDuration: 0,
    maxParallelImageRequests: 32
  })
  bicMap.addZoomControl(map, 'bottom-right')

  await new Promise((resolve) => map.on('load', resolve))
  applyView({ animate: false })

  loading.value = false
}

/**
 * 按场景切换底图。OSM 瓦片必须插在点云图层下面，否则会把点云整个盖住。
 * @param {object} [preset] 场景预设
 */
function applyBasemap(preset) {
  if (!map) return

  if (map.getLayer(OSM_LAYER_ID)) map.removeLayer(OSM_LAYER_ID)
  if (map.getSource(OSM_SOURCE_ID)) map.removeSource(OSM_SOURCE_ID)

  if (map.getLayer('background')) {
    map.setPaintProperty('background', 'background-color', preset?.background ?? BG_COLOR)
  }

  if (preset?.basemap !== BASEMAP.OSM) return

  map.addSource(OSM_SOURCE_ID, {
    type: 'raster',
    tiles: OSM_TILES,
    tileSize: 256,
    minzoom: 0,
    maxzoom: OSM_MAX_ZOOM,
    scheme: 'xyz',
    attribution: OSM_ATTRIBUTION
  })

  map.addLayer(
    {
      id: OSM_LAYER_ID,
      type: 'raster',
      source: OSM_SOURCE_ID,
      paint: {
        'raster-opacity': 1,
        'raster-fade-duration': 0,
        'raster-resampling': 'linear'
      }
    },
    map.getLayer(CLOUD_LAYER_ID) ? CLOUD_LAYER_ID : undefined
  )
}

/**
 * 加载内置场景点云。XY 用点云自带坐标，离地高度用场景预设。
 * @param {object} [preset] 场景预设
 */
async function loadScenePcd(preset = DEFAULT_SCENE) {
  loading.value = true
  errorText.value = ''
  loadingText.value = '正在下载场景点云…'

  const url = SCENE_PCD_URLS[preset.id]
  const response = await fetch(url)
  if (!response.ok) throw new Error(`场景点云下载失败：${response.status}`)
  sourceBuffer = await response.arrayBuffer()
  fileName.value = url.split('/').pop()

  activeScene.value = preset
  activeSceneId.value = preset.id
  // 场景可以指定默认着色模式；放在这里而不是 renderBuffer 里，
  // 滤波参数变化时才不会把用户手动选的模式顶掉
  colorMode.value = preset.colorMode ?? DEFAULT_COLOR_MODE
  applyBasemap(preset)
  resetAlign()
  await renderBuffer()
}

/**
 * 切换内置场景
 * @param {string} id 场景 id
 */
async function loadScene(id) {
  if (loading.value || id === activeSceneId.value) return
  const preset = SCENE_PRESETS.find((item) => item.id === id)
  if (!preset) return
  try {
    await loadScenePcd(preset)
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
    // 只取消场景高亮，摆放模式与底图沿用当前场景
    activeSceneId.value = ''
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

/** 按当前对齐参数把点云投到地图上，SLAM 场景走栅格压缩，世界地图场景按 1:1 米制落到真实锚点 */
function renderMapCloud() {
  if (!map || !cloud) return

  const scene = activeScene.value
  const placed =
    scene?.placement === PLACEMENT.WORLD
      ? placeOnWorldMap(cloud, align, activeColors, scene.anchor)
      : placeOnSlamMap(cloud, align, activeColors)
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

  const scene = activeScene.value
  const bounds =
    scene?.placement === PLACEMENT.WORLD && cloud
      ? worldSceneBounds(cloud, align, scene.anchor)
      : SLAM_BOUNDS
  const view = { ...MAP_VIEW, ...(scene?.view ?? {}) }

  const camera = map.cameraForBounds(bounds, { padding: MAP_FIT_PADDING })
  if (!camera) return

  const next = {
    ...camera,
    pitch: view.pitch,
    bearing: view.bearing
  }
  if (view.zoom != null) next.zoom = view.zoom

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
  const preset = SCENE_PRESETS.find((item) => item.id === activeSceneId.value)
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

.map-legal {
  position: absolute;
  left: 18px;
  bottom: 18px;
  z-index: 30;
  max-width: 430px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid rgba(244, 208, 63, 0.55);
  border-left-width: 3px;
  background: rgba(5, 18, 48, 0.86);
  backdrop-filter: blur(14px);
  box-shadow: 0 6px 24px rgba(0, 20, 80, 0.35);
  font-size: 11.5px;
  line-height: 1.6;
  color: rgba(232, 220, 182, 0.9);
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;

  .map-legal__title {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #f6d97a;
  }

  p {
    margin: 0;

    strong {
      font-weight: 600;
      color: #ffe9a8;
    }
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
