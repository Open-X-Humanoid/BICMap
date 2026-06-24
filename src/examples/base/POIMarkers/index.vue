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

    <AppFooter />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

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

// ===== 固定 mock 点位（SLAM 笛卡尔坐标，米；落在底图有效内容区内） =====
const MOCK_POINTS = [
  { id: 'poi-1', name: '大厅入口',   x: -29, y: 14, rotation: 90 },
  { id: 'poi-2', name: '电梯间A',    x: -4,  y: 25, rotation: 0 },
  { id: 'poi-3', name: '充电站',     x: 38,  y: 16, rotation: 180 },
  { id: 'poi-4', name: '会议室C',    x: 52,  y: -6, rotation: 45 },
  { id: 'poi-5', name: '休息区',     x: 26,  y: 26,  rotation: 270 },
  { id: 'poi-6', name: '机器人停放点', x: 4,  y: 12, rotation: 135 },
  { id: 'poi-7', name: '办公区A',    x: -6, y: 6, rotation: 0 },
  { id: 'poi-8', name: '安全出口',   x: -16, y: 4,  rotation: 225 },
  { id: 'poi-9', name: '前台服务',   x: -26,  y: 26, rotation: 315 }
]

// ===== 地图本体 =====
const map = ref(null)

// ===== 点位 Marker（固定 mock 数据） =====
const {
  selected: selectedPOI,
  load: loadPOIMarkers
} = usePOIMarkers(map, {
  pointsProvider: buildPoints,
  markerOptions: { size: 32 }
})

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
    // 底图就绪后直接加载固定点位 marker
    loadPOIMarkers()
  } catch (error) {
    console.error('加载底图失败:', error)
  }
}

/**
 * 将固定 mock 点位（笛卡尔坐标）转换为 usePOIMarkers 需要的经纬度点位
 * @returns {Array<{id:string, lngLat:[number,number], rotation:number, name:string}>}
 */
function buildPoints() {
  const Mu = window.MapUtils
  if (!Mu?.cartesianToGPS) return []
  return MOCK_POINTS.map(p => {
    const gps = Mu.cartesianToGPS({ x: p.x, y: p.y, scale: MAP_RESOLUTION, zoomFactor: MAP_ZOOM_FACTOR })
    return { id: p.id, lngLat: [gps.longitude, gps.latitude], rotation: p.rotation, name: p.name }
  })
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
