
/*
 * @Description: GeoJSON 图形 footprint 生成工具
 *   提供常见建筑物 footprint 形状的坐标辅助函数
 *   坐标系：WGS84，适用于室外 GPS 坐标空间
 */

/**
 * 生成矩形 footprint 坐标环（用于建筑/绿地/停车场）
 * @param {number} cx 中心经度
 * @param {number} cy 中心纬度
 * @param {number} w  东西方向半宽（度）
 * @param {number} h  南北方向半高（度）
 * @returns {Array} GeoJSON Polygon coordinates
 */
export function rect(cx, cy, w, h) {
  return [
    [
      [cx - w, cy - h],
      [cx + w, cy - h],
      [cx + w, cy + h],
      [cx - w, cy + h],
      [cx - w, cy - h],
    ]
  ]
}
