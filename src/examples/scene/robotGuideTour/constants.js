/**
 * 博物馆服务机器人导览讲解 Demo — 常量与 Mock 点位数据
 */

/** 工程通用室内 SLAM 地图栅格参数（与 indoor 系列示例一致） */
export const SLAM_MAP_CONFIG = {
  startX: -58.999993705749512,
  startY: -21.349997329711914,
  xGridCount: 2752,
  yGridCount: 1536,
  resolution: 0.05
}

const { startX, startY, xGridCount, yGridCount, resolution } = SLAM_MAP_CONFIG

/** SLAM 地图实际宽度（米） */
export const MAP_WIDTH_M = xGridCount * resolution
/** SLAM 地图实际高度（米） */
export const MAP_HEIGHT_M = yGridCount * resolution

/** 导览机器人运动与到达判定 */
export const ROBOT_TOUR_CONFIG = {
  robotId: 'guide-robot-01',
  robotName: '导览机器人-01',
  moveSpeedMps: 1.8,
  /** 单段最短行驶时间（ms），过短路段也保证可见的滑动过程 */
  minLegDurationMs: 800,
  dwellMs: 6000,
  iconHeadingOffset: -90,
  /** 机器人图标尺寸（px，robo 图层 icon-size = size/48） */
  robotMarkerSize: 28,
  poiMarkerSize: 32
}

/**
 * 导览完整路线：含走廊折线途经点
 * 相邻航点仅改 xFrac 或 yFrac 之一，机器人沿水平/竖直段行驶，避免斜穿墙体
 * narrate: true 的点位会停靠讲解；false 为途经点，不停留
 *
 * 点位对应平面图区域：
 *   poi-entrance  博物馆序厅        — 建筑底部中央入口门厅
 *   poi-mainhall  博物馆入口大厅    — 顶部中央超大展室
 *   poi-shop      文创店            — 左上角文创商品区
 *   poi-ancient   古代中国陈列馆    — 左侧大展厅（圆形展台区）
 *   poi-rejuv     复兴之路展厅      — 中间偏左独立展室
 *   poi-modern    近现代史陈列馆    — 与复兴之路展厅同水平线右侧展室
 *   poi-interact  数字文化体验馆    — 最右侧独立房间
 *   poi-lounge    观众休息厅        — 左下角餐饮休息区
 */
export const TOUR_ROUTE = [
  {
    id: 'poi-mainhall',
    name: '博物馆入口大厅',
    xFrac: 0.5,
    yFrac: 0.22,
    narrate: true,
    title: '博物馆入口大厅',
    tag: '大厅 · 01',
    summary: '恢宏序厅与馆史陈列',
    narration:
      '博物馆入口大厅是本馆标志性空间，高达十余米的穹顶与四壁浮雕浓缩了中华五千年文明印记。大厅中央陈列本馆镇馆之宝复制件，东西两侧回廊导引参观动线，是感受博物馆气势的第一站。'
  },
  {
    id: 'poi-entrance',
    name: '博物馆序厅',
    xFrac: 0.5,
    yFrac: 0.84,
    narrate: true,
    title: '博物馆序厅',
    tag: '序厅 · 02',
    summary: '参观导览与综合服务',
    narration:
      '欢迎来到博物馆序厅。这里设有游客服务台、语音导览领取处与无障碍服务窗口。本馆现设六大常设展览，导览机器人将全程陪同您一一探访，请跟随提示出发。'
  },
  // 博物馆序厅 → 北行至主走廊，再西行至左上角文创店
  { id: 'via-sh1', name: '', xFrac: 0.5, yFrac: 0.7, narrate: false },
  { id: 'via-sh2', name: '', xFrac: 0.22, yFrac: 0.7, narrate: false },
  {
    id: 'poi-shop',
    name: '文创店',
    xFrac: 0.22,
    yFrac: 0.8,
    narrate: true,
    title: '文创店',
    tag: '文创 · 03',
    summary: '博物馆主题文创商品展售',
    narration:
      '文创店位于博物馆左上角，精选馆藏文物为灵感来源的文创商品，涵盖书签、丝巾、陶瓷复制件与儿童益智套装。每一件商品都是将历史带回家的最佳方式，欢迎挑选留念。'
  },
  // 文创店 → 南行至主走廊，东行至古代中国陈列馆入口
  { id: 'via-sh3', name: '', xFrac: 0.22, yFrac: 0.7, narrate: false },
  { id: 'via-sh4', name: '', xFrac: 0.08, yFrac: 0.7, narrate: false },
  // 已在主走廊西端 (0.08, 0.48)，直接南下进入古代中国陈列馆
  {
    id: 'poi-ancient',
    name: '古代中国陈列馆',
    xFrac: 0.08,
    yFrac: 0.5,
    narrate: true,
    title: '古代中国陈列馆',
    tag: '古代 · 03',
    summary: '远古文明至清代历史文物',
    narration:
      '古代中国陈列馆是本馆核心常设展览，通览远古时期至清代末年的历史进程。馆内圆形展台集中呈现青铜礼器、玉器、陶瓷与书画珍品，系统展现中华文明五千年的连续性与多元性。'
  },
  // 古代中国陈列馆 → 东行至复兴之路展厅（中间偏左展室，南下入室）
  { id: 'via-a1', name: '', xFrac: 0.08, yFrac: 0.48, narrate: false },
  { id: 'via-a2', name: '', xFrac: 0.28, yFrac: 0.48, narrate: false },
  {
    id: 'poi-rejuv',
    name: '复兴之路展厅',
    xFrac: 0.3,
    yFrac: 0.48,
    narrate: true,
    title: '复兴之路展厅',
    tag: '复兴 · 04',
    summary: '1840年至今的民族复兴历程',
    narration:
      '复兴之路展厅记录自1840年鸦片战争以来中国人民为实现民族复兴而进行的艰辛探索与奋斗历程。展厅通过实物、文献与沉浸式影像，带您感受百余年间中华民族从站起来、富起来到强起来的伟大飞跃。'
  },
  // 复兴之路展厅 → 北回主走廊，东行至近现代史陈列馆（同水平线右侧，南下入室）
  {
    id: 'poi-modern',
    name: '近现代史陈列馆',
    xFrac: 0.7,
    yFrac: 0.48,
    narrate: true,
    title: '近现代史陈列馆',
    tag: '近代 · 05',
    summary: '新中国成立以来的历史成就',
    narration:
      '近现代史陈列馆聚焦新中国成立至改革开放以来的重大历史节点与建设成就。馆内珍藏大量历史档案、领导人手稿与重要历史事件的实物见证，是了解当代中国发展脉络的重要窗口。'
  },
  // 近现代史陈列馆 → 北回主走廊，东行进入数字文化体验馆
  {
    id: 'poi-interact',
    name: '数字文化体验馆',
    xFrac: 0.9,
    yFrac: 0.48,
    narrate: true,
    title: '数字文化体验馆',
    tag: '体验 · 06',
    summary: '文物数字化与沉浸式互动',
    narration:
      '数字文化体验馆运用 AR 增强现实与高清三维扫描技术，让观众近距离"触摸"馆藏文物的数字复原影像。这里还设有儿童历史探知工坊与文创商品区，是家庭亲子参观的热门打卡地。'
  },
  // 数字文化体验馆 → 折返主走廊西行，南下至观众休息厅
  { id: 'via-i1', name: '', xFrac: 0.9, yFrac: 0.28, narrate: false },
  { id: 'via-i2', name: '', xFrac: 0.83, yFrac: 0.34, narrate: false },
  { id: 'via-i3', name: '', xFrac: 0.73, yFrac: 0.34, narrate: false },
  { id: 'via-i4', name: '', xFrac: 0.73, yFrac: 0.23, narrate: false },
  {
    id: 'poi-lounge',
    name: '观众休息厅',
    xFrac: 0.08,
    yFrac: 0.22,
    narrate: true,
    title: '观众休息厅',
    tag: '休息 · 07',
    summary: '餐饮休憩与文创展售',
    narration:
      '观众休息厅位于建筑西南角，设有咖啡吧台与多组休闲座椅，为观众提供轻食饮品与休憩空间。导览至此已接近尾声，感谢您的参观，期待您再次莅临！'
  },
  // 观众休息厅 → 东行返回序厅
  // { id: 'via-l1', name: '', xFrac: 0.08, yFrac: 0.22, narrate: false },
]

/** 讲解停靠点（地图 POI 标注与进度计数用） */
export const TOUR_POIS = TOUR_ROUTE.filter((w) => w.narrate !== false && w.title)
