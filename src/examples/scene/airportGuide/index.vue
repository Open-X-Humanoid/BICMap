<!--
 * @Author: Ella ella.yin@x-humanoid.com
 * @Date: 2026-06-09
 * @Description: 飞机场导览 Demo — 航班驱动人机 escort + SLAM 底图
 * @FilePath: /bic-map/src/examples/scene/airportGuide/index.vue
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="airport-guide">
    <canvas id="airportCanvasMap" class="airport-guide__canvas"></canvas>

    <AppHeader title="飞机场导览" />

    <main class="airport-guide__main">
      <div class="airport-guide__grid"></div>

      <aside class="airport-guide__panel">
        <FlightBoard
          :flights="flights"
          :active-flight-id="activeFlight?.id || ''"
          @search="onSearchFlight"
          @select="onSelectFlight"
        />
        <FlightInteractionPanel
          :prompt-text="promptText"
          :task-text="taskText"
          :urgent-text="urgentText"
          :arrival-card="arrivalCard"
          :show-confirm-yes="showConfirmYes"
          :show-confirm-no="showConfirmNo"
          :show-depart="showDepart"
          :show-continue="showContinue"
          @confirm-yes="onConfirmYes"
          @confirm-no="onConfirmNo"
          @depart="departCurrentLeg"
          @continue="continueNextLeg"
        />
      </aside>

      <section class="airport-guide__map-card">
        <div id="airportMap" class="airport-guide__map"></div>
<!-- 
        <aside class="airport-guide__waypoints" aria-label="预设路径点">
          <div class="airport-guide__panel-title">
            预设路径点
            <small v-if="routeList.length">{{ routeList.length }} 条路线</small>
          </div>

          <p v-if="!latestRoute" class="airport-guide__empty">
            使用底部「开始选点」绘制开发用路径坐标
          </p>

          <template v-else>
            <p class="airport-guide__route-summary">
              路线 {{ routeList.length }} · {{ latestRoute.pointCount }} 个点
            </p>
            <div class="airport-guide__points-scroll">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>xFrac</th>
                    <th>yFrac</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="wp in latestRoute.waypoints" :key="wp.index">
                    <td>{{ wp.index }}</td>
                    <td class="tabular">{{ wp.xFrac }}</td>
                    <td class="tabular">{{ wp.yFrac }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <pre class="airport-guide__json">{{ latestRoute.fracJson }}</pre>
          </template>
        </aside> -->

        <div class="airport-guide__legend" aria-label="地点图标图例">
          <span
            v-for="item in legendItems"
            :key="item.icon"
            class="airport-guide__legend-item"
          >
            <img :src="POI_ICONS[item.icon]" :alt="item.label" class="airport-guide__legend-icon">
            {{ item.label }}
          </span>
        </div>
      </section>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { Copy, Maximize, Pencil, Trash2 } from 'lucide-vue-next'

import AppFooter from '../../components/AppFooter.vue'
import AppHeader from '../../components/AppHeader.vue'
import FlightBoard from './components/FlightBoard.vue'
import FlightInteractionPanel from './components/FlightInteractionPanel.vue'

import airportSlamImage from '../../assets/slam_airport_transparent.png'

import bicMap from '@/bicMap/core/bicmap-gl'
import { LAYER_IDS } from '@/bicMap/core/layers/layerConfig.js'
import { ROBOT_STATUS, addStatusRobotMarkers } from '@/examples/utils/robot'
import { getPoiById } from './airportRoutes.js'
import { AIRPORT_POIS, fracToGPS } from './airportLayout.js'
import {
  AIRPORT_MAP_CONFIG,
  DRAWING_OPTIONS,
  GUIDE_ROBOT_ID,
  GUIDE_ROUTE_STYLE,
  MAP_CENTER,
  MAP_ZOOM,
  ROBOT_STANDBY_POI_ID,
} from './constants.js'
import { buildWaypointList, logPresetWaypoints } from './geoUtils.js'
import { cloneFlights, findFlightByQuery } from './flightSchedule.js'
import { POI_ICON_LEGEND, POI_ICONS } from './poiIcons.js'
import { useAirportJourney } from './useAirportJourney.js'

const CANVAS_ID = 'airportCanvasMap'
const MAP_CONTAINER_ID = 'airportMap'

let map = null
let robotCtrl = null
let routePolyCtrl = null
let drawingController = null
let cameraBound = null
const poiMarkers = []

const flights = ref(cloneFlights())
const mapReady = ref(false)
const isDrawing = ref(false)
const routeList = ref([])
const activePoiId = ref('')
const legendItems = POI_ICON_LEGEND

const getMap = () => map
const getRobotCtrl = () => robotCtrl
const getRoutePolyCtrl = () => routePolyCtrl

const {
  activeFlight,
  urgentText,
  isGuiding,
  arrivalCard,
  taskText,
  promptText,
  showConfirmYes,
  showConfirmNo,
  showDepart,
  showContinue,
  searchFlight,
  confirmFastCheckin,
  confirmBaggage,
  departCurrentLeg,
  continueNextLeg,
  initRobotAtStandby,
  cleanup: cleanupJourney,
} = useAirportJourney({
  getMap,
  getRobotCtrl,
  getRoutePolyCtrl,
  fracToGPS,
  onHighlightPoi: highlightPoi,
})

const hasRoute = computed(() => routeList.value.length > 0)

const latestRoute = computed(() => {
  if (!routeList.value.length) return null
  return routeList.value[routeList.value.length - 1]
})

const footerButtons = computed(() => [
  { label: '适应地图', icon: Maximize, disabled: !mapReady.value, onClick: zoomToFit },
  // {
  //   label: isDrawing.value ? '停止选点' : '开始选点',
  //   active: isDrawing.value,
  //   icon: Pencil,
  //   disabled: !mapReady.value || isGuiding.value,
  //   onClick: toggleDrawing,
  // },
  // {
  //   label: '清除路线',
  //   icon: Trash2,
  //   disabled: !hasRoute.value || isGuiding.value,
  //   onClick: clearRoutes,
  // },
  // {
  //   label: '复制坐标',
  //   icon: Copy,
  //   disabled: !latestRoute.value || isGuiding.value,
  //   onClick: copyLatestRoute,
  // },
])

onMounted(() => initMap())
onBeforeUnmount(() => cleanup())

/**
 * 初始化 BicMap 并加载机场 SLAM 底图
 */
async function initMap() {
  try {
    await bicMap.init()
    map = bicMap.createMap({
      container: MAP_CONTAINER_ID,
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      backgroundColor: '#f7fbff',
    })
    bicMap.addZoomControl(map, 'bottom-right')
    map.on('load', () => {
      loadAirportSlamMap()
    })
  } catch (error) {
    console.error('[AirportGuide] 初始化地图失败:', error)
  }
}

/**
 * 加载机场透明 SLAM 栅格图作为底图
 */
async function loadAirportSlamMap() {
  if (!map) return
  try {
    const { startX, startY, xGridCount, yGridCount, resolution } = AIRPORT_MAP_CONFIG
    const result = await bicMap.loadSlamMap(map, {
      startX,
      startY,
      xGridCount,
      yGridCount,
      resolution,
      imagePath: airportSlamImage,
      canvasId: CANVAS_ID,
      fitBounds: true,
    })
    cameraBound = result.cameraBound
    mapReady.value = true
    setupScene()
  } catch (error) {
    console.error('[AirportGuide] 加载机场底图失败:', error)
  }
}

function setupScene() {
  routePolyCtrl = bicMap.createPolylines(map, [], {
    showArrow: GUIDE_ROUTE_STYLE.showArrow,
    arrowSpacing: GUIDE_ROUTE_STYLE.arrowSpacing,
    arrowSize: GUIDE_ROUTE_STYLE.arrowSize,
    arrowImagePath: GUIDE_ROUTE_STYLE.arrowImagePath,
  })
  addPoiMarkers()
  addGuideRobot()
}

function addGuideRobot() {
  const standbyPoi = getPoiById(ROBOT_STANDBY_POI_ID)
  if (!standbyPoi) return
  robotCtrl = addStatusRobotMarkers(map, [{
    id: GUIDE_ROBOT_ID,
    name: '导览机器人',
    status: ROBOT_STATUS.IDLE,
    battery: 92,
    task: '待机中',
    lngLat: fracToGPS(standbyPoi.xFrac + 0.02, standbyPoi.yFrac),
    rotation: 0,
  }], { size: 24 })
  initRobotAtStandby(robotCtrl)
}

function addPoiMarkers() {
  clearPoiMarkers()
  const MapLibre = window.maplibregl
  if (!MapLibre || !map) return

  AIRPORT_POIS.forEach((poi) => {
    const iconSrc = POI_ICONS[poi.icon]
    if (!iconSrc) return

    const el = document.createElement('div')
    el.className = 'airport-poi-marker'
    if (poi.id === activePoiId.value) {
      el.classList.add('airport-poi-marker--active')
    }

    const pin = document.createElement('div')
    pin.className = 'airport-poi-marker__pin'
    pin.title = poi.name
    pin.tabIndex = 0

    const img = document.createElement('img')
    img.src = iconSrc
    img.alt = poi.name
    img.className = 'airport-poi-marker__icon'
    pin.appendChild(img)

    const tooltip = document.createElement('span')
    tooltip.className = 'airport-poi-marker__tooltip'
    tooltip.textContent = poi.name
    pin.appendChild(tooltip)

    el.appendChild(pin)

    const marker = new MapLibre.Marker({ element: el, anchor: 'bottom' })
      .setLngLat(fracToGPS(poi.xFrac, poi.yFrac))
      .addTo(map)

    poiMarkers.push({ id: poi.id, marker })
  })
}

/**
 * 高亮当前导览目标 POI
 * @param {string} poiId
 */
function highlightPoi(poiId) {
  activePoiId.value = poiId
  poiMarkers.forEach(({ id, marker }) => {
    const el = marker.getElement()
    const isActive = !!poiId && id === poiId
    el.classList.toggle('airport-poi-marker--active', isActive)
    el.style.zIndex = isActive ? '10' : ''
  })
}

function clearPoiMarkers() {
  poiMarkers.forEach(({ marker }) => marker.remove())
  poiMarkers.length = 0
}

function zoomToFit() {
  if (!map || !cameraBound) return
  map.easeTo({ ...cameraBound, duration: 600 })
}

/**
 * @param {string} query
 */
function onSearchFlight(query) {
  const flight = findFlightByQuery(query)
  searchFlight(flight ? { ...flight } : null)
}

/**
 * @param {object} flight
 */
function onSelectFlight(flight) {
  searchFlight({ ...flight })
}

function onConfirmYes() {
  if (activeFlight.value?.destination === '上海') {
    confirmFastCheckin()
    return
  }
  confirmBaggage(true)
}

function onConfirmNo() {
  confirmBaggage(false)
}

function toggleDrawing() {
  if (isGuiding.value) return
  if (isDrawing.value) {
    drawingController?.disable()
    isDrawing.value = false
    return
  }
  enableDrawing()
  isDrawing.value = true
}

function enableDrawing() {
  if (!map) return
  drawingController?.disable()
  drawingController = null
  drawingController = bicMap.enablePolylineDrawing(map, {
    ...DRAWING_OPTIONS,
    onDrawComplete: handleDrawComplete,
  })
  syncDrawingStyle()
}

function handleDrawComplete(polylineData) {
  const waypoints = buildWaypointList(polylineData.path)
  const fracPairs = waypoints.map((wp) => [wp.xFrac, wp.yFrac])
  routeList.value = [...routeList.value, {
    pointCount: polylineData.pointCount,
    waypoints,
    fracJson: JSON.stringify(fracPairs, null, 2),
    path: polylineData.path,
  }]
  logPresetWaypoints(waypoints, routeList.value.length)
}

function syncDrawingStyle() {
  if (!map?.isStyleLoaded?.()) return
  const o = DRAWING_OPTIONS
  try {
    if (map.getLayer(LAYER_IDS.POLYLINE_DRAW_FILL)) {
      map.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_FILL, 'fill-color', o.fillColor)
      map.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_FILL, 'fill-opacity', o.fillOpacity)
      map.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_FILL, 'fill-outline-color', o.lineColor)
    }
    if (map.getLayer(LAYER_IDS.POLYLINE_DRAW_LINE)) {
      map.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_LINE, 'line-color', o.lineColor)
      map.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_LINE, 'line-width', o.lineWidth)
    }
    if (map.getLayer(LAYER_IDS.POLYLINE_DRAW_POINTS)) {
      map.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_POINTS, 'circle-color', o.pointColor)
      map.setPaintProperty(LAYER_IDS.POLYLINE_DRAW_POINTS, 'circle-radius', o.pointRadius)
    }
  } catch (error) {
    console.warn('[AirportGuide] syncDrawingStyle:', error)
  }
}

function clearRoutes() {
  drawingController?.clearDrawing?.()
  routeList.value = []
}

async function copyLatestRoute() {
  if (!latestRoute.value?.fracJson) return
  try {
    await navigator.clipboard.writeText(latestRoute.value.fracJson)
  } catch (error) {
    console.warn('[AirportGuide] 复制失败:', error)
  }
}

function cleanup() {
  cleanupJourney()
  drawingController?.disable()
  drawingController = null
  robotCtrl?.remove()
  robotCtrl = null
  routePolyCtrl?.remove?.()
  routePolyCtrl = null
  clearPoiMarkers()
  map?.remove()
  map = null
  cameraBound = null
}
</script>

<style lang="scss" scoped>
.airport-guide {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: fixed;
  inset: 0;
  background: linear-gradient(160deg, #e8f4fc 0%, #eef1f8 30%, #f0f6fb 60%, #e6f0fa 100%);

  &__canvas {
    display: none;
  }

  &__main {
    position: relative;
    display: flex;
    gap: 18px;
    flex: 1 1 0;
    min-height: 0;
    padding: 18px 24px;
    z-index: 10;
  }

  &__panel {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: min(340px, 30vw);
    min-width: 280px;
    min-height: 0;
    padding: 14px;
    border-radius: 20px;
    border: 1px solid rgba(126, 170, 215, 0.55);
    background: rgba(255, 255, 255, 0.78);
    box-shadow: 0 18px 50px rgba(49, 91, 143, 0.12);
    backdrop-filter: blur(12px);
    overflow-y: auto;
  }

  &__grid {
    position: absolute;
    inset: 0;
    opacity: 0.04;
    background-image:
      linear-gradient(rgba(14, 165, 233, 1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(14, 165, 233, 1) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
  }

  &__map-card {
    position: relative;
    z-index: 1;
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border: 1px solid rgba(126, 170, 215, 0.62);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.72);
    box-shadow: 0 24px 70px rgba(49, 91, 143, 0.16);
  }

  &__map {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  &__waypoints {
    position: absolute;
    z-index: 20;
    top: 12px;
    right: 12px;
    max-width: min(300px, calc(100% - 24px));
    max-height: min(50vh, 360px);
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 12px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.78);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(14, 165, 233, 0.22);
    box-shadow: 0 8px 32px rgba(14, 165, 233, 0.08);
    font-size: 13px;
    line-height: 1.45;
    color: #0c4a6e;
  }

  &__panel-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #0369a1;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(14, 165, 233, 0.15);

    small {
      font-size: 11px;
      font-weight: 500;
      text-transform: none;
      letter-spacing: 0;
      color: #64748b;
    }
  }

  &__empty {
    margin: 0;
    padding: 12px 4px;
    text-align: center;
    color: #64748b;
    font-size: 12px;
  }

  &__route-summary {
    margin: 0 0 8px;
    font-size: 11px;
    color: #64748b;
  }

  &__points-scroll {
    max-height: min(22vh, 160px);
    overflow: auto;
    border-radius: 8px;
    border: 1px solid rgba(14, 165, 233, 0.18);
    background: rgba(255, 255, 255, 0.55);

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }

    th,
    td {
      padding: 4px 6px;
      text-align: left;
      border-bottom: 1px solid rgba(14, 165, 233, 0.1);
    }

    th {
      position: sticky;
      top: 0;
      background: rgba(224, 242, 254, 0.95);
      font-weight: 600;
      color: #0369a1;
      z-index: 1;
    }

    tr:last-child td {
      border-bottom: none;
    }
  }

  &__json {
    margin: 8px 0 0;
    padding: 8px;
    max-height: 100px;
    overflow: auto;
    border-radius: 8px;
    background: rgba(15, 23, 42, 0.04);
    border: 1px solid rgba(14, 165, 233, 0.12);
    font-size: 10px;
    line-height: 1.4;
    color: #0f172a;
    white-space: pre-wrap;
    word-break: break-all;
  }

  &__legend {
    position: absolute;
    z-index: 15;
    min-width: 300px;
    left: 12px;
    bottom: 12px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
    padding: 8px 14px;
    border: 1px solid rgba(137, 173, 212, 0.45);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 12px 30px rgba(45, 87, 138, 0.12);
    backdrop-filter: blur(14px);
    pointer-events: none;
  }

  &__legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #33506c;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  &__legend-icon {
    width: 16px;
    height: 16px;
    display: block;
    flex-shrink: 0;
  }
}

.tabular {
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, 'SF Mono', monospace;
}

@media (max-width: 768px) {
  .airport-guide__main {
    flex-direction: column;
    padding: 12px;
  }

  .airport-guide__panel {
    width: 100%;
    min-width: 0;
    max-height: 38vh;
  }

  .airport-guide__waypoints {
    left: 8px;
    right: 8px;
    top: auto;
    bottom: 8px;
    max-width: none;
  }
}
</style>

<style lang="scss">
.airport-poi-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;

  &__pin {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 1);
    border: 2px solid rgba(37, 99, 235, 0.65);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
    pointer-events: auto;
    cursor: default;
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  }

  &__icon {
    width: 16px;
    height: 16px;
    display: block;
  }

  &__tooltip {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(15, 23, 42, 0.88);
    color: #f8fafc;
    font-family: system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.15s ease, visibility 0.15s ease;
    pointer-events: none;
    z-index: 2;
  }

  &__pin:hover &__tooltip,
  &__pin:focus-visible &__tooltip {
    opacity: 1;
    visibility: visible;
  }

  &--active &__pin {
    border-color: #2563eb;
    background: #eff6ff;
    box-shadow:
      0 0 0 4px rgba(37, 99, 235, 0.22),
      0 6px 16px rgba(37, 99, 235, 0.45);
    transform: scale(1.18);
  }

  &--active &__icon {
    filter: drop-shadow(0 0 4px rgba(37, 99, 235, 0.75));
  }

  &--active &__pin::after {
    content: '';
    position: absolute;
    inset: -7px;
    border-radius: 50%;
    border: 2px solid rgba(37, 99, 235, 0.55);
    animation: airport-poi-pulse 1.6s ease-out infinite;
    pointer-events: none;
  }

  &--active &__tooltip {
    opacity: 1;
    visibility: visible;
  }
}

@keyframes airport-poi-pulse {
  0% {
    transform: scale(0.9);
    opacity: 0.85;
  }

  100% {
    transform: scale(1.55);
    opacity: 0;
  }
}
</style>
