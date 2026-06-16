/**
 * 点位 Marker 示例 composable
 * - 封装 bicMap.addBatchPOIMarkers 的加载/清除/选中生命周期
 * - 在组件卸载时自动清理控制器
 *
 * 用法：
 *   const { active, selected, toggle, load, clear } = usePOIMarkers(map, {
 *     getBounds: () => slamCoordinates.value
 *       ? boundsFromCoords(slamCoordinates.value)
 *       : null,
 *     names: ['大厅', '电梯间A', ...],
 *     markerOptions: { size: 32 }
 *   })
 */
import { ref, onBeforeUnmount } from 'vue'
import bicMap from '../../../bicMap/core/bicmap-gl'

const DEFAULT_NAMES = [
  '1层大厅入口', '电梯间A', '充电站', '会议室C', '休息区',
  '机器人停放点', '办公区A', '办公区B', '安全出口', '机房',
  '展示厅', '培训室'
]

export function usePOIMarkers(mapRef, options = {}) {
  const {
    getBounds = null,                 // () => {minLng,maxLng,minLat,maxLat} | null
    names = DEFAULT_NAMES,
    idPrefix = 'poi',
    pointsProvider = null,            // () => Array<{id,lngLat,rotation,name}>
    edgePadding = 0.1,                // bbox 向内收缩比例（防贴边）
    markerOptions = {}                // 透传给 addBatchPOIMarkers
  } = options

  const active = ref(false)
  const selected = ref(null)
  const controller = ref(null)

  function generateDefaultPoints() {
    const m = mapRef.value
    if (!m) return []

    let b = getBounds?.()
    if (!b) {
      const mb = m.getBounds()
      b = {
        minLng: mb.getWest(),  maxLng: mb.getEast(),
        minLat: mb.getSouth(), maxLat: mb.getNorth()
      }
    }
    const padLng = (b.maxLng - b.minLng) * edgePadding
    const padLat = (b.maxLat - b.minLat) * edgePadding
    const loLng = b.minLng + padLng, hiLng = b.maxLng - padLng
    const loLat = b.minLat + padLat, hiLat = b.maxLat - padLat

    return names.map((name, i) => ({
      id: `${idPrefix}-${i}`,
      lngLat: [
        loLng + Math.random() * (hiLng - loLng),
        loLat + Math.random() * (hiLat - loLat)
      ],
      rotation: Math.random() * 360,
      name
    }))
  }

  function load() {
    const m = mapRef.value
    if (!m) return

    if (controller.value) {
      controller.value.remove()
      controller.value = null
    }

    const points = pointsProvider ? pointsProvider() : generateDefaultPoints()
    if (!points?.length) return

    controller.value = bicMap.addBatchPOIMarkers(m, points, {
      size: 32,
      showLabels: true,
      selectable: true,
      ...markerOptions,
      onClick: (data) => {
        selected.value = data
        markerOptions.onClick?.(data)
      },
      onSelectionChange: (data) => {
        if (!data.selected) selected.value = null
        markerOptions.onSelectionChange?.(data)
      }
    })
    active.value = true
  }

  function clear() {
    if (controller.value) {
      controller.value.remove()
      controller.value = null
    }
    active.value = false
    selected.value = null
  }

  function toggle() {
    if (!mapRef.value) return
    active.value ? clear() : load()
  }

  onBeforeUnmount(() => { clear() })

  return { active, selected, controller, load, clear, toggle }
}

/** 帮助函数：从 SLAM 四角坐标 [[lng,lat]×4] 取 bbox */
export function boundsFromCoords(coords) {
  if (!coords?.length) return null
  const lngs = coords.map(p => p[0])
  const lats = coords.map(p => p[1])
  return {
    minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
    minLat: Math.min(...lats), maxLat: Math.max(...lats)
  }
}
