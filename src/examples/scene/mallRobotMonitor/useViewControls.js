import { ref } from 'vue'
import { FLOOR_CONFIGS } from './constants.js'

export const FLOOR_SOURCE_ID = 'bic-mall-floors-source'
export const FLOOR_LAYER_ID  = 'bic-mall-floors-layer'

export function useViewControls(getMap, { followCam, isRunning, cameraBound, slamBounds }) {
  const is3D = ref(false)

  function setSlamVisible(visible) {
    const map = getMap()
    if (!map) return
    FLOOR_CONFIGS.forEach(f => {
      const lid = `floor-slam-layer-${f.id}`
      if (map.getLayer(lid)) {
        map.setPaintProperty(lid, 'raster-opacity', visible ? 1 : 0)
      }
    })
  }

  function zoomToFit() {
    const map = getMap()
    if (!map || followCam.value) return

    // 获取地图容器尺寸
    const container = map.getContainer()
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    // 根据容器尺寸计算合适的 padding，确保地图在当前区域完全展示
    const padding = {
      top: Math.max(40, containerHeight * 0.08),
      bottom: Math.max(40, containerHeight * 0.08),
      left: Math.max(40, containerWidth * 0.08),
      right: Math.max(40, containerWidth * 0.08)
    }

    // 使用 slamBounds 计算最佳视野
    const bounds = slamBounds?.()
    if (bounds && bounds.sw && bounds.ne) {
      const cameraOptions = map.cameraForBounds([bounds.sw, bounds.ne], { padding, pitch: 0, bearing: 0 })
      if (cameraOptions) {
        map.easeTo({
          center: cameraOptions.center,
          zoom: cameraOptions.zoom,
          pitch: 0,
          bearing: 0,
          duration: 800
        })
        return
      }
    }

    // 降级方案：使用 cameraBound 或默认值
    const base = cameraBound?.()
    const fallback = base ?? { center: [116.4074, 39.9042], zoom: 18 }
    map.easeTo({
      ...fallback,
      pitch: 0,
      bearing: 0,
      duration: 800
    })
  }

  function toggle3D() {
    const map = getMap()
    if (!map) return
    is3D.value = !is3D.value
    if (is3D.value) {
      map.easeTo({ pitch: 55, bearing: 30, duration: 800 })
    } else {
      if (!followCam.value || !isRunning.value) {
        map.easeTo({ pitch: 0, bearing: 0, duration: 800 })
      }
    }
  }

  return { is3D, setSlamVisible, zoomToFit, toggle3D }
}
