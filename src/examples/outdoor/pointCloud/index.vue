<!--
 * @Author: kai.lee@x-humanoid.com
 * @Date: 2026-05-09 14:08:16
 * @LastEditTime: 2026-06-08 15:06:26
 * @LastEditors: kai.lee@x-humanoid.com
 * @Description: 室外点云渲染示例骨架：初始化地图实例，HUD 参数面板与页脚按钮占位，暂无数据加载与点云渲染逻辑
 * @FilePath: /bic-map/src/examples/outdoor/pointCloud/index.vue
 * Copyright (c) 2024 kai.lee@x-humanoid.com, All Rights Reserved.
-->

<template>
  <div class="app-root">
    <AppHeader title="室外点云渲染" />

    <main class="map-area">
      <div class="map-container">
        <div id="outdoorPointCloudMap" class="map-gl"></div>

        <FollowBadge :visible="robotFollow" :pose="robotPose" :phase="robotPhase" />

        <div class="hud-panel">
          <div class="hud-title">
            <span class="hud-bar"></span>
            点云参数
          </div>

          <div class="hud-row">
            <span class="hud-label">模式</span>
            <span class="hud-value" :class="{ 'hud-value--accent': is3D }">
              {{ is3D ? '3D' : '2D' }}
            </span>
          </div>
          <div class="hud-row">
            <span class="hud-label">状态</span>
            <span class="hud-value" :class="{ 'hud-value--accent': cloudLoaded }">
              {{ cloudLoaded ? '已加载' : '待加载' }}
            </span>
          </div>
          <div class="hud-row">
            <span class="hud-label">点数</span>
            <span class="hud-value">{{ pointCount.toLocaleString() }}</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">数据来源</span>
            <span class="hud-value">外部接入</span>
          </div>

          <div class="hud-divider"></div>

        </div>
      </div>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import {
  Crosshair,
  Eye,
  EyeOff,
  Maximize,
  Navigation,
  RefreshCcw,
  RotateCcw,
  Trash2,
  Upload
} from 'lucide-vue-next'

import AppFooter from '../../components/AppFooter.vue'
import AppHeader from '../../components/AppHeader.vue'
import FollowBadge from '../../indoor/robotFollow/FollowBadge.vue'

import bicMap from '../../../bicMap/core/bicmap-gl'
import { useRobotRoute } from '../buildings/useRobotRoute'
import {
  MOCK_POINT_CLOUD,
  MAP_CENTER,
  MAP_ZOOM,
  MAP_PITCH,
  MAP_BEARING
} from './mockPointCloudData'
import {
  MOCK_CROSSWALKS,
  MOCK_GROUND,
  MOCK_PARKING,
  MOCK_PARKS,
  MOCK_PLAZAS,
  MOCK_ROADS,
} from '../buildings/mockBuildingData'

// 巡航路线：创业路左端 → 创业路×中轴路 → 中轴路×学院路 → 学院路×东环路 → 东环路上端 → 掉头返回
const ROUTE_WAYPOINTS = [
  [116.4028, 39.9030],  // 创业路左端（起点）
  [116.4075, 39.9030],  // 创业路 × 中轴路 交叉口
  [116.4075, 39.9057],  // 中轴路 × 学院路 交叉口
  [116.4103, 39.9057],  // 学院路 × 东环路 交叉口
  [116.4103, 39.9080],  // 东环路上端（掉头点）
]

const map = ref(null)
const pointCloud2D = ref(null)
const pointCloud3D = ref(null)
const is3D = ref(true)
const cloudVisible = ref(true)
const cloudLoaded = ref(false)
const pointCount = ref(0)

const {
  follow: robotFollow,
  pose: robotPose,
  phase: robotPhase,
  controller: robotController,
  toggle: toggleCruise,
  toggleFollow: toggleRobotFollow
} = useRobotRoute(map, {
  waypoints: ROUTE_WAYPOINTS,
  speed: 0.0005,
  robotId: 'outdoor-robot-01',
  robotName: '巡检机器人-01',
  followMode: 'flat',
  pitch: 55,
  flatPitch: 60,
  focusZoom: 17,
  markerOptions: { size: 32 }
})

const activeCloud = computed(() => (is3D.value ? pointCloud3D.value : pointCloud2D.value))

const footerButtons = computed(() => [
  // { label: '加载点云', icon: Upload, onClick: loadPointCloud },
  // { label: '清除', icon: Trash2, onClick: unloadPointCloud, disabled: !cloudLoaded.value },
  // {
  //   label: cloudVisible.value ? '隐藏点云' : '显示点云',
  //   icon: cloudVisible.value ? EyeOff : Eye,
  //   onClick: toggleCloudVisibility,
  //   disabled: !cloudLoaded.value
  // },
  {
    label: robotController.value ? '停止巡航' : '启动巡航',
    icon: Navigation,
    active: !!robotController.value,
    onClick: toggleCruise
  },
  // {
  //   label: is3D.value ? '切到 2D' : '切到 3D',
  //   icon: RefreshCcw,
  //   onClick: toggleDimension,
  //   disabled: !cloudLoaded.value
  // },
  {
    label: '视角跟随',
    icon: Crosshair,
    active: !!robotFollow.value,
    onClick: toggleRobotFollow
  },
  { label: '适应视图', icon: Maximize, onClick: fitView, disabled: !cloudLoaded.value },
  { label: '重置场景', icon: RotateCcw, onClick: resetScene }
])

onMounted(() => initMap())
onBeforeUnmount(() => {
  unloadPointCloud()
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})

/**
 * 初始化地图实例并渲染点云
 */
async function initMap() {
  try {
    await bicMap.init()
    map.value = bicMap.createMap({
      container: 'outdoorPointCloudMap',
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      pitch: MAP_PITCH,
      bearing: MAP_BEARING,
      maxPitch: 85,
      backgroundColor: '#fff',
      antialias: true
    })
    bicMap.addZoomControl(map.value, 'bottom-right')
    map.value.on('load', () => {
      addMockBasemap()
      loadPointCloud()
    })
  } catch (error) {
    console.error('初始化地图失败:', error)
  }
}

function addMockBasemap() {
  const m = map.value
  const src = (id, data) => m.addSource(id, { type: 'geojson', data })
  const lyr = (o) => m.addLayer(o)

  src('basemap-ground', MOCK_GROUND)
  lyr({ id: 'basemap-ground-fill', source: 'basemap-ground', type: 'fill', paint: { 'fill-color': '#fff', 'fill-opacity': 1 } })

  src('basemap-parks', MOCK_PARKS)
  lyr({ id: 'basemap-parks-fill', source: 'basemap-parks', type: 'fill', paint: { 'fill-color': '#97E6A7', 'fill-opacity': 1 } })
  lyr({ id: 'basemap-parks-outline', source: 'basemap-parks', type: 'line', paint: { 'line-color': '#a5d6a7', 'line-width': 0.8, 'line-opacity': 0.8 } })

  src('basemap-plazas', MOCK_PLAZAS)
  lyr({ id: 'basemap-plazas-fill', source: 'basemap-plazas', type: 'fill', paint: { 'fill-color': '#F7E6B7', 'fill-opacity': 0.9 } })

  src('basemap-parking', MOCK_PARKING)
  lyr({ id: 'basemap-parking-fill', source: 'basemap-parking', type: 'fill', paint: { 'fill-color': '#e8e8e8', 'fill-opacity': 1 } })

  src('basemap-roads', MOCK_ROADS)
  lyr({ id: 'basemap-roads-casing', source: 'basemap-roads', type: 'line', filter: ['==', ['get', 'road_type'], 'primary'], paint: { 'line-color': '#d0d0d0', 'line-width': 24, 'line-opacity': 1 } })
  lyr({ id: 'basemap-roads-casing-secondary', source: 'basemap-roads', type: 'line', filter: ['==', ['get', 'road_type'], 'secondary'], paint: { 'line-color': '#dadada', 'line-width': 24, 'line-opacity': 1 } })
  lyr({ id: 'basemap-roads-primary', source: 'basemap-roads', type: 'line', filter: ['==', ['get', 'road_type'], 'primary'], paint: { 'line-color': '#BFBFBF', 'line-width': 20, 'line-opacity': 1 } })
  lyr({ id: 'basemap-roads-secondary', source: 'basemap-roads', type: 'line', filter: ['==', ['get', 'road_type'], 'secondary'], paint: { 'line-color': '#BFBFBF', 'line-width': 20, 'line-opacity': 1 } })
  lyr({ id: 'basemap-roads-centerline', source: 'basemap-roads', type: 'line', filter: ['==', ['get', 'marking'], 'centerline'], paint: { 'line-color': '#f0c040', 'line-width': 1.5, 'line-dasharray': [1.5, 3], 'line-opacity': 0.9 } })
  lyr({ id: 'basemap-roads-labels', source: 'basemap-roads', type: 'symbol', filter: ['has', 'road_type'], layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-size': 14, 'text-optional': true, 'symbol-spacing': 500, 'text-allow-overlap': false, 'text-ignore-placement': false }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#555555', 'text-halo-width': 2.5, 'text-halo-blur': 1.5, 'text-opacity': 1 } })

  src('basemap-crosswalks', MOCK_CROSSWALKS)
  lyr({ id: 'basemap-crosswalks-fill', source: 'basemap-crosswalks', type: 'fill', paint: { 'fill-color': '#f5f5f5', 'fill-opacity': 0.9 } })
  lyr({ id: 'basemap-crosswalks-outline', source: 'basemap-crosswalks', type: 'line', paint: { 'line-color': '#dddddd', 'line-width': 0.5, 'line-opacity': 0.8 } })
}

/**
 * 加载/重新加载点云（按当前 is3D 选择对应实现）
 */
function loadPointCloud() {
  if (!map.value) return
  unloadPointCloud()

  if (is3D.value) {
    pointCloud3D.value = bicMap.createPointCloud3D(map.value, MOCK_POINT_CLOUD, build3DOptions())
    pointCloud3D.value?.show()
  } else {
    pointCloud2D.value = bicMap.createPointCloud(map.value, MOCK_POINT_CLOUD, build2DOptions())
    pointCloud2D.value?.show()
  }

  pointCount.value = MOCK_POINT_CLOUD.length
  cloudLoaded.value = true
  cloudVisible.value = true
}

/**
 * 组装 2D 点云（circle 图层）配置
 */
function build2DOptions() {
  return {
    pointSize: 4,
    pointOpacity: 0.9,
    useColorMap: true,
    is3D: false,
    zRange: [0, 120],
    heightScale: 0,
    heightOffset: 0
  }
}

/**
 * 组装 3D 点云（Three.js 自定义图层）配置
 */
function build3DOptions() {
  return {
    pointSize: 4,
    pointOpacity: 0.9,
    useColorMap: true,
    zRange: [0, 120],
    heightScale: 1,
    heightOffset: 0
  }
}

/**
 * 2D / 3D 切换：更新相机 pitch，重新生成点云
 */
function toggleDimension() {
  is3D.value = !is3D.value
  map.value?.easeTo({ pitch: is3D.value ? MAP_PITCH : 0, duration: 800 })
  loadPointCloud()
}

/**
 * 清除点云图层
 */
function unloadPointCloud() {
  pointCloud2D.value?.remove()
  pointCloud2D.value = null
  pointCloud3D.value?.remove()
  pointCloud3D.value = null
  pointCount.value = 0
  cloudLoaded.value = false
  cloudVisible.value = false
}

/**
 * 切换点云可见性
 */
function toggleCloudVisibility() {
  const cloud = activeCloud.value
  if (!cloud) return
  if (cloudVisible.value) {
    cloud.hide()
  } else {
    cloud.show()
  }
  cloudVisible.value = !cloudVisible.value
}

/**
 * 适应视图：飞行至包含所有路线航点的包围盒视角
 */
function fitView() {
  if (!map.value) return
  const lngs = ROUTE_WAYPOINTS.map(p => p[0])
  const lats = ROUTE_WAYPOINTS.map(p => p[1])
  const bounds = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]]
  map.value.fitBounds(bounds, { padding: 80, pitch: MAP_PITCH, bearing: MAP_BEARING, duration: 1200 })
}

/**
 * 重置场景：停止巡航/跟随，恢复默认 3D 模式，重新加载点云，飞回初始视角
 */
function resetScene() {
  if (robotController.value) toggleCruise()
  if (robotFollow.value) toggleRobotFollow()

  is3D.value = true
  loadPointCloud()

  map.value?.flyTo({
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    pitch: MAP_PITCH,
    bearing: MAP_BEARING,
    duration: 800
  })
}
</script>

<style lang="scss" scoped>
.app-root {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
}

.map-area {
  position: relative;
  flex: 1;
  overflow: hidden;
  z-index: 10;
}

.map-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #ffffff;
}

.map-gl {
  width: 100%;
  height: 100%;
}

.hud-panel {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 30;
  width: 260px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(5, 18, 48, 0.78);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(80, 140, 255, 0.28);
  box-shadow: 0 6px 24px rgba(0, 20, 80, 0.35);
  color: #cfe4ff;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;

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
  }

  .hud-value {
    font-family: 'Space Mono', 'Courier New', monospace;
    color: #fff;

    &--accent {
      color: #67e8f9;
      text-shadow: 0 0 8px rgba(103, 232, 249, 0.5);
    }
  }

  .hud-divider {
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(120, 160, 220, 0.35) 50%,
      transparent 100%
    );
  }

  .hud-tip {
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px dashed rgba(120, 160, 220, 0.3);
    font-size: 11px;
    line-height: 1.5;
    color: #8eb4e6;
  }
}
</style>
