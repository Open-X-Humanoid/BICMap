export const MAP_CENTER = [116.4076, 39.9045]
export const MAP_ZOOM = 16
export const MAP_PITCH = 55
export const MAP_BEARING = -20

// ─── 坐标辅助函数 ────────────────────────────────────────────────────────────

/**
 * 生成矩形 footprint 坐标环（用于建筑/绿地/停车场）
 * @param {number} cx 中心经度
 * @param {number} cy 中心纬度
 * @param {number} w  东西方向半宽（度）
 * @param {number} h  南北方向半高（度）
 * @returns {Array} GeoJSON Polygon coordinates
 */
function rect(cx, cy, w, h) {
  return [
    [
      [cx - w, cy - h],
      [cx + w, cy - h],
      [cx + w, cy + h],
      [cx - w, cy + h],
      [cx - w, cy - h]
    ]
  ]
}

/**
 * 生成 L 形建筑 footprint
 * L 形起点 (cx, cy) 为左下角，向右和向上延伸
 * 总包围盒: 宽 2s × 高 2s，占用左下角横条（2s×s）和左侧竖条（s×2s）
 * @param {number} cx 起点经度（左下角）
 * @param {number} cy 起点纬度（左下角）
 * @param {number} s  基准尺度（度）
 */
function lShape(cx, cy, s) {
  return [
    [
      [cx, cy],
      [cx + s * 2, cy],
      [cx + s * 2, cy + s],
      [cx + s, cy + s],
      [cx + s, cy + s * 2],
      [cx, cy + s * 2],
      [cx, cy]
    ]
  ]
}

/**
 * U 形 footprint：开口朝右，包围盒 3s × 2s
 */
function uShape(cx, cy, s) {
  return [[
    [cx, cy],
    [cx + s * 3, cy],
    [cx + s * 3, cy + s * 2],
    [cx + s * 2, cy + s * 2],
    [cx + s * 2, cy + s],
    [cx + s, cy + s],
    [cx + s, cy + s * 2],
    [cx, cy + s * 2],
    [cx, cy]
  ]]
}

// ─── 道路网格定义（唯一真相来源）────────────────────────────────────────────
//
// 主干道（6 条）围合 4 个大街区；次级道路（4 条）将大街区细分为 16 个子地块
//
// 子地块可用内矩形（主干道间距 ≥0.00011°，次级道路间距 ≥0.00008°）：
//
//   行  lat_min   lat_max     列  lng_min    lng_max
//   S1  39.9031   39.9035     W1  116.4049   116.4061
//   S2  39.9037   39.9042     W2  116.4063   116.4074
//   N1  39.9044   39.9049     E1  116.4076   116.4088
//   N2  39.9051   39.9056     E2  116.4090   116.4102
//
// 建筑/面要素中心点和尺寸均从上述地块范围推导，不超出边界。
// ─────────────────────────────────────────────────────────────────────────────

// ─── 道路网络 ────────────────────────────────────────────────────────────────

/**
 * 道路网络（10 条：6 主干道 + 4 次级道路）
 * road_type: 'primary' | 'secondary'
 */
export const MOCK_ROADS = {
  type: 'FeatureCollection',
  features: [
    // ── 东西向主干道 ──
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[116.4028, 39.9030], [116.4123, 39.9030]]
      },
      properties: { road_type: 'primary', name: '创业路' }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[116.4028, 39.9043], [116.4123, 39.9043]]
      },
      properties: { road_type: 'primary', name: '科技大道' }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[116.4028, 39.9057], [116.4123, 39.9057]]
      },
      properties: { road_type: 'primary', name: '学院路' }
    },
    // ── 南北向主干道 ──
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[116.4048, 39.9010], [116.4048, 39.9080]]
      },
      properties: { road_type: 'primary', name: '中央大道' }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[116.4075, 39.9010], [116.4075, 39.9080]]
      },
      properties: { road_type: 'primary', name: '中轴路' }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[116.4103, 39.9010], [116.4103, 39.9080]]
      },
      properties: { road_type: 'primary', name: '东环路' }
    },
    // ── 东西向次级道路 ──
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[116.4028, 39.9036], [116.4123, 39.9036]]
      },
      properties: { road_type: 'secondary', name: '南一支路' }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[116.4028, 39.9050], [116.4123, 39.9050]]
      },
      properties: { road_type: 'secondary', name: '北一支路' }
    },
    // ── 南北向次级道路 ──
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[116.4062, 39.9010], [116.4062, 39.9080]]
      },
      properties: { road_type: 'secondary', name: '西支路' }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[116.4089, 39.9010], [116.4089, 39.9080]]
      },
      properties: { road_type: 'secondary', name: '东支路' }
    },
    // ── 道路中心线（黄色虚线车道分隔） ──
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4028, 39.9030], [116.4123, 39.9030]] }, properties: { marking: 'centerline', name: '创业路中心线' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4028, 39.9043], [116.4123, 39.9043]] }, properties: { marking: 'centerline', name: '科技大道中心线' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4028, 39.9057], [116.4123, 39.9057]] }, properties: { marking: 'centerline', name: '学院路中心线' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4048, 39.9010], [116.4048, 39.9080]] }, properties: { marking: 'centerline', name: '中央大道中心线' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4075, 39.9010], [116.4075, 39.9080]] }, properties: { marking: 'centerline', name: '中轴路中心线' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[116.4103, 39.9010], [116.4103, 39.9080]] }, properties: { marking: 'centerline', name: '东环路中心线' } }
  ]
}

// ─── 建筑物数据 ──────────────────────────────────────────────────────────────
//
// 地块分配：
//   S1×W1 → 地标塔 200m
//   S1×W2 → 裙楼 12m（商业裙楼）
//   S1×E2 → 公寓裙楼 8m + 公寓塔楼 85m（底座 base_height=8）
//   S2×W1 → 国际酒店 140m
//   S2×W2 → 科技广场A座 120m
//   S2×E1 → 科技广场B座 95m
//   N1×W1 → 市第三医院 50m
//   N1×W2 → 商业中心 45m
//   N1×E1 → 区政务中心 28m
//   N1×E2 → 华苑1/2/3号楼 65/72/68m（三栋并排）
//   N2×W2 → 配送中心 10m（仓储）
//   N2×E1 → 理工附中教学楼 18m（L形）
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_BUILDINGS = {
  type: 'FeatureCollection',
  features: [
    // ── S1 行（lat 39.9031~39.9035，窄带，适合小基脚超高层）──

    // S1×W1：地标塔 200m，细高楼，小基脚
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4055, 39.9033, 0.00015, 0.00009) },
      properties: { height: 200, base_height: 0, color: '#2a69e4', name: '地标塔' }
    },

    // S1×W2：商业裙楼（宽且矮，占满街块）
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4069, 39.9033, 0.00038, 0.00009) },
      properties: { height: 12, base_height: 0, color: '#2a69e4', name: '裙楼' }
    },

    // S1×E2：公寓裙楼（宽底座）
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4096, 39.9033, 0.00042, 0.00009) },
      properties: { height: 8, base_height: 0, color: '#2a69e4', name: '公寓裙楼' }
    },
    // S1×E2：公寓塔楼（立于裙楼之上，base_height 与裙楼高度一致）
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4092, 39.9033, 0.00015, 0.00009) },
      properties: { height: 85, base_height: 8, color: '#2a69e4', name: '公寓塔楼' }
    },

    // ── S2 行（lat 39.9037~39.9042）──

    // S2×W1：国际酒店 140m
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4054, 39.9040, 0.0003, 0.00017) },
      properties: { height: 140, base_height: 0, color: '#2a69e4', name: '国际酒店' }
    },

    // S2×W2：科技广场A座 120m
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4069, 39.9040, 0.0003, 0.00016) },
      properties: { height: 120, base_height: 0, color: '#2a69e4', name: '科技广场A座' }
    },

    // S2×E1：科技广场B座 95m
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4082, 39.9040, 0.0003, 0.00015) },
      properties: { height: 95, base_height: 0, color: '#2a69e4', name: '科技广场B座' }
    },

    // ── N1 行（lat 39.9044~39.9049）──

    // N1×W1：市第三医院 50m（大型横宽楼）
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4055, 39.9046, 0.0004, 0.00018) },
      properties: { height: 50, base_height: 0, color: '#2a69e4', name: '市第三医院' }
    },

    // N1×W2：商业中心 45m
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4069, 39.9046, 0.00032, 0.00016) },
      properties: { height: 45, base_height: 0, color: '#2a69e4', name: '商业中心' }
    },

    // N1×E1：区政务中心 28m（宽扁政府建筑）
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4082, 39.9046, 0.0004, 0.00013) },
      properties: { height: 28, base_height: 0, color: '#2a69e4', name: '区政务中心' }
    },

    // N1×E2：住宅组团（三栋并排，东西间距均匀）
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4092, 39.9046, 0.00012, 0.00018) },
      properties: { height: 65, base_height: 0, color: '#2a69e4', name: '华苑1号楼' }
    },
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4096, 39.9046, 0.00012, 0.00018) },
      properties: { height: 72, base_height: 0, color: '#2a69e4', name: '华苑2号楼' }
    },
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4100, 39.9046, 0.00012, 0.00018) },
      properties: { height: 68, base_height: 0, color: '#2a69e4', name: '华苑3号楼' }
    },

    // ── N2 行（lat 39.9051~39.9056）──

    // N2×W2：配送中心 10m（大跨度仓储）
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4069, 39.9053, 0.0004, 0.00012) },
      properties: { height: 10, base_height: 0, color: '#2a69e4', name: '配送中心' }
    },

    // N2×E1：理工附中教学楼 18m（L 形）
    // lShape 起点为左下角，向右/向上延伸，s=0.00013 → 总包围盒 0.00026×0.00026
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: lShape(116.4078, 39.9052, 0.00013) },
      properties: { height: 18, base_height: 0, color: '#2a69e4', name: '理工附中教学楼' }
    },

    // ═════════════════════════════════════════════════════════════════════════
    // B 行增补（lat 39.9030~39.9036）：B2 地标塔已在上面
    // ═════════════════════════════════════════════════════════════════════════

    // B3：数码大厦 75m（建于裙楼之上）
    {
      type: 'Feature', id: 1001,
      geometry: { type: 'Polygon', coordinates: rect(116.4068, 39.9033, 0.00012, 0.00007) },
      properties: { height: 75, base_height: 12, color: '#2a69e4', name: '数码大厦' }
    },
    // B5：社区服务中心 12m
    {
      type: 'Feature', id: 1002,
      geometry: { type: 'Polygon', coordinates: rect(116.4101, 39.9033, 0.00010, 0.00006) },
      properties: { height: 12, base_height: 0, color: '#2a69e4', name: '社区服务中心' }
    },

    // ═════════════════════════════════════════════════════════════════════════
    // C 行增补（lat 39.9036~39.9043）：CBD 核心区
    // ═════════════════════════════════════════════════════════════════════════

    // C2：银行大厦 55m
    {
      type: 'Feature', id: 1003,
      geometry: { type: 'Polygon', coordinates: rect(116.4057, 39.9040, 0.00012, 0.00012) },
      properties: { height: 55, base_height: 0, color: '#2a69e4', name: '银行大厦' }
    },
    // C3：科创大厦 90m
    {
      type: 'Feature', id: 1004,
      geometry: { type: 'Polygon', coordinates: rect(116.4066, 39.9040, 0.00020, 0.00015) },
      properties: { height: 90, base_height: 0, color: '#2a69e4', name: '科创大厦' }
    },
    // C3：环球中心 130m
    {
      type: 'Feature', id: 1005,
      geometry: { type: 'Polygon', coordinates: rect(116.4070, 39.9040, 0.00018, 0.00014) },
      properties: { height: 130, base_height: 0, color: '#2a69e4', name: '环球中心' }
    },
    // C5：金融大厦 160m（超高层地标）
    {
      type: 'Feature', id: 1006,
      geometry: { type: 'Polygon', coordinates: rect(116.4095, 39.9040, 0.00016, 0.00012) },
      properties: { height: 160, base_height: 0, color: '#2a69e4', name: '金融大厦' }
    },
    // C5：人才大厦 50m（辅楼）
    {
      type: 'Feature', id: 1007,
      geometry: { type: 'Polygon', coordinates: rect(116.4099, 39.9040, 0.00016, 0.00010) },
      properties: { height: 50, base_height: 0, color: '#2a69e4', name: '人才大厦' }
    },

    // ═════════════════════════════════════════════════════════════════════════
    // D 行增补（lat 39.9043~39.9050）：商业 + 政务
    // ═════════════════════════════════════════════════════════════════════════

    // D2：社区卫生中心 15m
    {
      type: 'Feature', id: 1008,
      geometry: { type: 'Polygon', coordinates: rect(116.4058, 39.9046, 0.00012, 0.00010) },
      properties: { height: 15, base_height: 0, color: '#2a69e4', name: '社区卫生中心' }
    },
    // D3：写字楼 35m + 商务楼 28m
    {
      type: 'Feature', id: 1009,
      geometry: { type: 'Polygon', coordinates: rect(116.4065, 39.90475, 0.00014, 0.00010) },
      properties: { height: 35, base_height: 0, color: '#2a69e4', name: '创业写字楼' }
    },
    {
      type: 'Feature', id: 1010,
      geometry: { type: 'Polygon', coordinates: rect(116.4072, 39.90475, 0.00014, 0.00010) },
      properties: { height: 28, base_height: 0, color: '#2a69e4', name: '商务楼' }
    },
    // D4：税务大楼 22m
    {
      type: 'Feature', id: 1011,
      geometry: { type: 'Polygon', coordinates: rect(116.4085, 39.90475, 0.00014, 0.00010) },
      properties: { height: 22, base_height: 0, color: '#2a69e4', name: '税务大楼' }
    },

    // ═════════════════════════════════════════════════════════════════════════
    // F 行（最北段，lat 39.9057~39.9070）：文教 + 科研
    // ═════════════════════════════════════════════════════════════════════════

    // F3：体育中心 15m（U 形建筑）
    {
      type: 'Feature', id: 1012,
      geometry: { type: 'Polygon', coordinates: uShape(116.4063, 39.9062, 0.00010) },
      properties: { height: 15, base_height: 0, color: '#2a69e4', name: '体育中心' }
    },
    // F4：区图书馆 20m
    {
      type: 'Feature', id: 1013,
      geometry: { type: 'Polygon', coordinates: rect(116.4082, 39.9062, 0.00022, 0.00014) },
      properties: { height: 20, base_height: 0, color: '#2a69e4', name: '区图书馆' }
    },
    // F4：建筑设计院 25m
    {
      type: 'Feature', id: 1014,
      geometry: { type: 'Polygon', coordinates: rect(116.4086, 39.9062, 0.00014, 0.00012) },
      properties: { height: 25, base_height: 0, color: '#2a69e4', name: '建筑设计院' }
    },
    // F5：科研大厦 45m
    {
      type: 'Feature', id: 1015,
      geometry: { type: 'Polygon', coordinates: rect(116.4095, 39.9062, 0.00020, 0.00012) },
      properties: { height: 45, base_height: 0, color: '#2a69e4', name: '科研大厦' }
    },
    // F5：实验楼 22m
    {
      type: 'Feature', id: 1016,
      geometry: { type: 'Polygon', coordinates: rect(116.4099, 39.9062, 0.00014, 0.00010) },
      properties: { height: 22, base_height: 0, color: '#2a69e4', name: '实验楼' }
    },

    // ═════════════════════════════════════════════════════════════════════════
    // A 行（最南段，lat 39.9015~39.9030）：轻工业 / 物流
    // ═════════════════════════════════════════════════════════════════════════

    // A2：物流中心 12m
    {
      type: 'Feature', id: 1017,
      geometry: { type: 'Polygon', coordinates: rect(116.4055, 39.9025, 0.00025, 0.00018) },
      properties: { height: 12, base_height: 0, color: '#2a69e4', name: '物流中心' }
    },
    // A4：汽修中心 8m
    {
      type: 'Feature', id: 1018,
      geometry: { type: 'Polygon', coordinates: rect(116.4082, 39.9025, 0.00030, 0.00018) },
      properties: { height: 8, base_height: 0, color: '#2a69e4', name: '汽修中心' }
    },
    // A5：建材市场 10m
    {
      type: 'Feature', id: 1019,
      geometry: { type: 'Polygon', coordinates: rect(116.4096, 39.9025, 0.00030, 0.00018) },
      properties: { height: 10, base_height: 0, color: '#2a69e4', name: '建材市场' }
    },

    // ═════════════════════════════════════════════════════════════════════════
    // 沿街商业补充（科技大道两侧底层商铺）
    // ═════════════════════════════════════════════════════════════════════════

    {
      type: 'Feature', id: 1020,
      geometry: { type: 'Polygon', coordinates: rect(116.4046, 39.9045, 0.00010, 0.00008) },
      properties: { height: 8, base_height: 0, color: '#2a69e4', name: '商铺（科技大道）' }
    },
    {
      type: 'Feature', id: 1021,
      geometry: { type: 'Polygon', coordinates: rect(116.4044, 39.9045, 0.00010, 0.00008) },
      properties: { height: 8, base_height: 0, color: '#2a69e4', name: '商铺（科技大道）' }
    },

    // ═════════════════════════════════════════════════════════════════════════
    // 东区补充住宅（E5 地块 extend）
    // ═════════════════════════════════════════════════════════════════════════

    {
      type: 'Feature', id: 1022,
      geometry: { type: 'Polygon', coordinates: rect(116.4093, 39.9053, 0.00012, 0.00014) },
      properties: { height: 55, base_height: 0, color: '#2a69e4', name: '华苑5号楼' }
    },
    {
      type: 'Feature', id: 1023,
      geometry: { type: 'Polygon', coordinates: rect(116.4097, 39.9053, 0.00012, 0.00014) },
      properties: { height: 48, base_height: 0, color: '#2a69e4', name: '华苑6号楼' }
    }
  ]
}

// ─── 底图矢量数据 ────────────────────────────────────────────────────────────

/**
 * 城市地面背景（整体大矩形，填充城市底色）
 */
export const MOCK_GROUND = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.40755, 39.9045, 0.00675, 0.0055) },
      properties: {}
    }
  ]
}

/**
 * 绿地 / 公园（坐标限定在 N2×W1 和 N2×E2 地块内）
 */
export const MOCK_PARKS = {
  type: 'FeatureCollection',
  features: [
    // N2×W1：北苑绿地公园
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4055, 39.9053, 0.0004, 0.00018) },
      properties: { name: '北苑绿地公园' }
    },
    // N2×E2：东区公园
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4096, 39.9053, 0.0004, 0.00018) },
      properties: { name: '东区公园' }
    }
  ]
}

/**
 * 市民广场 / 公共开放空间
 */
export const MOCK_PLAZAS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4075, 39.9043, 0.0004, 0.0002) },
      properties: { name: '科技广场' }
    },
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4055, 39.9036, 0.0003, 0.0001) },
      properties: { name: '南入口广场' }
    }
  ]
}

/**
 * 停车场 / 硬化地面（坐标限定在 S1×E1 和 S2×E2 地块内）
 */
export const MOCK_PARKING = {
  type: 'FeatureCollection',
  features: [
    // S1×E1：P1 地面停车场（整块用作停车）
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4082, 39.9033, 0.00045, 0.00010) },
      properties: { name: 'P1停车场' }
    },
    // S2×E2：P2 地面停车场
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: rect(116.4096, 39.9040, 0.00045, 0.00018) },
      properties: { name: 'P2停车场' }
    }
  ]
}

/**
 * 人行横道 / 斑马线（分布于主干道交叉口，每个路口东-西 + 南-北各一组）
 */
export const MOCK_CROSSWALKS = {
  type: 'FeatureCollection',
  features: [
    // ── 创业路 (39.9030) × 三条南北主干道 ──
    // 创业路 × 中央大道 (116.4048, 39.9030)
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4048, 39.9030, 0.00007, 0.00002) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4048, 39.9030, 0.000015, 0.000045) }, properties: { name: '斑马线' } },
    // 创业路 × 中轴路 (116.4075, 39.9030)
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4075, 39.9030, 0.00007, 0.00002) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4075, 39.9030, 0.000015, 0.000045) }, properties: { name: '斑马线' } },
    // 创业路 × 东环路 (116.4103, 39.9030)
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4103, 39.9030, 0.00007, 0.00002) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4103, 39.9030, 0.000015, 0.000045) }, properties: { name: '斑马线' } },

    // ── 科技大道 (39.9043) × 三条南北主干道 ──
    // 科技大道 × 中央大道 (116.4048, 39.9043)
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4048, 39.9043, 0.00007, 0.00002) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4048, 39.9043, 0.000015, 0.000045) }, properties: { name: '斑马线' } },
    // 科技大道 × 中轴路 (116.4075, 39.9043)
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4075, 39.9043, 0.00007, 0.00002) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4075, 39.9043, 0.000015, 0.000045) }, properties: { name: '斑马线' } },
    // 科技大道 × 东环路 (116.4103, 39.9043)
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4103, 39.9043, 0.00007, 0.00002) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4103, 39.9043, 0.000015, 0.000045) }, properties: { name: '斑马线' } },

    // ── 学院路 (39.9057) × 三条南北主干道 ──
    // 学院路 × 中央大道 (116.4048, 39.9057)
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4048, 39.9057, 0.00007, 0.00002) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4048, 39.9057, 0.000015, 0.000045) }, properties: { name: '斑马线' } },
    // 学院路 × 中轴路 (116.4075, 39.9057)
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4075, 39.9057, 0.00007, 0.00002) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4075, 39.9057, 0.000015, 0.000045) }, properties: { name: '斑马线' } },
    // 学院路 × 东环路 (116.4103, 39.9057)
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4103, 39.9057, 0.00007, 0.00002) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4103, 39.9057, 0.000015, 0.000045) }, properties: { name: '斑马线' } },

    // ── 科技大道 × 次级道路 ──
    // 科技大道 × 西支路 (116.4062, 39.9043)
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4062, 39.9043, 0.00005, 0.000015) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4062, 39.9043, 0.000015, 0.000035) }, properties: { name: '斑马线' } },
    // 科技大道 × 东支路 (116.4089, 39.9043)
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4089, 39.9043, 0.00005, 0.000015) }, properties: { name: '斑马线' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: rect(116.4089, 39.9043, 0.000015, 0.000035) }, properties: { name: '斑马线' } }
  ]
}
