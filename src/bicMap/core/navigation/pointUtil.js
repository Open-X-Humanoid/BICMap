/**
 * 射线法判断点是否在多边形内（ray casting algorithm）。
 * @param {number} px - 点的 x 坐标（分数坐标）
 * @param {number} py - 点的 y 坐标（分数坐标）
 * @param {[number,number][]} polygon - 多边形顶点数组 [x, y]（闭合，最后一个与第一个相同为可选）
 * @returns {boolean}
 */
export function pointInPolygon(px, py, polygon) {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}
