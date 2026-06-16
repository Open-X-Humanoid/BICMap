<!--
 * @Author: Ella ella.yin@x-humanoid.com
 * @Date: 2026-06-03 12:33:21
 * @LastEditors: kai.lee@x-humanoid.com
 * @LastEditTime: 2026-06-08 10:14:34
 * @FilePath: /bic-map/src/examples/scene/stationGuide/index.vue
 * @Description: 火车站导览 2D 室内背景地图示例
-->
<template>
  <div class="station-guide">
    <AppHeader title="火车/高铁站导览" />

    <main class="station-guide__main">
      <div class="station-guide__grid"></div>

      <aside class="station-guide__panel">
        <div class="station-guide__panel-header">
          <span>点击导览到指定点位</span>
          <small>{{ stationPois.length }} 个导览点</small>
        </div>

        <button
          v-for="poi in stationPois"
          :key="poi.id"
          class="station-guide__poi"
          :class="{ 'station-guide__poi--active': poi.id === activePoiId }"
          type="button"
          @click="selectPoi(poi)"
        >
          <span class="station-guide__poi-type">{{ poi.type }}</span>
          <span class="station-guide__poi-content">
            <strong>{{ poi.name }}</strong>
            <small>{{ poi.description }}</small>
          </span>
        </button>
      </aside>

      <section class="station-guide__map-card">
        <div id="stationMap" class="station-guide__map"></div>
        <!-- <aside class="station-guide__robot-panel">
          <div class="station-guide__robot-title">
            <span>机器人状态</span>
            <small>{{ robotStatusSummary }}</small>
          </div>

          <div class="station-guide__robot-list">
            <div v-for="robot in stationRobots" :key="robot.id" class="station-guide__robot-card">
              <div class="station-guide__robot-main">
                <span class="station-guide__robot-dot" :class="`station-guide__robot-dot--${robot.status}`"></span>
                <div class="station-guide__robot-info">
                  <strong>{{ robot.name }}</strong>
                  <small>{{ robot.task }}</small>
                </div>
                <span class="station-guide__robot-status" :class="`station-guide__robot-status--${robot.status}`">
                  {{ getRobotStatusLabel(robot.status) }}
                </span>
              </div>

              <div class="station-guide__robot-meta">
                <span>{{ robot.battery }}%</span>
                <div class="station-guide__robot-actions">
                  <button type="button" title="开始导览">▶</button>
                  <button type="button" title="定位机器人">◎</button>
                  <button type="button" title="路线配置">⌘</button>
                </div>
              </div>
            </div>
          </div>
        </aside> -->
        <aside v-if="guideCard" class="station-guide__guide-card">
          <div class="station-guide__guide-card-title">{{ guideCard.title }}</div>
          <p>{{ guideCard.description }}</p>
        </aside>

        <div class="station-guide__legend">
          <span v-for="item in legendItems" :key="item.label" class="station-guide__legend-item">
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Maximize, MapPin, RotateCcw } from 'lucide-vue-next'

import AppFooter from '../../components/AppFooter.vue'
import AppHeader from '../../components/AppHeader.vue'

import bicMap from '@/bicMap/core/bicmap-gl'
import { addStatusRobotMarkers, ROBOT_STATUS } from '@/examples/utils/robot'
import { STATION_POI_ICONS } from './poiIcons.js'
import {
  MAP_CENTER,
  MAP_MAX_ZOOM,
  MAP_ZOOM,
  STATION_AREAS,
  STATION_COLORS,
  STATION_POIS,
  buildStationAreasGeoJSON,
  fracToGPS,
} from './stationLayout.js'

let map = null
let poiMarkers = []
let robotCtrl = null
let areaLabelMarkers = []
let animationFrameId = null

const STATION_ROUTE_SOURCE_ID = 'station-route-source'
const STATION_ROUTE_LAYER_ID = 'station-route-line-layer'
const GUIDE_ROBOT_ID = 'station-guide-robot-01'
const ROBOT_STANDBY_POI_ID = 'poi-robot-standby'
const GUIDE_SPEED_FRAC_PER_SECOND = 0.10
const ROBOT_IDLE_HEADING = 90
const GUIDE_GRID_COLS = 72
const GUIDE_GRID_ROWS = 72
const GUIDE_OBSTACLE_MARGIN = 0.018  // 障碍物（不可通行区域）的膨胀 buffer
const STATION_BOUNDS = { xMin: 0.09, xMax: 0.91, yMin: 0.05, yMax: 0.97 }
const GUIDE_TURN_PENALTY = 2.8
const GUIDE_DIAGONAL_PENALTY = 0.8
const GUIDE_MIN_SMOOTH_CLEARANCE = 1
const GUIDE_NEIGHBORS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],           [1, 0],
  [-1, 1],  [0, 1],  [1, 1],
]

const activePoiId = ref(STATION_POIS[0]?.id || '')
const stationPois = STATION_POIS
const guideRoute = ref([])
const currentGuideTarget = ref(null)
const guideCard = ref(null)
const isGuiding = ref(false)
const guideRobotPosition = ref(null)
const stationRobots = ref([
  {
    id: 'station-guide-robot-01',
    name: '导览机器人 A',
    status: ROBOT_STATUS.IDLE,
    battery: 96,
    task: '待机中',
    offset: [-0.018, 0],
  },
//   {
//     id: 'station-guide-robot-02',
//     name: '导览机器人 B',
//     status: ROBOT_STATUS.CHARGING,
//     battery: 78,
//     task: '充电待命',
//     offset: [0.018, 0],
//   },
])
const legendItems = [
  { label: '候车大厅', color: STATION_COLORS.concourse },
  { label: '票务/服务', color: STATION_COLORS.service },
  { label: '安检/闸机', color: STATION_COLORS.security },
  { label: '站台/换乘', color: STATION_COLORS.platform },
  { label: '商业/交通', color: STATION_COLORS.retail },
  { label: '站前广场', color: STATION_COLORS.plaza },
  { label: '机器人待机', color: STATION_COLORS.robotStandby },
]

const footerButtons = computed(() => [
  { label: '适应地图', icon: Maximize, onClick: zoomToFit },
//   { label: '定位候车大厅', icon: MapPin, onClick: () => selectPoi(stationPois.find(poi => poi.id === 'poi-waiting')) },
  { label: '返回充电区', icon: RotateCcw, active: isGuiding.value, onClick: returnToStandby },
])

const robotStatusSummary = computed(() => {
  const runningCount = stationRobots.value.filter(robot => robot.status === ROBOT_STATUS.RUNNING).length
  const errorCount = stationRobots.value.filter(robot => robot.status === ROBOT_STATUS.ERROR).length
  return `${stationRobots.value.length} 台 · ${runningCount} 运行 · ${errorCount} 故障`
})

onMounted(() => initMap())
onBeforeUnmount(() => cleanup())

async function initMap() {
  await bicMap.init()
  map = bicMap.createMap({
    container: 'stationMap',
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
    setupStationScene()
    requestAnimationFrame(() => {
      map.resize()
      zoomToFit()
    })
  })
}

function setupStationScene() {
  map.addSource('station-area-source', { type: 'geojson', data: buildStationAreasGeoJSON(fracToGPS) })
  map.addLayer({
    id: 'station-area-fill-layer',
    type: 'fill',
    source: 'station-area-source',
    paint: {
      'fill-color': ['coalesce', ['get', 'color'], STATION_COLORS.concourse],
      'fill-opacity': 0.92,
    },
  })

  map.addSource(STATION_ROUTE_SOURCE_ID, { type: 'geojson', data: buildRouteGeoJSON([]) })
  map.addLayer({
    id: STATION_ROUTE_LAYER_ID,
    type: 'line',
    source: STATION_ROUTE_SOURCE_ID,
    paint: {
      'line-color': STATION_COLORS.route,
      'line-width': 4,
      'line-opacity': 0.82,
      'line-dasharray': [2, 2],
    },
  })

  addAreaLabels()
  addPoiMarkers()
  addStationRobots()
}

function addAreaLabels() {
  const MapLibre = window.maplibregl
  if (!MapLibre) return

  const areaSource = buildStationAreasGeoJSON(fracToGPS)
  areaSource.features.forEach(feature => {
    const coordinates = feature.geometry.coordinates[0]
    const center = getPolygonCenter(coordinates)
    const el = document.createElement('div')
    el.className = 'station-area-label'
    el.textContent = feature.properties.name
    const marker = new MapLibre.Marker({ element: el, anchor: 'center' })
      .setLngLat(center)
      .addTo(map)
      .setOffset([0, 20])
    areaLabelMarkers.push(marker)
  })
}

function addPoiMarkers() {
  clearPoiMarkers()
  const MapLibre = window.maplibregl
  if (!MapLibre) return

  stationPois.forEach(poi => {
    const iconSrc = STATION_POI_ICONS[poi.icon]
    if (!iconSrc) return

    const el = document.createElement('div')
    el.className = 'station-poi-marker'
    if (poi.id === activePoiId.value) {
      el.classList.add('station-poi-marker--active')
    }

    const img = document.createElement('img')
    img.src = iconSrc
    img.alt = poi.name
    img.className = 'station-poi-marker__icon'
    el.appendChild(img)

    el.addEventListener('click', (event) => {
      event.stopPropagation()
      selectPoi(poi, { syncMarker: false })
      selectPoiMarker(poi.id)
    })

    const marker = new MapLibre.Marker({ element: el, anchor: 'center' })
      .setLngLat(fracToGPS(poi.xFrac, poi.yFrac))
      .addTo(map)
      .setOffset([0, -16])
    poiMarkers.push({ id: poi.id, marker })
  })
}

function selectPoiMarker(poiId) {
  poiMarkers.forEach(({ id, marker }) => {
    const el = marker.getElement()
    el.classList.toggle('station-poi-marker--active', id === poiId)
  })
}

function clearPoiMarkers() {
  poiMarkers.forEach(({ marker }) => marker.remove())
  poiMarkers = []
}

function addStationRobots() {
  const standbyPoi = stationPois.find(poi => poi.id === 'poi-robot-standby')
  if (!standbyPoi) return
  const guideRobot = stationRobots.value.find(robot => robot.id === GUIDE_ROBOT_ID) || stationRobots.value[0]
  guideRobotPosition.value = {
    xFrac: standbyPoi.xFrac + guideRobot.offset[0],
    yFrac: standbyPoi.yFrac + guideRobot.offset[1],
  }

  const robots = stationRobots.value.map(robot => ({
    ...robot,
    lngLat: fracToGPS(standbyPoi.xFrac + robot.offset[0], standbyPoi.yFrac + robot.offset[1]),
    rotation: iconRot(ROBOT_IDLE_HEADING),
  }))

  robotCtrl = addStatusRobotMarkers(map, robots, { size: 24 })
}

function getRobotStatusLabel(status) {
  const statusMap = {
    [ROBOT_STATUS.IDLE]: '待机',
    [ROBOT_STATUS.RUNNING]: '运行',
    [ROBOT_STATUS.CHARGING]: '充电',
    [ROBOT_STATUS.ERROR]: '故障',
  }
  return statusMap[status] || '未知'
}

function selectPoi(poi, options = {}) {
  if (!poi || !map) return
  const { syncMarker = true } = options
  activePoiId.value = poi.id
  if (syncMarker) {
    selectPoiMarker(poi.id)
  }

  prepareGuideRoute(poi)
  const shouldStart = window.confirm(`路线已生成完毕，是否现在出发前往「${poi.name}」？`)
  if (shouldStart) {
    startGuide()
  }
}

function prepareGuideRoute(targetPoi) {
  cancelGuideAnimation()
  currentGuideTarget.value = targetPoi
  guideCard.value = null
  guideRoute.value = buildGuideRoute(targetPoi)
  updateRouteLayer(guideRoute.value)
  updateGuideRobot({
    status: ROBOT_STATUS.IDLE,
    task: `待出发：${targetPoi.name}`,
  })
}

function buildGuideRoute(targetPoi) {
  if (!targetPoi) return []
  const startPoint = getGuideRobotStartPoint()
  const targetPoint = { xFrac: targetPoi.xFrac, yFrac: targetPoi.yFrac, poi: targetPoi }
  const plannedRoute = planGuideRoute(startPoint, targetPoint)
  return dedupeRoutePoints(plannedRoute.length ? plannedRoute : [startPoint, targetPoint])
}

function toRoutePoint(poi) {
  return { xFrac: poi.xFrac, yFrac: poi.yFrac, poi }
}

function dedupeRoutePoints(points) {
  return points.filter((point, index) => {
    const prev = points[index - 1]
    return !prev || prev.xFrac !== point.xFrac || prev.yFrac !== point.yFrac
  })
}

function planGuideRoute(startPoint, targetPoint) {
  const grid = buildGuideWalkableGrid()
  const startCell = nearestWalkableCell(fracToGuideCell(startPoint), grid)
  const targetCell = nearestWalkableCell(fracToGuideCell(targetPoint), grid)
  if (!startCell || !targetCell) return []

  const rawPath = astarGuide(startCell, targetCell, grid)
  const smoothed = smoothGuidePath(rawPath, grid)
  if (!smoothed?.length) return []

  const route = smoothed.map(cell => guideCellToRoutePoint(cell))
  route[0] = startPoint
  // 终点直接使用 marker 原始坐标，机器人精确到达 POI 中心
  route[route.length - 1] = { xFrac: targetPoint.xFrac, yFrac: targetPoint.yFrac, poi: targetPoint.poi }
  return route
}

function buildGuideWalkableGrid() {
  const grid = []
  for (let row = 0; row < GUIDE_GRID_ROWS; row++) {
    const line = []
    for (let col = 0; col < GUIDE_GRID_COLS; col++) {
      const point = guideCellToRoutePoint({ col, row })
      line.push(isPointInGuideWalkableArea(point.xFrac, point.yFrac))
    }
    grid.push(line)
  }
  return grid
}

function isPointInGuideWalkableArea(xFrac, yFrac) {
  // 站外不可通行
  if (xFrac < STATION_BOUNDS.xMin || xFrac > STATION_BOUNDS.xMax
    || yFrac < STATION_BOUNDS.yMin || yFrac > STATION_BOUNDS.yMax) return false
  // 空白区域默认可通行；只有 passable:false 的区域（加膨胀 buffer）是障碍
  return !STATION_AREAS.some(area => !area.passable
    && isPointInExpandedPolygon(xFrac, yFrac, area.polygon, GUIDE_OBSTACLE_MARGIN))
}

function isPointInExpandedPolygon(xFrac, yFrac, polygon, margin) {
  const xs = polygon.map(point => point[0])
  const ys = polygon.map(point => point[1])
  return xFrac >= Math.min(...xs) - margin
    && xFrac <= Math.max(...xs) + margin
    && yFrac >= Math.min(...ys) - margin
    && yFrac <= Math.max(...ys) + margin
}

function getStationAreaAtPoint(xFrac, yFrac) {
  return STATION_AREAS.find(area => isPointInExpandedPolygon(xFrac, yFrac, area.polygon, 0))
}

function fracToGuideCell(point) {
  return {
    col: Math.max(0, Math.min(GUIDE_GRID_COLS - 1, Math.round(point.xFrac * (GUIDE_GRID_COLS - 1)))),
    row: Math.max(0, Math.min(GUIDE_GRID_ROWS - 1, Math.round(point.yFrac * (GUIDE_GRID_ROWS - 1)))),
  }
}

function guideCellToRoutePoint(cell) {
  return {
    xFrac: cell.col / (GUIDE_GRID_COLS - 1),
    yFrac: cell.row / (GUIDE_GRID_ROWS - 1),
  }
}

function nearestWalkableCell(cell, grid) {
  if (grid[cell.row]?.[cell.col]) return cell
  const queue = [cell]
  const seen = new Set([`${cell.col},${cell.row}`])
  let cursor = 0

  while (cursor < queue.length) {
    const current = queue[cursor++]
    for (const [dc, dr] of GUIDE_NEIGHBORS) {
      const next = { col: current.col + dc, row: current.row + dr }
      if (!isGuideCellInBounds(next)) continue
      const key = `${next.col},${next.row}`
      if (seen.has(key)) continue
      if (grid[next.row][next.col]) return next
      seen.add(key)
      queue.push(next)
    }
  }
  return null
}

function astarGuide(start, goal, grid) {
  if (!grid[start.row]?.[start.col] || !grid[goal.row]?.[goal.col]) return null

  const cellCount = GUIDE_GRID_COLS * GUIDE_GRID_ROWS
  const inf = 1e30
  const gScore = new Float64Array(cellCount).fill(inf)
  const fScore = new Float64Array(cellCount).fill(inf)
  const came = new Int32Array(cellCount).fill(-1)
  const cameDir = new Int8Array(cellCount).fill(-1)
  const open = []
  const inOpen = new Set()

  const startIndex = guideCellIndex(start)
  gScore[startIndex] = 0
  fScore[startIndex] = guideCellDistance(start, goal)
  open.push(startIndex)
  inOpen.add(startIndex)

  while (open.length) {
    const currentIndex = popBestGuideCell(open, inOpen, fScore)
    const current = guideIndexToCell(currentIndex)
    if (current.col === goal.col && current.row === goal.row) {
      return reconstructGuidePath(came, currentIndex)
    }

    for (let dir = 0; dir < GUIDE_NEIGHBORS.length; dir++) {
      const [dc, dr] = GUIDE_NEIGHBORS[dir]
      const next = { col: current.col + dc, row: current.row + dr }
      if (!isGuideCellInBounds(next)) continue
      if (!grid[next.row][next.col]) continue
      if (dc !== 0 && dr !== 0 && (!grid[current.row][next.col] || !grid[next.row][current.col])) continue

      const nextIndex = guideCellIndex(next)
      const turnCost = cameDir[currentIndex] === -1 || cameDir[currentIndex] === dir ? 0 : GUIDE_TURN_PENALTY
      const diagCost = dc !== 0 && dr !== 0 ? GUIDE_DIAGONAL_PENALTY : 0
      const tentative = gScore[currentIndex] + Math.hypot(dc, dr) + turnCost + diagCost
      if (tentative >= gScore[nextIndex]) continue

      came[nextIndex] = currentIndex
      cameDir[nextIndex] = dir
      gScore[nextIndex] = tentative
      fScore[nextIndex] = tentative + guideCellDistance(next, goal)
      if (!inOpen.has(nextIndex)) {
        open.push(nextIndex)
        inOpen.add(nextIndex)
      }
    }
  }
  return null
}

function popBestGuideCell(open, inOpen, fScore) {
  let bestOpenIndex = 0
  let bestScore = fScore[open[0]]
  for (let i = 1; i < open.length; i++) {
    if (fScore[open[i]] < bestScore) {
      bestScore = fScore[open[i]]
      bestOpenIndex = i
    }
  }
  const cellIndex = open[bestOpenIndex]
  open.splice(bestOpenIndex, 1)
  inOpen.delete(cellIndex)
  return cellIndex
}

function reconstructGuidePath(came, endIndex) {
  const path = []
  let cursor = endIndex
  while (cursor !== -1) {
    path.push(guideIndexToCell(cursor))
    cursor = came[cursor]
  }
  return path.reverse()
}

function smoothGuidePath(path, grid) {
  if (!path || path.length < 3) return path
  const result = []
  let i = 0
  while (i < path.length) {
    result.push(path[i])
    if (i === path.length - 1) break
    let j = path.length - 1
    for (; j > i + 1; j--) {
      if (hasGuideLineOfSight(path[i], path[j], grid)) break
    }
    i = j
  }
  return result
}

function hasGuideLineOfSight(from, to, grid) {
  let x0 = from.col
  let y0 = from.row
  const x1 = to.col
  const y1 = to.row
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy

  while (true) {
    if (!grid[y0]?.[x0]) return false
    if (GUIDE_MIN_SMOOTH_CLEARANCE > 0 && !hasGuideClearance({ col: x0, row: y0 }, grid, GUIDE_MIN_SMOOTH_CLEARANCE)) {
      return false
    }
    if (x0 === x1 && y0 === y1) break
    const e2 = err * 2
    if (e2 > -dy) {
      err -= dy
      x0 += sx
    }
    if (e2 < dx) {
      err += dx
      y0 += sy
    }
  }
  return true
}

function hasGuideClearance(cell, grid, clearance) {
  for (let row = cell.row - clearance; row <= cell.row + clearance; row++) {
    for (let col = cell.col - clearance; col <= cell.col + clearance; col++) {
      if (!isGuideCellInBounds({ col, row }) || !grid[row][col]) return false
    }
  }
  return true
}

function guideCellIndex(cell) {
  return cell.row * GUIDE_GRID_COLS + cell.col
}

function guideIndexToCell(index) {
  return {
    col: index % GUIDE_GRID_COLS,
    row: Math.floor(index / GUIDE_GRID_COLS),
  }
}

function isGuideCellInBounds(cell) {
  return cell.col >= 0 && cell.row >= 0 && cell.col < GUIDE_GRID_COLS && cell.row < GUIDE_GRID_ROWS
}

function guideCellDistance(from, to) {
  return Math.hypot(to.col - from.col, to.row - from.row)
}

function startGuide() {
  if (!guideRoute.value.length || !currentGuideTarget.value) return

  cancelGuideAnimation()
  guideCard.value = null
  isGuiding.value = true
  updateGuideRobot({
    status: ROBOT_STATUS.RUNNING,
    task: `前往 ${currentGuideTarget.value.name}`,
  })
  animateRobotAlongRoute(guideRoute.value, () => {
    arriveAtTarget(currentGuideTarget.value)
  })
}

function animateRobotAlongRoute(route, onComplete) {
  const segments = buildRouteSegments(route)
  if (!segments.length) {
    onComplete?.()
    return
  }

  const totalDuration = segments.reduce((sum, segment) => sum + segment.duration, 0)
  const startedAt = performance.now()

  const tick = (now) => {
    const elapsed = Math.min(now - startedAt, totalDuration)
    const position = getRoutePositionAtTime(segments, elapsed)
    guideRobotPosition.value = {
      xFrac: position.xFrac,
      yFrac: position.yFrac,
    }
    updateGuideRobot({
      lngLat: fracToGPS(position.xFrac, position.yFrac),
      rotation: position.rotation,
      status: ROBOT_STATUS.RUNNING,
      task: `前往 ${currentGuideTarget.value?.name || ''}`,
    })

    if (elapsed >= totalDuration) {
      animationFrameId = null
      onComplete?.()
      return
    }
    animationFrameId = requestAnimationFrame(tick)
  }

  animationFrameId = requestAnimationFrame(tick)
}

function buildRouteSegments(route) {
  const segments = []
  for (let i = 0; i < route.length - 1; i++) {
    const from = route[i]
    const to = route[i + 1]
    const distance = getFracDistance(from, to)
    if (distance <= 0) continue
    segments.push({
      from,
      to,
      distance,
      duration: (distance / GUIDE_SPEED_FRAC_PER_SECOND) * 1000,
      rotation: getRouteHeading(from, to),
    })
  }
  return segments
}

function getRoutePositionAtTime(segments, elapsed) {
  let cursor = 0
  for (const segment of segments) {
    const segmentEnd = cursor + segment.duration
    if (elapsed <= segmentEnd) {
      const progress = (elapsed - cursor) / segment.duration
      return {
        xFrac: lerp(segment.from.xFrac, segment.to.xFrac, progress),
        yFrac: lerp(segment.from.yFrac, segment.to.yFrac, progress),
        rotation: iconRot(segment.rotation),
      }
    }
    cursor = segmentEnd
  }

  const last = segments[segments.length - 1]
  return {
    xFrac: last.to.xFrac,
    yFrac: last.to.yFrac,
    rotation: iconRot(last.rotation),
  }
}

function arriveAtTarget(targetPoi) {
  if (!targetPoi) return
  const arrivalPoint = guideRoute.value[guideRoute.value.length - 1] || targetPoi
  isGuiding.value = false
  guideRobotPosition.value = {
    xFrac: arrivalPoint.xFrac,
    yFrac: arrivalPoint.yFrac,
  }
  updateGuideRobot({
    lngLat: fracToGPS(arrivalPoint.xFrac, arrivalPoint.yFrac),
    status: ROBOT_STATUS.IDLE,
    task: `已到达 ${targetPoi.name}`,
  })
  guideCard.value = {
    title: `我已到达 ${targetPoi.name}`,
    description: targetPoi.description || '当前点位暂无讲解内容。',
  }
}

function returnToStandby() {
  cancelGuideAnimation()
  isGuiding.value = false
  currentGuideTarget.value = null
  guideCard.value = null
  guideRoute.value = []
  updateRouteLayer([])
  activePoiId.value = ROBOT_STANDBY_POI_ID
  selectPoiMarker(ROBOT_STANDBY_POI_ID)
  resetGuideRobotToStandby()
}

function resetGuideRobotToStandby() {
  const standbyPoi = stationPois.find(poi => poi.id === ROBOT_STANDBY_POI_ID)
  if (!standbyPoi) return
  const guideRobot = stationRobots.value.find(robot => robot.id === GUIDE_ROBOT_ID) || stationRobots.value[0]
  guideRobotPosition.value = {
    xFrac: standbyPoi.xFrac + guideRobot.offset[0],
    yFrac: standbyPoi.yFrac + guideRobot.offset[1],
  }
  updateGuideRobot({
    lngLat: fracToGPS(guideRobotPosition.value.xFrac, guideRobotPosition.value.yFrac),
    rotation: iconRot(ROBOT_IDLE_HEADING),
    status: ROBOT_STATUS.IDLE,
    task: '待机中',
  })
}

function getGuideRobotStartPoint() {
  if (guideRobotPosition.value) {
    return {
      xFrac: guideRobotPosition.value.xFrac,
      yFrac: guideRobotPosition.value.yFrac,
    }
  }
  const standbyPoi = stationPois.find(poi => poi.id === ROBOT_STANDBY_POI_ID)
  const guideRobot = stationRobots.value.find(robot => robot.id === GUIDE_ROBOT_ID) || stationRobots.value[0]
  return {
    xFrac: standbyPoi.xFrac + guideRobot.offset[0],
    yFrac: standbyPoi.yFrac + guideRobot.offset[1],
  }
}

function updateGuideRobot(patch) {
  const current = stationRobots.value.find(robot => robot.id === GUIDE_ROBOT_ID)
  if (current) {
    Object.assign(current, {
      status: patch.status ?? current.status,
      task: patch.task ?? current.task,
      battery: patch.battery ?? current.battery,
    })
  }
  robotCtrl?.updateRobot(GUIDE_ROBOT_ID, patch)
}

function updateRouteLayer(route) {
  map?.getSource(STATION_ROUTE_SOURCE_ID)?.setData(buildRouteGeoJSON(route))
}

function buildRouteGeoJSON(route) {
  const coordinates = route.map(point => fracToGPS(point.xFrac, point.yFrac))
  return {
    type: 'FeatureCollection',
    features: coordinates.length >= 2
      ? [{
          type: 'Feature',
          properties: { id: 'station-guide-route' },
          geometry: {
            type: 'LineString',
            coordinates,
          },
        }]
      : [],
  }
}

function cancelGuideAnimation() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

function getFracDistance(from, to) {
  return Math.sqrt((to.xFrac - from.xFrac) ** 2 + (to.yFrac - from.yFrac) ** 2)
}

function getRouteHeading(from, to) {
  return (Math.atan2(to.xFrac - from.xFrac, to.yFrac - from.yFrac) * (180 / Math.PI) + 360) % 360
}

function iconRot(heading) {
  return (heading - 90 + 360) % 360
}

function lerp(from, to, progress) {
  return from + (to - from) * Math.max(0, Math.min(1, progress))
}

function zoomToFit() {
  if (!map) return
  const bounds = getStationBounds()

  const camera = map.cameraForBounds(bounds, {
    padding: { top: 28, right: 28, bottom: 28, left: 28 },
    maxZoom: 23.4,
  })
  map.easeTo({ ...camera, pitch: 0, bearing: 0, duration: 600 })
}

function getStationBounds() {
  const MapLibre = window.maplibregl
  const bounds = new MapLibre.LngLatBounds()
  STATION_AREAS.forEach(area => {
    area.polygon.forEach(([x, y]) => bounds.extend(fracToGPS(x, y)))
  })
  return bounds
}

function getPolygonCenter(coordinates) {
  const usable = coordinates.slice(0, -1)
  const total = usable.reduce((sum, item) => [sum[0] + item[0], sum[1] + item[1]], [0, 0])
  return [total[0] / usable.length, total[1] / usable.length]
}

function cleanup() {
  cancelGuideAnimation()
  clearPoiMarkers()
  robotCtrl?.remove()
  areaLabelMarkers.forEach(marker => marker.remove())
  robotCtrl = null
  areaLabelMarkers = []
  if (map) {
    map.remove()
    map = null
  }
}
</script>

<style lang="scss" scoped>

.station-guide {
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

.station-guide__main {
  position: relative;
  display: flex;
  gap: 18px;
  flex: 1 1 0;
  min-height: 0;
  padding: 18px 24px;
}

.station-guide__grid {
  position: absolute;
  inset: 0;
  opacity: 0.42;
  background-image:
    linear-gradient(rgba(37, 99, 235, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37, 99, 235, 0.08) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
}

.station-guide__map-card {
  position: relative;
  z-index: 1;
  flex: 1 1 0;
  align-self: stretch;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(126, 170, 215, 0.62);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 24px 70px rgba(49, 91, 143, 0.16);
}

.station-guide__map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.station-guide__legend {
  position: absolute;
  left: 0px;
  bottom: 0px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 600px;
  padding: 6px 14px;
  border: 1px solid rgba(137, 173, 212, 0.45);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 12px 30px rgba(45, 87, 138, 0.12);
  backdrop-filter: blur(14px);
}

.station-guide__legend-item {
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

.station-guide__guide-card {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 2;
  width: 300px;
  padding: 14px;
  border: 1px solid rgba(14, 165, 233, 0.22);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow:
    0 8px 32px rgba(14, 165, 233, 0.08),
    0 0 0 1px rgba(255, 255, 255, 0.6) inset;
  color: #0c4a6e;
  backdrop-filter: blur(12px);

  p {
    margin: 8px 0 0;
    color: #64748b;
    font-size: 13px;
    line-height: 1.6;
  }
}

.station-guide__guide-card-title {
  color: #0369a1;
  font-size: 15px;
  font-weight: 800;
}

.station-guide__robot-panel {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 2;
  width: 260px;
  padding: 14px;
  border: 1px solid rgba(14, 165, 233, 0.22);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow:
    0 8px 32px rgba(14, 165, 233, 0.08),
    0 0 0 1px rgba(255, 255, 255, 0.6) inset;
  backdrop-filter: blur(12px);
}

.station-guide__robot-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(14, 165, 233, 0.15);
  color: #0c4a6e;
  font-size: 16px;
  font-weight: 800;

  small {
    color: #64748b;
    font-size: 11px;
    font-weight: 700;
  }
}

.station-guide__robot-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.station-guide__robot-card {
  padding: 10px;
  border: 1px solid rgba(14, 165, 233, 0.14);
  border-radius: 12px;
  background: rgba(248, 252, 255, 0.86);
}

.station-guide__robot-main,
.station-guide__robot-meta {
  display: flex;
  align-items: center;
}

.station-guide__robot-main {
  gap: 8px;
}

.station-guide__robot-meta {
  justify-content: space-between;
  margin-top: 8px;
  padding-left: 18px;
  color: #10b981;
  font-size: 12px;
  font-weight: 800;
}

.station-guide__robot-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #1cd5a4;
  box-shadow: 0 0 0 4px rgba(28, 213, 164, 0.12);

  &--running {
    background: #0066ff;
    box-shadow: 0 0 0 4px rgba(0, 102, 255, 0.12);
  }

  &--charging {
    background: #f7a800;
    box-shadow: 0 0 0 4px rgba(247, 168, 0, 0.14);
  }

  &--error {
    background: #ff3b30;
    box-shadow: 0 0 0 4px rgba(255, 59, 48, 0.12);
  }
}

.station-guide__robot-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;

  strong {
    overflow: hidden;
    color: #173b65;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    margin-top: 2px;
    color: #64748b;
    font-size: 11px;
  }
}

.station-guide__robot-status {
  flex: 0 0 auto;
  padding: 3px 7px;
  border: 1px solid #1cd5a4;
  border-radius: 6px;
  background: rgba(28, 213, 164, 0.1);
  color: #059669;
  font-size: 11px;
  font-weight: 800;

  &--running {
    border-color: #0066ff;
    background: rgba(0, 102, 255, 0.1);
    color: #0066ff;
  }

  &--charging {
    border-color: #f7a800;
    background: rgba(247, 168, 0, 0.12);
    color: #b77900;
  }

  &--error {
    border-color: #ff3b30;
    background: rgba(255, 59, 48, 0.1);
    color: #dc2626;
  }
}

.station-guide__robot-actions {
  display: flex;
  gap: 6px;

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 1px solid rgba(37, 99, 235, 0.18);
    border-radius: 7px;
    background: rgba(219, 234, 254, 0.8);
    color: #2563eb;
    cursor: pointer;
    font-size: 12px;
    font-weight: 800;
  }
}

.station-guide__panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 0 0 320px;
  align-self: stretch;
  min-height: 0;
  padding: 16px;
  overflow: auto;
  border: 1px solid rgba(137, 173, 212, 0.5);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 20px 52px rgba(45, 87, 138, 0.16);
  backdrop-filter: blur(18px);
}

.station-guide__panel-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 4px;
  color: #173b65;
  font-size: 18px;
  font-weight: 800;

  small {
    color: #7691ad;
    font-size: 12px;
    font-weight: 700;
  }
}

.station-guide__poi {
  display: flex;
  gap: 12px;
  width: 100%;
  padding: 12px;
  border: 1px solid rgba(149, 177, 207, 0.42);
  border-radius: 14px;
  background: rgba(248, 252, 255, 0.88);
  color: #31506f;
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;

  &:hover,
  &--active {
    border-color: rgba(59, 130, 246, 0.6);
    box-shadow: 0 12px 28px rgba(59, 130, 246, 0.16);
    transform: translateY(-1px);
  }

  &--active {
    background: linear-gradient(135deg, rgba(219, 234, 254, 0.96), rgba(239, 246, 255, 0.94));
  }
}

.station-guide__poi-type {
  flex: 0 0 auto;
  padding: 5px 7px;
  border-radius: 8px;
  background: #e0edff;
  color: #2563eb;
  font-size: 12px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.station-guide__poi-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;

  strong {
    color: #173b65;
    font-size: 14px;
  }

  small {
    color: #6b8199;
    font-size: 12px;
    line-height: 1.45;
  }
}

:deep(.station-area-label) {
  color: #909497;
  font-family: system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.95);
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}


</style>

<style lang="scss">
.station-poi-marker {
  cursor: pointer;

  &__icon {
    width: 22px;
    height: 22px;
    display: block;
    filter: drop-shadow(0 2px 6px rgba(59, 130, 246, 0.25));
  }

  &--active &__icon {
    filter: drop-shadow(0 0 6px rgba(37, 99, 235, 0.65));
  }
}
</style>