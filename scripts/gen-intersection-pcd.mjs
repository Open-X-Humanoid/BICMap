/*
 * @Description: 科创街 × 经海路 路口的模拟车载扫描点云。就地拼出 PCD binary 字节流，
 *   字段与 samples.pcd 保持一致（x y z intensity rgb），走和真实文件完全相同的解析路径。
 *   坐标为以路口中心为原点的局部 ENU（x 东、y 北、z 上，单位米）。
 *
 *   断面尺寸、走向、有轨电车位置均取自该路口的 OpenStreetMap 实测几何，
 *   因此点云叠到 OSM 瓦片上时能和底图路网对齐。
 *
 *   这是离线生成脚本，不参与打包。产物已入库，只有需要调整路形或密度时才重跑：
 *     node scripts/gen-intersection-pcd.mjs
 * @FilePath: scripts/gen-intersection-pcd.mjs
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const TAU = Math.PI * 2

/**
 * 由方位角构造道路局部坐标系
 * @param {number} bearingDeg 方位角（度，正北起顺时针）
 * @returns {{ ux: number, uy: number, nx: number, ny: number }} 沿路方向与右侧法向
 */
function createAxis(bearingDeg) {
  const radians = (bearingDeg * Math.PI) / 180
  const sin = Math.sin(radians)
  const cos = Math.cos(radians)
  return { ux: sin, uy: cos, nx: cos, ny: -sin }
}

/**
 * 两条相交道路的断面。单位米，距各自路中线的距离。
 * 科创街中央分隔带很宽，亦庄新城 T1 现代有轨电车就敷设在里面。
 *
 * 走向取自 OSM 各路段「按段长加权」的平均方位角。两条路在路口附近都有缓和曲线，
 * 若改用节点等权的 PCA，密集的路口节点会把结果拉偏约 2°，在 225 m 外就是 8 m 的横向漂移。
 *
 * curve 是实测中心线，每项为 [沿路里程 t, 中心线横向偏移, 断面宽度系数]，由 OSM 两幅路
 * 几何逐里程取中点得到。这两条路都不是直线：经海路在 ±240 m 内中心线鼓出约 6.5 m、
 * 北段还加宽 24%，只用一条直带去拟合，远端会肉眼可见地偏离底图。
 */
const KE = {
  label: '科创街',
  ...createAxis(57.9),
  medianHalf: 8.5,
  carriageOuter: 19.5,
  sidewalkOuter: 25,
  lanes: 3,
  curve: [
    [-240, 1.46, 0.924],
    [-200, 0.83, 0.965],
    [-160, 0.2, 1.007],
    [-120, -0.43, 1.049],
    [-80, -0.02, 1.016],
    [-40, 0.42, 0.982],
    [0, 0.29, 1],
    [40, -0.16, 0.962],
    [80, -0.22, 0.974],
    [120, -0.35, 0.982],
    [160, -0.75, 0.969],
    [200, -1.16, 0.957],
    [240, -1.56, 0.943]
  ]
}

const JING = {
  label: '经海路',
  ...createAxis(145.6),
  medianHalf: 6,
  carriageOuter: 16,
  sidewalkOuter: 21,
  lanes: 3,
  curve: [
    [-240, -5.19, 0.966],
    [-200, -4.04, 0.961],
    [-160, -2.89, 0.957],
    [-120, -1.73, 0.953],
    [-80, -0.44, 0.962],
    [-40, 0.86, 0.97],
    [0, 0.9, 1],
    [40, 0.01, 1.018],
    [80, -1.23, 1.073],
    [120, -2.48, 1.127],
    [160, -3.73, 1.182],
    [200, -4.98, 1.236],
    [240, -5.44, 1.219]
  ]
}

const ROADS = [KE, JING]

// 有轨电车：两条轨道的中心线位于科创街分隔带内
const TRAM_TRACKS = [-2.0, 1.6]
const TRAM_GAUGE = 1.435
const TRAM_BED = [-4.4, 4.0]
const TRAM_WIRE_Z = 5.8
const TRAM_POLE_S = -0.2

const HALF_LENGTH = 225 // 每条路自路口向两端延伸的长度
const SCAN_RADIUS = 230 // 地面采样半径

/**
 * 确定性伪随机，保证每次打开页面得到完全一致的点云
 * @param {number} seed
 * @returns {() => number}
 */
function createRandom(seed) {
  let state = seed >>> 0
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 在实测中心线表上线性插值
 * @param {object} road
 * @param {number} t 沿路里程
 * @returns {{ offset: number, scale: number }} 中心线横向偏移与断面宽度系数
 */
function curveAt(road, t) {
  const table = road.curve
  if (t <= table[0][0]) return { offset: table[0][1], scale: table[0][2] }
  const last = table[table.length - 1]
  if (t >= last[0]) return { offset: last[1], scale: last[2] }

  const span = table[1][0] - table[0][0]
  const i = Math.min(table.length - 2, Math.floor((t - table[0][0]) / span))
  const [t0, o0, s0] = table[i]
  const [t1, o1, s1] = table[i + 1]
  const f = (t - t0) / (t1 - t0)
  return { offset: o0 + (o1 - o0) * f, scale: s0 + (s1 - s0) * f }
}

/**
 * 道路局部坐标 (沿路 t, 横向 s) → ENU
 *
 * 弯道是沿固定法向做剪切，而不是真的绕中心线法向摆动。中心线斜率不超过 0.03，
 * 两者差异小于 0.05%，换来的是 lateralOf 可以精确反解、不必迭代求最近点。
 * @param {object} road
 * @param {number} t 沿路里程
 * @param {number} s 距路中线的横向距离，右侧为正
 * @returns {[number, number]}
 */
function toEnu(road, t, s) {
  const { offset, scale } = curveAt(road, t)
  const lateral = s * scale + offset
  return [road.ux * t + road.nx * lateral, road.uy * t + road.ny * lateral]
}

/**
 * ENU → 某条路的横向距离，toEnu 的精确逆运算
 * @param {object} road
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
function lateralOf(road, x, y) {
  const { offset, scale } = curveAt(road, x * road.ux + y * road.uy)
  return (x * road.nx + y * road.ny - offset) / scale
}

/**
 * 判断是否落在路口方形范围内。沿某条路的纵深由相交道路的车行道外缘决定。
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
function inJunction(x, y) {
  return (
    Math.abs(lateralOf(KE, x, y)) <= KE.carriageOuter &&
    Math.abs(lateralOf(JING, x, y)) <= JING.carriageOuter
  )
}

/**
 * 某条路在 t 处是否已经进入路口（用于让标线、路缘、行道树在路口让开）
 * @param {object} axis
 * @param {number} t
 * @param {number} [margin]
 * @returns {boolean}
 */
function nearJunction(axis, t, margin = 2) {
  const cross = axis === KE ? JING : KE
  return Math.abs(t) < cross.carriageOuter + margin
}

/**
 * 点收集器。分量各自存一条数组，最后一次性写进 ArrayBuffer
 * @returns {object}
 */
function createSink() {
  const xs = []
  const ys = []
  const zs = []
  const intensities = []
  const colors = []

  return {
    xs,
    ys,
    zs,
    intensities,
    colors,
    get count() {
      return xs.length
    },
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} intensity 0~255
     * @param {number[]} rgb [r, g, b]，各 0~255
     */
    push(x, y, z, intensity, rgb) {
      xs.push(x)
      ys.push(y)
      zs.push(z)
      intensities.push(intensity)
      colors.push(((rgb[0] & 255) << 16) | ((rgb[1] & 255) << 8) | (rgb[2] & 255))
    }
  }
}

/**
 * 在基色上叠加随机扰动，模拟真实反照率差异
 * @param {number[]} base [r, g, b]
 * @param {number} amp 扰动幅度
 * @param {() => number} rnd
 * @returns {number[]}
 */
function shade(base, amp, rnd) {
  const delta = (rnd() - 0.5) * 2 * amp
  return [
    Math.max(0, Math.min(255, base[0] + delta)),
    Math.max(0, Math.min(255, base[1] + delta)),
    Math.max(0, Math.min(255, base[2] + delta))
  ]
}

const ASPHALT = [74, 77, 82]
const SIDEWALK = [150, 150, 148]
const GRASS = [78, 124, 66]
const MARKING = [228, 230, 226]
const CURB = [176, 174, 170]
const CONCRETE = [168, 170, 173]
const STEEL = [188, 186, 180]

/**
 * 地面：在圆盘内均匀撒点，按到两条路中线的横向距离判定地物类型
 * @param {object} sink
 * @param {() => number} rnd
 */
function addGround(sink, rnd) {
  const total = 130000

  for (let i = 0; i < total; i++) {
    // sqrt 保证圆盘内均匀分布，否则会在圆心堆积
    const radius = SCAN_RADIUS * Math.sqrt(rnd())
    const angle = rnd() * TAU
    const x = radius * Math.cos(angle)
    const y = radius * Math.sin(angle)

    const sKe = lateralOf(KE, x, y)
    const sJing = lateralOf(JING, x, y)
    const absKe = Math.abs(sKe)
    const absJing = Math.abs(sJing)

    if (inJunction(x, y)) {
      sink.push(x, y, (rnd() - 0.5) * 0.05, 30 + rnd() * 16, shade(ASPHALT, 9, rnd))
      continue
    }

    const onCarriage =
      (absKe >= KE.medianHalf && absKe <= KE.carriageOuter) ||
      (absJing >= JING.medianHalf && absJing <= JING.carriageOuter)
    if (onCarriage) {
      sink.push(x, y, (rnd() - 0.5) * 0.05, 30 + rnd() * 16, shade(ASPHALT, 9, rnd))
      continue
    }

    // 科创街分隔带被电车道占去中间一条，两侧才是绿化
    if (absKe < KE.medianHalf) {
      if (sKe > TRAM_BED[0] && sKe < TRAM_BED[1]) {
        sink.push(x, y, 0.1 + rnd() * 0.05, 72 + rnd() * 26, shade(CONCRETE, 13, rnd))
      } else if (rnd() < 0.45) {
        sink.push(x, y, 0.2 + rnd() * 0.3, 62 + rnd() * 34, shade(GRASS, 22, rnd))
      }
      continue
    }

    if (absJing < JING.medianHalf) {
      if (rnd() < 0.45) {
        sink.push(x, y, 0.2 + rnd() * 0.3, 62 + rnd() * 34, shade(GRASS, 22, rnd))
      }
      continue
    }

    if (absKe <= KE.sidewalkOuter || absJing <= JING.sidewalkOuter) {
      if (rnd() > 0.72) continue
      sink.push(x, y, 0.14 + rnd() * 0.04, 88 + rnd() * 24, shade(SIDEWALK, 14, rnd))
      continue
    }

    if (rnd() > 0.3) continue
    sink.push(x, y, 0.04 + rnd() * 0.42, 54 + rnd() * 44, shade(GRASS, 26, rnd))
  }
}

/**
 * 车行道加密。均匀圆盘撒点落在路面上的密度不足以看出车道结构，这里单独补一遍
 * @param {object} sink
 * @param {() => number} rnd
 */
function densifyCarriageway(sink, rnd) {
  for (const road of ROADS) {
    const samples = 26000
    for (let i = 0; i < samples; i++) {
      const t = (rnd() * 2 - 1) * HALF_LENGTH
      const side = rnd() < 0.5 ? -1 : 1
      const s = side * (road.medianHalf + rnd() * (road.carriageOuter - road.medianHalf))
      const [x, y] = toEnu(road, t, s)
      sink.push(x, y, (rnd() - 0.5) * 0.05, 30 + rnd() * 16, shade(ASPHALT, 9, rnd))
    }
  }
}

/**
 * 沿路画一条标线
 * @param {object} sink
 * @param {object} road
 * @param {() => number} rnd
 * @param {number} offset 横向位置
 * @param {{ dashed?: boolean, width?: number }} [style]
 */
function addLaneLine(sink, road, rnd, offset, style = {}) {
  const { dashed = false, width = 0.15 } = style
  const stride = 0.06
  const dashCycle = 10
  const dashOn = 4

  for (let t = -HALF_LENGTH; t < HALF_LENGTH; t += stride) {
    if (nearJunction(road, t, 4)) continue
    if (dashed) {
      const phase = ((t % dashCycle) + dashCycle) % dashCycle
      if (phase > dashOn) continue
    }
    const s = offset + (rnd() - 0.5) * width
    const [x, y] = toEnu(road, t, s)
    sink.push(x, y, 0.01 + rnd() * 0.02, 185 + rnd() * 60, shade(MARKING, 12, rnd))
  }
}

/**
 * 斑马线与停止线：在路口四个进口道各铺一组
 * @param {object} sink
 * @param {object} road
 * @param {() => number} rnd
 */
function addCrosswalk(sink, road, rnd) {
  const cross = road === KE ? JING : KE
  const stripeWidth = 0.45
  const gap = 0.9
  const length = 3.2

  for (const direction of [-1, 1]) {
    const base = direction * (cross.carriageOuter + 1.8)
    for (let s = -road.carriageOuter; s <= road.carriageOuter; s += stripeWidth + gap) {
      if (Math.abs(s) < road.medianHalf) continue
      const count = Math.round(stripeWidth * length * 160)
      for (let i = 0; i < count; i++) {
        const t = base + (rnd() - 0.5) * length
        const [x, y] = toEnu(road, t, s + rnd() * stripeWidth)
        sink.push(x, y, 0.01 + rnd() * 0.02, 190 + rnd() * 58, shade(MARKING, 10, rnd))
      }
    }

    const stopT = direction * (cross.carriageOuter + 5.6)
    for (let i = 0; i < 1400; i++) {
      const lateral = direction * (road.medianHalf + rnd() * (road.carriageOuter - road.medianHalf))
      const [x, y] = toEnu(road, stopT + (rnd() - 0.5) * 0.4, lateral)
      sink.push(x, y, 0.01 + rnd() * 0.02, 190 + rnd() * 58, shade(MARKING, 10, rnd))
    }
  }
}

/**
 * 路缘石：中央分隔带与人行道两侧各一道
 * @param {object} sink
 * @param {object} road
 * @param {() => number} rnd
 */
function addCurbs(sink, road, rnd) {
  const offsets = [road.medianHalf, road.carriageOuter, road.sidewalkOuter]

  for (const magnitude of offsets) {
    for (const side of [-1, 1]) {
      for (let t = -HALF_LENGTH; t < HALF_LENGTH; t += 0.12) {
        if (nearJunction(road, t)) continue
        const s = side * magnitude + (rnd() - 0.5) * 0.25
        const [x, y] = toEnu(road, t, s)
        sink.push(x, y, rnd() * 0.16, 96 + rnd() * 30, shade(CURB, 12, rnd))
      }
    }
  }
}

/**
 * 有轨电车：道床、钢轨、接触网立柱与接触线
 * @param {object} sink
 * @param {() => number} rnd
 */
function addTramway(sink, rnd) {
  // 钢轨：反射强度明显高于周边，是点云里最容易辨认的线状特征
  for (const trackCenter of TRAM_TRACKS) {
    for (const rail of [-TRAM_GAUGE / 2, TRAM_GAUGE / 2]) {
      for (let t = -HALF_LENGTH; t < HALF_LENGTH; t += 0.07) {
        const [x, y] = toEnu(KE, t, trackCenter + rail + (rnd() - 0.5) * 0.06)
        sink.push(x, y, 0.16 + rnd() * 0.06, 214 + rnd() * 40, shade(STEEL, 10, rnd))
      }
    }

    // 轨枕
    for (let t = -HALF_LENGTH; t < HALF_LENGTH; t += 0.65) {
      for (let i = 0; i < 26; i++) {
        const [x, y] = toEnu(KE, t + (rnd() - 0.5) * 0.22, trackCenter + (rnd() * 2 - 1) * 1.25)
        sink.push(x, y, 0.1 + rnd() * 0.04, 92 + rnd() * 26, shade([126, 126, 124], 12, rnd))
      }
    }
  }

  // 接触网立柱 + 悬臂 + 接触线
  for (let t = -HALF_LENGTH + 16; t < HALF_LENGTH; t += 32) {
    if (nearJunction(KE, t, 6)) continue
    const [px, py] = toEnu(KE, t, TRAM_POLE_S)
    for (let i = 0; i < 220; i++) {
      const angle = rnd() * TAU
      sink.push(
        px + 0.13 * Math.cos(angle),
        py + 0.13 * Math.sin(angle),
        rnd() * 7.2,
        126 + rnd() * 44,
        shade([150, 154, 158], 12, rnd)
      )
    }
    for (const trackCenter of TRAM_TRACKS) {
      for (let i = 0; i < 50; i++) {
        const k = rnd()
        const [ax, ay] = toEnu(KE, t, TRAM_POLE_S + (trackCenter - TRAM_POLE_S) * k)
        sink.push(ax, ay, 7.0 - k * 0.9, 130 + rnd() * 40, shade([150, 154, 158], 10, rnd))
      }
    }
  }

  for (const trackCenter of TRAM_TRACKS) {
    for (let t = -HALF_LENGTH; t < HALF_LENGTH; t += 0.5) {
      const [x, y] = toEnu(KE, t, trackCenter + (rnd() - 0.5) * 0.1)
      sink.push(x, y, TRAM_WIRE_Z + (rnd() - 0.5) * 0.08, 170 + rnd() * 50, shade(STEEL, 8, rnd))
    }
  }
}

/**
 * 行道树：树干圆柱 + 树冠椭球
 * @param {object} sink
 * @param {number} cx
 * @param {number} cy
 * @param {() => number} rnd
 */
function addTree(sink, cx, cy, rnd) {
  const trunkHeight = 2.2 + rnd() * 0.8
  const canopyR = 2.1 + rnd() * 0.9
  const canopyZ = trunkHeight + canopyR * 0.85

  for (let i = 0; i < 70; i++) {
    const angle = rnd() * TAU
    const r = 0.16 + rnd() * 0.05
    sink.push(
      cx + r * Math.cos(angle),
      cy + r * Math.sin(angle),
      rnd() * trunkHeight,
      70 + rnd() * 26,
      shade([96, 78, 62], 16, rnd)
    )
  }

  for (let i = 0; i < 330; i++) {
    // 球面均匀采样，再向内收一点让树冠有体积感
    const u = rnd() * 2 - 1
    const angle = rnd() * TAU
    const planar = Math.sqrt(1 - u * u)
    const shrink = 0.78 + rnd() * 0.22
    sink.push(
      cx + canopyR * shrink * planar * Math.cos(angle),
      cy + canopyR * shrink * planar * Math.sin(angle),
      canopyZ + canopyR * 0.8 * shrink * u,
      74 + rnd() * 40,
      shade([58, 104, 52], 24, rnd)
    )
  }
}

/**
 * 沿两条路布置行道树，路口附近留空
 * @param {object} sink
 * @param {() => number} rnd
 */
function addTrees(sink, rnd) {
  for (const road of ROADS) {
    for (const side of [-1, 1]) {
      for (let t = -HALF_LENGTH + 12; t < HALF_LENGTH; t += 11) {
        if (nearJunction(road, t, 16)) continue
        const s = side * (road.sidewalkOuter + 2.4 + (rnd() - 0.5) * 0.8)
        const [x, y] = toEnu(road, t + (rnd() - 0.5) * 1.6, s)
        addTree(sink, x, y, rnd)
      }
    }
  }
}

/**
 * 竖直杆件
 * @param {object} sink
 * @param {number} cx
 * @param {number} cy
 * @param {number} z0
 * @param {number} z1
 * @param {number} radius
 * @param {number} count
 * @param {number[]} color
 * @param {() => number} rnd
 */
function addPole(sink, cx, cy, z0, z1, radius, count, color, rnd) {
  for (let i = 0; i < count; i++) {
    const angle = rnd() * TAU
    sink.push(
      cx + radius * Math.cos(angle),
      cy + radius * Math.sin(angle),
      z0 + rnd() * (z1 - z0),
      110 + rnd() * 50,
      shade(color, 12, rnd)
    )
  }
}

/**
 * 路灯。科创街分隔带让给了电车，灯杆改立在人行道内侧
 * @param {object} sink
 * @param {() => number} rnd
 */
function addStreetLamps(sink, rnd) {
  const poleColor = [172, 176, 180]

  for (const road of ROADS) {
    for (const side of [-1, 1]) {
      for (let t = -HALF_LENGTH + 20; t < HALF_LENGTH; t += 34) {
        if (nearJunction(road, t, 12)) continue
        const base = side * (road.carriageOuter + 1.1)
        const [x, y] = toEnu(road, t, base)
        addPole(sink, x, y, 0, 10.2, 0.14, 150, poleColor, rnd)

        // 悬臂伸向车行道
        for (let i = 0; i < 70; i++) {
          const k = rnd()
          const [ax, ay] = toEnu(road, t, base - side * k * 3.4)
          sink.push(ax, ay, 10.2 - k * 0.3, 120 + rnd() * 46, shade(poleColor, 10, rnd))
        }
        const [hx, hy] = toEnu(road, t, base - side * 3.4)
        for (let i = 0; i < 40; i++) {
          sink.push(
            hx + (rnd() - 0.5) * 0.7,
            hy + (rnd() - 0.5) * 0.7,
            9.8 + rnd() * 0.3,
            210 + rnd() * 44,
            shade([220, 216, 198], 12, rnd)
          )
        }
      }
    }
  }
}

/**
 * 路口四角的信号灯杆，带横跨车道的悬臂
 * @param {object} sink
 * @param {() => number} rnd
 */
function addTrafficSignals(sink, rnd) {
  const poleColor = [120, 128, 132]

  for (const road of ROADS) {
    const cross = road === KE ? JING : KE
    for (const direction of [-1, 1]) {
      const t = direction * (cross.carriageOuter + 6)
      const s = -direction * (road.carriageOuter + 1.2)
      const [x, y] = toEnu(road, t, s)
      addPole(sink, x, y, 0, 7.4, 0.16, 140, poleColor, rnd)

      for (let i = 0; i < 180; i++) {
        const reach = rnd() * 9.5
        const [ax, ay] = toEnu(road, t, s + direction * reach)
        sink.push(ax, ay, 7.2 + rnd() * 0.18, 130 + rnd() * 40, shade(poleColor, 10, rnd))
      }

      for (let k = 1; k <= 3; k++) {
        const [hx, hy] = toEnu(road, t, s + direction * k * 2.6)
        for (let i = 0; i < 70; i++) {
          sink.push(
            hx + (rnd() - 0.5) * 0.4,
            hy + (rnd() - 0.5) * 0.4,
            6.3 + rnd() * 0.9,
            150 + rnd() * 60,
            shade([52, 56, 60], 14, rnd)
          )
        }
      }
    }
  }
}

/**
 * 长方体表面采样（略去底面，车载雷达扫不到）
 * @param {object} sink
 * @param {object} road 所属道路，决定长方体朝向
 * @param {{ t: number, s: number, z: number, length: number, width: number, height: number }} box
 * @param {number[]} color
 * @param {number} density 每平方米点数
 * @param {() => number} rnd
 * @param {{ intensity?: number }} [options]
 */
function addBox(sink, road, box, color, density, rnd, options = {}) {
  const { t, s, z, length, width, height } = box
  const { intensity = 90 } = options
  const halfL = length / 2
  const halfW = width / 2

  const faces = [
    { area: length * width, kind: 'top' },
    { area: length * height, kind: 'left' },
    { area: length * height, kind: 'right' },
    { area: width * height, kind: 'front' },
    { area: width * height, kind: 'back' }
  ]

  for (const face of faces) {
    const count = Math.max(8, Math.round(face.area * density))
    for (let i = 0; i < count; i++) {
      let dt
      let ds
      let dz

      if (face.kind === 'top') {
        dt = (rnd() * 2 - 1) * halfL
        ds = (rnd() * 2 - 1) * halfW
        dz = height
      } else if (face.kind === 'left' || face.kind === 'right') {
        dt = (rnd() * 2 - 1) * halfL
        ds = face.kind === 'left' ? -halfW : halfW
        dz = rnd() * height
      } else {
        dt = face.kind === 'front' ? halfL : -halfL
        ds = (rnd() * 2 - 1) * halfW
        dz = rnd() * height
      }

      const [x, y] = toEnu(road, t + dt, s + ds)
      sink.push(x, y, z + dz, intensity + rnd() * 40, shade(color, 14, rnd))
    }
  }
}

/**
 * 沿街建筑。按 OSM 的用地性质摆在科创街西北侧的产业园一侧，
 * 东南侧几块是 leisure=park，保持空旷
 * @param {object} sink
 * @param {() => number} rnd
 */
function addBuildings(sink, rnd) {
  const blocks = [
    { road: KE, t: 118, s: -72, length: 56, width: 34, height: 24, color: [186, 180, 168] },
    { road: KE, t: -126, s: -66, length: 50, width: 32, height: 18, color: [172, 176, 182] },
    { road: JING, t: -118, s: 62, length: 46, width: 30, height: 28, color: [160, 164, 170] },
    { road: JING, t: 122, s: -58, length: 44, width: 30, height: 21, color: [180, 172, 160] }
  ]

  for (const block of blocks) {
    addBox(
      sink,
      block.road,
      { t: block.t, s: block.s, z: 0, length: block.length, width: block.width, height: block.height },
      block.color,
      0.8,
      rnd,
      { intensity: 100 }
    )
  }
}

/**
 * 车道上的车辆
 * @param {object} sink
 * @param {() => number} rnd
 */
function addVehicles(sink, rnd) {
  const palette = [
    [206, 208, 212],
    [48, 52, 58],
    [152, 26, 32],
    [32, 68, 142],
    [180, 182, 186],
    [66, 92, 72]
  ]

  for (const road of ROADS) {
    const laneWidth = (road.carriageOuter - road.medianHalf) / road.lanes
    for (let i = 0; i < 11; i++) {
      const t = (rnd() * 2 - 1) * (HALF_LENGTH - 20)
      if (nearJunction(road, t)) continue
      const side = rnd() < 0.5 ? -1 : 1
      const lane = Math.floor(rnd() * road.lanes)
      const s = side * (road.medianHalf + (lane + 0.5) * laneWidth)

      const isTruck = rnd() < 0.22
      addBox(
        sink,
        road,
        {
          t,
          s,
          z: 0.25,
          length: isTruck ? 8.4 : 4.6,
          width: isTruck ? 2.5 : 1.85,
          height: isTruck ? 3.1 : 1.45
        },
        palette[Math.floor(rnd() * palette.length)],
        isTruck ? 5 : 7,
        rnd,
        { intensity: 120 }
      )
    }
  }
}

/**
 * 把收集到的点打包成 PCD binary 字节流
 * @param {object} sink
 * @returns {ArrayBuffer}
 */
function toPcdBuffer(sink) {
  const count = sink.count
  const header =
    '# .PCD v0.7 - Point Cloud Data file format\n' +
    'VERSION 0.7\n' +
    'FIELDS x y z intensity rgb\n' +
    'SIZE 4 4 4 4 4\n' +
    'TYPE F F F F F\n' +
    'COUNT 1 1 1 1 1\n' +
    `WIDTH ${count}\n` +
    'HEIGHT 1\n' +
    'VIEWPOINT 0 0 0 1 0 0 0\n' +
    `POINTS ${count}\n` +
    'DATA binary\n'

  const headerBytes = new TextEncoder().encode(header)
  const stride = 20
  const buffer = new ArrayBuffer(headerBytes.length + count * stride)
  new Uint8Array(buffer).set(headerBytes, 0)

  const view = new DataView(buffer, headerBytes.length)
  for (let i = 0; i < count; i++) {
    const base = i * stride
    view.setFloat32(base, sink.xs[i], true)
    view.setFloat32(base + 4, sink.ys[i], true)
    view.setFloat32(base + 8, sink.zs[i], true)
    view.setFloat32(base + 12, sink.intensities[i], true)
    // PCL 约定：rgb 字段声明为 float，实际存的是打包后的 uint32 位模式
    view.setUint32(base + 16, sink.colors[i], true)
  }

  return buffer
}

/**
 * 生成科创街 × 经海路 路口的模拟点云
 * @param {number} [seed] 随机种子，同一种子得到完全相同的点云
 * @returns {ArrayBuffer} PCD binary 字节流
 */
export function buildIntersectionPcd(seed = 20260131) {
  const rnd = createRandom(seed)
  const sink = createSink()

  addGround(sink, rnd)
  densifyCarriageway(sink, rnd)

  for (const road of ROADS) {
    addCurbs(sink, road, rnd)
    addCrosswalk(sink, road, rnd)

    const laneWidth = (road.carriageOuter - road.medianHalf) / road.lanes
    for (const side of [-1, 1]) {
      // 内外侧边线为实线，车道分界为虚线
      addLaneLine(sink, road, rnd, side * (road.medianHalf + 0.35))
      addLaneLine(sink, road, rnd, side * (road.carriageOuter - 0.35))
      for (let lane = 1; lane < road.lanes; lane++) {
        addLaneLine(sink, road, rnd, side * (road.medianHalf + lane * laneWidth), { dashed: true })
      }
    }
  }

  addTramway(sink, rnd)
  addTrees(sink, rnd)
  addStreetLamps(sink, rnd)
  addTrafficSignals(sink, rnd)
  addBuildings(sink, rnd)
  addVehicles(sink, rnd)

  return toPcdBuffer(sink)
}

const target = fileURLToPath(
  new URL('../src/examples/expand/PcdViewer/samples/intersection.pcd', import.meta.url)
)
const output = Buffer.from(buildIntersectionPcd())
writeFileSync(target, output)
console.log(`已写出 ${target}（${(output.length / 1048576).toFixed(2)} MB）`)
