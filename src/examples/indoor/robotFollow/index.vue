<!--
 * 机器人视角跟随示例页
 * 只暴露一个"视角跟随"按钮；SLAM 底图在挂载时静默加载做场景铺底
-->
<template>
  <div class="app-root">
    <canvas id="canvasMap" style="display:none"></canvas>

    <AppHeader title="机器人视角跟随" />

    <main class="map-area">
      <div class="grid-bg"></div>
      <div class="map-container">
        <div id="slamMap" class="map-gl"></div>
        <FollowBadge :visible="robotFollow" :pose="robotPose" :phase="robotPhase" />
      </div>
    </main>

    <AppFooter :left-buttons="footerButtons" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Crosshair } from 'lucide-vue-next'

import AppHeader from '../../components/AppHeader.vue'
import AppFooter from '../../components/AppFooter.vue'
import FollowBadge from './FollowBadge.vue'
import { useRobotFollow } from './useRobotFollow'

import bicMap from '../../../bicMap/core/bicmap-gl'
import slamImage from '../../assets/slam_transparent.png'

// ===== 路径线性插值：将稀疏路径点扩充到至少 minCount 个点 =====
function interpolatePath(pts, minCount = 200) {
  if (pts.length < 2) return pts
  const stepsPerSeg = Math.ceil((minCount - 1) / (pts.length - 1))
  const result = []
  for (let i = 0; i < pts.length - 1; i++) {
    for (let j = 0; j < stepsPerSeg; j++) {
      const t = j / stepsPerSeg
      result.push([
        pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t,
        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t
      ])
    }
  }
  result.push(pts[pts.length - 1])
  return result
}

// ===== 机器人巡逻路径（来自实际坐标采集）=====
const RAW_ROBOT_PATH = [
  [116.40736258292469, 39.90421239604876],
  [116.40736365357606, 39.90421239604876],
  [116.40736484319001, 39.90421239604876],
  [116.40736638968923, 39.90421239604876],
  [116.40736746034065, 39.90421239604876],
  [116.40736900683987, 39.90421239604876],
  [116.40737055333688, 39.90421239604876],
  [116.40737317048962, 39.90421239604876],
  [116.407376620369, 39.90421221353395],
  [116.40737840479096, 39.90421221353395],
  [116.40738149778707, 39.90421239604876],
  [116.4073834011694, 39.90421239604876],
  [116.40738613728035, 39.90421230479137],
  [116.40738923027664, 39.90421221353395],
  [116.40739113366101, 39.90421239604876],
  [116.40739291808086, 39.90421239604876],
  [116.40739470250281, 39.90421239604876],
  [116.40739636796229, 39.90421239604876],
  [116.40739910407325, 39.90421230479137],
  [116.40740124537831, 39.90421230479137],
  [116.40740469525974, 39.90421221353395],
  [116.40740778825597, 39.90421221353395],
  [116.40741171398298, 39.90421230479137],
  [116.40741552074758, 39.90421239604876],
  [116.40742027920328, 39.90421266982108],
  [116.40742242050834, 39.90421339988046],
  [116.40742408596782, 39.9042144037121],
  [116.40742503765898, 39.90421540754372],
  [116.40742622727294, 39.90421695891985],
  [116.40742682208099, 39.90421860155416],
  [116.40742729792652, 39.904220061672845],
  [116.40742801169489, 39.90422124801924],
  [116.40742908234637, 39.90422161304886],
  [116.40743074780585, 39.90422216059332],
  [116.40743300807338, 39.90422234310816],
  [116.40743550626155, 39.90422252562297],
  [116.4074375286063, 39.90422252562297],
  [116.40743895614298, 39.90422252562297],
  [116.40744062160252, 39.90422261688039],
  [116.40744240602231, 39.90422261688039],
  [116.40744466628979, 39.90422252562297],
  [116.40744597486628, 39.90422252562297],
  [116.40744740240297, 39.90422252562297],
  [116.40744894890003, 39.90422261688039],
  [116.40745156605067, 39.90422261688039],
  [116.40745370735567, 39.90422261688039],
  [116.40745549177774, 39.90422261688039],
  [116.40745751412027, 39.90422261688039],
  [116.40745929854222, 39.9042227993952],
  [116.40745989334812, 39.9042227993952],
  [116.40746048815612, 39.90422289065259],
  [116.40746120192449, 39.90422298191004],
  [116.40746215361565, 39.90422334693969],
  [116.40746310530676, 39.90422407699893],
  [116.40746429492071, 39.90422498957301],
  [116.40746488972877, 39.90422599340448],
  [116.40746548453467, 39.90422727100815],
  [116.40746548453467, 39.904228274839625],
  [116.40746560349714, 39.90422927867104],
  [116.40746560349714, 39.904230191245034],
  [116.40746560349714, 39.904231103819086],
  [116.40746584141988, 39.90423219890869],
  [116.40746560349714, 39.904233111482654],
  [116.40746405699787, 39.904233202740045],
  [116.40746262946124, 39.904233293997464],
  [116.40746179673039, 39.904233202740045],
  [116.40746048815612, 39.904233202740045],
  [116.40745882269664, 39.904233111482654],
  [116.40745727619748, 39.90423292896787],
  [116.40745549177774, 39.90423292896787],
  [116.40745370735567, 39.90423302022526],
  [116.40745216085867, 39.904233111482654],
  [116.40745144709035, 39.90423384154184],
  [116.40745085228224, 39.90423484537314],
  [116.40745049539919, 39.90423594046189],
  [116.40745013851392, 39.90423740058017],
  [116.40744978163082, 39.904238404411444],
  [116.40744978163082, 39.90423940824272],
  [116.40744978163082, 39.90424050333135],
  [116.40744978163082, 39.90424132464784],
  [116.40744978163082, 39.90424223722175],
  [116.40744906786244, 39.904242967280766],
  [116.40744799720892, 39.90424324105297],
  [116.40744692655744, 39.90424324105297],
  [116.40744573694349, 39.90424324105297],
  [116.40744407148179, 39.90424324105297],
  [116.40744300083031, 39.90424324105297],
  [116.40744133537089, 39.90424324105297],
  [116.40743943198856, 39.90424351482508],
  [116.40743836133498, 39.904243606082474],
  [116.40743562522397, 39.90424351482508],
  [116.40743384080207, 39.90424351482508],
  [116.40743181845943, 39.90424342356772],
  [116.40743062884553, 39.90424342356772],
  [116.4074287254632, 39.90424342356772],
  [116.40742420492813, 39.90424305853821],
  [116.40742206362313, 39.904243149795576],
  [116.40742123089444, 39.90424305853821],
  [116.40742123089444, 39.90424305853821],
  [116.40741682932185, 39.90424305853821],
  [116.40741682932185, 39.90424305853821]
]
const ROBOT_PATH = interpolatePath(RAW_ROBOT_PATH, 1000)

// ===== SLAM 底图参数 =====
const MAP_START_X = -58.999993705749512
const MAP_START_Y = -21.349997329711914
const MAP_X_GRID_COUNT = 2752
const MAP_Y_GRID_COUNT = 1536
const MAP_RESOLUTION = 0.05

// ===== 地图本体 =====
const map = ref(null)

// ===== 机器人 + 视角跟随 =====
const {
  follow: robotFollow,
  pose: robotPose,
  phase: robotPhase,
  controller: robotController,
  toggle: toggleRobotFollow
} = useRobotFollow(map, {
  motion: 'waypoint',
  waypoints: ROBOT_PATH,
  waypointSpeed: 1.0,
  robotId: 'robot-slam-01',
  robotName: '巡检机器人-01',
  markerOptions: { size: 32 }
})

// ===== Footer 按钮 =====
const footerButtons = computed(() => [
  { label: '视角跟随', active: !!robotController.value, icon: Crosshair, onClick: toggleRobotFollow }
])

onMounted(() => { initMap() })
onBeforeUnmount(() => {
  if (map.value) { map.value.remove(); map.value = null }
})

// ===== 生命周期 =====
async function initMap() {
  try {
    await bicMap.init()
    map.value = bicMap.createMap({
      container: 'slamMap',
      center: [116.4074, 39.9042],
      zoom: 18,
      backgroundColor: '#fff'
    })
    bicMap.addZoomControl(map.value, 'bottom-right')
    map.value.on('load', () => { loadBaseMap() })
  } catch (error) {
    console.error('初始化地图失败:', error)
  }
}

async function loadBaseMap() {
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
  } catch (error) {
    console.error('加载底图失败:', error)
  }
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
  flex: 1; position: relative; overflow: hidden; z-index: 10;
}
.grid-bg {
  position: absolute; inset: 0; opacity: 0.04;
  background-image:
    linear-gradient(rgba(14,165,233,1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14,165,233,1) 1px, transparent 1px);
  background-size: 40px 40px;
}
.map-container {
  position: absolute; inset: 12px;
  border-radius: 16px; overflow: hidden;
  background: rgb(129 182 220 / 49%);
  box-shadow: 0 4px 30px rgba(14,165,233,0.06), 0 0 0 1px rgba(255,255,255,0.8) inset;
}
.map-gl {
  width: 100%;
  height: 100%;
}
</style>
