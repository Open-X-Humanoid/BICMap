/*
 * @Description: PCD 点云查看器常量配置（默认参数、配色、SLAM 底图与对齐参数）
 * @FilePath: src/examples/expand/PcdViewer/constants.js
 */

// 点大小（three.js PointsMaterial.size，单位像素）
export const DEFAULT_POINT_SIZE = 1.3
export const MIN_POINT_SIZE = 0.3
export const MAX_POINT_SIZE = 6
export const POINT_SIZE_STEP = 0.1

// 着色模式
export const COLOR_MODE = {
  HEIGHT: 'height', // 按高度渐变
  RGB: 'rgb', // 使用点云自带 RGB
  INTENSITY: 'intensity', // 使用点云自带反射强度
  SINGLE: 'single' // 单一颜色
}

export const DEFAULT_COLOR_MODE = COLOR_MODE.RGB

export const COLOR_MODE_LABEL = {
  [COLOR_MODE.HEIGHT]: '高度',
  [COLOR_MODE.RGB]: 'RGB',
  [COLOR_MODE.INTENSITY]: '强度',
  [COLOR_MODE.SINGLE]: '单色'
}

// 高度渐变配色（t ∈ [0,1] → 颜色），近似 turbo 色带，低→高
export const HEIGHT_COLOR_STOPS = [
  [0, '#3b4cc0'],
  [0.25, '#22c1dc'],
  [0.5, '#48d17a'],
  [0.75, '#f4d03f'],
  [1, '#e74c3c']
]

// 单一着色模式下的点颜色
export const SINGLE_COLOR = '#38e1ff'

// 无底图时用黑色托点云
export const BG_COLOR = '#051230cc'

// SLAM 底图与 campus_vbr.pcd 共用同一套栅格：一个像素一格，XY 原位贴合。
// resolution 0.2 对应源点云约 0.15~0.2m 的平面间距
export const SLAM_MAP = {
  startX: -163,
  startY: -136,
  xGridCount: 1608,
  yGridCount: 1358,
  resolution: 0.2,
  zoomFactor: 2
}

// SLAM 底图在笛卡尔坐标系下的跨度与中心（米）
export const SLAM_WIDTH = SLAM_MAP.xGridCount * SLAM_MAP.resolution
export const SLAM_HEIGHT = SLAM_MAP.yGridCount * SLAM_MAP.resolution
export const SLAM_CENTER = [SLAM_MAP.startX + SLAM_WIDTH / 2, SLAM_MAP.startY + SLAM_HEIGHT / 2]

// cartesianToGPS 会把 SLAM 米数再乘一次 resolution × zoomFactor 才落到真实经纬度，
// 高度方向必须用同一系数，否则点云会被竖直拉伸
export const SLAM_GEO_SCALE = SLAM_MAP.resolution * SLAM_MAP.zoomFactor

// 内置场景点云。pcd 放在本目录 samples/，由 index.vue 用 Vite ?url 引入，
// 这样 dev / build:web 都会打进产物，npm 库发布不会带上示例资源。
// 底图是点云的俯视投影，XY 原位贴合；但点云是 2.5D 高度场，最低点贴地后
// 主体（墙体/楼面，大约 7~8m）仍悬在平面底图上方，所以要再压一截离地高度。
export const SCENE_PRESETS = [
  { id: 'campus', label: '园区扫描' }
]

// 点云在 SLAM 坐标系中的摆放参数：x/y 为平移量（米）、rotation 为绕 Z 轴角度、z 为离地高度。
// 默认零变换给外部 PCD；内置场景的额外偏移写在 SCENE_PRESETS[].align
export const DEFAULT_ALIGN = {
  x: 0,
  y: 0,
  z: 0,
  rotation: 0,
  scale: 1
}

// 平移滑块量程：以底图跨度为界，够把点云从一角推到另一角
export const OFFSET_X_RANGE = [-SLAM_WIDTH, SLAM_WIDTH]
export const OFFSET_Y_RANGE = [-SLAM_HEIGHT, SLAM_HEIGHT]

export const ALIGN_STEP = 0.5
export const ROTATION_STEP = 1
export const SCALE_RANGE = [0.1, 5]
export const SCALE_STEP = 0.1
export const HEIGHT_RANGE = [-10, 30]
export const HEIGHT_STEP = 0.5

// 初始视角，三项互不影响，改完刷新或点「重置视角」生效
export const MAP_VIEW = {
  pitch: 60, // 俯仰角（度），0 正俯视，越大越斜
  bearing: -15, // 旋转角（度），顺时针，0 为正北
  zoom: 19 // 缩放；null 表示按底图自适应
}

// 体素降采样：叶子尺寸（米），0 表示关闭
export const DEFAULT_LEAF_SIZE = 0
export const MAX_LEAF_SIZE = 0.5
export const LEAF_SIZE_STEP = 0.01

// 统计离群点去除（StatisticalOutlierRemoval）参数
export const SOR_MEAN_K = 30
export const SOR_STDDEV_MUL = 1
