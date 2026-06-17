<!--
 * @Date: 2026-06-05
 * @Description: 长途客运站导览 Demo — 班次驱动四阶段人机 escort
 * @FilePath: /bic-map/src/examples/scene/passengerStation/index.vue
-->
<template>
  <div class="passenger-station">
    <AppHeader title="长途客运站导览" />

    <main class="passenger-station__main">
      <div class="passenger-station__grid"></div>

      <aside class="passenger-station__panel">
        <DepartureBoard
          :trips="trips"
          :active-trip-id="activeTrip?.id || ''"
          @select="onSelectTrip"
        />
        <JourneyTimeline
          :active-trip="activeTrip"
          :current-stage="journeyStage"
          @search-ticket="onSearchTicket"
        />
      </aside>

      <section class="passenger-station__map-card">
        <div id="passengerStationMap" class="passenger-station__map"></div>

        <RobotInteractionPanel
          v-if="showInteractionPanel"
          :prompt-text="promptText"
          :task-text="taskText"
          :urgent-text="urgentText"
          :arrival-card="arrivalCard"
          :show-confirm-yes="showConfirmYes"
          :show-depart="showDepart"
          :show-continue="showContinue"
          :show-wait="showWait"
          :depart-button-label="departButtonLabel"
          @confirm-yes="confirmTicketGuide"
          @depart="departCurrentStage"
          @continue="continueJourney"
          @wait="onWaitHandler"
          @return-standby="onReturnToStandby"
        />

        <div class="passenger-station__legend">
          <span
            v-for="item in legendItems"
            :key="item.label"
            class="passenger-station__legend-item"
          >
            <i :style="{ backgroundColor: item.color }"></i>
            {{ item.label }}
          </span>
        </div>
      </section>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { Maximize, RotateCcw } from 'lucide-vue-next'

import AppFooter from '../../components/AppFooter.vue'
import AppHeader from '../../components/AppHeader.vue'
import DepartureBoard from './components/DepartureBoard.vue'
import JourneyTimeline from './components/JourneyTimeline.vue'
import RobotInteractionPanel from './components/RobotInteractionPanel.vue'

import bicMap from '@/bicMap/core/bicmap-gl'
import { ROBOT_STATUS, addStatusRobotMarkers } from '@/bicMap/core/robot'

import {
  AREA_FILL_LAYER_ID,
  AREA_OUTLINE_LAYER_ID,
  AREA_SOURCE_ID,
  GUIDE_ROBOT_ID,
  HIGHLIGHT_LAYER_ID,
  HIGHLIGHT_SOURCE_ID,
  ROUTE_LAYER_ID,
  ROUTE_SOURCE_ID,
  ROBOT_STANDBY_POI_ID,
} from './constants.js'
import {
  cloneTrips,
  findTripByTicket,
  MOCK_DEPARTURES,
  updateBayOccupancy,
} from './departureSchedule.js'
import { POI_ICONS } from './poiIcons.js'
import {
  buildAreasGeoJSON,
  fracToGPS,
  LEGEND_ITEMS,
  MAP_CENTER,
  MAP_MAX_ZOOM,
  MAP_ZOOM,
  STATION_AREAS,
  STATION_COLORS,
  STATION_POIS,
} from './passengerStationLayout.js'
import { usePassengerJourney } from './usePassengerJourney.js'

let map = null
let robotCtrl = null
const poiMarkers = []
const areaLabelMarkers = []

const areas = shallowRef(STATION_AREAS.map(a => ({ ...a })))
const trips = ref(cloneTrips(MOCK_DEPARTURES))
const legendItems = LEGEND_ITEMS

const getMap = () => map
const getRobotCtrl = () => robotCtrl

const {
  activeTrip,
  journeyStage,
  arrivalCard,
  showInteractionPanel,
  promptText,
  taskText,
  urgentText,
  showConfirmYes,
  showDepart,
  showContinue,
  showWait,
  departButtonLabel,
  setActiveTrip,
  searchTicket,
  confirmTicketGuide,
  departCurrentStage,
  continueJourney,
  returnToStandby,
  initRobotAtStandby,
  onWait,
  cleanup: cleanupJourney,
} = usePassengerJourney({
  getMap,
  getRobotCtrl,
  areas,
  fracToGPS,
  onReturnStandbyComplete: clearTripHighlight,
})

const footerButtons = computed(() => [
  { label: '适应地图', icon: Maximize, onClick: zoomToFit },
  { label: '返回待机区', icon: RotateCcw, onClick: onReturnToStandby },
])

onMounted(async () => {
  updateBayOccupancy(areas.value, trips.value)
  await initMap()
})

onBeforeUnmount(() => {
  cleanupJourney()
  cleanupMap()
})

async function initMap() {
  await bicMap.init()
  map = bicMap.createMap({
    container: 'passengerStationMap',
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
    maxZoom: MAP_MAX_ZOOM,
    maxPitch: 0,
    pitch: 0,
    bearing: 0,
    backgroundColor: '#f7fbff',
  })
  bicMap.addZoomControl(map, 'bottom-right')
  map.on('load', () => {
    setupScene()
    requestAnimationFrame(() => {
      map.resize()
      zoomToFit()
    })
  })
}

function setupScene() {
  map.addSource(AREA_SOURCE_ID, { type: 'geojson', data: buildAreasGeoJSON(fracToGPS, areas.value) })
  map.addLayer({
    id: AREA_FILL_LAYER_ID,
    type: 'fill',
    source: AREA_SOURCE_ID,
    paint: {
      'fill-color': ['coalesce', ['get', 'color'], STATION_COLORS.waiting],
      'fill-opacity': 0.92,
    },
  })
  map.addLayer({
    id: AREA_OUTLINE_LAYER_ID,
    type: 'line',
    source: AREA_SOURCE_ID,
    paint: {
      'line-color': STATION_COLORS.outline,
      'line-width': 1,
    },
  })

  map.addSource(HIGHLIGHT_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: HIGHLIGHT_LAYER_ID,
    type: 'line',
    source: HIGHLIGHT_SOURCE_ID,
    paint: {
      'line-color': STATION_COLORS.highlight,
      'line-width': 4,
    },
  })

  map.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: ROUTE_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    paint: {
      'line-color': STATION_COLORS.route,
      'line-width': 4,
      'line-opacity': 0.82,
      'line-dasharray': [2, 2],
    },
  })

  addAreaLabels()
  addPoiMarkers()
  addRobot()
}

function refreshAreaLayer() {
  map?.getSource(AREA_SOURCE_ID)?.setData(buildAreasGeoJSON(fracToGPS, areas.value))
  updateHighlight()
}

function clearTripHighlight() {
  if (!map) return
  map.getSource(HIGHLIGHT_SOURCE_ID)?.setData({ type: 'FeatureCollection', features: [] })
}

function updateHighlight() {
  if (!map || !activeTrip.value) {
    clearTripHighlight()
    return
  }
  const bay = areas.value.find(a => a.type === 'boarding-bay' && a.bayNo === activeTrip.value.boardingBay)
  const gate = areas.value.find(a => a.type === 'check-gate' && a.gateNo === activeTrip.value.checkGate)
  const features = [bay, gate].filter(Boolean).map(area => ({
    type: 'Feature',
    properties: { id: area.id },
    geometry: {
      type: 'LineString',
      coordinates: area.polygon.map(([x, y]) => fracToGPS(x, y)),
    },
  }))
  map.getSource(HIGHLIGHT_SOURCE_ID)?.setData({ type: 'FeatureCollection', features })
}

function addAreaLabels() {
  const MapLibre = window.maplibregl
  if (!MapLibre) return
  const areaSource = buildAreasGeoJSON(fracToGPS, areas.value)
  areaSource.features.forEach(feature => {
    const center = getPolygonCenter(feature.geometry.coordinates[0])
    const el = document.createElement('div')
    el.className = 'passenger-area-label'
    el.textContent = feature.properties.name
    const marker = new MapLibre.Marker({ element: el, anchor: 'center' })
      .setLngLat(center)
      .addTo(map)
    areaLabelMarkers.push(marker)
  })
}

function addPoiMarkers() {
  const MapLibre = window.maplibregl
  if (!MapLibre) return
  STATION_POIS.forEach(poi => {
    if (poi.type === '发车位') return
    const iconSrc = POI_ICONS[poi.icon]
    if (!iconSrc) return
    const el = document.createElement('div')
    el.className = 'passenger-poi-marker'
    const img = document.createElement('img')
    img.src = iconSrc
    img.alt = poi.name
    img.className = 'passenger-poi-marker__icon'
    el.appendChild(img)
    const marker = new MapLibre.Marker({ element: el, anchor: 'center' })
      .setLngLat(fracToGPS(poi.xFrac, poi.yFrac))
      .addTo(map)
      .setOffset([0, -20])
    poiMarkers.push(marker)
  })
}

function addRobot() {
  const standbyPoi = STATION_POIS.find(p => p.id === ROBOT_STANDBY_POI_ID)
  robotCtrl = addStatusRobotMarkers(map, [{
    id: GUIDE_ROBOT_ID,
    name: '导览机器人',
    status: ROBOT_STATUS.IDLE,
    battery: 94,
    task: '待机中',
    lngLat: fracToGPS(standbyPoi.xFrac + 0.03, standbyPoi.yFrac),
    rotation: 0,
  }], { size: 24 })
  initRobotAtStandby(robotCtrl)
}

function onSelectTrip(trip) {
  setActiveTrip({ ...trip })
  updateHighlight()
}

function onSearchTicket(ticketNo) {
  const trip = findTripByTicket(ticketNo, trips.value)
  searchTicket(trip ? { ...trip } : null)
  if (trip) updateHighlight()
}

function onWaitHandler() {
  onWait()
}

function onReturnToStandby() {
  returnToStandby()
}

function zoomToFit() {
  if (!map) return
  const MapLibre = window.maplibregl
  const bounds = new MapLibre.LngLatBounds()
  areas.value.forEach(area => {
    area.polygon.forEach(([x, y]) => bounds.extend(fracToGPS(x, y)))
  })
  const camera = map.cameraForBounds(bounds, {
    padding: { top: 28, right: 28, bottom: 80, left: 28 },
    maxZoom: 23.4,
  })
  map.easeTo({ ...camera, pitch: 0, bearing: 0, duration: 600 })
}

function getPolygonCenter(coordinates) {
  const usable = coordinates.slice(0, -1)
  const total = usable.reduce((sum, item) => [sum[0] + item[0], sum[1] + item[1]], [0, 0])
  return [total[0] / usable.length, total[1] / usable.length]
}

function cleanupMap() {
  poiMarkers.forEach(m => m.remove())
  poiMarkers.length = 0
  areaLabelMarkers.forEach(m => m.remove())
  areaLabelMarkers.length = 0
  robotCtrl?.remove()
  robotCtrl = null
  if (map) {
    map.remove()
    map = null
  }
}
</script>

<style lang="scss" scoped>
.passenger-station {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: fixed;
  inset: 0;
  background: linear-gradient(160deg, #e8f4fc 0%, #eef1f8 30%, #f0f6fb 60%, #e6f0fa 100%);
}

.passenger-station__main {
  position: relative;
  display: flex;
  gap: 18px;
  flex: 1 1 0;
  min-height: 0;
  padding: 18px 24px;
}

.passenger-station__grid {
  position: absolute;
  inset: 0;
  opacity: 0.42;
  background-image:
    linear-gradient(rgba(37, 99, 235, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37, 99, 235, 0.08) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
}

.passenger-station__panel {
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
}

.passenger-station__map-card {
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

.passenger-station__map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.passenger-station__legend {
  position: absolute;
  left: 0;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 620px;
  padding: 6px 14px;
  border: 1px solid rgba(137, 173, 212, 0.45);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 12px 30px rgba(45, 87, 138, 0.12);
  backdrop-filter: blur(14px);
  z-index: 10;
}

.passenger-station__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #33506c;
  font-size: 12px;
  font-weight: 700;

  i {
    width: 12px;
    height: 12px;
    border: 1px solid rgba(40, 84, 130, 0.16);
    border-radius: 4px;
  }
}
</style>

<style lang="scss">
.passenger-area-label {
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  color: #334155;
  white-space: nowrap;
}

.passenger-poi-marker {
  cursor: pointer;

  &__icon {
    width: 22px;
    height: 22px;
    display: block;
    filter: drop-shadow(0 2px 6px rgba(59, 130, 246, 0.25));
  }
}
</style>
