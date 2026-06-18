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

/**
 * 检测两条线段是否相交（跨立实验）
 * @param {number} ax - 线段 A 起点 x
 * @param {number} ay - 线段 A 起点 y
 * @param {number} bx - 线段 A 终点 x
 * @param {number} by - 线段 A 终点 y
 * @param {number} cx - 线段 B 起点 x
 * @param {number} cy - 线段 B 起点 y
 * @param {number} dx - 线段 B 终点 x
 * @param {number} dy - 线段 B 终点 y
 * @returns {boolean}
 */
export function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1x = bx - ax
  const d1y = by - ay
  const d2x = dx - cx
  const d2y = dy - cy
  const cross = d1x * d2y - d1y * d2x
  if (Math.abs(cross) < 1e-10) return false  // 平行或共线
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / cross
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / cross
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}

/**
 * 检测线段是否与多边形相交（含线段完全在内部的情况）
 * @param {number} x1 - 线段起点 x
 * @param {number} y1 - 线段起点 y
 * @param {number} x2 - 线段终点 x
 * @param {number} y2 - 线段终点 y
 * @param {[number,number][]} polygon - 多边形顶点数组
 * @returns {boolean}
 */
export function lineSegmentIntersectsPolygon(x1, y1, x2, y2, polygon) {
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [cx, cy] = polygon[i]
    const [dx, dy] = polygon[j]
    if (segmentsIntersect(x1, y1, x2, y2, cx, cy, dx, dy)) {
      return true
    }
  }
  // 检查线段中点是否在多边形内部（处理完全包含的情况）
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2
  return pointInPolygon(midX, midY, polygon)
}
