<!--
 * @Description: 博物馆服务机器人导览讲解 Demo — 基于固定 POI 点位的智能讲解与循环巡航
 * @FilePath: /bic-map/src/examples/scene/robotGuideTour/index.vue
-->
<template>
  <div class="app-root">
    <canvas id="canvasMap" class="app-root__canvas"></canvas>

    <AppHeader title="博物馆服务机器人导览讲解" />

    <main class="map-area">
      <div class="grid-bg"></div>
      <div class="map-container">
        <div id="guideTourMap" class="map-gl"></div>
        <GuideNarrationCard
          :data="currentNarration"
          :progress="progressLabel"
        />
        <transition name="hud-fade">
          <div v-if="running && !currentNarration" class="tour-status">
            <span class="tour-status__dot"></span>
            <span>导览机器人正在前往下一讲解点…</span>
          </div>
        </transition>
      </div>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

import { MapPin, Play, Square } from 'lucide-vue-next'

import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'
import GuideNarrationCard from './GuideNarrationCard.vue'
import { useRobotGuideTour } from './useRobotGuideTour'

import bicMap from '../../../bicMap/core/bicmap-gl'
import slamImage from '../../assets/museum_slam_navigation_base.png'
import { SLAM_MAP_CONFIG } from './constants'

const map = ref(null)

const {
  running,
  currentNarration,
  progressLabel,
  toggleTour,
  loadPoiMarkers
} = useRobotGuideTour(map)

/** 底部工具栏按钮：开始/停止导览、单独显示讲解点位 */
const footerButtons = computed(() => [
  {
    label: running.value ? '停止导览' : '开始导览',
    active: running.value,
    icon: running.value ? Square : Play,
    onClick: toggleTour
  },
  {
    label: '显示讲解点位',
    active: false,
    icon: MapPin,
    onClick: handleShowPoiMarkers
  }
])

/**
 * 仅加载导览 POI 标注，不启动机器人巡航
 */
function handleShowPoiMarkers() {
  if (!map.value) return
  loadPoiMarkers()
}

/** 页面挂载后初始化 BicMap 实例 */
onMounted(() => {
  initMap()
})

/** 页面卸载时销毁地图实例，释放 WebGL 资源 */
onBeforeUnmount(() => {
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})

/**
 * 初始化地图容器、缩放控件，并在 load 后加载 SLAM 底图
 */
async function initMap() {
  try {
    await bicMap.init()
    map.value = bicMap.createMap({
      container: 'guideTourMap',
      center: [116.4074, 39.9042],
      zoom: 18,
      backgroundColor: '#fff'
    })
    bicMap.addZoomControl(map.value, 'bottom-right')
    map.value.on('load', () => {
      loadSlamMap()
    })
  } catch (error) {
    console.error('初始化地图失败:', error)
  }
}

/**
 * 加载工程通用室内 SLAM 栅格地图作为底图
 * 使用隐藏 canvas 处理贴图，fitBounds 自适应视野
 */
async function loadSlamMap() {
  if (!map.value) return
  const { startX, startY, xGridCount, yGridCount, resolution } = SLAM_MAP_CONFIG
  try {
    await bicMap.loadSlamMap(map.value, {
      startX,
      startY,
      xGridCount,
      yGridCount,
      resolution,
      imagePath: slamImage,
      canvasId: 'canvasMap',
      fitBounds: true
    })
  } catch (error) {
    console.error('加载 SLAM 地图失败:', error)
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

  &__canvas {
    display: none;
  }
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

.tour-status {
  position: absolute;
  top: 20px;
  left: 20px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(6, 182, 212, 0.16));
  backdrop-filter: blur(14px);
  border: 1px solid rgba(59, 130, 246, 0.3);
  z-index: 25;
  font-size: 12px;
  font-weight: 700;
  color: #1d4ed8;
  letter-spacing: 0.06em;

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #3b82f6;
    animation: status-pulse 1.2s ease-in-out infinite;
  }
}

@keyframes status-pulse {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 8px #3b82f6;
  }
  50% {
    transform: scale(1.25);
    box-shadow: 0 0 14px #3b82f6;
  }
}

.hud-fade-enter-active,
.hud-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.hud-fade-enter-from,
.hud-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
