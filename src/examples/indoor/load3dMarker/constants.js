/*
 * @Description: 空间记忆示例的地图参数、视角参数与 mock 物品数据
 * @FilePath: src/examples/indoor/space/constants.js
 */

// ===== SLAM 底图参数（与 slam_transparent.png 对齐） =====
export const MAP_CONFIG = {
  startX: -58.999993705749512,
  startY: -21.349997329711914,
  xGridCount: 2752,
  yGridCount: 1536,
  resolution: 0.05,
  center: [116.4074, 39.9042],
  zoom: 18,
  zoomFactor: 2
}

// ===== 视角参数 =====
export const VIEW_PITCH_3D = 60     // 默认三维俯仰角（°）
export const VIEW_PITCH_2D = 0      // 平面俯视角（°）
export const VIEW_TRANSITION_MS = 700
export const FIT_ZOOM_BOOST = 0.6   // fitBounds 偏小，进入三维时额外放大的层级

// ===== Marker 参数 =====
export const MARKER_SIZE = 36
export const MARKER_ICON = '/bicMap/assets/img/pos.png'

/**
 * 空间记忆物品 mock 数据
 * 机器人在室内场景中记忆的物体，coordinate 为 SLAM 笛卡尔坐标（米）：
 *   x 向东、y 向北、z 为离地高度
 * 坐标取值落在底图有效内容区域内，避免出现在四周透明留白上
 */
export const SPATIAL_ITEMS = [
  {
    id: 'sm-01',
    name: '访客服务台',
    category: '服务设施',
    coordinate: { x: 12.5, y: 22.3, z: 1.1 },
    description: '大厅中央的访客接待台，配备引导屏与叫号系统，机器人可在此完成访客登记与问询交互。'
  },
  {
    id: 'sm-02',
    name: '直饮水机',
    category: '生活设施',
    coordinate: { x: -12.0, y: 18.5, z: 1.3 },
    description: '靠西侧墙体的冷热直饮水机，日常补水点位，周边 1.2m 为机器人取水停靠区。'
  },
  {
    id: 'sm-03',
    name: '消防灭火器',
    category: '安全设施',
    coordinate: { x: 24.0, y: 8.0, z: 0.6 },
    description: '东南通道墙角的手提式干粉灭火器，属于巡检必检点，需保持周围通道畅通无遮挡。'
  },
  {
    id: 'sm-04',
    name: '机器人充电桩',
    category: '机器人设施',
    coordinate: { x: -15.0, y: 6.0, z: 0.4 },
    description: '西南角自动回充桩，低电量时机器人自动归位充电，桩前 1.5m 范围保持空置。'
  },
  {
    id: 'sm-05',
    name: '协作会议桌',
    category: '办公家具',
    coordinate: { x: 5.0, y: 12.0, z: 0.75 },
    description: '开放办公区中部的六人协作桌，配可移动座椅，机器人经过时按动态障碍处理。'
  },
  {
    id: 'sm-06',
    name: '景观绿植',
    category: '环境装饰',
    coordinate: { x: 18.0, y: 24.0, z: 1.6 },
    description: '北侧落地大型绿植，作为视觉地标用于重定位辅助，高度约 1.6m，底盘直径 0.5m。'
  },
  {
    id: 'sm-07',
    name: '公共打印机',
    category: '办公设备',
    coordinate: { x: -6.0, y: 22.0, z: 0.9 },
    description: '北墙公共多功能打印一体机，文件配送任务的常用取送点之一。'
  },
  {
    id: 'sm-08',
    name: '智能垃圾桶',
    category: '生活设施',
    coordinate: { x: 20.0, y: 15.0, z: 0.5 },
    description: '感应式分类垃圾桶，清洁任务途经点，满载时上报后端调度清运。'
  },
  {
    id: 'sm-09',
    name: '储物柜组',
    category: '办公家具',
    coordinate: { x: 0.0, y: 4.0, z: 1.8 },
    description: '南侧靠墙的高位储物柜，作为静态障碍物固定记忆，高度 1.8m 需避让顶部探测。'
  },
  {
    id: 'sm-10',
    name: '休息区沙发',
    category: '办公家具',
    coordinate: { x: -10.0, y: 11.0, z: 0.8 },
    description: '西侧员工休息区的双人沙发，人员逗留密集区域，机器人通过时降速礼让。'
  }
]
