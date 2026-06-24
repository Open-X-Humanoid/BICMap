<template>
  <div class="app-root">
    <AppHeader title="商场服务机器人导览与监控" />

    <main class="map-area">
      <div class="grid-bg"></div>

      <!-- left sidebar: POI panel -->
      <aside class="sidebar sidebar--left">
        <GuidePoiPanel ref="guidePoiPanelRef" :pois="visiblePois" :activePoiId="selectedPoiId"
          @select="onPoiSelect" @add="onPoiAdd" @update="onPoiUpdate" @delete="onPoiDelete" />
      </aside>

      <!-- center map -->
      <div class="map-center">
        <div class="map-container">
          <div id="mallMap" class="map-gl"></div>

          <!-- 楼层切换器 -->
          <div class="floor-switcher">
            <button v-for="floor in floorList" :key="floor.id" class="floor-btn"
              :class="{ active: currentFloor === floor.id }"
              @click="onFloorSwitch(floor.id)">
              {{ floor.label }}
            </button>
          </div>

          <GuideNarrationPanel v-if="allActiveNarrations.length" :items="allActiveNarrations" />

          <StatusHud :hud-text="hudText" :is-running="isRunning" />
          <!-- <HeadingHud :deg="headingLabel.deg" :dir="headingLabel.dir" /> -->
        </div>
      </div>

      <!-- right sidebar: robot status panel -->
      <aside class="sidebar sidebar--right">
        <RobotStatusPanel :robots="robots" :isRunning="isRunning" :pois="visiblePois" :routes="robotRoutes"
          :start-poi-ids="robotStartPoiIds" :follow-robot-id="followRobotId"
          @toggle-fov="toggleFov" @toggle-follow="handleToggleFollow" @config-route="handleConfigRoute"
          @toggle-robot="handleToggleRobot" />
      </aside>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Play, Maximize, Layers, Route as RouteIcon, Crosshair, Square, RotateCcw } from 'lucide-vue-next'

import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'
import GuideNarrationPanel from './GuideNarrationPanel.vue'
import GuidePoiPanel from './components/GuidePoiPanel.vue'
import RobotStatusPanel from './components/RobotStatusPanel.vue'
import StatusHud from './components/StatusHud.vue'
import HeadingHud from './components/HeadingHud.vue'

import bicMap from '@/bicMap/core/bicmap-gl'
import { ROBOT_STATUS, addStatusRobotMarkers } from '@/bicMap/core/robot'
import { createIoTBubbles, IOT_EVENT_TYPE } from '@/bicMap/core/overlay'
import { buildMallGeoJSON, buildMallFloorsGeoJSON, buildMallZones, buildMallShopLabelsGeoJSON, isInActiveArea, buildB1FloorsGeoJSON, buildB1ZoneLabelsGeoJSON, buildB1Zones } from './mallLayout.js'
import { MALL_SHOP_ICONS } from './mallIcons.js'
import {
  FLOOR_CONFIGS, ROBOT_CONFIGS, PATROL_ROUTES,
  MAP_START_X, MAP_START_Y, MAP_X_GRID_COUNT, MAP_Y_GRID_COUNT, MAP_RESOLUTION,
  MAP_WIDTH_M, MAP_HEIGHT_M, LAYOUT_SCALE, GUIDE_PHASE, IDLE_HEADING,
} from './constants.js'
import { createGeoUtils, iconRot, cartDist } from '@/bicMap/core/navigation'
import { createBuildings } from '@/bicMap/core/mapFeatures'
import { createSemanticZones } from '@/bicMap/core/mapFeatures'
import { createFloorManager } from '@/bicMap/core/mapFeatures'
import { usePoiManager } from './usePoiManager.js'
import { useRobotManager } from './useRobotManager.js'
import { useRouteLayer } from './useRouteLayer.js'
import { useViewControls, FLOOR_SOURCE_ID, FLOOR_LAYER_ID } from './useViewControls.js'

const { fracToCart, fracToGPS } = createGeoUtils({
  startX: MAP_START_X,
  startY: MAP_START_Y,
  width: MAP_WIDTH_M * (LAYOUT_SCALE || 1),
  height: MAP_HEIGHT_M * (LAYOUT_SCALE || 1),
  scale: MAP_RESOLUTION,
})

// ===== runtime objects (non-reactive for performance) =====
let map = null
let floorManager = null
let buildingCtrl = null
let robotCtrl = null
let zones = null
let cameraBound = null
let iot = null
let addingPoi = false
let poiMarkerCtrl = null
let shopLabelCtrl = null
let slamBounds = null // SLAM 地图固定边界 { sw: [lng, lat], ne: [lng, lat] }

const ROBOT_MARKER_LAYER_ID = 'robot-markers-layer'

// ===== composables =====
const {
  pois, activePoi, setActivePoi, addPoi, updatePoi, removePoi, isPoiInRoute, setRouteReferenceChecker, loadDefaultPois,
} = usePoiManager()

const robotManager = useRobotManager({
  getMap: () => map,
  getRobotCtrl: () => robotCtrl,
  getPois: () => pois.value,
  getRoutes: () => robotRoutes.value,
  getCurrentFloor: () => currentFloor.value,
})

const { robots, isRunning, followCam, followRobotId, robotHeading, stopAll, startSingle, stopSingle, toggleFov, setFollowRobot, getPatrolState, setRobotRoute, setRobotPosition, routeDisplayData, updateSidebarStatus } = robotManager

const routeLayer = useRouteLayer(() => map, fracToGPS, () => routeDisplayData.value)
const { showRoute, toggleRoute, updateAnnouncementPoints } = routeLayer

const viewControls = useViewControls(() => map, {
  followCam,
  isRunning,
  cameraBound: () => cameraBound,
  slamBounds: () => slamBounds,
})
const { is3D, setSlamVisible, zoomToFit } = viewControls

// ===== reactive state =====
const currentFloor = ref('1F')
const selectedPoiId = ref(null)
const robotNarrations = ref({})
const robotRoutes = ref({ ...PATROL_ROUTES })
const robotStartPoiIds = ref({})

ROBOT_CONFIGS.forEach(config => {
  if (config.startPoiId) {
    robotStartPoiIds.value[config.id] = config.startPoiId
  }
})

const guidePoiPanelRef = ref(null)
const floorList = FLOOR_CONFIGS.map(f => ({ id: f.id, label: f.label }))

// ── heading label ──
const CARDINAL = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const headingLabel = computed(() => {
  const deg = ((robotHeading.value % 360) + 360) % 360
  const idx = Math.round(deg / 45) % 8
  return { deg: Math.round(deg), dir: CARDINAL[idx] }
})

// ── HUD text ──
const hudText = computed(() => {
  if (!isRunning.value) return ''
  const movingCount = robots.value.filter(r => r.status === 'running').length
  return `监控运行中 · ${movingCount} 台机器人导览中`
})

// ── per-floor running state ──
const floor1FRunning = computed(() => {
  if (!isRunning.value) return false
  for (const config of ROBOT_CONFIGS) {
    if (config.floor !== '1F') continue
    const state = getPatrolState(config.id)
    if (state && state.phase !== GUIDE_PHASE.IDLE) return true
  }
  return false
})

const floorB1Running = computed(() => {
  if (!isRunning.value) return false
  for (const config of ROBOT_CONFIGS) {
    if (config.floor !== 'B1') continue
    const state = getPatrolState(config.id)
    if (state && state.phase !== GUIDE_PHASE.IDLE) return true
  }
  return false
})

// ── floor-filtered POIs ──
const visiblePois = computed(() => pois.value.filter(p => p.floor === currentFloor.value))

// ── 所有机器人的播报卡片列表 ──
const allActiveNarrations = computed(() => {
  // if (!followCam.value) return []
  return Object.entries(robotNarrations.value)
    .filter(([, narration]) => narration !== null)
    .map(([robotId, narration]) => {
      const routeIds = robotRoutes.value[robotId] || PATROL_ROUTES[robotId]
      const idx = routeIds ? routeIds.findIndex(id => id === narration.id) : -1
      const robotConfig = ROBOT_CONFIGS.find(r => r.id === robotId)
      return {
        robotId,
        robotName: robotConfig?.name || robotId,
        data: narration,
        progress: idx < 0 ? '' : `${idx + 1}/${routeIds.length}`
      }
    })
})

// ── POI markers sync ──
function syncPOIMarkers() {
  if (poiMarkerCtrl) { poiMarkerCtrl.remove(); poiMarkerCtrl = null }
  const points = pois.value
    .filter(p => p.floor === currentFloor.value)
    .map(p => ({
      id: p.id,
      lngLat: fracToGPS(p.xFrac, p.yFrac),
      rotation: 0,
      name: p.name,
    }))
  if (points.length === 0) return
  poiMarkerCtrl = bicMap.addBatchPOIMarkers(map, points, { size: 24, showLabels: true, selectable: false, avoidLabelCollision: false })
  // POI 图层在机器人图层之后添加会覆盖机器人，将机器人图层移到栈顶
  if (map.getLayer(ROBOT_MARKER_LAYER_ID)) map.moveLayer(ROBOT_MARKER_LAYER_ID)
}

watch(pois, () => syncPOIMarkers(), { deep: true })
watch(currentFloor, () => syncPOIMarkers())

// ── footer buttons ──
const footerButtons = computed(() => {
  const buttons = [
    {
      label: floor1FRunning.value ? '1F 暂停' : '1F 导览',
      icon: floor1FRunning.value ? Square : Play,
      active: floor1FRunning.value,
      disabled: currentFloor.value !== '1F',
      onClick: floor1FRunning.value ? () => handleFloorPause('1F') : () => handleFloorStart('1F'),
    },
    {
      label: floorB1Running.value ? 'B1 暂停' : 'B1 导览',
      icon: floorB1Running.value ? Square : Play,
      active: floorB1Running.value,
      disabled: currentFloor.value !== 'B1',
      onClick: floorB1Running.value ? () => handleFloorPause('B1') : () => handleFloorStart('B1'),
    },
    {
      label: '重置',
      icon: RotateCcw,
      onClick: handleResetAll,
    },
    { label: '适应地图', icon: Maximize, onClick: zoomToFit },
    {
      label: showRoute.value ? '隐藏路线' : '显示路线',
      icon: RouteIcon,
      active: showRoute.value,
      onClick: toggleRoute,
    },
  ]
  
  return buttons
})

// ===== 3D toggle (also manages building / SLAM layers) =====
// 当前场景仅使用2D模式，此函数保留但不再通过UI调用
function toggle3D() {
  if (is3D.value) {
    buildingCtrl?.show()
    if (map?.getLayer(FLOOR_LAYER_ID)) map.setLayoutProperty(FLOOR_LAYER_ID, 'visibility', 'visible')
    setSlamVisible(false)
    // 3D 模式：启用 3D 模型，隐藏 2D 贴图标记
    if (map?.getLayer(ROBOT_MARKER_LAYER_ID)) map.setLayoutProperty(ROBOT_MARKER_LAYER_ID, 'visibility', 'none')
  } else {
    buildingCtrl?.hide()
    if (map?.getLayer(FLOOR_LAYER_ID)) map.setLayoutProperty(FLOOR_LAYER_ID, 'visibility', 'visible')
    setSlamVisible(true)
    // 2D 模式：卸载 3D 图层，恢复 2D 贴图标记
    if (map?.getLayer(ROBOT_MARKER_LAYER_ID)) map.setLayoutProperty(ROBOT_MARKER_LAYER_ID, 'visibility', 'visible')
  }
}

// ===== lifecycle =====
onMounted(() => initMap())
onBeforeUnmount(() => cleanup())

async function initMap() {
  await bicMap.init()
  const mapCenter = fracToGPS(0.5, 0.5)
  map = bicMap.createMap({
    container: 'mallMap',
    center: mapCenter,
    zoom: 20,
    maxZoom: 25,
    maxPitch: 85,
    backgroundColor: '#fff',
  })
  bicMap.addZoomControl(map, 'bottom-right')
  map.on('load', async () => {
    await setupScene()
    // 默认2D模式，地图居中显示
    buildingCtrl?.hide()
    if (map?.getLayer(FLOOR_LAYER_ID)) map.setLayoutProperty(FLOOR_LAYER_ID, 'visibility', 'visible')
    setSlamVisible(true)
    // 地图加载完成后居中显示
    nextTick(() => {
      zoomToFit()
    })
  })
}

async function setupScene() {
  floorManager = createFloorManager(map, {
    floors: FLOOR_CONFIGS,
    onFloorChange: (id) => {
      currentFloor.value = id
      if (map?.getSource(FLOOR_SOURCE_ID)) {
        highlightFloor(id)
        setSlamVisible(!is3D.value)
        const slamLayerId = `floor-slam-layer-${id}`
        if (map.getLayer(slamLayerId) && map.getLayer(FLOOR_LAYER_ID)) {
          map.moveLayer(slamLayerId, FLOOR_LAYER_ID)
        }
      }

      // 非破坏性楼层切换：保持运行中的机器人不暂停
      // 保持机器人图层可见
      if (map?.getLayer(ROBOT_MARKER_LAYER_ID)) {
        map.setLayoutProperty(ROBOT_MARKER_LAYER_ID, 'visibility', 'visible')
      }

      // 切换机器人地图标记：移除所有旧标记，添加当前楼层机器人
      ROBOT_CONFIGS.forEach(config => {
        try { robotCtrl?.removeRobot(config.id) } catch (e) { /* ignore */ }
      })
      ROBOT_CONFIGS.forEach(config => {
        if (config.floor !== id) return
        const state = robotManager.getPatrolState(config.id)
        if (!state) return
        robotCtrl?.addRobot({
          id: config.id,
          lngLat: state.lngLat,
          rotation: iconRot(state.smoothHeading),
          name: config.name,
          status: state.phase === GUIDE_PHASE.IDLE ? ROBOT_STATUS.IDLE : ROBOT_STATUS.RUNNING,
          battery: state.battery,
          task: '待导览',
        })
      })

      // 标签在所有楼层都显示
      robotCtrl?.toggleLabels(true)
      // FOV：根据楼层显示/隐藏
      const isB1 = id === 'B1'
      isB1 ? robotManager.hideAllFov() : robotManager.restoreFov()
      // 路线：当前楼层可见，并更新路线数据
      routeLayer.setRouteVisible(true)
      routeLayer.updateRoutes()
      routeLayer.setAnnouncementsVisible(true)
      refreshAnnouncementLayer(id)

      // 同步右侧机器人列表
      updateSidebarStatus()

      nextTick(() => zoomToFit())
    },
  })
  await floorManager.switchTo('1F')
  computeCameraBound()

  map.addSource(FLOOR_SOURCE_ID, { type: 'geojson', data: buildMallFloorsGeoJSON(fracToGPS) })
  map.addLayer({
    id: FLOOR_LAYER_ID,
    type: 'fill',
    source: FLOOR_SOURCE_ID,
    paint: {
      'fill-color': ['coalesce', ['get', 'color'], '#455a64'],
      'fill-opacity': 0.72,
    },
  })

  buildingCtrl = createBuildings(map, buildMallGeoJSON('1F', fracToGPS), {
    defaultColor: '#0167ff',
    opacity: 0.90,
    showOutline: false,
  })

  await createOverlays()

  // 如果默认是 3D 模式（is3D 初始值为 true），在场景构建完后立即挂载 3D 图层
  if (is3D.value) {
    if (map?.getLayer(ROBOT_MARKER_LAYER_ID)) map.setLayoutProperty(ROBOT_MARKER_LAYER_ID, 'visibility', 'none')
  }

  const ZONE_OUTLINE_LAYER = 'bic-semantic-zones-outline-layer'
  if (map.getLayer(ZONE_OUTLINE_LAYER)) map.moveLayer(ZONE_OUTLINE_LAYER)
}

function computeCameraBound() {
  // 使用 fracToGPS 计算地图边界（不依赖 window.MapUtils）
  // 地图的四个角（分数坐标）
  const bottomLeft = fracToGPS(0, 0)
  const topRight = fracToGPS(1, 1)

  slamBounds = { sw: bottomLeft, ne: topRight }

  // 获取地图容器尺寸，计算自适应 padding
  const container = map.getContainer()
  const containerWidth = container.clientWidth
  const containerHeight = container.clientHeight

  // 根据容器尺寸计算合适的 padding
  const padding = {
    top: Math.max(40, containerHeight * 0.08),
    bottom: Math.max(40, containerHeight * 0.08),
    left: Math.max(40, containerWidth * 0.08),
    right: Math.max(40, containerWidth * 0.08)
  }

  const cb = map.cameraForBounds([bottomLeft, topRight], { padding })
  cameraBound = Object.assign({ pitch: 0, bearing: 0 }, cb)
}

// 根据区域填充色返回对应的深色图标背景色（1F 商场 + B1 停车场配色均覆盖）
function getIconBackgroundColor(zoneColor) {
  const colorMap = {
    '#FFF4D9ff': '#e8be6a', // 餐饮 - 深黄
    '#E6D9F0ff': '#a585cc', // 购物/娱乐/服务 - 深紫
    '#85d1feff': '#4db8f0', // 卫生间 - 深蓝
    '#E8F4F8':   '#5aa8c8', // 停车位 - 深青
    '#F5F5F5':   '#8a8a8a', // 行车通道 - 深灰
    '#D7F1D7':   '#4caf77', // 充电区 - 深绿
    '#DDE9F7':   '#4a85c0', // 无障碍 - 深蓝
    '#FEF3E2':   '#d4933a', // 出入口 - 深橙
    '#E8EAF6':   '#5c6bc0', // 电梯厅 - 深靛
    '#FDECEA':   '#d9534f', // 消防通道 - 深红
  }
  return colorMap[zoneColor] || '#6b7280'
}

// 用 Canvas 2D 离屏渲染商店/区域标签（圆形图标+文字）为 ImageData，以 symbol 图层写入 WebGL 管线，
// 置于 robot-markers-layer 之前，确保标签在层级上低于机器人标记。
// floorId 参数控制使用哪个楼层的标签数据；省略时默认使用当前 currentFloor.value。
async function addShopLabels(floorId) {
  if (!map) return

  const LABEL_SOURCE = 'bic-shop-labels-source'
  const LABEL_LAYER = 'bic-shop-labels-layer'
  const FONT = '800 12px "PingFang SC","Microsoft YaHei",system-ui,sans-serif'
  const PAD = 4
  const DPR = Math.min(window.devicePixelRatio || 2, 2)
  const ICON_SIZE = 12
  const ICON_CIRCLE_SIZE = 20
  const ICON_TEXT_GAP = 8

  // 优先使用 shopLabelCtrl.remove() 以同时清理已注册的图片资源
  if (shopLabelCtrl) {
    shopLabelCtrl.remove()
    shopLabelCtrl = null
  } else {
    if (map.getLayer(LABEL_LAYER)) map.removeLayer(LABEL_LAYER)
    if (map.getSource(LABEL_SOURCE)) map.removeSource(LABEL_SOURCE)
  }

  const targetFloor = floorId ?? currentFloor.value
  const rawFeatures = (targetFloor === 'B1')
    ? buildB1ZoneLabelsGeoJSON(fracToGPS).features
    : buildMallShopLabelsGeoJSON(fracToGPS).features
  const features = []
  const imageIds = []

  // 加载图标图片的辅助函数
  function loadIconImage(iconSrc) {
    return new Promise((resolve) => {
      if (!iconSrc) {
        resolve(null)
        return
      }
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = iconSrc
    })
  }

  for (let idx = 0; idx < rawFeatures.length; idx++) {
    const feature = rawFeatures[idx]
    const text = feature.properties.label
    const iconKey = feature.properties.icon
    const zoneColor = feature.properties.color
    const iconSrc = MALL_SHOP_ICONS[iconKey]
    const imageId = `bic-sl-${idx}`

    // 加载图标
    const iconImg = await loadIconImage(iconSrc)
    const hasIcon = iconImg !== null

    // 离屏 Canvas 渲染圆形图标+文字
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')
    ctx.font = FONT
    const textWidth = ctx.measureText(text).width
    const contentWidth = hasIcon ? ICON_CIRCLE_SIZE + ICON_TEXT_GAP + textWidth : textWidth
    const labelWidth = Math.ceil(contentWidth) + PAD * 2
    const labelHeight = Math.max(ICON_CIRCLE_SIZE, 12) + PAD * 2
    c.width = Math.ceil(labelWidth * DPR)
    c.height = Math.ceil(labelHeight * DPR)
    ctx.scale(DPR, DPR)
    ctx.font = FONT

    // 渲染圆形背景图标
    if (hasIcon) {
      const centerX = PAD + ICON_CIRCLE_SIZE / 2
      const centerY = labelHeight / 2
      const radius = ICON_CIRCLE_SIZE / 2

      // 绘制圆形背景
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius - 1, 0, Math.PI * 2)
      ctx.fillStyle = getIconBackgroundColor(zoneColor)
      ctx.fill()

      // 在独立 canvas 上将图标变为白色，再叠加到圆形背景之上
      const iconX = centerX - ICON_SIZE / 2
      const iconY = centerY - ICON_SIZE / 2
      const iconCanvas = document.createElement('canvas')
      iconCanvas.width = ICON_SIZE
      iconCanvas.height = ICON_SIZE
      const iconCtx = iconCanvas.getContext('2d')
      iconCtx.drawImage(iconImg, 0, 0, ICON_SIZE, ICON_SIZE)
      iconCtx.globalCompositeOperation = 'source-in'
      iconCtx.fillStyle = '#ffffff'
      iconCtx.fillRect(0, 0, ICON_SIZE, ICON_SIZE)
      ctx.drawImage(iconCanvas, iconX, iconY)
    }

    // 渲染文字（圆形图标右侧）
    const textX = hasIcon ? PAD + ICON_CIRCLE_SIZE + ICON_TEXT_GAP + textWidth / 2 : labelWidth / 2
    ctx.fillStyle = '#909497'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, textX, labelHeight / 2)

    const { data } = ctx.getImageData(0, 0, c.width, c.height)
    map.addImage(imageId, { width: c.width, height: c.height, data }, { pixelRatio: DPR })
    imageIds.push(imageId)
    features.push({ ...feature, properties: { ...feature.properties, imageId } })
  }

  map.addSource(LABEL_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features }
  })

  // 置于机器人图层之前（WebGL 管线中层级更低 = 不遮挡机器人）
  const beforeId = map.getLayer(ROBOT_MARKER_LAYER_ID) ? ROBOT_MARKER_LAYER_ID : undefined
  map.addLayer({
    id: LABEL_LAYER,
    type: 'symbol',
    source: LABEL_SOURCE,
    layout: {
      'icon-image': ['get', 'imageId'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    }
  }, beforeId)

  shopLabelCtrl = {
    remove() {
      if (map?.getLayer(LABEL_LAYER)) map.removeLayer(LABEL_LAYER)
      if (map?.getSource(LABEL_SOURCE)) map.removeSource(LABEL_SOURCE)
      imageIds.forEach(id => { try { map?.removeImage(id) } catch (_) { } })
    }
  }
}

function collectAllAnnouncementPoints(floor) {
  const allPoints = []
  for (const config of ROBOT_CONFIGS) {
    if (config.floor !== floor) continue
    const state = getPatrolState(config.id)
    if (state && state.announcementPoints) {
      for (const ap of state.announcementPoints) {
        allPoints.push({ ...ap, robotId: config.id })
      }
    }
  }
  return allPoints
}

function refreshAnnouncementLayer(floor) {
  const targetFloor = floor ?? currentFloor.value
  const allPoints = collectAllAnnouncementPoints(targetFloor)
  if (allPoints.length > 0) {
    updateAnnouncementPoints(allPoints)
  }
}

async function createOverlays() {
  zones = createSemanticZones(map, buildMallZones(fracToGPS), {
    showLabels: false,
    onClick: (info) => console.log('[MallZone]', info),
  })

  robotCtrl = addStatusRobotMarkers(map, [], { size: 24 })

  loadDefaultPois()
  await addShopLabels()

  iot = createIoTBubbles(map, { defaultDuration: 3000, maxBubbles: 10 })

  robotManager.initRobots(ROBOT_CONFIGS, PATROL_ROUTES)

  // Initialize announcement points layer with all points in 'pending' state
  refreshAnnouncementLayer()

  robotManager.onAnnouncementChanged = (_robotId, _points) => {
    refreshAnnouncementLayer()
  }

  robotManager.onPoiArrival = (robotId, waypointIndex) => {
    const robotConfig = ROBOT_CONFIGS.find(r => r.id === robotId)
    if (!robotConfig) return
    const routeIds = robotRoutes.value[robotId] || PATROL_ROUTES[robotId]
    if (!routeIds || waypointIndex >= routeIds.length) return
    
    const poiId = routeIds[waypointIndex]
    const poi = pois.value.find(p => p.id === poiId)
    if (!poi) return
    
    const { xFrac, yFrac } = poi
    iot.emit({
      id: `${robotId}-arrive-${Date.now()}`,
      lngLat: fracToGPS(xFrac, yFrac),
      type: IOT_EVENT_TYPE.CUSTOM,
      message: '导览机器人已到达站点',
      deviceName: robotConfig.name,
      duration: 3000,
    })
    robotNarrations.value[robotId] = {
      id: poi.id, title: poi.name, tag: poi.floor,
      summary: poi.description, narration: poi.narration,
    }
  }

  robotManager.onTourComplete = (robotId) => {
    const robotConfig = ROBOT_CONFIGS.find(r => r.id === robotId)
    if (!robotConfig) return
    const state = robotManager.getPatrolState?.(robotId)
    iot?.emit({
      id: `${robotId}-done-${Date.now()}`,
      lngLat: state?.lngLat || fracToGPS(...robotConfig.initialFrac),
      type: IOT_EVENT_TYPE.CUSTOM,
      message: '导览任务已完成',
      deviceName: robotConfig.name,
      duration: 4000,
    })
    robotNarrations.value[robotId] = null
  }

  robotManager.lowBatteryCallback = (robotId, battery) => {
    const robotConfig = ROBOT_CONFIGS.find(r => r.id === robotId)
    if (!robotConfig) return
    const state = robotManager.getPatrolState?.(robotId)
    if (!state) return
    iot.emit({
      id: `${robotId}-lowbat-${Date.now()}`,
      lngLat: state.lngLat || fracToGPS(state.cartPos.x, state.cartPos.y),
      type: IOT_EVENT_TYPE.CUSTOM,
      message: `电量不足 (${battery}%)`,
      deviceName: robotConfig.name,
      duration: 4000,
    })
  }
}

function highlightFloor(floorId) {
  if (floorId === 'B1') {
    map?.getSource(FLOOR_SOURCE_ID)?.setData(buildB1FloorsGeoJSON(fracToGPS))
    if (zones) zones.update(buildB1Zones(fracToGPS))
  } else {
    map?.getSource(FLOOR_SOURCE_ID)?.setData(buildMallFloorsGeoJSON(fracToGPS, floorId))
    if (zones) zones.update(buildMallZones(fracToGPS, floorId))
  }
  if (buildingCtrl) buildingCtrl.update(buildMallGeoJSON(floorId, fracToGPS))
  addShopLabels(floorId)
}

function onFloorSwitch(floorId) {
  if (floorId === currentFloor.value) return
  floorManager?.switchTo(floorId)
}

// ===== POI event handlers =====
function onPoiSelect(poi) {
  selectedPoiId.value = poi.id
  setActivePoi(poi)
}

function onPoiAdd() {
  addingPoi = true
  map.getContainer().style.cursor = 'crosshair'
  map.once('click', onMapPoiClick)
}

function onMapPoiClick(e) {
  if (!addingPoi) return
  addingPoi = false
  map.getContainer().style.cursor = ''

  if (!slamBounds) {
    console.warn('[MallMap] SLAM 边界未就绪')
    return
  }

  const { sw, ne } = slamBounds
  const xFrac = (e.lngLat.lng - sw[0]) / (ne[0] - sw[0])
  const yFrac = (e.lngLat.lat - sw[1]) / (ne[1] - sw[1])

  if (!isInActiveArea(xFrac, yFrac)) {
    window.alert('该位置超出商场活动区域，请重新选点')
    return
  }

  const x = Math.max(0, Math.min(1, xFrac))
  const y = Math.max(0, Math.min(1, yFrac))
  const newPoi = addPoi(x, y, currentFloor.value)
  nextTick(() => {
    guidePoiPanelRef.value?.openEdit(newPoi)
  })
}

function onPoiUpdate({ id, data }) { updatePoi(id, data) }

function checkPoiInRoute(poiId) {
  for (const route of Object.values(robotRoutes.value)) {
    if (route.includes(poiId)) {
      return true
    }
  }
  for (const config of ROBOT_CONFIGS) {
    if (config.startPoiId === poiId) {
      return true
    }
  }
  return false
}

function onPoiDelete(id) {
  if (checkPoiInRoute(id)) {
    window.alert('该点位已被机器人路线引用，无法删除！')
    return
  }
  if (selectedPoiId.value === id) {
    selectedPoiId.value = null
  }
  removePoi(id)
}

// ===== monitoring control =====
function handleFloorStart(floor) {
  if (!robotCtrl) return

  for (const config of ROBOT_CONFIGS) {
    if (config.floor !== floor) continue
    startSingle(config.id)
  }

  refreshAnnouncementLayer()

  if (iot) {
    ROBOT_CONFIGS.forEach(robot => {
      if (robot.floor !== floor) return
      const routeIds = robotRoutes.value[robot.id] || PATROL_ROUTES[robot.id]
      if (!routeIds || routeIds.length < 2) return
      const startPoi = pois.value.find(p => p.id === routeIds[0])
      if (!startPoi) return
    })
  }
}

function handleStopAll() {
  // Only stop current floor robots
  for (const config of ROBOT_CONFIGS) {
    if (config.floor !== currentFloor.value) continue
    const state = getPatrolState(config.id)
    if (state && state.phase !== GUIDE_PHASE.IDLE) {
      stopSingle(config.id)
    }
  }
  robotNarrations.value = {}
  ROBOT_CONFIGS.forEach(robot => {
    if (robot.floor !== currentFloor.value) return
    robotCtrl.addRobot({
      id: robot.id,
      lngLat: fracToGPS(...robot.initialFrac),
      rotation: iconRot(IDLE_HEADING),
      name: robot.name,
      status: ROBOT_STATUS.IDLE,
      battery: robot.battery,
      task: '待导览',
    })
  })
  if (followCam.value) zoomToFit()
}

function handleConfigRoute({ robotId, route, startPosition, startPoiId }) {
  robotRoutes.value[robotId] = route
  robotStartPoiIds.value[robotId] = startPoiId

  if (route.length >= 2) {
    setRobotRoute(robotId, route)
    refreshAnnouncementLayer()
  }

  if (startPosition && !isRunning.value) {
    setRobotPosition(robotId, startPosition)
  }
}

function handleToggleFollow(robotId) {
  if (followRobotId.value === robotId) {
    setFollowRobot(null)
    zoomToFit()
  } else {
    setFollowRobot(robotId)
  }
}

function handleToggleRobot(robotId) {
  const robot = robots.value.find(r => r.id === robotId)
  if (!robot) return

  if (robot.status === 'running') {
    stopSingle(robotId)
  } else {
    const success = startSingle(robotId)
    if (success) {
      refreshAnnouncementLayer()
    }
  }
}

function handleFloorPause(floor) {
  for (const config of ROBOT_CONFIGS) {
    if (config.floor !== floor) continue
    const state = getPatrolState(config.id)
    if (state && state.phase !== GUIDE_PHASE.IDLE) {
      stopSingle(config.id)
    }
  }
}

function handleResetAll() {
  stopAll()
  robotNarrations.value = {}
  zoomToFit()
  robotManager.initRobots(ROBOT_CONFIGS, PATROL_ROUTES)
  if (followCam.value) zoomToFit()
  // 移除非当前楼层的机器人标记
  ROBOT_CONFIGS.forEach(config => {
    if (config.floor !== currentFloor.value) {
      try { robotCtrl?.removeRobot(config.id) } catch (e) { /* ignore */ }
    }
  })
}

// ===== cleanup =====
function cleanup() {
  stopAll()
  iot?.remove()
  robotCtrl?.remove()
  poiMarkerCtrl?.remove()
  zones?.remove()
  buildingCtrl?.remove()
  shopLabelCtrl?.remove()
  shopLabelCtrl = null
  routeLayer.cleanup()
  if (map?.getLayer(FLOOR_LAYER_ID)) map.removeLayer(FLOOR_LAYER_ID)
  if (map?.getSource(FLOOR_SOURCE_ID)) map.removeSource(FLOOR_SOURCE_ID)
  floorManager?.remove()
  if (map) { map.remove(); map = null }
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
  flex: 1;
  position: relative;
  overflow: hidden;
  z-index: 10;
  display: flex;
}

.grid-bg {
  position: absolute;
  inset: 0;
  opacity: 0.04;
  background-image:
    linear-gradient(rgba(14, 165, 233, 1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14, 165, 233, 1) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}

/* ── sidebars ── */
.sidebar {
  position: relative;
  z-index: 15;
  width: 220px;
  flex-shrink: 0;
  padding: 10px 0 10px 10px;
}

.sidebar--left {
  padding-right: 6px;
}

.sidebar--right {
  padding-left: 6px;
  padding-right: 10px;
}

/* ── center map ── */
.map-center {
  flex: 1;
  position: relative;
  min-width: 0;
  padding: 12px 0;
}

.map-container {
  position: absolute;
  inset: 12px;
  border-radius: 16px;
  overflow: hidden;
  background: rgb(129 182 220 / 49%);
  box-shadow: 0 4px 30px rgba(14, 165, 233, 0.06), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;
}

.map-gl {
  width: 100%;
  height: 100%;
}

/* ── 楼层切换器 ──────────────────────────────────────────────────────────── */
.floor-switcher {
  position: absolute;
  top: 14px;
  right: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 20;
}

.floor-btn {
  position: relative;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.05em;
  background: rgba(8, 18, 50, 0.75);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(80, 140, 255, 0.22);
  border-radius: 8px;
  color: #8eb8e0;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s;
}

.floor-btn:hover {
  background: rgba(0, 82, 204, 0.28);
  border-color: rgba(0, 102, 255, 0.5);
  color: #fff;
}

.floor-btn.active {
  background: rgba(0, 102, 255, 0.60);
  border-color: #0066ff;
  color: #fff;
  box-shadow: 0 0 14px rgba(0, 102, 255, 0.45);
}
</style>
