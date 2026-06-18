<!--
 * @Description: 产业园区安防巡检机器人场景
 *   支持三种地图模式切换（室外矢量图 / 高精地图 / SLAM地图）
 *   多台巡检机器人 GPS 路点循环巡逻，实时安防告警展示
-->
<template>
  <div class="app-root">
    <AppHeader title="产业园区安防巡检" />

    <main class="map-area">
      <div class="grid-bg"></div>

      <!-- 左侧：安防告警面板 -->
      <aside class="sidebar sidebar--left">
        <AlertPanel :alerts="alerts" :simulatedEvents="simulatedEvents" />
      </aside>

      <!-- 地图区域 -->
      <div class="map-center">
        <div class="map-container">
          <div id="securityPatrolMap" class="map-gl"></div>
        </div>
      </div>

      <!-- 右侧：机器人状态面板 -->
      <aside class="sidebar sidebar--right">
        <PatrolStatusPanel
          :robots="robots"
          :is-running="isRunning"
          @toggleRobot="handleToggleRobot"
          @recall="handleRecallRobot"
        />
      </aside>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  Play, Square, Maximize, RotateCcw, Layers, GitBranch,
} from 'lucide-vue-next'

import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'
import PatrolStatusPanel from './components/PatrolStatusPanel.vue'
import AlertPanel from './components/AlertPanel.vue'

import bicMap from '@/bicMap/core/bicmap-gl'
import { createBuildings } from '@/bicMap/core/mapFeatures/buildings.js'
import { addCanvasLabels } from '@/bicMap/core/mapFeatures/canvasLabels.js'
import { buildParkVectorData, PARK_GRAPH, PARK_ROADS } from './parkLayout.js'
import { usePatrolManager } from './usePatrolManager.js'
import { MAP_CENTER, MAP_ZOOM, MAP_PITCH, MAP_BEARING } from './constants.js'

// ─── 运行时对象（非响应式） ───────────────────────────────────────────────────

let map = null
let vectorBuildingCtrl = null
let canvasLabelCtrls = []

// ─── 响应式状态 ───────────────────────────────────────────────────────────────

// const followCam = ref(false)  // 视角跟随已注释
const is3D = ref(false)
const showGraph = ref(true)      // 道路连通性图层

function toggleViewMode() {
  if (!map) return
  is3D.value = !is3D.value
  if (is3D.value) {
    map.easeTo({ pitch: MAP_PITCH, bearing: MAP_BEARING, duration: 500 })
    vectorBuildingCtrl?.show()
    map.setLayoutProperty('vector-buildings-flat-fill', 'visibility', 'none')
    map.setLayoutProperty('vector-buildings-flat-outline', 'visibility', 'none')
  } else {
    map.easeTo({ pitch: 0, bearing: 0, duration: 500 })
    vectorBuildingCtrl?.hide()
    map.setLayoutProperty('vector-buildings-flat-fill', 'visibility', 'visible')
    map.setLayoutProperty('vector-buildings-flat-outline', 'visibility', 'visible')
  }
}

// ─── 地图初始化 ───────────────────────────────────────────────────────────────

const {
  robots,
  isRunning,
  alerts,
  simulatedEvents,
  init,
  startAll,
  stopAll,
  startSingle,
  stopSingle,
  recallRobot,
  fitBounds,
  cleanup: cleanupPatrol,
} = usePatrolManager({ getMap: () => map, is3D })  // followCam 已注释

// ─── Footer 按钮 ──────────────────────────────────────────────────────────────

const footerButtons = computed(() => [
  {
    label: isRunning.value ? '全部停止' : '全部启动',
    icon: isRunning.value ? Square : Play,
    active: isRunning.value,
    onClick: isRunning.value ? stopAll : startAll,
  },
  {
    label: '适配视图',
    icon: Maximize,
    onClick: fitBounds,
    // disabled: !!followRobotId.value,  // 视角跟随已注释
  },
  {
    label: is3D.value ? '2D视图' : '3D视图',
    icon: Layers,
    onClick: toggleViewMode,
  },
  {
    label: '重置场景',
    icon: RotateCcw,
    onClick: resetScene,
  },
  // {
  //   label: '道路连通',
  //   icon: GitBranch,
  //   active: showGraph.value,
  //   onClick: toggleGraphLayer,
  // },
])

// ─── 事件处理 ─────────────────────────────────────────────────────────────────

function handleToggleRobot(robotId) {
  const r = robots.value.find(x => x.id === robotId)
  if (!r) return
  if (r.status === 'running' || r.status === 'dwell') {
    stopSingle(robotId)
  } else if (r.status !== 'returning') {
    // 召回/返回过程中禁止启动
    startSingle(robotId)
  }
}

function handleRecallRobot(robotId) {
  const r = robots.value.find(x => x.id === robotId)
  if (r && r.status === 'returning') return  // 召回中禁止重复召回
  recallRobot(robotId)
}

// function handleToggleFollow(robotId) {  // 视角跟随已注释
//   setFollowRobot(robotId)
// }

function resetScene() {
  stopAll()
  is3D.value = false
  showGraph.value = true
  if (map) {
    map.easeTo({ center: MAP_CENTER, zoom: MAP_ZOOM, pitch: 0, bearing: 0, duration: 800 })
    vectorBuildingCtrl?.hide()
    map.setLayoutProperty('vector-buildings-flat-fill', 'visibility', 'visible')
    map.setLayoutProperty('vector-buildings-flat-outline', 'visibility', 'visible')
  }
}

// ─── 道路连通性图层 ────────────────────────────────────────────────────────────

/** 图结构图层 ID 列表（用于统一切换可见性） */
const GRAPH_LAYER_IDS = [
  'vector-graph-edges-solid',
  'vector-graph-edges-dashed',
  'vector-graph-nodes',
]

/**
 * 基于 PARK_ROADS 实际道路几何构建边 GeoJSON
 * 线沿道路走向绘制，不会穿过建筑
 */
function buildGraphEdgesGeoJson() {
  const features = PARK_ROADS.features
    .filter(f => {
      const type = f.properties?.road_type
      return type === 'primary' || type === 'secondary' || type === 'tertiary'
    })
    .map(f => ({
      type: 'Feature',
      properties: {
        edgeId: f.properties?.name || f.properties?.road_type,
        edgeType: f.properties.road_type,
      },
      geometry: f.geometry,
    }))

  return { type: 'FeatureCollection', features }
}

/** 构建 PARK_GRAPH 节点 GeoJSON */
function buildGraphNodesGeoJson() {
  const features = PARK_GRAPH.nodes.map(node => ({
    type: 'Feature',
    properties: {
      nodeId: node.id,
      type: node.type,
    },
    geometry: {
      type: 'Point',
      coordinates: node.coordinates,
    },
  }))
  return { type: 'FeatureCollection', features }
}

/** 切换道路连通性图层的可见性 */
function toggleGraphLayer() {
  if (!map) return
  showGraph.value = !showGraph.value
  const visibility = showGraph.value ? 'visible' : 'none'
  for (const layerId of GRAPH_LAYER_IDS) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility)
    }
  }
}

// ─── 地图初始化 ───────────────────────────────────────────────────────────────

onMounted(initMap)
onBeforeUnmount(() => {
  cleanupPatrol()
  canvasLabelCtrls.forEach(ctrl => ctrl.remove())
  canvasLabelCtrls = []
  vectorBuildingCtrl?.remove?.()
  ;['vector-buildings-flat-fill', 'vector-buildings-flat-outline'].forEach(id => {
    if (map?.getLayer(id)) map.removeLayer(id)
  })
  if (map?.getSource('vector-buildings-flat-src')) map.removeSource('vector-buildings-flat-src')
  // 清理道路连通性图层
  for (const layerId of GRAPH_LAYER_IDS) {
    if (map?.getLayer(layerId)) map.removeLayer(layerId)
  }
  if (map?.getSource('vector-graph-edges-src')) map.removeSource('vector-graph-edges-src')
  if (map?.getSource('vector-graph-nodes-src')) map.removeSource('vector-graph-nodes-src')
  if (map) { map.remove(); map = null }
})

async function initMap() {
  try {
    await bicMap.init()
    map = bicMap.createMap({
      container: 'securityPatrolMap',
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      pitch: 0,
      bearing: 0,
      maxPitch: 85,
      backgroundColor: '#f0f4f8',
      antialias: true,
    })
    bicMap.addZoomControl(map, 'bottom-right')
    map.on('load', onMapLoad)
  } catch (err) {
  }
}

function onMapLoad() {
  loadVectorLayers()
  init()
}

// ─── 矢量图图层 ───────────────────────────────────────────────────────────────

function loadVectorLayers() {
  const { ground, green, parking, roads, crosswalks, gates, buildings, intersections, obstacles, semanticZones } = buildParkVectorData()

  const src = (id, data) => map.addSource(id, { type: 'geojson', data })
  const lyr = (o) => map.addLayer(o)

  src('vector-ground-src', ground)
  src('vector-green-src', green)
  src('vector-parking-src', parking)
  src('vector-roads-src', roads)
  src('vector-crosswalks-src', crosswalks)
  src('vector-gates-src', gates)
  src('vector-obstacles-src', obstacles)
  src('vector-semantic-zones-src', semanticZones)

  lyr({ id: 'vector-ground-fill', source: 'vector-ground-src', type: 'fill', paint: { 'fill-color': '#f3f3f3', 'fill-opacity': 1 } })
  lyr({ id: 'vector-green-fill', source: 'vector-green-src', type: 'fill', paint: { 'fill-color': '#cce8c8', 'fill-opacity': 0.85 } })
  lyr({ id: 'vector-parking-fill', source: 'vector-parking-src', type: 'fill', paint: { 'fill-color': '#e8e8e8', 'fill-opacity': 1 } })

  lyr({ id: 'vector-roads-casing', source: 'vector-roads-src', type: 'line', filter: ['==', ['get', 'road_type'], 'primary'], paint: { 'line-color': '#d4a94b', 'line-width': 22, 'line-opacity': 1 } })
  lyr({ id: 'vector-roads-casing-sec', source: 'vector-roads-src', type: 'line', filter: ['==', ['get', 'road_type'], 'secondary'], paint: { 'line-color': '#e8d5a0', 'line-width': 16, 'line-opacity': 1 } })
  lyr({ id: 'vector-roads-primary', source: 'vector-roads-src', type: 'line', filter: ['==', ['get', 'road_type'], 'primary'], paint: { 'line-color': '#fef3c7', 'line-width': 18, 'line-opacity': 1 } })
  lyr({ id: 'vector-roads-secondary', source: 'vector-roads-src', type: 'line', filter: ['==', ['get', 'road_type'], 'secondary'], paint: { 'line-color': '#fef9c3', 'line-width': 12, 'line-opacity': 1 } })
  // tertiary 小路（内部支路）- 配色符合百度地图官方设计规范
  lyr({ id: 'vector-roads-casing-ter', source: 'vector-roads-src', type: 'line', filter: ['==', ['get', 'road_type'], 'tertiary'], paint: { 'line-color': '#d4d4d4', 'line-width': 10, 'line-opacity': 1 } })
  lyr({ id: 'vector-roads-tertiary', source: 'vector-roads-src', type: 'line', filter: ['==', ['get', 'road_type'], 'tertiary'], paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 1 } })
  lyr({ id: 'vector-roads-centerline', source: 'vector-roads-src', type: 'line', filter: ['==', ['get', 'marking'], 'centerline'], paint: { 'line-color': '#fbbf24', 'line-width': 1.2, 'line-dasharray': [2, 4], 'line-opacity': 0.8 } })
  // 道路标签：排除人行道（sidewalk）和小路（tertiary），避免标签污染
  lyr({
    id: 'vector-roads-labels', source: 'vector-roads-src', type: 'symbol',
    filter: ['all', ['has', 'name'], ['!=', ['get', 'road_type'], 'sidewalk'], ['!=', ['get', 'road_type'], 'tertiary']],
    layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-size': 11, 'symbol-spacing': 400, 'text-optional': true, 'text-allow-overlap': false },
    paint: { 'text-color': '#666666', 'text-halo-color': '#ffffff', 'text-halo-width': 2 }
  })

  // 人行道路面提示线（浅灰虚线，比主路细）
  lyr({ id: 'vector-sidewalk-fill', source: 'vector-roads-src', type: 'line', filter: ['==', ['get', 'road_type'], 'sidewalk'], paint: { 'line-color': '#d4d4d4', 'line-width': 2, 'line-dasharray': [1, 3], 'line-opacity': 0.5 } })

  lyr({ id: 'vector-crosswalks-fill', source: 'vector-crosswalks-src', type: 'fill', paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.85 } })

  // ── 静态障碍物 ──
  lyr({ id: 'vector-obstacles-fence', source: 'vector-obstacles-src', type: 'line', filter: ['==', ['get', 'obstacle_type'], 'fence'], paint: { 'line-color': '#94a3b8', 'line-width': 2, 'line-dasharray': [4, 2], 'line-opacity': 0.7 } })
  lyr({ id: 'vector-obstacles-barrier', source: 'vector-obstacles-src', type: 'fill', filter: ['==', ['get', 'obstacle_type'], 'barrier'], paint: { 'fill-color': '#94a3b8', 'fill-opacity': 0.25 } })
  lyr({ id: 'vector-obstacles-gap', source: 'vector-obstacles-src', type: 'fill', filter: ['==', ['get', 'obstacle_type'], 'narrow_gap'], paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.3 } })

  // ── 语义分区 ──
  lyr({
    id: 'vector-semantic-zones-fill', source: 'vector-semantic-zones-src', type: 'fill',
    paint: {
      'fill-color': ['match', ['get', 'zoneType'], 'forbidden', '#ef4444', 'service_area', '#3b82f6', 'speed_limit', '#f59e0b', '#94a3b8'],
      'fill-opacity': ['match', ['get', 'zoneType'], 'forbidden', 0.12, 'service_area', 0.1, 0.1],
    }
  })
  lyr({
    id: 'vector-semantic-zones-outline', source: 'vector-semantic-zones-src', type: 'line',
    paint: {
      'line-color': ['match', ['get', 'zoneType'], 'forbidden', '#ef4444', 'service_area', '#3b82f6', 'speed_limit', '#f59e0b', '#94a3b8'],
      'line-width': 1.5, 'line-dasharray': [4, 3], 'line-opacity': 0.6,
    }
  })

  lyr({
    id: 'vector-gates-circle', source: 'vector-gates-src', type: 'circle',
    paint: { 'circle-radius': 7, 'circle-color': '#ef4444', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff', 'circle-opacity': 1 }
  })
  lyr({
    id: 'vector-gates-label', source: 'vector-gates-src', type: 'symbol',
    layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-offset': [0, 1.4], 'text-anchor': 'top', 'text-optional': true },
    paint: { 'text-color': '#ef4444', 'text-halo-color': '#fff', 'text-halo-width': 2 }
  })

  // 3D 建筑（默认隐藏，与 is3D 初始值 false 保持一致）
  vectorBuildingCtrl = createBuildings(map, buildings, {
    defaultHeight: 20,
    defaultColor: '#d1d1d1',
  })
  vectorBuildingCtrl?.hide()

  // 平面建筑色块（2D 模式用，默认显示）
  const FLAT_BUILDING_SOURCE = 'vector-buildings-flat-src'
  const FLAT_BUILDING_FILL = 'vector-buildings-flat-fill'
  const FLAT_BUILDING_OUTLINE = 'vector-buildings-flat-outline'
  src(FLAT_BUILDING_SOURCE, buildings)
  lyr({
    id: FLAT_BUILDING_FILL, source: FLAT_BUILDING_SOURCE, type: 'fill',
    layout: { visibility: 'visible' },
    paint: {
      'fill-color': ['coalesce', ['get', 'color'], '#d1d1d1'],
      'fill-opacity': 0.85,
    },
  })
  lyr({
    id: FLAT_BUILDING_OUTLINE, source: FLAT_BUILDING_SOURCE, type: 'line',
    layout: { visibility: 'visible' },
    paint: {
      'line-color': '#42a5f5',
      'line-width': 0.8,
      'line-opacity': 0.6,
    },
  })

  // 建筑名称标签
  canvasLabelCtrls.push(
    addCanvasLabels(map, {
      layerId: 'vector-building-labels',
      data: buildings,
      style: { textColor: '#ffffff', haloColor: '#1e293b' },
    })
  )

  // 绿化区域名称标签
  canvasLabelCtrls.push(
    addCanvasLabels(map, {
      layerId: 'vector-green-labels',
      data: green,
      style: { textColor: '#4a7c4f', haloColor: '#ffffff' },
    })
  )

  // 停车场名称标签
  canvasLabelCtrls.push(
    addCanvasLabels(map, {
      layerId: 'vector-parking-labels',
      data: parking,
      style: { textColor: '#666666', haloColor: '#ffffff' },
    })
  )

  // ── 道路连通性图层（注释掉：不展示图层，保留逻辑） ──
  // const graphEdgesGeoJson = buildGraphEdgesGeoJson()
  // const graphNodesGeoJson = buildGraphNodesGeoJson()
  // src('vector-graph-edges-src', graphEdgesGeoJson)
  // src('vector-graph-nodes-src', graphNodesGeoJson)

  // // 边：主路/辅路为实线（第 1 层）
  // lyr({
  //   id: 'vector-graph-edges-solid', source: 'vector-graph-edges-src', type: 'line',
  //   filter: ['!=', ['get', 'edgeType'], 'tertiary'],
  //   paint: {
  //     'line-color': ['match', ['get', 'edgeType'], 'primary', '#f59e0b', '#94a3b8'],
  //     'line-width': ['match', ['get', 'edgeType'], 'primary', 2, 1.5],
  //     'line-opacity': 0.7,
  //   },
  // })

  // // 边：小路为虚线（第 2 层）
  // lyr({
  //   id: 'vector-graph-edges-dashed', source: 'vector-graph-edges-src', type: 'line',
  //   filter: ['==', ['get', 'edgeType'], 'tertiary'],
  //   paint: {
  //     'line-color': '#94a3b8',
  //     'line-width': 1,
  //     'line-dasharray': [3, 3],
  //     'line-opacity': 0.7,
  //   },
  // })

  // // 节点：按 type 区分样式
  // lyr({
  //   id: 'vector-graph-nodes', source: 'vector-graph-nodes-src', type: 'circle',
  //   paint: {
  //     'circle-radius': ['match', ['get', 'type'], 'gate', 5, 'intersection', 4, 'entrance', 3, 3],
  //     'circle-color': ['match', ['get', 'type'], 'gate', '#ef4444', 'entrance', '#22c55e', '#64748b'],
  //     'circle-stroke-width': ['case', ['==', ['get', 'type'], 'intersection'], 1, 0],
  //     'circle-stroke-color': '#ffffff',
  //     'circle-opacity': 0.85,
  //   },
  // })
}

</script>

<style scoped lang="scss">
.app-root {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  background: #f0f4f8;
}

.map-area {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
}

.grid-bg {
  position: absolute;
  inset: 0;
  opacity: 0.08;
  background-image:
    linear-gradient(rgba(100, 116, 139, 0.6) 1px, transparent 1px),
    linear-gradient(90deg, rgba(100, 116, 139, 0.6) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
  z-index: 0;
}

.sidebar {
  position: absolute;
  top: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 10px;
  pointer-events: none;

  &--left {
    left: 0;
    width: 215px;
  }

  &--right {
    right: 0;
    width: 225px;
  }

  > * {
    pointer-events: auto;
  }
}

.map-center {
  flex: 1;
  position: relative;
  z-index: 5;
}

.map-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.map-gl {
  width: 100%;
  height: 100%;
}
</style>
