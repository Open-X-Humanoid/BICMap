<!--
 * @Date: 2026-05-07 16:51:00
 * @LastEditTime: 2026-06-02 16:54:57
 * @Description: 室外建筑物渲染示例：在纯 GeoJSON 矢量底图上叠加 MapLibre fill-extrusion 3D 建筑物图层，支持高度/透明度/颜色模式调节，无需网络连接
 * @FilePath: /bic-map/src/examples/outdoor/buildings/index.vue
-->
<template>
  <div class="app-root">
    <AppHeader title="室外建筑物渲染" />

    <main class="map-area">
      <div class="map-container">
        <div id="outdoorBuildingsMap" class="map-gl"></div>

        <FollowBadge :visible="robotFollow" :pose="robotPose" :phase="robotPhase" />

        <HudPanel v-model:heightScale="heightScale" v-model:buildingOpacity="buildingOpacity"
          v-model:customColor="customColor" :buildingsVisible="buildingsVisible" :useCustomColor="useCustomColor"
          :buildingCount="buildingCount" @applyHeightScale="applyHeightScale" @applyOpacity="applyOpacity"
          @reloadBuildings="reloadBuildings" />

      </div>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, onBeforeUnmount } from 'vue'

import {
  Building2,
  Crosshair,
  Eye,
  EyeOff,
  Maximize,
  Navigation,
  Palette,
  RotateCcw,
  Upload
} from 'lucide-vue-next'

import AppFooter from '../../components/AppFooter.vue'
import AppHeader from '../../components/AppHeader.vue'
import HudPanel from './components/HudPanel.vue'
import FollowBadge from '../../indoor/robotFollow/FollowBadge.vue'

import bicMap from '../../../bicMap/core/bicmap-gl'
import { useRobotRoute } from './useRobotRoute'
import { ROBOT_EXPRESSIVE_CONFIG } from '@/bicMap/core/robot/visual/robot3DPresets'
import { createBuildings } from '@/bicMap/core/mapFeatures'
import {
  MAP_BEARING,
  MAP_CENTER,
  MAP_PITCH,
  MAP_ZOOM,
  MOCK_BUILDINGS,
  MOCK_CROSSWALKS,
  MOCK_GROUND,
  MOCK_PARKING,
  MOCK_PARKS,
  MOCK_PLAZAS,
  MOCK_ROADS,
} from './mockBuildingData'

// 路线航点：创业路左端 → 创业路×东环路交叉口 → 东环路上端
const ROUTE_WAYPOINTS = [
  [116.4028, 39.9030],  // 创业路左端（起点）
  [116.4103, 39.9030],  // 创业路 × 东环路 交叉口（转弯）
  [116.4103, 39.9080],  // 东环路上端（终点）
]

const map = ref(null)
const buildings = ref(null)
const buildingsVisible = ref(false)
const heightScale = ref(1)
const buildingOpacity = ref(0.85)
const useCustomColor = ref(false)
const customColor = ref('#90caf9')

const buildingCount = computed(() => MOCK_BUILDINGS.features.length)

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
  iconHeadingOffset: -90,
  markerOptions: { size: 32 },
  renderMode: '2d',
  modelConfig: ROBOT_EXPRESSIVE_CONFIG
})

const footerButtons = computed(() => [
  // { label: '加载建筑', icon: Upload, onClick: loadBuildings },
  // {
  //   label: buildingsVisible.value ? '隐藏建筑' : '显示建筑',
  //   icon: buildingsVisible.value ? EyeOff : Eye,
  //   onClick: toggleVisibility
  // },
  // {
  //   label: useCustomColor.value ? '分类色' : '单色',
  //   icon: Palette,
  //   onClick: toggleColorMode
  // },
  {
    label: robotController.value ? '停止巡航' : '启动巡航',
    icon: Navigation,
    active: !!robotController.value,
    onClick: toggleCruise
  },
  {
    label: '视角跟随',
    icon: Crosshair,
    active: !!robotFollow.value,
    onClick: toggleRobotFollow
  },
  { label: '适应视图', icon: Maximize, onClick: fitView, disabled: robotFollow.value },
  { label: '重置场景', icon: RotateCcw, onClick: resetScene }
])

onMounted(() => initMap())
onBeforeUnmount(() => {
  buildings.value?.remove?.()
  buildings.value = null
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})

/**
 * 初始化地图，加载矢量底图后渲染建筑
 */
async function initMap() {
  try {
    await bicMap.init()
    map.value = bicMap.createMap({
      container: 'outdoorBuildingsMap',
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
      loadBuildings()
      // fitRouteBounds()
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

// 加载（或重新加载）建筑物图层
function loadBuildings() {
  buildings.value?.remove?.()
  buildings.value = null

  const geojson = buildGeojson()
  buildings.value = createBuildings(map.value, geojson, {
    defaultHeight: 20,
    opacity: buildingOpacity.value,
    heightScale: heightScale.value,
    outlineColor: '#2970b8'
  })
  buildingsVisible.value = true
}

/**
 * 根据颜色模式构造渲染用 GeoJSON：单色模式将所有 feature 的 color 替换为 customColor
 * @returns {Object} GeoJSON FeatureCollection
 */
function buildGeojson() {
  if (!useCustomColor.value) return MOCK_BUILDINGS
  return {
    ...MOCK_BUILDINGS,
    features: MOCK_BUILDINGS.features.map((f) => ({
      ...f,
      properties: { ...f.properties, color: customColor.value }
    }))
  }
}

// 同步高度缩放到已渲染图层
function applyHeightScale() {
  buildings.value?.setHeightScale(heightScale.value)
}

// 同步透明度到已渲染图层
function applyOpacity() {
  buildings.value?.setOpacity(buildingOpacity.value)
}

/**
 * 切换颜色模式（分类色 / 单色）并重建图层
 */
function toggleColorMode() {
  useCustomColor.value = !useCustomColor.value
  if (buildings.value) reloadBuildings()
}

/**
 * 使用当前颜色配置重建建筑图层（颜色参数变化时调用）
 */
function reloadBuildings() {
  if (!buildings.value) return
  buildings.value.update(buildGeojson())
}

// 切换建筑显示/隐藏
function toggleVisibility() {
  if (!buildings.value) return
  if (buildingsVisible.value) {
    buildings.value.hide()
  } else {
    buildings.value.show()
  }
  buildingsVisible.value = !buildingsVisible.value
}

// 飞行至包含所有建筑 + 路线的视角
function fitView() {
  if (!map.value) return
  const bounds = computeBounds()
  if (!bounds) return
  map.value.fitBounds(bounds, { padding: 80, pitch: MAP_PITCH, bearing: MAP_BEARING, duration: 1200 })
}

/** 初始化后自动适应视图（静默跳转，无飞行动画） */
function fitRouteBounds() {
  if (!map.value) return
  const bounds = computeBounds()
  if (!bounds) return
  map.value.fitBounds(bounds, { padding: 80, pitch: MAP_PITCH, bearing: MAP_BEARING, duration: 0 })
}

/** 根据路线航点计算包围盒 */
function computeBounds() {
  const lngs = ROUTE_WAYPOINTS.map(p => p[0])
  const lats = ROUTE_WAYPOINTS.map(p => p[1])
  return [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]]
}

/**
 * 重置场景：停止巡航/跟随，恢复所有参数默认值，重新加载建筑，飞回初始视角
 */
function resetScene() {
  if (robotController.value) toggleCruise()
  if (robotFollow.value) toggleRobotFollow()

  heightScale.value = 1
  buildingOpacity.value = 0.85
  useCustomColor.value = false
  customColor.value = '#90caf9'

  loadBuildings()

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
</style>
