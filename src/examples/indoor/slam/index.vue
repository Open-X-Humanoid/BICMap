<!--
 * @Author: houser.hao@humanoid.com
 * @Date: 2025-04-23 16:35:30
 * @LastEditTime: 2026-04-22 10:12:07
 * @LastEditors: houser.hao@humanoid.com
 * @Description: SLAM地图显示示例
 * @FilePath: /bic-map/src/examples/indoor/slam/index.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="app-root">
    <!-- Hidden canvas for BicMap image processing -->
    <canvas id="canvasMap" style="display:none"></canvas>

    <AppHeader title="SLAM地图显示示例" />

    <main class="map-area">
      <div class="grid-bg"></div>

      <div class="map-container">
        <div id="slamMap" class="map-gl"></div>
      </div>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Upload, Maximize, RotateCcw } from 'lucide-vue-next'

import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'

import bicMap from '../../../bicMap/core/bicmap-gl'
import slamImage from '../../assets/slam_transparent.png'

// ===== SLAM 地图参数 =====
const MAP_START_X = -58.999993705749512
const MAP_START_Y = -21.349997329711914
const MAP_X_GRID_COUNT = 2752
const MAP_Y_GRID_COUNT = 1536
const MAP_RESOLUTION = 0.05
const MAP_IMAGE_PATH = slamImage

// ===== 地图本体 =====
const map = ref(null)
const cacheCameraBound = ref(null)

// ===== Footer 按钮 =====
const footerButtons = computed(() => [
  { label: '加载SLAM地图', active: true,  icon: Upload,    onClick: loadSlamMap },
  { label: '适应地图',     active: false, icon: Maximize,  onClick: zoomToFit },
  { label: '重置视图',     active: false, icon: RotateCcw, onClick: resetView }
])

onMounted(() => { initMap() })
onBeforeUnmount(() => {
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})

// ===== 地图生命周期 =====
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
    map.value.on('load', () => { loadSlamMap() })
    map.value.on('move', logMapState)
  } catch (error) {
    console.error('初始化地图失败:', error)
  }
}

function logMapState() {
  const m = map.value
  if (!m) return
  const center = m.getCenter()
  console.log('[地图状态]', {
    zoom:    m.getZoom(),
    pitch:   m.getPitch(),
    bearing: m.getBearing(),
    center:  { lng: center.lng, lat: center.lat },
    bounds:  m.getBounds().toArray()
  })
}

async function loadSlamMap() {
  if (!map.value) return
  try {
    const result = await bicMap.loadSlamMap(map.value, {
      startX: MAP_START_X,
      startY: MAP_START_Y,
      xGridCount: MAP_X_GRID_COUNT,
      yGridCount: MAP_Y_GRID_COUNT,
      resolution: MAP_RESOLUTION,
      imagePath: MAP_IMAGE_PATH,
      canvasId: 'canvasMap',
      fitBounds: true
    })
    cacheCameraBound.value = result.cameraBound
  } catch (error) {
    console.error('加载SLAM地图失败:', error)
  }
}

function zoomToFit() {
  if (!map.value || !cacheCameraBound.value) return
  map.value.jumpTo(cacheCameraBound.value)
}

function resetView() {
  if (!map.value) return
  map.value.flyTo({ center: [116.4074, 39.9042], zoom: 18, pitch: 0, bearing: 0 })
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
