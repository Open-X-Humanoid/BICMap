<!--
 * POI 高级标注示例页（方向标记）
 * 内核沿用 src/examples/DirectionalMarkerExample.vue，仅替换为科技感 UI
 * 功能：添加 / 点击添加 / 切换编辑 / 旋转 45° / 移除
-->
<template>
  <div class="app-root">
    <canvas id="canvasMap" style="display:none"></canvas>

    <AppHeader title="POI高级标注" />

    <main class="map-area">
      <div class="grid-bg"></div>
      <div class="map-container">
        <div id="poiAdvancedMap" class="map-gl"></div>
        <MarkerInfoCard :info="markerInfo" />
      </div>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  PlusCircle,
  MousePointerClick,
  Edit3,
  RotateCw,
  Trash2
} from 'lucide-vue-next'

import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'
import MarkerInfoCard from './MarkerInfoCard.vue'

import bicMap from '../../../bicMap/core/bicmap-gl'
import slamImage from '../../assets/slam_transparent.png'

// ===== SLAM 底图参数（与 SlamExample 对齐） =====
const MAP_START_X = -58.999993705749512
const MAP_START_Y = -21.349997329711914
const MAP_X_GRID_COUNT = 2752
const MAP_Y_GRID_COUNT = 1536
const MAP_RESOLUTION = 0.05

// ===== 地图 & 标记状态 =====
const map = ref(null)
const currentMarker = ref(null)
const markerInfo = ref(null)
const editMode = ref(false)
const mapClickMode = ref(false)

// ===== Marker 视觉样式（科技感绿高亮） =====
const MARKER_OPTS = {
  imagePath: '/bicMap/assets/svg/pos.svg',
  initialRotation: 0,
  draggable: true,
  rotationControl: true,
  highlightStyle: {
    backgroundColor: 'rgba(6,182,212,0.15)',
    borderColor: '#06b6d4',
    shadowColor: 'rgba(6,182,212,0.6)'
  }
}
const CURSOR_URL = `url('/bicMap/assets/svg/add-cursor.svg') 10 10, auto`

// ===== Footer 按钮 =====
const hasMarker = computed(() => !!currentMarker.value)
const footerButtons = computed(() => [
  {
    label: '添加标记',
    icon: PlusCircle,
    onClick: addDirectionalMarker
  },
  {
    label: '点击添加',
    icon: MousePointerClick,
    active: mapClickMode.value,
    onClick: toggleMapClickMode
  },
  {
    label: '编辑模式',
    icon: Edit3,
    active: editMode.value,
    disabled: !hasMarker.value,
    onClick: toggleEditMode
  },
  {
    label: '旋转 45°',
    icon: RotateCw,
    disabled: !hasMarker.value,
    onClick: rotateMarker
  },
  {
    label: '移除标记',
    icon: Trash2,
    disabled: !hasMarker.value,
    onClick: removeMarker
  }
])

// ===== 生命周期 =====
onMounted(() => { initMap() })
onBeforeUnmount(() => {
  if (map.value) {
    if (mapClickMode.value) map.value.off('click', handleMapClick)
    map.value.remove()
    map.value = null
  }
})

async function initMap() {
  try {
    await bicMap.init()
    map.value = bicMap.createMap({
      container: 'poiAdvancedMap',
      center: [116.4074, 39.9042],
      zoom: 18,
      backgroundColor: '#fff'
    })
    bicMap.addZoomControl(map.value, 'bottom-right')
    map.value.on('load', () => { loadBaseMap() })
  } catch (error) {
    console.error('初始化地图失败:', error)
  }
}

async function loadBaseMap() {
  if (!map.value) return
  try {
    await bicMap.loadSlamMap(map.value, {
      startX: MAP_START_X,
      startY: MAP_START_Y,
      xGridCount: MAP_X_GRID_COUNT,
      yGridCount: MAP_Y_GRID_COUNT,
      resolution: MAP_RESOLUTION,
      imagePath: slamImage,
      canvasId: 'canvasMap',
      fitBounds: true
    })
  } catch (error) {
    console.error('加载底图失败:', error)
  }
}

// ===== 方向标记功能（与 DirectionalMarkerExample 保持一致） =====
function addDirectionalMarker() {
  if (!map.value) return
  clearMarker()
  const center = map.value.getCenter()
  currentMarker.value = bicMap.addDirectionalMarker(
    map.value,
    [center.lng, center.lat],
    {
      ...MARKER_OPTS,
      onChange: updateMarkerInfo
    }
  )
  updateMarkerInfo({
    lngLat: currentMarker.value.getPosition(),
    rotation: currentMarker.value.getRotation()
  })
}

function toggleEditMode() {
  if (!currentMarker.value) return
  currentMarker.value.toggleEditMode()
  editMode.value = !editMode.value
  updateMarkerInfo({
    lngLat: currentMarker.value.getPosition(),
    rotation: currentMarker.value.getRotation()
  })
}

function removeMarker() {
  clearMarker()
}

function rotateMarker() {
  if (!currentMarker.value) return
  const r = currentMarker.value.getRotation()
  currentMarker.value.setRotation(r + 45)
}

function toggleMapClickMode() {
  if (!map.value) return
  mapClickMode.value = !mapClickMode.value
  if (mapClickMode.value) {
    map.value.on('click', handleMapClick)
    map.value.getCanvas().style.cursor = CURSOR_URL
  } else {
    map.value.off('click', handleMapClick)
    map.value.getCanvas().style.cursor = ''
  }
}

function handleMapClick(e) {
  if (!mapClickMode.value) return
  clearMarker()
  currentMarker.value = bicMap.addDirectionalMarker(
    map.value,
    [e.lngLat.lng, e.lngLat.lat],
    {
      ...MARKER_OPTS,
      initialEditMode: true,
      onChange: updateMarkerInfo
    }
  )
  editMode.value = true
  updateMarkerInfo({
    lngLat: currentMarker.value.getPosition(),
    rotation: currentMarker.value.getRotation()
  })
}

function updateMarkerInfo(data) {
  const { lngLat, rotation } = data
  markerInfo.value = {
    lng: lngLat.lng,
    lat: lngLat.lat,
    rotation,
    editMode: editMode.value
  }
}

function clearMarker() {
  if (currentMarker.value) {
    currentMarker.value.remove()
    currentMarker.value = null
  }
  markerInfo.value = null
  editMode.value = false
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
  background: linear-gradient(160deg, #e8f4fc 0%, #eef1f8 30%, #f0f6fb 60%, #e6f0fa 100%);
}
.map-area {
  flex: 1; position: relative; overflow: hidden; z-index: 10;
}
.grid-bg {
  position: absolute; inset: 0; opacity: 0.04;
  background-image:
    linear-gradient(rgba(14,165,233,1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14,165,233,1) 1px, transparent 1px);
  background-size: 40px 40px;
}
.map-container {
  position: absolute; inset: 12px;
  border-radius: 16px; overflow: hidden;
  background: rgb(129 182 220 / 49%);
  box-shadow: 0 4px 30px rgba(14,165,233,0.06), 0 0 0 1px rgba(255,255,255,0.8) inset;
}
.map-gl {
  width: 100%;
  height: 100%;
}
</style>
