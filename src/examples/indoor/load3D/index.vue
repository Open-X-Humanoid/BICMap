<!--
 * @Author: houser.hao@humanoid.com
 * @Date: Do not edit
 * @LastEditTime: Do not edit
 * @LastEditors: houser.hao@humanoid.com
 * @Description: 3D URDF 模型加载示例：URDFPlugin 透明画布叠加在 SLAM 底图上，相机随地图视角同步
 * @FilePath: Do not edit
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
-->
<template>
  <div class="app-root">
    <!-- loadSlamMap 需要一个离屏 canvas 来读取像素 -->
    <canvas id="canvasLoad3D" style="display:none"></canvas>

    <AppHeader title="3D模型加载示例" />

    <main class="map-area">
      <div class="grid-bg"></div>

      <div class="map-container" :class="{ 'nav-mode': placing }">
        <!-- 底层：MapLibre SLAM 地图 -->
        <div id="load3DMap" class="layer-map"></div>

        <!-- 顶层：URDFPlugin 透明覆盖；pointer-events:none 让鼠标事件透传给底层地图 -->
        <div id="urdfLayer" class="layer-urdf"></div>

        <!-- HUD 信息面板 -->
        <!-- <div class="hud-panel">
          <div class="hud-title"><span class="hud-bar"></span>模型信息</div>
          <div class="hud-row">
            <span class="hud-label">状态</span>
            <span class="hud-value" :class="{ 'hud-accent': modelLoaded }">
              {{ modelLoaded ? '已加载' : loading ? '加载中…' : '加载失败' }}
            </span>
          </div>
          <div v-if="modelLoaded" class="hud-row">
            <span class="hud-label">位置</span>
            <span class="hud-value hud-mono">{{ posLabel }}</span>
          </div>
          <div v-if="modelLoaded" class="hud-row">
            <span class="hud-label">视角</span>
            <span class="hud-value hud-mono">P {{ pitchLabel }}°</span>
          </div>
        </div> -->

        <!-- 放置提示 -->
        <Transition name="hint-fade">
          <div v-if="placing" class="hint-pill">
            <MapPin class="hint-icon" :size="14" />
            <span>点击地图放置机器人</span>
            <button class="cancel-btn" @click="cancelPlace"><X :size="12" /> 取消</button>
          </div>
        </Transition>

        <!-- 说明角标 -->
        <div class="plugin-badge">
          <span class="plugin-badge__dot"></span>
          本示例 URDF 文件引入，结合
          <code>@x-humanoid-cloud/URDFPlugin</code>
          插件实现
        </div>

        <!-- 加载遮罩 -->
        <Transition name="fade">
          <div v-if="loading" class="loading-overlay">
            <div class="loading-spinner"></div>
            <span class="loading-text">{{ loadingText }}</span>
          </div>
        </Transition>
      </div>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { MapPin, Maximize, Move, X } from 'lucide-vue-next'
import { URDFPlugin } from '@x-humanoid-cloud/URDFPlugin'

import AppFooter from '../../components/AppFooter.vue'
import AppHeader from '../../components/AppHeader.vue'

import bicMap from '../../../bicMap/core/bicmap-gl'
import slamImage from '../../assets/slam_transparent.png'

// ===== SLAM 地图参数（与 singleNavigation 示例保持一致） =====
const MAP_START_X      = -58.999993705749512
const MAP_START_Y      = -21.349997329711914
const MAP_X_GRID_COUNT = 2752
const MAP_Y_GRID_COUNT = 1536
const MAP_RESOLUTION   = 0.05
const MAP_CENTER       = [116.407405, 39.904205]
const MAP_ZOOM         = 18
const PITCH_3D         = 62
const URDF_URL      = '/bicMap/assets/models/simple_humanoid/urdf/robot.urdf'
const URDF_PACKAGES = {}  // 纯 primitive，无 package:// 路径，留空即可

// URDFPlugin 球坐标相机距离
const CAM_DISTANCE  = 3
// 机器人模型缩放比例（URDF 原始高 ~1.6m，scale=0.12 → 约 0.2m，地图上一个小人）
const ROBOT_SCALE   = 0.2
// 机器人脚底在 URDF z-up 坐标系中距骨盆原点的深度（米）
// 用于旋转并缩放后把脚底对齐到 Three.js 原点，使其与地图标记对齐
const URDF_FOOT_DEPTH = 0.71

// ===== 响应式状态 =====
const loading     = ref(true)
const loadingText = ref('加载地图…')
const modelLoaded = ref(false)
const placing     = ref(false)
const robotLngLat = ref([...MAP_CENTER])
const pitchLabel  = ref(PITCH_3D)

const posLabel = computed(() => {
  const [lng, lat] = robotLngLat.value
  return `${lng.toFixed(5)},${lat.toFixed(5)}`
})

const footerButtons = computed(() => [
  { label: '放置机器人', icon: Move,     onClick: startPlace, disabled: !modelLoaded.value },
])

// ===== 非响应式实例 =====
let map          = null
let cacheBound   = null
let initBox      = null

// ===== 生命周期 =====
onMounted(initMap)

onBeforeUnmount(() => {
  map?.off('move',  onMapMove)
  map?.off('click', onMapClick)
  map?.remove()
  map = null
  initBox?.destroy()
  initBox = null
  window.removeEventListener('resize', onResize)
})

// ===== 地图初始化 =====
async function initMap() {
  await bicMap.init()
  map = bicMap.createMap({
    container:       'load3DMap',
    center:          MAP_CENTER,
    zoom:            MAP_ZOOM,
    backgroundColor: '#ffffff'
  })
  bicMap.addZoomControl(map, 'bottom-right')

  map.on('load', async () => {
    const result = await bicMap.loadSlamMap(map, {
      startX:     MAP_START_X,
      startY:     MAP_START_Y,
      xGridCount: MAP_X_GRID_COUNT,
      yGridCount: MAP_Y_GRID_COUNT,
      resolution: MAP_RESOLUTION,
      imagePath:  slamImage,
      canvasId:   'canvasLoad3D',
      fitBounds:  true
    })
    cacheBound = result?.cameraBound ?? null

    // fitBounds 会把 pitch 置零，延迟一帧恢复 3D 视角
    setTimeout(() => map.easeTo({ pitch: PITCH_3D, duration: 600 }), 50)

    loadingText.value = '加载机器人模型…'
    initURDF()
  })
}

// ===== URDFPlugin 初始化 =====
function initURDF() {
  const container = document.getElementById('urdfLayer')
  if (!container) return

  // sceneOptions 传 null → scene.background 不设置 → Three.js 透明背景
  // renderer 内部已有 { alpha: true }，配合可实现透明叠加
  initBox = new URDFPlugin(
    container,
    null,                    // 透明背景
    {
      fov:      20,
      position: elevationToPosition(PITCH_3D, CAM_DISTANCE)
    },
    { controlsFlag: false }, // 禁用 URDFPlugin 自带 OrbitControls，改由地图相机驱动
    1
  )

  // 让 URDFPlugin 的 canvas pointer-events: none，使地图鼠标事件可以穿透
  const urdfCanvas = initBox.renderer?.domElement
  if (urdfCanvas) {
    urdfCanvas.style.pointerEvents = 'none'
  }

  initBox.addDirectionalLight(0xffffff, 1.5, 5, 10, 5)
  initBox.addAmbientLight(0xffffff, 0.8)

  initBox.urdfLoad(URDF_URL)
    .then(result => {
      const robot = result.robot

      // URDF ROS z-up → Three.js y-up：绕 X 轴旋转 -90° 使机器人直立
      robot.rotation.x = -Math.PI / 2
      robot.rotation.z  = -Math.PI / 2
      // 缩放模型
      robot.scale.set(ROBOT_SCALE, ROBOT_SCALE, ROBOT_SCALE)

      // 对齐脚底到 Three.js 原点（y=0），使机器人脚踩在标记点上而非漂浮在上方。
      // rotation.x=-π/2 后，URDF 的 z 轴映射到 Three.js +y 轴。
      // 脚底在 URDF 中位于 z = -URDF_FOOT_DEPTH，旋转后变为 local y = -URDF_FOOT_DEPTH * scale。
      // 清除 URDFPlugin 内部的 y 偏移，再把脚底提到 world y=0。
      robot.position.y = URDF_FOOT_DEPTH * ROBOT_SCALE

      // 相机看向 y=0（脚底/地面层），与地图标记对齐；不使用 lookAtRobot（看身体中心会偏移）
      initBox.setLookAtRobot(false)

      // 与地图当前视角同步
      syncURDFCamera()

      // 立即定位到初始 GPS 坐标
      updateRobotScreenPos()

      // 监听地图视角变化，实时同步相机和屏幕坐标
      map.on('move', onMapMove)

      loading.value     = false
      modelLoaded.value = true
    })
    .catch(err => {
      console.error('[load3D] URDF 加载失败:', err)
      loading.value = false
    })

  window.addEventListener('resize', onResize)
  onResize()
}

// ===== 相机同步工具 =====

/**
 * 将 MapLibre pitch（° 自垂直向下起算）转为 Three.js 相机 xyz 位置。
 * URDFPlugin elevation = 相机距水平面的仰角（0=水平, π/2=正上方俯视）。
 * MapLibre pitch=0（俯视）→ elevation=π/2；pitch=90（平视）→ elevation=0。
 *   elevation = (90 - pitch) * π/180
 * 球坐标 → 笛卡尔（azimuth=π/2 使相机从 +Z 轴方向看向原点）：
 *   x = d·cos(el)·cos(az),  y = d·sin(el),  z = d·cos(el)·sin(az)
 */
function elevationToPosition(pitchDeg, distance) {
  const az = Math.PI / 2
  const el = (90 - pitchDeg) * Math.PI / 180
  return {
    x: distance * Math.cos(el) * Math.cos(az),
    y: distance * Math.sin(el),
    z: distance * Math.cos(el) * Math.sin(az)
  }
}

/**
 * 将 MapLibre 当前 pitch / bearing 同步到 URDFPlugin 的球坐标相机。
 * elevation = (90 - pitch) × π/180
 * azimuth   = π/2 + bearing × π/180（偏移π/2使默认朝向从正前方看向机器人）
 */
function syncURDFCamera() {
  if (!initBox || !map) return
  const pitch   = map.getPitch()
  const bearing = map.getBearing()
  const el = (90 - pitch) * Math.PI / 180
  const az = Math.PI / 2 + bearing * Math.PI / 180
  initBox.updateCameraControl(az, el, CAM_DISTANCE)
  pitchLabel.value = Math.round(pitch)
}

function onMapMove() {
  syncURDFCamera()
  updateRobotScreenPos()
}

// ===== 放置机器人 =====
function startPlace() {
  if (!modelLoaded.value) return
  placing.value = true
  map.getCanvas().style.cursor = 'crosshair'
  // 防止重复注册
  map.off('click', onMapClick)
  map.on('click', onMapClick)
}

function cancelPlace() {
  placing.value = false
  map.getCanvas().style.cursor = ''
  map.off('click', onMapClick)
}

function onMapClick(e) {
  // 先移除监听，避免多次触发
  map.off('click', onMapClick)

  const lngLat = [e.lngLat.lng, e.lngLat.lat]
  robotLngLat.value = lngLat

  // 立即更新 3D 层位置
  updateRobotScreenPos()

  placing.value = false
  map.getCanvas().style.cursor = ''
}


// ===== 3D 层跟随地图坐标 =====

/**
 * 将机器人的 GPS 坐标投影到屏幕像素，动态更新 #urdfLayer div 的 left/top，
 * 使机器人画布中心（= 机器人脚底）始终跟随地图平移/缩放/旋转。
 */
function updateRobotScreenPos() {
  if (!map || !modelLoaded.value) return
  const urdfLayer = document.getElementById('urdfLayer')
  if (!urdfLayer) return

  const px = map.project(robotLngLat.value)
  urdfLayer.style.left = `${px.x}px`
  urdfLayer.style.top  = `${px.y}px`
}

// ===== 工具 =====
function zoomToFit() {
  if (map && cacheBound) map.jumpTo(cacheBound)
}

function onResize() {
  initBox?.onResize?.()
  updateRobotScreenPos()
}
</script>

<style lang="scss" scoped>
.app-root {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: fixed;
  inset: 0;
  background: linear-gradient(160deg, #e8f4fc 0%, #eef1f8 30%, #f0f6fb 60%, #e6f0fa 100%);
}

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
  box-shadow:
    0 4px 30px rgba(14, 165, 233, 0.06),
    0 0 0 1px rgba(255, 255, 255, 0.8) inset;
  transition: border-color 0.25s, box-shadow 0.25s;

  &.nav-mode {
    border-color: rgba(0, 102, 255, 0.35);
    box-shadow: 0 4px 30px rgba(0, 102, 255, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;
  }
}

// 底层：SLAM 地图
.layer-map {
  position: absolute;
  inset: 0;
  z-index: 1;
}

// 顶层：URDFPlugin 固定尺寸画布，由 JS 动态设置 left/top 跟随机器人 GPS 坐标
// transform: translate(-50%, -50%) 使 div 中心对齐到坐标点（= 机器人脚底）
.layer-urdf {
  position: absolute;
  width: 240px;
  height: 320px;
  // left / top 由 updateRobotScreenPos() 动态设置，初始值隐藏在视口外
  left: -9999px;
  top:  -9999px;
  transform: translate(-50%, -50%);
  z-index: 2;
  pointer-events: none;

  :deep(canvas) {
    pointer-events: none !important;
    width: 100% !important;
    height: 100% !important;
  }
}

// ===== HUD 信息面板 =====
.hud-panel {
  position: absolute;
  top: 18px;
  right: 18px;
  z-index: 30;
  width: 210px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(5, 18, 48, 0.78);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(80, 140, 255, 0.28);
  box-shadow: 0 6px 24px rgba(0, 20, 80, 0.35);
  color: #cfe4ff;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.hud-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 13px;
  color: #fff;
}

.hud-bar {
  width: 4px;
  height: 14px;
  border-radius: 2px;
  background: linear-gradient(180deg, #06b6d4 0%, #3b82f6 100%);
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
  flex-shrink: 0;
}

.hud-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.hud-label { color: #8eb4e6; }
.hud-value { color: #fff; }
.hud-accent { color: #67e8f9; text-shadow: 0 0 8px rgba(103, 232, 249, 0.5); }
.hud-mono { font-family: 'Space Mono', 'Courier New', monospace; font-size: 11px; }

// ===== 放置提示 =====
.hint-pill {
  position: absolute;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(0, 51, 153, 0.88);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(100, 160, 255, 0.3);
  border-radius: 99px;
  color: #e8f0ff;
  font-size: 13px;
  white-space: nowrap;
  box-shadow: 0 4px 20px rgba(0, 51, 153, 0.35);
}

.hint-icon { color: #7eb8ff; flex-shrink: 0; }

.cancel-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  margin-left: 4px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 99px;
  color: #c8daff;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
  pointer-events: all;

  &:hover { background: rgba(255, 255, 255, 0.22); }
}

// ===== 加载遮罩 =====
.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: rgba(255, 255, 255, 0.90);
  backdrop-filter: blur(4px);
  z-index: 40;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(14, 165, 233, 0.2);
  border-top-color: #0ea5e9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-text { color: #374151; font-size: 14px; font-weight: 500; }

.hint-fade-enter-active, .hint-fade-leave-active { transition: opacity 0.25s, transform 0.25s; }
.hint-fade-enter-from, .hint-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(-8px); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@keyframes spin { to { transform: rotate(360deg); } }

// ===== 说明角标 =====
.plugin-badge {
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(14, 165, 233, 0.20);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  color: #374151;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;

  code {
    font-family: 'Courier New', monospace;
    font-size: 11.5px;
    color: #0369a1;
    background: rgba(14, 165, 233, 0.10);
    padding: 1px 5px;
    border-radius: 4px;
  }
}

.plugin-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0ea5e9;
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.25);
  flex-shrink: 0;
}
</style>
