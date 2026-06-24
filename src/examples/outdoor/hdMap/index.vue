<!--
 * @Date: 2026-06-15 10:00:00
 * @LastEditTime: 2026-06-24 18:05:38
 * @Description: 室外高精地图加载示例：在 GeoJSON 矢量底图上叠加车道面、标线、停止线与交通标志图层，支持图层显隐切换
 * @FilePath: /bic-map/src/examples/outdoor/hdMap/index.vue
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
  Upload
} from 'lucide-vue-next'

import AppFooter from '../../components/AppFooter.vue'
import AppHeader from '../../components/AppHeader.vue'

import iconBike from '../../assets/icons/icon-bike.svg'
import iconStraight from '../../assets/icons/icon-stright.svg'
import iconTurnLeft from '../../assets/icons/icon-turn-left.svg'
import iconTraffic from '../../assets/icons/icon-traffic.svg'

import bicMap from '../../../bicMap/core/bicmap-gl'
import {
  MAP_BEARING,
  MAP_CENTER,
  MAP_PITCH,
  MAP_ZOOM,
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
  LANE_TURN_ICON_SIZE,
  LANE_TURN_LEFT_ICON_ID,
  LANE_TURN_STRAIGHT_ICON_ID,
  MOCK_HD_BICYCLE_LANE_LINES,
  MOCK_HD_CROSSWALKS,
  HD_CROSSWALK_FOCUS_BOUNDS,
  HD_CROSSWALK_LOCATION_COUNT,
  MOCK_HD_LANES,
  MOCK_HD_LANE_TURN_MARKERS,
  MOCK_HD_MARKINGS,
  MOCK_HD_SIGNS,
  MOCK_HD_STOP_LINES,
  MOCK_HD_TRAFFIC_LIGHTS,
  TRAFFIC_LIGHT_ICON_ID,
  TRAFFIC_LIGHT_ICON_SIZE,
} from './mockHdMapData'

const map = ref(null)
const hdMapLoaded = ref(false)
const layersVisible = ref({
  [HD_LAYER_IDS.DRIVING_LANES]: true,
  [HD_LAYER_IDS.BICYCLE_LANES]: true,
  [HD_LAYER_IDS.BICYCLE_ICONS]: true,
  [HD_LAYER_IDS.MARKINGS_SOLID]: true,
  [HD_LAYER_IDS.MARKINGS_DASHED]: true,
  [HD_LAYER_IDS.MARKINGS_DOUBLE]: true,
  [HD_LAYER_IDS.LANE_TURN_MARKERS]: true,
  [HD_LAYER_IDS.STOP_LINES]: true,
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
const crosswalkCount = computed(() => HD_CROSSWALK_LOCATION_COUNT)
const trafficLightCount = computed(() => MOCK_HD_TRAFFIC_LIGHTS.features.length)

const layerToggles = computed(() => [
  { id: HD_LAYER_IDS.DRIVING_LANES, label: '车道', visible: layersVisible.value[HD_LAYER_IDS.DRIVING_LANES] },
  { id: HD_LAYER_IDS.BICYCLE_LANES, label: '自行车道', visible: layersVisible.value[HD_LAYER_IDS.BICYCLE_LANES] },
  { id: HD_LAYER_IDS.MARKINGS_DOUBLE, label: '双黄线', visible: layersVisible.value[HD_LAYER_IDS.MARKINGS_DOUBLE] },
  { id: HD_LAYER_IDS.MARKINGS_DASHED, label: '车道线', visible: layersVisible.value[HD_LAYER_IDS.MARKINGS_DASHED] },
  { id: HD_LAYER_IDS.LANE_TURN_MARKERS, label: '导向箭头', visible: layersVisible.value[HD_LAYER_IDS.LANE_TURN_MARKERS] },
  { id: HD_LAYER_IDS.MARKINGS_SOLID, label: '硬边界', visible: layersVisible.value[HD_LAYER_IDS.MARKINGS_SOLID] },
  { id: HD_LAYER_IDS.STOP_LINES, label: '停止线', visible: layersVisible.value[HD_LAYER_IDS.STOP_LINES] },
  { id: HD_LAYER_IDS.CROSSWALK_STRIPES, label: '人行横道', visible: layersVisible.value[HD_LAYER_IDS.CROSSWALK_STRIPES] },
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
])

onMounted(() => initMap())
onBeforeUnmount(() => {
  removeHdMapLayers()
  if (map.value) {
    map.value.off('click', handleMapClick)
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
    map.value.on('click', handleMapClick)
    map.value.on('load', () => {
      addMockBasemap()
      loadHdMap()
    })
  } catch (error) {
    console.error('初始化地图失败:', error)
  }
}

/**
 * 地图点击：输出点击位置经纬度
 * @param {Object} e
 */
function handleMapClick(e) {
  const { lng, lat } = e.lngLat
  console.log(`点击位置经纬度: [${lng.toFixed(6)}, ${lat.toFixed(6)}]`)
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
  lyr({
    id: 'basemap-roads-labels',
    source: 'basemap-roads',
    type: 'symbol',
    filter: ['has', 'road_type'],
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'name'],
      'text-size': 14,
      'text-optional': true,
      'symbol-spacing': 400,
      'text-allow-overlap': false,
      'text-ignore-placement': false
    },
    paint: {
      'text-color': '#4a4a4a',
      'text-halo-color': '#ffffff',
      'text-halo-width': 2,
      'text-halo-blur': 1,
      'text-opacity': 1
    }
  })

}

/**
 * 加载（或重新加载）高精地图图层
 */
async function loadHdMap() {
  if (!map.value) return
  removeHdMapLayers()
  await addHdMapLayers()
  hdMapLoaded.value = true
  focusIntersection()
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
 * 加载路口红绿灯图标至地图 sprite
 * @param {Object} m
 * @returns {Promise<void>}
 */
function ensureTrafficLightIcon(m) {
  return ensureMapIcon(m, TRAFFIC_LIGHT_ICON_ID, iconTraffic)
}

/**
 * 加载车道导向图标至地图 sprite
 * @param {Object} m
 * @returns {Promise<void>}
 */
async function ensureLaneTurnIcons(m) {
  await Promise.all([
    ensureMapIcon(m, LANE_TURN_STRAIGHT_ICON_ID, iconStraight),
    ensureMapIcon(m, LANE_TURN_LEFT_ICON_ID, iconTurnLeft)
  ])
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
      'fill-opacity': 0.1
    }
  })
  m.addLayer({
    id: HD_LAYER_IDS.BICYCLE_LANES,
    type: 'fill',
    source: HD_SOURCE_IDS.LANES,
    filter: ['==', ['get', 'lane_type'], 'bicycle'],
    paint: {
      'fill-color': '#ffe082',
      'fill-opacity': 0.1
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
      'icon-size': 1.85,
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
      'line-color': '#dcd08e',
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

  m.addLayer({
    id: HD_LAYER_IDS.MARKINGS_SOLID,
    type: 'line',
    source: HD_SOURCE_IDS.MARKINGS,
    filter: ['==', ['get', 'marking_type'], 'solid_white'],
    paint: {
      'line-color': '#9adfc7',
      'line-width': 4,
      'line-opacity': 1
    }
  })

  await ensureLaneTurnIcons(m)
  m.addSource(HD_SOURCE_IDS.LANE_TURN_MARKERS, { type: 'geojson', data: MOCK_HD_LANE_TURN_MARKERS })
  m.addLayer({
    id: HD_LAYER_IDS.LANE_TURN_MARKERS,
    type: 'symbol',
    source: HD_SOURCE_IDS.LANE_TURN_MARKERS,
    layout: {
      'icon-image': [
        'match',
        ['get', 'turn_type'],
        'straight', LANE_TURN_STRAIGHT_ICON_ID,
        'straight_left', LANE_TURN_LEFT_ICON_ID,
        LANE_TURN_STRAIGHT_ICON_ID
      ],
      'icon-size': LANE_TURN_ICON_SIZE,
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      'icon-anchor': 'center',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true
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
    id: HD_LAYER_IDS.CROSSWALK_STRIPES,
    type: 'fill',
    source: HD_SOURCE_IDS.CROSSWALKS,
    filter: ['==', ['get', 'feature_type'], 'stripe'],
    paint: {
      'fill-color': '#ffffff',
      'fill-opacity': 1
    }
  })

  await ensureTrafficLightIcon(m)
  m.addSource(HD_SOURCE_IDS.TRAFFIC_LIGHTS, { type: 'geojson', data: MOCK_HD_TRAFFIC_LIGHTS })
  m.addLayer({
    id: HD_LAYER_IDS.TRAFFIC_LIGHTS,
    type: 'symbol',
    source: HD_SOURCE_IDS.TRAFFIC_LIGHTS,
    layout: {
      'icon-image': TRAFFIC_LIGHT_ICON_ID,
      'icon-size': TRAFFIC_LIGHT_ICON_SIZE,
      'icon-anchor': 'center',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true
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
    HD_LAYER_IDS.STOP_LINES,
    HD_LAYER_IDS.LANE_TURN_MARKERS,
    HD_LAYER_IDS.MARKINGS_SOLID,
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
  if (m.hasImage(TRAFFIC_LIGHT_ICON_ID)) m.removeImage(TRAFFIC_LIGHT_ICON_ID)
  if (m.hasImage(LANE_TURN_STRAIGHT_ICON_ID)) m.removeImage(LANE_TURN_STRAIGHT_ICON_ID)
  if (m.hasImage(LANE_TURN_LEFT_ICON_ID)) m.removeImage(LANE_TURN_LEFT_ICON_ID)
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
    duration: 0,
    maxZoom: 19
  })
}

/**
 * 重置场景：重新加载高精地图并飞回路口视角
 */
function resetScene() {
  loadHdMap()
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
