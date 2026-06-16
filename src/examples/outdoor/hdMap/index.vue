<!--
 * @Author: houser.hao@humanoid.com
 * @Date: 2026-06-15 10:00:00
 * @LastEditTime: 2026-06-15 15:40:38
 * @LastEditors: Ella ella.yin@x-humanoid.com
 * @Description: 室外高精地图加载示例：在 GeoJSON 矢量底图上叠加车道面、标线、停止线与交通标志图层，支持图层显隐切换
 * @FilePath: /bic-map/src/examples/outdoor/hdMap/index.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="app-root">
    <AppHeader title="高精地图加载" />

    <main class="map-area">
      <div class="map-container">
        <div id="outdoorHdMap" class="map-gl"></div>

        <div class="hud-panel">
          <div class="hud-title">
            <span class="hud-bar"></span>
            高精地图
          </div>

          <div class="hud-row">
            <span class="hud-label">状态</span>
            <span class="hud-value" :class="{ 'hud-value--accent': hdMapLoaded }">
              {{ hdMapLoaded ? '已加载' : '待加载' }}
            </span>
          </div>
          <div class="hud-row">
            <span class="hud-label">车道</span>
            <span class="hud-value">{{ drivingLaneCount }}</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">自行车道</span>
            <span class="hud-value">{{ bicycleLaneCount }}</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">标线数</span>
            <span class="hud-value">{{ markingCount }}</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">人行横道</span>
            <span class="hud-value">{{ crosswalkCount }}</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">红绿灯</span>
            <span class="hud-value">{{ trafficLightCount }}</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">标志数</span>
            <span class="hud-value">{{ signCount }}</span>
          </div>

          <div class="hud-divider"></div>

          <div class="hud-section-label">图层显隐</div>
          <div class="hud-toggles">
            <label v-for="item in layerToggles" :key="item.id" class="hud-toggle">
              <input
                type="checkbox"
                :checked="item.visible"
                :disabled="!hdMapLoaded"
                @change="toggleLayer(item.id, $event.target.checked)"
              />
              <span>{{ item.label }}</span>
            </label>
          </div>

          <div class="hud-divider"></div>

          <div class="hud-tip">
            高精图层为 GeoJSON 矢量数据，包含车道面、标线、停止线、人行横道与路口红绿灯。
          </div>
        </div>
      </div>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import {
  Eye,
  EyeOff,
  Layers,
  RotateCcw,
  Upload
} from 'lucide-vue-next'

import AppFooter from '../../components/AppFooter.vue'
import AppHeader from '../../components/AppHeader.vue'

import iconBike from '../../assets/icons/icon-bike.svg'

import bicMap from '../../../bicMap/core/bicmap-gl'
import {
  MAP_BEARING,
  MAP_CENTER,
  MAP_PITCH,
  MAP_ZOOM,
  MOCK_CROSSWALKS,
  MOCK_GROUND,
  MOCK_PARKING,
  MOCK_PARKS,
  MOCK_PLAZAS,
  MOCK_ROAD_SURFACES,
  MOCK_ROADS,
} from './mockBasemapData'
import {
  BIKE_ICON_ID,
  BIKE_ICON_SPACING,
  HD_LAYER_IDS,
  HD_SOURCE_IDS,
  LANE_ARROW_ICON_ID,
  LANE_ARROW_ICON_SIZE,
  LANE_ARROW_SPACING,
  MOCK_HD_BICYCLE_LANE_LINES,
  MOCK_HD_CROSSWALKS,
  MOCK_HD_DASHED_LANE_LINES,
  HD_CROSSWALK_FOCUS_BOUNDS,
  MOCK_HD_LANES,
  MOCK_HD_MARKINGS,
  MOCK_HD_SIGNS,
  MOCK_HD_STOP_LINES,
  MOCK_HD_TRAFFIC_LIGHTS,
  MOCK_HD_TRAFFIC_LIGHT_POLES,
} from './mockHdMapData'

const FOCUS_BOUNDS = [
  [116.4030, 39.9028],
  [116.4120, 39.9078]
]

/** 车道方向箭头图片 */
const LANE_ARROW_IMAGE = '/bicMap/assets/img/arrow.png'

const map = ref(null)
const hdMapLoaded = ref(false)
const layersVisible = ref({
  [HD_LAYER_IDS.DRIVING_LANES]: true,
  [HD_LAYER_IDS.BICYCLE_LANES]: true,
  [HD_LAYER_IDS.BICYCLE_ICONS]: true,
  [HD_LAYER_IDS.MARKINGS_SOLID]: true,
  [HD_LAYER_IDS.MARKINGS_DASHED]: true,
  [HD_LAYER_IDS.LANE_ARROWS]: true,
  [HD_LAYER_IDS.MARKINGS_DOUBLE]: true,
  [HD_LAYER_IDS.STOP_LINES]: true,
  [HD_LAYER_IDS.CROSSWALKS]: true,
  [HD_LAYER_IDS.CROSSWALK_STRIPES]: true,
  [HD_LAYER_IDS.TRAFFIC_LIGHTS]: true,
  [HD_LAYER_IDS.SIGNS]: true
})

const drivingLaneCount = computed(() =>
  MOCK_HD_LANES.features.filter((f) => f.properties.lane_type === 'driving').length
)
const bicycleLaneCount = computed(() =>
  MOCK_HD_LANES.features.filter((f) => f.properties.lane_type === 'bicycle').length
)
const markingCount = computed(() => MOCK_HD_MARKINGS.features.length)
const signCount = computed(() => MOCK_HD_SIGNS.features.length)
const crosswalkCount = computed(() =>
  MOCK_HD_CROSSWALKS.features.filter((f) => f.properties.feature_type === 'zone').length
)
const trafficLightCount = computed(() => MOCK_HD_TRAFFIC_LIGHTS.features.length)

const layerToggles = computed(() => [
  { id: HD_LAYER_IDS.DRIVING_LANES, label: '车道', visible: layersVisible.value[HD_LAYER_IDS.DRIVING_LANES] },
  { id: HD_LAYER_IDS.BICYCLE_LANES, label: '自行车道', visible: layersVisible.value[HD_LAYER_IDS.BICYCLE_LANES] },
  { id: HD_LAYER_IDS.MARKINGS_DOUBLE, label: '双黄线', visible: layersVisible.value[HD_LAYER_IDS.MARKINGS_DOUBLE] },
  { id: HD_LAYER_IDS.MARKINGS_DASHED, label: '车道线', visible: layersVisible.value[HD_LAYER_IDS.MARKINGS_DASHED] },
  { id: HD_LAYER_IDS.MARKINGS_SOLID, label: '硬边界', visible: layersVisible.value[HD_LAYER_IDS.MARKINGS_SOLID] },
  { id: HD_LAYER_IDS.STOP_LINES, label: '停止线', visible: layersVisible.value[HD_LAYER_IDS.STOP_LINES] },
  { id: HD_LAYER_IDS.CROSSWALKS, label: '人行横道', visible: layersVisible.value[HD_LAYER_IDS.CROSSWALKS] },
  { id: HD_LAYER_IDS.TRAFFIC_LIGHTS, label: '红绿灯', visible: layersVisible.value[HD_LAYER_IDS.TRAFFIC_LIGHTS] },
  // { id: HD_LAYER_IDS.SIGNS, label: '交通标志', visible: layersVisible.value[HD_LAYER_IDS.SIGNS] }
])

const allLayersVisible = computed(() =>
  Object.values(layersVisible.value).every(Boolean)
)

const footerButtons = computed(() => [
  {
    label: hdMapLoaded.value ? '重新加载' : '加载高精地图',
    icon: Upload,
    onClick: loadHdMap
  },
  {
    label: allLayersVisible.value ? '隐藏全部' : '显示全部',
    icon: allLayersVisible.value ? EyeOff : Eye,
    onClick: toggleAllLayers,
    disabled: !hdMapLoaded.value
  },
  {
    label: '聚焦路口',
    icon: Layers,
    onClick: focusIntersection,
    disabled: !hdMapLoaded.value
  },
])

onMounted(() => initMap())
onBeforeUnmount(() => {
  removeHdMapLayers()
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})

/**
 * 初始化地图，加载矢量底图后渲染高精地图
 */
async function initMap() {
  try {
    await bicMap.init()
    map.value = bicMap.createMap({
      container: 'outdoorHdMap',
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
      loadHdMap()
    })
  } catch (error) {
    console.error('初始化地图失败:', error)
  }
}

/**
 * 加载矢量底图；灰色道路面宽度与高精车道面 LANE_HALF_WIDTH 对齐
 */
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

  src('basemap-road-surfaces', MOCK_ROAD_SURFACES)
  lyr({ id: 'basemap-roads-fill-primary', source: 'basemap-road-surfaces', type: 'fill', filter: ['==', ['get', 'road_type'], 'primary'], paint: { 'fill-color': '#BFBFBF', 'fill-opacity': 1 } })
  lyr({ id: 'basemap-roads-fill-secondary', source: 'basemap-road-surfaces', type: 'fill', filter: ['==', ['get', 'road_type'], 'secondary'], paint: { 'fill-color': '#c8c8c8', 'fill-opacity': 1 } })
  lyr({ id: 'basemap-roads-outline', source: 'basemap-road-surfaces', type: 'line', paint: { 'line-color': '#d0d0d0', 'line-width': 1, 'line-opacity': 0.9 } })

  src('basemap-roads', MOCK_ROADS)
  lyr({ id: 'basemap-roads-centerline', source: 'basemap-roads', type: 'line', filter: ['==', ['get', 'marking'], 'centerline'], paint: { 'line-color': '#f0c040', 'line-width': 1.5, 'line-dasharray': [1.5, 3], 'line-opacity': 0.9 } })

  src('basemap-crosswalks', MOCK_CROSSWALKS)
  lyr({ id: 'basemap-crosswalks-fill', source: 'basemap-crosswalks', type: 'fill', paint: { 'fill-color': '#f5f5f5', 'fill-opacity': 0.9 } })
  lyr({ id: 'basemap-crosswalks-outline', source: 'basemap-crosswalks', type: 'line', paint: { 'line-color': '#dddddd', 'line-width': 0.5, 'line-opacity': 0.8 } })
}

/**
 * 加载（或重新加载）高精地图图层
 */
async function loadHdMap() {
  if (!map.value) return
  removeHdMapLayers()
  await addHdMapLayers()
  hdMapLoaded.value = true
  fitView()
}

/**
 * 加载自行车图标至地图 sprite
 * @param {Object} m
 * @returns {Promise<void>}
 */
function ensureMapIcon(m, iconId, iconSrc) {
  if (m.hasImage(iconId)) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      if (!m.hasImage(iconId)) {
        m.addImage(iconId, img, { pixelRatio: 2 })
      }
      resolve()
    }
    img.onerror = reject
    img.src = iconSrc
  })
}

/**
 * 加载自行车图标至地图 sprite
 * @param {Object} m
 * @returns {Promise<void>}
 */
function ensureBikeIcon(m) {
  return ensureMapIcon(m, BIKE_ICON_ID, iconBike)
}

/**
 * 加载车道方向箭头图标
 * @param {Object} m
 * @returns {Promise<void>}
 */
function ensureLaneArrowIcon(m) {
  if (m.hasImage(LANE_ARROW_ICON_ID)) return Promise.resolve()
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      if (!m.hasImage(LANE_ARROW_ICON_ID)) {
        m.addImage(LANE_ARROW_ICON_ID, img, { pixelRatio: 2 })
      }
      resolve()
    }
    img.onerror = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 24
      canvas.height = 24
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(4, 12)
      ctx.lineTo(18, 12)
      ctx.lineTo(14, 8)
      ctx.moveTo(18, 12)
      ctx.lineTo(14, 16)
      ctx.fill()
      if (!m.hasImage(LANE_ARROW_ICON_ID)) {
        m.addImage(LANE_ARROW_ICON_ID, canvas, { pixelRatio: 4 })
      }
      resolve()
    }
    img.src = LANE_ARROW_IMAGE
  })
}

/**
 * 添加高精地图 GeoJSON 图层
 */
async function addHdMapLayers() {
  const m = map.value

  m.addSource(HD_SOURCE_IDS.LANES, { type: 'geojson', data: MOCK_HD_LANES })
  m.addLayer({
    id: HD_LAYER_IDS.DRIVING_LANES,
    type: 'fill',
    source: HD_SOURCE_IDS.LANES,
    filter: ['==', ['get', 'lane_type'], 'driving'],
    paint: {
      'fill-color': '#bbdefb',
      'fill-opacity': 0.55
    }
  })
  m.addLayer({
    id: HD_LAYER_IDS.BICYCLE_LANES,
    type: 'fill',
    source: HD_SOURCE_IDS.LANES,
    filter: ['==', ['get', 'lane_type'], 'bicycle'],
    paint: {
      'fill-color': '#ffe082',
      'fill-opacity': 0.55
    }
  })

  await ensureBikeIcon(m)
  m.addSource(HD_SOURCE_IDS.BICYCLE_LANE_LINES, { type: 'geojson', data: MOCK_HD_BICYCLE_LANE_LINES })
  m.addLayer({
    id: HD_LAYER_IDS.BICYCLE_ICONS,
    type: 'symbol',
    source: HD_SOURCE_IDS.BICYCLE_LANE_LINES,
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': BIKE_ICON_SPACING,
      'icon-image': BIKE_ICON_ID,
      'icon-size': 1.5,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true
    }
  })

  m.addSource(HD_SOURCE_IDS.MARKINGS, { type: 'geojson', data: MOCK_HD_MARKINGS })

  m.addLayer({
    id: HD_LAYER_IDS.MARKINGS_DOUBLE,
    type: 'line',
    source: HD_SOURCE_IDS.MARKINGS,
    filter: ['==', ['get', 'marking_type'], 'double_yellow'],
    paint: {
      'line-color': '#f9a825',
      'line-width': 2.5,
      'line-opacity': 0.95
    }
  })

  m.addLayer({
    id: HD_LAYER_IDS.MARKINGS_DASHED,
    type: 'line',
    source: HD_SOURCE_IDS.MARKINGS,
    filter: ['==', ['get', 'marking_type'], 'dashed_white'],
    paint: {
      'line-color': '#ffffff',
      'line-width': 1.8,
      'line-dasharray': [2, 3],
      'line-opacity': 0.95
    }
  })

  await ensureLaneArrowIcon(m)
  m.addSource(HD_SOURCE_IDS.LANE_LINES, { type: 'geojson', data: MOCK_HD_DASHED_LANE_LINES })
  m.addLayer({
    id: HD_LAYER_IDS.LANE_ARROWS,
    type: 'symbol',
    source: HD_SOURCE_IDS.LANE_LINES,
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': LANE_ARROW_SPACING,
      'icon-image': LANE_ARROW_ICON_ID,
      'icon-size': LANE_ARROW_ICON_SIZE,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true
    }
  })

  m.addLayer({
    id: HD_LAYER_IDS.MARKINGS_SOLID,
    type: 'line',
    source: HD_SOURCE_IDS.MARKINGS,
    filter: ['==', ['get', 'marking_type'], 'solid_white'],
    paint: {
      'line-color': '#F53A15',
      'line-width': 2,
      'line-opacity': 0.95
    }
  })

  m.addSource(HD_SOURCE_IDS.STOP_LINES, { type: 'geojson', data: MOCK_HD_STOP_LINES })
  m.addLayer({
    id: HD_LAYER_IDS.STOP_LINES,
    type: 'line',
    source: HD_SOURCE_IDS.STOP_LINES,
    paint: {
      'line-color': '#ffffff',
      'line-width': 4,
      'line-opacity': 1
    }
  })

  m.addSource(HD_SOURCE_IDS.CROSSWALKS, { type: 'geojson', data: MOCK_HD_CROSSWALKS })
  m.addLayer({
    id: HD_LAYER_IDS.CROSSWALKS,
    type: 'fill',
    source: HD_SOURCE_IDS.CROSSWALKS,
    filter: ['==', ['get', 'feature_type'], 'zone'],
    paint: {
      'fill-color': '#e0e0e0',
      'fill-opacity': 0.35
    }
  })
  m.addLayer({
    id: HD_LAYER_IDS.CROSSWALK_STRIPES,
    type: 'fill',
    source: HD_SOURCE_IDS.CROSSWALKS,
    filter: ['==', ['get', 'feature_type'], 'stripe'],
    paint: {
      'fill-color': '#ffffff',
      'fill-opacity': 1
    }
  })

  m.addSource(HD_SOURCE_IDS.TRAFFIC_LIGHTS, { type: 'geojson', data: MOCK_HD_TRAFFIC_LIGHT_POLES })
  m.addLayer({
    id: HD_LAYER_IDS.TRAFFIC_LIGHTS,
    type: 'fill-extrusion',
    source: HD_SOURCE_IDS.TRAFFIC_LIGHTS,
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['get', 'base_height'],
      'fill-extrusion-opacity': 0.93
    }
  })

  // m.addSource(HD_SOURCE_IDS.SIGNS, { type: 'geojson', data: MOCK_HD_SIGNS })
  // m.addLayer({
  //   id: HD_LAYER_IDS.SIGNS,
  //   type: 'circle',
  //   source: HD_SOURCE_IDS.SIGNS,
  //   paint: {
  //     'circle-radius': 7,
  //     'circle-color': [
  //       'match',
  //       ['get', 'sign_type'],
  //       'speed_limit', '#ef5350',
  //       'traffic_light', '#43a047',
  //       'yield', '#fb8c00',
  //       '#78909c'
  //     ],
  //     'circle-stroke-width': 2,
  //     'circle-stroke-color': '#ffffff'
  //   }
  // })
  // m.addLayer({
  //   id: `${HD_LAYER_IDS.SIGNS}-label`,
  //   type: 'symbol',
  //   source: HD_SOURCE_IDS.SIGNS,
  //   layout: {
  //     'text-field': ['get', 'value'],
  //     'text-size': 11,
  //     'text-offset': [0, 1.6],
  //     'text-anchor': 'top'
  //   },
  //   paint: {
  //     'text-color': '#263238',
  //     'text-halo-color': '#ffffff',
  //     'text-halo-width': 1.5
  //   }
  // })
}

/**
 * 移除高精地图图层与数据源
 */
function removeHdMapLayers() {
  if (!map.value) return
  const m = map.value
  const layerIds = [
    `${HD_LAYER_IDS.SIGNS}-label`,
    HD_LAYER_IDS.SIGNS,
    HD_LAYER_IDS.TRAFFIC_LIGHTS,
    HD_LAYER_IDS.CROSSWALK_STRIPES,
    HD_LAYER_IDS.CROSSWALKS,
    HD_LAYER_IDS.STOP_LINES,
    HD_LAYER_IDS.MARKINGS_SOLID,
    HD_LAYER_IDS.LANE_ARROWS,
    HD_LAYER_IDS.MARKINGS_DASHED,
    HD_LAYER_IDS.MARKINGS_DOUBLE,
    HD_LAYER_IDS.BICYCLE_ICONS,
    HD_LAYER_IDS.BICYCLE_LANES,
    HD_LAYER_IDS.DRIVING_LANES
  ]
  layerIds.forEach((id) => {
    if (m.getLayer(id)) m.removeLayer(id)
  })
  Object.values(HD_SOURCE_IDS).forEach((id) => {
    if (m.getSource(id)) m.removeSource(id)
  })
  if (m.hasImage(BIKE_ICON_ID)) m.removeImage(BIKE_ICON_ID)
  if (m.hasImage(LANE_ARROW_ICON_ID)) m.removeImage(LANE_ARROW_ICON_ID)
  hdMapLoaded.value = false
}

/**
 * 切换单个高精图层的显隐
 * @param {string} layerId
 * @param {boolean} visible
 */
function toggleLayer(layerId, visible) {
  if (!map.value?.getLayer(layerId)) return
  map.value.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
  layersVisible.value[layerId] = visible

  if (layerId === HD_LAYER_IDS.BICYCLE_LANES && map.value.getLayer(HD_LAYER_IDS.BICYCLE_ICONS)) {
    map.value.setLayoutProperty(HD_LAYER_IDS.BICYCLE_ICONS, 'visibility', visible ? 'visible' : 'none')
    layersVisible.value[HD_LAYER_IDS.BICYCLE_ICONS] = visible
  }

  if (layerId === HD_LAYER_IDS.MARKINGS_DASHED && map.value.getLayer(HD_LAYER_IDS.LANE_ARROWS)) {
    map.value.setLayoutProperty(HD_LAYER_IDS.LANE_ARROWS, 'visibility', visible ? 'visible' : 'none')
    layersVisible.value[HD_LAYER_IDS.LANE_ARROWS] = visible
  }

  if (layerId === HD_LAYER_IDS.CROSSWALKS && map.value.getLayer(HD_LAYER_IDS.CROSSWALK_STRIPES)) {
    map.value.setLayoutProperty(HD_LAYER_IDS.CROSSWALK_STRIPES, 'visibility', visible ? 'visible' : 'none')
    layersVisible.value[HD_LAYER_IDS.CROSSWALK_STRIPES] = visible
  }

  const labelId = `${HD_LAYER_IDS.SIGNS}-label`
  if (layerId === HD_LAYER_IDS.SIGNS && map.value.getLayer(labelId)) {
    map.value.setLayoutProperty(labelId, 'visibility', visible ? 'visible' : 'none')
  }
}

/**
 * 切换全部高精图层显隐
 */
function toggleAllLayers() {
  const next = !allLayersVisible.value
  Object.keys(layersVisible.value).forEach((id) => toggleLayer(id, next))
}

/**
 * 聚焦至创业路×东环路路口，放大展示人行横道
 */
function focusIntersection() {
  if (!map.value) return
  map.value.fitBounds(HD_CROSSWALK_FOCUS_BOUNDS, {
    padding: { top: 50, bottom: 80, left: 50, right: 300 },
    pitch: MAP_PITCH,
    bearing: MAP_BEARING,
    duration: 1000,
    maxZoom: 19
  })
}

/**
 * 适配高精地图整体覆盖区域
 */
function fitView() {
  if (!map.value) return
  map.value.fitBounds(FOCUS_BOUNDS, {
    padding: 80,
    pitch: MAP_PITCH,
    bearing: MAP_BEARING,
    duration: 1000
  })
}

/**
 * 重置场景：重新加载高精地图并飞回初始视角
 */
function resetScene() {
  loadHdMap()
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
  padding: 14px 16px 16px;
  border-radius: 14px;
  background: rgba(5, 18, 48, 0.82);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(80, 140, 255, 0.28);
  box-shadow: 0 6px 24px rgba(0, 20, 80, 0.4);
  color: #cfe4ff;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .hud-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.08em;
    color: #fff;
    margin-bottom: 2px;
  }

  .hud-bar {
    width: 4px;
    height: 14px;
    border-radius: 2px;
    background: linear-gradient(180deg, #06b6d4 0%, #3b82f6 100%);
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
    flex-shrink: 0;
  }

  .hud-section-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: #6a9fd8;
    margin-top: 2px;
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
    text-align: right;

    &--accent {
      color: #67e8f9;
      text-shadow: 0 0 8px rgba(103, 232, 249, 0.4);
    }
  }

  .hud-toggles {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .hud-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: #a0c4f8;
    font-size: 11px;

    input {
      accent-color: #3b82f6;
      cursor: pointer;
    }

    input:disabled + span {
      opacity: 0.45;
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
    margin: 4px 0;
  }

  .hud-tip {
    font-size: 11px;
    line-height: 1.5;
    color: #8eb4e6;
  }
}
</style>
