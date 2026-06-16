/** 占据栅格 WeakMap 缓存：canvas 实例 → {occ, imgW, imgH} */
const _occCache = new WeakMap()

/**
 * 从 SLAM canvas 中提取占据栅格。
 * 像素分类：
 *   alpha < 50 或亮度 < 18 → 建筑外 / 纯黑背景 → 0（可通行）
 *   亮度 < 100 且偏蓝       → 实体墙           → 2
 *   亮度 < 190 且偏蓝       → 家具 / 轮廓       → 1
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{occ:Uint8Array, imgW:number, imgH:number}|null}
 */
function getOccupancy(canvas) {
  if (!canvas) return null
  if (_occCache.has(canvas)) return _occCache.get(canvas)

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const imgW = canvas.width
  const imgH = canvas.height
  if (!imgW || !imgH) return null

  let imgData
  try {
    imgData = ctx.getImageData(0, 0, imgW, imgH)
  } catch (e) {
    console.warn('[mockOfficeData] canvas getImageData failed:', e)
    return null
  }

  const { data } = imgData
  const occ   = new Uint8Array(imgW * imgH)
  const alpha = new Uint8Array(imgW * imgH)   // 保留 alpha，用于命中点二次过滤

  for (let y = 0; y < imgH; y++) {
    const rowOff = y * imgW
    for (let x = 0; x < imgW; x++) {
      const p = (rowOff + x) * 4
      const a = data[p + 3]
      alpha[rowOff + x] = a
      if (a < 50) continue
      const r = data[p]
      const g = data[p + 1]
      const b = data[p + 2]
      const bright = (r + g + b) / 3
      if (bright < 18) continue // 建筑外
      // 蓝通道稍强、整体偏暗 → 障碍物
      // 实墙（深蓝）要求：亮度 < 70 且蓝通道比红通道高 30 以上（饱和深蓝）
      // 家具描边（浅蓝）：亮度 < 190 且蓝通道略高于红通道
      if (bright < 190 && b >= r - 8) {
        occ[rowOff + x] = (bright < 70 && b - r > 30) ? 2 : 1
      }
    }
  }

  const result = { occ, alpha, imgW, imgH }
  _occCache.set(canvas, result)
  return result
}

/**
 * DDA 射线步进：从 (ox, oy) 沿 (dx, dy) 方向扫描，
 * 返回命中障碍的距离（像素），无命中返回 -1。
 * @param {Uint8Array} occ
 * @param {number} imgW
 * @param {number} imgH
 * @param {number} ox  起点 x（像素，浮点）
 * @param {number} oy  起点 y
 * @param {number} dx  方向 x（单位向量）
 * @param {number} dy  方向 y
 * @param {number} maxDist 最大距离（像素）
 * @returns {number}
 */
function castRay(occ, imgW, imgH, ox, oy, dx, dy, maxDist) {
  const STEP = 0.65 // 步长（像素）
  for (let t = STEP; t <= maxDist; t += STEP) {
    const xi = Math.round(ox + dx * t)
    const yi = Math.round(oy + dy * t)
    if (xi < 0 || xi >= imgW || yi < 0 || yi >= imgH) return -1
    if (occ[yi * imgW + xi] > 0) return t
  }
  return -1
}

// ===== 路径工具（内部使用，不导出）=====

function dedupePath(pts) {
  const out = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last && Math.abs(last[0] - p[0]) < 1e-9 && Math.abs(last[1] - p[1]) < 1e-9) continue
    out.push([p[0], p[1]])
  }
  return out
}

function pathMetrics(path) {
  const segLen = []
  let total = 0
  for (let i = 0; i < path.length - 1; i++) {
    const d = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1])
    segLen.push(d)
    total += d
  }
  return { segLen, total }
}

function pointAtDist(path, segLen, dist) {
  if (path.length === 0) return [0, 0]
  if (path.length === 1) return [...path[0]]
  let d = dist
  for (let i = 0; i < segLen.length; i++) {
    if (d <= segLen[i] || i === segLen.length - 1) {
      const t = segLen[i] > 1e-9 ? Math.min(1, d / segLen[i]) : 0
      const a = path[i]
      const b = path[i + 1]
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    }
    d -= segLen[i]
  }
  return [...path[path.length - 1]]
}

// ===== 核心导出 =====

/**
 * 基于 SLAM 底图画布像素的 360° 激光雷达扫描模拟。
 *
 * 坐标系约定（与 loadSlamMap 一致）：
 *   笛卡尔世界坐标 (x, y)：单位与 mapStartX 一致（米制）
 *   画布像素 (px, py)：
 *     px = (x - mapStartX) / mapWidth  * imgW
 *     py = (1 - (y - mapStartY) / mapHeight) * imgH  （y 翻转）
 *
 * @param {Object} params
 * @param {HTMLCanvasElement} params.canvas       已绘制 SLAM 底图的 canvas
 * @param {Array<[number,number]>} params.pathCart 路径（笛卡尔米制，与 mapStart/mapWidth 同单位）
 * @param {number} params.mapStartX
 * @param {number} params.mapStartY
 * @param {number} params.mapWidth   x 方向总宽（米）
 * @param {number} params.mapHeight  y 方向总高（米）
 * @param {number} [params.range=5]            激光量程（米）
 * @param {number} [params.angleStepDeg=1.2]   角分辨率（度）
 * @param {number} [params.stationStepM=0.09]  站位间距（米）
 * @param {number} [params.zLayers=10]         3D 每足迹 z 层数
 * @param {number} [params.cell=0.035]         去重栅格边长（米）
 * @returns {{pts2D:Array, pts3D:Array}}
 *   pts2D: [x, y, 0, s][]   按 s 升序
 *   pts3D: [x, y, z, s][]   按 s 升序，z ∈ [0, 障碍高度]
 */
export function simulateLidarFromCanvas({
  canvas,
  pathCart,
  mapStartX,
  mapStartY,
  mapWidth,
  mapHeight,
  range = 5,
  angleStepDeg = 1.2,
  stationStepM = 0.09,
  zLayers = 10,
  cell = 0.035
}) {
  const occ_data = getOccupancy(canvas)
  if (!occ_data) return { pts2D: [], pts3D: [] }

  const { occ, alpha, imgW, imgH } = occ_data

  const path = dedupePath(pathCart)
  if (path.length < 2) return { pts2D: [], pts3D: [] }

  const { segLen, total } = pathMetrics(path)
  if (total <= 0) return { pts2D: [], pts3D: [] }

  // 每米对应的像素数（用于量程转像素）
  const pxPerMeter = imgW / mapWidth
  const rangePixels = range * pxPerMeter

  // 笛卡尔 → 画布像素（注意 canvas y 轴朝下，world y 轴朝上，需翻转）
  const toPixel = (x, y) => [
    (x - mapStartX) / mapWidth * imgW,
    (1 - (y - mapStartY) / mapHeight) * imgH
  ]

  // 画布像素 → 笛卡尔
  const toCart = (px, py) => [
    mapStartX + (px / imgW) * mapWidth,
    mapStartY + (1 - py / imgH) * mapHeight
  ]

  const rays = Math.max(60, Math.round(360 / angleStepDeg))
  const nStations = Math.max(2, Math.ceil(total / stationStepM))

  const pts2D = []
  const pts3D = []

  // 第一遍：收集去重足迹 cell → {hx, hy, s, occVal, cellX, cellY}
  const footprints = new Map()

  for (let si = 0; si < nStations; si++) {
    const s = si / Math.max(1, nStations - 1)
    const dist = s * total
    const [cx, cy] = pointAtDist(path, segLen, dist)
    const [ox, oy] = toPixel(cx, cy)

    // 站位越界时跳过（两段路径拼接处 / 路径延伸到地图外）
    if (ox < 0 || ox >= imgW || oy < 0 || oy >= imgH) continue

    for (let ri = 0; ri < rays; ri++) {
      const ang = (ri / rays) * Math.PI * 2
      // canvas y 翻转：dy_canvas = -sin(ang)
      const dx = Math.cos(ang)
      const dy = -Math.sin(ang)

      const t = castRay(occ, imgW, imgH, ox, oy, dx, dy, rangePixels)
      if (t < 0) continue

      // 轻微噪声模拟测距误差
      const noise = (Math.random() - 0.5) * 0.4
      const hitPx = ox + dx * (t + noise)
      const hitPy = oy + dy * (t + noise)

      // 命中点越界：toCart 不做钳位，边界外坐标会生成地图外异常点（立柱）
      if (hitPx < 0 || hitPx >= imgW || hitPy < 0 || hitPy >= imgH) continue

      // 噪声偏移后二次验证
      const xi = Math.min(imgW - 1, Math.max(0, Math.round(hitPx)))
      const yi = Math.min(imgH - 1, Math.max(0, Math.round(hitPy)))
      const occVal = occ[yi * imgW + xi]
      // ① occ 必须 > 0（障碍物像素）
      if (occVal === 0) continue
      // ② alpha 必须足够高（>=200）：排除建筑外墙外侧的抗锯齿 / 渗出像素
      if (alpha[yi * imgW + xi] < 200) continue

      const [hx, hy] = toCart(hitPx, hitPy)
      const cellX = Math.round(hx / cell)
      const cellY = Math.round(hy / cell)
      const k2 = `${cellX},${cellY}`
      // 取首次（最小 s）命中，保证动态进度正确
      if (!footprints.has(k2)) {
        footprints.set(k2, { hx, hy, s, occVal, cellX, cellY })
      }
    }
  }

  // 第二遍：连通域大小过滤（flood-fill）。
  //   真实墙体 / 家具是成百上千个相互连通的足迹组成的大结构；
  //   而固定位置的孤立杂点簇（图纸标注 / 偏深家具符号被误判为实墙）
  //   只是一个与主结构分离的小连通块。局部邻域计数无法区分"密集小簇"
  //   和"真实墙体"，但连通域整体大小可以：小于阈值的连通块整体剔除。
  //   连通判据：Chebyshev 距离 ≤ GAP_TOL（容忍 1 格缝隙，避免墙体被噪声断开）。
  const GAP_TOL = 1
  const MIN_COMPONENT = 60   // 连通块足迹数下限，低于此视为杂点
  const cellMap = new Map()  // "cx,cy" → fp
  for (const fp of footprints.values()) cellMap.set(`${fp.cellX},${fp.cellY}`, fp)

  const visited = new Set()
  const survivors = []
  for (const fp of footprints.values()) {
    const startKey = `${fp.cellX},${fp.cellY}`
    if (visited.has(startKey)) continue

    // BFS 收集一个连通块
    const component = []
    const queue = [fp]
    visited.add(startKey)
    while (queue.length) {
      const cur = queue.pop()
      component.push(cur)
      for (let dyc = -GAP_TOL; dyc <= GAP_TOL; dyc++) {
        for (let dxc = -GAP_TOL; dxc <= GAP_TOL; dxc++) {
          if (dxc === 0 && dyc === 0) continue
          const nk = `${cur.cellX + dxc},${cur.cellY + dyc}`
          if (visited.has(nk)) continue
          const nfp = cellMap.get(nk)
          if (nfp) { visited.add(nk); queue.push(nfp) }
        }
      }
    }

    // 仅保留足够大的连通块
    if (component.length >= MIN_COMPONENT) {
      for (const c of component) survivors.push(c)
    }
  }

  // 第三遍：由存活足迹生成 2D / 3D 点
  const seen3D = new Set()
  for (const { hx, hy, s, occVal } of survivors) {
    pts2D.push([hx, hy, 0, s])

    // occVal 2 = 深色（实墙）高 2.5m，occVal 1 = 浅色（家具）高 0.88m
    const maxZ = occVal === 2 ? 2.5 : 0.88
    const cellX = Math.round(hx / cell)
    const cellY = Math.round(hy / cell)

    for (let zi = 0; zi < zLayers; zi++) {
      const frac = zi / (zLayers - 1)
      const base = frac < 0.12
        ? Math.random() * 0.15
        : frac > 0.88
          ? maxZ - Math.random() * 0.15
          : 0.15 + Math.pow(Math.random(), 0.8) * (maxZ - 0.3)
      const z = Math.max(0, Math.min(maxZ, base + (Math.random() - 0.5) * 0.04))

      const k3 = `${cellX},${cellY},${Math.round(z * 8)}`
      if (!seen3D.has(k3)) {
        seen3D.add(k3)
        pts3D.push([hx, hy, z, s])
      }
    }
  }

  pts2D.sort((a, b) => a[3] - b[3])
  pts3D.sort((a, b) => a[3] - b[3])

  return { pts2D, pts3D }
}

/**
 * 清除指定 canvas 的占据栅格缓存（底图重新加载后调用）。
 * @param {HTMLCanvasElement} [canvas]
 */
export function clearOccCache(canvas) {
  if (canvas) _occCache.delete(canvas)
}

export default { simulateLidarFromCanvas, clearOccCache }
