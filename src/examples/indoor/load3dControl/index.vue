<template>
  <div class="app-root">
    <canvas id="canvasCtrl" style="display:none"></canvas>

    <AppHeader title="3D模型导航控制" />

    <!-- 导航提示条 -->
    <Transition name="hint-fade">
      <div v-if="isNavigating" class="nav-overlay">
        <div class="hint-pill">
          <MapPin class="hint-icon" :size="15" />
          <span>点击地图设置目标点，机器人将规划路径移动</span>
          <button class="cancel-btn" @click="stopNavigation">
            <X :size="13" /> 退出
          </button>
        </div>
      </div>
    </Transition>

    <!-- 到达提示 -->
    <Transition name="toast-fade">
      <div v-if="navSuccess" class="success-toast">
        <CheckCircle :size="15" />
        <span>已到达目标点</span>
      </div>
    </Transition>

    <!-- 规划失败提示 -->
    <Transition name="toast-fade">
      <div v-if="navError" class="error-toast" role="alert">
        <TriangleAlert :size="15" />
        <span>{{ navError }}</span>
      </div>
    </Transition>

    <main class="map-area">
      <div class="grid-bg"></div>

      <div class="map-container" :class="{ 'nav-mode': isNavigating }">
        <!-- 底层：SLAM 地图 -->
        <div id="ctrlMap" class="layer-map"></div>

        <!-- 顶层：URDFPlugin 透明画布，跟随机器人 GPS 坐标 -->
        <div id="urdfCtrlLayer" class="layer-urdf"></div>


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

import { CheckCircle, Eye, EyeOff, MapPin, Navigation, TriangleAlert, X } from 'lucide-vue-next'
import URDFPlugin from '../../../bicMap/core/urdf'

import AppFooter from '../../components/AppFooter.vue'
import AppHeader from '../../components/AppHeader.vue'

import bicMap from '../../../bicMap/core/bicmap-gl'
import slamImage from '../../assets/slam_pathplan.png'

// ===== SLAM 地图参数 =====
const MAP_START_X      = -58.999993705749512
const MAP_START_Y      = -21.349997329711914
const MAP_X_GRID_COUNT = 2752
const MAP_Y_GRID_COUNT = 1536
const MAP_RESOLUTION   = 0.05
const MAP_CENTER       = [116.407405, 39.904205]
const MAP_ZOOM         = 18
const PITCH_3D         = 62    // 初始/停止时的俯视角度
const PITCH_FPV        = 85    // 第一视角：接近水平，从机器人眼睛向前看
const URDF_URL         = '/bicMap/assets/models/simple_humanoid/urdf/robot.urdf'

// ===== URDFPlugin 参数 =====
const CAM_DISTANCE    = 3
const ROBOT_SCALE     = 0.2
const URDF_FOOT_DEPTH = 0.71   // 骨盆到脚底的 URDF z 深度（米）

// ===== 导航参数（与 singleNavigation 一致） =====
const ROBOT_SPEED          = 0.35   // m/s（慢走速度，便于观察 3D 关节动画）
const ANIM_FRAME_MS        = 50     // ms
const MAP_ZOOM_FACTOR      = 2
const GRID_STRIDE          = 10
// 像素颜色与可通行背景色的距离平方超过此值即视为障碍。
// 相比固定亮度阈值，可识别浅色家具描边和不同底色的 SLAM 地图。
const OBSTACLE_COLOR_DISTANCE = 600
const WALL_PENALTY         = 2.6
const TURN_PENALTY         = 4.0
const DIAGONAL_PENALTY     = 1.2
const MIN_SMOOTH_CLEARANCE = 2

// ===== 行走关节动画参数 =====
// ROBOT_SPEED=0.35 m/s，步幅约 0.35m/步 → 步频 ≈ 1 步/s → 周期 2s
// 50ms × 0.20 rad = 4.0 rad/s，周期 = 2π/4 ≈ 1.57s — 与移动速度匹配
const WALK_SPEED     = 0.20   // 每帧相位增量（rad）
const HIP_AMP        = 0.42   // 髋关节前后摆动幅度（rad，约 24°）
const KNEE_AMP       = 0.55   // 膝关节最大弯曲（rad，约 32°，抬脚明显）
const ANKLE_AMP      = 0.12   // 踝关节振幅（rad）
// hip_roll 不做动态摆动（两侧同号会产生罗圈腿），保持 0 = 双腿平行站立
// 肩关节：URDF axis=0 1 0，正值 = 臂向后（-x 方向），负值 = 臂向前
// SHOULDER_REST 大负值使手臂静止时明显前倾，摆臂范围在前方可见区域内
const SHOULDER_REST  = -0.40  // 手臂静止前倾偏置（约 23° 前倾）
const SHOULDER_AMP   = 0.28   // 肩关节振幅（rad）
// 肘关节：axis=0 1 0，正值=前臂向后（伸展），负值=前臂向前（屈曲）
// 用负值使手臂自然向前弯曲（符合正常行走姿态）
const ELBOW_BASE     = -0.30  // 静止时前臂略向前（屈曲）
const ELBOW_SWING    = -0.15  // 摆臂时附加向前弯曲（负值加深屈曲）

// ===== 响应式状态 =====
const loading       = ref(true)
const loadingText   = ref('加载地图…')
const modelLoaded   = ref(false)
const isNavigating  = ref(false)
const navSuccess    = ref(false)
const navError      = ref('')
const robotLngLat   = ref([...MAP_CENTER])
const isFPV         = ref(false)   // 第一视角（机器人眼睛方向）

const footerButtons = computed(() => [
  {
    label:   isNavigating.value ? '退出导航' : '开始导航',
    active:  isNavigating.value,
    icon:    Navigation,
    onClick: toggleNavigation,
    disabled: !modelLoaded.value
  },
  {
    label:   isFPV.value ? '退出视角跟随' : '视角跟随',
    active:  isFPV.value,
    icon:    isFPV.value ? EyeOff : Eye,
    onClick: toggleFPV,
    disabled: !modelLoaded.value
  }
])

// ===== 非响应式实例 =====
let map             = null
let cacheBound      = null
let initBox         = null
let animIntervalId  = null   // 路径移动计时器
let walkIntervalId  = null   // 行走关节动画计时器
let walkPhase       = 0      // 行走相位（rad）
let currentBearing  = 0      // 机器人当前朝向（°），FPV 实时跟随用
let targetMarkerCtrl = null
let successTimer    = null
let errorTimer      = null

// 路径可视化状态
let navStartPos  = null
let navWaypoints = []
let navSegIdx    = 0

// 路径规划栅格
let walkableGrid  = null
let logicalCols   = 0
let logicalRows   = 0
let clearanceGrid = null

const EMPTY_LINE = { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }

// ===== 生命周期 =====
onMounted(initMap)

onBeforeUnmount(() => {
  clearTimeout(successTimer)
  clearTimeout(errorTimer)
  clearInterval(animIntervalId)
  clearInterval(walkIntervalId)
  animIntervalId = null
  walkIntervalId = null
  removeTargetMarker()
  map?.off('move',  onMapMove)
  map?.off('click', handleMapClick)
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
    container:       'ctrlMap',
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
      canvasId:   'canvasCtrl',
      fitBounds:  true
    })
    cacheBound = result?.cameraBound ?? null
    setTimeout(() => map.easeTo({ pitch: PITCH_3D, duration: 600 }), 50)

    rebuildOccupancy()

    loadingText.value = '加载机器人模型…'
    initURDF()
  })
}

// ===== URDFPlugin 初始化 =====
function initURDF() {
  const container = document.getElementById('urdfCtrlLayer')
  if (!container) return

  initBox = new URDFPlugin(
    container,
    null,
    { fov: 20, position: elevationToPosition(PITCH_3D, CAM_DISTANCE) },
    { controlsFlag: false },
    1
  )

  const urdfCanvas = initBox.renderer?.domElement
  if (urdfCanvas) urdfCanvas.style.pointerEvents = 'none'

  initBox.addDirectionalLight(0xffffff, 1.5, 5, 10, 5)
  initBox.addAmbientLight(0xffffff, 0.8)

  initBox.urdfLoad(URDF_URL)
    .then(result => {
      const robot = result.robot

      // 使用 YXZ 欧拉顺序：先 Y 轴朝向旋转，再 X 轴坐标系转换（z-up → y-up）
      robot.rotation.order = 'YXZ'
      robot.rotation.x     = -Math.PI / 2
      robot.rotation.y     = -Math.PI / 2   // 默认朝北（bearing=0°）
      robot.scale.set(ROBOT_SCALE, ROBOT_SCALE, ROBOT_SCALE)

      // 将脚底对齐到 Three.js 原点（y=0），与地图像素坐标对齐
      robot.position.y = URDF_FOOT_DEPTH * ROBOT_SCALE

      initBox.setLookAtRobot(false)
      syncURDFCamera()

      loading.value     = false
      modelLoaded.value = true
      updateRobotScreenPos()

      map.on('move', onMapMove)
    })
    .catch(err => {
      console.error('[load3dControl] URDF 加载失败:', err)
      loading.value = false
    })

  window.addEventListener('resize', onResize)
  onResize()
}

// ===== 坐标 / 相机工具 =====

function toGPS(x, y) {
  const gps = window.MapUtils.cartesianToGPS({
    x, y, scale: MAP_RESOLUTION, zoomFactor: MAP_ZOOM_FACTOR
  })
  return [gps.longitude, gps.latitude]
}

function elevationToPosition(pitchDeg, distance) {
  const az = Math.PI / 2
  const el = (90 - pitchDeg) * Math.PI / 180
  return {
    x: distance * Math.cos(el) * Math.cos(az),
    y: distance * Math.sin(el),
    z: distance * Math.cos(el) * Math.sin(az)
  }
}

function syncURDFCamera() {
  if (!initBox || !map) return
  const pitch   = map.getPitch()
  const bearing = map.getBearing()
  const el = (90 - pitch) * Math.PI / 180
  const az = Math.PI / 2 + bearing * Math.PI / 180
  initBox.updateCameraControl(az, el, CAM_DISTANCE)
}

function onMapMove() {
  syncURDFCamera()
  updateRobotScreenPos()
}

/** 将机器人 GPS 坐标投影到屏幕像素，实时更新 urdfCtrlLayer 的位置 */
function updateRobotScreenPos() {
  if (!map || !modelLoaded.value) return
  const el = document.getElementById('urdfCtrlLayer')
  if (!el) return
  const px = map.project(robotLngLat.value)
  el.style.left = `${px.x}px`
  el.style.top  = `${px.y}px`
}

function onResize() {
  initBox?.onResize?.()
  updateRobotScreenPos()
}

// ===== 第一视角（手动切换，机器人眼睛视角） =====

/**
 * 切换第一视角：
 *   开启 → center = 机器人位置，bearing = 当前朝向，pitch = PITCH_FPV（85°，接近水平向前）
 *   关闭 → 恢复俯视角（pitch=62°, bearing=0°）
 */
function toggleFPV() {
  if (!map || !modelLoaded.value) return
  isFPV.value = !isFPV.value
  if (isFPV.value) {
    map.easeTo({
      center:   robotLngLat.value,
      bearing:  currentBearing,
      pitch:    PITCH_FPV,
      duration: 500
    })
  } else {
    exitFPV()
  }
}

/** 退出第一视角，恢复俯视 */
function exitFPV() {
  if (!map) return
  isFPV.value = false
  map.easeTo({
    center:   robotLngLat.value,
    bearing:  0,
    pitch:    PITCH_3D,
    duration: 600
  })
}

/**
 * 每段路径开始时：若开启了第一视角，平滑旋转地图 bearing 到新行进方向
 */
function syncFPVBearing(bearing) {
  if (!isFPV.value || !map) return
  map.easeTo({
    center:   robotLngLat.value,
    bearing,
    pitch:    PITCH_FPV,
    duration: 350
  })
}

// ===== 3D 朝向 =====

/**
 * 更新机器人朝向：
 * YXZ 顺序下 rotation.y = π/2 - bearing_rad 使机器人面向移动方向。
 * 推导：local +x 在 world 中 = (cos(rotation.y), 0, -sin(rotation.y))
 *   bearing=0°(北,-z): cos(α)=0, sin(α)=1 → α=π/2
 *   bearing=90°(东,+x): cos(α)=1, sin(α)=0 → α=0
 *   通式: α = π/2 - bearing_rad
 */
function updateRobotHeading(bearingDeg) {
  currentBearing = bearingDeg   // 供 FPV 每帧同步 map bearing
  if (!initBox?.robot) return
  const bearingRad = bearingDeg * Math.PI / 180
  initBox.robot.rotation.y = Math.PI / 2 - bearingRad
}

// ===== 行走关节动画 =====

function startWalkAnimation() {
  if (walkIntervalId) return
  walkIntervalId = setInterval(tickWalkJoints, ANIM_FRAME_MS)
}

function stopWalkAnimation() {
  if (walkIntervalId) {
    clearInterval(walkIntervalId)
    walkIntervalId = null
  }
  walkPhase = 0
  // 复位所有关节到静止姿态
  if (initBox) {
    initBox.setJoint('left_hip_pitch_joint',  0)
    initBox.setJoint('right_hip_pitch_joint', 0)
    initBox.setJoint('left_hip_roll_joint',   0)
    initBox.setJoint('right_hip_roll_joint',  0)
    initBox.setJoint('left_knee_joint',       0)
    initBox.setJoint('right_knee_joint',      0)
    initBox.setJoint('left_ankle_pitch_joint', 0)
    initBox.setJoint('right_ankle_pitch_joint', 0)
    initBox.setJoint('left_shoulder_pitch_joint',  SHOULDER_REST)   // 前倾静止姿
    initBox.setJoint('right_shoulder_pitch_joint', SHOULDER_REST)
    initBox.setJoint('left_elbow_joint',  ELBOW_BASE)
    initBox.setJoint('right_elbow_joint', ELBOW_BASE)
  }
}

function tickWalkJoints() {
  if (!initBox) return
  walkPhase += WALK_SPEED

  const s = Math.sin(walkPhase)

  // softRect(v) = max(0,v)^1.5：零点斜率为 0，平滑无折角
  const softRect = v => Math.pow(Math.max(0, v), 1.5)

  // ── URDF axis=0 1 0（Y 轴旋转，右手定则，正值 = 子链接从 -Z 转向 -X = 向后）
  //    hipPitch正 = 腿向后；s>0: 左腿后/右腿前；s<0: 左腿前/右腿后

  // ── 髋关节前后摆动 ───────────────────────────────────────────
  initBox.setJoint('left_hip_pitch_joint',   HIP_AMP * s)
  initBox.setJoint('right_hip_pitch_joint', -HIP_AMP * s)

  // ── 髋关节 roll 保持 0（两侧同号会引发罗圈腿，去掉侧摆） ──
  initBox.setJoint('left_hip_roll_joint',  0)
  initBox.setJoint('right_hip_roll_joint', 0)

  // ── 膝关节：正值 = 屈膝（flexion）
  // 摆腿阶段（leg forward = s<0）屈膝抬脚离地；站立阶段（s>0）伸直
  // softRect(-s): 当 s<0（左腿前摆, swing phase）时弯膝 ✓
  initBox.setJoint('left_knee_joint',  KNEE_AMP * softRect(-s))
  initBox.setJoint('right_knee_joint', KNEE_AMP * softRect( s))

  // ── 踝关节：正值 = 跖屈（plantarflexion，脚趾向下/蹬地）
  // 支撑末期（stance, leg backward = s>0）：跖屈蹬地 → softRect(s) 给正值
  // 摆腿期（swing, leg forward = s<0）：背屈抬趾 → softRect(-s) 给负值
  const ANKLE_PUSH = 0.22   // 蹬地幅度
  const ANKLE_LIFT = 0.12   // 抬趾幅度
  initBox.setJoint('left_ankle_pitch_joint',   ANKLE_PUSH * softRect( s) - ANKLE_LIFT * softRect(-s))
  initBox.setJoint('right_ankle_pitch_joint',  ANKLE_PUSH * softRect(-s) - ANKLE_LIFT * softRect( s))

  // ── 肩关节：正值 = 臂向后；SHOULDER_REST 大负值让手臂默认明显前倾
  // 对角线反向：左腿后（s>0）→ 左臂前（负） + 右臂后（正）
  initBox.setJoint('left_shoulder_pitch_joint',  SHOULDER_REST - SHOULDER_AMP * s)
  initBox.setJoint('right_shoulder_pitch_joint', SHOULDER_REST + SHOULDER_AMP * s)

  // ── 肘关节：ELBOW_BASE=-0.30（前臂默认前屈），ELBOW_SWING=-0.15（后摆时加深弯曲）
  // 手臂后摆（s>0 → 左肩向后）时 softRect(s) > 0，叠加更大负值 → 肘更屈曲（自然）
  initBox.setJoint('left_elbow_joint',  ELBOW_BASE + ELBOW_SWING * softRect( s))
  initBox.setJoint('right_elbow_joint', ELBOW_BASE + ELBOW_SWING * softRect(-s))
}

// ===== 移动动画 =====

function haversineMeters(a, b) {
  const R    = 6371000
  const toR  = d => d * Math.PI / 180
  const dLat = toR(b[1] - a[1])
  const dLng = toR(b[0] - a[0])
  const h    = Math.sin(dLat / 2) ** 2 +
               Math.cos(toR(a[1])) * Math.cos(toR(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function calcBearing(from, to) {
  // 通过 GPSToCartesian 转到米制平面坐标再计算 bearing，保证各方向比例正确。
  // 推导：lngLatToPixel 中 py = (K - c.y)/res，北移 → c.y 增大 → py 减小（像素上 = 北）
  // 所以 bearing = atan2(dpx, -dpy) = atan2(dcx/res, dcy/res) = atan2(dcx, dcy)，无需取反。
  const Mu = window.MapUtils
  if (Mu?.GPSToCartesian) {
    const c1 = Mu.GPSToCartesian({ longitude: from[0], latitude: from[1], scale: MAP_RESOLUTION, zoomFactor: MAP_ZOOM_FACTOR })
    const c2 = Mu.GPSToCartesian({ longitude: to[0],   latitude: to[1],   scale: MAP_RESOLUTION, zoomFactor: MAP_ZOOM_FACTOR })
    // dcx > 0 = 东，dcy > 0 = 北（Cartesian y 与 px 像素 py 反向），atan2(East, North) = 方位角
    return (Math.atan2(c2.x - c1.x, c2.y - c1.y) * 180 / Math.PI + 360) % 360
  }
  // fallback：cos(lat) 修正经纬度尺度差，不取反
  const latMidRad = ((from[1] + to[1]) / 2) * Math.PI / 180
  const dx = (to[0] - from[0]) * Math.cos(latMidRad)
  const dy = (to[1] - from[1])
  return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360
}

function calcSteps(from, to) {
  const distM    = haversineMeters(from, to)
  const duration = Math.max(80, (distM / ROBOT_SPEED) * 1000)
  return Math.max(2, Math.round(duration / ANIM_FRAME_MS))
}

/**
 * 沿多航点路径动画移动，每段恒速，关节同步行走。
 * 替代 singleNavigation 中依赖 robotController 的版本：
 * 直接更新 robotLngLat + updateRobotScreenPos() 驱动 URDFPlugin 画布跟随。
 */
function animateRobotAlongPath(waypoints) {
  if (!waypoints?.length) return

  clearTimeout(successTimer)
  navSuccess.value = false
  clearInterval(animIntervalId)
  animIntervalId = null

  let segIdx = 0

  const runSegment = () => {
    if (segIdx >= waypoints.length) {
      stopWalkAnimation()
      showSuccessToast()
      if (isFPV.value) exitFPV()   // 到达目标后退出第一视角
      return
    }

    const targetLngLat = waypoints[segIdx++]
    navSegIdx          = segIdx

    const startPos   = [...robotLngLat.value]
    const segBearing = calcBearing(startPos, targetLngLat)
    const steps      = calcSteps(startPos, targetLngLat)
    let   step       = 0

    // 立即转向本段方向
    updateRobotHeading(segBearing)
    // 启动行走动画
    startWalkAnimation()

    // 第一视角（开启时）：将地图 bearing 切换到本段行进方向
    syncFPVBearing(segBearing)

    animIntervalId = setInterval(() => {
      step++
      const t      = step / steps
      const isLast = step >= steps

      robotLngLat.value = [
        startPos[0] + (targetLngLat[0] - startPos[0]) * t,
        startPos[1] + (targetLngLat[1] - startPos[1]) * t
      ]

      // 每帧主动更新机器人屏幕位置（不依赖 map move 事件）
      updateRobotScreenPos()
      // 第一视角（开启时）：每帧将地图中心+朝向锁定到机器人位置和方向
      if (isFPV.value) {
        map.setCenter(robotLngLat.value)
        map.setBearing(currentBearing)
      }
      updatePathProgress(robotLngLat.value)

      if (isLast) {
        clearInterval(animIntervalId)
        animIntervalId = null
        runSegment()
      }
    }, ANIM_FRAME_MS)
  }

  runSegment()
}

// ===== 路径规划（与 pathPlanning 示例保持一致） =====

function lngLatToPixel(lng, lat) {
  const Mu = window.MapUtils
  if (!Mu?.GPSToCartesian) return null
  const c  = Mu.GPSToCartesian({ longitude: lng, latitude: lat, scale: MAP_RESOLUTION, zoomFactor: MAP_ZOOM_FACTOR })
  const px = Math.floor((c.x - MAP_START_X) / MAP_RESOLUTION)
  const py = Math.floor((MAP_START_Y + MAP_Y_GRID_COUNT * MAP_RESOLUTION - c.y) / MAP_RESOLUTION)
  return {
    px: Math.min(MAP_X_GRID_COUNT - 1, Math.max(0, px)),
    py: Math.min(MAP_Y_GRID_COUNT - 1, Math.max(0, py))
  }
}

function pixelToLogical(px, py) {
  const s = GRID_STRIDE
  return {
    ci: Math.min(logicalCols - 1, Math.max(0, Math.floor(px / s))),
    cj: Math.min(logicalRows - 1, Math.max(0, Math.floor(py / s)))
  }
}

function logicalCenterToLngLat(ci, cj) {
  const Mu = window.MapUtils
  if (!Mu?.cartesianToGPS) return [0, 0]
  const pxC = Math.min(MAP_X_GRID_COUNT - 1, ci * GRID_STRIDE + Math.floor(GRID_STRIDE / 2))
  const pyC = Math.min(MAP_Y_GRID_COUNT - 1, cj * GRID_STRIDE + Math.floor(GRID_STRIDE / 2))
  const cx  = MAP_START_X + (pxC + 0.5) * MAP_RESOLUTION
  const cy  = MAP_START_Y + (MAP_Y_GRID_COUNT - pyC - 0.5) * MAP_RESOLUTION
  const gps = Mu.cartesianToGPS({ x: cx, y: cy, scale: MAP_RESOLUTION, zoomFactor: MAP_ZOOM_FACTOR })
  return [gps.longitude, gps.latitude]
}

/**
 * 从非透明像素中统计主色，自动识别 SLAM 图的可通行区域背景色。
 * 颜色按每通道高 6 位量化，避免抗锯齿产生大量相近色。
 */
function detectBackgroundColor(data, w, h) {
  const freq = new Map()
  const step = 6

  for (let y = 0; y < h; y += step) {
    const rowBase = y * w
    for (let x = 0; x < w; x += step) {
      const i = (rowBase + x) * 4
      if (data[i + 3] < 10) continue
      const key = ((data[i] >> 2) << 12) | ((data[i + 1] >> 2) << 6) | (data[i + 2] >> 2)
      freq.set(key, (freq.get(key) || 0) + 1)
    }
  }

  let bestKey = -1
  let bestCount = -1
  for (const [key, count] of freq) {
    if (count > bestCount) {
      bestKey = key
      bestCount = count
    }
  }

  if (bestKey < 0) return [255, 255, 255]
  return [
    ((bestKey >> 12) & 0x3f) << 2,
    ((bestKey >> 6) & 0x3f) << 2,
    (bestKey & 0x3f) << 2
  ]
}

function rebuildOccupancy() {
  const canvas = document.getElementById('canvasCtrl')
  if (!canvas) return
  const ctx  = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const s    = GRID_STRIDE
  logicalCols = Math.ceil(MAP_X_GRID_COUNT / s)
  logicalRows = Math.ceil(MAP_Y_GRID_COUNT / s)

  const bg = detectBackgroundColor(data, w, h)
  const isObstaclePixel = (px, py) => {
    const i = (py * w + px) * 4
    if (data[i + 3] < 10) return true
    const dr = data[i] - bg[0]
    const dg = data[i + 1] - bg[1]
    const db = data[i + 2] - bg[2]
    return dr * dr + dg * dg + db * db > OBSTACLE_COLOR_DISTANCE
  }

  walkableGrid = []
  for (let cj = 0; cj < logicalRows; cj++) {
    const row = []
    const y0 = cj * s
    const yEnd = Math.min(h, y0 + s)
    for (let ci = 0; ci < logicalCols; ci++) {
      const x0 = ci * s
      const xEnd = Math.min(w, x0 + s)

      // 扫描整个逻辑格，而不是只取中心像素。格内命中任意墙体、家具描边
      // 或透明区域即判障碍，避免细线被跳过后路线穿墙。
      let obstacle = false
      for (let py = y0; py < yEnd && !obstacle; py++) {
        for (let px = x0; px < xEnd; px++) {
          if (isObstaclePixel(px, py)) {
            obstacle = true
            break
          }
        }
      }
      row.push(!obstacle)
    }
    walkableGrid.push(row)
  }
  clearanceGrid = computeClearanceGrid(walkableGrid, logicalCols, logicalRows)
}

function computeClearanceGrid(grid, cols, rows) {
  const dist = new Uint16Array(rows * cols)
  dist.fill(65535)
  const q = new Int32Array(rows * cols)
  let qh = 0, qt = 0
  const idx = (c, r) => r * cols + c
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) { dist[idx(c, r)] = 0; q[qt++] = idx(c, r) }
    }
  }
  if (qt === 0) { dist.fill(999); return dist }
  const DIR4 = [[1,0],[-1,0],[0,1],[0,-1]]
  while (qh < qt) {
    const cur = q[qh++]
    const r   = Math.floor(cur / cols), c = cur % cols
    const nd  = dist[cur] + 1
    for (const [dc, dr] of DIR4) {
      const nc = c + dc, nr = r + dr
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
      const ni = idx(nc, nr)
      if (nd < dist[ni]) { dist[ni] = nd; q[qt++] = ni }
    }
  }
  return dist
}

function nearestWalkable(ci, cj) {
  if (!walkableGrid) return null
  if (walkableGrid[cj]?.[ci]) return { ci, cj }
  const key  = (x, y) => `${x},${y}`
  const q    = [[ci, cj]]
  let   qh   = 0
  const seen = new Set([key(ci, cj)])
  let   steps = 0
  while (qh < q.length && steps++ < 12000) {
    const [x, y] = q[qh++]
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= logicalCols || ny >= logicalRows) continue
        const k = key(nx, ny)
        if (seen.has(k)) continue
        seen.add(k)
        if (walkableGrid[ny][nx]) return { ci: nx, cj: ny }
        q.push([nx, ny])
      }
    }
  }
  return null
}

const NEI8 = []
for (let dy = -1; dy <= 1; dy++) {
  for (let dx = -1; dx <= 1; dx++) {
    if (dx !== 0 || dy !== 0) NEI8.push([dx, dy])
  }
}

function astar(start, goal) {
  if (!walkableGrid) return null
  const { ci: sc, cj: sr } = start
  const { ci: gc, cj: gr } = goal
  if (!walkableGrid[sr]?.[sc] || !walkableGrid[gr]?.[gc]) return null

  const rows = logicalRows, cols = logicalCols
  const inf  = 1e30
  const gScore  = new Float64Array(rows * cols).fill(inf)
  const fScore  = new Float64Array(rows * cols).fill(inf)
  const came    = new Int32Array(rows * cols).fill(-1)
  const cameDir = new Int8Array(rows * cols).fill(-1)
  const idx     = (c, r) => r * cols + c
  const h       = (c, r) => Math.hypot(gc - c, gr - r)
  const baseStep = GRID_STRIDE * MAP_RESOLUTION * MAP_ZOOM_FACTOR
  const stepCost = (dx, dy) => Math.hypot(dx, dy) * baseStep + (dx !== 0 && dy !== 0 ? DIAGONAL_PENALTY : 0)
  const clearAt  = (c, r) => clearanceGrid ? clearanceGrid[idx(c, r)] : 999
  const wallCost = (c, r) => WALL_PENALTY / (clearAt(c, r) + 0.35)

  const open   = []
  const si     = idx(sc, sr)
  gScore[si]   = 0
  fScore[si]   = h(sc, sr)
  open.push(si)
  const inOpen = new Set([si])

  while (open.length) {
    let bestI = 0, bestF = fScore[open[0]]
    for (let i = 1; i < open.length; i++) {
      if (fScore[open[i]] < bestF) { bestF = fScore[open[i]]; bestI = i }
    }
    const cur = open[bestI]
    open.splice(bestI, 1)
    inOpen.delete(cur)
    const cr = Math.floor(cur / cols), cc = cur % cols
    if (cc === gc && cr === gr) {
      const path = []
      let p = cur
      while (p !== -1) { path.push({ ci: p % cols, cj: Math.floor(p / cols) }); p = came[p] }
      path.reverse()
      return path
    }
    for (let dir = 0; dir < NEI8.length; dir++) {
      const [dx, dy] = NEI8[dir]
      const nc = cc + dx, nr = cr + dy
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || !walkableGrid[nr][nc]) continue
      // 斜向移动时，两侧正交格也必须可走，禁止从墙角缝隙切过去。
      if (dx !== 0 && dy !== 0) {
        if (!walkableGrid[cr][nc] || !walkableGrid[nr][cc]) continue
      }
      const ni       = idx(nc, nr)
      const turnCost = (cameDir[cur] === -1 || cameDir[cur] === dir) ? 0 : TURN_PENALTY
      const tentative = gScore[cur] + stepCost(dx, dy) + wallCost(nc, nr) + turnCost
      if (tentative < gScore[ni]) {
        came[ni]    = cur
        cameDir[ni] = dir
        gScore[ni]  = tentative
        fScore[ni]  = tentative + h(nc, nr)
        if (!inOpen.has(ni)) { open.push(ni); inOpen.add(ni) }
      }
    }
  }
  return null
}

function hasLineOfSight(a, b) {
  if (!walkableGrid) return false
  const cols = logicalCols
  let x0 = a.ci, y0 = a.cj
  const x1 = b.ci, y1 = b.cj
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  while (true) {
    if (!walkableGrid[y0]?.[x0]) return false
    if (MIN_SMOOTH_CLEARANCE > 0 && clearanceGrid) {
      if (clearanceGrid[y0 * cols + x0] < MIN_SMOOTH_CLEARANCE) return false
    }
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x0 += sx }
    if (e2 <  dx) { err += dx; y0 += sy }
  }
  return true
}

function smoothPathCells(path) {
  if (!path || path.length < 3) return path
  const out = []
  let i = 0
  while (i < path.length) {
    out.push(path[i])
    if (i === path.length - 1) break
    let j = path.length - 1
    for (; j > i + 1; j--) { if (hasLineOfSight(path[i], path[j])) break }
    i = j
  }
  return out
}

// ===== 路径可视化 =====

function drawPathLine(startPos, waypoints) {
  if (!map || !waypoints?.length) return
  navStartPos  = [...startPos]
  navWaypoints = [...waypoints]
  navSegIdx    = 0
  const fullLine = { type: 'Feature', geometry: { type: 'LineString', coordinates: [startPos, ...waypoints] } }
  if (map.getSource('ctrl-remaining')) {
    map.getSource('ctrl-remaining').setData(fullLine)
    map.getSource('ctrl-traveled').setData(EMPTY_LINE)
  } else {
    map.addSource('ctrl-remaining', { type: 'geojson', data: fullLine })
    map.addLayer({ id: 'ctrl-remaining-layer', type: 'line', source: 'ctrl-remaining',
      paint: { 'line-color': '#FF6B35', 'line-width': 2.5, 'line-dasharray': [4, 3], 'line-opacity': 0.85 } })
    map.addSource('ctrl-traveled', { type: 'geojson', data: EMPTY_LINE })
    map.addLayer({ id: 'ctrl-traveled-layer', type: 'line', source: 'ctrl-traveled',
      paint: { 'line-color': '#9CA3AF', 'line-width': 2.5, 'line-opacity': 0.7 } })
  }
}

function updatePathProgress(currentPos) {
  if (!map || !navStartPos || !navWaypoints.length) return
  const traveledCoords = [navStartPos, ...navWaypoints.slice(0, navSegIdx - 1), currentPos]
  map.getSource('ctrl-traveled')?.setData(
    { type: 'Feature', geometry: { type: 'LineString', coordinates: traveledCoords } }
  )
}

function clearPathLine() {
  if (!map) return
  map.getSource('ctrl-remaining')?.setData(EMPTY_LINE)
  map.getSource('ctrl-traveled')?.setData(EMPTY_LINE)
  navStartPos = null; navWaypoints = []; navSegIdx = 0
}

// ===== 导航控制 =====

function toggleNavigation() {
  isNavigating.value ? stopNavigation() : startNavigation()
}

function startNavigation() {
  if (!map || !modelLoaded.value) return
  navError.value = ''
  isNavigating.value = true
  map.on('click', handleMapClick)
  map.getCanvas().style.cursor = 'crosshair'
}

function stopNavigation() {
  clearTimeout(errorTimer)
  navError.value = ''
  clearInterval(animIntervalId)
  animIntervalId = null
  stopWalkAnimation()
  removeTargetMarker()
  clearPathLine()
  map?.off('click', handleMapClick)
  if (map) map.getCanvas().style.cursor = ''
  isNavigating.value = false
  // 若处于第一视角则退出
  if (isFPV.value) exitFPV()
}

function handleMapClick(e) {
  if (!isNavigating.value || !map) return
  const lngLat = [e.lngLat.lng, e.lngLat.lat]
  clearTimeout(errorTimer)
  navError.value = ''
  navSuccess.value = false

  if (walkableGrid) {
    const startPx  = lngLatToPixel(robotLngLat.value[0], robotLngLat.value[1])
    const goalPx   = lngLatToPixel(lngLat[0], lngLat[1])
    if (startPx && goalPx) {
      const startL = pixelToLogical(startPx.px, startPx.py)
      const goalL  = pixelToLogical(goalPx.px, goalPx.py)
      const startC = nearestWalkable(startL.ci, startL.cj)
      const goalC  = nearestWalkable(goalL.ci, goalL.cj)
      if (startC && goalC) {
        const rawPath = astar(startC, goalC)
        if (rawPath?.length) {
          const smoothed  = smoothPathCells(rawPath)
          // 首个栅格中心也保留：机器人可能位于格内任意位置，先移动到已确认
          // 全格可通行的中心，再沿规划路线行走；目标也使用吸附后的安全格中心。
          const waypoints = smoothed.map(c => logicalCenterToLngLat(c.ci, c.cj))
          if (waypoints.length > 0) {
            const safeTarget = waypoints[waypoints.length - 1]
            placeTargetMarker(safeTarget)
            drawPathLine(robotLngLat.value, waypoints)
            animateRobotAlongPath(waypoints)
            return
          }
        }
      }
    }
  }

  // 规划失败时不能退化成直线移动，否则会直接穿过墙体或家具。
  removeTargetMarker()
  showNavigationError(walkableGrid ? '目标点不可达，请选择可通行区域' : '路径栅格尚未就绪，请稍后重试')
}

function placeTargetMarker(lngLat) {
  removeTargetMarker()
  targetMarkerCtrl = bicMap.addDirectionalMarker(map, lngLat, {
    imagePath: '/bicMap/assets/img/pos.png',
    size: 28, initialRotation: 0, draggable: false,
    rotationControl: false, initialEditMode: false
  })
}

function removeTargetMarker() {
  if (targetMarkerCtrl) { targetMarkerCtrl.remove(); targetMarkerCtrl = null }
}

function showSuccessToast() {
  navSuccess.value = true
  clearTimeout(successTimer)
  successTimer = setTimeout(() => {
    navSuccess.value = false
    removeTargetMarker()
    clearPathLine()
  }, 3000)
}

function showNavigationError(message) {
  navError.value = message
  clearTimeout(errorTimer)
  errorTimer = setTimeout(() => {
    navError.value = ''
  }, 3000)
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
  border: 1px solid rgba(14, 165, 233, 0.15);
  box-shadow: 0 4px 30px rgba(14, 165, 233, 0.06), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;
  transition: border-color 0.25s, box-shadow 0.25s;

  &.nav-mode {
    border-color: rgba(0, 102, 255, 0.35);
    box-shadow: 0 4px 30px rgba(0, 102, 255, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;
  }
}

.layer-map {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.layer-urdf {
  position: absolute;
  width: 240px;
  height: 320px;
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

// ===== 导航提示条 =====
.nav-overlay {
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
  border: 1px solid rgba(100, 160, 255, 0.3);
  border-radius: 99px;
  color: #e8f0ff;
  font-size: 13px;
  white-space: nowrap;
  box-shadow: 0 4px 20px rgba(0, 51, 153, 0.35);
  pointer-events: all;
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

// ===== 到达提示 =====
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

.error-toast {
  position: absolute;
  top: 70px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 31;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: rgba(180, 55, 40, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 150, 130, 0.35);
  border-radius: 99px;
  color: #fff1ee;
  font-size: 13px;
  white-space: nowrap;
  box-shadow: 0 4px 20px rgba(160, 40, 25, 0.32);
  pointer-events: none;
}

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
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.toast-fade-enter-from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
.toast-fade-leave-to   { opacity: 0; transform: translateX(-50%) translateY(-6px); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@keyframes spin { to { transform: rotate(360deg); } }
</style>
