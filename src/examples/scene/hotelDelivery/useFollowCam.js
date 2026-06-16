/*
 * @Description: 酒店配送机器人 — 相机跟随 Composable
 *   从 useDeliverySimulation 中拆分，专注处理 2D/3D 视角跟随逻辑
 * @FilePath: /bic-map/src/examples/scene/hotelDelivery/useFollowCam.js
 * Copyright (c) 2024 houser.hao@humanoid.com, All Rights Reserved.
 */

/**
 * useFollowCam
 *
 * 封装相机跟随逻辑，3D 模式下提供近第一人称视角，2D 模式下顶视居中跟随。
 *
 * @param {object} options
 * @param {() => object}          options.getMap      - 返回 maplibre map 实例
 * @param {import('vue').Ref<boolean>} options.is3D   - 视图 3D 状态（共享）
 * @param {import('vue').Ref<boolean>} options.followCam - 是否开启跟随
 *
 * @returns {{
 *   updateCamera: (lngLat: [number, number], heading: number) => void,
 * }}
 */
export function useFollowCam(options) {
  const { getMap, is3D, followCam } = options

  /**
   * 更新相机位置至机器人所在位置
   * 3D：近第一人称视角，前进方向偏移 0.4m
   * 2D：顶视居中跟随
   *
   * @param {[number, number]} lngLat - [longitude, latitude]
   * @param {number}           heading - 北顺时针朝向角（°）
   */
  function updateCamera(lngLat, heading) {
    if (!followCam.value) return
    const map = getMap()
    if (is3D.value) {
      const lat  = lngLat[1]
      const rad  = heading * Math.PI / 180
      const fwdM = 0.4
      const dLng = fwdM * Math.sin(rad) / (111320 * Math.cos(lat * Math.PI / 180))
      const dLat = fwdM * Math.cos(rad) / 110540
      map.jumpTo({
        center:  [lngLat[0] + dLng, lngLat[1] + dLat],
        bearing: heading,
        pitch:   80,
        zoom:    30.0
      })
    } else {
      map.jumpTo({ center: lngLat, bearing: 0, pitch: 0, zoom: 24 })
    }
  }

  return { updateCamera }
}
