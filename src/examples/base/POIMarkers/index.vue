<!--
 * 点位 Marker 示例页
 * 只暴露一个"点位Marker"按钮；SLAM 底图在挂载时静默加载做场景铺底
-->
<template>
  <div class="app-root">
    <canvas id="canvasMap" style="display:none"></canvas>

    <AppHeader title="点位Marker" />

    <main class="map-area">
      <div class="grid-bg"></div>
      <div class="map-container">
        <div id="slamMap" class="map-gl"></div>
        <POIInfoCard :data="selectedPOI" @close="selectedPOI = null" />
      </div>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { MapPin } from 'lucide-vue-next'

import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'
import POIInfoCard from './POIInfoCard.vue'
import { usePOIMarkers } from './usePOIMarkers'

import bicMap from '../../../bicMap/core/bicmap-gl'
import slamImage from '../../assets/slam_transparent.png'

// ===== SLAM 底图参数 =====
const MAP_START_X      = -58.999993705749512
const MAP_START_Y      = -21.349997329711914
const MAP_X_GRID_COUNT = 2752
const MAP_Y_GRID_COUNT = 1536
const MAP_RESOLUTION   = 0.05
const MAP_ZOOM_FACTOR  = 2

// 实际地图内容所在的安全区域（分数坐标）
// SLAM 图片四周约 22~32% 是透明空白，地图内容在中间区域
const SAFE_MIN_FRAC = 0.28
const SAFE_MAX_FRAC = 0.65

// ===== 地图本体 =====
const map = ref(null)
const floorPlanBounds = ref(null)   // 根据安全区域计算的精确 GPS 边界

// ===== 点位 Marker =====
const {
  active: poiActive,
  selected: selectedPOI,
  toggle: togglePOIMarkers
} = usePOIMarkers(map, {
  getBounds: () => floorPlanBounds.value,
  edgePadding: 0.05,
  markerOptions: { size: 32 }
})

// ===== Footer 按钮 =====
const footerButtons = computed(() => [
  { label: '点位Marker', active: poiActive.value, icon: MapPin, onClick: togglePOIMarkers }
])

onMounted(() => { initMap() })
onBeforeUnmount(() => {
  if (map.value) { map.value.remove(); map.value = null }
})

// ===== 生命周期 =====
async function initMap() {
  try {
    await bicMap.init()
    map.value = bicMap.createMap({
      container: 'slamMap',
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
      fitBounds: true,
      zoomFactor: MAP_ZOOM_FACTOR
    })
    computeFloorPlanBounds()
  } catch (error) {
    console.error('加载底图失败:', error)
  }
}

function computeFloorPlanBounds() {
  const Mu = window.MapUtils
  if (!Mu?.cartesianToGPS) return

  const mapW = MAP_X_GRID_COUNT * MAP_RESOLUTION
  const mapH = MAP_Y_GRID_COUNT * MAP_RESOLUTION

  // 将安全区域（分数坐标）转换为笛卡尔坐标，再转为 GPS
  const corners = [
    { x: MAP_START_X + SAFE_MIN_FRAC * mapW, y: MAP_START_Y + SAFE_MIN_FRAC * mapH },
    { x: MAP_START_X + SAFE_MAX_FRAC * mapW, y: MAP_START_Y + SAFE_MAX_FRAC * mapH },
  ]
  const gpsList = corners.map(c =>
    Mu.cartesianToGPS({ x: c.x, y: c.y, scale: MAP_RESOLUTION, zoomFactor: MAP_ZOOM_FACTOR })
  )
  floorPlanBounds.value = {
    minLng: Math.min(...gpsList.map(g => g.longitude)),
    maxLng: Math.max(...gpsList.map(g => g.longitude)),
    minLat: Math.min(...gpsList.map(g => g.latitude)),
    maxLat: Math.max(...gpsList.map(g => g.latitude)),
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
