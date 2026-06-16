/**
 * 服务机器人导览讲解 composable
 * - 固定 POI 点位 + 批量 Marker
 * - 机器人沿点位循环巡航，到达后触发讲解浮层
 */
import { ref, computed, onBeforeUnmount } from 'vue'

import bicMap from '../../../bicMap/core/bicmap-gl'

import {
  SLAM_MAP_CONFIG,
  MAP_WIDTH_M,
  MAP_HEIGHT_M,
  TOUR_ROUTE,
  ROBOT_TOUR_CONFIG
} from './constants'

const { startX, startY, resolution } = SLAM_MAP_CONFIG
const {
  robotId,
  robotName,
  moveSpeedMps,
  minLegDurationMs,
  dwellMs,
  iconHeadingOffset,
  robotMarkerSize,
  poiMarkerSize
} = ROBOT_TOUR_CONFIG

/**
 * 将地图比例坐标 (0~1) 转为 SLAM 笛卡尔坐标（米）
 * @param {number} xFrac 横向比例，0 为地图西缘，1 为东缘
 * @param {number} yFrac 纵向比例，0 为地图南缘，1 为北缘
 * @returns {{ x: number, y: number }}
 */
function fracToCart(xFrac, yFrac) {
  return {
    x: startX + xFrac * MAP_WIDTH_M,
    y: startY + yFrac * MAP_HEIGHT_M
  }
}

/**
 * 获取坐标转换函数（bicMap.init 加载脚本后才可用）
 * 兼容 window.MapUtils / window.cartesianToGPS / bicMap.mapUtils 三种挂载方式
 * @returns {Function | undefined}
 */
function getCartesianToGPS() {
  return (
    window.MapUtils?.cartesianToGPS
    ?? window.cartesianToGPS
    ?? bicMap.mapUtils?.cartesianToGPS
  )
}

/**
 * 获取 GPS → 笛卡尔转换函数（MapUtils 对象方法）
 * @returns {Function | undefined}
 */
function getGPSToCartesianFn() {
  return (
    window.MapUtils?.GPSToCartesian
    ?? window.GPSToCartesian
    ?? bicMap.mapUtils?.GPSToCartesian
  )
}

/**
 * 供机器人 Marker 标签使用的 (lng, lat) → { x, y } 适配器
 * robo.js 期望两参数形式，MapUtils 为对象参数形式
 * @returns {(lng: number, lat: number) => { x: number, y: number }}
 */
function createGPSToCartesianAdapter() {
  const convert = getGPSToCartesianFn()
  if (!convert) {
    return (lng, lat) => ({
      x: Number(lng).toFixed(4),
      y: Number(lat).toFixed(4)
    })
  }
  return (lng, lat) => {
    const point = convert({
      longitude: lng,
      latitude: lat,
      scale: resolution,
      zoomFactor: 2
    })
    return {
      x: Number(point.x).toFixed(2),
      y: Number(point.y).toFixed(2)
    }
  }
}

/**
 * MapUtils 是否已随 bicMap.init() 加载完成
 * @returns {boolean}
 */
function isMapUtilsReady() {
  return typeof getCartesianToGPS() === 'function'
}

/**
 * 将 SLAM 笛卡尔坐标转为地图经纬度 [lng, lat]
 * @param {number} x 笛卡尔 X（米）
 * @param {number} y 笛卡尔 Y（米）
 * @returns {[number, number]} [longitude, latitude]
 */
function cartToGPS(x, y) {
  const convert = getCartesianToGPS()
  if (!convert) {
    throw new Error('[robotGuideTour] MapUtils 未就绪，请先完成 bicMap.init()')
  }
  const g = convert({
    x,
    y,
    scale: resolution,
    zoomFactor: 2
  })
  return [g.longitude, g.latitude]
}

/** 匀速直线插值 */
const lerp = (a, b, t) => a + (b - a) * t

/**
 * [lng, lat] → { lng, lat }
 * @param {[number, number]} lngLat
 */
function toLngLatPoint(lngLat) {
  return { lng: lngLat[0], lat: lngLat[1] }
}

/**
 * 罗盘朝向（0°=正北，顺时针），与 robotFollow.compassHeading 一致
 * @param {{ lng: number, lat: number }} from
 * @param {{ lng: number, lat: number }} to
 */
function compassHeading(from, to) {
  const dLng = to.lng - from.lng
  const dLat = to.lat - from.lat
  let h = (Math.atan2(dLng, dLat) * 180) / Math.PI
  if (h < 0) h += 360
  return h
}

/**
 * 两经纬度点间的近似地面距离（米）
 */
function lngLatDistMeters(a, b) {
  const cosLat = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180)
  const dx = (b.lng - a.lng) * 111320 * cosLat
  const dy = (b.lat - a.lat) * 110540
  return Math.hypot(dx, dy)
}

/**
 * 根据 TOUR_ROUTE 构建完整航点列表（含笛卡尔坐标与经纬度）
 * @returns {Array<Record<string, unknown> & { cart: { x: number, y: number }, lngLat: [number, number] }>}
 */
function buildTourWaypoints() {
  return TOUR_ROUTE.map((poi) => {
    const cart = fracToCart(poi.xFrac, poi.yFrac)
    return {
      ...poi,
      cart,
      lngLat: cartToGPS(cart.x, cart.y)
    }
  })
}

/** 仅含讲解停靠点，用于进度文案 */
function getNarrateWaypoints(wps) {
  return wps.filter((w) => w.narrate !== false && w.title)
}

/**
 * 服务机器人导览讲解 composable
 * @param {import('vue').Ref<import('maplibre-gl').Map | null>} mapRef 地图实例引用
 * @returns 导览状态与控制方法
 */
export function useRobotGuideTour(mapRef) {
  const running = ref(false)
  const currentNarration = ref(null)
  const waypointIndex = ref(0)
  const phase = ref('idle')

  const poiController = ref(null)
  let robotController = null
  let rafId = 0

  /** 航点缓存，须在 bicMap.init() 之后惰性构建（避免 MapUtils 未加载） */
  let waypoints = null
  let cartPos = null
  let targetIndex = 0
  let dwellUntil = 0
  /** 机器人当前经纬度（运动主状态，与 robotFollow 一致在 lng/lat 空间插值） */
  let robotLngLat = null
  /** 当前直行路段：起点/终点/锁定朝向/时长（参考 robotFollow forward 阶段） */
  let legFrom = null
  let legTo = null
  let legHeading = 0
  let legStartTs = 0
  let legDurationMs = 0

  /**
   * 惰性构建并返回导览航点列表
   * @returns {ReturnType<typeof buildTourWaypoints>}
   */
  function ensureWaypoints() {
    if (!isMapUtilsReady()) {
      console.warn('[robotGuideTour] MapUtils 未就绪，请等待地图初始化完成')
      return []
    }
    if (!waypoints) {
      waypoints = buildTourWaypoints()
    }
    return waypoints
  }

  /** 当前讲解进度文案，如 "2/5" */
  const progressLabel = computed(() => {
    const wps = ensureWaypoints()
    const narrateWps = getNarrateWaypoints(wps)
    if (!running.value || !currentNarration.value || !narrateWps.length) return ''
    const idx = narrateWps.findIndex((w) => w.id === currentNarration.value.id)
    if (idx < 0) return ''
    return `${idx + 1}/${narrateWps.length}`
  })

  /**
   * 将航点列表转为 addBatchPOIMarkers 所需的点位格式
   * @returns {Array<{ id: string, name: string, lngLat: [number, number], rotation: number }>}
   */
  function buildPoiMarkerPoints() {
    return getNarrateWaypoints(ensureWaypoints()).map((w) => ({
      id: w.id,
      name: w.name,
      lngLat: w.lngLat,
      rotation: 0
    }))
  }

  /**
   * 在地图上加载/刷新所有导览 POI 批量标注
   * 若已有控制器则先移除再重建
   */
  function loadPoiMarkers() {
    const m = mapRef.value
    if (!m) return
    const points = buildPoiMarkerPoints()
    if (!points.length) return

    if (poiController.value) {
      poiController.value.remove()
      poiController.value = null
    }

    poiController.value = bicMap.addBatchPOIMarkers(m, points, {
      size: poiMarkerSize,
      showLabels: true,
      selectable: false
    })
  }

  /**
   * 进入新路段：在经纬度空间锁定直线朝向与插值时长（同 robotFollow 直行段）
   * @param {{ lngLat: [number, number] }} targetWp 目标航点
   */
  function beginLegTo(targetWp) {
    if (!robotLngLat || !targetWp?.lngLat) return
    legFrom = toLngLatPoint(robotLngLat)
    legTo = toLngLatPoint(targetWp.lngLat)
    legHeading = compassHeading(legFrom, legTo)
    const distM = lngLatDistMeters(legFrom, legTo)
    // 按速度计算全程时长，保证走完整段再到达（不用距离阈值提前瞬移）
    legDurationMs =
      distM < 0.05 ? minLegDurationMs : Math.max(minLegDurationMs, (distM / moveSpeedMps) * 1000)
    legStartTs = performance.now()
  }

  const robotMarkerOptions = {
    size: robotMarkerSize,
    showLabels: true,
    GPSToCartesian: createGPSToCartesianAdapter()
  }

  function ensureRobot() {
    const m = mapRef.value
    if (!m || !robotLngLat) return

    const wps = ensureWaypoints()
    if (wps.length > 1) {
      const next = wps[(targetIndex + 1) % wps.length]
      legHeading = compassHeading(toLngLatPoint(robotLngLat), toLngLatPoint(next.lngLat))
    }
    const initial = {
      id: robotId,
      name: robotName,
      lngLat: robotLngLat,
      rotation: (legHeading + iconHeadingOffset + 360) % 360
    }

    if (robotController) {
      robotController.updateRobots([initial])
    } else {
      robotController = bicMap.addRobotMarkers(m, [initial], robotMarkerOptions)
    }
  }

  /**
   * 根据当前笛卡尔位置与朝向更新机器人 Marker
   * @param {number} heading 罗盘朝向角（度）
   */
  function updateRobotMarker(heading) {
    if (!robotController || !robotLngLat) return
    robotController.updateRobot(robotId, {
      lngLat: robotLngLat,
      rotation: (heading + iconHeadingOffset + 360) % 360
    })
  }

  /**
   * 到达指定航点后，展示对应讲解文案并进入 narrating 阶段
   * @param {number} idx 航点在 waypoints 中的下标
   */
  function showNarrationForIndex(idx) {
    const wps = ensureWaypoints()
    const wp = wps[idx]
    if (!wp || wp.narrate === false || !wp.title) return
    waypointIndex.value = idx
    currentNarration.value = {
      id: wp.id,
      title: wp.title,
      tag: wp.tag,
      summary: wp.summary,
      narration: wp.narration
    }
    phase.value = 'narrating'
    dwellUntil = performance.now() + dwellMs
  }

  /**
   * 到达航点：讲解点停靠，途经点立即前往下一航点
   * @param {number} idx 当前航点下标
   */
  function onArriveAtWaypoint(idx) {
    const wps = ensureWaypoints()
    const wp = wps[idx]
    if (!wp) return
    robotLngLat = [...wp.lngLat]
    cartPos = { ...wp.cart }
    legFrom = null
    legTo = null

    const nextWp = wps[(idx + 1) % wps.length]
    if (nextWp) {
      legHeading = compassHeading(toLngLatPoint(robotLngLat), toLngLatPoint(nextWp.lngLat))
      updateRobotMarker(legHeading)
    }

    if (wp.narrate !== false && wp.title) {
      showNarrationForIndex(idx)
    } else {
      advanceTarget()
    }
  }

  /**
   * 讲解停留结束后，切换至下一目标航点并进入 moving 阶段
   * 目标下标循环递增（末点之后回到首点）
   */
  function advanceTarget() {
    const wps = ensureWaypoints()
    if (!wps.length) return
    targetIndex = (targetIndex + 1) % wps.length
    phase.value = 'moving'
    currentNarration.value = null
    beginLegTo(wps[targetIndex])
  }

  /**
   * requestAnimationFrame 主循环：处理讲解停留、到达判定与位移插值
   * @param {number} now performance.now() 时间戳
   */
  function tick(now) {
    if (!running.value || !mapRef.value) {
      rafId = 0
      return
    }

    const wps = ensureWaypoints()
    if (!wps.length || !cartPos) {
      rafId = 0
      return
    }

    const target = wps[targetIndex]

    if (phase.value === 'narrating') {
      if (now >= dwellUntil) {
        advanceTarget()
      }
      rafId = requestAnimationFrame(tick)
      return
    }

    if (!legFrom || !legTo) {
      beginLegTo(target)
    }

    const elapsed = Math.max(0, now - legStartTs)
    const t = Math.min(elapsed / legDurationMs, 1)
    // 线性插值 = 匀速直线滑动（不用 smoothstep，避免首尾加减速）
    const lng = lerp(legFrom.lng, legTo.lng, t)
    const lat = lerp(legFrom.lat, legTo.lat, t)
    robotLngLat = [lng, lat]

    updateRobotMarker(legHeading)

    if (t >= 1) {
      onArriveAtWaypoint(targetIndex)
      rafId = requestAnimationFrame(tick)
      return
    }

    rafId = requestAnimationFrame(tick)
  }

  /**
   * 启动导览：加载 POI、放置机器人、展示首点讲解并开始动画循环
   */
  function startTour() {
    const m = mapRef.value
    if (!m || running.value) return

    const wps = ensureWaypoints()
    if (!wps.length) return

    loadPoiMarkers()
    targetIndex = 0
    cartPos = { ...wps[0].cart }
    robotLngLat = [...wps[0].lngLat]
    legFrom = null
    legTo = null
    ensureRobot()
    showNarrationForIndex(0)
    running.value = true
    if (!rafId) rafId = requestAnimationFrame(tick)
  }

  /**
   * 停止导览：取消动画帧、清除讲解状态，并移除机器人与 POI 图层
   */
  function stopTour() {
    running.value = false
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
    currentNarration.value = null
    phase.value = 'idle'
    waypointIndex.value = 0

    if (robotController) {
      robotController.remove()
      robotController = null
    }
    if (poiController.value) {
      poiController.value.remove()
      poiController.value = null
    }
    cartPos = null
    robotLngLat = null
    legFrom = null
    legTo = null
    legHeading = 0
    legStartTs = 0
    legDurationMs = 0
  }

  /**
   * 切换导览开/关：运行中则停止，否则启动
   */
  function toggleTour() {
    running.value ? stopTour() : startTour()
  }

  /** 组件卸载时自动清理地图资源与动画 */
  onBeforeUnmount(() => {
    stopTour()
  })

  return {
    running,
    currentNarration,
    waypointIndex,
    phase,
    progressLabel,
    ensureWaypoints,
    startTour,
    stopTour,
    toggleTour,
    loadPoiMarkers
  }
}
