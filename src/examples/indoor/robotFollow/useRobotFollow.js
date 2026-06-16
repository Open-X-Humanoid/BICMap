/**
 * 机器人巡航 + 视角跟随 示例 composable
 *
 * 特性：
 *  1. 两种运动模式：
 *     - 'patrol'   直行 → 扫视 → 掉头 → 反向直行 的循环（默认，像巡检机器人）
 *     - 'circle'   圆周巡航（简单场景）
 *  2. 视野锥 FOV：机器人前方的半透明扇形，跟着位姿实时更新
 *  3. 跟随模式：
 *     - 'navigation' 高德步行导航式，车头朝上 + 俯仰角（默认）
 *     - 'center'     仅居中不旋转
 *  4. 组件卸载自动清理（图层/source/RAF/控制器）
 *
 * 用法：
 *   const { follow, pose, phase, start, toggle } = useRobotFollow(map, {
 *     getPathParams: () => pathFromCoords(slamCoordinates.value),
 *     motion: 'patrol',
 *     fov: { enabled: true, angle: 70, radiusMeters: 12 },
 *     followMode: 'navigation',
 *     pitch: 55
 *   })
 */
import { ref, onBeforeUnmount } from 'vue'
import bicMap from '../../../bicMap/core/bicmap-gl'

// ---- 常量：巡逻节奏 ----
const PATROL_FORWARD_MS = 6000   // 直行时长
const PATROL_SCAN_MS    = 4000   // 扫视时长
const PATROL_TURN_MS    = 1500   // 掉头时长
const PATROL_SCAN_AMP   = 45     // 扫视左右幅度(°)
const PATROL_SCAN_CYCLES = 2     // 扫视过程中的完整来回次数

// ---- 工具 ----
const lerp = (a, b, t) => a + (b - a) * t
const smoothstep = (t) => t * t * (3 - 2 * t)
function shortestAngleLerp(a, b, t) {
  let diff = ((b - a + 540) % 360) - 180
  return ((a + diff * t) % 360 + 360) % 360
}
function compassHeading(from, to) {
  const dLng = to.lng - from.lng
  const dLat = to.lat - from.lat
  let h = Math.atan2(dLng, dLat) * 180 / Math.PI
  if (h < 0) h += 360
  return h
}
function haversineDist(p1, p2) {
  const R = 6371000
  const φ1 = p1[1] * Math.PI / 180
  const φ2 = p2[1] * Math.PI / 180
  const Δφ = (p2[1] - p1[1]) * Math.PI / 180
  const Δλ = (p2[0] - p1[0]) * Math.PI / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function useRobotFollow(mapRef, options = {}) {
  const {
    getPathParams = null,
    motion = 'patrol',               // 'patrol' | 'circle' | 'waypoint'
    waypoints = null,                // 仅 waypoint 模式：[[lng,lat], ...]
    waypointSpeed = 1.0,             // 仅 waypoint 模式：运动速度 m/s
    robotId = 'demo-robot',
    robotName = '机器人',
    angularSpeed = 0.004,            // 仅 circle 模式使用
    followMode = 'navigation',
    pitch = 55,
    focusZoom = 19,
    focusDuration = 600,
    fov = {},
    markerOptions = {},
    // 机器人图标的画面原始朝向（compass°）：
    // 若 PNG 默认 "头朝右(东)" → -90；默认 "头朝上(北)" → 0
    // 当前 robo.png 是朝东，所以默认 -90
    iconHeadingOffset = -90
  } = options

  const fovConfig = {
    enabled: true,
    angle: 40,                       // FOV 夹角（°）
    radiusMeters: 1.2,               // 视距（米）—— 紧贴箭头的短扇形
    fillColor: '#1677ff',            // 渐变色（内=该色最浓，外=完全透明）
    innerOpacity: 0.45,              // 最内圈透明度
    outerOpacity: 0.02,              // 最外圈透明度
    bands: 8,                        // 径向分段数，越多越平滑
    segments: 20                     // 每段弧线的采样点数
  }
  Object.assign(fovConfig, fov)

  const follow = ref(false)
  const pose = ref(null)             // { lng, lat, heading }
  const phase = ref('idle')          // 'idle' | 'forward' | 'scan' | 'turn' | 'circle'
  const controller = ref(null)

  // 内部状态
  let rafId = 0
  let path = null                    // getPathParams 返回的对象
  let patrolEndpoints = null         // { A: {lng,lat}, B: {lng,lat} }
  let legIdx = 0                     // 0 = A→B, 1 = B→A
  let phaseStartTs = 0

  // circle 模式独有
  let circleAngle = 0

  // waypoint 模式独有
  let wpSegments = null   // [{ from, to, dist, cum, heading }]
  let wpTotalDist = 0

  // FOV 图层
  const FOV_SOURCE_ID = `${robotId}-fov-source`
  const FOV_FILL_ID   = `${robotId}-fov-fill`

  // =============== 运动学 ===============
  function computePatrolEndpoints(p) {
    const lngSpan = p.maxLng - p.minLng
    const latSpan = p.maxLat - p.minLat
    const pad = 0.15
    if (lngSpan >= latSpan) {
      return {
        A: { lng: p.minLng + lngSpan * pad, lat: p.centerLat },
        B: { lng: p.maxLng - lngSpan * pad, lat: p.centerLat }
      }
    }
    return {
      A: { lng: p.centerLng, lat: p.minLat + latSpan * pad },
      B: { lng: p.centerLng, lat: p.maxLat - latSpan * pad }
    }
  }

  function computePatrolPose(now) {
    const dt = now - phaseStartTs
    const A = patrolEndpoints.A
    const B = patrolEndpoints.B
    const headingAB = compassHeading(A, B)
    const headingBA = compassHeading(B, A)
    const from = legIdx === 0 ? A : B
    const to   = legIdx === 0 ? B : A
    const baseHeading = legIdx === 0 ? headingAB : headingBA

    // forward：直行
    if (phase.value === 'forward') {
      const t = Math.min(dt / PATROL_FORWARD_MS, 1)
      const eased = smoothstep(t)
      const lng = lerp(from.lng, to.lng, eased)
      const lat = lerp(from.lat, to.lat, eased)
      if (t >= 1) { phase.value = 'scan'; phaseStartTs = now }
      return { lng, lat, heading: baseHeading }
    }

    // scan：原地左右扫视
    if (phase.value === 'scan') {
      const t = Math.min(dt / PATROL_SCAN_MS, 1)
      const osc = PATROL_SCAN_AMP * Math.sin(t * Math.PI * 2 * PATROL_SCAN_CYCLES)
      const heading = (baseHeading + osc + 360) % 360
      if (t >= 1) { phase.value = 'turn'; phaseStartTs = now }
      return { lng: to.lng, lat: to.lat, heading }
    }

    // turn：原地掉头
    if (phase.value === 'turn') {
      const t = Math.min(dt / PATROL_TURN_MS, 1)
      const nextHeading = legIdx === 0 ? headingBA : headingAB
      const heading = shortestAngleLerp(baseHeading, nextHeading, smoothstep(t))
      if (t >= 1) {
        legIdx = 1 - legIdx
        phase.value = 'forward'
        phaseStartTs = now
      }
      return { lng: to.lng, lat: to.lat, heading }
    }

    return { lng: from.lng, lat: from.lat, heading: baseHeading }
  }

  function computeCirclePose() {
    circleAngle += angularSpeed
    const lng = path.centerLng + path.lngAmp * Math.cos(circleAngle)
    const lat = path.centerLat + path.latAmp * Math.sin(circleAngle)
    const dLng = -path.lngAmp * Math.sin(circleAngle)
    const dLat =  path.latAmp * Math.cos(circleAngle)
    let heading = Math.atan2(dLng, dLat) * 180 / Math.PI
    if (heading < 0) heading += 360
    return { lng, lat, heading }
  }

  // =============== Waypoint 路径点跟随 ===============
  function initWpSegments(wps) {
    wpSegments = []
    let cum = 0
    for (let i = 0; i < wps.length - 1; i++) {
      const dist = haversineDist(wps[i], wps[i + 1])
      const heading = compassHeading(
        { lng: wps[i][0], lat: wps[i][1] },
        { lng: wps[i + 1][0], lat: wps[i + 1][1] }
      )
      wpSegments.push({ from: wps[i], to: wps[i + 1], dist, cum, heading })
      cum += dist
    }
    wpTotalDist = cum
  }

  function computeWpPose(now) {
    const elapsed = (now - phaseStartTs) / 1000
    const traveled = (elapsed * waypointSpeed) % wpTotalDist

    let seg = wpSegments[wpSegments.length - 1]
    let distInSeg = seg.dist
    for (const s of wpSegments) {
      if (traveled < s.cum + s.dist) {
        distInSeg = traveled - s.cum
        seg = s
        break
      }
    }

    const t = seg.dist > 0 ? Math.min(distInSeg / seg.dist, 1) : 0
    return {
      lng: lerp(seg.from[0], seg.to[0], t),
      lat: lerp(seg.from[1], seg.to[1], t),
      heading: seg.heading
    }
  }

  // =============== FOV 视野锥（径向渐变多环带）===============
  /**
   * 生成 N 个同心扇环作为多边形 feature，每个带一个 opacity 属性
   * 内圈（带 0）半径 0 → 最外圈（带 N-1）半径 r
   * opacity 从 innerOpacity 线性衰减到 outerOpacity，视觉上像径向渐变
   */
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
      // 该带中点处的透明度（让相邻带之间没有硬边）
      const t = (b + 0.5) / N
      const opacity = fovConfig.innerOpacity + (fovConfig.outerOpacity - fovConfig.innerOpacity) * t
      const coords = []

      // 外弧：从 heading-half 扫到 heading+half
      for (let i = 0; i <= segs; i++) {
        const a = heading - half + (fovConfig.angle * i / segs)
        const rad = a * Math.PI / 180
        coords.push([
          lng + rOuter * Math.sin(rad) * mToLng,
          lat + rOuter * Math.cos(rad) * mToLat
        ])
      }
      // 内弧：反向走回去（b=0 时 rInner=0，内弧退化成一个点 —— 即原顶点）
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

    // 把视野锥插在机器人图层下面，机器人图标永远在最上
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
  function computePose(now) {
    if (motion === 'waypoint') return computeWpPose(now)
    if (motion === 'circle') return computeCirclePose()
    return computePatrolPose(now)
  }

  function tick() {
    const m = mapRef.value
    if (!controller.value || !m) { rafId = 0; return }

    const now = performance.now()
    const { lng, lat, heading } = computePose(now)

    controller.value.updateRobot(robotId, {
      lngLat: [lng, lat],
      rotation: (heading + iconHeadingOffset + 360) % 360
    })
    pose.value = { lng, lat, heading }
    updateFovLayers(pose.value)

    if (follow.value) {
      if (followMode === 'navigation') {
        m.jumpTo({ center: [lng, lat], bearing: heading })
      } else {
        m.setCenter([lng, lat])
      }
    }

    rafId = requestAnimationFrame(tick)
  }

  // =============== 生命周期 ===============
  function start() {
    const m = mapRef.value
    if (!m) return

    if (motion === 'waypoint') {
      if (!waypoints?.length) return
      initWpSegments(waypoints)
      phase.value = 'waypoint'
      phaseStartTs = performance.now()
    } else {
      const p = getPathParams?.()
      if (!p) return
      path = p
      if (motion === 'patrol') {
        patrolEndpoints = computePatrolEndpoints(p)
        legIdx = 0
        phase.value = 'forward'
        phaseStartTs = performance.now()
      } else {
        circleAngle = 0
        phase.value = 'circle'
      }
    }

    const initialPose = computePose(performance.now())
    const initial = {
      lngLat: [initialPose.lng, initialPose.lat],
      rotation: (initialPose.heading + iconHeadingOffset + 360) % 360,
      name: robotName,
      id: robotId
    }

    if (controller.value) {
      controller.value.updateRobots([initial])
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
    removeFovLayers()
    if (controller.value) {
      controller.value.remove()
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
    }
    m.easeTo(target)
  }

  function disableFollow() {
    const m = mapRef.value
    follow.value = false
    if (m && followMode === 'navigation') {
      m.easeTo({ bearing: 0, pitch: 0, duration: focusDuration })
    }
  }

  function toggleFollow() {
    if (!mapRef.value || !controller.value || !pose.value) {
      console.warn('[useRobotFollow] 机器人尚未就绪，请先调用 start()')
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

/** 帮助函数：由 SLAM 四角 [[lng,lat]×4] 推出运动参数 */
export function pathFromCoords(coords, radiusRatio = 0.25) {
  if (!coords?.length) return null
  const lngs = coords.map(p => p[0])
  const lats = coords.map(p => p[1])
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  return {
    minLng, maxLng, minLat, maxLat,
    centerLng: (minLng + maxLng) / 2,
    centerLat: (minLat + maxLat) / 2,
    lngAmp: (maxLng - minLng) / 2 * radiusRatio,
    latAmp: (maxLat - minLat) / 2 * radiusRatio
  }
}
