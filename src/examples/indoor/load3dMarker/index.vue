<!--
 * @Description: 三维空间数据渲染示例——在三维 SLAM 场景中渲染空间数据点，
 *   点击 marker 在右侧面板显示该数据点的名称、空间坐标与详细信息
 * @FilePath: src/examples/indoor/space/index.vue
-->
<template>
  <div class="app-root">
    <canvas id="spaceCanvas" class="canvas-hidden"></canvas>

    <AppHeader title="三维空间数据渲染" />

    <!-- 操作提示条 -->
    <Transition name="hint-fade">
      <div v-if="ready && !selectedItem" class="hint-overlay">
        <div class="hint-pill">
          <MousePointerClick class="hint-icon" :size="15" />
          <span>点击三维场景中的数据点，查看其空间坐标与详细信息</span>
        </div>
      </div>
    </Transition>

    <main class="map-area">
      <div class="grid-bg"></div>

      <div class="map-container">
        <div id="spaceMap" class="map-gl"></div>

        <Transition name="fade">
          <div v-if="!ready" class="loading-overlay">
            <div class="loading-spinner"></div>
            <span class="loading-text">正在加载地图数据…</span>
          </div>
        </Transition>

        <SpatialInfoPanel :item="selectedItem" @close="clearSelection" />
      </div>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { Box, Eye, EyeOff, Map as MapIcon, MousePointerClick, RotateCcw } from 'lucide-vue-next'

import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'
import SpatialInfoPanel from './SpatialInfoPanel.vue'

import bicMap from '../../../bicMap/core/bicmap-gl.js'
import slamImage from '../../assets/slam_transparent.png'
import {
  FIT_ZOOM_BOOST,
  MAP_CONFIG,
  MARKER_ICON,
  SPATIAL_ITEMS,
  VIEW_PITCH_2D,
  VIEW_PITCH_3D,
  VIEW_TRANSITION_MS
} from './constants.js'

// ===== 响应式状态 =====
const ready = ref(false)
const selectedItem = ref(null)
const is3D = ref(true)
const showLabels = ref(true)

const footerButtons = computed(() => [
  {
    label: showLabels.value ? '隐藏名称' : '显示名称',
    active: showLabels.value,
    icon: showLabels.value ? EyeOff : Eye,
    onClick: toggleLabels,
    disabled: !ready.value
  }
])

// ===== 非响应式实例 =====
let map = null
let homeView = null              // fitBounds + 三维动画结束后的初始视角，用于复位
const markerMap = new Map()      // itemId → { marker, el }，maplibregl.Marker HTML 实例

// ===== 生命周期 =====
onMounted(initMap)

onBeforeUnmount(() => {
  for (const { marker } of markerMap.values()) marker.remove()
  markerMap.clear()
  map?.remove()
  map = null
})

// ===== 地图初始化 =====
async function initMap() {
  await bicMap.init()
  map = bicMap.createMap({
    container: 'spaceMap',
    center: MAP_CONFIG.center,
    zoom: MAP_CONFIG.zoom,
    backgroundColor: '#ffffff'
  })
  bicMap.addZoomControl(map, 'bottom-right')

  map.on('load', async () => {
    await loadSlamMap()
    enter3DView()
    renderMarkers()
    ready.value = true
  })
}

async function loadSlamMap() {
  await bicMap.loadSlamMap(map, {
    startX: MAP_CONFIG.startX,
    startY: MAP_CONFIG.startY,
    xGridCount: MAP_CONFIG.xGridCount,
    yGridCount: MAP_CONFIG.yGridCount,
    resolution: MAP_CONFIG.resolution,
    imagePath: slamImage,
    canvasId: 'spaceCanvas',
    fitBounds: true,
    zoomFactor: MAP_CONFIG.zoomFactor
  })
}

/** 进入默认三维视角，并记录初始视角用于复位 */
function enter3DView() {
  // fitBounds 的相机移动在 await loadSlamMap() 后通常已结束，再监听 moveend 会错过事件导致俯仰角不生效；
  // 这里在 fitBounds 落定后直接 easeTo 设置俯仰角，保证默认就带三维角度
  setTimeout(() => {
    if (!map) return
    map.easeTo({
      zoom: map.getZoom() + FIT_ZOOM_BOOST,
      pitch: VIEW_PITCH_3D,
      duration: VIEW_TRANSITION_MS
    })
    map.once('moveend', () => {
      homeView = { center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch() }
    })
  }, 80)
}

// ===== 坐标转换 =====
/**
 * SLAM 笛卡尔坐标转地图经纬度
 * @param {number} x 东向坐标（米）
 * @param {number} y 北向坐标（米）
 * @returns {[number, number]|null} [经度, 纬度]
 */
function cartesianToLngLat(x, y) {
  const Mu = window.MapUtils
  if (!Mu?.cartesianToGPS) return null
  const gps = Mu.cartesianToGPS({
    x, y,
    scale: MAP_CONFIG.resolution,
    zoomFactor: MAP_CONFIG.zoomFactor
  })
  return [gps.longitude, gps.latitude]
}

// ===== Marker 渲染（maplibregl.Marker HTML 元素，在三维俯视下billboard悬浮） =====
function renderMarkers() {
  const MapLibre = window.maplibregl
  if (!map || !MapLibre) return

  for (const item of SPATIAL_ITEMS) {
    const lngLat = cartesianToLngLat(item.coordinate.x, item.coordinate.y)
    if (!lngLat) continue

    const el = createMarkerEl({ ...item, lngLat })
    // anchor: 'bottom' → 元素底部的「落地阴影」对齐坐标点，徽标与名称悬浮其上，呈现三维站立效果
    const marker = new MapLibre.Marker({ element: el, anchor: 'bottom' })
      .setLngLat(lngLat)
      .addTo(map)

    markerMap.set(item.id, { marker, el })
  }
}

/**
 * 创建单个空间记忆 marker 的 HTML 元素
 * @param {Object} item 含 lngLat 的物品对象
 * @returns {HTMLElement} marker 根元素
 */
function createMarkerEl(item) {
  const el = document.createElement('div')
  el.className = 'sm-marker'
  if (!showLabels.value) el.classList.add('sm-marker--no-label')

  const pin = document.createElement('div')
  pin.className = 'sm-marker__pin'
  const img = document.createElement('img')
  img.src = MARKER_ICON
  img.alt = ''
  pin.appendChild(img)

  const label = document.createElement('div')
  label.className = 'sm-marker__label'
  label.textContent = item.name

  const pole = document.createElement('div')
  pole.className = 'sm-marker__pole'
  const base = document.createElement('div')
  base.className = 'sm-marker__base'

  el.append(pin, label, pole, base)
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    selectItem(item)
  })
  return el
}

// ===== 交互控制 =====
function selectItem(item) {
  selectedItem.value = item
  for (const [id, { el }] of markerMap) {
    el.classList.toggle('is-selected', id === item.id)
  }
}

function clearSelection() {
  selectedItem.value = null
  for (const { el } of markerMap.values()) el.classList.remove('is-selected')
}

function toggleDimension() {
  if (!map || !ready.value) return
  is3D.value = !is3D.value
  map.easeTo({
    pitch: is3D.value ? VIEW_PITCH_3D : VIEW_PITCH_2D,
    duration: VIEW_TRANSITION_MS
  })
}

function toggleLabels() {
  showLabels.value = !showLabels.value
  for (const { el } of markerMap.values()) {
    el.classList.toggle('sm-marker--no-label', !showLabels.value)
  }
}

function resetView() {
  if (!map || !homeView) return
  is3D.value = true
  map.flyTo({
    center: homeView.center,
    zoom: homeView.zoom,
    pitch: homeView.pitch,
    duration: VIEW_TRANSITION_MS
  })
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
  inset: 0;
  background: linear-gradient(160deg, #e8f4fc 0%, #eef1f8 30%, #f0f6fb 60%, #e6f0fa 100%);
}

.canvas-hidden { display: none; }

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
  border: 1px solid rgba(14, 165, 233, 0.15);
  box-shadow: 0 4px 30px rgba(14, 165, 233, 0.06), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;
}

.map-gl {
  width: 100%;
  height: 100%;
}

// ===== 操作提示条 =====
.hint-overlay {
  position: absolute;
  top: 70px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  pointer-events: none;
}

.hint-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(0, 51, 153, 0.88);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(100, 160, 255, 0.3);
  border-radius: 99px;
  color: #e8f0ff;
  font-size: 13px;
  white-space: nowrap;
  box-shadow: 0 4px 20px rgba(0, 51, 153, 0.35);
}

.hint-icon { color: #7eb8ff; flex-shrink: 0; }

// ===== 加载遮罩 =====
.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  z-index: 40;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(14, 165, 233, 0.2);
  border-top-color: #0ea5e9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-text { color: #374151; font-size: 14px; font-weight: 500; }

.hint-fade-enter-active, .hint-fade-leave-active { transition: opacity 0.25s, transform 0.25s; }
.hint-fade-enter-from, .hint-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(-8px); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@keyframes spin { to { transform: rotate(360deg); } }
</style>

<!-- marker 元素由 maplibregl.Marker 动态创建并挂载到地图 DOM（SFC 作用域之外），故此块不能 scoped -->
<style lang="scss">
.sm-marker {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.sm-marker__pin {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: bottom center;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.35));
  transition: transform 0.18s ease, filter 0.18s ease;

  img { width: 100%; height: 100%; object-fit: contain; display: block; rotate: 90deg; }
}

.sm-marker__label {
  margin-top: 3px;
  padding: 2px 9px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
  color: #0f3a66;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(14, 165, 233, 0.25);
  border-radius: 99px;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.18);
  backdrop-filter: blur(4px);
  transition: color 0.2s, background 0.2s, border-color 0.2s;
}

.sm-marker__pole {
  width: 2px;
  height: 16px;
  background: linear-gradient(to bottom, rgba(59, 130, 246, 0.9), rgba(59, 130, 246, 0.08));
}

.sm-marker__base {
  width: 16px;
  height: 6px;
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(59, 130, 246, 0.45), rgba(59, 130, 246, 0));
}

.sm-marker:hover .sm-marker__pin {
  transform: scale(1.14);
  filter: drop-shadow(0 6px 10px rgba(0, 102, 255, 0.5));
}

.sm-marker.is-selected .sm-marker__pin {
  transform: scale(1.2);
  filter: drop-shadow(0 0 8px rgba(0, 102, 255, 0.95)) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
}

.sm-marker.is-selected .sm-marker__label {
  color: #fff;
  background: linear-gradient(135deg, #2563eb, #06b6d4);
  border-color: transparent;
}

.sm-marker--no-label .sm-marker__label { display: none; }
</style>
