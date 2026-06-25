<!--
 * @Date: 2026-05-21
 * @LastEditTime: 2026-06-09 10:15:58
 * @Description: 机器人8大工作场景 — 酒店场景 — 配送机器人精准无人化配送 Demo
 *   覆盖能力：createFloorManager / addStatusRobotMarkers / createRobotFOV /
 *          createIoTBubbles / createSemanticZones
 *   配送模拟引擎已拆分至 useDeliverySimulation.js
 * @FilePath: /bic-map/src/examples/scene/hotelDelivery/index.vue
-->
<template>
  <div class="app-root">
    <AppHeader title="酒店配送机器人 — 精准无人化配送" />

    <main class="map-area">
      <div class="grid-bg"></div>

      <div class="map-container">
        <div id="hotelMap" class="map-gl"></div>

        <!-- 楼层切换器 -->
        <div class="floor-switcher">
          <button v-for="floor in floorList" :key="floor.id" class="floor-btn"
            :class="{ active: currentFloor === floor.id }" @click="onFloorSwitch(floor.id)">
            {{ floor.label }}
            <!-- 机器人实际所在楼层指示点 -->
            <span v-if="robotFloor === floor.id" class="robot-floor-dot"></span>
          </button>

          <!-- 跨楼层提示：视图楼层与机器人实际楼层不一致时显示 -->
          <transition name="hud-fade">
            <div class="cross-floor-tip" v-if="currentFloor !== robotFloor">
              <span class="cross-floor-tip__dot"></span>
              <span class="cross-floor-tip__text">机器人在 {{ robotFloor }}</span>
            </div>
          </transition>
        </div>

        <!-- 任务状态 HUD -->
        <transition name="hud-fade">
          <div class="status-hud" v-if="hudText">
            <span class="hud-dot" :class="hudDotClass"></span>
            <span class="hud-text">{{ hudText }}</span>
          </div>
        </transition>

        <!-- 朝向指示器 -->
        <div class="heading-hud">
          <div class="heading-compass">
            <svg viewBox="0 0 32 32" width="32" height="32">
              <circle cx="16" cy="16" r="14" fill="none" stroke="rgba(0,102,255,0.35)" stroke-width="1.5" />
              <polygon :points="`16,4 13,20 16,17 19,20`" :transform="`rotate(${headingLabel.deg}, 16, 16)`"
                fill="#0066ff" />
              <circle cx="16" cy="16" r="2" fill="rgba(255,255,255,0.6)" />
            </svg>
          </div>
          <div class="heading-info">
            <span class="heading-deg">{{ headingLabel.deg }}°</span>
            <span class="heading-dir">{{ headingLabel.dir }}</span>
          </div>
        </div>
      </div>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Play, Pause, Maximize, RotateCcw, Layers, Crosshair } from 'lucide-vue-next'
import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'
import bicMap from '@/bicMap/core/bicmap-gl'
import { ROBOT_STATUS, addStatusRobotMarkers, createRobotFOV } from '@/bicMap/core/robot'
import { buildHotelGeoJSON, buildHotelFloorsGeoJSON, buildHotelZones, buildHotelRoomLabelsGeoJSON } from './hotelLayout.js'
import {
  FLOOR_CONFIGS,
  MAP_START_X, MAP_START_Y, MAP_WIDTH, MAP_HEIGHT, MAP_X_GRID_COUNT, MAP_Y_GRID_COUNT, MAP_RESOLUTION,
  IDLE_HEADING, IDLE_FRAC, VIEW_3D_PITCH,
} from './constants.js'
import { createGeoUtils, iconRot } from '@/bicMap/core/navigation'
const { fracToCart, fracToGPS } = createGeoUtils({ startX: MAP_START_X, startY: MAP_START_Y, width: MAP_WIDTH, height: MAP_HEIGHT, scale: MAP_RESOLUTION })
import { ROOM_ROUTES } from './routeConfig.js'
import { useDeliverySimulation } from './useDeliverySimulation.js'
import { useFollowCam } from './useFollowCam.js'
import { createBuildings } from '@/bicMap/core/mapFeatures'
import { createRobot3DLayer } from '@/bicMap/core/robot/visual/robot3DLayer.js'
import { DELIVERY_ROBOT_CONFIG } from './constants.js'
import { createSemanticZones } from '@/bicMap/core/mapFeatures'
import { createFloorManager } from '@/bicMap/core/mapFeatures'
import { createIoTBubbles } from '@/bicMap/core/overlay'


// ===== 运行时对象（不走响应系统，避免高频触发）=====
let map = null
let floorManager = null
let buildingCtrl = null
let robotCtrl = null
let robot3DCtrl = null
let fov = null
let iot = null
let zones = null
let cameraBound = null
let roomLabelMarkers = []

const FLOOR_SOURCE_ID = 'bic-hotel-floors-source'
const FLOOR_LAYER_ID = 'bic-hotel-floors-layer'

// ===== 响应式状态 =====
const currentFloor = ref('1F')
const is3D = ref(false)

const floorList = FLOOR_CONFIGS.map(f => ({ id: f.id, label: f.label }))

// ===== 配送模拟引擎必须先初始化以获取 followCam ref，再传递给相机跟随 =====
const deliverySim = useDeliverySimulation({
  getRobotCtrl: () => robotCtrl,
  getRobot3DCtrl: () => robot3DCtrl,
  getFov: () => fov,
  getIot: () => iot,
  getFloorManager: () => floorManager,
  is3D,
  // onPositionChange 仅在配送运行期间（RAF tick），此时 updateCamera 已就绪
  onPositionChange: (lngLat, heading) => updateCamera(lngLat, heading),
  missionConfig: ROOM_ROUTES['215'],
})

// ===== 使用 composable 返回的 followCam ref 初始化相机跟随 =====
const { updateCamera } = useFollowCam({
  getMap: () => map, is3D,
  followCam: deliverySim.followCam,
})

// 解构出需要的属性（保持与重构前的命名一致）
const {
  isRunning, isPaused, deliveryPhase, robotFloor,
  followCam,
  robotHeading, toggleDelivery, resetDelivery, stopTimers,
} = deliverySim

// 朝向文字标签（8方位）
const CARDINAL = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const headingLabel = computed(() => {
  const deg = ((robotHeading.value % 360) + 360) % 360
  const idx = Math.round(deg / 45) % 8
  return { deg: Math.round(deg), dir: CARDINAL[idx] }
})

// HUD 文案映射
const HUD_TEXT_MAP = {
  moving: '正在前往目的地...',
  elevator: '呼叫电梯，等待乘梯...',
  riding: '乘梯中...',
  delivered: '配送完成，等待返回...',
  returning: '返回途中...'
}

const hudText = computed(() => HUD_TEXT_MAP[deliveryPhase.value] ?? '')

const hudDotClass = computed(() => ({
  'hud-dot--blue': deliveryPhase.value === 'moving',
  'hud-dot--amber': deliveryPhase.value === 'elevator' || deliveryPhase.value === 'riding',
  'hud-dot--green': deliveryPhase.value === 'delivered',
  'hud-dot--cyan': deliveryPhase.value === 'returning'
}))

const footerButtons = computed(() => [
  {
    label: !isRunning.value ? '开始配送' : isPaused.value ? '继续配送' : '暂停配送',
    icon: !isRunning.value || isPaused.value ? Play : Pause,
    active: isRunning.value && !isPaused.value,
    onClick: toggleDelivery
  },
  {
    label: '适应地图',
    icon: Maximize,
    onClick: zoomToFit
  },
  {
    label: '重置场景',
    icon: RotateCcw,
    onClick: resetScene
  },
  {
    label: is3D.value ? '切换 2D' : '切换 3D',
    icon: Layers,
    active: is3D.value,
    onClick: toggle3D
  },
  {
    label: '视角跟随',
    icon: Crosshair,
    active: followCam.value,
    disabled: !isRunning.value,
    onClick: toggleFollow
  }
])

// ===== SLAM 可见性控制 =====
function setSlamVisible(visible) {
  FLOOR_CONFIGS.forEach(f => {
    const lid = `floor-slam-layer-${f.id}`
    if (map.getLayer(lid)) {
      map.setPaintProperty(lid, 'raster-opacity', visible ? 1 : 0)
    }
  })
}

// ===== 机器人跨楼层可见性同步 =====
function syncRobotVisibility() {
  if (!robotCtrl || !fov || !map) return
  const visible = robotFloor.value === currentFloor.value
  if (!is3D.value && map.getLayer('robot-markers-layer')) {
    map.setLayoutProperty('robot-markers-layer', 'visibility', visible ? 'visible' : 'none')
  }
  // 3D机器人跨楼层可见性同步
  if (is3D.value && map.getLayer('hotel-robot-3d-layer')) {
    map.setLayoutProperty('hotel-robot-3d-layer', 'visibility', visible ? 'visible' : 'none')
  }
  robotCtrl.toggleLabels(visible)
  if (visible) fov.show()
  else fov.hide()
}

// ===== 生命周期 =====
onMounted(() => initMap())
onBeforeUnmount(() => cleanup())

async function initMap() {
  await bicMap.init()
  map = bicMap.createMap({
    container: 'hotelMap',
    center: [116.4074, 39.9042],
    zoom: 23,
    maxZoom: 23,
    maxPitch: VIEW_3D_PITCH,
    backgroundColor: '#fff'
  })
  bicMap.addZoomControl(map, 'bottom-right')
  map.on('load', async () => {
    await setupScene()
    setTimeout(() => {
      if (is3D.value) {
        setSlamVisible(false)
        // 3D模式：显示3D机器人，隐藏2D机器人标记
        if (map?.getLayer('robot-markers-layer')) {
          map.setLayoutProperty('robot-markers-layer', 'visibility', 'none')
        }
        if (map?.getLayer('hotel-robot-3d-layer')) {
          map.setLayoutProperty('hotel-robot-3d-layer', 'visibility', 'visible')
        }
        map.easeTo({ pitch: VIEW_3D_PITCH, bearing: 30, duration: 800 })
      } else {
        buildingCtrl?.hide()
        if (map?.getLayer(FLOOR_LAYER_ID)) map.setLayoutProperty(FLOOR_LAYER_ID, 'visibility', 'visible')
        setSlamVisible(true)
        // 2D模式：显示2D机器人标记，隐藏3D机器人
        if (map?.getLayer('robot-markers-layer')) {
          map.setLayoutProperty('robot-markers-layer', 'visibility', 'visible')
        }
        if (map?.getLayer('hotel-robot-3d-layer')) {
          map.setLayoutProperty('hotel-robot-3d-layer', 'visibility', 'none')
        }
      }
    }, 100)
  })
}

async function setupScene() {
  // 1. 楼层管理器
  floorManager = createFloorManager(map, {
    floors: FLOOR_CONFIGS,
    onFloorChange: (id) => {
      currentFloor.value = id
      if (map?.getSource(FLOOR_SOURCE_ID)) {
        highlightFloor(id)
        // 切层后重新同步 3D/2D 状态，防止 3D 模式下 SLAM 遮住建筑
        setSlamVisible(!is3D.value)
        // 新楼层的 SLAM 栅格层由 floorManager 动态追加，默认位于图层栈顶，
        // 会遮盖机器人/FOV/语义区域等覆盖层；将其下移到地板填充层之下确保覆盖层可见
        const slamLayerId = `floor-slam-layer-${id}`
        if (map.getLayer(slamLayerId) && map.getLayer(FLOOR_LAYER_ID)) {
          map.moveLayer(slamLayerId, FLOOR_LAYER_ID)
        }
      }
      syncRobotVisibility()
    }
  })
  await floorManager.switchTo('1F')

  // 2. 缓存相机边界（供"适应地图"按钮使用）
  computeCameraBound()

  // 3a. 酒店地板平面（fill 图层，颜色区分房间类型）
  map.addSource(FLOOR_SOURCE_ID, {
    type: 'geojson',
    data: buildHotelFloorsGeoJSON(fracToGPS)
  })
  map.addLayer({
    id: FLOOR_LAYER_ID,
    type: 'fill',
    source: FLOOR_SOURCE_ID,
    paint: {
      'fill-color': ['coalesce', ['get', 'color'], '#455a64'],
      'fill-opacity': 0.72,
    }
  })

  // 3b. 酒店墙体 3D 拉伸
  buildingCtrl = createBuildings(map, buildHotelGeoJSON('1F', fracToGPS), {
    defaultColor: '#0167ff',
    opacity: 0.90,
    showOutline: false
  })
  // 默认 2D 模式，创建后立即隐藏 3D 建筑图层，避免闪现
  buildingCtrl.hide()

  // 4. 创建地图覆盖物（含 3D 机器人图层，须在标注之前完成）
  createOverlays()

  // 5. 将语义区域描边线层提到最顶层
  const ZONE_OUTLINE_LAYER = 'bic-semantic-zones-outline-layer'
  if (map.getLayer(ZONE_OUTLINE_LAYER)) map.moveLayer(ZONE_OUTLINE_LAYER)

  // 3c. 房间名称标注：用 Canvas 2D 光栅化中文，以 symbol 图层写入 WebGL 管线，
  //     置于 hotel-robot-3d-layer 之前，层级低于 3D 机器人，不再遮挡模型
  createRoomLabelMarkers()
}

function computeCameraBound() {
  if (!window.MapUtils) return
  const corners = window.MapUtils.getMapCorners({
    startX: MAP_START_X, startY: MAP_START_Y,
    xGridCount: MAP_X_GRID_COUNT, yGridCount: MAP_Y_GRID_COUNT,
    resolution: MAP_RESOLUTION
  })
  const toLonLat = (c) => {
    const g = window.MapUtils.cartesianToGPS({ x: c.x, y: c.y, scale: MAP_RESOLUTION, zoomFactor: 2 })
    return [g.longitude, g.latitude]
  }
  const bl = toLonLat(corners.bottomLeft)
  const tr = toLonLat(corners.topRight)
  const cb = map.cameraForBounds([bl, tr], { padding: { top: 30, bottom: 30, left: 30, right: 30 } })
  cameraBound = Object.assign({ pitch: 0, bearing: 0 }, cb)
}

function createOverlays() {
  const idleLngLat = fracToGPS(...IDLE_FRAC)
  const idleCartPos = fracToCart(...IDLE_FRAC)

  zones = createSemanticZones(map, buildHotelZones(fracToGPS), {
    showLabels: false,
    onClick: (info) => console.log('[SemanticZone]', info)
  })

  robotCtrl = addStatusRobotMarkers(map, [{
    id: 'delivery-bot',
    lngLat: idleLngLat,
    rotation: iconRot(IDLE_HEADING),
    name: '配送机器人',
    status: ROBOT_STATUS.IDLE,
    battery: 85,
    task: '待命中'
  }], { size: 24, sync: true })

  robot3DCtrl = createRobot3DLayer(map, DELIVERY_ROBOT_CONFIG, {
    layerId: 'hotel-robot-3d-layer',
    headingOffset3D: 180,
    movementThreshold: 0.001,
  })
  if (robot3DCtrl) {
    robot3DCtrl.addRobot({
      id: 'delivery-bot',
      lngLat: idleLngLat,
      heading: IDLE_HEADING,
    })
    // 默认 2D 模式，创建后立即隐藏 3D 机器人图层，避免闪现
    if (map.getLayer('hotel-robot-3d-layer')) {
      map.setLayoutProperty('hotel-robot-3d-layer', 'visibility', 'none')
    }
    console.log('[HotelDelivery] 3D机器人图层创建成功')
  } else {
    console.warn('[HotelDelivery] createRobot3DLayer 返回 null')
  }

  fov = createRobotFOV(map, {
    id: 'hotel-fov',
    angle: 45,
    radiusMeters: 6,
    fillColor: '#00FFFF',
    beforeLayerId: 'hotel-robot-3d-layer',
    mapConfig: {
      startX: MAP_START_X,
      startY: MAP_START_Y,
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      scale: MAP_RESOLUTION
    }
  })
  fov.update(idleCartPos, IDLE_HEADING)

  iot = createIoTBubbles(map, {
    defaultDuration: 4000,
    showIcon: true
  })
}

function highlightFloor(floorId) {
  if (buildingCtrl) buildingCtrl.update(buildHotelGeoJSON(floorId, fracToGPS))
  const floorSource = map?.getSource(FLOOR_SOURCE_ID)
  if (floorSource) floorSource.setData(buildHotelFloorsGeoJSON(fracToGPS, floorId))
  roomLabelMarkers.forEach(m => m.remove())
  roomLabelMarkers = []
  createRoomLabelMarkers(floorId)
  if (zones) zones.update(buildHotelZones(fracToGPS, floorId))
}

// 用 Canvas 2D 离屏渲染中文字符为 ImageData，注入 MapLibre 精灵图集，
// 再以 symbol 图层写入 WebGL 渲染管线，置于 hotel-robot-3d-layer 之前，
// 确保房间标注在层级上低于 3D 机器人模型，不再遮挡机器人。
function createRoomLabelMarkers(floorId = '1F') {
  if (!map) return

  const LABEL_SOURCE = 'bic-room-labels-source'
  const LABEL_LAYER = 'bic-room-labels-layer'
  const FONT = '700 11px "PingFang SC","Microsoft YaHei",system-ui,sans-serif'
  const PAD = 4
  const DPR = Math.min(window.devicePixelRatio || 2, 2)

  const rawFeatures = buildHotelRoomLabelsGeoJSON(fracToGPS, floorId).features
  const features = []
  const imageIds = []

  rawFeatures.forEach((f, idx) => {
    const text = f.properties.label
    const imageId = `bic-rl-${floorId}-${idx}`

    // 离屏 Canvas：在浏览器字体引擎中渲染中文，保留完整字形质量
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')
    ctx.font = FONT
    const tw = ctx.measureText(text).width
    const lw = Math.ceil(tw) + PAD * 2
    const lh = 11 + PAD * 2
    c.width = Math.ceil(lw * DPR)
    c.height = Math.ceil(lh * DPR)
    ctx.scale(DPR, DPR)
    ctx.font = FONT
    ctx.shadowColor = 'rgba(0,0,0,1)'
    ctx.shadowBlur = 4
    ctx.shadowOffsetY = 1
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, lw / 2, lh / 2)

    const { data } = ctx.getImageData(0, 0, c.width, c.height)
    map.addImage(imageId, { width: c.width, height: c.height, data }, { pixelRatio: DPR })
    imageIds.push(imageId)
    features.push({ ...f, properties: { ...f.properties, imageId } })
  })

  map.addSource(LABEL_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features }
  })

  // 置于 3D 机器人图层之前（WebGL 管线中层级更低 = 不遮挡机器人模型）
  const beforeId = map.getLayer('hotel-robot-3d-layer') ? 'hotel-robot-3d-layer' : undefined
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

  roomLabelMarkers.push({
    remove() {
      if (map?.getLayer(LABEL_LAYER)) map.removeLayer(LABEL_LAYER)
      if (map?.getSource(LABEL_SOURCE)) map.removeSource(LABEL_SOURCE)
      imageIds.forEach(id => { try { map?.removeImage(id) } catch (_) { } })
    }
  })
}

// ===== 楼层手动切换 =====
function onFloorSwitch(id) {
  if (!floorManager || currentFloor.value === id) return
  floorManager.switchTo(id)
}

// ===== 视图控制 =====
function zoomToFit() {
  if (!map || (followCam.value && isRunning.value)) return
  const base = cameraBound ?? { center: [116.4074, 39.9042], zoom: 18 }
  map.easeTo({
    ...base,
    pitch: is3D.value ? VIEW_3D_PITCH : 0,
    bearing: is3D.value ? 30 : 0,
    duration: 800
  })
}

function toggleFollow() {
  if (!isRunning.value) return
  followCam.value = !followCam.value
  if (!followCam.value) {
    map.easeTo({
      bearing: 0,
      pitch: is3D.value ? VIEW_3D_PITCH : 0,
      zoom: cameraBound?.zoom ?? 23,
      duration: 600
    })
  }
}

function toggle3D() {
  is3D.value = !is3D.value
  if (is3D.value) {
    buildingCtrl?.show()
    if (map?.getLayer(FLOOR_LAYER_ID)) map.setLayoutProperty(FLOOR_LAYER_ID, 'visibility', 'visible')
    setSlamVisible(false)
    // 3D模式：显示3D机器人，隐藏2D标记
    if (map?.getLayer('robot-markers-layer')) {
      map.setLayoutProperty('robot-markers-layer', 'visibility', 'none')
    }
    if (map?.getLayer('hotel-robot-3d-layer')) {
      map.setLayoutProperty('hotel-robot-3d-layer', 'visibility', 'visible')
    }
    map.easeTo({ pitch: VIEW_3D_PITCH, bearing: 30, duration: 800 })
  } else {
    buildingCtrl?.hide()
    if (map?.getLayer(FLOOR_LAYER_ID)) map.setLayoutProperty(FLOOR_LAYER_ID, 'visibility', 'visible')
    setSlamVisible(true)
    // 2D模式：显示2D标记，隐藏3D机器人
    if (map?.getLayer('robot-markers-layer')) {
      map.setLayoutProperty('robot-markers-layer', 'visibility', 'visible')
    }
    if (map?.getLayer('hotel-robot-3d-layer')) {
      map.setLayoutProperty('hotel-robot-3d-layer', 'visibility', 'none')
    }
    if (!followCam.value) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 800 })
    }
  }
}

function resetScene() {
  resetDelivery()

  if (robotCtrl) {
    const idleLngLat = fracToGPS(...IDLE_FRAC)
    const idleCartPos = fracToCart(...IDLE_FRAC)
    robotCtrl.updateRobot('delivery-bot', {
      lngLat: idleLngLat, rotation: iconRot(IDLE_HEADING), status: ROBOT_STATUS.IDLE, battery: 85, task: '待命中'
    })
    if (robot3DCtrl) {
      robot3DCtrl.updateRobot('delivery-bot', { lngLat: idleLngLat, heading: IDLE_HEADING })
    }
    fov.update(idleCartPos, IDLE_HEADING)
  }
  iot?.clear()
  floorManager?.switchTo('1F')

  is3D.value = false
  buildingCtrl?.hide()
  if (map?.getLayer(FLOOR_LAYER_ID)) map.setLayoutProperty(FLOOR_LAYER_ID, 'visibility', 'visible')
  setSlamVisible(true)
  if (map?.getLayer('robot-markers-layer')) {
    map.setLayoutProperty('robot-markers-layer', 'visibility', 'visible')
  }
  if (map?.getLayer('hotel-robot-3d-layer')) {
    map.setLayoutProperty('hotel-robot-3d-layer', 'visibility', 'none')
  }

  zoomToFit()
}

// ===== 清理 =====
function cleanup() {
  stopTimers()
  robotCtrl?.remove()
  robot3DCtrl?.destroy()
  fov?.remove()
  iot?.remove()
  zones?.remove()
  buildingCtrl?.remove()
  roomLabelMarkers.forEach(m => m.remove())
  roomLabelMarkers = []
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

/* ── 地图区域 ─────────────────────────────────────────────────────────────── */
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

/* 机器人所在楼层指示点（脉冲小圆点，叠在按钮右上角） */
.robot-floor-dot {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #1cd5a4;
  border: 1.5px solid rgba(4, 12, 40, 0.9);
  animation: robot-dot-pulse 1.4s ease-in-out infinite;
  pointer-events: none;
}

@keyframes robot-dot-pulse {

  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(28, 213, 164, 0.6);
  }

  50% {
    box-shadow: 0 0 0 5px rgba(28, 213, 164, 0);
  }
}

/* 按钮需要 position:relative 才能让绝对定位的点生效 */
.floor-btn {
  position: relative;
}

/* 跨楼层提示横幅：机器人不在当前视图楼层时展示 */
.cross-floor-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: rgba(4, 12, 40, 0.82);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(28, 213, 164, 0.35);
  border-radius: 8px;
  white-space: nowrap;
}

.cross-floor-tip__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #1cd5a4;
  flex-shrink: 0;
  animation: hud-pulse 1.2s ease-in-out infinite;
}

.cross-floor-tip__text {
  font-size: 11px;
  font-weight: 600;
  color: #7de8cc;
  letter-spacing: 0.04em;
}

/* ── 任务状态 HUD ─────────────────────────────────────────────────────────── */
.status-hud {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  background: rgba(4, 12, 40, 0.84);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(0, 102, 255, 0.28);
  border-radius: 30px;
  z-index: 20;
  pointer-events: none;
  box-shadow: 0 4px 22px rgba(0, 20, 80, 0.45);
}

.hud-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  animation: hud-pulse 1.2s ease-in-out infinite;
}

.hud-dot--blue {
  background: #0066ff;
}

.hud-dot--amber {
  background: #f7a800;
}

.hud-dot--green {
  background: #1cd5a4;
}

.hud-dot--cyan {
  background: #00e5ff;
}

.hud-text {
  font-size: 13px;
  font-weight: 600;
  color: #b8d4ff;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

/* ── 朝向指示器 ─────────────────────────────────────────────────────────── */
.heading-hud {
  position: absolute;
  bottom: 18px;
  right: 48px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 8px;
  background: rgba(4, 12, 40, 0.82);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(0, 102, 255, 0.28);
  border-radius: 24px;
  z-index: 20;
  pointer-events: none;
  box-shadow: 0 4px 18px rgba(0, 20, 80, 0.4);
}

.heading-compass {
  flex-shrink: 0;
}

.heading-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
}

.heading-deg {
  font-size: 14px;
  font-weight: 700;
  color: #e8f0ff;
  letter-spacing: 0.03em;
  line-height: 1;
}

.heading-dir {
  font-size: 10px;
  font-weight: 600;
  color: #5588cc;
  letter-spacing: 0.08em;
  line-height: 1;
}

/* ── Transitions ─────────────────────────────────────────────────────────── */
.hud-fade-enter-active,
.hud-fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.hud-fade-enter-from,
.hud-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

@keyframes hud-pulse {

  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.5;
    transform: scale(0.72);
  }
}
</style>
