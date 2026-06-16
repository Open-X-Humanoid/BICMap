/**
 * 通用机器人路线巡航 + 视角跟随 composable
 *
 * 特性：
 *  1. 按 waypoints 逐段行驶，到达终点后自动掉头返回，循环往返
 *  2. 视野锥 FOV：机器人前方的半透明扇形，跟着位姿实时更新
 *  3. 跟随模式：
 *     - 'navigation' 车头朝上 + 俯仰角（默认）
 *     - 'flat'       车头朝上 + 接近平视角
 *     - 'center'     仅居中不旋转
 *  4. 组件卸载自动清理（图层/source/RAF/控制器）
 *
 * 用法：
 *   const { follow, pose, phase, toggle } = useRobotRoute(mapRef, {
 *     waypoints: [[lng, lat], ...],
 *     speed: 0.0005,
 *     robotId: 'outdoor-robot',
 *     robotName: '巡检机器人'
 *   })
 */
import { ref, onBeforeUnmount } from 'vue'
import bicMap from '../../../bicMap/core/bicmap-gl'
import { createRobot3DLayer } from '@/examples/utils/robot/visual/robot3DLayer'
import { ROBOT_EXPRESSIVE_CONFIG } from '@/examples/utils/robot/visual/robot3DPresets'

// ---- 工具函数 ----
const lerp = (a, b, t) => a + (b - a) * t
const smoothstep = (t) => t * t * (3 - 2 * t)

function lerpAngle(a, b, t) {
  a = ((a % 360) + 360) % 360
  b = ((b % 360) + 360) % 360
  let diff = b - a
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
  let result = a + diff * t
  if (result < 0) result += 360
  if (result >= 360) result -= 360
  return result
}

function compassHeading(from, to) {
  const dLng = to.lng - from.lng
  const dLat = to.lat - from.lat
  let h = Math.atan2(dLng, dLat) * 180 / Math.PI
  if (h < 0) h += 360
  return h
}

function segmentDistance(a, b) {
  const dLng = b[0] - a[0]
  const dLat = b[1] - a[1]
  return Math.sqrt(dLng * dLng + dLat * dLat)
}

export function useRobotRoute(mapRef, options = {}) {
  const {
    waypoints = [],
    speed = 0.0005,                   // 度/秒
    robotId = 'outdoor-robot',
    robotName = '机器人',
    followMode = 'navigation',
    pitch = 55,
    flatPitch = 75,
    focusZoom = 17,
    focusDuration = 600,
    fov = {},
    markerOptions = {},
    iconHeadingOffset = -90,
    renderMode = '2d',
    modelConfig,
    headingOffset3D = 180,
    layerOptions = {}
  } = options

  const fovConfig = {
    enabled: true,
    angle: 60,
    radiusMeters: 20,
    fillColor: '#1677ff',
    innerOpacity: 0.5,
    outerOpacity: 0.02,
    bands: 8,
    segments: 20
  }
  Object.assign(fovConfig, fov)

  const follow = ref(false)
  const pose = ref(null)             // { lng, lat, heading }
  const phase = ref('idle')          // 'idle' | 'moving'
  const controller = ref(null)

  let rafId = 0
  let segIdx = 0                     // 当前段索引
  let legIdx = 0                     // 0=正向, 1=反向
  let segStartTs = 0
  let segmentDurations = []           // 每段的时长 (ms)
  let segmentHeadings = []            // 每段的 { forward, backward } heading
  let prevHeadingAtSwitch = null      // 上一段结束时的 heading，用于段首平滑转向
  let prevHeading = null               // 上一帧的 heading，用于帧间平滑
  let flyEndTime = 0                   // easeTo 预计结束的时间戳，过后恢复 jumpTo

  const FOV_SOURCE_ID = `${robotId}-fov-source`
  const FOV_FILL_ID   = `${robotId}-fov-fill`

  // =============== 航段状态机辅助 ===============
  function getNextState(sIdx, lIdx) {
    if (lIdx === 0) {
      const n = sIdx + 1
      if (n >= waypoints.length - 1) return { segIdx: waypoints.length - 2, legIdx: 1 }
      return { segIdx: n, legIdx: 0 }
    } else {
      const n = sIdx - 1
      if (n < 0) return { segIdx: 0, legIdx: 0 }
      return { segIdx: n, legIdx: 1 }
    }
  }

  function getCurrentHeading(sIdx, lIdx) {
    return lIdx === 0
      ? segmentHeadings[sIdx].forward
      : segmentHeadings[sIdx].backward
  }

  // =============== 运动学：逐段插值 ===============
  const TURN_ZONE = 0.2  // 每段前 20% 为转向区（到达拐点后开始转向）

  function computeRoutePose(now) {
    const dt = now - segStartTs
    const dur = segmentDurations[segIdx]
    const t = Math.min(dt / dur, 1)

    let from, to
    if (legIdx === 0) {
      from = waypoints[segIdx]
      to = waypoints[segIdx + 1]
    } else {
      from = waypoints[segIdx + 1]
      to = waypoints[segIdx]
    }

    const segHeading = getCurrentHeading(segIdx, legIdx)
    const isTurning = t < TURN_ZONE && prevHeadingAtSwitch !== null

    let lng, lat, rawHeading

    if (isTurning) {
      // 原地转向：位置停在拐点，仅旋转 heading
      lng = from[0]
      lat = from[1]
      const turnT = Math.min(t / TURN_ZONE, 1)
      rawHeading = lerpAngle(prevHeadingAtSwitch, segHeading, smoothstep(turnT))
    } else {
      // 直行：将剩余时间映射到完整路程
      const moveT = prevHeadingAtSwitch !== null
        ? Math.max((t - TURN_ZONE) / (1 - TURN_ZONE), 0)
        : t
      const eased = smoothstep(moveT)
      lng = lerp(from[0], to[0], eased)
      lat = lerp(from[1], to[1], eased)
      rawHeading = segHeading
    }

    let heading
    if (prevHeading === null) {
      heading = rawHeading
    } else {
      heading = lerpAngle(prevHeading, rawHeading, 0.15)
      let diff = heading - prevHeading
      if (diff > 180) diff -= 360
      if (diff < -180) diff += 360
      if (Math.abs(diff) > 3) {
        heading = prevHeading + Math.sign(diff) * 3
      }
    }
    prevHeading = heading

    if (t >= 1) {
      prevHeadingAtSwitch = heading
      const next = getNextState(segIdx, legIdx)
      segIdx = next.segIdx
      legIdx = next.legIdx
      segStartTs = now
    }

    return { lng, lat, heading }
  }

  // =============== FOV 视野锥 ===============
  function buildConeFeatures(lng, lat, heading) {
    const cosLat = Math.cos(lat * Math.PI / 180)
    const mToLng = 1 / (111320 * cosLat)
    const mToLat = 1 / 110540
    const r = fovConfig.radiusMeters
    const half = fovConfig.angle / 2
    const segs = fovConfig.segments
    const N = Math.max(2, fovConfig.bands)
    const features = []

    for (let b = 0; b < N; b++) {
      const rInner = r * (b / N)
      const rOuter = r * ((b + 1) / N)
      const t = (b + 0.5) / N
      const opacity = fovConfig.innerOpacity + (fovConfig.outerOpacity - fovConfig.innerOpacity) * t
      const coords = []

      for (let i = 0; i <= segs; i++) {
        const a = heading - half + (fovConfig.angle * i / segs)
        const rad = a * Math.PI / 180
        coords.push([
          lng + rOuter * Math.sin(rad) * mToLng,
          lat + rOuter * Math.cos(rad) * mToLat
        ])
      }
      for (let i = segs; i >= 0; i--) {
        const a = heading - half + (fovConfig.angle * i / segs)
        const rad = a * Math.PI / 180
        coords.push([
          lng + rInner * Math.sin(rad) * mToLng,
          lat + rInner * Math.cos(rad) * mToLat
        ])
      }
      coords.push(coords[0])

      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: { opacity }
      })
    }

    return { type: 'FeatureCollection', features }
  }

  function ensureFovLayers() {
    const m = mapRef.value
    if (!fovConfig.enabled || !m) return
    if (m.getSource(FOV_SOURCE_ID)) return

    const empty = { type: 'FeatureCollection', features: [] }
    m.addSource(FOV_SOURCE_ID, { type: 'geojson', data: empty })

    const robotLayerId = 'robot-markers-layer'
    const beforeId = m.getLayer(robotLayerId) ? robotLayerId : undefined

    m.addLayer({
      id: FOV_FILL_ID,
      type: 'fill',
      source: FOV_SOURCE_ID,
      paint: {
        'fill-color': fovConfig.fillColor,
        'fill-opacity': ['get', 'opacity'],
        'fill-antialias': true
      }
    }, beforeId)
  }

  function updateFovLayers(p) {
    const m = mapRef.value
    if (!fovConfig.enabled || !m) return
    const src = m.getSource(FOV_SOURCE_ID)
    if (!src) return
    src.setData(buildConeFeatures(p.lng, p.lat, p.heading))
  }

  function removeFovLayers() {
    const m = mapRef.value
    if (!m) return
    if (m.getLayer(FOV_FILL_ID)) m.removeLayer(FOV_FILL_ID)
    if (m.getSource(FOV_SOURCE_ID)) m.removeSource(FOV_SOURCE_ID)
  }

  // =============== 主循环 ===============
  function tick() {
    const m = mapRef.value
    if (!controller.value || !m) { rafId = 0; return }

    const now = performance.now()
    const { lng, lat, heading } = computeRoutePose(now)

    if (renderMode === '3d') {
      controller.value.updateRobot(robotId, {
        lngLat: [lng, lat],
        heading
      })
    } else {
      controller.value.updateRobot(robotId, {
        lngLat: [lng, lat],
        rotation: (heading + iconHeadingOffset + 360) % 360
      })
    }
    pose.value = { lng, lat, heading }
    updateFovLayers(pose.value)

    if (follow.value && performance.now() > flyEndTime) {
      if (followMode === 'navigation') {
        m.jumpTo({ center: [lng, lat], bearing: heading, pitch })
      } else if (followMode === 'flat') {
        m.jumpTo({ center: [lng, lat], bearing: heading, pitch: flatPitch })
      } else {
        m.setCenter([lng, lat])
      }
    }

    rafId = requestAnimationFrame(tick)
  }

  // =============== 生命周期 ===============
  function start() {
    const m = mapRef.value
    if (!m || waypoints.length < 2) return

    // 预计算每段时长 (ms)、heading、距离
    segmentDurations = []
    segmentHeadings = []
    for (let i = 0; i < waypoints.length - 1; i++) {
      const dist = segmentDistance(waypoints[i], waypoints[i + 1])
      segmentDurations.push(dist / speed * 1000)
      segmentHeadings.push({
        forward: compassHeading(
          { lng: waypoints[i][0], lat: waypoints[i][1] },
          { lng: waypoints[i + 1][0], lat: waypoints[i + 1][1] }
        ),
        backward: compassHeading(
          { lng: waypoints[i + 1][0], lat: waypoints[i + 1][1] },
          { lng: waypoints[i][0], lat: waypoints[i][1] }
        )
      })
    }

    segIdx = 0
    legIdx = 0
    segStartTs = performance.now()
    prevHeadingAtSwitch = null
    prevHeading = null
    phase.value = 'moving'

    const initialPose = computeRoutePose(performance.now())
    const initial = {
      lngLat: [initialPose.lng, initialPose.lat],
      rotation: (initialPose.heading + iconHeadingOffset + 360) % 360,
      name: robotName,
      id: robotId
    }

    if (controller.value) {
      controller.value.updateRobots([initial])
    } else if (renderMode === '3d') {
      const cfg = modelConfig || ROBOT_EXPRESSIVE_CONFIG
      controller.value = createRobot3DLayer(m, cfg, { ...layerOptions, headingOffset3D })
      controller.value.addRobot({
        id: robotId,
        lngLat: [initialPose.lng, initialPose.lat],
        heading: initialPose.heading
      })
    } else {
      controller.value = bicMap.addRobotMarkers(m, [initial], {
        size: 44,
        showLabels: true,
        ...markerOptions
      })
    }
    pose.value = initialPose
    ensureFovLayers()
    updateFovLayers(pose.value)

    if (!rafId) tick()
  }

  function stop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0 }
    flyEndTime = 0
    removeFovLayers()
    if (controller.value) {
      if (renderMode === '3d') {
        controller.value.destroy()
      } else {
        controller.value.remove()
      }
      controller.value = null
    }
    pose.value = null
    phase.value = 'idle'
    if (follow.value) disableFollow()
  }

  function enableFollow() {
    const m = mapRef.value
    if (!m || !controller.value || !pose.value) return
    follow.value = true
    const target = {
      center: [pose.value.lng, pose.value.lat],
      zoom: Math.max(m.getZoom(), focusZoom),
      duration: focusDuration
    }
    if (followMode === 'navigation') {
      target.bearing = pose.value.heading
      target.pitch = pitch
    } else if (followMode === 'flat') {
      target.bearing = pose.value.heading
      target.pitch = flatPitch
    }
    flyEndTime = performance.now() + focusDuration
    m.easeTo(target)
  }

  function disableFollow() {
    const m = mapRef.value
    follow.value = false
    if (m && (followMode === 'navigation' || followMode === 'flat')) {
      m.easeTo({ bearing: 0, pitch: 0, duration: focusDuration })
    }
  }

  function toggleFollow() {
    if (!mapRef.value || !controller.value || !pose.value) {
      console.warn('[useRobotRoute] 机器人尚未就绪，请先调用 start()')
      return
    }
    follow.value ? disableFollow() : enableFollow()
  }

  /** 一键开关：无 → 启动+跟随；有 → 全部清除 */
  function toggle() {
    if (controller.value) { stop(); return }
    start()
    enableFollow()
  }

  onBeforeUnmount(() => { stop() })

  return { follow, pose, phase, controller, start, stop, toggle, toggleFollow }
}
