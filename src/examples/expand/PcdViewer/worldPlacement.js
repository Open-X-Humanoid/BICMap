/*
 * @Description: 把点云按真实经纬度锚点摆到世界地图上。
 *   与 slamPlacement 的区别只有一个：这里 scale / zoomFactor 都是 1，
 *   点云里的 1 米就是地面上的 1 米，因此高度也不需要再乘补偿系数。
 * @FilePath: src/examples/expand/PcdViewer/worldPlacement.js
 */
import mapUtils from '../../../bicMap/core/utils/mapUtils'

/**
 * 对点云施加「缩放 → 绕 Z 旋转 → 平移」，再以 anchor 为原点逐点转成 [lng, lat, altitude]
 * @param {object} cloud parsePcd 的返回值
 * @param {object} align 对齐参数 { x, y, z, rotation, scale }
 * @param {Float32Array|null} colors 逐点颜色，与点位一一对应
 * @param {{ lng: number, lat: number }} anchor 点云局部原点对应的真实经纬度
 * @returns {{ points: Array<[number,number,number]>, colors: (Float32Array|null), stride: number }}
 */
export function placeOnWorldMap(cloud, align, colors, anchor) {
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

    const gps = mapUtils.cartesianToGPS({
      x: localX * cos - localY * sin + align.x,
      y: localX * sin + localY * cos + align.y,
      originLatitude: anchor.lat,
      originLongitude: anchor.lng,
      scale: 1,
      zoomFactor: 1
    })

    points[i] = [gps.longitude, gps.latitude, positions[source + 2] * scale + zBase]

    if (outColors) {
      outColors[source] = colors[source]
      outColors[source + 1] = colors[source + 1]
      outColors[source + 2] = colors[source + 2]
    }
  }

  return { points, colors: outColors, stride: 1 }
}

/**
 * 点云在真实地理空间下的四至，供地图取景使用
 * @param {object} cloud parsePcd 的返回值
 * @param {object} align 对齐参数 { x, y, rotation, scale }
 * @param {{ lng: number, lat: number }} anchor 点云局部原点对应的真实经纬度
 * @returns {number[][]} [[西南 lng, lat], [东北 lng, lat]]
 */
export function worldSceneBounds(cloud, align, anchor) {
  const { min, max } = cloud.bounds
  const radians = (align.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const { scale } = align

  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity

  // 旋转后的包围盒不再轴对齐，四个角都要投一遍再取外包
  for (const [cornerX, cornerY] of [
    [min[0], min[1]],
    [min[0], max[1]],
    [max[0], min[1]],
    [max[0], max[1]]
  ]) {
    const localX = cornerX * scale
    const localY = cornerY * scale
    const gps = mapUtils.cartesianToGPS({
      x: localX * cos - localY * sin + align.x,
      y: localX * sin + localY * cos + align.y,
      originLatitude: anchor.lat,
      originLongitude: anchor.lng,
      scale: 1,
      zoomFactor: 1
    })

    if (gps.longitude < west) west = gps.longitude
    if (gps.longitude > east) east = gps.longitude
    if (gps.latitude < south) south = gps.latitude
    if (gps.latitude > north) north = gps.latitude
  }

  return [
    [west, south],
    [east, north]
  ]
}
