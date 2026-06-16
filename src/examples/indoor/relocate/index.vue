<template>
  <div class="app-root">
    <!-- Hidden canvas for BicMap image processing -->
    <canvas id="canvasMap" style="display:none"></canvas>

    <!-- ===== TOP HEADER BAR ===== -->
    <AppHeader title="机器人重定位示例" />

    <!-- ===== RELOCATE HINT OVERLAY ===== -->
    <Transition name="hint-fade">
      <div v-if="isRelocating" class="relocate-overlay">
        <div class="hint-pill">
          <Crosshair class="hint-icon" :size="15" />
          <span>在地图上按住鼠标拖拽，绘制目标区域，机器人将移动到该位置</span>
          <button class="cancel-btn" @click="cancelRelocate">
            <X :size="13" />
            取消
          </button>
        </div>
      </div>
    </Transition>

    <!-- ===== MANUAL RELOCATE HINT OVERLAY ===== -->
    <Transition name="hint-fade">
      <div v-if="isManualRelocating" class="relocate-overlay">
        <div class="hint-pill">
          <Navigation class="hint-icon" :size="15" />
          <span v-if="!targetPlaced">点击地图放置目标点</span>
          <span v-else>拖动可调整位置，滑动调节朝向角度</span>
          <button v-if="targetPlaced" class="confirm-btn" @click="confirmManualRelocate">
            <CheckCircle :size="13" />
            确定
          </button>
          <button class="cancel-btn" @click="cancelManualRelocate">
            <X :size="13" />
            取消
          </button>
        </div>
      </div>
    </Transition>

    <!-- ===== SUCCESS TOAST ===== -->
    <Transition name="toast-fade">
      <div v-if="relocateSuccess" class="success-toast">
        <CheckCircle :size="15" />
        <span>重定位成功，机器人已移动到目标位置</span>
      </div>
    </Transition>

    <!-- ===== MAIN MAP AREA ===== -->
    <main class="map-area">
      <div class="grid-bg"></div>
      <div class="map-container" :class="{ 'drawing-mode': isRelocating, 'manual-mode': isManualRelocating }">
        <div id="relocateMap" class="map-gl"></div>
      </div>
    </main>

    <!-- ===== BOTTOM TOOLBAR ===== -->
    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Crosshair, Navigation, X, CheckCircle } from 'lucide-vue-next'
import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'
import bicMap from '../../../bicMap/core/bicmap-gl'
import slamImage from '../../assets/slam_transparent.png'
import robotIcon from '../../assets/bicmap_robot.png'

// ===== SLAM 地图参数 =====
const MAP_START_X = -58.999993705749512
const MAP_START_Y = -21.349997329711914
const MAP_X_GRID_COUNT = 2752
const MAP_Y_GRID_COUNT = 1536
const MAP_RESOLUTION = 0.05

// ===== 状态 =====
const map = ref(null)
const cacheCameraBound = ref(null)
const robotController = ref(null)
const drawingController = ref(null)
const isRelocating = ref(false)
const isManualRelocating = ref(false)
const targetPlaced = ref(false)
const relocateSuccess = ref(false)
let successTimer = null

// ===== 动画状态（非响应式，高频更新不走响应式）=====
let currentRobotLngLat = null
let currentRobotRotation = 0
let animIntervalId = null
let coordEl = null            // 徽章中坐标文本的 DOM 节点
let targetMarkerCtrl = null   // 手动重定位临时目标点

// ===== Footer 按钮配置（计算属性以响应重定位状态）=====
const footerButtons = computed(() => [
  {
    label:    isRelocating.value ? '取消区域重定位' : '区域重定位',
    active:   isRelocating.value,
    icon:     Crosshair,
    onClick:  () => toggleRelocate(),
    disabled: isManualRelocating.value
  },
  {
    label:    isManualRelocating.value ? '取消手动重定位' : '手动重定位',
    active:   isManualRelocating.value,
    icon:     Navigation,
    onClick:  () => toggleManualRelocate(),
    disabled: isRelocating.value
  }
])

onMounted(() => { initMap() })
onBeforeUnmount(() => {
  clearTimeout(successTimer)
  if (animIntervalId) { clearInterval(animIntervalId); animIntervalId = null }
  coordEl = null
  _removeTargetMarker()
  map.value?.off('click', handleMapClickForTarget)
  if (drawingController.value) {
    drawingController.value.disable()
    drawingController.value = null
  }
  if (robotController.value) {
    robotController.value.remove()
    robotController.value = null
  }
  if (map.value) {
    map.value.remove()
    map.value = null
  }
})

// ===== 笛卡尔坐标 → GPS 转换 =====
function toGPS(x, y) {
  const gpsCoords = window.MapUtils.cartesianToGPS({
    x,
    y,
    scale: MAP_RESOLUTION,
    zoomFactor: 2
  })
  return [gpsCoords.longitude, gpsCoords.latitude]
}

// ===== 获取 SLAM 地图中心点的 GPS 坐标 =====
function getMapCenterPosition() {
  const centerX = MAP_START_X + (MAP_X_GRID_COUNT * MAP_RESOLUTION) / 2
  const centerY = MAP_START_Y + (MAP_Y_GRID_COUNT * MAP_RESOLUTION) / 2
  return toGPS(centerX, centerY)
}

// ===== 核心地图功能 =====
async function initMap() {
  try {
    await bicMap.init()
    map.value = bicMap.createMap({
      container: 'relocateMap',
      center: [116.4074, 39.9042],
      zoom: 18,
      backgroundColor: '#fff'
    })
    bicMap.addZoomControl(map.value, 'bottom-right')
    map.value.on('load', () => {
      loadSlamMapData()
    })
  } catch (error) {
    console.error('初始化地图失败:', error)
  }
}

async function loadSlamMapData() {
  if (!map.value) return
  try {
    const result = await bicMap.loadSlamMap(map.value, {
      startX: MAP_START_X,
      startY: MAP_START_Y,
      xGridCount: MAP_X_GRID_COUNT,
      yGridCount: MAP_Y_GRID_COUNT,
      resolution: MAP_RESOLUTION,
      imagePath: slamImage,
      canvasId: 'canvasMap',
      fitBounds: true
    })
    cacheCameraBound.value = result.cameraBound
    placeRobot()
  } catch (error) {
    console.error('加载SLAM地图失败:', error)
  }
}

// ===== 坐标标签：将 GPS 转为笛卡尔并格式化 =====
function formatCoords(lngLat) {
  if (window.GPSToCartesian) {
    const c = window.GPSToCartesian(lngLat[0], lngLat[1])
    return `X: ${c.x.toFixed(2)}m  Y: ${c.y.toFixed(2)}m`
  }
  return `${lngLat[0].toFixed(5)}, ${lngLat[1].toFixed(5)}`
}

// ===== 将坐标徽章附加到 directionalMarker 元素内（无需独立 Marker）=====
function attachCoordBadge(controller, lngLat) {
  const markerEl = controller.marker.getElement()
  markerEl.style.overflow = 'visible'

  const badge = document.createElement('div')
  badge.className = 'robot-coord-badge'

  const span = document.createElement('span')
  span.className = 'coord-text'
  span.textContent = formatCoords(lngLat)
  badge.appendChild(span)
  markerEl.appendChild(badge)

  return span   // 返回文本节点，用于后续直接更新内容
}

// ===== 放置机器人（初始化，不带动画）=====
function placeRobot(lngLat = null) {
  if (!map.value) return

  const pos = lngLat ?? getMapCenterPosition()
  const rotation = Math.floor(Math.random() * 360)
  currentRobotLngLat = pos
  currentRobotRotation = rotation

  if (robotController.value) {
    robotController.value.setPosition(pos)
    robotController.value.setRotation(-rotation)
    if (coordEl) coordEl.textContent = formatCoords(pos)
  } else {
    robotController.value = bicMap.addDirectionalMarker(map.value, pos, {
      imagePath:       robotIcon,
      size:            48,
      initialRotation: -rotation,
      draggable:       false,
      rotationControl: false,
      initialEditMode: false
    })
    coordEl = attachCoordBadge(robotController.value, pos)
  }
}

// ===== 计算两点间地图方位角（0° = 正北，顺时针）=====
function calcBearing(from, to) {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  return (Math.atan2(dx, dy) * (180 / Math.PI) + 360) % 360
}

// ===== 平滑角度插值（取最短旋转路径）=====
function lerpAngle(a, b, t) {
  const diff = ((b - a + 540) % 360) - 180
  return (a + diff * t + 360) % 360
}

// ===== 机器人分步移动：每隔 stepMs 跳一次，共 steps 步 =====
// endRotation: 可选，到达目标后的最终朝向（手动重定位时由用户设定）
function animateRobotTo(targetLngLat, steps = 6, stepMs = 500, endRotation = null) {
  if (!robotController.value || !currentRobotLngLat) return

  if (animIntervalId) { clearInterval(animIntervalId); animIntervalId = null }

  const startPos = [...currentRobotLngLat]
  const startRotation = currentRobotRotation
  // 移动过程朝向目标方向；若指定了 endRotation，最终一步再插值到它
  const travelRotation = calcBearing(startPos, targetLngLat)
  let step = 0

  animIntervalId = setInterval(() => {
    step++
    const t = step / steps
    const isLast = step >= steps

    const lng = startPos[0] + (targetLngLat[0] - startPos[0]) * t
    const lat = startPos[1] + (targetLngLat[1] - startPos[1]) * t
    // 最后一步：若有 endRotation 则插值到它，否则保持行进方位角
    const targetRot = isLast && endRotation !== null ? endRotation : travelRotation
    const rotation  = lerpAngle(startRotation, targetRot, t)

    currentRobotLngLat = [lng, lat]
    currentRobotRotation = rotation

    robotController.value?.setPosition([lng, lat])
    robotController.value?.setRotation(-rotation)
    if (coordEl) coordEl.textContent = formatCoords([lng, lat])

    if (isLast) {
      clearInterval(animIntervalId)
      animIntervalId = null
      showSuccessToast()
    }
  }, stepMs)
}

function zoomToFit() {
  if (!map.value || !cacheCameraBound.value) return
  map.value.jumpTo(cacheCameraBound.value)
}

function resetView() {
  if (!map.value) return
  map.value.flyTo({ center: [116.4074, 39.9042], zoom: 18, pitch: 0, bearing: 0 })
}

// ===== 重定位操作 =====
function toggleRelocate() {
  if (isRelocating.value) {
    cancelRelocate()
  } else {
    startRelocate()
  }
}

function startRelocate() {
  if (!map.value) return
  isRelocating.value = true

  drawingController.value = bicMap.enableRectangleDrawing(map.value, {
    fillColor: '#0066ff',
    fillOpacity: 0.12,
    lineColor: '#0066ff',
    lineWidth: 2,
    onDrawComplete: (_rectangle, corners) => {
      const lngCenter = (corners.northWest[0] + corners.northEast[0] + corners.southEast[0] + corners.southWest[0]) / 4
      const latCenter = (corners.northWest[1] + corners.northEast[1] + corners.southEast[1] + corners.southWest[1]) / 4

      // 先关闭绘制模式，再启动分步移动动画
      if (drawingController.value) {
        drawingController.value.disable()
        drawingController.value = null
      }
      isRelocating.value = false

      // 每 0.5s 移动一步，共 6 步（3 秒抵达）；最后一步内部触发成功 toast
      animateRobotTo([lngCenter, latCenter], 6, 500)
    }
  })
}

function cancelRelocate() {
  if (animIntervalId) { clearInterval(animIntervalId); animIntervalId = null }
  if (drawingController.value) {
    drawingController.value.disable()
    drawingController.value = null
  }
  isRelocating.value = false
}

// ===== 手动重定位：点击地图放置目标点 + 设置朝向 =====
function toggleManualRelocate() {
  if (isManualRelocating.value) {
    cancelManualRelocate()
  } else {
    startManualRelocate()
  }
}

function startManualRelocate() {
  if (!map.value) return
  isManualRelocating.value = true
  targetPlaced.value = false
  map.value.on('click', handleMapClickForTarget)
  map.value.getCanvas().style.cursor = `url('/bicMap/assets/svg/add-cursor.svg') 10 10, crosshair`
}

function handleMapClickForTarget(e) {
  if (!isManualRelocating.value) return
  const lngLat = [e.lngLat.lng, e.lngLat.lat]

  // 移除旧目标点再重新放
  _removeTargetMarker()

  targetMarkerCtrl = bicMap.addDirectionalMarker(map.value, lngLat, {
    imagePath:       robotIcon,
    initialRotation: 0,
    size:            48,
    draggable:       true,
    rotationControl: true,
    initialEditMode: true,
    highlightStyle: {
      backgroundColor: 'rgba(0, 102, 255, 0.12)',
      borderColor:     '#0066ff',
      shadowColor:     'rgba(0, 102, 255, 0.5)'
    }
  })
  targetPlaced.value = true
}

function confirmManualRelocate() {
  if (!targetMarkerCtrl) return

  const pos      = targetMarkerCtrl.getPosition()
  const R_user   = targetMarkerCtrl.getRotation()  // 目标点的朝向

  // 清理目标点和交互状态
  _removeTargetMarker()
  map.value?.off('click', handleMapClickForTarget)
  if (map.value) map.value.getCanvas().style.cursor = ''
  isManualRelocating.value = false
  targetPlaced.value = false

  // 取反：addDirectionalMarker 内部用 rotate(-R)deg 渲染，
  // animateRobotTo 最终调用 setRotation(-endRotation) 即 rotate(endRotation)deg，
  // 传入 -R_user 使两者抵消，确保机器人最终朝向与目标点一致
  animateRobotTo([pos.lng, pos.lat], 6, 500, -R_user)
}

function cancelManualRelocate() {
  _removeTargetMarker()
  map.value?.off('click', handleMapClickForTarget)
  if (map.value) map.value.getCanvas().style.cursor = ''
  isManualRelocating.value = false
  targetPlaced.value = false
}

function _removeTargetMarker() {
  if (targetMarkerCtrl) {
    targetMarkerCtrl.remove()
    targetMarkerCtrl = null
  }
}

function showSuccessToast() {
  relocateSuccess.value = true
  clearTimeout(successTimer)
  successTimer = setTimeout(() => { relocateSuccess.value = false }, 3000)
}
</script>

<style>
/* ===== 坐标标签（附加在 directionalMarker 元素内，absolute 定位浮于图标上方）===== */
.robot-coord-badge {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px 9px;
  background: rgba(0, 25, 80, 0.82);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(100, 160, 255, 0.35);
  border-radius: 6px;
  white-space: nowrap;
  box-shadow: 0 2px 10px rgba(0, 60, 180, 0.3);
  pointer-events: none;
}
.robot-coord-badge::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: rgba(0, 25, 80, 0.82);
  border-bottom: none;
}
.coord-text {
  font-size: 11px;
  font-weight: 600;
  color: #9ecfff;
  letter-spacing: 0.03em;
  font-family: 'Space Mono', 'Courier New', monospace;
}
</style>

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

/* ===== MAP AREA ===== */
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
    linear-gradient(rgba(14,165,233,1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14,165,233,1) 1px, transparent 1px);
  background-size: 40px 40px;
}

.map-container {
  position: absolute;
  inset: 12px;
  border-radius: 16px;
  overflow: hidden;
  background: rgb(129 182 220 / 49%);
  box-shadow: 0 4px 30px rgba(14,165,233,0.06), 0 0 0 1px rgba(255,255,255,0.8) inset;
  transition: border-color 0.25s, box-shadow 0.25s;
}

.map-container.drawing-mode {
  border-color: rgba(0, 102, 255, 0.35);
  box-shadow: 0 4px 30px rgba(0,102,255,0.12), 0 0 0 1px rgba(255,255,255,0.8) inset;
}

.map-container.manual-mode {
  border-color: rgba(0, 180, 120, 0.35);
  box-shadow: 0 4px 30px rgba(0,180,120,0.12), 0 0 0 1px rgba(255,255,255,0.8) inset;
}

.map-gl {
  width: 100%;
  height: 100%;
}

/* ===== RELOCATE HINT OVERLAY ===== */
.relocate-overlay {
  position: absolute;
  top: 70px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  pointer-events: none;
}

.hint-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(0, 51, 153, 0.88);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(100,160,255,0.3);
  border-radius: 99px;
  color: #e8f0ff;
  font-size: 13px;
  white-space: nowrap;
  box-shadow: 0 4px 20px rgba(0, 51, 153, 0.35);
  pointer-events: all;
}

.hint-icon {
  color: #7eb8ff;
  flex-shrink: 0;
}

.cancel-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  margin-left: 4px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 99px;
  color: #c8daff;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}

.cancel-btn:hover {
  background: rgba(255,255,255,0.22);
}

.confirm-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  margin-left: 4px;
  background: rgba(10, 180, 90, 0.25);
  border: 1px solid rgba(80, 220, 140, 0.4);
  border-radius: 99px;
  color: #c0ffe0;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}

.confirm-btn:hover {
  background: rgba(10, 180, 90, 0.42);
}

/* ===== SUCCESS TOAST ===== */
.success-toast {
  position: absolute;
  top: 70px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: rgba(10, 120, 60, 0.88);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(80, 220, 140, 0.3);
  border-radius: 99px;
  color: #d0ffe8;
  font-size: 13px;
  white-space: nowrap;
  box-shadow: 0 4px 20px rgba(10, 120, 60, 0.35);
  pointer-events: none;
}

/* ===== TRANSITIONS ===== */
.hint-fade-enter-active,
.hint-fade-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.hint-fade-enter-from,
.hint-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.toast-fade-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}
.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-6px);
}
</style>
