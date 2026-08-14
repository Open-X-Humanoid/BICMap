/*
 * @Description: 把 PCD 点云按对齐参数摆进 SLAM 坐标系，并换算成 maplibre 点云图层要的经纬度点位
 * @FilePath: src/examples/expand/PcdViewer/slamPlacement.js
 */
import mapUtils from '../../../bicMap/core/utils/mapUtils'

import { SLAM_GEO_SCALE, SLAM_HEIGHT, SLAM_MAP, SLAM_WIDTH } from './constants'

/**
 * 对点云施加「缩放 → 绕 Z 旋转 → 平移」，再逐点转成 [lng, lat, altitude]
 * @param {object} cloud parsePcd 的返回值
 * @param {object} align 对齐参数 { x, y, z, rotation, scale }
 * @param {Float32Array|null} colors 逐点颜色，与点位一一对应
 * @returns {{ points: Array<[number,number,number]>, colors: (Float32Array|null), stride: number }}
 */
export function placeOnSlamMap(cloud, align, colors) {
  const { positions, count, bounds } = cloud

  const points = new Array(count)
  const outColors = colors ? new Float32Array(count * 3) : null

  const radians = (align.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const { scale } = align
  // 点云先贴到地面（最低点落到 z=0），再叠加用户设定的离地高度
  const zBase = align.z - bounds.min[2] * scale

  for (let i = 0; i < count; i++) {
    const source = i * 3
    const localX = positions[source] * scale
    const localY = positions[source + 1] * scale

    const x = localX * cos - localY * sin + align.x
    const y = localX * sin + localY * cos + align.y
    const z = positions[source + 2] * scale + zBase

    const gps = mapUtils.cartesianToGPS({
      x,
      y,
      scale: SLAM_MAP.resolution,
      zoomFactor: SLAM_MAP.zoomFactor
    })

    // 水平方向被 resolution × zoomFactor 压缩过，高度要用同一系数才不会被拉伸
    points[i] = [gps.longitude, gps.latitude, z * SLAM_GEO_SCALE]

    if (outColors) {
      outColors[source] = colors[source]
      outColors[source + 1] = colors[source + 1]
      outColors[source + 2] = colors[source + 2]
    }
  }

  return { points, colors: outColors, stride: 1 }
}

/**
 * SLAM 底图四至的经纬度范围，供地图取景使用
 * @returns {number[][]} [[西南 lng, lat], [东北 lng, lat]]
 */
export function slamMapBounds() {
  return [
    slamToLngLat([SLAM_MAP.startX, SLAM_MAP.startY]),
    slamToLngLat([SLAM_MAP.startX + SLAM_WIDTH, SLAM_MAP.startY + SLAM_HEIGHT])
  ]
}

/**
 * SLAM 笛卡尔坐标 → [lng, lat]
 * @param {number[]} point [x, y]，单位米
 * @returns {number[]}
 */
export function slamToLngLat([x, y]) {
  const gps = mapUtils.cartesianToGPS({
    x,
    y,
    scale: SLAM_MAP.resolution,
    zoomFactor: SLAM_MAP.zoomFactor
  })
  return [gps.longitude, gps.latitude]
}
